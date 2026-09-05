import { SHIELD_CONFIG } from '../utils/Constants.js';

export class ShieldCell {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.hp = SHIELD_CONFIG.CELL_HP;
        this.active = true;
    }

    hit() {
        if (!this.active) return false;
        this.hp--;
        if (this.hp <= 0) {
            this.active = false;
            return true;
        }
        return false;
    }
}

export class Shield {
    constructor() {
        this.cells = [];
        this.bars = SHIELD_CONFIG.BARRIERS;
        for (let b = 0; b < this.bars; b++) {
            const barX = SHIELD_CONFIG.BARRIER_X_OFFSETS[b];
            for (let row = 0; row < SHIELD_CONFIG.ROWS; row++) {
                for (let col = 0; col < SHIELD_CONFIG.COLS; col++) {
                    const centerX = Math.floor(SHIELD_CONFIG.COLS / 2) - 1;
                    const gapWidth = 3;
                    if (row === 0 && Math.abs(col - centerX) <= gapWidth) continue;
                    this.cells.push(new ShieldCell(barX + col, row));
                }
            }
        }
    }

    checkAndDamageBullet(bulletX, bulletY) {
        const cellSize = SHIELD_CONFIG.CELL_SIZE;
        for (let i = 0; i < this.cells.length; i++) {
            const cell = this.cells[i];
            if (!cell.active) continue;
            const dx = Math.abs(bulletX - cell.x);
            const dy = Math.abs(bulletY - cell.y);
            if (dx < cellSize && dy < cellSize) {
                cell.hit();
                return true;
            }
        }
        return false;
    }

    reset() {
        for (const cell of this.cells) {
            cell.hp = SHIELD_CONFIG.CELL_HP;
            cell.active = true;
        }
    }

    update(_dt) {
        // Shield cells are static, no per-frame update needed
    }

    getCells() {
        return this.cells;
    }

    getCellCount() {
        return this.cells.length;
    }
}
