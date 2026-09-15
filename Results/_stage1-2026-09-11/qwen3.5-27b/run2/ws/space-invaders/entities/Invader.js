import * as THREE from 'three';
import { AABB } from '../../shared/utils/AABB.js';

/**
 * Individual Invader entity - represents one alien in the grid
 */
export class Invader {
    constructor(type, row, col, x, y) {
        this.type = type; // 0=Octopus, 1=Crab, 2=Squid
        this.row = row;
        this.col = col;
        
        this.x = x;
        this.y = y;
        this.width = 2.0;
        this.height = 1.5;
        
        this.alive = true;
        this.flashTimer = 0;
        this.flashActive = false;
        
        // AABB for collision
        this.aabb = new AABB();
        this.updateAABB();
        
        // Points value based on type
        this.points = this.getPointsForType(type);
    }

    getPointsForType(type) {
        switch (type) {
            case 0: return 10; // Octopus - bottom row
            case 1: return 20; // Crab - middle rows
            case 2: return 30; // Squid - top rows
            default: return 10;
        }
    }

    getColorForType() {
        switch (this.type) {
            case 0: return 0xFFE66D; // Yellow-orange for Octopus
            case 1: return 0x4ECDC4; // Teal for Crab
            case 2: return 0xFF6B9D; // Pink for Squid
            default: return 0xFFFFFF;
        }
    }

    updateAABB() {
        this.aabb.set(
            this.x - this.width / 2,
            this.y - this.height / 2,
            this.x + this.width / 2,
            this.y + this.height / 2
        );
    }

    move(dx, dy) {
        this.x += dx;
        this.y += dy;
        this.updateAABB();
    }

    setFlash(active) {
        this.flashActive = active;
        if (active) {
            this.flashTimer = 0.3; // Flash for 0.3 seconds
        }
    }

    update(delta) {
        if (this.flashActive) {
            this.flashTimer -= delta;
            if (this.flashTimer <= 0) {
                this.flashActive = false;
            }
        }
    }

    isFlashing() {
        return this.flashActive && Math.floor(this.flashTimer * 10) % 2 === 0;
    }

    die() {
        this.alive = false;
    }

    // Get current visual color (flashes white when about to fire)
    getCurrentColor() {
        if (this.isFlashing()) {
            return 0xFFFFFF;
        }
        return this.getColorForType();
    }
}
