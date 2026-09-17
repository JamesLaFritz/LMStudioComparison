import './space-invaders.css';
import { PHASE } from '@space/GameConfig.js';

function createElement(tag, className, text = '') {
  const element = document.createElement(tag);
  element.className = className;
  element.textContent = text;
  return element;
}

export class SpaceInvadersUI {
  constructor(mount, callbacks) {
    this.callbacks = callbacks;
    this.root = createElement('section', 'game-ui');
    this.root.setAttribute('aria-live', 'polite');
    this.status = createElement('div', 'hud-status glass-panel');
    this.scoreValue = createElement('strong', 'hud-value', '000000');
    this.highValue = createElement('span', 'hud-high', 'HI 000000');
    this.lifeValue = createElement('span', 'hud-lives', '◈ ◈ ◈');
    this.waveValue = createElement('div', 'hud-wave glass-panel', 'WAVE 01');
    this.muteButton = createElement('button', 'hud-icon', 'SOUND ON');
    this.pauseButton = createElement('button', 'hud-icon', 'PAUSE');
    this.controlsHint = createElement('div', 'controls-hint', 'A / D OR ◀ / ▶ TO MOVE · SPACE OR A TO FIRE');
    this.scoreLayer = createElement('div', 'score-layer');
    this.overlay = createElement('div', 'overlay');
    this.card = createElement('div', 'overlay-card glass-panel');
    this.kicker = createElement('p', 'overlay-kicker', 'NEON BASTION');
    this.heading = createElement('h1', 'overlay-heading', 'SPACE INVADERS');
    this.message = createElement('p', 'overlay-message');
    this.primaryButton = createElement('button', 'primary-action', 'INITIATE DEFENSE');
    this.secondaryButton = createElement('button', 'secondary-action', 'RETURN TO TITLE');
    this.lastPhase = '';
    this.contextLost = false;

    this.status.append(
      createElement('span', 'hud-label', 'SCORE'),
      this.scoreValue,
      this.highValue,
      this.lifeValue,
    );
    const actionTray = createElement('div', 'hud-actions');
    actionTray.append(this.muteButton, this.pauseButton);
    this.card.append(this.kicker, this.heading, this.message, this.primaryButton, this.secondaryButton);
    this.overlay.append(this.card);
    this.root.append(this.status, this.waveValue, actionTray, this.controlsHint, this.scoreLayer, this.overlay);
    mount.appendChild(this.root);

    this._onPrimary = () => callbacks.onPrimary();
    this._onSecondary = () => callbacks.onSecondary();
    this._onMute = () => callbacks.onMute();
    this._onPause = () => callbacks.onPause();
    this.primaryButton.addEventListener('click', this._onPrimary);
    this.secondaryButton.addEventListener('click', this._onSecondary);
    this.muteButton.addEventListener('click', this._onMute);
    this.pauseButton.addEventListener('click', this._onPause);
  }

  _setOverlay(visible, kicker, heading, message, primary, secondary, showSecondary = false) {
    this.overlay.classList.toggle('is-visible', visible);
    this.kicker.textContent = kicker;
    this.heading.textContent = heading;
    this.message.textContent = message;
    this.primaryButton.textContent = primary;
    this.secondaryButton.textContent = secondary;
    this.secondaryButton.hidden = !showSecondary;
  }

  _updatePhase(state) {
    if (this.lastPhase === state.phase && !this.contextLost) {
      return;
    }
    this.lastPhase = state.phase;
    if (this.contextLost) {
      this._setOverlay(true, 'SIGNAL INTERRUPTED', 'RENDER LINK LOST', 'The graphics context is restoring. Your campaign state is preserved.', 'RETRY LINK', 'RETURN TO TITLE', true);
      return;
    }
    if (state.phase === PHASE.TITLE) {
      this._setOverlay(true, 'NEON BASTION // 2086', 'SPACE INVADERS', 'Defend the orbital command deck. Clear three waves before the invasion line falls.', 'INITIATE DEFENSE', 'CONTROLS: A/D + SPACE', false);
    } else if (state.phase === PHASE.PAUSED) {
      this._setOverlay(true, 'COMBAT SUSPENDED', 'PAUSED', 'Simulation is frozen. Resume when the deck is secure.', 'RESUME', 'RETURN TO TITLE', true);
    } else if (state.phase === PHASE.VICTORY) {
      this._setOverlay(true, 'SECTOR SECURED', 'VICTORY', 'The final formation has been dismantled. Command deck integrity restored.', 'PLAY AGAIN', 'RETURN TO TITLE', true);
    } else if (state.phase === PHASE.GAME_OVER) {
      this._setOverlay(true, 'DEFENSE BREACHED', 'GAME OVER', 'The invasion line has fallen. Rebuild the bastion and try again.', 'RESTART DEFENSE', 'RETURN TO TITLE', true);
    } else {
      this._setOverlay(false, '', '', '', '', '', false);
    }
  }

  setContextLost(value) {
    this.contextLost = value;
    this.lastPhase = '';
  }

  sync(state, muted) {
    this.scoreValue.textContent = String(state.score).padStart(6, '0');
    this.highValue.textContent = 'HI ' + String(state.highScore).padStart(6, '0');
    this.lifeValue.textContent = state.lives > 0 ? Array.from({ length: state.lives }, () => '◈').join(' ') : '—';
    this.waveValue.textContent = state.campaignWave > 0 ? 'WAVE ' + String(state.campaignWave).padStart(2, '0') : 'STANDBY';
    this.muteButton.textContent = muted ? 'SOUND OFF' : 'SOUND ON';
    this.pauseButton.textContent = state.phase === PHASE.PAUSED ? 'RESUME' : 'PAUSE';
    this.controlsHint.classList.toggle('is-hidden', state.phase === PHASE.PLAYING && state.elapsed > 8);
    this._updatePhase(state);
  }

  dispose() {
    this.primaryButton.removeEventListener('click', this._onPrimary);
    this.secondaryButton.removeEventListener('click', this._onSecondary);
    this.muteButton.removeEventListener('click', this._onMute);
    this.pauseButton.removeEventListener('click', this._onPause);
    this.root.remove();
  }
}
