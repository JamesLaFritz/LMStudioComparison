function resolveStorage(storage) {
  if (storage !== undefined) return storage;
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

/** Read parsed JSON without allowing unavailable/corrupt storage to escape. */
export function loadJson(key, fallback = null, storage) {
  try {
    const target = resolveStorage(storage);
    if (!target || typeof target.getItem !== 'function') return fallback;
    const serialized = target.getItem(String(key));
    if (serialized === null) return fallback;
    return JSON.parse(serialized);
  } catch {
    return fallback;
  }
}

/** Serialize and store a value. Returns false for every denial/serialization failure. */
export function saveJson(key, value, storage) {
  try {
    const target = resolveStorage(storage);
    if (!target || typeof target.setItem !== 'function') return false;
    const serialized = JSON.stringify(value);
    if (serialized === undefined) return false;
    target.setItem(String(key), serialized);
    return true;
  } catch {
    return false;
  }
}

/** Remove a stored value. Returns false rather than throwing when storage is denied. */
export function removeStoredValue(key, storage) {
  try {
    const target = resolveStorage(storage);
    if (!target || typeof target.removeItem !== 'function') return false;
    target.removeItem(String(key));
    return true;
  } catch {
    return false;
  }
}
