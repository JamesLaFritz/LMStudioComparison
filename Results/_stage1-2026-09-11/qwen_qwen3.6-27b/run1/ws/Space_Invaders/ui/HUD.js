/**
 * HUD — Glassmorphism overlay for Space Invaders.
 * Renders score, lives, wave, and state messages via a DOM overlay.
 */
export class HUD {
    constructor(canvas) {
        this.canvas = canvas;
        this.score = 0;
        this.lives = 3;
        this.wave = 1;
        this._el = null;
        this._scoreEl = null;
        this._livesEl = null;
        this._waveEl = null;
        this._messageEl = null;
        this._build();
    }

    _build() {
        // Main overlay container
        this._el = document.createElement('div');
        this._el.id = 'hud';
        this._el.style.cssText = `
            position: absolute; top: 0; left: 0; width: 100%; height: 100%;
            pointer-events: none; font-family: 'Courier New', monospace;
            color: #00ffff; text-shadow: 0 0 8px #00ffff;
            z-index: 10;
        `;

        // Top bar
        const topBar = document.createElement('div');
        topBar.style.cssText = `
            display: flex; justify-content: space-between; align-items: center;
            padding: 16px 24px;
            background: rgba(5, 5, 16, 0.45);
            backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
            border-bottom: 1px solid rgba(0, 255, 255, 0.15);
        `;

        this._scoreEl = document.createElement('span');
        this._scoreEl.textContent = 'SCORE: 0';
        this._scoreEl.style.cssText = 'font-size: 20px; font-weight: bold; letter-spacing: 2px;';

        this._waveEl = document.createElement('span');
        this._waveEl.textContent = 'WAVE 1';
        this._waveEl.style.cssText = 'font-size: 18px; letter-spacing: 2px;';

        this._livesEl = document.createElement('span');
        this._livesEl.textContent = '♥♥♥';
        this._livesEl.style.cssText = 'font-size: 20px; letter-spacing: 4px;';

        topBar.appendChild(this._scoreEl);
        topBar.appendChild(this._waveEl);
        topBar.appendChild(this._livesEl);
        this._el.appendChild(topBar);

        // Center message area
        this._messageEl = document.createElement('div');
        this._messageEl.style.cssText = `
            position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
            text-align: center; font-size: 32px; font-weight: bold;
            letter-spacing: 4px; opacity: 0; transition: opacity 0.3s;
        `;
        this._el.appendChild(this._messageEl);

        this.canvas.parentElement.appendChild(this._el);
    }

    setScore(score) {
        this.score = score;
        this._scoreEl.textContent = 'SCORE: ' + score;
    }

    addScore(points) {
        this.score += points;
        this._scoreEl.textContent = 'SCORE: ' + this.score;
    }

    setLives(lives) {
        this.lives = lives;
        this._livesEl.textContent = '♥'.repeat(Math.max(0, lives));
    }

    setWave(wave) {
        this.wave = wave;
        this._waveEl.textContent = 'WAVE ' + wave;
    }

    showMessage(text, duration) {
        this._messageEl.textContent = text;
        this._messageEl.style.opacity = '1';
        if (duration) {
            setTimeout(() => {
                this._messageEl.style.opacity = '0';
            }, duration);
        }
    }

    hideMessage() {
        this._messageEl.style.opacity = '0';
    }

    showGameOver() {
        this._messageEl.innerHTML = 'GAME OVER<br><span style="font-size:18px">Press ENTER to restart</span>';
        this._messageEl.style.opacity = '1';
    }

    showReady() {
        this.showMessage('READY', 1500);
    }

    showWaveComplete() {
        this.showMessage('WAVE COMPLETE', 2000);
    }

    dispose() {
        if (this._el && this._el.parentElement) {
            this._el.parentElement.removeChild(this._el);
        }
    }
}
