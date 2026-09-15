/**
 * CollisionSystem - AABB collision detection for Space Invaders
 * Handles all entity-to-entity collision checks with proper bounding box calculations
 */

import { AABB } from '../../shared/utils/AABB.js';

export class CollisionSystem {
    constructor() {
        this.tempAABB = new AABB();
    }

    /**
     * Check if a bullet has hit any invader in the grid
     * @param {Bullet} bullet - The player's projectile
     * @param {Array<Invader>} invaders - Array of active invaders
     * @returns {{hit: boolean, invader: Invader|null}} Result with hit status and target
     */
    checkBulletVsInvaders(bullet, invaders) {
        const bulletAABB = this.getBulletAABB(bullet);
        
        for (const invader of invaders) {
            if (!invader.active) continue;
            
            const invaderAABB = this.getInvaderAABB(invader);
            
            if (this.aabbIntersects(bulletAABB, invaderAABB)) {
                return { hit: true, invader };
            }
        }
        
        return { hit: false, invader: null };
    }

    /**
     * Check if a bomb has hit the player
     * @param {Bomb} bomb - The enemy's projectile
     * @param {Player} player - The player entity
     * @returns {boolean} True if collision detected
     */
    checkBombVsPlayer(bomb, player) {
        const bombAABB = this.getBombAABB(bomb);
        const playerAABB = this.getPlayerAABB(player);
        
        return this.aabbIntersects(bombAABB, playerAABB);
    }

    /**
     * Check if any invader has reached the player's level (game over condition)
     * @param {Array<Invader>} invaders - Array of active invaders
     * @param {number} playerY - Player's Y position threshold
     * @returns {{hit: boolean, invader: Invader|null}} Result with hit status
     */
    checkInvaderVsPlayerLevel(invaders, playerY) {
        for (const invader of invaders) {
            if (!invader.active) continue;
            
            const invaderAABB = this.getInvaderAABB(invader);
            
            // Check if invader's bottom has reached or passed player level
            if (invaderAABB.min.y <= playerY + 1.5) {
                return { hit: true, invader };
            }
        }
        
        return { hit: false, invader: null };
    }

    /**
     * Check if a bullet has hit a UFO
     * @param {Bullet} bullet - The player's projectile
     * @param {UFO} ufo - The bonus UFO entity
     * @returns {boolean} True if collision detected
     */
    checkBulletVsUFO(bullet, ufo) {
        if (!ufo || !ufo.active) return false;
        
        const bulletAABB = this.getBulletAABB(bullet);
        const ufoAABB = this.getUFOAABB(ufo);
        
        return this.aabbIntersects(bulletAABB, ufoAABB);
    }

    /**
     * Check if a bomb has hit a UFO (destroying it)
     * @param {Bomb} bomb - The enemy's projectile
     * @param {UFO} ufo - The bonus UFO entity
     * @returns {boolean} True if collision detected
     */
    checkBombVsUFO(bomb, ufo) {
        if (!ufo || !ufo.active) return false;
        
        const bombAABB = this.getBombAABB(bomb);
        const ufoAABB = this.getUFOAABB(ufo);
        
        return this.aabbIntersects(bombAABB, ufoAABB);
    }

    /**
     * Check if player has collected a power-up
     * @param {Player} player - The player entity
     * @param {PowerUp} powerUp - The collectible power-up
     * @returns {boolean} True if collision detected
     */
    checkPlayerVsPowerUp(player, powerUp) {
        if (!powerUp || !powerUp.active) return false;
        
        const playerAABB = this.getPlayerAABB(player);
        const powerUpAABB = this.getPowerUpAABB(powerUp);
        
        // Use slightly larger collision for easier collection
        const expandedPlayerAABB = playerAABB.clone();
        expandedPlayerAABB.expand(0.5);
        
        return this.aabbIntersects(expandedPlayerAABB, powerUpAABB);
    }

    /**
     * Check if a bullet has hit the shield barrier
     * @param {Bullet} bullet - The player's projectile (friendly fire check)
     * @param {THREE.Vector3} shieldCenter - Shield position
     * @param {number} shieldRadius - Shield radius
     * @returns {boolean} True if collision detected
     */
    checkBulletVsShield(bullet, shieldCenter, shieldRadius) {
        const bulletPos = bullet.mesh.position;
        const distance = Math.sqrt(
            Math.pow(bulletPos.x - shieldCenter.x, 2) +
            Math.pow(bulletPos.y - shieldCenter.y, 2)
        );
        
        return distance < shieldRadius + 0.3;
    }

    // AABB Generation Methods
    
    getBulletAABB(bullet) {
        const pos = bullet.mesh.position;
        const size = new THREE.Vector3(0.4, 1.5, 0.4);
        
        return new AABB(
            pos.x - size.x / 2, pos.y - size.y / 2, pos.z - size.z / 2,
            pos.x + size.x / 2, pos.y + size.y / 2, pos.z + size.z / 2
        );
    }

    getBombAABB(bomb) {
        const pos = bomb.mesh.position;
        const size = new THREE.Vector3(0.5, 0.8, 0.5);
        
        return new AABB(
            pos.x - size.x / 2, pos.y - size.y / 2, pos.z - size.z / 2,
            pos.x + size.x / 2, pos.y + size.y / 2, pos.z + size.z / 2
        );
    }

    getPlayerAABB(player) {
        const pos = player.mesh.position;
        // Player ship is approximately 3 units wide, 2 units tall
        const size = new THREE.Vector3(3, 2, 1);
        
        return new AABB(
            pos.x - size.x / 2, pos.y - size.y / 2, pos.z - size.z / 2,
            pos.x + size.x / 2, pos.y + size.y / 2, pos.z + size.z / 2
        );
    }

    getInvaderAABB(invader) {
        const pos = invader.mesh.position;
        // Invaders are approximately 2.5 units wide, 1.8 units tall
        const size = new THREE.Vector3(2.5, 1.8, 1);
        
        return new AABB(
            pos.x - size.x / 2, pos.y - size.y / 2, pos.z - size.z / 2,
            pos.x + size.x / 2, pos.y + size.y / 2, pos.z + size.z / 2
        );
    }

    getUFOAABB(ufo) {
        const pos = ufo.mesh.position;
        // UFO is approximately 4 units wide, 2 units tall
        const size = new THREE.Vector3(4, 2, 1.5);
        
        return new AABB(
            pos.x - size.x / 2, pos.y - size.y / 2, pos.z - size.z / 2,
            pos.x + size.x / 2, pos.y + size.y / 2, pos.z + size.z / 2
        );
    }

    getPowerUpAABB(powerUp) {
        const pos = powerUp.mesh.position;
        // Power-ups are approximately 1 unit in all dimensions
        const size = new THREE.Vector3(1, 1, 1);
        
        return new AABB(
            pos.x - size.x / 2, pos.y - size.y / 2, pos.z - size.z / 2,
            pos.x + size.x / 2, pos.y + size.y / 2, pos.z + size.z / 2
        );
    }

    // Core AABB Intersection Method
    
    /**
     * Check if two AABBs intersect
     * @param {AABB} a - First bounding box
     * @param {AABB} b - Second bounding box
     * @returns {boolean} True if boxes overlap
     */
    aabbIntersects(a, b) {
        return (
            a.min.x <= b.max.x && a.max.x >= b.min.x &&
            a.min.y <= b.max.y && a.max.y >= b.min.y &&
            a.min.z <= b.max.z && a.max.z >= b.min.z
        );
    }

    /**
     * Get the overlap amount between two AABBs (for physics response)
     * @param {AABB} a - First bounding box
     * @param {AABB} b - Second bounding box
     * @returns {{overlap: THREE.Vector3, axis: string}} Overlap info
     */
    getOverlap(a, b) {
        const overlapX = Math.min(a.max.x, b.max.x) - Math.max(a.min.x, b.min.x);
        const overlapY = Math.min(a.max.y, b.max.y) - Math.max(a.min.y, b.min.y);
        const overlapZ = Math.min(a.max.z, b.max.z) - Math.max(a.min.z, b.min.z);
        
        const overlap = new THREE.Vector3(overlapX, overlapY, overlapZ);
        
        // Find smallest penetration axis for collision response
        let minOverlap = Infinity;
        let axis = 'x';
        
        if (Math.abs(overlap.x) < minOverlap) { minOverlap = Math.abs(overlap.x); axis = 'x'; }
        if (Math.abs(overlap.y) < minOverlap) { minOverlap = Math.abs(overlap.y); axis = 'y'; }
        if (Math.abs(overlap.z) < minOverlap) { minOverlap = Math.abs(overlap.z); axis = 'z'; }
        
        return { overlap, axis };
    }

    /**
     * Check sphere-AABB intersection (for shield collision)
     * @param {THREE.Vector3} sphereCenter - Center of the sphere
     * @param {number} sphereRadius - Radius of the sphere
     * @param {AABB} aabb - The bounding box to check against
     * @returns {boolean} True if intersection detected
     */
    sphereIntersectsAABB(sphereCenter, sphereRadius, aabb) {
        // Find closest point on AABB to sphere center
        const closestX = Math.max(aabb.min.x, Math.min(sphereCenter.x, aabb.max.x));
        const closestY = Math.max(aabb.min.y, Math.min(sphereCenter.y, aabb.max.y));
        const closestZ = Math.max(aabb.min.z, Math.min(sphereCenter.z, aabb.max.z));
        
        const closestPoint = new THREE.Vector3(closestX, closestY, closestZ);
        const distanceSquared = sphereCenter.distanceToSquared(closestPoint);
        
        return distanceSquared <= sphereRadius * sphereRadius;
    }

    /**
     * Clean up temporary AABB instances to prevent memory leaks
     */
    dispose() {
        if (this.tempAABB) {
            this.tempAABB = null;
        }
    }
}

export default CollisionSystem;
