/**
 * Defensive localStorage wrapper.
 *
 * localStorage throws in three real situations that a game must survive:
 * private browsing on some engines, storage quota exhaustion, and cross-origin
 * iframe embedding with third-party storage blocked. Any of those would
 * otherwise take down the whole boot sequence over a high-score read, so every
 * access is guarded and the module degrades to an in-memory map.
 */

const PREFIX = 'rfa:';

/** In-memory fallback used when the real backing store is unavailable. */
const memory = new Map();

let available = null;

function isAvailable() {
  if (available !== null) return available;
  try {
    const probe = `${PREFIX}__probe__`;
    window.localStorage.setItem(probe, '1');
    window.localStorage.removeItem(probe);
    available = true;
  } catch {
    available = false;
  }
  return available;
}

/**
 * Read a JSON value.
 * @param {string} key
 * @param {*} fallback returned when missing or corrupt
 */
export function load(key, fallback = null) {
  const full = PREFIX + key;
  try {
    const raw = isAvailable() ? window.localStorage.getItem(full) : memory.get(full);
    if (raw === null || raw === undefined) return fallback;
    return JSON.parse(raw);
  } catch {
    // Corrupt entry — drop it so it cannot poison every future boot.
    remove(key);
    return fallback;
  }
}

/**
 * Write a JSON value. Returns false if persistence failed, which callers are
 * free to ignore; the value is still readable for the rest of the session.
 */
export function save(key, value) {
  const full = PREFIX + key;
  let raw;
  try {
    raw = JSON.stringify(value);
  } catch {
    return false;
  }
  memory.set(full, raw);
  if (!isAvailable()) return false;
  try {
    window.localStorage.setItem(full, raw);
    return true;
  } catch {
    return false;
  }
}

/** Delete a key from both the real store and the memory fallback. */
export function remove(key) {
  const full = PREFIX + key;
  memory.delete(full);
  if (!isAvailable()) return;
  try {
    window.localStorage.removeItem(full);
  } catch {
    /* nothing useful to do */
  }
}

/**
 * Read a numeric high score, guarding against a tampered or corrupt value.
 * A NaN high score propagates into the HUD and the scoring comparison and
 * makes every subsequent score fail to register, so it is validated here.
 */
export function loadScore(key) {
  const v = load(key, 0);
  return Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0;
}

/** Persist a high score only when it is genuinely higher. */
export function saveScore(key, value) {
  if (!Number.isFinite(value)) return false;
  const current = loadScore(key);
  if (value <= current) return false;
  return save(key, Math.floor(value));
}
