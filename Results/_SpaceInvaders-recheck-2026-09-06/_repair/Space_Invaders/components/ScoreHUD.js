/**
 * ScoreHUD — Glassmorphism score/lives display overlay.
 * Renders DOM-based HUD with neon glow accents, lives pips, and wave indicator.
 */

export class ScoreHUD {
  constructor(container) {
    this.container = container;
    this.score = 0;
    this.lives = 3;
    this.wave = 1;
    this.highScore = parseInt(localStorage.getItem('si_highscore') || '0', 10);

    this._buildDOM();
  }

  _buildDOM() {
    // Main HUD bar — glassmorphism panel at top of viewport
    const hud = document.createElement('div');
    hud.className = 'hud-bar';
    hud.innerHTML = `
      <div class="hud-section hud-left">
        <span class="hud-label">SCORE</span>
        <span class="hud-value" id="score-display">0</span>
      </div>
      <div class="hud-section hud-center">
        <span class="hud-wave" id="wave-display">WAVE 1</span>
      </div>
      <div class="hud-section hud-right">
        <span class="hud-label">LIVES</span>
        <span class="hud-lives" id="lives-display"></span>
      </div>
    `;

    // High score display below main bar
    const hs = document.createElement('div');
    hs.className = 'hud-highscore';
    hs.innerHTML = `<span>HIGH SCORE: <strong id="highscore-display">${this.highScore.toLocaleString()}</strong></span>`;

    this.container.appendChild(hud);
    this.container.appendChild(hs);

    // Game over overlay (hidden by default)
    const goOverlay = document.createElement('div');
    goOverlay.className = 'game-over-overlay';
    goOverlay.id = 'game-over-overlay';
    goOverlay.innerHTML = `
      <div class="game-over-panel">
        <h1 class="go-title">GAME OVER</h1>
        <p class="go-score" id="final-score"></p>
        <p class="go-highscore" id="final-highscore"></p>
        <button class="go-button" id="restart-button">PLAY AGAIN</button>
      </div>
    `;

    this.container.appendChild(goOverlay);

    // Wave announcement overlay (hidden by default)
    const waveOverlay = document.createElement('div');
    waveOverlay.className = 'wave-announce-overlay';
    waveOverlay.id = 'wave-announce-overlay';
    waveOverlay.innerHTML = `
      <div class="wave-announce-panel">
        <h1 class="wa-title" id="wave-announce-text"></h1>
      </div>
    `;

    this.container.appendChild(waveOverlay);

    // Cache DOM references
    this.scoreEl = hud.querySelector('#score-display');
    this.livesEl = hud.querySelector('#lives-display');
    this.waveEl = hud.querySelector('#wave-display');
    this.highScoreEl = hs.querySelector('#highscore-display');
    this.gameOverOverlay = goOverlay;
    this.finalScoreEl = goOverlay.querySelector('#final-score');
    this.finalHighScoreEl = goOverlay.querySelector('#final-highscore');
    this.restartButton = goOverlay.querySelector('#restart-button');
    this.waveAnnounceOverlay = waveOverlay;
    this.waveAnnounceText = waveOverlay.querySelector('#wave-announce-text');

    this._updateLives();
  }

  updateScore(points) {
    this.score += points;
    this.scoreEl.textContent = this.score.toLocaleString();

    if (this.score > this.highScore) {
      this.highScore = this.score;
      this.highScoreEl.textContent = this.highScore.toLocaleString();
      localStorage.setItem('si_highscore', String(this.highScore));
    }
  }

  updateLives(lives) {
    this.lives = lives;
    this._updateLives();
  }

  _updateLives() {
    let pips = '';
    for (let i = 0; i < this.lives; i++) {
      pips += '<span class="life-pip"></span>';
    }
    this.livesEl.innerHTML = pips;
  }

  updateWave(wave) {
    this.wave = wave;
    this.waveEl.textContent = `WAVE ${wave}`;
  }

  showGameOver(finalScore) {
    this.finalScoreEl.textContent = `FINAL SCORE: ${finalScore.toLocaleString()}`;
    this.finalHighScoreEl.textContent = `HIGH SCORE: ${this.highScore.toLocaleString()}`;
    this.gameOverOverlay.style.display = 'flex';
  }

  hideGameOver() {
    this.gameOverOverlay.style.display = 'none';
  }

  showWaveAnnouncement(waveNum) {
    this.waveAnnounceText.textContent = `WAVE ${waveNum}`;
    this.waveAnnounceOverlay.classList.add('visible');

    setTimeout(() => {
      this.waveAnnounceOverlay.classList.remove('visible');
    }, 2000);
  }

  restartListener(fn) {
    this.restartButton.addEventListener('click', fn);
  }

  destroy() {
    // Remove all HUD elements from container
    while (this.container.firstChild) {
      this.container.removeChild(this.container.firstChild);
    }
  }
}
