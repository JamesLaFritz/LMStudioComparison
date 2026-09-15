// tools/smoke_extended.mjs — deeper runtime test.
// Connects to a running Chromium CDP endpoint. Loads the game, plays ~30s of
// continuous fire+move to exercise invader fire / player-hit / shield paths,
// then verifies the dispose() teardown runs clean (strict memory management).
//
// Usage: node tools/smoke_extended.mjs [pageUrl]

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
  throw new Error('no about:blank page target');
}

let id = 0;
const pending = new Map();
const consoleErrors = [];
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
      } else if (msg.method) {
        if (msg.method === 'Runtime.exceptionThrown') {
          const d = msg.params.exceptionDetails;
          pageErrors.push(d.exception?.description || d.text || 'pageerror');
        } else if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
          consoleErrors.push(msg.params.args.map((a) => a.value ?? a.description ?? '').join(' '));
        }
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
  await sleep(2500);

  // Start the game.
  await evaluate(ws, `document.querySelector('#hud-overlay-btn')?.click()`);
  await sleep(300);
  check('game started (overlay hidden)', (await evaluate(ws, `document.querySelector('.overlay-screen').classList.contains('hidden')`)) === true);

  // Hold fire + move for ~30s of real time to drive the full simulation:
  // invader fire, player hits, shield erosion, UFO, possibly wave clear.
  await evaluate(ws, `(() => {
    const down = (code) => window.dispatchEvent(new KeyboardEvent('keydown', { code }));
    down('KeyD'); down('Space');
    return true;
  })()`);

  // Sample lives/score over time to confirm the sim is actually advancing.
  const samples = [];
  for (let i = 0; i < 10; i++) {
    await sleep(3000);
    const s = await evaluate(ws, `(() => {
      const score = parseInt(document.querySelector('#hud-score')?.textContent || '0', 10);
      const wave = parseInt(document.querySelector('#hud-wave')?.textContent || '1', 10);
      const lives = document.querySelectorAll('#hud-lives .life-icon').length;
      return { score, wave, lives };
    })()`);
    samples.push(s);
  }
  await evaluate(ws, `(() => {
    const up = (code) => window.dispatchEvent(new KeyboardEvent('keyup', { code }));
    up('KeyD'); up('Space');
    return true;
  })()`);

  const first = samples[0], last = samples[samples.length - 1];
  console.log('  samples: ' + JSON.stringify(samples));
  check('score advanced during play', last.score > first.score || last.score > 0, `first=${first.score} last=${last.score}`);
  check('lives within [0,3]', last.lives >= 0 && last.lives <= 3, 'lives=' + last.lives);
  check('wave is a positive integer', Number.isInteger(last.wave) && last.wave >= 1, 'wave=' + last.wave);
  check('no console errors during play', consoleErrors.length === 0, consoleErrors.slice(0, 3).join(' | '));
  check('no page errors during play', pageErrors.length === 0, pageErrors.slice(0, 3).join(' | '));

  // ── Teardown: the strict-memory-management requirement ──────────────
  const disposeResult = await evaluate(ws, `(() => {
    if (typeof window.__spaceInvadersDispose !== 'function') return { exposed: false };
    try {
      window.__spaceInvadersDispose();
      return { exposed: true, ok: true };
    } catch (e) {
      return { exposed: true, ok: false, err: String(e) };
    }
  })()`);
  check('dispose() is exposed', disposeResult.exposed === true);
  check('dispose() runs clean', disposeResult.ok === true, disposeResult.err || '');

  // After dispose, the HUD should be gone from the DOM.
  await sleep(200);
  const hudGone = await evaluate(ws, `document.querySelector('.glass-hud') === null`);
  check('HUD removed after dispose', hudGone === true);

  ws.close();
} catch (e) {
  failed = true;
  console.log('  FAIL  harness: ' + e.message);
}

console.log(failed ? '\nEXTENDED: FAILED' : '\nEXTENDED: PASSED');
process.exit(failed ? 1 : 0);
