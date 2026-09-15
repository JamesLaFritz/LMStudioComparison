export class SpaceInvadersUI {
  constructor() {
    this.root = null;
    this._build();
  }

  _build() {
    this.root = document.createElement('div');
    this.root.id = 'si-ui-root';
    this.root.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:100;font-family:"Courier New",monospace;';

    // Top bar
    this.topBar = document.createElement('div');
    this.topBar.style.cssText = 'display:flex;justify-content:space-between;padding:10px 20px;backdrop-filter:blur(12px);background:rgba(10,10,30,0.6);border:1px solid rgba(0,255,255,0.2);border-radius:12px;margin:10px;';
    this.scoreEl = document.createElement('span');
    this.scoreEl.style.cssText = 'color:#00ffff;text-shadow:0 0 10px #00ffff;font-size:18px;';
    this.scoreEl.textContent = 'SCORE: 0';
    this.comboEl = document.createElement('span');
    this.comboEl.style.cssText = 'color:#ffcc00;text-shadow:0 0 10px #ffcc00;font-size:18px;';
    this.comboEl.textContent = 'COMBO: 1.0x';
    this.waveEl = document.createElement('span');
    this.waveEl.style.cssText = 'color:#00ff66;text-shadow:0 0 10px #00ff66;font-size:18px;';
    this.waveEl.textContent = 'WAVE 1';
    this.topBar.append(this.scoreEl, this.comboEl, this.waveEl);

    // Bottom bar
    this.bottomBar = document.createElement('div');
    this.bottomBar.style.cssText = 'display:flex;justify-content:space-between;align-items:center;padding:10px 20px;backdrop-filter:blur(12px);background:rgba(10,10,30,0.6);border:1px solid rgba(0,255,255,0.2);border-radius:12px;margin:10px;position:fixed;bottom:0;left:0;right:0;';
    this.hpEl = document.createElement('span');
    this.hpEl.style.cssText = 'color:#00ff66;text-shadow:0 0 10px #00ff66;font-size:18px;';
    this.hpEl.textContent = 'HP: ████████░░';
    this.powerEl = document.createElement('span');
    this.powerEl.style.cssText = 'color:#ff00ff;text-shadow:0 0 10px #ff00ff;font-size:18px;';
    this.powerEl.textContent = '';
    this.bottomBar.append(this.hpEl, this.powerEl);

    // Menu overlay
    this.menuOverlay = document.createElement('div');
    this.menuOverlay.style.cssText = 'position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;background:rgba(5,5,20,0.85);backdrop-filter:blur(8px);';
    this.menuOverlay.id = 'si-menu';
    const title = document.createElement('h1');
    title.textContent = 'SPACE INVADERS';
    title.style.cssText = 'color:#00ffff;text-shadow:0 0 20px #00ffff,0 0 40px #00ffff;font-size:48px;margin-bottom:20px;';
    const subtitle = document.createElement('p');
    subtitle.textContent = 'PRESS FIRE TO START';
    subtitle.style.cssText = 'color:#ffcc00;text-shadow:0 0 10px #ffcc00;font-size:20px;animation:pulse 2s infinite;';
    const controls = document.createElement('p');
    controls.textContent = 'WASD/Arrows: Move | Space/Fire: Shoot';
    controls.style.cssText = 'color:#888;font-size:14px;margin-top:30px;';
    this.menuOverlay.append(title, subtitle, controls);

    // Game over overlay
    this.gameOverOverlay = document.createElement('div');
    this.gameOverOverlay.style.cssText = 'position:absolute;inset:0;display:none;flex-direction:column;align-items:center;justify-content:center;background:rgba(5,5,20,0.9);backdrop-filter:blur(8px);';
    this.gameOverOverlay.id = 'si-gameover';
    const goTitle = document.createElement('h1');
    goTitle.textContent = 'GAME OVER';
    goTitle.style.cssText = 'color:#ff0044;text-shadow:0 0 20px #ff0044;font-size:48px;margin-bottom:20px;';
    this.finalScoreEl = document.createElement('p');
    this.finalScoreEl.style.cssText = 'color:#00ffff;text-shadow:0 0 10px #00ffff;font-size:24px;';
    this.highScoreEl = document.createElement('p');
    this.highScoreEl.style.cssText = 'color:#ffcc00;text-shadow:0 0 10px #ffcc00;font-size:18px;';
    const restart = document.createElement('p');
    restart.textContent = 'PRESS FIRE TO CONTINUE';
    restart.style.cssText = 'color:#ffcc00;text-shadow:0 0 10px #ffcc00;font-size:20px;margin-top:20px;';
    this.gameOverOverlay.append(goTitle, this.finalScoreEl, this.highScoreEl, restart);

    // Pause overlay
    this.pauseOverlay = document.createElement('div');
    this.pauseOverlay.style.cssText = 'position:absolute;inset:0;display:none;flex-direction:column;align-items:center;justify-content:center;background:rgba(5,5,20,0.7);backdrop-filter:blur(4px);';
    const pauseText = document.createElement('h1');
    pauseText.textContent = 'PAUSED';
    pauseText.style.cssText = 'color:#00ffff;text-shadow:0 0 20px #00ffff;font-size:48px;';
    const resume = document.createElement('p');
    resume.textContent = 'PRESS ESC TO RESUME';
    resume.style.cssText = 'color:#888;font-size:18px;margin-top:10px;';
    this.pauseOverlay.append(pauseText, resume);

    // Wave transition overlay
    this.waveOverlay = document.createElement('div');
    this.waveOverlay.style.cssText = 'position:absolute;inset:0;display:none;flex-direction:column;align-items:center;justify-content:center;background:rgba(5,5,20,0.6);';
    this.waveText = document.createElement('h1');
    this.waveText.style.cssText = 'color:#00ff66;text-shadow:0 0 20px #00ff66;font-size:48px;';

    // Pulse animation
    const style = document.createElement('style');
    style.textContent = '@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}';
    this.root.append(style, this.topBar, this.bottomBar, this.menuOverlay, this.gameOverOverlay, this.pauseOverlay, this.waveOverlay);
  }

  mount(parent) {
    parent.appendChild(this.root);
  }

  hide() {
    if (this.root && this.root.parentNode) {
      this.root.parentNode.removeChild(this.root);
    }
  }

  setState(state) {
    this.menuOverlay.style.display = state === 'MENU' ? 'flex' : 'none';
    this.gameOverOverlay.style.display = state === 'GAME_OVER' ? 'flex' : 'none';
    this.pauseOverlay.style.display = state === 'PAUSED' ? 'flex' : 'none';
    this.topBar.style.display = (state === 'PLAYING' || state === 'PAUSED') ? 'flex' : 'none';
    this.bottomBar.style.display = (state === 'PLAYING' || state === 'PAUSED') ? 'flex' : 'none';
  }

  updateScore(score, combo, wave) {
    this.scoreEl.textContent = `SCORE: ${score.toLocaleString()}`;
    this.comboEl.textContent = `COMBO: ${combo.toFixed(1)}x`;
    this.waveEl.textContent = `WAVE ${wave}`;
  }

  updateHealth(hp, maxHp) {
    const filled = Math.round((hp / maxHp) * 10);
    const empty = 10 - filled;
    this.hpEl.textContent = `HP: ${'█'.repeat(filled)}${'░'.repeat(empty)}`;
  }

  updatePower(text) {
    this.powerEl.textContent = text;
  }

  showGameOver(score) {
    this.finalScoreEl.textContent = `FINAL SCORE: ${score.toLocaleString()}`;
    const high = parseInt(localStorage.getItem('si_highScore') || '0');
    if (score > high) {
      localStorage.setItem('si_highScore', score);
      this.highScoreEl.textContent = 'NEW HIGH SCORE!';
    } else {
      this.highScoreEl.textContent = `HIGH SCORE: ${high.toLocaleString()}`;
    }
  }

  showWave(wave) {
    this.waveText.textContent = `WAVE ${wave}`;
    this.waveOverlay.style.display = 'flex';
    setTimeout(() => { this.waveOverlay.style.display = 'none'; }, 2000);
  }
}