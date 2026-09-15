/**
 * Enemy Formation Generator - Creates enemy formations for each level
 */
class EnemyFormationGenerator {
    constructor() {
        this.formations = [
            // Level 1: Basic formation (5 rows, 8 columns)
            [[-15, 20], [-11, 20], [-7, 20], [-3, 20], [1, 20], [5, 20], [9, 20], [13, 20]],
            // Level 2: Two rows formation (4 rows, 6 columns)
            [[-15, 20], [-11, 20], [-7, 20], [-3, 20], [1, 20], [5, 20]],
            // Level 3: Zigzag formation (3 rows, 4 columns)
            [[-15, 20], [-11, 20], [-7, 20]]
        ];
    }

    getFormation(level) {
        const levelIndex = Math.min(level - 1, this.formations.length);
        
        // Return formation based on level (higher levels = more enemies)
        if (level <= 3) {
            return this.formations[0];
        } else if (level <= 6) {
            return this.formations[1];
        } else {
            return this.formations[2];
        }
    }

    getFormationSize(level) {
        const levelIndex = Math.min(level - 1, this.formations.length);
        
        // Return formation dimensions based on level (higher levels = more enemies)
        if (level <= 3) {
            return { rows: 5, cols: 8 };
        } else if (level <= 6) {
            return { rows: 4; cols: 6 };
        } else {
            return { rows: 3; cols: 4 };
        }
    }

    getEnemyHealth(level) {
        // Higher levels = more health for enemies
        return Math.min(1 + (level - 1), 5);
    }

    getEnemySpeed(level) {
        // Higher levels = faster movement speed
        return Math.min(2 + (level - 1) * 0.3, 4);
    }
}

export default EnemyFormationGenerator;
