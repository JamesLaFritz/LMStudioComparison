export function createPool(factoryFn) {
  const pool = [];
  return {
    get() { return pool.length > 0 ? pool.pop() : factoryFn(); },
    release(obj) { obj.dispose ? obj.dispose() : null; pool.push(obj); },
    clear() { pool.forEach((o) => o.dispose && o.dispose()); pool.length = 0; }
  };
}