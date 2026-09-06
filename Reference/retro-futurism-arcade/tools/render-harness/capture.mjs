/**
 * Capture frames from the render harness at 1920 x 1080 and hand them to
 * `measure-frame.py`.
 *
 * The judging checklist requires captures at exactly 1920 x 1080, in the same
 * game state as the reference plate being compared against, so the viewport is
 * fixed here rather than inherited from whatever window happened to be open.
 * `deviceScaleFactor: 1` matters as much as the size: at 2 the renderer would
 * draw 3840 x 2160 and the bloom kernel's width *as a fraction of frame
 * height* would be identical but its width in captured pixels would double,
 * and the halo profile is reported as a fraction of frame height.
 *
 * Usage, with the dev server already running:
 *
 *   node capture.mjs --port 5199 --out ../../../../wayfinder/.../our-frames
 *
 * Every capture is deterministic: the harness's `seek(t)` resets the state and
 * replays a fixed number of fixed-size steps, so re-running this produces the
 * same pixels and a metric change means a code change.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

/**
 * Resolve Playwright without adding it to the build's own dependency tree.
 *
 * The reference build ships `three` and `vite` and nothing else, and a capture
 * tool has no business changing that — a browser automation dependency in the
 * artifact under measurement is exactly the sort of drift that makes a
 * reference build stop being comparable. The playability gate already installs
 * Playwright for its own purposes, so this borrows that install and falls back
 * to a normal resolution if one happens to be closer.
 */
async function loadPlaywright() {
  try {
    return await import('playwright');
  } catch {
    const shared = path.resolve(
      process.cwd(),
      '../../wayfinder/retro-futurism-space-invaders/assets/playability-gate/node_modules/playwright/index.mjs'
    );
    const override = readArgEarly('playwright');
    const candidate = override ? path.resolve(override) : shared;
    if (!existsSync(candidate)) {
      throw new Error(
        `capture.mjs: no Playwright install found. Tried "${candidate}". ` +
          'Pass --playwright <path to playwright/index.mjs>.'
      );
    }
    return import(pathToFileURL(candidate).href);
  }
}

function readArgEarly(name) {
  const argv = process.argv.slice(2);
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : null;
}

const args = process.argv.slice(2);
const readArg = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};

const PORT = readArg('port', '5199');
const OUT = path.resolve(readArg('out', './captures'));
const BASE = `http://localhost:${PORT}/tools/render-harness/index.html`;

/**
 * The capture set.
 *
 * `quiet` is judged against the reference's quiet plates and is where the
 * tonal floor and the bloom halo profile are measured — a busy frame has no
 * isolated emitters to measure a halo on. `play` is ordinary play and is the
 * frame the tonal envelope is really about. `busy` is the ceiling: it is
 * allowed more white and more magenta than the others because the mystery
 * ship is on screen. `warp` exists to catch the entrance animation, which is
 * the one state that is easy to leave visually broken because it is only on
 * screen for a second at the start of a wave.
 */
const SHOTS = [
  { scene: 'quiet', t: 6.0, name: '01-quiet' },
  { scene: 'quiet', t: 21.5, name: '02-quiet-descended' },
  { scene: 'play', t: 9.0, name: '03-play' },
  { scene: 'play', t: 17.25, name: '04-play-bombs' },
  { scene: 'busy', t: 4.0, name: '05-busy-ufo' },
  { scene: 'busy', t: 26.5, name: '06-busy-late' },
  { scene: 'warp', t: 0.4, name: '07-warp-in' }
];

async function main() {
  const { chromium } = await loadPlaywright();
  await mkdir(OUT, { recursive: true });

  const browser = await chromium.launch({
    args: [
      // Software WebGL is unusable for this: SwiftShader will not composite a
      // float render target the way a real driver does, and the whole point of
      // the capture is the HDR bloom path.
      '--use-gl=angle',
      '--use-angle=default',
      '--enable-unsafe-swiftshader',
      '--disable-lcd-text'
    ]
  });
  const page = await browser.newPage({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1
  });

  const consoleErrors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error' || msg.type() === 'warning') {
      consoleErrors.push(`${msg.type()}: ${msg.text()}`);
    }
  });
  page.on('pageerror', (err) => consoleErrors.push(`pageerror: ${err.message}`));

  const results = [];

  for (const shot of SHOTS) {
    await page.goto(`${BASE}?scene=${shot.scene}`, { waitUntil: 'load' });
    await page.waitForFunction(() => window.__harness && window.__harness.ready, null, {
      timeout: 15000
    });
    // Stop the live loop first, or the screenshot races an animation frame and
    // two runs of the same seek differ by a frame's worth of bob.
    await page.evaluate(() => window.__harness.pause());
    await page.evaluate((t) => window.__harness.seek(t), shot.t);

    const stats = await page.evaluate(() => window.__harness.stats());
    const file = path.join(OUT, `${shot.name}.png`);
    await page.screenshot({ path: file, type: 'png' });

    results.push({ ...shot, file, stats });
    console.log(
      `${shot.name.padEnd(20)} draws=${String(stats.drawCalls).padStart(3)} ` +
        `tris=${String(stats.triangles).padStart(7)} materials=${stats.materials} ` +
        `stars=${stats.stars} bunkerCells=${stats.bunkerCells}`
    );
  }

  await writeFile(
    path.join(OUT, 'capture-report.json'),
    JSON.stringify({ base: BASE, shots: results, consoleErrors }, null, 2)
  );

  if (consoleErrors.length) {
    console.log('\nConsole output during capture:');
    for (const line of consoleErrors) console.log(`  ${line}`);
  } else {
    console.log('\nNo console errors or warnings during capture.');
  }

  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
