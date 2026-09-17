import { EnvironmentRenderer } from '@space/render/EnvironmentRenderer.js';
import { InvaderRenderer } from '@space/render/InvaderRenderer.js';
import { PlayerRenderer } from '@space/render/PlayerRenderer.js';
import { BarrierRenderer } from '@space/render/BarrierRenderer.js';
import { ProjectileRenderer } from '@space/render/ProjectileRenderer.js';
import { UfoRenderer } from '@space/render/UfoRenderer.js';

export class RenderBridge {
  constructor(sceneContext, registry) {
    this.environment = new EnvironmentRenderer(sceneContext.environmentRoot, registry);
    this.invaders = new InvaderRenderer(sceneContext.gameRoot, registry);
    this.player = new PlayerRenderer(sceneContext.gameRoot, sceneContext.playerGlow, registry);
    this.barriers = new BarrierRenderer(sceneContext.gameRoot, registry);
    this.projectiles = new ProjectileRenderer(sceneContext.gameRoot, registry);
    this.ufo = new UfoRenderer(sceneContext.gameRoot, registry);
  }

  sync(state, elapsed) {
    this.environment.update(elapsed);
    this.invaders.sync(state, elapsed);
    this.player.sync(state.player, elapsed);
    this.barriers.sync(state.barrierCells, elapsed);
    this.projectiles.sync(state.playerProjectilePool, state.alienProjectilePool);
    this.ufo.sync(state.ufo, elapsed);
  }

  captureTrails(trailManager, state) {
    const pools = [state.playerProjectilePool, state.alienProjectilePool];
    for (let poolIndex = 0; poolIndex < pools.length; poolIndex += 1) {
      const pool = pools[poolIndex];
      for (let index = 0; index < pool.capacity; index += 1) {
        if (pool.isActive(index)) {
          trailManager.captureProjectile(pool.itemAt(index));
        }
      }
    }
  }
}
