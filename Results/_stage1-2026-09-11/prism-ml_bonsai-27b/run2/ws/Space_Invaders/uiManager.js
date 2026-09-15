import * as THREE from 'three';
import { EffectComposer, RenderPass } from 'three/addons/postprocessing/EffectComposer.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

export class UIManager {
  constructor(scene, camera) {
    this.scene = scene;
    this.camera = camera;
    this.scoreText = null;
    this.livesDisplay = null;
    this.waveText = null;
    this.hudPanel = null;
    this.highScoreText = null;

    // Create the glassmorphism HUD panel
    this._createHUD();

    // Setup post-processing for neon glow
    this._setupPostProcessing();
  }

  _createHUD() {
    const rect = document.createElement('div');
    rect.id = 'hud-panel';
    rect.style.cssText = `
      position: fixed; top: 0; left: 0; right: 0; bottom: 0;
      pointer-events: none; z-index: 10; display: flex; flex-direction: column; justify-content: space-between;
    `;

    // Top bar - score and lives
    const topBar = document.createElement('div');
    topBar.id = 'top-bar';
    topBar.style.cssText = `
      padding: 12px 24px; display: flex; justify-content: space-between; align-items: center;
      background: rgba(0, 0, 0, 0.3); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
      border-bottom: 1px solid rgba(0, 255, 255, 0.15); color: #0ff; font-family: 'Courier New', monospace;
    `;

    this.scoreText = document.createElement('div');
    this.scoreText.id = 'score-text';
    this.scoreText.style.cssText = `font-size: 24px; font-weight: bold; text-shadow: 0 0 10px rgba(0, 255, 255, 0.6);`;

    const livesContainer = document.createElement('div');
    livesContainer.id = 'lives-container';
    livesContainer.style.cssText = `display: flex; gap: 8px; align-items: center;`;

    this.livesDisplay = document.createElement('div');
    this.livesDisplay.id = 'lives-display';
    this.livesDisplay.style.cssText = `font-size: 20px; color: #ff6666; text-shadow: 0 0 10px rgba(255, 100, 100, 0.6);`;

    topBar.appendChild(this.scoreText);
    topBar.appendChild(livesContainer);
    topBar.appendChild(this.livesDisplay);
    rect.appendChild(topBar);

    // Bottom bar - wave info and high score
    const bottomBar = document.createElement('div');
    bottomBar.id = 'bottom-bar';
    bottomBar.style.cssText = `padding: 12px 24px; display: flex; justify-content: space-between; align-items: center;
      background: rgba(0, 0, 0, 0.3); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
      border-top: 1px solid rgba(0, 255, 255, 0.15); color: #aaa; font-family: 'Courier New', monospace; font-size: 14px;`;

    this.waveText = document.createElement('div');
    this.waveText.id = 'wave-text';
    this.waveText.style.cssText = `color: #0ff; text-shadow: 0 0 8px rgba(0, 255, 255, 0.4);`;

    this.highScoreText = document.createElement('div');
    this.highScoreText.id = 'high-score-text';
    this.highScoreText.style.cssText = `color: #ffaa00; text-shadow: 0 0 8px rgba(255, 170, 0, 0.4);`;

    bottomBar.appendChild(this.waveText);
    bottomBar.appendChild(this.highScoreText);
    rect.appendChild(bottomBar);

    document.body.appendChild(rect);
  }

  _setupPostProcessing() {
    const composer = new EffectComposer();
    this.composer = composer;

    const bloomPass = new UnrealBloomPass(
      this.camera,
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      1.2,
      0.3,
      0.4,
      0.0
    );

    // Add a tone map pass for contrast enhancement
    const toneMapPass = new RenderPass(() => {
      const renderTarget = this.camera.render(this.scene);
      const texture = renderTarget.getTexture();
      const canvas = document.createElement('canvas');
      canvas.width = texture.width;
      canvas.height = texture.height;
      const ctx = canvas.getContext('2d');
      const imgData = ctx.getImageData(0, 0, texture.width, texture.height);

      for (let i = 0; i < imgData.data.length; i += 4) {
        let r = Math.min(imgData.data[i] / 255 * 1.3, 1);
        let g = Math.min(imgData.data[i + 1] / 255 * 1.3, 1);
        let b = Math.min(imgData.data[i + 2] / 255 * 1.3, 1);
        imgData.data[i] = r * 255;
        imgData.data[i + 1] = g * 255;
        imgData.data[i + 2] = b * 255;
      }

      const newTexture = new THREE.CanvasTexture(canvas);
      return new TexturePass(newTexture);
    });

    composer.add(bloomPass);
    composer.add(toneMapPass);
  }

  updateScore(score) {
    this.scoreText.textContent = score.toString();
  }

  updateLives(lives) {
    let livesHtml = '';
    for (let i = 0; i < lives; i++) {
      livesHtml += `<span style="color: #ff6666; text-shadow: 0 0 8px rgba(255, 100, 100, 0.6);">✦</span>`;
    }
    this.livesDisplay.innerHTML = livesHtml;
  }

  updateWave(waveNumber) {
    this.waveText.textContent = `WAVE ${waveNumber}`;
    if (waveNumber > 1) {
      // Flash effect for wave announcement
      this.waveText.style.color = '#ff0';
      this.waveText.style.textShadow = '0 0 20px rgba(255, 255, 0, 0.8)';
      setTimeout(() => {
        this.waveText.style.color = '#0ff';
        this.waveText.style.textShadow = '0 0 8px rgba(0, 255, 255, 0.4)';
      }, 1500);
    }
  }

  updateHighScore(highScore) {
    this.highScoreText.textContent = `HIGH SCORE: ${highScore}`;
  }

  showGameOver() {
    const overlay = document.createElement('div');
    overlay.id = 'game-over-overlay';
    overlay.style.cssText = `
      position: fixed; top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0, 0, 0, 0.85); backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px);
      display: flex; justify-content: center; align-items: center; z-index: 100; color: #ff6666; font-family: 'Courier New', monospace;
    `;

    const title = document.createElement('h1');
    title.textContent = 'GAME OVER';
    title.style.cssText = `font-size: 48px; text-shadow: 0 0 30px rgba(255, 100, 100, 0.6); margin-bottom: 10px;`;

    const scoreDisplay = document.createElement('div');
    scoreDisplay.textContent = `Final Score: ${this.scoreText.textContent}`;
    scoreDisplay.style.cssText = `font-size: 24px; color: #ffaa00; text-shadow: 0 0 15px rgba(255, 170, 0, 0.6); margin-bottom: 30px;`;

    const restartBtn = document.createElement('button');
    restartBtn.textContent = 'PLAY AGAIN';
    restartBtn.style.cssText = `
      padding: 14px 32px; font-size: 18px; font-family: 'Courier New', monospace;
      background: transparent; color: #0ff; border: 2px solid #0ff; cursor: pointer;
      text-shadow: 0 0 15px rgba(0, 255, 255, 0.6); transition: all 0.3s ease;
    `;
    restartBtn.addEventListener('click', () => {
      overlay.remove();
      window.location.reload();
    });

    overlay.appendChild(title);
    overlay.appendChild(scoreDisplay);
    overlay.appendChild(restartBtn);
    document.body.appendChild(overlay);
  }

  hideGameOver() {
    const overlay = document.getElementById('game-over-overlay');
    if (overlay) overlay.remove();
  }

  showVictory() {
    const overlay = document.createElement('div');
    overlay.id = 'victory-overlay';
    overlay.style.cssText = `
      position: fixed; top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0, 0, 0, 0.85); backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px);
      display: flex; justify-content: center; align-items: center; z-index: 100; color: #0ff; font-family: 'Courier New', monospace;
    `;

    const title = document.createElement('h1');
    title.textContent = 'WAVE CLEARED!';
    title.style.cssText = `font-size: 48px; text-shadow: 0 0 30px rgba(0, 255, 255, 0.6); margin-bottom: 10px;`;

    const scoreDisplay = document.createElement('div');
    scoreDisplay.textContent = `Score: ${this.scoreText.textContent}`;
    scoreDisplay.style.cssText = `font-size: 24px; color: #ffaa00; text-shadow: 0 0 15px rgba(255, 170, 0, 0.6); margin-bottom: 30px;`;

    const nextWaveBtn = document.createElement('button');
    nextWaveBtn.textContent = 'NEXT WAVE';
    nextWaveBtn.style.cssText = `
      padding: 14px 32px; font-size: 18px; font-family: 'Courier New', monospace;
      background: transparent; color: #0ff; border: 2px solid #0ff; cursor: pointer;
      text-shadow: 0 0 15px rgba(0, 255, 255, 0.6); transition: all 0.3s ease;
    `;
    nextWaveBtn.addEventListener('click', () => {
      overlay.remove();
      window.location.reload();
    });

    overlay.appendChild(title);
    overlay.appendChild(scoreDisplay);
    overlay.appendChild(nextWaveBtn);
    document.body.appendChild(overlay);
  }
}