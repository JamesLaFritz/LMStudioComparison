// Deterministic RNG utilities (mulberry32) + weighted selection.

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Returns a bound API over a seeded generator.
export function createRng(seed = 1337) {
  const next = mulberry32(seed);
  return {
    next,
    range(min, max) {
      return min + (max - min) * next();
    },
    int(min, max) {
      // inclusive on both ends
      return Math.floor(min + (max - min + 1) * next());
    },
    pick(arr) {
      return arr[Math.floor(next() * arr.length)];
    },
    bool(p = 0.5) {
      return next() < p;
    },
    // items: [{ weight, value }] — returns value
    weighted(items) {
      let total = 0;
      for (const it of items) total += it.weight;
      let r = next() * total;
      for (const it of items) {
        r -= it.weight;
        if (r <= 0) return it.value;
      }
      return items[items.length - 1].value;
    },
  };
}

// Piecewise-linear interpolation over a sorted table.
// table: [[x0, y0], [x1, y1], ...] — x ascending.
export function lerpTable(table, x) {
  if (x <= table[0][0]) return table[0][1];
  const last = table[table.length - 1];
  if (x >= last[0]) return last[1];
  for (let i = 1; i < table.length; i++) {
    if (x <= table[i][0]) {
      const [x0, y0] = table[i - 1];
      const [x1, y1] = table[i];
      const t = (x - x0) / (x1 - x0);
      return y0 + (y1 - y0) * t;
    }
  }
  return last[1];
}
