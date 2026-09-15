import { Engine } from '@shared/Engine';

export class HUD {
    private container: HTMLDivElement;
    private scoreEl: HTMLElement;
    private livesEl: HTMLElement;
    private waveEl: HTMLElement;
    private comboEl: HTMLElement;
    private gameOverEl: HTMLElement | null = null;
    private restartBtn: HTMLButtonElement | null = null;

    constructor(private engine: Engine) {
        this.container = document.createElement('div');
        this.container.className = 'hud-container';
        this.build();
    }

    private build(): void {
        this.container.innerHTML = `
            <div class="hud-top">
                <div class="hud-item hud-score">
                    <span class="hud-label">SCORE</span>
                    <span id="score-value" class="hud-value neon-cyan">0</span>
                </div>
                <div class="hud-item hud-wave">
                    <span class="hud-label">WAVE</span>
                    <span id="wave-value" class="hud-value neon-magenta">1</span>
                </div>
            </div>
            <div class="hud-bottom">
                <div class="hud-item hud-lives">
                    <span class="hud-label">LIVES</span>
                    <div id="lives-display" class="hud-value"></div>
                </div>
                <div class="hud-item hud-combo">
                    <span class="hud-label">COMBO</span>
                    <span id="combo-value" class="hud-value neon-yellow">x1.0</span>
                </div>
            </div>
        `;

        this.scoreEl = this.container.querySelector('#score-value')!;
        this.livesEl = this.container.querySelector('#lives-display')!;
        this.waveEl = this.container.querySelector('#wave-value')!;
        this.comboEl = this.container.querySelector('#combo-value')!;

        this.engine.domContainer.appendChild(this.container);
    }

    public updateScore(score: number): void {
        this.scoreEl.textContent = score.toString().padStart(6, '0');
    }

    public updateLives(lives: number): void {
        let html = '';
        for (let i = 0; i < lives; i++) {
            html += '<span class="life-pip">▲</span>';
        }
        this.livesEl.innerHTML = html;
    }

    public updateWave(wave: number): void {
        this.waveEl.textContent = wave.toString();
    }

    public updateCombo(multiplier: number): void {
        this.comboEl.textContent = `x${multiplier.toFixed(1)}`;
        if (multiplier > 1.0) {
            this.comboEl.classList.add('combo-active');
        } else {
            this.comboEl.classList.remove('combo-active');
        }
    }

    public showGameOver(finalScore: number): void {
        if (this.gameOverEl) return;

        this.gameOverEl = document.createElement('div');
        this.gameOverEl.className = 'game-over-overlay';
        this.gameOverEl.innerHTML = `
            <div class="glass-panel">
                <h1 class="title-glitch" data-text="GAME OVER">GAME OVER</h1>
                <p class="final-score">FINAL SCORE: ${finalScore}</p>
                <button id="restart-btn" class="neon-button">RESTART</button>
            </div>
        `;

        this.restartBtn = this.gameOverEl.querySelector('#restart-btn')!;
        this.restartBtn.addEventListener('click', () => {
            if (this.gameOverEl) {
                this.engine.domContainer.removeChild(this.gameOverEl);
                this.gameOverEl = null;
                this.restartBtn = null;
            }
            this.onRestart?.();
        });

        this.engine.domContainer.appendChild(this.gameOverEl);
    }

    public showWaveTransition(wave: number): void {
        const overlay = document.createElement('div');
        overlay.className = 'wave-transition-overlay';
        overlay.innerHTML = `
            <div class="glass-panel">
                <h1 class="wave-title">WAVE ${wave}</h1>
            </div>
        `;
        this.engine.domContainer.appendChild(overlay);

        setTimeout(() => {
            if (overlay.parentNode) {
                overlay.classList.add('fade-out');
                setTimeout(() => {
                    if (overlay.parentNode) {
                        this.engine.domContainer.removeChild(overlay);
                    }
                }, 800);
            }
        }, 1500);
    }

    public setOnRestart(callback: () => void): void {
        this.onRestart = callback;
    }

    private onRestart?: () => void;

    public dispose(): void {
        if (this.gameOverEl && this.gameOverEl.parentNode) {
            this.engine.domContainer.removeChild(this.gameOverEl);
            this.gameOverEl = null;
        }
        if (this.container.parentNode) {
            this.engine.domContainer.removeChild(this.container);
        }
    }
}
