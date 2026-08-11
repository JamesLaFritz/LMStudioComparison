import { GlassPanel } from '../../shared/ui/GlassPanel.js';

export class PongHUD {
  constructor() {
    this.container = null;
    this.scoreP1El = null;
    this.scoreP2El = null;
    this.messageEl = null;
    this.serveEl = null;
    this.menuEl = null;
    this.matchOverEl = null;
    this.serveTimer = 0;
  }

  init() {
    // Remove any existing container
    this.dispose();

    // Create main HUD container
    this.container = document.createElement('div');
    this.container.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 10;
    `;
    document.body.appendChild(this.container);

    // Score display - top center
    const scorePanel = new GlassPanel();
    const scoreEl = scorePanel.create({
      width: '280px',
      height: '60px',
      top: '20px',
      left: '50%',
      transform: 'translateX(-50%)',
      borderRadius: '12px',
      borderColor: 'rgba(0, 255, 255, 0.3)',
      glowColor: 'rgba(0, 255, 255, 0.15)',
    });

    scoreEl.style.cssText += `
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 30px;
      font-size: 28px;
      font-weight: 700;
      font-family: 'Courier New', monospace;
    `;

    this.scoreP1El = document.createElement('span');
    this.scoreP1El.style.color = '#ff00ff';
    this.scoreP1El.style.textShadow = '0 0 10px #ff00ff, 0 0 20px #ff00ff';
    this.scoreP1El.textContent = '0';

    const divider = document.createElement('span');
    divider.style.cssText = `
      color: rgba(255, 255, 255, 0.3);
      font-size: 20px;
      user-select: none;
    `;
    divider.textContent = '-';

    this.scoreP2El = document.createElement('span');
    this.scoreP2El.style.color = '#00ff88';
    this.scoreP2El.style.textShadow = '0 0 10px #00ff88, 0 0 20px #00ff88';
    this.scoreP2El.textContent = '0';

    scoreEl.appendChild(this.scoreP1El);
    scoreEl.appendChild(divider);
    scoreEl.appendChild(this.scoreP2El);
    this.container.appendChild(scoreEl);

    // Message overlay (center screen)
    this.messageEl = document.createElement('div');
    this.messageEl.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      text-align: center;
      pointer-events: none;
      z-index: 20;
    `;

    // Menu message
    this.menuEl = document.createElement('div');
    this.menuEl.style.cssText = `
      font-size: 48px;
      font-weight: 900;
      font-family: 'Courier New', monospace;
      color: #00ffff;
      text-shadow: 0 0 20px #00ffff, 0 0 40px #00ffff, 0 0 80px #0088ff;
      letter-spacing: 8px;
      margin-bottom: 20px;
      user-select: none;
    `;
    this.menuEl.textContent = 'P O N G';

    const subtitle = document.createElement('div');
    subtitle.style.cssText = `
      font-size: 16px;
      font-family: 'Courier New', monospace;
      color: rgba(255, 255, 255, 0.6);
      letter-spacing: 4px;
      animation: pulse 2s ease-in-out infinite;
      user-select: none;
    `;
    subtitle.textContent = 'PRESS ANY KEY TO START';

    this.menuEl.appendChild(subtitle);
    this.messageEl.appendChild(this.menuEl);

    // Serve countdown
    this.serveEl = document.createElement('div');
    this.serveEl.style.cssText = `
      font-size: 72px;
      font-weight: 900;
      font-family: 'Courier New', monospace;
      color: #00ffff;
      text-shadow: 0 0 30px #00ffff, 0 0 60px #00ffff;
      display: none;
      user-select: none;
    `;
    this.messageEl.appendChild(this.serveEl);

    // Match over
    this.matchOverEl = document.createElement('div');
    this.matchOverEl.style.cssText = `
      font-size: 42px;
      font-weight: 900;
      font-family: 'Courier New', monospace;
      color: #ffff00;
      text-shadow: 0 0 20px #ffff00, 0 0 40px #ff8800, 0 0 80px #ff4400;
      display: none;
      letter-spacing: 6px;
      user-select: none;
    `;
    this.messageEl.appendChild(this.matchOverEl);

    this.container.appendChild(this.messageEl);

    // Add pulse animation
    const styleSheet = document.createElement('style');
    styleSheet.textContent = `
      @keyframes pulse {
        0%, 100% { opacity: 0.4; }
        50% { opacity: 1.0; }
      }
      @keyframes scoreFlash {
        0% { transform: scale(1); }
        50% { transform: scale(1.4); }
        100% { transform: scale(1); }
      }
    `;
    document.head.appendChild(styleSheet);
  }

  updateScores(p1, p2) {
    this.scoreP1El.textContent = p1;
    this.scoreP2El.textContent = p2;

    // Flash animation on score change
    this.scoreP1El.style.animation = 'scoreFlash 0.3s ease-out';
    this.scoreP2El.style.animation = 'scoreFlash 0.3s ease-out';
    setTimeout(() => {
      if (this.scoreP1El) this.scoreP1El.style.animation = '';
      if (this.scoreP2El) this.scoreP2El.style.animation = '';
    }, 300);
  }

  showMenu() {
    if (this.menuEl) this.menuEl.style.display = 'block';
    if (this.serveEl) this.serveEl.style.display = 'none';
    if (this.matchOverEl) this.matchOverEl.style.display = 'none';
  }

  showServe() {
    if (this.menuEl) this.menuEl.style.display = 'none';
    if (this.serveEl) {
      this.serveEl.style.display = 'block';
      this.serveEl.textContent = 'GET READY';
      this.serveEl.style.color = '#00ffff';
      this.serveEl.style.textShadow = '0 0 30px #00ffff, 0 0 60px #00ffff';
    }
    if (this.matchOverEl) this.matchOverEl.style.display = 'none';
  }

  showMatchOver(winner) {
    if (this.menuEl) this.menuEl.style.display = 'none';
    if (this.serveEl) this.serveEl.style.display = 'none';
    if (this.matchOverEl) {
      this.matchOverEl.style.display = 'block';
      const winnerColor = winner === 1 ? '#ff00ff' : '#00ff88';
      const winnerName = winner === 1 ? 'PLAYER 1' : 'PLAYER 2';
      this.matchOverEl.innerHTML = `
        <div style="font-size: 24px; margin-bottom: 10px; color: rgba(255,255,255,0.7);">MATCH OVER</div>
        <div style="color: ${winnerColor}; text-shadow: 0 0 20px ${winnerColor}, 0 0 40px ${winnerColor};">${winnerName} WINS</div>
        <div style="font-size: 16px; margin-top: 20px; color: rgba(255,255,255,0.5);">PRESS ENTER TO PLAY AGAIN</div>
      `;
    }
  }

  update(dt) {
    // Update serve countdown visual
    if (this.serveEl && this.serveEl.style.display === 'block') {
      // Could add countdown timer here if needed
    }
  }

  dispose() {
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
    this.container = null;
    this.scoreP1El = null;
    this.scoreP2El = null;
    this.messageEl = null;
    this.serveEl = null;
    this.menuEl = null;
    this.matchOverEl = null;
  }
}
