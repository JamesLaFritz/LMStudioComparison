import { Alien } from './Alien.js';

const GRID_COLS = 11;
const GRID_ROWS = 5;
const SPACING_X = 1.8;
const SPACING_Y = 1.6;
const START_X = -(GRID_COLS - 1) * SPACING_X / 2;
const START_Y = 12;

// Grid movement state
const DIR_RIGHT = 1;
const DIR_LEFT = -1;

export class AlienGrid {
    constructor(scene, wave = 1) {
        this.scene = scene;
        this.wave = wave;
        this.aliens = [];
        this.direction = DIR_RIGHT;
        this.offsetX = 0;
        this.offsetY = 0;
        this.stepDown = false;
        this.aliveCount = 0;
        this.totalCount = 0;

        // Movement parameters (scale with wave)
        this.moveSpeed = 8 + wave * 1.5;
        this.dropAmount = 1.2;
        this.fireCooldown = 0;
        this.fireRate = Math.max(0.3, 1.5 - wave * 0.1);

        // Build the grid
        this._build();
    }

    _build() {
        for (let row = 0; row < GRID_ROWS; row++) {
            for (let col = 0; col < GRID_COLS; col++) {
                const alien = new Alien(row, col, this.wave);
                alien.buildMesh(this.wave);
                this.scene.add(alien.mesh);
                this.aliens.push(alien);
                this.aliveCount++;
                this.totalCount++;
            }
        }
    }

    update(dt, projectiles, onAlienFire) {
        // Count alive aliens
        this.aliveCount = 0;
        for (const alien of this.aliens) {
            if (alien.alive) this.aliveCount++;
        }

        if (this.aliveCount <= 0) return false; // Grid wiped

        // Speed up as fewer aliens remain
        const speedMult = 1 + (this.totalCount - this.aliveCount) / this.totalCount * 2;
        const effectiveSpeed = this.moveSpeed * speedMult;

        // Move grid horizontally
        this.offsetX += this.direction * effectiveSpeed * dt;

        // Check bounds — if any alive alien would go off-screen, step down
        let needStep = false;
        for (const alien of this.aliens) {
            if (!alien.alive) continue;
            const worldX = alien.homeX + this.offsetX;
            if (worldX < -12 || worldX > 12) {
                needStep = true;
                break;
            }
        }

        if (needStep) {
            // Reverse direction and step down
            this.direction *= -1;
            this.offsetY -= this.dropAmount;
        }

        // Update each alien
        for (const alien of this.aliens) {
            alien.update(dt, this.offsetX, this.offsetY);
        }

        // Check if aliens reached player level
        for (const alien of this.aliens) {
            if (!alien.alive) continue;
            if (alien.y < -5) {
                return false; // Game over — aliens breached
            }
        }

        // Alien firing
        this.fireCooldown -= dt;
        if (this.fireCooldown <= 0 && this.aliveCount > 0) {
            this.fireCooldown = this.fireRate;
            this._fireRandom(onAlienFire);
        }

        return true; // Grid still active
    }

    _fireRandom(onAlienFire) {
        // Collect alive aliens
        const alive = this.aliens.filter(a => a.alive);
        if (alive.length === 0) return;

        // Pick a random alive alien to fire
        const shooter = alive[Math.floor(Math.random() * alive.length)];
        if (onAlienFire) {
            onAlienFire(shooter.x, shooter.y);
        }
    }

    checkProjectileHit(projX, projY) {
        // Returns the alien that was hit, or null
        for (const alien of this.aliens) {
            if (!alien.alive) continue;
            const bounds = alien.getBounds();
            if (!bounds) continue;
            if (projX >= bounds.minX && projX <= bounds.maxX &&
                projY >= bounds.minY && projY <= bounds.maxY) {
                alien.destroy();
                this.aliveCount--;
                return alien;
            }
        }
        return null;
    }

    isCleared() {
        return this.aliveCount <= 0;
    }

    dispose() {
        for (const alien of this.aliens) {
            alien.dispose();
        }
        this.aliens.length = 0;
    }
}
