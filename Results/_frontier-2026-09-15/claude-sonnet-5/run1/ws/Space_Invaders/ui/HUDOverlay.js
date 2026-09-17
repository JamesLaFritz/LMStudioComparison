import { HUD } from '../../shared/ui/HUD.js';

/**
 * Space Invaders-specific bindings over the generic shared HUD scaffold.
 */
export class HUDOverlay {
  constructor(container) {
    this._hud = new HUD(container);
  }

  syncScore(scoringSystem) {
    this._hud.setScore(scoringSystem.score);
  }

  syncLives(player) {
    this._hud.setLives(player.lives);
  }

  syncWave(spawnSystem) {
    this._hud.setWave(spawnSystem.waveNumber);
  }

  showStartScreen(onStart) {
    this._hud.showOverlay({
      title: 'SPACE INVADERS',
      subtitle: 'WASD/Arrows to move · Space to fire (hold to charge) · Gamepad supported',
      buttonText: 'START',
      onButtonClick: onStart
    });
  }

  showPauseScreen(onResume) {
    this._hud.showOverlay({
      title: 'PAUSED',
      buttonText: 'RESUME',
      onButtonClick: onResume
    });
  }

  showGameOverScreen(finalScore, onRestart) {
    this._hud.showOverlay({
      title: 'GAME OVER',
      subtitle: `Final Score: ${finalScore}`,
      buttonText: 'RESTART',
      onButtonClick: onRestart
    });
  }

  showWaveClearScreen(waveNumber, onContinue) {
    this._hud.showOverlay({
      title: `WAVE ${waveNumber} CLEAR`,
      subtitle: 'Get ready...',
      buttonText: 'CONTINUE',
      onButtonClick: onContinue
    });
  }

  hideOverlay() {
    this._hud.hideOverlay();
  }

  dispose() {
    this._hud.dispose();
  }
}
