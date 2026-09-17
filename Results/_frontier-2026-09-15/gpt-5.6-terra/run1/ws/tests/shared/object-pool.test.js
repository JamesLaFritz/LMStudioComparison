import { describe, expect, it } from 'vitest';
import { ObjectPool } from '../../src/shared/core/ObjectPool.js';

describe('ObjectPool', () => {
  it('reuses a fixed slot without exceeding capacity', () => {
    const pool = new ObjectPool(2, () => ({ value: 0 }), (item) => {
      item.value = 0;
    });
    const first = pool.acquire();
    const second = pool.acquire();
    expect(pool.acquire()).toBeNull();
    first.value = 99;
    expect(pool.release(first)).toBe(true);
    const recycled = pool.acquire();
    expect(recycled).toBe(first);
    expect(recycled.value).toBe(0);
    expect(pool.activeCount).toBe(2);
    expect(pool.release(second)).toBe(true);
  });
});
