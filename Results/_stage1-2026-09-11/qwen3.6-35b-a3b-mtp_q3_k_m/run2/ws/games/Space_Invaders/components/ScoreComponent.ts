import { HUD } from '../ui/HUD';

export class ScoreComponent {
    private score: number = 0;
    private lives: number = 3;
    private wave: number = 1;
    private comboCount: number = 0;
    private comboTimer: number = 0;
    private readonly COMBO_WINDOW: number = 2.0;
    private readonly MAX_COMBO_MULTIPLIER: number = 3.0;

    private hud: HUD | null = null;

    constructor(hud?: HUD) {
        this.hud = hud ?? null;
    }

    public getScore(): number { return this.score; }
    public getLives(): number { return this.lives; }
    public getWave(): number { return this.wave; }
    public getComboMultiplier(): number {
        if (this.comboCount === 0) return 1.0;
        const raw = 1 + this.comboCount * 0.5;
        return Math.min(raw, this.MAX_COMBO_MULTIPLIER);
    }

    public addScore(points: number, _row: number): void {
        // Combo logic
        this.comboTimer += 1 / 60; // approximate frame time
        if (this.comboTimer > this.COMBO_WINDOW) {
            this.comboCount = 0;
        }
        this.comboCount++;
        this.comboTimer = 0;

        const multiplier = this.getComboMultiplier();
        const totalPoints = Math.round(points * multiplier);
        this.score += totalPoints;

        // Extra life milestones
        if (this.score >= 5000 && this.lives < 8) {
            this.lives++;
        } else if (this.score >= 15000 && this.lives < 8) {
            this.lives++;
        } else if (this.score >= 25000 && this.lives < 8) {
            this.lives++;
        }

        if (this.hud) {
            this.hud.updateScore(this.score);
            this.hud.updateLives(this.lives);
            this.hud.updateWave(this.wave);
            this.hud.updateCombo(multiplier);
        }
    }

    public loseLife(): void {
        this.lives--;
        if (this.hud) {
            this.hud.updateLives(this.lives);
        }
    }

    public hasLives(): boolean { return this.lives > 0; }

    public nextWave(): void {
        this.wave++;
        this.comboCount = 0;
        this.comboTimer = 0;
        if (this.hud) {
            this.hud.updateWave(this.wave);
        }
    }

    public reset(): void {
        this.score = 0;
        this.lives = 3;
        this.wave = 1;
        this.comboCount = 0;
        this.comboTimer = 0;
        if (this.hud) {
            this.hud.updateScore(0);
            this.hud.updateLives(3);
            this.hud.updateWave(1);
            this.hud.updateCombo(1.0);
        }
    }

    public update(dt: number): void {
        // Combo timer decay
        if (this.comboTimer > 0) {
            this.comboTimer += dt;
            if (this.comboTimer >= this.COMBO_WINDOW) {
                this.comboCount = 0;
                this.comboTimer = 0;
            }
        }
    }
}
