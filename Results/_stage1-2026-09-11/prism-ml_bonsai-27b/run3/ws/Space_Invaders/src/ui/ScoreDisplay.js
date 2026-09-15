/**
 * ScoreDisplay - HTML/CSS score display with floating text animations.
 */

class ScoreDisplay {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    if (!this.container) {
      console.warn(`ScoreDisplay: container #${containerId} not found`);
      return;
    }

    // Build the score HUD UI
    this.setupHUD();
    this.floatingTexts = [];
  }

  setupHUD() {
    // Clear existing content
    this.container.innerHTML = '';

    // Score display element
    const scoreEl = document.createElement('div');
    scoreEl.className = 'hud-score';
    scoreEl.textContent = 'SCORE: 0';
    this.container.appendChild(scoreEl);

    // Lives display element
    const livesEl = document.createElement('div');
    livesEl.className = 'hud-lives';
    livesEl.innerHTML = '<span class="life-icon">♥</span><span class="life-icon">♥</span><span class="life-icon">♥</span>';
    this.container.appendChild(livesEl);

    // Wave indicator element
    const waveEl = document.createElement('div');
    waveEl.className = 'hud-wave';
    waveEl.textContent = 'WAVE: 1';
    this.container.appendChild(waveEl);

    // Floating text container (absolute positioned)
    const floatingTextContainer = document.createElement('div');
    floatingTextContainer.id = 'floating-text-container';
    floatingTextContainer.className = 'hud-floating-texts';
    this.container.appendChild(floatingTextContainer);
  }

  update(score, lives, wave) {
    // Update score text
    const scoreEl = this.container.querySelector('.hud-score');
    if (scoreEl) {
      scoreEl.textContent = `SCORE: ${score}`;
    }

    // Update lives display
    const livesEl = this.container.querySelector('.hud-lives');
    if (livesEl) {
      let hearts = '';
      for (let i = 0; i < lives; i++) {
        hearts += '<span class="life-icon">♥</span>';
      }
      hearts += '<span class="life-icon" style="color: #333;">♥</span><span class="life-icon" style="color: #333;">♥</span><span class="life-icon" style="color: #333;">♥</span>';
      livesEl.innerHTML = hearts;
    }

    // Update wave indicator
    const waveEl = this.container.querySelector('.hud-wave');
    if (waveEl) {
      waveEl.textContent = `WAVE: ${wave}`;
    }
  }

  addFloatingText(x, y, text, color = '#ffdd00') {
    const container = document.getElementById('floating-text-container');
    if (!container) return;

    const el = document.createElement('div');
    el.className = 'floating-text';
    el.textContent = text;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    el.style.color = color;

    container.appendChild(el);

    // Track for cleanup
    this.floatingTexts.push({ element: el, startTime: performance.now() });

    // Auto-remove after animation completes (1.5 seconds)
    setTimeout(() => {
      if (el.parentNode) {
        el.remove();
      }
      const idx = this.floatingTexts.findIndex(t => t.element === el);
      if (idx >= 0) {
        this.floatingTexts.splice(idx, 1);
      }
    }, 1500);
  }

  clearFloatingText() {
    for (const ft of this.floatingTexts) {
      if (ft.element.parentNode) {
        ft.element.remove();
      }
    }
    this.floatingTexts = [];
  }
}

export default ScoreDisplay;