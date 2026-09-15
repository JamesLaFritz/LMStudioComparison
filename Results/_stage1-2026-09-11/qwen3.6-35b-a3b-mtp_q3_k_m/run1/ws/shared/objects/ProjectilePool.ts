import { Pool } from './Pool';

/**
 * Factory-based projectile pool — the game layer provides the factory.
 * This avoids circular dependencies between shared/ and games/.
 */
export function createProjectilePool<T extends { reset(): void }>(
  factory: () => T,
  initialSize: number = 250
): Pool<T> {
  return new Pool<T>(factory, initialSize);
}
