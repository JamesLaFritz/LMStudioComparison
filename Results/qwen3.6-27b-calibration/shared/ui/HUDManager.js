/**
 * HUDManager — HUD state management for overlays.
 * Shared across all games.
 */
import { GlassPanel } from './GlassPanel.js';

export class HUDManager {
  constructor() {
    this.container = null;
    this.scoreDisplay = null;
    this.stateDisplay = null;
    this.overlay = null;
  }

  /**
   * Initialize the HUD container.
   */
  init() {
    // Remove existing if any
    const existing = document.getElementById('game-hud');
    if (existing) existing.remove();

    this.container = document.createElement('div');
    this.container.id = 'game-hud';
    Object.assign(this.container.style, {
      position: 'fixed',
      top: '0',
      left: '0',
      width: '100%',
      height: '100%',
      pointerEvents: 'none',
      zIndex: '100',
    });

    document.body.appendChild(this.container);
  }

  /**
   * Create and show the score HUD.
   */
  showScoreHUD(p1Score, p2Score, p1Label, p2Label) {
    this.removeScoreHUD();

    const panel = GlassPanel.create({
      id: 'score-hud',
      position: 'fixed',
      top: '20px',
      left: '50%',
      transform: 'translateX(-50%)',
      padding: '12px 32px',
      borderColor: 'rgba(0, 255, 204, 0.3)',
      glowColor: 'rgba(0, 255, 204, 0.15)',
    });

    panel.style.display = 'flex';
    panel.style.alignItems = 'center';
    panel.style.gap = '32px';
    panel.style.pointerEvents = 'none';

    // P1 score
    const p1Div = document.createElement('div');
    p1Div.style.textAlign = 'center';
    p1Div.innerHTML = `
      <div style="font-size:12px;color:#8888aa;text-transform:uppercase;letter-spacing:1px;">${p1Label || 'Player 1'}</div>
      <div id="p1-score" style="font-size:48px;font-weight:bold;color:#ff0066;text-shadow:0 0 15px #ff0066;">${p1Score}</div>
    `;
    panel.appendChild(p1Div);

    // Separator
    const sep = document.createElement('div');
    sep.style.cssText = 'font-size:36px;color:#444466;font-weight:bold;';
    sep.textContent = ':';
    panel.appendChild(sep);

    // P2 score
    const p2Div = document.createElement('div');
    p2Div.style.textAlign = 'center';
    p2Div.innerHTML = `
      <div style="font-size:12px;color:#8888aa;text-transform:uppercase;letter-spacing:1px;">${p2Label || 'Player 2'}</div>
      <div id="p2-score" style="font-size:48px;font-weight:bold;color:#00ffcc;text-shadow:0 0 15px #00ffcc;">${p2Score}</div>
    `;
    panel.appendChild(p2Div);

    this.container.appendChild(panel);
    this.scoreDisplay = panel;
  }

  /**
   * Update score values.
   */
  updateScores(p1Score, p2Score) {
    const p1El = document.getElementById('p1-score');
    const p2El = document.getElementById('p2-score');
    if (p1El) p1El.textContent = p1Score;
    if (p2El) p2El.textContent = p2Score;
  }

  /**
   * Remove the score HUD.
   */
  removeScoreHUD() {
    const el = document.getElementById('score-hud');
    if (el) el.remove();
    this.scoreDisplay = null;
  }

  /**
   * Show a game state message (e.g., "GET READY", "GAME OVER").
   */
  showStateMessage(text, options = {}) {
    this.removeStateMessage();

    const el = document.createElement('div');
    el.id = 'state-message';
    Object.assign(el.style, {
      position: 'fixed',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      fontSize: options.size || '48px',
      fontWeight: 'bold',
      color: options.color || '#00ffcc',
      textShadow: `0 0 20px ${options.color || '#00ffcc'}, 0 0 40px ${options.color || '#00ffcc'}88`,
      fontFamily: "'Segoe UI', Arial, sans-serif",
      textAlign: 'center',
      letterSpacing: '4px',
      textTransform: 'uppercase',
      pointerEvents: 'none',
      zIndex: '200',
    });
    el.textContent = text;
    this.container.appendChild(el);
    this.stateDisplay = el;
  }

  /**
   * Remove the state message.
   */
  removeStateMessage() {
    const el = document.getElementById('state-message');
    if (el) el.remove();
    this.stateDisplay = null;
  }

  /**
   * Show a full-screen overlay (menu, game over, etc.).
   */
  showOverlay(content) {
    this.removeOverlay();
    const overlay = GlassPanel.createOverlay({ id: 'game-overlay' });
    if (typeof content === 'string') {
      overlay.innerHTML = content;
    } else if (content instanceof HTMLElement) {
      overlay.appendChild(content);
    }
    this.container.appendChild(overlay);
    this.overlay = overlay;
  }

  /**
   * Remove the overlay.
   */
  removeOverlay() {
    const el = document.getElementById('game-overlay');
    if (el) el.remove();
    this.overlay = null;
  }

  /**
   * Show controls info panel.
   */
  showControlsPanel(items) {
    this.removeControlsPanel();

    const panel = GlassPanel.create({
      id: 'controls-panel',
      position: 'fixed',
      bottom: '20px',
      left: '50%',
      transform: 'translateX(-50%)',
      padding: '10px 20px',
      fontSize: '12px',
    });

    const ul = document.createElement('ul');
    ul.style.margin = '0';
    ul.style.padding = '0 0 0 16px';
    ul.style.listStyleType = 'none';

    items.forEach((item) => {
      const li = document.createElement('li');
      li.style.margin = '4px 0';
      li.style.color = '#8888aa';
      li.innerHTML = `<span style="color:#00ffcc;font-weight:bold;">${item.key}</span> — ${item.action}`;
      ul.appendChild(li);
    });

    panel.appendChild(ul);
    this.container.appendChild(panel);
  }

  removeControlsPanel() {
    const el = document.getElementById('controls-panel');
    if (el) el.remove();
  }

  /**
   * Clear all HUD elements.
   */
  clear() {
    this.removeScoreHUD();
    this.removeStateMessage();
    this.removeOverlay();
    this.removeControlsPanel();
    if (this.container) {
      this.container.remove();
      this.container = null;
    }
  }
}
