// play_probe.mjs — verify-by-playing, headless, one run at a time.
//
// The frozen-run lesson: a green `vite build` on a 558 KB bundle hid a game
// where the formation never moved and firing did nothing. So this does not
// trust the build. It serves the built game, opens it in headless Chromium,
// presses START if there is one, then PLAYS: real key events for eight
// seconds, sampling the HUD, and pixel-diffing the canvas to see whether
// anything on screen moves without input (formation marching) and whether
// score changes with input (firing + collision + scoring).
//
// Outcome ladder, worst to best:
//   broken    - JS error at load, or nothing rendered
//   renders   - canvas paints and the loop runs, but score never moves
//   plays     - score increased under input: fire, hit, score all wired
//
// Usage: node play_probe.mjs <ws-dir> <out-json> [port]
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { existsSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ws = process.argv[2];
const outPath = process.argv[3];
const port = Number(process.argv[4] || 5900 + Math.floor(Math.random() * 90));
const result = { ws, port, outcome: 'broken', errors: [], notes: [] };

function findGamePage(root) {
  // prefer a Space_Invaders/index.html, fall back to root index.html
  const cands = [];
  const walk = (d, depth) => {
    if (depth > 3) return;
    for (const f of readdirSync(d)) {
      if (['node_modules', 'dist', '.git'].includes(f)) continue;
      const p = join(d, f);
      if (statSync(p).isDirectory()) walk(p, depth + 1);
      else if (f.toLowerCase() === 'index.html') cands.push(p);
    }
  };
  walk(root, 0);
  cands.sort((a, b) => (/space.?invaders/i.test(b) ? 1 : 0) - (/space.?invaders/i.test(a) ? 1 : 0));
  return cands[0] ? cands[0].slice(root.length).replace(/\\/g, '/').replace(/^\//, '') : 'index.html';
}

const page_rel = findGamePage(ws);
result.page = page_rel;

// serve with vite dev (the model's own vite.config applies)
const server = spawn('npx', ['vite', '--port', String(port), '--strictPort', '--host', '127.0.0.1'],
  { cwd: ws, shell: true, stdio: ['ignore', 'pipe', 'pipe'] });
let serverUp = false;
server.stdout.on('data', d => { if (/localhost|127\.0\.0\.1/.test(String(d))) serverUp = true; });
for (let i = 0; i < 60 && !serverUp; i++) await new Promise(r => setTimeout(r, 250));

const browser = await chromium.launch({ headless: true, args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.on('pageerror', e => result.errors.push(String(e.message || e).slice(0, 160)));
  page.on('console', m => { if (m.type() === 'error' && !/favicon/i.test(m.text())) result.errors.push('console: ' + m.text().slice(0, 160)); });

  const url = `http://127.0.0.1:${port}/${page_rel}`;
  result.url = url;
  const resp = await page.goto(url, { waitUntil: 'load', timeout: 30000 }).catch(e => { result.notes.push('goto: ' + e.message.slice(0, 100)); return null; });
  if (!resp || !resp.ok()) { result.notes.push('page did not load: ' + (resp ? resp.status() : 'no response')); throw new Error('noload'); }
  await page.waitForTimeout(1500);

  // dismiss any title screen: click the most start-like button, then also press Enter/Space
  const clicked = await page.evaluate(() => {
    const els = [...document.querySelectorAll('button, a, [role=button], div, span')]
      .filter(e => e.offsetHeight > 0 && /^(start|launch|play|begin|press|new game|play again)/i.test((e.textContent || '').trim()));
    if (els[0]) { els[0].click(); return (els[0].textContent || '').trim().slice(0, 30); }
    return null;
  });
  result.start_clicked = clicked;
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1200);

  const canvas = await page.$('canvas');
  result.has_canvas = !!canvas;
  if (!canvas) { result.notes.push('no canvas'); throw new Error('nocanvas'); }

  // A single 8-second pass is a noisy instrument: the same run scored 50 once
  // and 0 the next. "Plays" is a capability claim -- one success proves it --
  // so run up to three passes and keep the best. Reload between passes so a
  // game-over screen from pass one cannot block pass two.
  const ATTEMPTS = Number(process.env.PLAY_ATTEMPTS || 3);
  result.attempts = [];
  const hud = async () => (await page.evaluate(() => (document.body.innerText || '').replace(/\s+/g, ' '))).slice(0, 400);
  const scoreOf = t => { const m = t.match(/score[^0-9]{0,12}([0-9][0-9,]*)/i); return m ? parseInt(m[1].replace(/,/g, ''), 10) : null; };

  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
  if (attempt > 1) {
    await page.reload({ waitUntil: 'load' }).catch(() => {});
    await page.waitForTimeout(1500);
    await page.evaluate(() => {
      const els = [...document.querySelectorAll('button, a, [role=button], div, span')]
        .filter(e => e.offsetHeight > 0 && /^(start|launch|play|begin|press|new game|play again)/i.test((e.textContent || '').trim()));
      if (els[0]) els[0].click();
    });
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1200);
  }
  const canvasNow = await page.$('canvas'); if (!canvasNow) break;
  // idle motion: does anything change on screen with NO input?
  const shot0 = await canvasNow.screenshot({ type: 'png' });
  await page.waitForTimeout(2500);
  const shot1 = await canvasNow.screenshot({ type: 'png' });
  const idle = Buffer.compare(shot0, shot1) !== 0;
  const hudBefore = await hud();
  const scoreBefore = scoreOf(hudBefore);

  // play: alternate left/right, fire continuously, 8 seconds of real key events
  for (let i = 0; i < 32; i++) {
    const dir = i < 16 ? 'ArrowLeft' : 'ArrowRight';
    await page.keyboard.down(dir);
    await page.keyboard.press('Space');
    await page.waitForTimeout(120);
    await page.keyboard.up(dir);
    await page.waitForTimeout(130);
  }
  const hudAfter = await hud();
  const scoreAfter = scoreOf(hudAfter);
  const delta = (scoreAfter ?? 0) - (scoreBefore ?? 0);
  result.attempts.push({ attempt, idle, scoreBefore, scoreAfter, delta });
  if (attempt === 1 || delta > (result.score_delta ?? -1)) {
    result.idle_bytes_differ = idle; result.hud_before = hudBefore; result.hud_after = hudAfter;
    result.score_before = scoreBefore; result.score_after = scoreAfter; result.score_delta = delta;
    writeFileSync(outPath.replace(/\.json$/, '.png'), await canvasNow.screenshot({ type: 'png' }));
  }
  if (delta > 0) break;                       // capability shown; no need to keep going
  }

  if (result.errors.some(e => /^(?!console)/.test(e))) result.notes.push('page errors present');
  if ((result.score_delta ?? 0) > 0) result.outcome = 'plays';
  else if (result.idle_bytes_differ || result.has_canvas) result.outcome = 'renders';
} catch (e) {
  if (!['noload', 'nocanvas'].includes(e.message)) result.notes.push('probe: ' + String(e.message).slice(0, 120));
} finally {
  await browser.close().catch(() => {});
  try { process.kill(server.pid); } catch {}
  // vite spawned through a shell: make sure the real node child dies too
  spawn('powershell.exe', ['-NoProfile', '-Command',
    `Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like '*--port ${port}*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }`],
    { stdio: 'ignore', shell: false });
}
writeFileSync(outPath, JSON.stringify(result, null, 1));
console.log(`${result.outcome.padEnd(8)} best ${result.score_before ?? '-'} -> ${result.score_after ?? '-'} in ${(result.attempts||[]).length} pass(es)  idle-motion=${result.idle_bytes_differ}  errors=${result.errors.length}  ${result.notes.join('; ')}`);
