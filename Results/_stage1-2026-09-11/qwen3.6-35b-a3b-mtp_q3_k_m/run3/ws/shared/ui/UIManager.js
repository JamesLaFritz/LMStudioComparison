import * as THREE from 'three';

export class UIManager {
  constructor(containerElement) {
    this.container = containerElement;
    this.scoreEl = null;
    this.livesEl = null;
    this.waveEl = null;
    this.floatingTexts = [];
    this.overlayEl = null;
    this._createOverlay();
  }

  _createOverlay() {
    if (this.overlayEl) return;
    const overlay = document.createElement('div');
    overlay.id = 'game-ui-overlay';
    overlay.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      pointer-events: none; z-index: 100; font-family: 'Courier New', monospace;
    `;

    const hud = document.createElement('div');
    hud.id = 'hud-bar';
    hud.style.cssText = `
      display: flex; justify-content: space-between; align-items: center;
      padding: 12px 24px; background: rgba(10, 10, 30, 0.7);
      backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
      border-bottom: 1px solid rgba(0, 255, 255, 0.3);
    `;

    const scoreContainer = document.createElement('div');
    scoreContainer.style.cssText = 'text-align:center;';
    const scoreLabel = document.createElement('span');
    scoreLabel.id = 'score-label';
    scoreLabel.textContent = 'SCORE';
    scoreLabel.style.cssText = `
      font-size: 10px; color: rgba(0,255,255,0.6); letter-spacing: 3px;
      text-shadow: 0 0 8px rgba(0,255,255,0.4);
    `;
    this.scoreEl = document.createElement('span');
    this.scoreEl.id = 'score-value';
    this.scoreEl.textContent = '0';
    this.scoreEl.style.cssText = `
      font-size: 28px; color: #00ffff; font-weight: bold;
      text-shadow: 0 0 15px rgba(0,255,255,0.8), 0 0 30px rgba(0,255,255,0.4);
    `;
    scoreContainer.appendChild(scoreLabel);
    scoreContainer.appendChild(this.scoreEl);

    const waveContainer = document.createElement('div');
    waveContainer.style.cssText = 'text-align:center;';
    const waveLabel = document.createElement('span');
    waveLabel.textContent = 'WAVE';
    waveLabel.style.cssText = `
      font-size: 10px; color: rgba(255,0,255,0.6); letter-spacing: 3px;
      text-shadow: 0 0 8px rgba(255,0,255,0.4);
    `;
    this.waveEl = document.createElement('span');
    this.waveEl.id = 'wave-value';
    this.waveEl.textContent = '1';
    this.waveEl.style.cssText = `
      font-size: 28px; color: #ff00ff; font-weight: bold;
      text-shadow: 0 0 15px rgba(255,0,255,0.8), 0 0 30px rgba(255,0,255,0.4);
    `;
    waveContainer.appendChild(waveLabel);
    waveContainer.appendChild(this.waveEl);

    const livesContainer = document.createElement('div');
    livesContainer.style.cssText = 'text-align:center;';
    const livesLabel = document.createElement('span');
    livesLabel.textContent = 'LIVES';
    livesLabel.style.cssText = `
      font-size: 10px; color: rgba(255,255,0,0.6); letter-spacing: 3px;
      text-shadow: 0 0 8px rgba(255,255,0,0.4);
    `;
    this.livesEl = document.createElement('span');
    this.livesEl.id = 'lives-value';
    this.livesEl.textContent = '♥♥♥';
    this.livesEl.style.cssText = `
      font-size: 28px; color: #ffff00;
      text-shadow: 0 0 15px rgba(255,255,0,0.8), 0 0 30px rgba(255,255,0,0.4);
    `;
    livesContainer.appendChild(livesLabel);
    livesContainer.appendChild(this.livesEl);

    hud.appendChild(scoreContainer);
    hud.appendChild(waveContainer);
    hud.appendChild(livesContainer);
    overlay.appendChild(hud);
    this.container.appendChild(overlay);
    this.overlayEl = overlay;
  }

  setScore(value) {
    if (this.scoreEl) this.scoreEl.textContent = value.toString().padStart(6, '0');
  }

  addFloatingText(points, screenPosition3D) {
    const el = document.createElement('div');
    const fontSize = Math.min(48, 28 + Math.floor(points / 10) * 2);
    let color;
    if (points >= 50) color = '#ff00ff';
    else if (points >= 20) color = '#00ffff';
    else color = '#ffff00';

    el.textContent = '+' + points;
    el.style.cssText = `
      position: fixed; font-size: ${fontSize}px; font-weight: bold;
      color: ${color}; pointer-events: none; z-index: 200;
      text-shadow: 0 0 15px ${color}, 0 0 30px ${color};
      transform: translate(-50%, -50%); transition: none;
    `;

    const x = (screenPosition3D.x * 0.5 + 0.5) * window.innerWidth;
    const y = (-screenPosition3D.y * 0.5 + 0.5) * window.innerHeight;
    el.style.left = x + 'px';
    el.style.top = y + 'px';

    this.container.appendChild(el);

    const startTime = performance.now();
    const duration = 1500;
    const startY = y;
    const endY = startY - 80;

    const animate = () => {
      const elapsed = performance.now() - startTime;
      const t = Math.min(1, elapsed / duration);
      const currentY = startY + (endY - startY) * t;
      el.style.top = currentY + 'px';
      el.style.opacity = 1 - t;

      if (t < 1) {
        requestAnimationFrame(animate);
      } else {
        if (el.parentNode) el.parentNode.removeChild(el);
      }
    };

    requestAnimationFrame(animate);
  }

  updateLives(count) {
    if (this.livesEl) this.livesEl.textContent = '♥'.repeat(Math.max(0, count));
  }

  showWave(waveNumber) {
    if (this.waveEl) this.waveEl.textContent = waveNumber.toString();
  }

  showStartScreen() {
    const el = document.createElement('div');
    el.id = 'start-screen';
    el.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      background: rgba(5, 5, 20, 0.85); z-index: 300; pointer-events: auto;
    `;

    const title = document.createElement('h1');
    title.textContent = 'SPACE INVADERS';
    title.style.cssText = `
      font-size: 64px; color: #00ffff; margin-bottom: 20px;
      text-shadow: 0 0 30px rgba(0,255,255,0.8), 0 0 60px rgba(0,255,255,0.4);
      font-family: 'Courier New', monospace; letter-spacing: 8px;
    `;

    const subtitle = document.createElement('p');
    subtitle.textContent = 'Press ENTER or SPACE to Start';
    subtitle.style.cssText = `
      font-size: 20px; color: rgba(255,255,255,0.7); margin-top: 40px;
      animation: pulse 1.5s ease-in-out infinite;
      font-family: 'Courier New', monospace;
    `;

    const controls = document.createElement('p');
    controls.textContent = '← → or A/D to Move | SPACE to Fire';
    controls.style.cssText = `
      font-size: 14px; color: rgba(255,255,255,0.4); margin-top: 30px;
      font-family: 'Courier New', monospace;
    `;

    const style = document.createElement('style');
    style.textContent = `@keyframes pulse { 0%,100%{opacity:0.4} 50%{opacity:1} }`;
    el.appendChild(title);
    el.appendChild(subtitle);
    el.appendChild(controls);
    this.container.appendChild(style);
    this.container.appendChild(el);

    return el;
  }

  hideStartScreen() {
    const el = document.getElementById('start-screen');
    if (el && el.parentNode) el.parentNode.removeChild(el);
  }

  showGameOver(finalScore, waveReached) {
    const overlay = document.createElement('div');
    overlay.id = 'game-over-overlay';
    overlay.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      background: rgba(5, 5, 20, 0.9); z-index: 300; pointer-events: auto;
    `;

    const title = document.createElement('h1');
    title.textContent = 'GAME OVER';
    title.style.cssText = `
      font-size: 64px; color: #ff0055; margin-bottom: 20px;
      text-shadow: 0 0 30px rgba(255,0,85,0.8), 0 0 60px rgba(255,0,85,0.4);
      font-family: 'Courier New', monospace; letter-spacing: 8px;
    `;

    const scoreText = document.createElement('p');
    scoreText.textContent = `FINAL SCORE: ${finalScore}`;
    scoreText.style.cssText = `
      font-size: 32px; color: #00ffff; margin-bottom: 10px;
      text-shadow: 0 0 15px rgba(0,255,255,0.6);
      font-family: 'Courier New', monospace;
    `;

    const waveText = document.createElement('p');
    waveText.textContent = `WAVE REACHED: ${waveReached}`;
    waveText.style.cssText = `
      font-size: 24px; color: #ff00ff; margin-bottom: 40px;
      text-shadow: 0 0 15px rgba(255,0,255,0.6);
      font-family: 'Courier New', monospace;
    `;

    const restart = document.createElement('p');
    restart.textContent = 'Press ENTER or SPACE to Restart';
    restart.style.cssText = `
      font-size: 18px; color: rgba(255,255,255,0.7);
      animation: pulse 1.5s ease-in-out infinite;
      font-family: 'Courier New', monospace;
    `;

    overlay.appendChild(title);
    overlay.appendChild(scoreText);
    overlay.appendChild(waveText);
    overlay.appendChild(restart);
    this.container.appendChild(overlay);
  }

  hideGameOver() {
    const el = document.getElementById('game-over-overlay');
    if (el && el.parentNode) el.parentNode.removeChild(el);
  }

  showVictory(waveReached, finalScore) {
    const overlay = document.createElement('div');
    overlay.id = 'victory-overlay';
    overlay.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      background: rgba(5, 5, 20, 0.9); z-index: 300; pointer-events: auto;
    `;

    const title = document.createElement('h1');
    title.textContent = 'VICTORY!';
    title.style.cssText = `
      font-size: 64px; color: #ffff00; margin-bottom: 20px;
      text-shadow: 0 0 30px rgba(255,255,0,0.8), 0 0 60px rgba(255,255,0,0.4);
      font-family: 'Courier New', monospace; letter-spacing: 8px;
    `;

    const scoreText = document.createElement('p');
    scoreText.textContent = `FINAL SCORE: ${finalScore}`;
    scoreText.style.cssText = `
      font-size: 32px; color: #00ffff; margin-bottom: 10px;
      text-shadow: 0 0 15px rgba(0,255,255,0.6);
      font-family: 'Courier New', monospace;
    `;

    const waveText = document.createElement('p');
    waveText.textContent = `WAVES CLEARED: ${waveReached}`;
    waveText.style.cssText = `
      font-size: 24px; color: #ff00ff; margin-bottom: 40px;
      text-shadow: 0 0 15px rgba(255,0,255,0.6);
      font-family: 'Courier New', monospace;
    `;

    const restart = document.createElement('p');
    restart.textContent = 'Press ENTER or SPACE to Play Again';
    restart.style.cssText = `
      font-size: 18px; color: rgba(255,255,255,0.7);
      animation: pulse 1.5s ease-in-out infinite;
      font-family: 'Courier New', monospace;
    `;

    overlay.appendChild(title);
    overlay.appendChild(scoreText);
    overlay.appendChild(waveText);
    overlay.appendChild(restart);
    this.container.appendChild(overlay);
  }

  hideVictory() {
    const el = document.getElementById('victory-overlay');
    if (el && el.parentNode) el.parentNode.removeChild(el);
  }

  hideAll() {
    this.hideStartScreen();
    this.hideGameOver();
    this.hideVictory();
  }
}
