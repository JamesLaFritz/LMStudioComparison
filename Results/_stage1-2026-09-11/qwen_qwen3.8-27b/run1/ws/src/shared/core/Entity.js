/**
 * Entity — base contract for all game actors.
 *
 * Subclasses implement `reset()` (return to spawn-ready state) and may
 * override `update(dt)`. `dispose()` releases any GPU resources the entity
 * owns. `active` is the pool/deactivation flag.
 */
export class Entity {
  constructor() {
    this.active = false;
    this.position = { x: 0, y: 0, z: 0 };
  }

  update(_dt) {}

  reset() {
    this.active = false;
    this.position.x = 0;
    this.position.y = 0;
    this.position.z = 0;
  }

  dispose() {}
}
