// Gameplay acceptance smoke test: drives Space Invaders through a real browser at the input
// boundary (keyboard events, an injected standard gamepad) and asserts both terminal states.
//
//   npm run dev            (in one terminal)
//   npm run test:smoke     (in another; needs `npm i -D playwright` + `npx playwright install chromium`)
//
// Set SI_URL to point at a different dev server.

const BASE = process.env.SI_URL || 'http://127.0.0.1:5173';

let playwright;
try {
  playwright = await import('playwright');
} catch {
  console.error('playwright is not installed. Run: npm i -D playwright && npx playwright install chromium');
  process.exit(2);
}

const browser = await playwright.chromium.launch({ headless: true, args: ['--use-gl=angle', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
const problems = [];
page.on('console', (m) => {
  if (m.type() === 'error' || m.type() === 'warning') problems.push(`[console.${m.type()}] ${m.text()}`);
});
page.on('pageerror', (e) => problems.push(`[pageerror] ${e.message}`));

const snap = () => page.evaluate(() => window.__SI__.snapshot());
const waitState = (s, ms = 20000) => page.waitForFunction((s) => window.__SI__.snapshot().state === s, s, { timeout: ms });
const assert = (cond, msg) => {
  if (!cond) throw new Error(`ASSERT: ${msg}`);
  console.log(`  ok  ${msg}`);
};

try {
  await page.addInitScript(() => {
    window.__pad = {
      id: 'Smoke Test Pad', index: 0, connected: true, mapping: 'standard', timestamp: 0,
      buttons: Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 })),
      axes: [0, 0, 0, 0],
    };
    navigator.getGamepads = () => [window.__pad, null, null, null];
  });
  await page.goto(`${BASE}/Space_Invaders/?seed=11`);
  await page.waitForFunction(() => window.__SI__ && window.__SI__.snapshot().state === 'TITLE', null, { timeout: 15000 });
  assert(true, 'boots to TITLE');

  // Keyboard: start, play, pause.
  await page.keyboard.press('Enter');
  await waitState('WAVE_INTRO', 5000);
  await waitState('PLAY');
  await page.keyboard.down('Space');
  for (let i = 0; i < 4; i++) {
    const key = i % 2 ? 'ArrowRight' : 'ArrowLeft';
    await page.keyboard.down(key);
    await page.waitForTimeout(900);
    await page.keyboard.up(key);
  }
  await page.keyboard.up('Space');
  let s = await snap();
  assert(s.invaders < 55, `keyboard play registered kills (invaders=${s.invaders}, score=${s.score})`);
  if (s.state === 'PLAY') {
    await page.keyboard.press('Escape');
    await waitState('PAUSED', 3000);
    await page.keyboard.press('Escape');
    await waitState('PLAY', 3000);
    assert(true, 'pause / resume via Escape');
  }

  // Gamepad: stick moves the cannon, RT fires.
  await waitState('PLAY');
  const x0 = (await snap()).playerX;
  await page.evaluate(() => { window.__pad.axes[0] = 0.8; });
  await page.waitForTimeout(500);
  await page.evaluate(() => { window.__pad.axes[0] = 0; });
  const x1 = (await snap()).playerX;
  assert(x1 > x0 + 1, `gamepad stick moved the cannon (${x0.toFixed(1)} → ${x1.toFixed(1)})`);
  const shots0 = await page.evaluate(() => window.__SI__.game.score.stats.shots);
  await page.evaluate(() => { window.__pad.buttons[7].pressed = true; window.__pad.buttons[7].value = 1; });
  await page.waitForTimeout(120);
  await page.evaluate(() => { window.__pad.buttons[7].pressed = false; window.__pad.buttons[7].value = 0; });
  await page.waitForTimeout(100);
  const shots1 = await page.evaluate(() => window.__SI__.game.score.stats.shots);
  assert(shots1 > shots0, 'gamepad RT fired');

  // Win: clear five waves.
  for (let w = 1; w <= 5; w++) {
    await waitState('PLAY', 30000);
    await page.evaluate(() => window.__SI__.killAll());
    if (w < 5) await waitState('WAVE_INTRO', 8000);
  }
  await waitState('VICTORY', 8000);
  s = await snap();
  assert(s.state === 'VICTORY' && s.score > 0, `VICTORY reached (score=${s.score})`);

  // Back to title, then lose: keep dying until GAME_OVER (extra lives may have been earned).
  await page.waitForTimeout(2800);
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await waitState('TITLE', 5000);
  await page.keyboard.press('Enter');
  await waitState('PLAY', 30000);
  for (let k = 0; k < 10; k++) {
    const st = (await snap()).state;
    if (st === 'GAME_OVER') break;
    await waitState('PLAY', 30000).catch(() => {});
    if ((await snap()).state === 'PLAY') {
      await page.evaluate(() => window.__SI__.forceHit());
      await page.waitForTimeout(2100);
    }
  }
  await waitState('GAME_OVER', 8000);
  s = await snap();
  assert(s.state === 'GAME_OVER' && s.lives === 0, 'GAME_OVER reached with 0 lives');

  // Teardown releases GPU resources and DOM.
  const after = await page.evaluate(() => {
    const e = window.__SI__.engine;
    e.dispose();
    return { ...e.renderer.info.memory, canvas: !!document.querySelector('canvas'), ui: !!document.querySelector('.ui-root') };
  });
  assert(after.geometries === 0 && after.textures === 0 && !after.canvas && !after.ui, 'engine.dispose() released geometries, textures and DOM');

  assert(problems.length === 0, `no console errors or warnings${problems.length ? '\n' + problems.join('\n') : ''}`);
  console.log('\nSMOKE TEST PASSED');
  await browser.close();
  process.exit(0);
} catch (err) {
  console.error(`\nSMOKE TEST FAILED: ${err.message}`);
  if (problems.length) console.error(problems.join('\n'));
  await browser.close();
  process.exit(1);
}
