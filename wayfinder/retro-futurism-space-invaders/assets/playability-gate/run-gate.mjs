#!/usr/bin/env node
/**
 * The playability gate — runnable harness.
 *
 *   node run-gate.mjs --target targets/reference.json --url http://localhost:5173/
 *
 * Drives a real browser with real key and mouse events, measures a named
 * observable per verb, and writes a machine-readable pass/fail per verb plus
 * the frames it measured.
 *
 * Exit code 0 only when every required verb passed. INCONCLUSIVE and SKIP are
 * not passes.
 *
 * See gate.md for the verb table, the thresholds, and what this harness has and
 * has not been proved to do.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

import { Session } from './lib/session.mjs';
import { Report, PASS, FAIL, INCONCLUSIVE, SKIP } from './lib/report.mjs';
import * as I from './verbs/integrity.mjs';
import * as H from './verbs/hub.mjs';
import * as C from './verbs/core.mjs';
import * as V from './verbs/vfx.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));

/* ==================================================================== *
 * Page-level fault injection.
 *
 * Every check in this gate has to be able to go red, and the only way to know
 * that is to break the build on purpose and watch it happen. These faults are
 * injected as ordinary page script through `addInitScript`, upstream of the
 * build's own listeners and knowing nothing about its internals, so they work
 * against any target.
 * ==================================================================== */
const FAULTS = {
  /** Swallow every key event before the page sees it. Every input verb must fail. */
  'no-input': `
    for (const type of ['keydown', 'keyup', 'keypress']) {
      window.addEventListener(type, (e) => e.stopImmediatePropagation(), true);
    }
  `,
  /** Swallow only Space. Movement must stay green; fire and everything downstream must go red. */
  'mute-fire': `
    for (const type of ['keydown', 'keyup', 'keypress']) {
      window.addEventListener(type, (e) => {
        if (e.code === 'Space') e.stopImmediatePropagation();
      }, true);
    }
  `,
  /**
   * Let the page render 60 frames, then kill the render loop. Counted in frames
   * rather than milliseconds so the fault lands in the same place on a fast
   * machine and a slow one: the build boots and paints, and then stops. I2 and
   * I5 must both go red.
   */
  'freeze-raf': `
    (() => {
      const real = window.requestAnimationFrame.bind(window);
      let left = 60;
      window.requestAnimationFrame = function (cb) {
        if (left-- <= 0) return 0;
        return real(cb);
      };
    })();
  `,
  /** Freeze the HUD text so a score readout can never move. C12 must fail. */
  'frozen-hud': `
    document.addEventListener('DOMContentLoaded', () => {
      const desc = Object.getOwnPropertyDescriptor(Node.prototype, 'textContent');
      Object.defineProperty(Node.prototype, 'textContent', {
        get: desc.get,
        set(v) { if (this instanceof Element && this.closest('#hud, .hud, [data-gate]')) return; desc.set.call(this, v); },
        configurable: true
      });
    });
  `
};

/* ==================================================================== *
 * CLI
 * ==================================================================== */

function parseArgs(argv) {
  const out = { only: null, fault: null, quick: false, headed: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    const next = () => argv[++i];
    if (a === '--target') out.target = next();
    else if (a === '--url') out.url = next();
    else if (a === '--out') out.out = next();
    else if (a === '--only') out.only = next().split(',').map((x) => x.trim());
    else if (a === '--verbs') out.verbs = next().split(',').map((x) => x.trim().toUpperCase());
    else if (a === '--fault') out.fault = next();
    else if (a === '--source') out.source = next();
    else if (a === '--quick') out.quick = true;
    else if (a === '--headed') out.headed = true;
    else if (a === '--software-gl') out.softwareGl = true;
    else if (a === '--help' || a === '-h') out.help = true;
    else throw new Error(`unknown argument: ${a}`);
  }
  return out;
}

const HELP = `
playability gate

  node run-gate.mjs --target <config.json> [options]

  --target <file>   target config (see targets/*.json)          [required]
  --url <url>       dev-server URL, overrides the config
  --out <dir>       evidence directory              [default: ./runs/<stamp>]
  --only <groups>   comma list of integrity,hub,core,vfx
  --verbs <ids>     comma list of verb ids (C6,V3,...). Only the phases that
                    produce one of them run, so a single failing verb can be
                    re-checked without replaying the whole session.
  --fault <name>    inject a fault to prove the checks go red:
                    ${Object.keys(FAULTS).join(', ')}
  --source <dir>    build source root, for the provenance check
  --software-gl     force SwiftShader instead of the GPU. Slower AND blinder:
                    measured 7 rAF/s and zero screencast frames on this build,
                    which turns frame-differencing verbs into false reds.
  --quick           shorten the long idle budgets and skip the wave/game-over
                    phases. A --quick run can never report gate PASS.
  --headed          run with a visible browser window
`;

/* ==================================================================== *
 * Config
 * ==================================================================== */

const DEFAULTS = {
  viewport: { width: 1280, height: 720 },
  keys: {
    left: 'ArrowLeft',
    right: 'ArrowRight',
    fire: 'Space',
    restart: 'Enter',
    unbound: 'F7'
  },
  selectors: {},
  regions: {
    formationBand: { x: 0.0, y: 0.10, w: 1.0, h: 0.42 },
    descentBand: { x: 0.0, y: 0.45, w: 1.0, h: 0.25 },
    shotBand: { x: 0.0, y: 0.40, w: 1.0, h: 0.42 },
    muzzleBand: { x: 0.0, y: 0.70, w: 1.0, h: 0.06 },
    bunkerBand: { x: 0.0, y: 0.66, w: 1.0, h: 0.10 },
    playerBand: { x: 0.0, y: 0.76, w: 1.0, h: 0.16 },
    ufoBand: { x: 0.0, y: 0.03, w: 1.0, h: 0.07 },
    sceneryBand: { x: 0.0, y: 0.92, w: 1.0, h: 0.08 }
  },
  thresholds: {
    pixelDelta: 12,
    litFloor: 40,
    minFramesPerSecond: 20,
    allowedConsolePatterns: ['favicon'],

    idleMinChangedPixels: 200,
    idleMinUnionRatio: 0.001,
    idleMinMovingPairs: 0.5,
    attractMinChangedPixels: 500,

    moveHoldMs: 700,
    moveMinDrift: 0.02,
    unboundMaxDrift: 0.01,
    clampHoldMs: 2500,
    clampMaxCentroid: 0.35,
    clampMaxDrift: 0.01,

    projectileMinPixels: 40,
    cooldownHoldMs: 2600,
    cooldownMinSeconds: 0.08,
    cooldownMaxSeconds: 1.2,
    cooldownMinLitSpan: 20,
    despawnSettleMs: 4000,
    despawnMaxLit: 400,

    idleFps: 6,
    marchWindowMs: 5000,
    marchFps: 8,
    marchMinCentroidTravel: 0.015,
    descentWindowMs: 20000,
    descentFps: 5,
    reversalDeadzone: 0.004,
    reversalMinExtreme: 0.08,
    descentMinDrop: 0.02,

    sweepPasses: 3,
    sweepLegMs: 1600,
    accelMinRatio: 1.25,

    enemyFireBudgetMs: 20000,
    enemyFireFps: 12,
    enemyFireMinStep: 0.01,
    enemyFireMinRun: 3,

    killBurstMs: 6000,
    fireBurstMs: 1800,
    killMinFormationMassDrop: 0.02,

    bunkerMinLit: 200,
    bunkerFireMs: 4000,
    bunkerMinErosion: 0.02,

    ufoBudgetMs: 45000,
    ufoFps: 4,
    ufoMinLit: 60,
    ufoMinTravel: 0.25,

    deathBudgetMs: 60000,
    respawnWaitMs: 3000,
    respawnMinLit: 40,

    clearBudgetMs: 240000,
    waveSettleMs: 2500,
    escalationMinDrop: 0.01,
    escalationMinSpeedRatio: 1.1,
    gameOverBudgetMs: 180000,
    restartSettleMs: 2500,
    restartMinFormationLit: 500,
    pauseMaxDelta: 0.5,

    shakeWindowFrames: 14,
    shakeMinDeviation: 0.004,
    shakeMaxTailRatio: 0.5,
    burstRadiusFrac: 0.09,
    burstWindowFrames: 20,
    burstMinMeanDelta: 4,
    burstMaxTailRatio: 0.35,
    burstMaxPeakFrame: 8,
    burstMinAmbientRatio: 3,
    hitStopWindowFrames: 12,
    hitStopMaxRatio: 0.4,
    hitStopMinFrames: 2,
    hitStopRecoverRatio: 0.6,
    trailFloor: 90,
    trailMinLengthFrac: 0.06,
    projectileBodyFrac: 0.018,
    trailMinBodyMultiple: 2.5,
    trailMaxFalloffRatio: 0.85,
    ringRadiusFrac: 0.14,
    ringBins: 20,
    ringWindowFrames: 12,
    ringMinGrowingFrames: 3,
    ringMaxInnerRatio: 0.6,
    ringMinPeakBin: 2,
    ringMinPeakDelta: 20,
    ringMinAmbientRatio: 2.5,
    floatTextBudgetMs: 9000,
    floatTextClearMs: 3500,
    floatTextMinRisePx: 8
  }
};

function deepMerge(a, b) {
  const out = { ...a };
  for (const [k, v] of Object.entries(b || {})) {
    out[k] = v && typeof v === 'object' && !Array.isArray(v) ? deepMerge(a[k] || {}, v) : v;
  }
  return out;
}

const QUICK = {
  marchWindowMs: 4000,
  descentWindowMs: 14000,
  enemyFireBudgetMs: 12000,
  ufoBudgetMs: 18000,
  deathBudgetMs: 30000,
  clearBudgetMs: 60000,
  gameOverBudgetMs: 45000,
  killBurstMs: 4500
};

/* ==================================================================== *
 * Provenance
 * ==================================================================== */

function newestSourceMtime(dir) {
  let newest = 0;
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (e.name === 'node_modules' || e.name === '.git' || e.name === 'dist') continue;
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else {
        const m = fs.statSync(p).mtimeMs;
        if (m > newest) newest = m;
      }
    }
  };
  walk(dir);
  return newest;
}

async function provenance(report, opts, url) {
  let sha = null;
  try {
    sha = execSync('git rev-parse --short HEAD', { cwd: HERE, encoding: 'utf8' }).trim();
  } catch {
    /* not a repo, or no git */
  }

  if (!opts.source) {
    report.add({
      id: 'I4',
      group: 'integrity',
      verb: 'the build under test is the current build',
      input: '--source <dir>',
      observable: 'newest source mtime vs. the start of this run',
      threshold: 'every source file predates the run',
      verdict: INCONCLUSIVE,
      required: false,
      measured: { gitSha: sha, url },
      note: 'No --source given. This run cannot prove it played current bytes.'
    });
    return;
  }

  const newest = newestSourceMtime(opts.source);
  const ok = newest < Date.now();
  report.add({
    id: 'I4',
    group: 'integrity',
    verb: 'the build under test is the current build',
    input: `--source ${opts.source}`,
    observable: 'newest source-file mtime vs. the start of this run',
    threshold: 'every source file predates the run start',
    verdict: ok ? PASS : FAIL,
    measured: {
      newestSource: new Date(newest).toISOString(),
      runStart: new Date().toISOString(),
      gitSha: sha
    },
    note: ok ? undefined : 'A source file changed after this run began — the served bytes are stale.'
  });
}

/* ==================================================================== *
 * Main
 * ==================================================================== */

/**
 * Wait until the build is actually mounted before measuring anything.
 *
 * This replaced a flat `sleep(1200)`, and the difference is not cosmetic. Mounting
 * a cabinet is asynchronous — a dynamic `import()` of the game chunk followed by
 * `await game.init()`, which builds a renderer, a post-processing stack and a
 * particle pool. Under headless SwiftShader that comfortably outruns 1200 ms, so
 * the harness began driving keys at the *hub* and then reported the game frozen
 * and deaf. Every verb below the fold inherited that, and the run named two
 * defects — "the game never saw the key event", "the page is frozen" — that
 * direct measurement disproved minutes later.
 *
 * A false red is worse than no gate, because it sends someone to repair working
 * code. So readiness is now observed rather than assumed.
 *
 * Deliberately NOT a hard requirement on `__gate`: a build that exposes no probe
 * is exactly the case this harness must still be able to fail honestly — that is
 * how it proved itself against the frozen 2026-09-04 build, which has no probe
 * and no working simulation. So the probe is the *preferred* signal, a painting
 * canvas is the fallback, and the timeout still proceeds to measure rather than
 * aborting. Which path was taken is recorded, because "the probe never appeared"
 * changes how every verdict below should be read.
 */
async function waitForBuildReady(page, s, report, timeoutMs = 20000) {
  const t0 = Date.now();

  const probe = await page
    .waitForFunction(() => !!(window.__gate && typeof window.__gate.snapshot === 'function'), {
      timeout: timeoutMs
    })
    .then(() => true)
    .catch(() => false);

  if (probe) {
    // The probe exists the instant it is installed, which is before the first
    // frame is composited. Give the renderer a beat so pixel observables are real.
    await s.sleep(600);
    const out = { how: 'gate probe present', ms: Date.now() - t0, probe: true };
    if (report && report.provenance) report.provenance.readiness = out;
    return out;
  }

  const canvas = await page
    .waitForFunction(
      () => {
        const c = document.querySelector('canvas');
        return !!c && c.clientWidth > 0 && c.clientHeight > 0;
      },
      { timeout: 4000 }
    )
    .then(() => true)
    .catch(() => false);

  await s.sleep(1200);
  const out = {
    how: canvas
      ? 'NO gate probe — fell back to a sized canvas'
      : 'NO gate probe and NO canvas — measuring anyway',
    ms: Date.now() - t0,
    probe: false
  };
  if (report && report.provenance) report.provenance.readiness = out;
  return out;
}

async function main() {
  const opts = parseArgs(process.argv);
  if (opts.help || !opts.target) {
    process.stdout.write(HELP);
    process.exit(opts.help ? 0 : 2);
  }

  const cfgPath = path.resolve(opts.target);
  const target = deepMerge(DEFAULTS, JSON.parse(fs.readFileSync(cfgPath, 'utf8')));
  if (opts.quick) target.thresholds = { ...target.thresholds, ...QUICK };
  const url = opts.url || target.url;
  if (!url) throw new Error('no URL: pass --url or set "url" in the target config');

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outDir = path.resolve(opts.out || path.join(HERE, 'runs', stamp));
  fs.mkdirSync(outDir, { recursive: true });

  const want = (g) => !opts.only || opts.only.includes(g);

  /**
   * Run a phase only if it produces one of the requested verbs.
   *
   * A partial run can never report gate PASS: the verbs that did not run are
   * absent from the report, and `Report.gateVerdict` only says PASS when every
   * required verb it holds passed AND at least one did. The runner records the
   * filter in the report metadata so a partial run is never mistaken for a full
   * one.
   */
  const phase = async (ids, fn) => {
    if (opts.verbs && !ids.some((id) => opts.verbs.includes(id))) return null;
    return fn();
  };

  // Playwright is resolved at run time so the gate can live in a repo that does
  // not vendor it: `npm i -D playwright` here, or run from a checkout that has it.
  let chromium;
  try {
    ({ chromium } = await import('playwright'));
  } catch {
    try {
      ({ chromium } = await import('@playwright/test'));
    } catch {
      console.error(
        'Playwright not found. Install it first:\n' +
          '  npm i -D playwright && npx playwright install chromium'
      );
      process.exit(3);
    }
  }

  const browser = await chromium.launch({
    headless: !opts.headed,
    args: [
      // ANGLE picks the platform's hardware backend (d3d11 on Windows, Metal on
      // macOS, GL on Linux). SwiftShader stays available as a fallback where
      // there is no GPU, but it must NOT be the default, because forcing it
      // makes this harness blind rather than slow.
      //
      // Measured on this build, same machine, same scene:
      //
      //            rAF/s   screencast frames in 3 s   sim steps/s
      //   software     7                          0            56
      //   hardware    33                         83           114
      //
      // At 7 fps with no screencast at all, every verb that differences frames
      // fails — the six mandated VFX, every centroid check, the dead-simulation
      // detector — against a build whose own probe shows it working. Those are
      // false reds, and a false red sends someone to repair working code.
      //
      // `--software-gl` forces the old behaviour when reproducibility across
      // machines matters more than being able to see.
      '--use-gl=angle',
      opts.softwareGl ? '--use-angle=swiftshader' : '--use-angle=default',
      '--enable-unsafe-swiftshader',
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding',
      '--disable-background-timer-throttling'
    ]
  });
  const context = await browser.newContext({
    viewport: target.viewport,
    deviceScaleFactor: 1,
    reducedMotion: 'no-preference'
  });
  const page = await context.newPage();

  if (opts.fault) {
    const script = FAULTS[opts.fault];
    if (!script) throw new Error(`unknown fault "${opts.fault}"`);
    await page.addInitScript(script);
  }

  const s = new Session(page, target, outDir);
  const report = new Report({
    target: path.basename(cfgPath),
    url,
    fault: opts.fault || 'none',
    quick: opts.quick,
    onlyGroups: opts.only ? opts.only.join(',') : 'all',
    onlyVerbs: opts.verbs ? opts.verbs.join(',') : 'all',
    viewport: `${target.viewport.width}x${target.viewport.height}`,
    startedAt: new Date().toISOString(),
    harness: 'playability-gate/run-gate.mjs',
    inputPath: 'CDP Input.dispatchKeyEvent / dispatchMouseEvent (real browser input)'
  }, {
    // A shortened, filtered or deliberately broken run is not a gate result.
    complete: !opts.quick && !opts.only && !opts.verbs && !opts.fault
  });

  /** Collected across the run so the particle cap can be checked over everything. */
  const allSamples = [];

  try {
    console.log(`\nplayability gate → ${url}`);
    console.log(`evidence → ${outDir}\n`);

    await provenance(report, opts, url);

    await page.goto(url, { waitUntil: 'load', timeout: 30000 });
    await page.bringToFront().catch(() => {});
    const readiness = await waitForBuildReady(page, s, report);
    console.log(`  boot: ${readiness.how} after ${readiness.ms} ms`);

    /* ---------------- hub ---------------- */
    if (target.hub && target.hub.present && want('hub')) {
      console.log('— hub —');
      await phase(['H1'], () => H.boots(s, report));
      await phase(['H2'], () => H.cabinetGrid(s, report));
      await phase(['H9'], () => H.attractAnimates(s, report));
      await phase(['H3'], () => H.lockedCardInert(s, report));
      await phase(['H4'], () => H.launchLitCabinet(s, report));
      await phase(['H10'], () => H.exitToHub(s, report));
      await phase(['H5', 'H6', 'H7'], () => H.hashRouting(s, report, url));
      await phase(['H8'], () => H.failedLoadSurfaces(s, report, url));

      // Back into play for everything below, by deep link.
      await page.goto(url.replace(/#.*$/, '') + `#${target.hub.litCabinetId}`, {
        waitUntil: 'load'
      });
      // Same reasoning as the first boot: observe the mount, never assume it.
      const back = await waitForBuildReady(page, s, report, target.hub.launchTimeoutMs ?? 20000);
      console.log(`  re-entry: ${back.how} after ${back.ms} ms`);
    }

    /* ---------------- integrity, in play ---------------- */
    if (want('integrity') || want('core') || want('vfx')) {
      console.log('— integrity —');
      const visible = await I.visibility(s, report);
      if (!visible) {
        console.error('\nABORT: the page is not visible; pixel observables are void.');
      }
      await phase(['I2'], () => I.rafAlive(s, report));
      await phase(['I3'], () => I.consoleClean(s, report));
      await phase(['I5'], () =>
        I.idleLiveness(s, report, {
          windowMs: opts.quick ? 4000 : 6000,
          fps: target.thresholds.idleFps ?? 6
        })
      );
      await phase(['I6'], () => I.unboundKeyControl(s, report, target.regions));
      await phase(['I7'], () => I.inputPathLive(s, report));
    }

    /* ---------------- core + vfx ---------------- */
    if (want('core') || want('vfx')) {
      console.log('— formation —');
      const march =
        (await phase(['C6', 'C9', 'C22', 'C25'], () => C.formationMarches(s, report))) || {};

      console.log('— player —');
      await phase(['C1', 'C2'], () => C.playerMoves(s, report));
      await phase(['C3'], () => C.playerClamps(s, report));
      const fire =
        (await phase(['C4', 'C5', 'C13', 'V4'], () => C.playerFires(s, report))) || {
          ok: false,
          frames: []
        };
      await phase(['C5'], () => C.fireCooldown(s, report, fire.ok));

      if (want('vfx')) {
        console.log('— vfx (trails) —');
        await phase(['V4'], () => V.motionTrails(s, report, fire.frames));
      }

      console.log('— combat —');
      const kill =
        (await phase(['C11', 'C12', 'V1', 'V2', 'V3', 'V5'], () =>
          C.killAndScore(s, report)
        )) || { frames: [] };
      allSamples.push(...kill.frames);

      if (want('vfx')) {
        console.log('— vfx (impact) —');
        const k = kill.frames.length ? V.findKillFrame(s, kill.frames) : null;
        await phase(['V1'], () => V.cameraShake(s, report, kill.frames, k));
        await phase(['V2'], () => V.particleBurst(s, report, kill.frames, k));
        await phase(['V3'], () => V.hitStop(s, report, kill.frames, k));
        await phase(['V5'], () => V.shockwave(s, report, kill.frames, k));
        await phase(['V6'], () => V.floatingScoreText(s, report));
      }

      await phase(['C13'], () => C.projectilesDespawn(s, report, fire.ok));
      await phase(['C9'], () => C.formationAccelerates(s, report, march.speed));
      await phase(['C7', 'C8'], () => C.formationDescends(s, report));
      await phase(['C10'], () => C.invadersShoot(s, report));
      await phase(['C14', 'C15'], () => C.bunkers(s, report));
      await phase(['C16'], () => C.ufo(s, report));
      await phase(['C27'], () => C.pause(s, report));

      console.log('— wave and loss —');
      await phase(['C21', 'C22'], () =>
        C.waveAdvances(s, report, { quick: opts.quick, wave1Speed: march.speed })
      );
      await phase(['C18', 'C19', 'C20'], () => C.playerDies(s, report));
      await phase(['C23', 'C24'], () =>
        C.gameOver(s, report, { budgetMs: target.thresholds.gameOverBudgetMs })
      );
      await phase(['C25', 'C26'], () => C.restart(s, report));
    }

    /* ---------------- teardown checks ---------------- */
    console.log('— teardown —');
    await phase(['I8'], () => I.particleCap(s, report, allSamples));
    await phase(['I9'], () => I.disarm(s, report, target.regions));
  } catch (err) {
    report.add({
      id: 'X0',
      group: 'integrity',
      verb: 'the gate ran to completion',
      input: 'n/a',
      observable: 'harness exceptions',
      threshold: 'none',
      verdict: FAIL,
      note: `Harness threw: ${err && err.stack ? err.stack.split('\n')[0] : err}`
    });
    console.error(err);
  } finally {
    await s.releaseAll().catch(() => {});
    fs.writeFileSync(
      path.join(outDir, 'console.json'),
      JSON.stringify(
        { console: s.console, pageErrors: s.pageErrors, failedRequests: s.failedRequests, input: s.inputLog },
        null,
        2
      )
    );
    await context.close().catch(() => {});
    await browser.close().catch(() => {});
  }

  const json = report.write(outDir);
  const c = json.counts;
  console.log(
    `\ngate: ${json.gate}   (${c.PASS} pass · ${c.FAIL} fail · ${c.INCONCLUSIVE} inconclusive · ${c.SKIP} skipped)`
  );
  console.log(`report: ${path.join(outDir, 'report.md')}`);
  process.exit(json.gate === PASS ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(4);
});
