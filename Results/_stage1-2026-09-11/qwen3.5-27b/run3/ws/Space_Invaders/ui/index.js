import menuHTML from './menu.html?raw';
import hudHTML from './hud.html?raw';
import gameoverHTML from './gameover.html?raw';
import victoryHTML from './victory.html?raw';
import './menu.css';

export class UIManager {
  constructor() {
    this.container = null;
    this.menuOverlay = null;
    this.hudOverlay = null;
    this.gameOverOverlay = null;
    this.victoryOverlay = null;
    
    this.scoreElement = null;
    this.livesElement = null;
    this.comboElement = null;
    this.waveElement = null;
    this.finalScoreElement = null;
    this.highScoreElement = null;
    
    this.currentCombo = 0;
    this.highScore = parseInt(localStorage.getItem('spaceInvadersHighScore')) || 0;
  }

  init(container) {
    this.container = container;
    
    // Create menu overlay
    this.menuOverlay = document.createElement('div');
    this.menuOverlay.className = 'overlay menu-overlay';
    this.menuOverlay.innerHTML = menuHTML;
    this.container.appendChild(this.menuOverlay);
    
    // Create HUD overlay
    this.hudOverlay = document.createElement('div');
    this.hudOverlay.className = 'overlay hud-overlay hidden';
    this.hudOverlay.innerHTML = hudHTML;
    this.container.appendChild(this.hudOverlay);
    
    // Create game over overlay
    this.gameOverOverlay = document.createElement('div');
    this.gameOverOverlay.className = 'overlay gameover-overlay hidden';
    this.gameOverOverlay.innerHTML = gameoverHTML;
    this.container.appendChild(this.gameOverOverlay);
    
    // Create victory overlay
    this.victoryOverlay = document.createElement('div');
    this.victoryOverlay.className = 'overlay victory-overlay hidden';
    this.victoryOverlay.innerHTML = victoryHTML;
    this.container.appendChild(this.victoryOverlay);
    
    // Cache element references
    this.scoreElement = this.hudOverlay.querySelector('.score-value');
    this.livesElement = this.hudOverlay.querySelector('.lives-value');
    this.comboElement = this.hudOverlay.querySelector('.combo-container');
    this.waveElement = this.hudOverlay.querySelector('.wave-value');
    this.finalScoreElement = this.gameOverOverlay.querySelector('.final-score');
    this.highScoreElement = this.gameOverOverlay.querySelector('.high-score');
    
    // Bind button events
    const startButton = this.menuOverlay.querySelector('#start-btn');
    if (startButton) {
      startButton.addEventListener('click', () => {
        this.hideMenu();
        return true;
      });
    }
    
    const restartButton = this.gameOverOverlay.querySelector('#restart-btn');
    if (restartButton) {
      restartButton.addEventListener('click', () => {
        this.reset();
        return true;
      });
    }
    
    const nextWaveButton = this.victoryOverlay.querySelector('#next-wave-btn');
    if (nextWaveButton) {
      nextWaveButton.addEventListener('click', () => {
        this.hideVictory();
        return true;
      });
    }
    
    const menuButton = this.gameOverOverlay.querySelector('#menu-btn');
    if (menuButton) {
      menuButton.addEventListener('click', () => {
        this.showMenu();
        return true;
      });
    }
    
    // Show high score on menu
    const menuHighScore = this.menuOverlay.querySelector('.high-score-display');
    if (menuHighScore) {
      menuHighScore.textContent = `HIGH SCORE: ${this.highScore.toLocaleString()}`;
    }
  }

  showMenu() {
    this.menuOverlay.classList.remove('hidden');
    this.hudOverlay.classList.add('hidden');
    this.gameOverOverlay.classList.add('hidden');
    this.victoryOverlay.classList.add('hidden');
    
    // Update high score display
    const menuHighScore = this.menuOverlay.querySelector('.high-score-display');
    if (menuHighScore) {
      menuHighScore.textContent = `HIGH SCORE: ${this.highScore.toLocaleString()}`;
    }
  }

  hideMenu() {
    this.menuOverlay.classList.add('hidden');
    this.hudOverlay.classList.remove('hidden');
    this.resetHUD();
  }

  showGameOver(score) {
    this.gameOverOverlay.classList.remove('hidden');
    this.hudOverlay.classList.add('hidden');
    
    if (this.finalScoreElement) {
      this.finalScoreElement.textContent = score.toLocaleString();
    }
    if (this.highScoreElement) {
      this.highScoreElement.textContent = this.highScore.toLocaleString();
    }
    
    // Check for new high score
    const newHighScoreMsg = this.gameOverOverlay.querySelector('.new-high-score');
    if (newHighScoreMsg && score > this.highScore) {
      newHighScoreMsg.classList.remove('hidden');
    } else if (newHighScoreMsg) {
      newHighScoreMsg.classList.add('hidden');
    }
  }

  hideGameOver() {
    this.gameOverOverlay.classList.add('hidden');
  }

  showVictory(score, wave) {
    this.victoryOverlay.classList.remove('hidden');
    this.hudOverlay.classList.add('hidden');
    
    const victoryScore = this.victoryOverlay.querySelector('.victory-score');
    if (victoryScore) {
      victoryScore.textContent = score.toLocaleString();
    }
    
    const waveText = this.victoryOverlay.querySelector('.wave-text');
    if (waveText) {
      waveText.textContent = `WAVE ${wave} CLEARED`;
    }
  }

  hideVictory() {
    this.victoryOverlay.classList.add('hidden');
    this.hudOverlay.classList.remove('hidden');
  }

  updateScore(score) {
    if (this.scoreElement) {
      this.scoreElement.textContent = score.toLocaleString();
    }
  }

  updateLives(lives) {
    if (this.livesElement) {
      this.livesElement.textContent = '♥'.repeat(Math.max(0, lives));
    }
  }

  updateCombo(combo) {
    this.currentCombo = combo;
    
    if (this.comboElement) {
      const comboValue = this.comboElement.querySelector('.combo-value');
      const comboGlow = this.comboElement.querySelector('.combo-glow');
      
      if (combo > 1) {
        this.comboElement.classList.remove('hidden');
        if (comboValue) {
          comboValue.textContent = `${combo}x`;
        }
        
        // Scale glow based on combo level
        if (comboGlow) {
          const scale = 1 + (combo - 2) * 0.1;
          const intensity = Math.min(combo * 0.3, 2);
          this.comboElement.style.transform = `scale(${scale})`;
          this.comboElement.style.boxShadow = `0 0 ${intensity}px #ff6600, 0 0 ${intensity * 2}px #ff6600`;
        }
      } else {
        this.comboElement.classList.add('hidden');
      }
    }
  }

  updateWave(wave) {
    if (this.waveElement) {
      this.waveElement.textContent = wave;
    }
  }

  resetHUD() {
    this.updateScore(0);
    this.updateLives(3);
    this.updateCombo(1);
    this.updateWave(1);
  }

  reset() {
    this.hideGameOver();
    this.hideVictory();
    this.hudOverlay.classList.remove('hidden');
    this.resetHUD();
  }

  saveHighScore(score) {
    if (score > this.highScore) {
      this.highScore = score;
      localStorage.setItem('spaceInvadersHighScore', score.toString());
      return true;
    }
    return false;
  }

  getHighScore() {
    return this.highScore;
  }

  destroy() {
    if (this.container) {
      this.container.innerHTML = '';
    }
  }
}
