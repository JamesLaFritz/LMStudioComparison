/**
 * HUDManager — Glassmorphism overlay for score, lives, pause, and game-state messaging.
 */

import { GlassPanel } from './GlassPanel.js';

export class HUDManager {
  constructor(container) {
    this.container = container;
    this.panels = [];
    this.scoreElements = {};
    this.messageEl = null;
    this.messageTimeout = null;
  }

  /**
   * Create a score display panel at the top-center of the screen.
   * @param {object} options — { p1Label, p2Label, p1Color, p2Color, maxScore }
   */
  createScorePanel(options) {
    const { p1Label = 'P1', p2Label = 'P2', p1Color = '#ff00ff', p2Color = '#00ff88', maxScore = 7 } = options;

    const panel = new GlassPanel({ width: '320px', height: '64px', borderRadius: '16px' });
    panel.element.style.position = 'fixed';
    panel.element.style.top = '20px';
    panel.element.style.left = '50%';
    panel.element.style.transform = 'translateX(-50%)';
    panel.element.style.display = 'flex';
    panel.element.style.alignItems = 'center';
    panel.element.style.justifyContent = 'center';
    panel.element.style.gap = '32px';
    panel.element.style.zIndex = '100';
    this.container.appendChild(panel.element);
    this.panels.push(panel);

    // Player 1 score
    const p1Div = document.createElement('div');
    p1Div.style.textAlign = 'center';
    p1Div.innerHTML = `
      <div style="font-size:11px;letter-spacing:2px;color:${p1Color};opacity:0.8;margin-bottom:2px;">${p1Label}</div>
      <div id="hud-score-p1" style="font-size:32px;font-weight:700;color:${p1Color};text-shadow:0 0 12px ${p1Color};">0</div>
    `;
    panel.element.appendChild(p1Div);

    // Divider
    const divider = document.createElement('div');
    divider.style.cssText = 'width:2px;height:40px;background:rgba(255,255,255,0.15);border-radius:1px;';
    panel.element.appendChild(divider);

    // Player 2 score
    const p2Div = document.createElement('div');
    p2Div.style.textAlign = 'center';
    p2Div.innerHTML = `
      <div style="font-size:11px;letter-spacing:2px;color:${p2Color};opacity:0.8;margin-bottom:2px;">${p2Label}</div>
      <div id="hud-score-p2" style="font-size:32px;font-weight:700;color:${p2Color};text-shadow:0 0 12px ${p2Color};">0</div>
    `;
    panel.element.appendChild(p2Div);

    this.scoreElements.p1 = document.getElementById('hud-score-p1');
    this.scoreElements.p2 = document.getElementById('hud-score-p2');
    this.maxScore = maxScore;

    return this;
  }

  /**
   * Update score display.
   */
  setScores(p1, p2) {
    if (this.scoreElements.p1) this.scoreElements.p1.textContent = p1;
    if (this.scoreElements.p2) this.scoreElements.p2.textContent = p2;
  }

  /**
   * Show a temporary center-screen message.
   * @param {string} text
   * @param {number} duration — ms
   * @param {string} color
   */
  showMessage(text, duration = 1500, color = '#ffffff') {
    if (this.messageTimeout) clearTimeout(this.messageTimeout);
    if (!this.messageEl) {
      this.messageEl = document.createElement('div');
      this.messageEl.style.cssText = `
        position:fixed; top:50%; left:50%; transform:translate(-50%,-50%);
        font-size:48px; font-weight:800; letter-spacing:6px; z-index:200;
        pointer-events:none; transition: opacity 0.3s ease;
        text-shadow: 0 0 20px ${color}, 0 0 40px ${color};
        color: ${color};
      `;
      this.container.appendChild(this.messageEl);
    }
    this.messageEl.textContent = text;
    this.messageEl.style.opacity = '1';
    this.messageEl.style.color = color;
    this.messageEl.style.textShadow = `0 0 20px ${color}, 0 0 40px ${color}`;

    this.messageTimeout = setTimeout(() => {
      this.messageEl.style.opacity = '0';
    }, duration);
  }

  /**
   * Show a persistent info panel (e.g., controls hint).
   */
  showInfo(text, position = 'bottom') {
    const panel = new GlassPanel({ width: 'auto', height: 'auto', padding: '12px 24px', borderRadius: '12px' });
    panel.element.style.position = 'fixed';
    panel.element.style.left = '50%';
    panel.element.style.transform = 'translateX(-50%)';
    panel.element.style.zIndex = '100';
    panel.element.style.fontSize = '13px';
    panel.element.style.letterSpacing = '1px';
    panel.element.style.color = 'rgba(255,255,255,0.7)';
    if (position === 'bottom') {
      panel.element.style.bottom = '20px';
    } else {
      panel.element.style.top = '80px';
    }
    panel.element.textContent = text;
    this.container.appendChild(panel.element);
    this.panels.push(panel);
    return panel;
  }

  /**
   * Hide all HUD elements.
   */
  hideAll() {
    this.panels.forEach(p => {
      if (p.element.parentNode) p.element.parentNode.removeChild(p.element);
    });
    this.panels = [];
    if (this.messageEl && this.messageEl.parentNode) {
      this.messageEl.parentNode.removeChild(this.messageEl);
      this.messageEl = null;
    }
  }

  /**
   * Destroy HUD and clean up DOM.
   */
  destroy() {
    this.hideAll();
    this.scoreElements = {};
  }
}
