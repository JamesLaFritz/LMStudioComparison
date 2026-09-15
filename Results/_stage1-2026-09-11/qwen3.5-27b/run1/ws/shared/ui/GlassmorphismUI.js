/**
 * GlassmorphismUI — HTML/CSS overlay system for retro-futurism aesthetic
 * Provides: menu screens, score display, pause screen, game over/victory screens
 */

export class GlassmorphismUI {
  constructor(containerId = 'ui-overlay') {
    this.container = document.getElementById(containerId) || 
                     (() => {
                       const el = document.createElement('div');
                       el.id = containerId;
                       document.body.appendChild(el);
                       return el;
                     })();
    
    this.screens = new Map();
    this.currentScreen = null;
    this.onStartCallback = null;
    this.onResumeCallback = null;
    this.onRestartCallback = null;
    this.onContinueCallback = null;
    
    this.init();
  }

  init() {
    this.container.innerHTML = '';
    this.createBaseStyles();
    this.createHUD();
  }

  createBaseStyles() {
    const style = document.createElement('style');
    style.textContent = `
      #ui-overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        z-index: 1000;
      }

      .glass-panel {
        background: rgba(10, 15, 30, 0.75);
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
        border: 1px solid rgba(0, 255, 255, 0.3);
        box-shadow: 
          0 0 20px rgba(0, 255, 255, 0.2),
          inset 0 0 40px rgba(0, 255, 255, 0.1);
        border-radius: 16px;
        padding: 32px;
        text-align: center;
        color: #ffffff;
        font-family: 'Courier New', monospace;
      }

      .glass-panel h1 {
        font-size: 48px;
        margin: 0 0 24px 0;
        background: linear-gradient(180deg, #00ffff, #ff00ff);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
        text-shadow: 0 0 30px rgba(0, 255, 255, 0.5);
      }

      .glass-panel h2 {
        font-size: 32px;
        margin: 0 0 16px 0;
        color: #ff00ff;
        text-shadow: 0 0 20px rgba(255, 0, 255, 0.8);
      }

      .glass-panel p {
        font-size: 18px;
        margin: 8px 0;
        color: #b0d4ff;
      }

      .neon-button {
        background: rgba(0, 255, 255, 0.1);
        border: 2px solid #00ffff;
        color: #00ffff;
        padding: 16px 48px;
        font-size: 20px;
        font-family: 'Courier New', monospace;
        cursor: pointer;
        margin: 16px;
        border-radius: 8px;
        transition: all 0.3s ease;
        text-transform: uppercase;
        letter-spacing: 2px;
        box-shadow: 0 0 10px rgba(0, 255, 255, 0.3);
      }

      .neon-button:hover {
        background: rgba(0, 255, 255, 0.3);
        box-shadow: 
          0 0 20px rgba(0, 255, 255, 0.6),
          0 0 40px rgba(0, 255, 255, 0.4);
        transform: scale(1.05);
      }

      .neon-button:active {
        transform: scale(0.98);
      }

      .score-display {
        position: absolute;
        top: 20px;
        left: 20px;
        font-size: 24px;
        color: #00ffff;
        text-shadow: 0 0 10px rgba(0, 255, 255, 0.8);
      }

      .high-score-display {
        position: absolute;
        top: 20px;
        right: 20px;
        font-size: 24px;
        color: #ff00ff;
        text-shadow: 0 0 10px rgba(255, 0, 255, 0.8);
      }

      .health-bar {
        position: absolute;
        bottom: 20px;
        left: 50%;
        transform: translateX(-50%);
        width: 300px;
        height: 24px;
        background: rgba(0, 0, 0, 0.5);
        border: 2px solid #00ffff;
        border-radius: 12px;
        overflow: hidden;
      }

      .health-fill {
        height: 100%;
        background: linear-gradient(90deg, #ff0000, #ffff00, #00ff00);
        transition: width 0.3s ease;
        box-shadow: 0 0 20px rgba(0, 255, 0, 0.6);
      }

      .combo-display {
        position: absolute;
        top: 80px;
        left: 50%;
        transform: translateX(-50%);
        font-size: 36px;
        color: #ffff00;
        text-shadow: 0 0 20px rgba(255, 255, 0, 0.8);
        opacity: 0;
        transition: opacity 0.2s ease;
      }

      .combo-display.active {
        opacity: 1;
        animation: pulse 0.3s ease infinite alternate;
      }

      @keyframes pulse {
        from { transform: translateX(-50%) scale(1); }
        to { transform: translateX(-50%) scale(1.1); }
      }

      .screen-container {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        pointer-events: auto;
        display: none;
      }

      .screen-container.active {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
      }

      .floating-text {
        position: absolute;
        font-size: 28px;
        font-weight: bold;
        pointer-events: none;
        animation: floatUp 1s ease-out forwards;
        text-shadow: 0 0 10px currentColor;
      }

      @keyframes floatUp {
        0% {
          opacity: 1;
          transform: translateY(0) scale(1);
        }
        100% {
          opacity: 0;
          transform: translateY(-50px) scale(1.2);
        }
      }

      .wave-indicator {
        position: absolute;
        top: 60px;
        left: 50%;
        transform: translateX(-50%);
        font-size: 28px;
        color: #ff00ff;
        text-shadow: 0 0 15px rgba(255, 0, 255, 0.8);
      }

      .controls-hint {
        margin-top: 24px;
        font-size: 14px;
        color: #6a8caf;
      }

      .key-badge {
        display: inline-block;
        background: rgba(0, 255, 255, 0.2);
        border: 1px solid #00ffff;
        padding: 4px 8px;
        border-radius: 4px;
        margin: 0 4px;
        font-size: 12px;
      }

      .lives-display {
        position: absolute;
        bottom: 60px;
        left: 50%;
        transform: translateX(-50%);
        font-size: 20px;
        color: #ff4444;
        text-shadow: 0 0 10px rgba(255, 0, 0, 0.8);
      }

      .error-panel {
        background: rgba(50, 0, 0, 0.9);
        border-color: #ff4444;
      }
    `;
    this.container.appendChild(style);
  }

  createHUD() {
    // Score display
    const scoreEl = document.createElement('div');
    scoreEl.className = 'score-display';
    scoreEl.id = 'hud-score';
    scoreEl.textContent = 'SCORE: 0';
    this.container.appendChild(scoreEl);

    // High score display
    const highScoreEl = document.createElement('div');
    highScoreEl.className = 'high-score-display';
    highScoreEl.id = 'hud-highscore';
    highScoreEl.textContent = `HIGH SCORE: ${this.getHighScore()}`;
    this.container.appendChild(highScoreEl);

    // Health bar (used for lives)
    const healthBar = document.createElement('div');
    healthBar.className = 'health-bar';
    healthBar.innerHTML = '<div class="health-fill" id="hud-health" style="width: 100%;"></div>';
    this.container.appendChild(healthBar);

    // Lives display
    const livesEl = document.createElement('div');
    livesEl.className = 'lives-display';
    livesEl.id = 'hud-lives';
    livesEl.textContent = 'LIVES: 3';
    this.container.appendChild(livesEl);

    // Combo display
    const comboEl = document.createElement('div');
    comboEl.className = 'combo-display';
    comboEl.id = 'hud-combo';
    comboEl.textContent = '';
    this.container.appendChild(comboEl);

    // Wave indicator
    const waveEl = document.createElement('div');
    waveEl.className = 'wave-indicator';
    waveEl.id = 'hud-wave';
    waveEl.textContent = 'WAVE 1';
    this.container.appendChild(waveEl);
  }

  showMenu() {
    if (!this.screens.has('menu')) {
      const container = document.createElement('div');
      container.className = 'screen-container glass-panel active';
      container.innerHTML = `
        <h1>SPACE INVADERS</h1>
        <p style="color: #00ffff; font-size: 20px;">RETRO-FUTURISM EDITION</p>
        <button class="neon-button" id="start-btn">START GAME</button>
        <div class="controls-hint">
          <span class="key-badge">WASD</span> or 
          <span class="key-badge">ARROWS</span> to move • 
          <span class="key-badge">SPACE</span> to shoot • 
          <span class="key-badge">ESC</span> to pause<br>
          Gamepad supported
        </div>
      `;

      const startBtn = container.querySelector('#start-btn');
      startBtn.addEventListener('click', () => {
        this.hideMenu();
        if (this.onStartCallback) this.onStartCallback();
      });

      this.container.appendChild(container);
      this.screens.set('menu', { element: container, type: 'menu' });
    } else {
      const screen = this.screens.get('menu');
      screen.element.classList.add('active');
      this.currentScreen = 'menu';
    }
  }

  hideMenu() {
    const screen = this.screens.get('menu');
    if (screen) {
      screen.element.classList.remove('active');
      if (this.currentScreen === 'menu') this.currentScreen = null;
    }
  }

  showHUD(score, lives, wave) {
    this.updateScore(score);
    this.updateLives(lives);
    this.updateWave(wave);
    
    // Show HUD elements by removing pointer-events: none from specific children
    const hudElements = this.container.querySelectorAll('.score-display, .high-score-display, .health-bar, .lives-display, .wave-indicator');
    hudElements.forEach(el => {
      el.style.display = 'block';
    });
  }

  showPause() {
    if (!this.screens.has('pause')) {
      const container = document.createElement('div');
      container.className = 'screen-container glass-panel active';
      container.innerHTML = `
        <h2>PAUSED</h2>
        <p>Press ESC to resume</p>
        <button class="neon-button" id="resume-btn">RESUME</button>
      `;

      const resumeBtn = container.querySelector('#resume-btn');
      resumeBtn.addEventListener('click', () => {
        this.hidePause();
        if (this.onResumeCallback) this.onResumeCallback();
      });

      this.container.appendChild(container);
      this.screens.set('pause', { element: container, type: 'pause' });
    } else {
      const screen = this.screens.get('pause');
      screen.element.classList.add('active');
      this.currentScreen = 'pause';
    }
  }

  hidePause() {
    const screen = this.screens.get('pause');
    if (screen) {
      screen.element.classList.remove('active');
      if (this.currentScreen === 'pause') this.currentScreen = null;
    }
  }

  showGameOver(score) {
    const highScore = Math.max(score, this.getHighScore());
    
    if (!this.screens.has('gameover')) {
      const container = document.createElement('div');
      container.className = 'screen-container glass-panel active';
      container.innerHTML = `
        <h1 style="color: #ff0000; text-shadow: 0 0 30px rgba(255,0,0,0.8);">GAME OVER</h1>
        <p class="score-value" style="font-size: 24px;">SCORE: ${score}</p>
        <p class="high-score-value" style="color: #ffff00; font-size: 18px;">HIGH SCORE: ${highScore}</p>
        <button class="neon-button" id="restart-btn">TRY AGAIN</button>
      `;

      const restartBtn = container.querySelector('#restart-btn');
      restartBtn.addEventListener('click', () => {
        this.hideGameOver();
        if (this.onRestartCallback) this.onRestartCallback();
      });

      this.container.appendChild(container);
      this.screens.set('gameover', { element: container, type: 'gameover' });
    } else {
      const screen = this.screens.get('gameover');
      screen.element.querySelector('.score-value').textContent = `SCORE: ${score}`;
      screen.element.querySelector('.high-score-value').textContent = `HIGH SCORE: ${highScore}`;
      screen.element.classList.add('active');
      this.currentScreen = 'gameover';
    }
  }

  hideGameOver() {
    const screen = this.screens.get('gameover');
    if (screen) {
      screen.element.classList.remove('active');
      if (this.currentScreen === 'gameover') this.currentScreen = null;
    }
  }

  showVictory(score) {
    const highScore = Math.max(score, this.getHighScore());
    
    if (!this.screens.has('victory')) {
      const container = document.createElement('div');
      container.className = 'screen-container glass-panel active';
      container.innerHTML = `
        <h1 style="color: #00ff00; text-shadow: 0 0 30px rgba(0,255,0,0.8);">VICTORY!</h1>
        <p class="score-value" style="font-size: 24px;">SCORE: ${score}</p>
        <p class="high-score-value" style="color: #ffff00; font-size: 18px;">HIGH SCORE: ${highScore}</p>
        <button class="neon-button" id="continue-btn">NEXT WAVE</button>
      `;

      const continueBtn = container.querySelector('#continue-btn');
      continueBtn.addEventListener('click', () => {
        this.hideVictory();
        if (this.onContinueCallback) this.onContinueCallback();
      });

      this.container.appendChild(container);
      this.screens.set('victory', { element: container, type: 'victory' });
    } else {
      const screen = this.screens.get('victory');
      screen.element.querySelector('.score-value').textContent = `SCORE: ${score}`;
      screen.element.querySelector('.high-score-value').textContent = `HIGH SCORE: ${highScore}`;
      screen.element.classList.add('active');
      this.currentScreen = 'victory';
    }
  }

  hideVictory() {
    const screen = this.screens.get('victory');
    if (screen) {
      screen.element.classList.remove('active');
      if (this.currentScreen === 'victory') this.currentScreen = null;
    }
  }

  updateScore(score, comboMultiplier) {
    const el = document.getElementById('hud-score');
    if (el) {
      let text = `SCORE: ${score}`;
      if (comboMultiplier && comboMultiplier > 1) {
        text += ` x${comboMultiplier.toFixed(1)}`;
      }
      el.textContent = text;
    }
    
    // Update high score if needed
    const currentHighScore = this.getHighScore();
    if (score > currentHighScore && score > 0) {
      this.updateHighScore(score);
    }
  }

  updateHighScore(highScore) {
    const el = document.getElementById('hud-highscore');
    if (el) el.textContent = `HIGH SCORE: ${highScore}`;
    
    // Save to localStorage
    localStorage.setItem('spaceInvadersHighScore', highScore);
  }

  getHighScore() {
    return parseInt(localStorage.getItem('spaceInvadersHighScore') || '0');
  }

  updateLives(lives) {
    const el = document.getElementById('hud-lives');
    if (el) {
      el.textContent = `LIVES: ${lives}`;
      
      // Update health bar as well
      const healthBar = document.getElementById('hud-health');
      if (healthBar) {
        const percentage = Math.max(0, (lives / 3) * 100);
        healthBar.style.width = `${percentage}%`;
        
        // Change color based on lives
        if (percentage > 66) {
          healthBar.style.background = 'linear-gradient(90deg, #00ff00, #00ff88)';
        } else if (percentage > 33) {
          healthBar.style.background = 'linear-gradient(90deg, #ffff00, #ffaa00)';
        } else {
          healthBar.style.background = 'linear-gradient(90deg, #ff0000, #ff4400)';
        }
      }
    }
  }

  updateWave(waveNumber) {
    const el = document.getElementById('hud-wave');
    if (el) el.textContent = `WAVE ${waveNumber}`;
  }

  showFloatingText(text, worldPosition, color = '#00ff88') {
    // Project 3D position to screen coordinates would require camera access
    // For now, use a simple centered approach or pass screen coords directly
    
    const floatEl = document.createElement('div');
    floatEl.className = 'floating-text';
    floatEl.textContent = text;
    floatEl.style.color = color;
    
    // If worldPosition is a THREE.Vector3-like object with x, y properties
    if (worldPosition && typeof worldPosition.x === 'number') {
      // Simple projection - in real implementation would use camera.project()
      const screenX = window.innerWidth / 2 + worldPosition.x * 0.5;
      const screenY = window.innerHeight / 2 - worldPosition.y * 0.5;
      floatEl.style.left = `${screenX}px`;
      floatEl.style.top = `${screenY}px`;
    } else {
      // Center on screen
      floatEl.style.left = `${window.innerWidth / 2}px`;
      floatEl.style.top = `${window.innerHeight / 3}px`;
    }
    
    this.container.appendChild(floatEl);
    
    // Auto-remove after animation
    setTimeout(() => {
      if (floatEl.parentNode) {
        floatEl.remove();
      }
    }, 1000);
  }

  setCombo(comboCount) {
    const el = document.getElementById('hud-combo');
    if (el) {
      if (comboCount && comboCount > 1) {
        const multiplier = Math.min(1 + (comboCount - 1) * 0.1, 2.0);
        el.textContent = `COMBO x${multiplier.toFixed(1)}!`;
        el.classList.add('active');
      } else {
        el.textContent = '';
        el.classList.remove('active');
      }
    }
  }

  hideAllScreens() {
    this.screens.forEach((screen) => {
      screen.element.classList.remove('active');
    });
    this.currentScreen = null;
  }

  destroy() {
    this.container.innerHTML = '';
    this.screens.clear();
  }
}
