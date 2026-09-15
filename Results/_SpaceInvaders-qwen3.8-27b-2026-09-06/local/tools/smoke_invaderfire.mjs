// tools/smoke_invaderfire.mjs — verify the invader-fire path.
// Keeps the player stationary at center (no input) so invader bullets from the
// center column fall on it. If invader fire + bullet-vs-player collision work,
// lives must decrement (or the game ends by invasion). Connects to a running
// Chromium CDP endpoint.
//
// Usage: node tools/smoke_invaderfire.mjs [pageUrl]

const CDP_HOST = '127.0.0.1';
const CDP_PORT = process.env.CDP_PORT || 9333;
const PAGE_URL = process.argv[2] || 'http://localhost:4173/Space_Invaders/';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getPageWsUrl() {
  for (let i = 0; i < 40; i++) {
    try {
      const res = await fetch(`http://${CDP_HOST}:${CDP_PORT}/json/list`);
      const list = await res.json();
      const page = list.find((t) => t.type === 'page');
      if (page) return page.webSocketDebuggerUrl;
    } catch {}
    await sleep(250);
  }
  throw new Error('no page target');
}

let id = 0;
const pending = new Map();
const pageErrors = [];

function connect(wsUrl) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    ws.onopen = () => resolve(ws);
    ws.onerror = (e) => reject(new Error('ws error: ' + (e.message || e)));
    ws.onmessage = (m) => {
      const msg = JSON.parse(m.data);
      if (msg.id && pending.has(msg.id)) {
        const { resolve: r, reject: j } = pending.get(msg.id);
        pending.delete(msg.id);
        msg.error ? j(new Error(msg.error.message)) : r(msg.result);
      } else if (msg.method === 'Runtime.exceptionThrown') {
        const d = msg.params.exceptionDetails;
        pageErrors.push(d.exception?.description || d.text || 'pageerror');
      }
    };
  });
}

function send(ws, method, params = {}) {
  return new Promise((resolve, reject) => {
    const myId = ++id;
    pending.set(myId, { resolve, reject });
    ws.send(JSON.stringify({ id: myId, method, params }));
    setTimeout(() => { if (pending.has(myId)) { pending.delete(myId); reject(new Error('timeout ' + method)); } }, 15000);
  });
}

async function evaluate(ws, expression) {
  const r = await send(ws, 'Runtime.evaluate', { expression, returnByValue: true, allowUnsafeEvalBlockedByCSP: true });
  if (r.exceptionDetails) throw new Error('eval: ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text));
  return r.result?.value;
}

let failed = false;
function check(name, cond, extra = '') {
  const ok = !!cond;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  — ' + extra : ''}`);
  if (!ok) failed = true;
}

try {
  const ws = await connect(await getPageWsUrl());
  await send(ws, 'Runtime.enable');
  await send(ws, 'Page.enable');

  await send(ws, 'Page.navigate', { url: PAGE_URL });
  await sleep(3000);

  // Start the game.
  await evaluate(ws, `document.querySelector('#hud-overlay-btn')?.click()`);
  await sleep(300);
  check('game started', (await evaluate(ws, `document.querySelector('.overlay-screen').classList.contains('hidden')`)) === true);

  // Keep the player stationary at center (send NO input). Invader bullets from
  // the center column should fall on it. Sample lives until game over or 25s.
  let minLives = 3;
  let gameOver = false;
  const samples = [];
  for (let i = 0; i < 25; i++) {
    await sleep(1000);
    const s = await evaluate(ws, `(() => {
      const overlay = document.querySelector('.overlay-screen');
      const go = overlay && !overlay.classList.contains('hidden') &&
                 (document.querySelector('#hud-overlay-title')?.textContent || '').toUpperCase().includes('GAME OVER');
      const lives = document.querySelectorAll('#hud-lives .life-icon').length;
      return { lives, go };
    })()`);
    minLives = Math.min(minLives, s.lives);
    samples.push(s.lives);
    if (s.go) { gameOver = true; break; }
  }
  console.log('  lives over time: [' + samples.join(',') + ']  minLives=' + minLives + '  gameOver=' + gameOver);

  // The invader-fire path is proven if the player was hit (lives dropped) OR
  // the game ended (invasion) — both require the sim to run. The specific
  // signal we want: lives dropped below 3, meaning a bullet hit the player.
  check('invader bullet hit the player (lives dropped)', minLives < 3, 'minLives=' + minLives);
  check('no page errors', pageErrors.length === 0, pageErrors.slice(0, 3).join(' | '));

  ws.close();
} catch (e) {
  failed = true;
  console.log('  FAIL  harness: ' + e.message);
}

console.log(failed ? '\nINVADERFIRE: FAILED' : '\nINVADERFIRE: PASSED');
process.exit(failed ? 1 : 0);
