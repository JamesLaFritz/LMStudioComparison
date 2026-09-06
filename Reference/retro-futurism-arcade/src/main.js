import './shared/ui/glass.css';
import './hub/hub.css';

import { ArcadeShell } from './hub/ArcadeShell.js';
import { HubScene } from './hub/HubScene.js';
import { CABINETS, getCabinet, defaultCabinetId } from './hub/GameRegistry.js';

/**
 * Arcade bootstrap.
 *
 * Owns the cabinet-select experience and hands control to `ArcadeShell` once a
 * title is launched. Three responsibilities and nothing else:
 *
 *  1. Build and drive the hub UI and its attract-mode scene.
 *  2. Route between the hub and a mounted game, including the URL hash so a
 *     cabinet can be linked to directly.
 *  3. Present failures. A game that fails to load must say so on screen —
 *     a menu button that silently does nothing is the worst possible outcome.
 *
 * The attract scene is driven from here rather than from `ArcadeShell`'s loop
 * because that loop is a fixed-timestep *simulation* driver that only exists
 * while a game is mounted. The hub has no simulation, so it gets a plain
 * animation frame and the two lifecycles stay independent.
 */

const viewport = document.getElementById('viewport');
const overlayRoot = document.getElementById('overlay-root');

if (!viewport || !overlayRoot) {
  throw new Error('Arcade bootstrap: #viewport or #overlay-root is missing from the document.');
}

/* ================================================================== *
 * Boot screen
 * ================================================================== */

const bootScreen = document.createElement('div');
bootScreen.className = 'boot-screen';
bootScreen.innerHTML = `
  <div class="boot-inner">
    <div class="boot-label neon">INITIALISING RENDER PIPELINE</div>
    <div class="boot-bar"><div class="boot-bar__fill"></div></div>
  </div>
`;
overlayRoot.appendChild(bootScreen);

const bootFill = bootScreen.querySelector('.boot-bar__fill');
const bootLabel = bootScreen.querySelector('.boot-label');

function setBootProgress(fraction, label) {
  if (bootFill) bootFill.style.transform = `scaleX(${Math.max(0, Math.min(1, fraction))})`;
  if (label && bootLabel) bootLabel.textContent = label;
}

function hideBootScreen() {
  bootScreen.classList.add('boot-screen--hidden');
  // Remove from hit-testing after the fade rather than immediately, so the
  // transition is visible but the element cannot swallow the first click.
  window.setTimeout(() => {
    if (bootScreen.parentNode) bootScreen.parentNode.removeChild(bootScreen);
  }, 600);
}

/* ================================================================== *
 * Fatal error presentation
 * ================================================================== */

function showFatal(title, detail) {
  const el = document.createElement('div');
  el.className = 'fatal';
  const h = document.createElement('div');
  h.className = 'fatal__title';
  h.textContent = title;
  const b = document.createElement('div');
  b.className = 'fatal__body';
  b.textContent = detail;
  el.append(h, b);
  overlayRoot.appendChild(el);
  return el;
}

/* ================================================================== *
 * Shell + attract scene
 * ================================================================== */

let shell;
let hubScene;

try {
  setBootProgress(0.25, 'CREATING WEBGL CONTEXT');
  shell = new ArcadeShell({ viewport, overlay: overlayRoot });
} catch (err) {
  console.error(err);
  hideBootScreen();
  showFatal(
    'WEBGL UNAVAILABLE',
    'This arcade requires WebGL 2. Check that hardware acceleration is enabled in your browser settings.'
  );
  throw err;
}

setBootProgress(0.55, 'SYNTHESISING PROCEDURAL ASSETS');

try {
  hubScene = new HubScene(shell.renderer, { reducedMotion: shell.reducedMotion });
  hubScene.setSize(shell.width, shell.height);
} catch (err) {
  console.error('Hub scene failed to build:', err);
  hubScene = null;
}

/* ================================================================== *
 * Hub UI
 * ================================================================== */

const hubLayer = document.createElement('div');
hubLayer.className = 'hub-layer';
hubLayer.innerHTML = `
  <header class="hub-header">
    <h1 class="hub-title neon">RETRO&#8203;-FUTURISM ARCADE</h1>
    <p class="hub-tagline">Fourteen classics, rebuilt in code. No assets were harmed.</p>
  </header>
  <div class="hub-rail-wrap"><div class="hub-rail" role="listbox" aria-label="Cabinet select"></div></div>
  <footer class="hub-footer">
    <div class="hub-prompt"></div>
  </footer>
`;
overlayRoot.appendChild(hubLayer);

const rail = hubLayer.querySelector('.hub-rail');
const hubPrompt = hubLayer.querySelector('.hub-prompt');

/** @type {HTMLElement[]} */
const cards = [];
let selectedIndex = 0;
let hubVisible = false;
let launching = false;

CABINETS.forEach((cabinet, index) => {
  const card = document.createElement('button');
  card.type = 'button';
  card.className = `cabinet glass${cabinet.available ? '' : ' cabinet--locked'}`;
  card.setAttribute('role', 'option');
  card.dataset.id = cabinet.id;
  card.disabled = !cabinet.available;

  const stars = '★'.repeat(cabinet.stars) + '☆'.repeat(Math.max(0, 6 - cabinet.stars));

  card.innerHTML = `
    <span class="cabinet__index">${String(index + 1).padStart(2, '0')}</span>
    <span class="cabinet__title ${cabinet.accent}"></span>
    <span class="cabinet__subtitle"></span>
    <span class="cabinet__stars">${stars}</span>
    <span class="cabinet__status ${
      cabinet.available ? 'cabinet__status--playable' : 'cabinet__status--scheduled'
    }">${cabinet.available ? 'PLAYABLE' : 'SCHEDULED'}</span>
  `;

  // Title and subtitle are set as text rather than interpolated into the
  // markup above; they are data, and data does not belong in an HTML string.
  card.querySelector('.cabinet__title').textContent = cabinet.title;
  card.querySelector('.cabinet__subtitle').textContent = cabinet.blurb;

  card.addEventListener('click', () => {
    selectIndex(index);
    if (cabinet.available) launch(cabinet.id);
  });
  card.addEventListener('mouseenter', () => selectIndex(index, false));

  rail.appendChild(card);
  cards.push(card);
});

function selectIndex(index, playSound = true) {
  const clamped = ((index % cards.length) + cards.length) % cards.length;
  if (clamped === selectedIndex && cards[clamped].classList.contains('cabinet--selected')) {
    return;
  }

  cards[selectedIndex]?.classList.remove('cabinet--selected');
  selectedIndex = clamped;
  const card = cards[selectedIndex];
  card.classList.add('cabinet--selected');

  // `nearest` rather than `center`: centring re-scrolls the rail on every
  // keypress even when the target is already fully visible, which reads as the
  // list twitching under the cursor.
  card.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });

  updatePrompt();
  if (playSound) shell.sfx.play('uiMove');
}

function updatePrompt() {
  const cabinet = CABINETS[selectedIndex];
  if (!cabinet.available) {
    hubPrompt.innerHTML = `<span>${cabinet.title} is scheduled for a later build.</span>`;
    return;
  }
  const confirmKey = shell.input.activeDevice === 'gamepad' ? 'A' : 'ENTER';
  hubPrompt.innerHTML =
    `<kbd>${confirmKey}</kbd> launch &nbsp;·&nbsp; <kbd>←</kbd><kbd>→</kbd> select` +
    ` &nbsp;·&nbsp; <kbd>F3</kbd> diagnostics`;
}

/* ================================================================== *
 * Hub visibility
 * ================================================================== */

function showHub() {
  if (hubVisible) return;
  hubVisible = true;

  hubLayer.classList.add('hub-layer--visible');
  hubLayer.setAttribute('aria-hidden', 'false');

  if (window.location.hash) {
    // Replace rather than push: backing out of a game should not require two
    // presses of the browser back button.
    window.history.replaceState(null, '', window.location.pathname);
  }

  startAttract();
  updatePrompt();
  cards[selectedIndex]?.focus({ preventScroll: true });
}

function hideHub() {
  if (!hubVisible) return;
  hubVisible = false;
  hubLayer.classList.remove('hub-layer--visible');
  hubLayer.setAttribute('aria-hidden', 'true');
  stopAttract();
}

/* ================================================================== *
 * Attract loop
 * ================================================================== */

let attractRaf = 0;
let attractLast = 0;

function attractFrame(now) {
  if (!hubVisible || !hubScene) return;
  attractRaf = requestAnimationFrame(attractFrame);

  // Clamped so a backgrounded tab does not resume with one enormous step that
  // spins the attract scene through several seconds of animation instantly.
  const dt = Math.min((now - attractLast) * 0.001, 0.05);
  attractLast = now;

  hubScene.update(dt);
  hubScene.render();

  pollHubInput();
}

function startAttract() {
  if (!hubScene || attractRaf) return;
  attractLast = performance.now();
  attractRaf = requestAnimationFrame(attractFrame);
}

function stopAttract() {
  if (attractRaf) cancelAnimationFrame(attractRaf);
  attractRaf = 0;
}

/* ================================================================== *
 * Hub input
 *
 * The shell's InputManager is not polled while no game is mounted, so the hub
 * polls it itself. Keyboard navigation is handled by native DOM focus and the
 * keydown listener below; this path exists so a player who launched the arcade
 * with a controller never has to reach for the keyboard.
 * ================================================================== */

let padNavCooldown = 0;
let padConfirmHeld = false;
let padBackHeld = false;

function pollHubInput() {
  const pad = shell.input.gamepad;
  if (!pad) return;
  pad.poll();
  if (!pad.connected) return;

  const now = performance.now();
  const axis = pad.axis(0);
  const right = pad.isDown(15) || axis > 0.5;
  const left = pad.isDown(14) || axis < -0.5;
  const down = pad.isDown(13);
  const up = pad.isDown(12);

  const dir = right || down ? 1 : left || up ? -1 : 0;

  if (dir !== 0 && now > padNavCooldown) {
    padNavCooldown = now + 200;
    shell.input.activeDevice = 'gamepad';
    selectIndex(selectedIndex + dir);
  } else if (dir === 0) {
    padNavCooldown = 0;
  }

  const confirm = pad.isDown(0) || pad.isDown(9);
  if (confirm && !padConfirmHeld) {
    padConfirmHeld = true;
    const cabinet = CABINETS[selectedIndex];
    if (cabinet.available) launch(cabinet.id);
  } else if (!confirm) {
    padConfirmHeld = false;
  }

  const back = pad.isDown(1);
  if (back && !padBackHeld) {
    padBackHeld = true;
  } else if (!back) {
    padBackHeld = false;
  }
}

document.addEventListener('keydown', (event) => {
  if (!hubVisible) return;
  if (event.ctrlKey || event.metaKey || event.altKey) return;

  switch (event.code) {
    case 'ArrowRight':
    case 'ArrowDown':
    case 'KeyD':
    case 'KeyS':
      event.preventDefault();
      selectIndex(selectedIndex + 1);
      break;
    case 'ArrowLeft':
    case 'ArrowUp':
    case 'KeyA':
    case 'KeyW':
      event.preventDefault();
      selectIndex(selectedIndex - 1);
      break;
    case 'Home':
      event.preventDefault();
      selectIndex(0);
      break;
    case 'End':
      event.preventDefault();
      selectIndex(cards.length - 1);
      break;
    case 'Enter':
    case 'NumpadEnter':
    case 'Space': {
      event.preventDefault();
      const cabinet = CABINETS[selectedIndex];
      if (cabinet.available) launch(cabinet.id);
      else shell.sfx.play('uiBack');
      break;
    }
    default:
      break;
  }
});

/* ================================================================== *
 * Launching
 * ================================================================== */

async function launch(id) {
  if (launching) return;
  const cabinet = getCabinet(id);
  if (!cabinet || !cabinet.available) return;

  launching = true;
  shell.sfx.play('uiConfirm');

  // Audio must be unlocked from inside a user gesture. Launching is always the
  // result of one, so this is the correct and only reliable place to do it.
  shell.audio.init();

  hideHub();
  window.history.replaceState(null, '', `#${id}`);

  try {
    await shell.mount(id);
  } catch (err) {
    console.error(err);
    showHub();
    const panel = showFatal(
      'CABINET FAILED TO START',
      `${cabinet.title} could not be loaded. ${err && err.message ? err.message : ''}`
    );
    window.setTimeout(() => panel.remove(), 6000);
  } finally {
    launching = false;
  }
}

/* ================================================================== *
 * Shell events
 * ================================================================== */

shell.events.on('hub:show', () => {
  showHub();
});

shell.events.on('game:unmounted', ({ id, leak, delta }) => {
  if (leak) {
    console.warn(`[${id}] unmounted with GPU resource drift:`, delta);
  }
});

shell.events.on('context:lost', () => {
  showFatal(
    'GRAPHICS CONTEXT LOST',
    'Reinitialising the renderer. The game will resume automatically.'
  ).classList.add('fatal--transient');
});

shell.events.on('context:restored', () => {
  document.querySelectorAll('.fatal--transient').forEach((el) => el.remove());
});

/* ================================================================== *
 * Resize
 * ================================================================== */

window.addEventListener('resize', () => {
  if (hubScene) hubScene.setSize(shell.width, shell.height);
});

if (typeof ResizeObserver !== 'undefined') {
  const observer = new ResizeObserver(() => {
    if (hubScene) hubScene.setSize(shell.width, shell.height);
  });
  observer.observe(viewport);
}

window.addEventListener('beforeunload', () => {
  stopAttract();
  if (hubScene) hubScene.dispose();
  shell.dispose();
});

/* ================================================================== *
 * Go
 * ================================================================== */

setBootProgress(1, 'READY');

const hashId = window.location.hash.replace(/^#/, '');
const initialIndex = CABINETS.findIndex((c) => c.id === hashId);
selectIndex(initialIndex >= 0 ? initialIndex : CABINETS.findIndex((c) => c.id === defaultCabinetId()), false);

window.setTimeout(() => {
  hideBootScreen();

  const target = getCabinet(hashId);
  if (target && target.available) {
    // Deep link. Audio stays locked until the first real gesture, which is
    // correct — the browser would refuse to start it here anyway.
    hideHub();
    launch(hashId);
  } else {
    showHub();
  }
}, 260);

/**
 * External hash navigation.
 *
 * Both `launch()` and `showHub()` write the hash with `replaceState`, which
 * does **not** fire `hashchange`. So this listener only ever runs for
 * navigation the app did not perform itself: the browser's back and forward
 * buttons, a hand-edited URL, or an automation harness deep-linking into a
 * cabinet. That is what makes it safe to act on directly — there is no
 * re-entrancy from the app's own writes to guard against, only its idea of
 * what is currently mounted.
 *
 * Without this the hash is written but never read again after boot: a deep
 * link works on a cold load and silently does nothing on a warm one, which
 * looks exactly like a dead menu.
 */
window.addEventListener('hashchange', () => {
  if (launching) return;

  const id = window.location.hash.replace(/^#/, '');
  const target = getCabinet(id);

  if (target && target.available) {
    if (shell.activeId === id) return;
    const index = CABINETS.findIndex((c) => c.id === id);
    if (index >= 0) selectIndex(index, false);
    launch(id);
    return;
  }

  // An empty or unknown hash means "go back to the cabinet select". Only act
  // if something is actually mounted, so a stray hash edit on the hub is inert.
  if (shell.activeId) {
    shell.unmount();
    showHub();
  }
});

// Exposed for the QA pass: `__arcade.loseContext()` exercises the recovery
// path, and `__arcade.shell` allows inspecting live budgets from the console.
window.__arcade = Object.assign(window.__arcade || {}, {
  showHub,
  launch,
  cabinets: CABINETS
});
