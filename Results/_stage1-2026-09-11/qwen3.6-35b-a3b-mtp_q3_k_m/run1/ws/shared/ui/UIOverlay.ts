/**
 * Glassmorphism HUD overlay manager for DOM-based UI elements.
 */

export class UIOverlay {
  private container: HTMLElement;
  private scoreEl: HTMLElement;
  private livesEl: HTMLElement;
  private waveEl: HTMLElement;
  private comboEl: HTMLElement;
  private gameOverEl: HTMLElement | null = null;
  private waveTransitionEl: HTMLElement | null = null;

  constructor() {
    // Create container if it doesn't exist
    this.container = document.getElementById('game-ui') || (() => {
      const el = document.createElement('div');
      el.id = 'game-ui';
      el.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        pointer-events: none; z-index: 100; font-family: 'Courier New', monospace;
      `;
      document.body.appendChild(el);
      return el;
    })();

    // Score display
    this.scoreEl = document.getElementById('hud-score') || (() => {
      const el = document.createElement('div');
      el.id = 'hud-score';
      el.style.cssText = `
        position: absolute; top: 20px; left: 50%; transform: translateX(-50%);
        background: rgba(10, 10, 30, 0.7); backdrop-filter: blur(8px);
        border: 1px solid rgba(0, 255, 255, 0.3); border-radius: 8px;
        padding: 10px 30px; color: #00ffff; font-size: 24px; font-weight: bold;
        text-shadow: 0 0 10px #00ffff, 0 0 20px #00ffff;
        box-shadow: 0 0 15px rgba(0, 255, 255, 0.3), inset 0 0 15px rgba(0, 255, 255, 0.1);
      `;
      el.textContent = 'SCORE: 0';
      this.container.appendChild(el);
      return el;
    })();

    // Lives display
    this.livesEl = document.getElementById('hud-lives') || (() => {
      const el = document.createElement('div');
      el.id = 'hud-lives';
      el.style.cssText = `
        position: absolute; top: 20px; left: 30px;
        background: rgba(10, 10, 30, 0.7); backdrop-filter: blur(8px);
        border: 1px solid rgba(0, 136, 255, 0.3); border-radius: 8px;
        padding: 10px 20px; color: #0088ff; font-size: 18px; font-weight: bold;
        text-shadow: 0 0 10px #0088ff, 0 0 20px #0088ff;
        box-shadow: 0 0 15px rgba(0, 136, 255, 0.3), inset 0 0 15px rgba(0, 136, 255, 0.1);
      `;
      el.textContent = 'LIVES: 3';
      this.container.appendChild(el);
      return el;
    })();

    // Wave display
    this.waveEl = document.getElementById('hud-wave') || (() => {
      const el = document.createElement('div');
      el.id = 'hud-wave';
      el.style.cssText = `
        position: absolute; top: 20px; right: 30px;
        background: rgba(10, 10, 30, 0.7); backdrop-filter: blur(8px);
        border: 1px solid rgba(255, 0, 255, 0.3); border-radius: 8px;
        padding: 10px 20px; color: #ff00ff; font-size: 18px; font-weight: bold;
        text-shadow: 0 0 10px #ff00ff, 0 0 20px #ff00ff;
        box-shadow: 0 0 15px rgba(255, 0, 255, 0.3), inset 0 0 15px rgba(255, 0, 255, 0.1);
      `;
      el.textContent = 'WAVE: 1';
      this.container.appendChild(el);
      return el;
    })();

    // Combo display
    this.comboEl = document.getElementById('hud-combo') || (() => {
      const el = document.createElement('div');
      el.id = 'hud-combo';
      el.style.cssText = `
        position: absolute; top: 70px; left: 50%; transform: translateX(-50%);
        background: rgba(10, 10, 30, 0.7); backdrop-filter: blur(8px);
        border: 1px solid rgba(255, 255, 0, 0.3); border-radius: 8px;
        padding: 6px 20px; color: #ffff00; font-size: 14px; font-weight: bold;
        text-shadow: 0 0 8px #ffff00, 0 0 16px #ffff00;
        box-shadow: 0 0 10px rgba(255, 255, 0, 0.3);
        opacity: 0; transition: opacity 0.3s;
      `;
      el.textContent = 'COMBO x1';
      this.container.appendChild(el);
      return el;
    })();

    // Game over overlay (hidden by default)
    this.gameOverEl = document.getElementById('game-over') || (() => {
      const el = document.createElement('div');
      el.id = 'game-over';
      el.style.cssText = `
        position: absolute; top: 0; left: 0; width: 100%; height: 100%;
        display: none; justify-content: center; align-items: center; flex-direction: column;
        background: rgba(5, 5, 15, 0.85); backdrop-filter: blur(4px);
      `;
      el.innerHTML = `
        <div style="font-size: 64px; color: #ff0044; font-weight: bold;
          text-shadow: 0 0 20px #ff0044, 0 0 40px #ff0044, 0 0 80px #ff0044;
          margin-bottom: 30px;">GAME OVER</div>
        <div id="final-score" style="font-size: 28px; color: #00ffff; font-weight: bold;
          text-shadow: 0 0 15px #00ffff; margin-bottom: 40px;"></div>
        <div style="font-size: 18px; color: #aaaaaa; animation: pulse 1.5s infinite;">
          PRESS SPACE TO RESTART</div>
      `;
      this.container.appendChild(el);
      return el;
    })();

    // Wave transition overlay (hidden by default)
    this.waveTransitionEl = document.getElementById('wave-transition') || (() => {
      const el = document.createElement('div');
      el.id = 'wave-transition';
      el.style.cssText = `
        position: absolute; top: 0; left: 0; width: 100%; height: 100%;
        display: none; justify-content: center; align-items: center; flex-direction: column;
        background: rgba(5, 5, 15, 0.7); backdrop-filter: blur(2px);
      `;
      el.innerHTML = `
        <div id="wave-text" style="font-size: 48px; color: #00ff88; font-weight: bold;
          text-shadow: 0 0 20px #00ff88, 0 0 40px #00ff88;"></div>
      `;
      this.container.appendChild(el);
      return el;
    })();

    // Add pulse animation
    if (!document.getElementById('ui-pulse-style')) {
      const style = document.createElement('style');
      style.id = 'ui-pulse-style';
      style.textContent = `
        @keyframes pulse { 0%, 100% { opacity: 0.5; } 50% { opacity: 1; } }
      `;
      document.head.appendChild(style);
    }
  }

  /** Update the score display */
  updateScore(score: number): void {
    this.scoreEl.textContent = `SCORE: ${score.toString().padStart(6, '0')}`;
  }

  /** Update the lives display */
  updateLives(lives: number): void {
    const shipIcons = Array.from({ length: lives }, () => '▲').join(' ');
    this.livesEl.textContent = `LIVES: ${shipIcons || 'NONE'}`;
  }

  /** Update the wave display */
  updateWave(wave: number): void {
    this.waveEl.textContent = `WAVE: ${wave}`;
  }

  /** Show or hide combo indicator */
  updateCombo(combo: number, maxCombo: number): void {
    if (combo >= 2) {
      const multiplier = Math.min(combo, maxCombo);
      this.comboEl.textContent = `COMBO x${multiplier}`;
      this.comboEl.style.opacity = '1';
      // Flash effect
      this.comboEl.style.transform = 'translateX(-50%) scale(1.2)';
      setTimeout(() => {
        this.comboEl.style.transform = 'translateX(-50%) scale(1)';
      }, 150);
    } else {
      this.comboEl.style.opacity = '0';
    }
  }

  /** Show game over screen */
  showGameOver(score: number): void {
    const finalScoreEl = document.getElementById('final-score');
    if (finalScoreEl) {
      finalScoreEl.textContent = `FINAL SCORE: ${score.toString().padStart(6, '0')}`;
    }
    this.gameOverEl!.style.display = 'flex';
  }

  /** Hide game over screen */
  hideGameOver(): void {
    this.gameOverEl!.style.display = 'none';
  }

  /** Show wave transition */
  showWaveTransition(wave: number): void {
    const waveTextEl = document.getElementById('wave-text');
    if (waveTextEl) {
      waveTextEl.textContent = `WAVE ${wave}`;
    }
    this.waveTransitionEl!.style.display = 'flex';
  }

  /** Hide wave transition */
  hideWaveTransition(): void {
    this.waveTransitionEl!.style.display = 'none';
  }

  /** Show start screen */
  showStartScreen(): void {
    // Create start screen if not exists
    let startEl = document.getElementById('start-screen');
    if (!startEl) {
      startEl = document.createElement('div');
      startEl.id = 'start-screen';
      startEl.style.cssText = `
        position: absolute; top: 0; left: 0; width: 100%; height: 100%;
        display: flex; justify-content: center; align-items: center; flex-direction: column;
        background: rgba(5, 5, 15, 0.85); backdrop-filter: blur(4px); z-index: 200;
      `;
      startEl.innerHTML = `
        <div style="font-size: 72px; color: #00ffff; font-weight: bold;
          text-shadow: 0 0 30px #00ffff, 0 0 60px #00ffff, 0 0 120px #0088ff;
          margin-bottom: 40px; letter-spacing: 8px;">SPACE INVADERS</div>
        <div style="font-size: 20px; color: #aaaaaa; animation: pulse 1.5s infinite;">
          PRESS SPACE TO START</div>
        <div style="margin-top: 40px; font-size: 14px; color: #666666; text-align: center; line-height: 2;">
          WASD / ARROWS to move<br/>
          SPACE / A / GAMEPAD to fire</div>
      `;
      this.container.appendChild(startEl);
    }
    startEl.style.display = 'flex';
  }

  /** Hide start screen */
  hideStartScreen(): void {
    const startEl = document.getElementById('start-screen');
    if (startEl) startEl.style.display = 'none';
  }

  /** Reset all UI to initial state */
  reset(): void {
    this.updateScore(0);
    this.updateLives(3);
    this.updateWave(1);
    this.comboEl.style.opacity = '0';
    this.hideGameOver();
    this.hideWaveTransition();
  }

  /** Dispose DOM elements */
  dispose(): void {
    const toRemove = ['hud-score', 'hud-lives', 'hud-wave', 'hud-combo',
      'game-over', 'wave-transition', 'start-screen'];
    for (const id of toRemove) {
      const el = document.getElementById(id);
      if (el && el.parentNode) {
        el.parentNode.removeChild(el);
      }
    }
  }
}
