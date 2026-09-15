// tools/smoke.mjs — headless runtime smoke test for Space_Invaders.
// Connects to an ALREADY-RUNNING Chromium CDP endpoint (launched by the shell,
// which is the only way chrome reliably binds its debug port on this box).
// Loads the game, clicks Start, simulates gameplay, and reports:
//   - console errors / pageerror (the real signal)
//   - a few gameplay invariants (score, wave, HUD, WebGL)
//
// Usage: node tools/smoke.mjs [wsUrl] [pageUrl]
//   default wsUrl   = ws://127.0.0.1:9333/devtools/browser/<id>  (resolved via /json/version)
//   default pageUrl = http://localhost:4173/Space_Invaders/

const CDP_HOST = '127.0.0.1';
const CDP_PORT = process.env.CDP_PORT || 9333;
const PAGE_URL = process.argv[3] || 'http://localhost:4173/Space_Invaders/';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getWsUrl() {
  // Connect to the PAGE target (not the browser endpoint) — only the page
  // target supports Runtime.* / Page.* domain commands.
  for (let i = 0; i < 40; i++) {
    try {
      const res = await fetch(`http://${CDP_HOST}:${CDP_PORT}/json/list`);
      const list = await res.json();
      const page = list.find((t) => t.type === 'page');
      if (page && page.webSocketDebuggerUrl) return page.webSocketDebuggerUrl;
    } catch {}
    await sleep(250);
  }
  throw new Error('CDP page target never came up');
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

async function evaluate(ws, expression, awaitPromise = false) {
  const r = await send(ws, 'Runtime.evaluate', {
    expression,
    awaitPromise,
    returnByValue: true,
    allowUnsafeEvalBlockedByCSP: true,
  });
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
  const wsUrl = await getWsUrl();
  const ws = await connect(wsUrl);

  await send(ws, 'Runtime.enable');
  await send(ws, 'Page.enable');

  // Navigate.
  await send(ws, 'Page.navigate', { url: PAGE_URL });
  await sleep(2500); // let the module graph + first frames settle

  // WebGL actually working?
  const gl = await evaluate(ws, `(() => {
    const c = document.getElementById('game');
    if (!c) return { canvas:false };
    const gl2 = c.getContext('webgl2') || c.getContext('webgl');
    return { canvas:true, webgl: !!gl2, renderer: gl2 ? gl2.getParameter(gl2.RENDERER) : null };
  })()`);
  check('canvas present', gl.canvas);
  check('WebGL context live', gl.webgl, gl.renderer || '');

  // Game booted (composition root ran, HUD + engine exist).
  const booted = await evaluate(ws, `(() => {
    const hud = document.querySelector('.glass-hud');
    const overlay = document.querySelector('.overlay-screen');
    return { hud: !!hud, overlay: !!overlay, overlayHidden: overlay ? overlay.classList.contains('hidden') : null };
  })()`);
  check('HUD mounted', booted.hud);
  check('start overlay visible', booted.overlay && booted.overlayHidden === false);

  // Click Start to enter the playing state.
  await evaluate(ws, `document.querySelector('#hud-overlay-btn')?.click()`);
  await sleep(200);
  const started = await evaluate(ws, `(() => {
    const overlay = document.querySelector('.overlay-screen');
    return { overlayHidden: overlay ? overlay.classList.contains('hidden') : null };
  })()`);
  check('game started (overlay hidden)', started.overlayHidden === true);

  // Let the simulation run for a few seconds of real time.
  await sleep(4000);

  // Hold the fire key so the player shoots, and move, to exercise the
  // bullet + collision + scoring paths.
  await evaluate(ws, `(() => {
    const down = (code) => window.dispatchEvent(new KeyboardEvent('keydown', { code }));
    down('KeyD'); down('Space');
    return true;
  })()`);
  await sleep(2500);
  await evaluate(ws, `(() => {
    const up = (code) => window.dispatchEvent(new KeyboardEvent('keyup', { code }));
    up('KeyD'); up('Space');
    return true;
  })()`);

  // Inspect live game state via the HUD (no private access needed).
  const state = await evaluate(ws, `(() => {
    const score = document.querySelector('#hud-score')?.textContent;
    const wave = document.querySelector('#hud-wave')?.textContent;
    return { score: score ? parseInt(score,10) : 0, wave: wave ? parseInt(wave,10) : 0 };
  })()`);
  check('score is a finite number', Number.isFinite(state.score), 'score=' + state.score);
  check('wave is a finite number', Number.isFinite(state.wave), 'wave=' + state.wave);

  // The real signal: no console errors, no page errors.
  check('no console errors', consoleErrors.length === 0, consoleErrors.slice(0, 3).join(' | '));
  check('no page errors', pageErrors.length === 0, pageErrors.slice(0, 3).join(' | '));

  ws.close();
} catch (e) {
  failed = true;
  console.log('  FAIL  harness: ' + e.message);
}

console.log(failed ? '\nSMOKE: FAILED' : '\nSMOKE: PASSED');
process.exit(failed ? 1 : 0);
