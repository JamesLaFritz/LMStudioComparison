import { GAME_CONFIG } from '@space/GameConfig.js';
import { clamp, moveToward } from '@shared/math/Math2D.js';

export function updatePlayer(state, input, delta) {
  const player = state.player;
  player.previousX = player.x;
  player.fireRequested = false;
  if (!player.alive) {
    return;
  }

  player.fireCooldown = Math.max(0, player.fireCooldown - delta);
  player.invulnerability = Math.max(0, player.invulnerability - delta);
  const desiredVelocity = input.value('move') * GAME_CONFIG.player.maxSpeed;
  const acceleration = Math.abs(desiredVelocity) > Math.abs(player.velocityX)
    ? GAME_CONFIG.player.acceleration
    : GAME_CONFIG.player.braking;
  player.velocityX = moveToward(player.velocityX, desiredVelocity, acceleration * delta);
  player.x = clamp(
    player.x + player.velocityX * delta,
    GAME_CONFIG.world.left + player.halfWidth,
    GAME_CONFIG.world.right - player.halfWidth,
  );

  if (input.value('fire') && player.fireCooldown <= 0) {
    player.fireRequested = true;
    player.fireCooldown = GAME_CONFIG.player.fireCooldown;
  }
}
