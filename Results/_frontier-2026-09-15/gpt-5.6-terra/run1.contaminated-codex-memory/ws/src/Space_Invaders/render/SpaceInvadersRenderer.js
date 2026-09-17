import { ArenaRenderer } from './ArenaRenderer.js';
import { BunkerField } from './BunkerField.js';
import { InvaderField } from './InvaderField.js';
import { PlayerRenderer } from './PlayerRenderer.js';
import { ProjectileRenderer } from './ProjectileRenderer.js';
import { UfoRenderer } from './UfoRenderer.js';

/** Bridges immutable simulation snapshots to pooled Three.js visuals. */
export class SpaceInvadersRenderer {
  constructor(scene, vfx = null) {
    this.vfx = vfx;
    this.arena = new ArenaRenderer(scene);
    this.invaders = new InvaderField(scene);
    this.player = new PlayerRenderer(scene);
    this.bunkers = new BunkerField(scene);
    this.projectiles = new ProjectileRenderer(scene, (track, x, y, z, active) => {
      this.vfx?.setProjectileHead?.(track, x, y, z, active);
    });
    this.ufo = new UfoRenderer(scene);
  }

  sync(snapshot = {}) {
    this.invaders.sync(snapshot.invaders);
    this.player.sync(snapshot.player);
    this.projectiles.sync(snapshot.projectiles);
    this.bunkers.sync(snapshot.bunkers);
    this.ufo.sync(snapshot.ufo);
  }

  consumeEvent(event) {
    this.vfx?.consume?.(event);
  }

  update(realDelta, simulationDelta) {
    this.arena.update(realDelta);
    this.invaders.update(realDelta);
    this.player.update(realDelta);
    this.ufo.update(realDelta);
    this.vfx?.update?.(realDelta, simulationDelta);
  }

  dispose() {
    this.arena.dispose();
    this.invaders.dispose();
    this.player.dispose();
    this.projectiles.dispose();
    this.bunkers.dispose();
    this.ufo.dispose();
  }
}
