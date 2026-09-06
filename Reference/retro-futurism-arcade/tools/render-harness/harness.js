import { createRenderer } from '@shared/render/RendererFactory.js';
import { SpaceInvadersRenderer } from '@game/Space_Invaders/render/SpaceInvadersRenderer.js';
import {
  createSimState,
  resetRun,
  indexOf,
  invaderX,
  invaderY
} from '@game/Space_Invaders/simulation/SimState.js';
import {
  FORMATION,
  BOMB,
  BOMB_TYPES,
  BOLT,
  ARENA,
  BUNKER,
  UFO
} from '@game/Space_Invaders/config.js';
import { worldToGrid } from '@game/Space_Invaders/content/BunkerMask.js';

/**
 * A deterministic driver for the **render layer only**.
 *
 * ### What this is, and what it is not
 *
 * The game's entry point (`src/games/Space_Invaders/index.js`) and its
 * simulation step are being written separately. This harness exists so that
 * the visual layer can be built, looked at and *measured* against the visual
 * target without waiting on either — it constructs a real `SimState` through
 * the real `createSimState` / `resetRun`, then advances it with a small
 * scripted animator that moves the formation, fires, drops bombs, carves
 * bunkers and runs the mystery ship.
 *
 * That animator is **not game logic and must never become game logic.** It has
 * no collision, no rules, no scoring and no input; it is a puppeteer, and its
 * only job is to put the state into visually interesting configurations on a
 * fixed schedule so that two captures of the same nominal time are
 * pixel-comparable. The real simulation replaces it wholesale.
 *
 * ### Determinism
 *
 * Nothing here reads the wall clock. `seek(t)` resets the state and replays a
 * fixed number of fixed-size steps, so frame captures are reproducible across
 * machines and across runs — which is what makes a measured metric a
 * regression test rather than an anecdote.
 *
 * ### Driving it from a browser automation session
 *
 *   await page.waitForFunction(() => window.__harness && window.__harness.ready)
 *   await page.evaluate(() => window.__harness.seek(12.5))
 *   await page.screenshot({ path: 'frame.png' })
 */

/** Simulation step size. Matches the intended fixed-step rate of the game. */
const STEP = 1 / 120;

/** Scripted scenarios, selected with `?scene=`. */
const SCENES = {
  /** A quiet frame: full formation, nothing in flight. The tonal floor. */
  quiet: { kills: 0, bolts: false, bombs: false, ufo: false, carve: 0 },
  /** Ordinary play: a thinned formation, a bolt up, bombs falling. */
  play: { kills: 14, bolts: true, bombs: true, ufo: false, carve: 26 },
  /** Busy: heavily thinned, maximum bombs, mystery ship on screen. */
  busy: { kills: 31, bolts: true, bombs: true, ufo: true, carve: 70 },
  /** The staggered warp-in, held part-way through. */
  warp: { kills: 0, bolts: false, bombs: false, ufo: false, carve: 0, warp: true }
};

const params = new URLSearchParams(window.location.search);
const sceneName = params.get('scene') || 'play';
const scene = SCENES[sceneName] || SCENES.play;

/** Keeps the cannon off the arena walls, matching `PLAYER.MARGIN`. */
const PLAYER_MARGIN = 1.4;
/** March step the last scripted bomb was launched on. */
let lastBombStep = -1;

const viewport = document.getElementById('viewport');
const fatal = document.getElementById('fatal');

/** Report a construction failure on screen instead of only in the console. */
function die(err) {
  fatal.style.display = 'block';
  fatal.textContent = `render harness failed\n\n${err && err.stack ? err.stack : err}`;
  console.error(err);
}

let renderer = null;
let visuals = null;
let state = null;

/**
 * Keep Vite's HMR error overlay out of the frame.
 *
 * The dev server reports *project-wide* transform failures into whatever page
 * is open, and this project has a standing one: `GameRegistry.js` lazy-loads
 * `games/Space_Invaders/index.js`, which is the game entry point and is being
 * written separately. That overlay is a full-width panel of red and orange
 * monospace text, and it silently landed on top of a capture — turning a
 * measurement of the game into a measurement of an error message, with a
 * dominant hue of 0 degrees and 96% of the frame reported as dark.
 *
 * It is removed rather than disabled through config, because `vite.config.js`
 * is shared with the hub and every other cabinet and a capture tool has no
 * business changing how the dev server behaves for everyone else. Errors still
 * reach the console, where the capture script is already recording them.
 */
function suppressViteOverlay() {
  const strip = () => {
    for (const node of document.querySelectorAll('vite-error-overlay')) node.remove();
  };
  strip();
  new MutationObserver(strip).observe(document.body, { childList: true });
}

/* ================================================================== *
 * The scripted animator
 * ================================================================== */

/**
 * Small deterministic hash, so "which invaders are dead" and "where are the
 * bunkers carved" are functions of the scenario rather than of a random seed
 * that would drift between captures.
 */
function hash(n) {
  let x = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b);
  x ^= x >>> 13;
  x = Math.imul(x, 0xc2b2ae35);
  x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}

/** Apply the scenario's static configuration to a freshly reset state. */
function applyScene(target) {
  const formation = target.formation;

  // --- Kills, spread across the lattice ---------------------------------
  // Taken from the top row down and from the edges in, which is roughly the
  // shape a real board takes: the player clears columns from the outside.
  let killed = 0;
  for (let pass = 0; pass < 3 && killed < scene.kills; pass++) {
    for (let index = 0; index < FORMATION.COUNT && killed < scene.kills; index++) {
      if (!formation.alive[index]) continue;
      if (hash(index * 7 + pass * 131) > 0.55) continue;
      formation.alive[index] = 0;
      killed++;
    }
  }
  formation.aliveCount = FORMATION.COUNT - killed;

  // Rebuild the derived lattice bookkeeping the render layer reads.
  for (let col = 0; col < FORMATION.COLS; col++) {
    let bottom = -1;
    for (let row = FORMATION.ROWS - 1; row >= 0; row--) {
      if (formation.alive[indexOf(col, row)]) {
        bottom = row;
        break;
      }
    }
    formation.bottomOfColumn[col] = bottom;
  }

  // The march accelerates as the formation thins: one invader per 60Hz frame,
  // exactly as the 1978 hardware did it.
  formation.stepPeriod = Math.max(
    FORMATION.MIN_STEP_PERIOD,
    Math.min(FORMATION.MAX_STEP_PERIOD, formation.aliveCount * FORMATION.FRAME_BUDGET)
  );

  formation.warping = !!scene.warp;
  formation.warpT = scene.warp ? 0.55 : 1;

  // --- Bunker erosion ----------------------------------------------------
  for (let c = 0; c < scene.carve; c++) {
    const bunker = target.bunkers[c % target.bunkers.length];
    const u = hash(c * 17 + 3);
    const v = hash(c * 29 + 11);
    const worldX = bunker.x + (u - 0.5) * BUNKER.COLS * BUNKER.CELL;
    const worldY = BUNKER.Y + (v * 0.5 + 0.35) * BUNKER.ROWS * BUNKER.CELL - 0.5;
    const { gx, gy } = worldToGrid(worldX, worldY, bunker.x);
    carve(bunker, gx, gy, BUNKER.RADIUS_BOMB);
  }
}

/** Knock a disc of cells out of one bunker's occupancy grid. */
function carve(bunker, gx, gy, radius) {
  const r2 = radius * radius;
  const minX = Math.max(0, Math.floor(gx - radius));
  const maxX = Math.min(BUNKER.COLS - 1, Math.ceil(gx + radius));
  const minY = Math.max(0, Math.floor(gy - radius));
  const maxY = Math.min(BUNKER.ROWS - 1, Math.ceil(gy + radius));

  for (let cy = minY; cy <= maxY; cy++) {
    for (let cx = minX; cx <= maxX; cx++) {
      const dx = cx - gx;
      const dy = cy - gy;
      if (dx * dx + dy * dy > r2) continue;
      const i = cy * BUNKER.COLS + cx;
      if (bunker.grid[i]) {
        bunker.grid[i] = 0;
        bunker.cells--;
        bunker.dirty = true;
      }
    }
  }
}

/**
 * Advance the scripted state by one fixed step.
 *
 * Deliberately crude. Every branch here is presentation scaffolding, and the
 * only property that matters is that it is a pure function of the step count.
 */
function step(dt) {
  const formation = state.formation;
  state.elapsed += dt;
  state.waveElapsed += dt;

  // --- Warp-in -----------------------------------------------------------
  if (formation.warping && !scene.warp) {
    const total = FORMATION.WARP_DURATION + FORMATION.COUNT * FORMATION.WARP_STAGGER;
    formation.warpT += dt / total;
    if (formation.warpT >= 1) {
      formation.warpT = 1;
      formation.warping = false;
    }
  }

  // --- March -------------------------------------------------------------
  formation.marchAccum += dt;
  while (formation.marchAccum >= formation.stepPeriod) {
    formation.marchAccum -= formation.stepPeriod;
    formation.stepIndex++;
    formation.animFrame = formation.animFrame ? 0 : 1;

    const leftEdge = invaderX(formation, formation.minCol);
    const rightEdge = invaderX(formation, formation.maxCol);
    const margin = ARENA.HALF_WIDTH - 1.6;
    if (
      (formation.direction > 0 && rightEdge + FORMATION.STEP_X > margin) ||
      (formation.direction < 0 && leftEdge - FORMATION.STEP_X < -margin)
    ) {
      formation.direction *= -1;
      formation.originY -= FORMATION.DROP_Y;
    } else {
      formation.originX += FORMATION.STEP_X * formation.direction;
    }
  }

  // --- Player ------------------------------------------------------------
  // The respawn grace period has to be counted down here. `resetForWave` opens
  // every wave with half a period of invulnerability, and the renderer blinks
  // the cannon while it is running — so a scripted driver that never decrements
  // it leaves the ship blinking forever, and roughly half of all captures come
  // out with no player in them at all. Which is exactly what happened.
  if (state.player.invulnTimer > 0) state.player.invulnTimer = Math.max(0, state.player.invulnTimer - dt);
  if (state.player.deathTimer > 0) state.player.deathTimer = Math.max(0, state.player.deathTimer - dt);

  // A slow sweep, so the parallax, the roll and the thruster all get exercised.
  const sweep = Math.sin(state.elapsed * 0.55);
  const previousX = state.player.x;
  state.player.x = sweep * (ARENA.HALF_WIDTH - PLAYER_MARGIN);
  state.player.vx = (state.player.x - previousX) / dt;
  state.player.roll = -Math.max(-1, Math.min(1, state.player.vx / 13.5)) * 0.34;

  // --- Bolts -------------------------------------------------------------
  if (scene.bolts) {
    const bolts = state.bolts;
    let anyActive = false;
    for (let i = 0; i < bolts.capacity; i++) {
      if (!bolts.active[i]) continue;
      anyActive = true;
      bolts.prevX[i] = bolts.x[i];
      bolts.prevY[i] = bolts.y[i];
      bolts.y[i] += BOLT.SPEED * dt;
      bolts.life[i] += dt;
      if (bolts.y[i] > BOLT.TOP_Y) {
        bolts.active[i] = 0;
        bolts.count--;
      }
    }
    // One shot in flight at a time — the original's rule, and the thing that
    // makes every shot a commitment.
    if (!anyActive && Math.sin(state.elapsed * 2.1) > 0.6) {
      bolts.active[0] = 1;
      bolts.x[0] = state.player.x;
      bolts.y[0] = ARENA.PLAYER_Y + 0.5;
      bolts.prevX[0] = bolts.x[0];
      bolts.prevY[0] = bolts.y[0];
      bolts.life[0] = 0;
      bolts.count = 1;
      state.shotCount++;
    }
  }

  // --- Bombs -------------------------------------------------------------
  if (scene.bombs) {
    const bombs = state.bombs;
    for (let i = 0; i < bombs.capacity; i++) {
      if (!bombs.active[i]) continue;
      bombs.prevX[i] = bombs.x[i];
      bombs.prevY[i] = bombs.y[i];
      bombs.age[i] += dt;
      bombs.y[i] -= bombs.speed[i] * dt;

      const archetype = BOMB_TYPES[bombs.type[i]];
      if (archetype.amplitude > 0) {
        bombs.x[i] =
          bombs.originX[i] + Math.sin(bombs.age[i] * archetype.frequency) * archetype.amplitude;
      } else if (archetype.homing > 0) {
        const toPlayer = state.player.x - bombs.x[i];
        bombs.x[i] += Math.max(-1, Math.min(1, toPlayer)) * archetype.homing * dt;
      }

      if (bombs.y[i] < BOMB.FLOOR_Y) {
        bombs.active[i] = 0;
        bombs.count--;
      }
    }

    // Launch from the bottom of a living column, on the march step, exactly
    // where the real rule would put it.
    if (bombs.count < BOMB.MAX && formation.stepIndex !== lastBombStep) {
      lastBombStep = formation.stepIndex;
      if (hash(formation.stepIndex * 53) < 0.34) {
        const col = Math.floor(hash(formation.stepIndex * 97) * FORMATION.COLS);
        const row = formation.bottomOfColumn[col];
        if (row >= 0) {
          for (let i = 0; i < bombs.capacity; i++) {
            if (bombs.active[i]) continue;
            const type = Math.floor(hash(formation.stepIndex * 211) * BOMB_TYPES.length);
            bombs.active[i] = 1;
            bombs.type[i] = type;
            bombs.speed[i] = BOMB_TYPES[type].speed;
            bombs.x[i] = invaderX(formation, col);
            bombs.y[i] = invaderY(formation, row) - 0.4;
            bombs.originX[i] = bombs.x[i];
            bombs.prevX[i] = bombs.x[i];
            bombs.prevY[i] = bombs.y[i];
            bombs.age[i] = 0;
            bombs.count++;
            break;
          }
        }
      }
    }
  }

  // --- Mystery ship ------------------------------------------------------
  if (scene.ufo) {
    const ufo = state.ufo;
    if (!ufo.active) {
      ufo.timer -= dt;
      if (ufo.timer <= 0) {
        ufo.active = true;
        ufo.direction = ufo.direction > 0 ? -1 : 1;
        ufo.x = -ufo.direction * (ARENA.HALF_WIDTH + 1);
        ufo.beamPhase = 0;
      }
    } else {
      ufo.x += UFO.SPEED * ufo.direction * dt;
      ufo.beamPhase += dt * 2.4;
      if (Math.abs(ufo.x) > ARENA.HALF_WIDTH + 1.2) {
        ufo.active = false;
        ufo.timer = UFO.INTERVAL;
      }
    }
  }
}

/* ================================================================== *
 * Boot
 * ================================================================== */

function boot() {
  suppressViteOverlay();
  renderer = createRenderer(viewport, { antialias: false, exposure: 1.06 });

  state = createSimState();
  resetRun(state, 0);
  applyScene(state);

  visuals = new SpaceInvadersRenderer({
    renderer,
    width: window.innerWidth,
    height: window.innerHeight,
    boltCapacity: state.bolts.capacity
  });

  const resize = () => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setSize(w, h, false);
    visuals.setSize(w, h);
  };
  window.addEventListener('resize', resize);
  resize();

  /**
   * Reset and replay to an absolute time. This is what makes a capture
   * reproducible: the same `t` always produces the same pixels.
   */
  const seek = (seconds) => {
    state = createSimState();
    resetRun(state, 0);
    applyScene(state);
    lastBombStep = -1;

    const steps = Math.max(0, Math.round(seconds / STEP));
    for (let i = 0; i < steps; i++) step(STEP);

    // The render layer accumulates its own time for bobs and sweeps, so it has
    // to be advanced by the same amount or a seek would show a formation in
    // the right place with the wrong idle phase.
    visuals.time = 0;
    visuals.arena.time = 0;
    visuals.stars.time = 0;
    visuals.invaders.time = 0;
    visuals.player.time = 0;
    visuals.projectiles.time = 0;
    visuals.ufo.time = 0;
    visuals.arena.sweepY = ARENA.FLOOR_Y;
    visuals._lastStepIndex = -1;
    visuals._tension = 0;

    // Two update passes so the first-frame teleport of the camera rig settles
    // and the bunker rebuild has run before anything is measured.
    visuals.update(seconds, state);
    visuals.update(1 / 60, state);
    visuals.render();
  };

  let running = true;
  let last = performance.now();
  const frame = (now) => {
    if (!running) return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    let remaining = dt;
    while (remaining > 0) {
      const slice = Math.min(STEP, remaining);
      step(slice);
      remaining -= slice;
    }
    visuals.update(dt, state);
    visuals.render();
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);

  window.__harness = {
    ready: true,
    scene: sceneName,
    // A getter, not a snapshot: `seek` rebuilds the state object from scratch,
    // so a captured reference would go stale on the first seek and every
    // assertion made against it would be reading a dead world.
    get state() {
      return state;
    },
    visuals,
    renderer,
    seek,
    /** Freeze the live loop so a capture is not racing an animation frame. */
    pause() {
      running = false;
    },
    resume() {
      if (running) return;
      running = true;
      last = performance.now();
      requestAnimationFrame(frame);
    },
    stats: () => visuals.stats(),
    setBloom: (values) => visuals.setBloom(values),
    setBloomDivisor: (d) => visuals.setBloomDivisor(d),
    setExposure: (e) => {
      renderer.toneMappingExposure = e;
    },
    dispose: () => {
      running = false;
      visuals.dispose();
    }
  };
}

try {
  boot();
} catch (err) {
  die(err);
}
