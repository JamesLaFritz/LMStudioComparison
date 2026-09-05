/**
 * Hub verbs.
 *
 * The arcade shell sits between the player and the game, so booting, reading
 * the cabinet grid, and picking the lit cabinet are on the path to play and are
 * therefore inside the gate.
 *
 * ### The subtlety that decides these checks
 *
 * Thirteen of the fourteen cabinets are `available: false` and render as
 * `.cabinet--locked`. **A locked card that does nothing when clicked is
 * correct.** The gate must not score it as a dead button. So H3 does not ask
 * "did clicking it do something" — it asks two different questions:
 *
 *   - is it *correctly inert*: no navigation, no mount, no thrown error; and
 *   - does it *read as coming-soon*: disabled to assistive tech, and carrying a
 *     status the player can read.
 *
 * A locked card that launched something would fail. A locked card that sat
 * there silently with no indication of why would also fail — not as a dead
 * button, but as an unlabelled one.
 */

import { PASS, FAIL, INCONCLUSIVE, SKIP } from '../lib/report.mjs';
import { diff } from '../lib/pixels.mjs';

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/** H1 — boot completes and the hub appears. */
export async function boots(s, report) {
  const h = s.target.hub;
  let visible = false;
  try {
    await s.page.waitForSelector(h.visibleSelector, { timeout: h.bootTimeoutMs ?? 8000 });
    visible = true;
  } catch {
    visible = false;
  }
  const bootGone = await s.page
    .evaluate((sel) => !document.querySelector(sel), h.bootScreenSelector)
    .catch(() => null);
  const shot = await s.shot('hub-boot', true);

  report.add({
    id: 'H1',
    group: 'hub',
    verb: 'the arcade boots to the cabinet select',
    input: 'navigate to the dev-server URL',
    observable: `${h.visibleSelector} present; ${h.bootScreenSelector} removed`,
    threshold: `hub visible within ${h.bootTimeoutMs ?? 8000} ms and the boot screen torn down`,
    verdict: visible && bootGone !== false ? PASS : FAIL,
    measured: { hubVisible: visible, bootScreenRemoved: bootGone },
    evidence: [shot.file]
  });
  return visible;
}

/** H2 — the fourteen cabinets, one lit and thirteen locked. */
export async function cabinetGrid(s, report) {
  const h = s.target.hub;
  const info = await s.page.evaluate(
    (cfg) => {
      const cards = Array.from(document.querySelectorAll(cfg.cardSelector));
      return {
        total: cards.length,
        locked: cards.filter((c) => c.matches(cfg.lockedSelector)).length,
        open: cards
          .filter((c) => !c.matches(cfg.lockedSelector))
          .map((c) => c.dataset.id || c.textContent.trim().slice(0, 40)),
        titles: cards.map((c) => (c.dataset.id || '').trim()).filter(Boolean)
      };
    },
    { cardSelector: h.cardSelector, lockedSelector: h.lockedSelector }
  );

  const ok =
    info.total === h.expectedCabinets &&
    info.locked === h.expectedCabinets - 1 &&
    info.open.length === 1 &&
    info.open[0] === h.litCabinetId;

  report.add({
    id: 'H2',
    group: 'hub',
    verb: 'the cabinet grid renders, one lit and the rest locked',
    input: 'none — read the rendered DOM',
    observable: `count of ${h.cardSelector} and ${h.lockedSelector}`,
    threshold: `${h.expectedCabinets} cards, ${h.expectedCabinets - 1} locked, the one open card is "${h.litCabinetId}"`,
    verdict: ok ? PASS : FAIL,
    measured: info
  });
  return ok;
}

/**
 * H3 — a locked cabinet is correctly inert *and* legible.
 *
 * Clicked with a real mouse event at the card's own coordinates, so the click
 * lands the way a player's would even though the element is `disabled`.
 */
export async function lockedCardInert(s, report) {
  const h = s.target.hub;
  const errorsBefore = s.pageErrors.length;
  const before = await s.page.evaluate(() => ({
    hash: location.hash,
    canvases: document.querySelectorAll('canvas').length,
    fatals: document.querySelectorAll('.fatal').length
  }));

  const box = await s.page
    .locator(`${h.cardSelector}${h.lockedSelector}`)
    .first()
    .boundingBox();
  if (!box) {
    report.add({
      id: 'H3',
      group: 'hub',
      verb: 'a locked cabinet is correctly inert and reads as coming-soon',
      input: 'real mouse click on a locked card',
      observable: 'route, mounted canvases, thrown errors, card semantics',
      threshold: 'nothing launches AND the card is disabled AND carries a status',
      verdict: INCONCLUSIVE,
      note: 'No locked card found to click.'
    });
    return false;
  }

  s.inputLog.push({ t: s.now(), action: 'mouse-click', detail: 'locked cabinet' });
  await s.page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await wait(1200);

  const after = await s.page.evaluate(
    (cfg) => {
      const card = document.querySelector(`${cfg.cardSelector}${cfg.lockedSelector}`);
      const status = card ? card.querySelector(cfg.statusSelector) : null;
      return {
        hash: location.hash,
        canvases: document.querySelectorAll('canvas').length,
        fatals: document.querySelectorAll('.fatal').length,
        hubStillVisible: !!document.querySelector(cfg.visibleSelector),
        disabled: card ? card.disabled === true || card.getAttribute('aria-disabled') === 'true' : null,
        statusText: status ? status.textContent.trim() : null,
        promptText: (() => {
          const p = cfg.promptSelector ? document.querySelector(cfg.promptSelector) : null;
          return p ? p.textContent.trim() : null;
        })()
      };
    },
    {
      cardSelector: h.cardSelector,
      lockedSelector: h.lockedSelector,
      statusSelector: h.statusSelector,
      visibleSelector: h.visibleSelector,
      promptSelector: h.promptSelector
    }
  );

  const comingSoon = new RegExp(h.comingSoonPattern || 'scheduled|soon|locked', 'i');
  const inert =
    after.hash === before.hash &&
    after.canvases === before.canvases &&
    after.fatals === before.fatals &&
    after.hubStillVisible &&
    s.pageErrors.length === errorsBefore;
  const legible =
    after.disabled === true &&
    (comingSoon.test(after.statusText || '') || comingSoon.test(after.promptText || ''));

  const shot = await s.shot('hub-locked-click', true);
  report.add({
    id: 'H3',
    group: 'hub',
    verb: 'a locked cabinet is correctly inert and reads as coming-soon',
    input: 'real mouse click at the locked card\'s own coordinates',
    observable:
      'location.hash, canvas count, .fatal count, uncaught errors, the card\'s ' +
      'disabled state and its status/prompt text',
    threshold:
      'route unchanged AND no canvas mounted AND no error thrown ' +
      `AND the card is disabled/aria-disabled AND a status matching /${h.comingSoonPattern || 'scheduled|soon|locked'}/i is on screen`,
    verdict: inert && legible ? PASS : FAIL,
    measured: { before, after, inert, legible },
    evidence: [shot.file],
    note: !inert
      ? 'A locked cabinet did something. Locked means locked.'
      : !legible
        ? 'The card is inert but does not say why. That is an unlabelled button, ' +
          'not a coming-soon card. (Silence alone is NOT scored as a dead button — ' +
          'the failure here is the missing label, not the missing action.)'
        : undefined
  });
  return inert && legible;
}

/** H4 — picking the lit cabinet lands you in play. */
export async function launchLitCabinet(s, report) {
  const h = s.target.hub;
  const box = await s.page
    .locator(`${h.cardSelector}[data-id="${h.litCabinetId}"]`)
    .first()
    .boundingBox();
  if (!box) {
    report.add({
      id: 'H4',
      group: 'hub',
      verb: 'picking the lit cabinet lands the player in the game',
      input: 'real mouse click on the lit card',
      observable: 'hash, hub hidden, canvas painting',
      threshold: 'in play within the launch budget',
      verdict: FAIL,
      note: 'The lit cabinet card was not found in the DOM.'
    });
    return false;
  }

  s.inputLog.push({ t: s.now(), action: 'mouse-click', detail: h.litCabinetId });
  await s.page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);

  const budget = h.launchTimeoutMs ?? 10000;
  const deadline = Date.now() + budget;
  let landed = false;
  let info = null;
  while (Date.now() < deadline) {
    info = await s.page.evaluate(
      (cfg) => ({
        hash: location.hash,
        hubVisible: !!document.querySelector(cfg.visibleSelector),
        canvases: document.querySelectorAll('canvas').length,
        fatal: !!document.querySelector('.fatal')
      }),
      { visibleSelector: h.visibleSelector }
    );
    if (info.hash === `#${h.litCabinetId}` && !info.hubVisible && info.canvases > 0) {
      landed = true;
      break;
    }
    await wait(250);
  }

  // Landing in play is not enough: the game canvas must be painting.
  const a = await s.shot('play-entry-a', true);
  await wait(700);
  const b = await s.shot('play-entry-b', true);
  const d = diff(a, b, { threshold: s.target.thresholds.pixelDelta });

  const minPixels = s.target.thresholds.idleMinChangedPixels ?? 200;
  const ok = landed && d.count >= minPixels;

  report.add({
    id: 'H4',
    group: 'hub',
    verb: 'picking the lit cabinet lands the player in a running game',
    input: 'real mouse click on the lit card',
    observable:
      'location.hash, hub layer hidden, a canvas mounted, and consecutive ' +
      'frames of that canvas differing',
    threshold: `hash === "#${h.litCabinetId}" within ${budget} ms AND >= ${minPixels} changed pixels between two frames 700 ms apart`,
    verdict: ok ? PASS : FAIL,
    measured: { ...info, changedPixels: d.count },
    evidence: [a.file, b.file],
    note: ok
      ? undefined
      : landed
        ? 'Mounted, but the frame is static. A cabinet that renders a still image ' +
          'has not launched a game.'
        : 'Never reached the game.'
  });
  return ok;
}

/** H5/H6/H7 — hash routing and deep links. */
export async function hashRouting(s, report, baseUrl) {
  const h = s.target.hub;
  const cases = [
    {
      id: 'H5',
      verb: 'a deep link to the lit cabinet goes straight into play',
      hash: `#${h.litCabinetId}`,
      expect: 'game'
    },
    {
      id: 'H6',
      verb: 'a deep link to a locked cabinet falls back to the hub without error',
      hash: `#${h.lockedProbeId}`,
      expect: 'hub'
    },
    {
      id: 'H7',
      verb: 'an unknown hash falls back to the hub without error',
      hash: '#NotACabinet',
      expect: 'hub'
    }
  ];

  const results = [];
  for (const c of cases) {
    const errorsBefore = s.pageErrors.length;
    await s.page.goto(baseUrl.replace(/#.*$/, '') + c.hash, { waitUntil: 'load' });
    await wait(h.launchTimeoutMs ?? 4000);

    const state = await s.page.evaluate(
      (cfg) => ({
        hash: location.hash,
        hubVisible: !!document.querySelector(cfg.visibleSelector),
        canvases: document.querySelectorAll('canvas').length,
        fatal: !!document.querySelector('.fatal')
      }),
      { visibleSelector: h.visibleSelector }
    );
    const threw = s.pageErrors.length > errorsBefore;
    const inGame = !state.hubVisible && state.canvases > 0 && state.hash === c.hash;
    const inHub = state.hubVisible && !state.fatal;
    const ok = (c.expect === 'game' ? inGame : inHub) && !threw;

    const shot = await s.shot(`route-${c.id}`, true);
    report.add({
      id: c.id,
      group: 'hub',
      verb: c.verb,
      input: `navigate to <url>${c.hash}`,
      observable: 'hub visibility, canvas count, .fatal presence, uncaught errors',
      threshold: c.expect === 'game' ? 'in play, no hub, no error' : 'hub visible, no fatal, no error',
      verdict: ok ? PASS : FAIL,
      measured: { ...state, threw },
      evidence: [shot.file]
    });
    results.push(ok);
  }
  return results.every(Boolean);
}

/**
 * H8 — a failed load surfaces on screen.
 *
 * The fault is injected through the *network*, not through game internals: the
 * lazily-imported cabinet chunk is aborted by request interception. Everything
 * downstream — the registry's rejected promise, the shell's re-throw, the hub's
 * `showFatal` — then runs for real.
 *
 * `main.js` claims a failed load must reach the player because "a menu button
 * that silently does nothing when clicked is the worst possible presentation".
 * This is that claim, executed.
 */
export async function failedLoadSurfaces(s, report, baseUrl) {
  const h = s.target.hub;
  const pattern = h.gameChunkPattern || `**/${h.litCabinetId}/**`;

  await s.page.route(pattern, (route) => route.abort('failed'));
  try {
    await s.page.goto(baseUrl.replace(/#.*$/, ''), { waitUntil: 'load' });
    await s.page.waitForSelector(h.visibleSelector, { timeout: h.bootTimeoutMs ?? 8000 });

    const box = await s.page
      .locator(`${h.cardSelector}[data-id="${h.litCabinetId}"]`)
      .first()
      .boundingBox();
    if (box) await s.page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);

    let surfaced = null;
    const deadline = Date.now() + 10000;
    while (Date.now() < deadline) {
      surfaced = await s.page.evaluate((sel) => {
        const el = document.querySelector(sel);
        if (!el) return null;
        const cs = getComputedStyle(el);
        return {
          text: el.textContent.trim().slice(0, 200),
          visible: cs.display !== 'none' && cs.visibility !== 'hidden' && Number(cs.opacity) > 0.01
        };
      }, h.fatalSelector);
      if (surfaced && surfaced.visible) break;
      await wait(300);
    }

    const shot = await s.shot('hub-failed-load', true);
    const ok = !!(surfaced && surfaced.visible && surfaced.text.length > 8);
    report.add({
      id: 'H8',
      group: 'hub',
      verb: 'a cabinet that fails to load says so on screen',
      input: `abort every request matching ${pattern}, then click the lit card`,
      observable: `${h.fatalSelector} present, visible, and carrying text`,
      threshold: 'a visible error panel with a non-trivial message within 10 s',
      verdict: ok ? PASS : FAIL,
      measured: surfaced || { surfaced: false },
      evidence: [shot.file],
      note: ok
        ? undefined
        : 'The load failed and the player was told nothing. This is the silent ' +
          'dead-button case the shell explicitly promises not to ship.'
    });
    return ok;
  } finally {
    await s.page.unroute(pattern).catch(() => {});
  }
}

/** H9 — the attract scene is alive, not a still image. */
export async function attractAnimates(s, report) {
  if (!s.target.hub.attract) {
    report.add({
      id: 'H9',
      group: 'hub',
      verb: 'the attract scene animates',
      input: 'sit on the hub for 3 s',
      observable: 'frame difference',
      threshold: 'n/a',
      verdict: SKIP,
      required: false,
      note: 'Disabled in the target config.'
    });
    return null;
  }
  const a = await s.shot('hub-attract-a', true);
  await wait(3000);
  const b = await s.shot('hub-attract-b', true);
  const d = diff(a, b, { threshold: s.target.thresholds.pixelDelta });
  const min = s.target.thresholds.attractMinChangedPixels ?? 500;
  const ok = d.count >= min;
  report.add({
    id: 'H9',
    group: 'hub',
    verb: 'the attract scene animates',
    input: 'sit on the hub for 3 s, no keys held',
    observable: 'changed pixels between two frames 3 s apart',
    threshold: `>= ${min}`,
    verdict: ok ? PASS : FAIL,
    measured: { changedPixels: d.count },
    evidence: [a.file, b.file]
  });
  return ok;
}

/** H10 — the player can get back out of the game. */
export async function exitToHub(s, report) {
  const key = s.target.keys.exit;
  if (!key) {
    report.add({
      id: 'H10',
      group: 'hub',
      verb: 'the player can leave the game and return to the hub',
      input: 'n/a',
      observable: 'n/a',
      threshold: 'n/a',
      verdict: SKIP,
      required: false,
      note: 'No exit key configured for this target.'
    });
    return null;
  }
  await s.tap(key);
  await wait(1500);
  const state = await s.page.evaluate(
    (sel) => ({
      hubVisible: !!document.querySelector(sel),
      hash: location.hash
    }),
    s.target.hub.visibleSelector
  );
  const shot = await s.shot('hub-return', true);
  const ok = state.hubVisible;
  report.add({
    id: 'H10',
    group: 'hub',
    verb: 'the player can leave the game and return to the hub',
    input: `press ${key} while in play`,
    observable: 'hub layer visible again, hash cleared',
    threshold: 'hub visible within 1.5 s',
    verdict: ok ? PASS : FAIL,
    measured: state,
    evidence: [shot.file]
  });
  return ok;
}
