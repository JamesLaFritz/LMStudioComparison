import { UIManager } from '../../../shared/ui/UIManager.js';

export class GameUI {
  constructor(uiManager) {
    this.uiManager = uiManager;
    this.scoreEl = null;
    this.livesEl = null;
    this.waveEl = null;
    this.powerUpEl = null;
    this.startScreen = null;
    this.gameOverScreen = null;
    this.victoryScreen = null;
  }

  init(container) {
    // Create HUD overlay
    const hud = document.createElement('div');
    hud.id = 'game-hud';
    hud.style.cssText = `
      position: fixed; top: 0; left: 0; right: 0;
      display: flex; justify-content: space-between; align-items: center;
      padding: 16px 32px; z-index: 100; pointer-events: none;
    `;

    const scoreDiv = document.createElement('div');
    scoreDiv.style.cssText = `
      background: rgba(10, 10, 30, 0.7); backdrop-filter: blur(12px);
      border: 1px solid #00ffff44; border-radius: 8px; padding: 8px 20px;
    `;
    scoreDiv.innerHTML = `<span style="color: #00ffff; font-size: 14px; text-transform: uppercase;">SCORE</span><br>
      <span id="hud-score" style="color: #fff; font-size: 28px; font-weight: bold; text-shadow: 0 0 10px #00ffff;">0</span>`;

    const waveDiv = document.createElement('div');
    waveDiv.style.cssText = `
      background: rgba(10, 10, 30, 0.7); backdrop-filter: blur(12px);
      border: 1px solid #ff00ff44; border-radius: 8px; padding: 8px 20px; text-align: center;
    `;
    waveDiv.innerHTML = `<span style="color: #ff00ff; font-size: 14px; text-transform: uppercase;">WAVE</span><br>
      <span id="hud-wave" style="color: #fff; font-size: 28px; font-weight: bold; text-shadow: 0 0 10px #ff00ff;">1</span>`;

    const livesDiv = document.createElement('div');
    livesDiv.style.cssText = `
      background: rgba(10, 10, 30, 0.7); backdrop-filter: blur(12px);
      border: 1px solid #00ff8844; border-radius: 8px; padding: 8px 20px; text-align: right;
    `;
    livesDiv.innerHTML = `<span style="color: #00ff88; font-size: 14px; text-transform: uppercase;">LIVES</span><br>
      <span id="hud-lives" style="color: #fff; font-size: 28px; font-weight: bold; text-shadow: 0 0 10px #00ff88;">3</span>`;

    hud.appendChild(scoreDiv);
    hud.appendChild(waveDiv);
    hud.appendChild(livesDiv);
    container.appendChild(hud);

    this.scoreEl = document.getElementById('hud-score');
    this.livesEl = document.getElementById('hud-lives');
    this.waveEl = document.getElementById('hud-wave');

    // Power-up indicator
    const powerUpContainer = document.createElement('div');
    powerUpContainer.id = 'powerup-indicator';
    powerUpContainer.style.cssText = `
      position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%);
      z-index: 100; pointer-events: none; text-align: center;
    `;
    this.powerUpEl = powerUpContainer;
    container.appendChild(powerUpContainer);

    // Start screen overlay
    const startScreen = document.createElement('div');
    startScreen.id = 'start-screen';
    startScreen.style.cssText = `
      position: fixed; inset: 0; z-index: 200; display: flex; flex-direction: column;
      justify-content: center; align-items: center; background: rgba(5, 5, 15, 0.95);
    `;
    startScreen.innerHTML = `
      <h1 style="color: #00ffff; font-size: 64px; text-shadow: 0 0 30px #00ffff, 0 0 60px #00ffff; margin-bottom: 20px;">
        SPACE INVADERS
      </h1>
      <p style="color: #ff00ff; font-size: 24px; text-shadow: 0 0 15px #ff00ff; margin-bottom: 40px;">
        RETRO-FUTURISM EDITION
      </p>
      <div style="background: rgba(10, 10, 30, 0.8); backdrop-filter: blur(12px); border: 1px solid #00ffff44;
                  border-radius: 12px; padding: 24px 48px; text-align: center;">
        <p style="color: #fff; font-size: 16px; margin-bottom: 12px;">WASD / Arrow Keys or Gamepad to Move</p>
        <p style="color: #fff; font-size: 16px; margin-bottom: 12px;">SPACE / A Button to Shoot</p>
        <p style="color: #00ff88; font-size: 20px; text-shadow: 0 0 10px #00ff88; animation: pulse 1.5s infinite;">
          PRESS SPACE OR A BUTTON TO START
        </p>
      </div>
    `;
    container.appendChild(startScreen);
    this.startScreen = startScreen;

    // Game Over screen (hidden by default)
    const gameOverScreen = document.createElement('div');
    gameOverScreen.id = 'game-over-screen';
    gameOverScreen.style.cssText = `
      position: fixed; inset: 0; z-index: 200; display: none; flex-direction: column;
      justify-content: center; align-items: center; background: rgba(5, 5, 15, 0.95);
    `;
    gameOverScreen.innerHTML = `
      <h1 style="color: #ff0044; font-size: 64px; text-shadow: 0 0 30px #ff0044; margin-bottom: 20px;">GAME OVER</h1>
      <p id="final-score" style="color: #fff; font-size: 36px; text-shadow: 0 0 15px #fff; margin-bottom: 40px;">SCORE: 0</p>
      <div style="background: rgba(10, 10, 30, 0.8); backdrop-filter: blur(12px); border: 1px solid #ff004444;
                  border-radius: 12px; padding: 24px 48px;">
        <p style="color: #ff00ff; font-size: 20px; text-shadow: 0 0 10px #ff00ff; animation: pulse 1.5s infinite;">
          PRESS SPACE OR A BUTTON TO RESTART
        </p>
      </div>
    `;
    container.appendChild(gameOverScreen);
    this.gameOverScreen = gameOverScreen;

    // Victory screen (hidden by default)
    const victoryScreen = document.createElement('div');
    victoryScreen.id = 'victory-screen';
    victoryScreen.style.cssText = `
      position: fixed; inset: 0; z-index: 200; display: none; flex-direction: column;
      justify-content: center; align-items: center; background: rgba(5, 5, 15, 0.95);
    `;
    victoryScreen.innerHTML = `
      <h1 style="color: #ffff00; font-size: 64px; text-shadow: 0 0 30px #ffff00; margin-bottom: 20px;">VICTORY!</h1>
      <p id="victory-score" style="color: #fff; font-size: 36px; text-shadow: 0 0 15px #fff; margin-bottom: 40px;">SCORE: 0</p>
      <div style="background: rgba(10, 10, 30, 0.8); backdrop-filter: blur(12px); border: 1px solid #ffff0044;
                  border-radius: 12px; padding: 24px 48px;">
        <p style="color: #00ff88; font-size: 20px; text-shadow: 0 0 10px #00ff88; animation: pulse 1.5s infinite;">
          PRESS SPACE OR A BUTTON TO PLAY AGAIN
        </p>
      </div>
    `;
    container.appendChild(victoryScreen);
    this.victoryScreen = victoryScreen;

    // Add CSS animation for pulsing text
    const style = document.createElement('style');
    style.textContent = `@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }`;
    document.head.appendChild(style);
  }

  update(score, lives, wave) {
    if (this.scoreEl) this.scoreEl.textContent = score.toString();
    if (this.livesEl) this.livesEl.textContent = lives.toString();
    if (this.waveEl) this.waveEl.textContent = wave.toString();
  }

  showPowerUp(type, duration) {
    const names = { spread: 'SPREAD SHOT', rapid: 'RAPID FIRE', shield: 'SHIELD' };
    const colors = { spread: '#ffff00', rapid: '#ff8800', shield: '#00ffff' };
    if (this.powerUpEl) {
      this.powerUpEl.innerHTML = `
        <div style="background: rgba(10, 10, 30, 0.8); backdrop-filter: blur(12px); border: 1px solid ${colors[type]}44;
                    border-radius: 8px; padding: 8px 20px;">
          <span style="color: ${colors[type]}; font-size: 16px; text-shadow: 0 0 10px ${colors[type]};">
            ${names[type]} — ${duration.toFixed(1)}s
          </span>
        </div>`;
    }
  }

  hidePowerUp() {
    if (this.powerUpEl) this.powerUpEl.innerHTML = '';
  }

  showStartScreen() {
    if (this.startScreen) this.startScreen.style.display = 'flex';
    if (this.gameOverScreen) this.gameOverScreen.style.display = 'none';
    if (this.victoryScreen) this.victoryScreen.style.display = 'none';
  }

  hideStartScreen() {
    if (this.startScreen) this.startScreen.style.display = 'none';
  }

  showGameOver(finalScore) {
    if (this.gameOverScreen) {
      this.gameOverScreen.style.display = 'flex';
      const scoreEl = this.gameOverScreen.querySelector('#final-score');
      if (scoreEl) scoreEl.textContent = `SCORE: ${finalScore}`;
    }
  }

  showVictory(finalScore, waveReached) {
    if (this.victoryScreen) {
      this.victoryScreen.style.display = 'flex';
      const scoreEl = this.victoryScreen.querySelector('#victory-score');
      if (scoreEl) scoreEl.textContent = `SCORE: ${finalScore} — WAVE ${waveReached}`;
    }
  }

  hideAllScreens() {
    if (this.startScreen) this.startScreen.style.display = 'none';
    if (this.gameOverScreen) this.gameOverScreen.style.display = 'none';
    if (this.victoryScreen) this.victoryScreen.style.display = 'none';
  }

  destroy() {
    // Remove HUD elements from DOM
    const hud = document.getElementById('game-hud');
    if (hud) hud.remove();
    const startScreen = document.getElementById('start-screen');
    if (startScreen) startScreen.remove();
    const gameOverScreen = document.getElementById('game-over-screen');
    if (gameOverScreen) gameOverScreen.remove();
    const victoryScreen = document.getElementById('victory-screen');
    if (victoryScreen) victoryScreen.remove();
  }
}
