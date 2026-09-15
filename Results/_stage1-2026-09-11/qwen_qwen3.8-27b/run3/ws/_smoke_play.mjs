// Functional smoke test: boot, start, fire, verify score increases,
// pause/resume, destroy. Reads state from the public HUD DOM + the
// window.__game handle (start/pause/resume/destroy). No internal access.
import { chromium } from 'file:///C:/Users/ktmar/AppData/Local/npm-cache/_npx/705bc6b22212b352/node_modules/playwright/index.mjs';

const URL = process.env.URL || 'http://localhost:5174/';
const errors = [];

const browser = await chromium.launch({
  headless: true,
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));

await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);

const boot = await page.evaluate(() => {
  const b = document.getElementById('boot');
  return { bootGone: !b || b.classList.contains('hidden'), canvas: document.querySelectorAll('#game canvas').length, hasHandle: !!window.__game };
});
console.log('BOOT', JSON.stringify(boot));

// Start the game.
await page.evaluate(() => {
  const btn = [...document.querySelectorAll('.glass-btn')].find((b) => b.textContent === 'START');
  if (btn) btn.click();
});
await page.waitForTimeout(800);

const hud = () => page.evaluate(() => {
  const q = (s) => document.querySelector(s)?.textContent?.trim();
  return {
    score: parseInt(q('.hud-score .hud-value') || '0', 10),
    wave: q('.hud-wave .hud-value'),
    combo: q('.hud-combo .hud-value'),
    lives: document.querySelectorAll('.life:not(.life-off)').length,
  };
});

const before = await hud();
console.log('BEFORE', JSON.stringify(before));

// Fire continuously for ~4s (hold Space) and sweep the ship across the field.
await page.keyboard.down('Space');
await page.keyboard.down('KeyD');
await page.waitForTimeout(1200);
await page.keyboard.up('KeyD');
await page.keyboard.down('KeyA');
await page.waitForTimeout(1200);
await page.keyboard.up('KeyA');
await page.waitForTimeout(1600);
await page.keyboard.up('Space');

const after = await hud();
console.log('AFTER', JSON.stringify(after));
const scored = after.score > before.score;
console.log('SCORED', scored ? 'YES' : 'NO', `(${before.score} -> ${after.score})`);

// Pause / resume via the public handle.
const pauseTest = await page.evaluate(async () => {
  const g = window.__game;
  g.pause();
  await new Promise((r) => setTimeout(r, 200));
  const paused = [...document.querySelectorAll('.glass-panel')].some((e) => e.querySelector('.gp-title')?.textContent === 'PAUSED' && !e.classList.contains('glass-hidden'));
  g.resume();
  await new Promise((r) => setTimeout(r, 200));
  const resumed = ![...document.querySelectorAll('.glass-panel')].some((e) => e.querySelector('.gp-title')?.textContent === 'PAUSED' && !e.classList.contains('glass-hidden'));
  return { paused, resumed };
});
console.log('PAUSE_TEST', JSON.stringify(pauseTest));

// Destroy (full teardown) and confirm the DOM is cleaned up.
const destroyResult = await page.evaluate(async () => {
  window.__game.destroy();
  await new Promise((r) => setTimeout(r, 300));
  return {
    canvasGone: document.querySelectorAll('#game canvas').length === 0,
    hudGone: !document.querySelector('.hud'),
    panelsGone: document.querySelectorAll('.glass-panel').length === 0,
  };
});
console.log('AFTER_DESTROY', JSON.stringify(destroyResult));

console.log('ERRORS', errors.length, JSON.stringify(errors.slice(0, 10)));
await browser.close();
process.exit(errors.length ? 1 : 0);
