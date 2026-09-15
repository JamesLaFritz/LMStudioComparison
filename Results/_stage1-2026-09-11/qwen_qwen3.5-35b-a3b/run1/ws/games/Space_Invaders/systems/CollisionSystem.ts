import { MathUtils } from '../../../shared/utils/MathUtils.js';

export class CollisionSystem {
  private static readonly PROJECTILE_RADIUS = 0.15;
  private static readonly ENEMY_RADIUS = 0.4;
  private static readonly PLAYER_RADIUS = 0.6;

  /**
   * Axis-Aligned Bounding Box collision detection
   */
  static checkAABB(obj1: { position: THREE.Vector3, width: number, height: number }, 
                   obj2: { position: THREE.Vector3, width: number, height: number }): boolean {
    const halfW1 = obj1.width / 2;
    const halfH1 = obj1.height / 2;
    const halfW2 = obj2.width / 2;
    const halfH2 = obj2.height / 2;

    return !(
      obj1.position.x + halfW1 < obj2.position.x - halfW2 ||
      obj1.position.x - halfW1 > obj2.position.x + halfW2 ||
      obj1.position.y + halfH1 < obj2.position.y - halfH2 ||
      obj1.position.y - halfH1 > obj2.position.y + halfH2
    );
  }

  /**
   * Sphere collision detection using distance squared for performance
   */
  static checkSphereCollision(pos1: THREE.Vector3, radius1: number, 
                              pos2: THREE.Vector3, radius2: number): boolean {
    const dx = pos1.x - pos2.x;
    const dy = pos1.y - pos2.y;
    const dz = pos1.z - pos2.z;
    const distanceSquared = dx * dx + dy * dy + dz * dz;
    const minDistance = radius1 + radius2;
    
    return distanceSquared < minDistance * minDistance;
  }

  /**
   * Continuous collision detection (raycast) to prevent tunneling
   */
  static checkCCD(startPos: THREE.Vector3, endPos: THREE.Vector3, 
                  targetPos: THREE.Vector3, radius: number): boolean {
    const direction = new THREE.Vector3().subVectors(endPos, startPos);
    const distance = direction.length();
    
    if (distance < 0.001) return false; // No movement
    
    direction.normalize();
    
    // Project target position onto the ray
    const t = Math.max(0, new THREE.Vector3().subVectors(targetPos, startPos).dot(direction));
    
    if (t > distance) return false; // Beyond end point
    
    const closestPoint = new THREE.Vector3().addVectors(startPos, direction.clone().multiplyScalar(t));
    const distToRay = MathUtils.distanceSquared(closestPoint, targetPos);
    
    return distToRay < radius * radius;
  }

  /**
   * Check projectile-enemy collision with proper bounds checking
   */
  static checkProjectileEnemyCollision(projectile: { 
    position: THREE.Vector3, 
    isPlayerProjectile: boolean 
  }, enemy: { position: THREE.Vector3 }): boolean {
    if (projectile.isPlayerProjectile && enemy.position.y > projectile.position.y) {
      return false; // Player bullet above enemy, can't collide
    }
    
    if (!projectile.isPlayerProjectile && enemy.position.y < projectile.position.y) {
      return false; // Enemy bullet below enemy, can't collide
    }

    const dx = Math.abs(projectile.position.x - enemy.position.x);
    const dy = Math.abs(projectile.position.y - enemy.position.y);
    
    return dx < this.PROJECTILE_RADIUS + this.ENEMY_RADIUS && 
           dy < this.PROJECTILE_RADIUS + this.ENEMY_RADIUS;
  }

  /**
   * Check enemy-player collision with depth consideration
   */
  static checkEnemyPlayerCollision(enemy: { position: THREE.Vector3 }, 
                                   player: { position: THREE.Vector3 }): boolean {
    const dx = Math.abs(enemy.position.x - player.position.x);
    const dy = Math.abs(enemy.position.y - player.position.y);
    
    return dx < this.ENEMY_RADIUS + this.PLAYER_RADIUS && 
           dy < this.ENEMY_RADIUS + this.PLAYER_RADIUS;
  }

  /**
   * Check if enemy has reached bottom edge (game over condition)
   */
  static checkEnemyReachedBottom(enemy: { position: THREE.Vector3 }, threshold: number): boolean {
    return enemy.position.y > threshold;
  }

  /**
   * Check power-up collision with player
   */
  static checkPowerUpCollision(powerup: { position: THREE.Vector3, radius: number }, 
                               player: { position: THREE.Vector3 }): boolean {
    const dx = Math.abs(powerup.position.x - player.position.x);
    const dy = Math.abs(powerup.position.y - player.position.y);
    
    return dx < powerup.radius && dy < powerup.radius;
  }

  /**
   * Check UFO collision with projectiles or player
   */
  static checkUFOCollision(ufo: { position: THREE.Vector3, radius: number }, 
                           target: { position: THREE.Vector3 }): boolean {
    const dx = Math.abs(ufo.position.x - target.position.x);
    const dy = Math.abs(ufo.position.y - target.position.y);
    
    return dx < ufo.radius && dy < ufo.radius;
  }
}
