import { Vector3 } from 'three';

export interface ScoreData {
    score: number;
    highScore: number;
    comboMultiplier: number;
    comboTimer: number;
}

export class ScoreSystem {
    private score: number = 0;
    private highScore: number = 0;
    private comboMultiplier: number = 1;
    private comboTimer: number = 0;
    private readonly COMBO_WINDOW: number = 3.0; // seconds
    private readonly MAX_COMBO: number = 5;

    constructor() {
        this.highScore = this.loadHighScore();
    }

    public addScore(points: number, comboBonus: boolean = true): void {
        if (comboBonus) {
            points *= this.comboMultiplier;
        }
        
        this.score += points;
        
        // Start or extend combo
        this.comboTimer = this.COMBO_WINDOW;
        this.comboMultiplier = Math.min(this.MAX_COMBO, this.comboMultiplier + 1);
        
        this.saveHighScore();
    }

    public update(deltaTime: number): void {
        if (this.comboTimer > 0) {
            this.comboTimer -= deltaTime;
            if (this.comboTimer <= 0) {
                this.comboMultiplier = 1;
            }
        }
    }

    public getScore(): number {
        return this.score;
    }

    public getHighScore(): number {
        return this.highScore;
    }

    public getComboMultiplier(): number {
        return this.comboMultiplier;
    }

    public reset(): void {
        this.score = 0;
        this.comboMultiplier = 1;
        this.comboTimer = 0;
    }

    private loadHighScore(): number {
        try {
            const stored = localStorage.getItem('space_invaders_highscore');
            return stored ? parseInt(stored, 10) : 0;
        } catch (e) {
            return 0;
        }
    }

    private saveHighScore(): void {
        if (this.score > this.highScore) {
            this.highScore = this.score;
            try {
                localStorage.setItem('space_invaders_highscore', this.highScore.toString());
            } catch (e) {
                // Storage full or disabled, ignore
            }
        }
    }

    public getRowPoints(row: number): number {
        // Row 0 = top = 30pts, Row 1 = 20pts, Rows 2-4 = 10pts
        if (row === 0) return 30;
        if (row === 1) return 20;
        return 10;
    }

    public getEnemyPoints(enemyType: EnemyType): number {
        switch (enemyType) {
            case EnemyType.GRUNT:
                return this.getRowPoints(4); // Bottom row base
            case EnemyType.ELITE:
                return 25;
            case EnemyType.BOSS:
                return 100;
            default:
                return 10;
        }
    }

    public getComboDisplay(): string {
        if (this.comboMultiplier > 1) {
            return `x${this.comboMultiplier}`;
        }
        return '';
    }
}

export enum EnemyType {
    GRUNT = 'grunt',
    ELITE = 'elite',
    BOSS = 'boss'
}