import { GAME_MODE, UI_COMMAND } from '../config.js';

const command = (name, fallback) => UI_COMMAND[name] ?? fallback;

const COMMANDS = Object.freeze({
  START: command('START', 'start'),
  RESUME: command('RESUME', 'resume'),
  RESTART: command('RESTART', 'restart'),
  BACK: command('BACK', 'back'),
  MUTE: command('MUTE', 'mute'),
  SET_QUALITY: command('SET_QUALITY', 'set-quality'),
  SET_REDUCED_MOTION: command('SET_REDUCED_MOTION', 'set-reduced-motion'),
  SET_HIGH_CONTRAST: command('SET_HIGH_CONTRAST', 'set-high-contrast'),
  SET_SFX_VOLUME: command('SET_SFX_VOLUME', 'set-sfx-volume'),
  SET_MUSIC_VOLUME: command('SET_MUSIC_VOLUME', 'set-music-volume'),
  SET_AMBIENCE_VOLUME: command('SET_AMBIENCE_VOLUME', 'set-ambience-volume'),
  UNLOCK_AUDIO: 'unlock-audio',
  RELOAD: 'reload',
});

const MODE_COPY = Object.freeze({
  [GAME_MODE.BOOT]: {
    eyebrow: 'Orbital command link',
    title: 'Initializing',
    copy: 'Calibrating the defense lattice and procedural signal array.',
  },
  [GAME_MODE.TITLE]: {
    eyebrow: 'Sector 224 // Nine-wave campaign',
    title: 'Space Invaders',
    copy: 'Hold the orbital line through nine escalating formations. Move, fire, and carve your own lanes through the shields.',
  },
  [GAME_MODE.READY]: {
    eyebrow: 'Defense lattice online',
    title: 'Wave incoming',
    copy: 'Formation telemetry locked. Prepare to fire.',
  },
  [GAME_MODE.PAUSED]: {
    eyebrow: 'Simulation clock suspended',
    title: 'Paused',
    copy: 'The combat state is frozen. No lost time will be replayed when command resumes.',
  },
  [GAME_MODE.PLAYER_DYING]: {
    eyebrow: 'Critical hull event',
    title: 'Pilot link lost',
    copy: 'Rebuilding the defender from reserve systems.',
  },
  [GAME_MODE.WAVE_CLEAR]: {
    eyebrow: 'Formation neutralized',
    title: 'Sector clear',
    copy: 'Scanners are resolving the next invasion vector.',
  },
  [GAME_MODE.VICTORY]: {
    eyebrow: 'All nine sectors secured',
    title: 'Earth holds',
    copy: 'The invasion signal has collapsed. Your defense record is now in the command archive.',
  },
  [GAME_MODE.GAME_OVER]: {
    eyebrow: 'Defense perimeter breached',
    title: 'Signal lost',
    copy: 'The sector has fallen, but the command lattice is ready for another campaign.',
  },
});

const createElement = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};

const createHudValue = (label) => {
  const chip = createElement('div', 'glass-chip');
  const labelNode = createElement('span', 'hud-label', label);
  const valueNode = createElement('span', 'hud-value', '—');
  chip.append(labelNode, valueNode);
  return { chip, valueNode };
};

const createButton = (label, action, secondary = false) => {
  const button = createElement('button', `neon-button${secondary ? ' secondary' : ''}`, label);
  button.type = 'button';
  button.dataset.action = action;
  return button;
};

const createSetting = (label, control) => {
  const row = createElement('label', 'settings-row');
  row.append(createElement('span', '', label), control);
  return row;
};

const readLivingAliens = (state) => {
  if (Number.isFinite(state?.aliveAliens)) return state.aliveAliens;
  if (Number.isFinite(state?.livingAliens)) return state.livingAliens;
  if (Number.isFinite(state?.aliveCount)) return state.aliveCount;
  if (Number.isFinite(state?.formation?.livingCount)) return state.formation.livingCount;
  if (Number.isFinite(state?.formation?.aliveCount)) return state.formation.aliveCount;
  if (Number.isFinite(state?.pools?.aliens?.activeCount)) return state.pools.aliens.activeCount;
  if (Array.isArray(state?.aliens)) {
    let count = 0;
    for (let index = 0; index < state.aliens.length; index += 1) {
      if (state.aliens[index]?.active !== false) count += 1;
    }
    return count;
  }
  return 0;
};

const formatScore = (score) => Math.max(0, Number(score) || 0).toString().padStart(6, '0');

/** DOM-only command display. It observes state and emits semantic commands. */
export class SpaceInvadersUI {
  constructor({ root, onCommand } = {}) {
    if (!root) throw new TypeError('SpaceInvadersUI requires a root element');
    this.root = root;
    this.onCommand = typeof onCommand === 'function' ? onCommand : () => {};
    this.mounted = false;
    this.disposed = false;
    this.contextLost = false;
    this.fatalError = null;
    this.audioLocked = true;
    this.settingsOpen = false;
    this.lastMode = null;
    this.transientTimer = 0;
    this.nodes = Object.create(null);

    this._onClick = this._onClick.bind(this);
    this._onChange = this._onChange.bind(this);
    this._onInput = this._onInput.bind(this);
  }

  mount() {
    if (this.mounted || this.disposed) return;

    const hud = createElement('div', 'hud');
    hud.setAttribute('aria-live', 'polite');

    const leftCluster = createElement('div', 'hud-cluster left');
    const score = createHudValue('Score');
    const lives = createHudValue('Lives');
    leftCluster.append(score.chip, lives.chip);

    const centerCluster = createElement('div', 'hud-cluster center');
    const wave = createHudValue('Wave');
    const aliens = createHudValue('Invaders');
    centerCluster.append(wave.chip, aliens.chip);

    const rightCluster = createElement('div', 'hud-cluster right');
    const highScore = createHudValue('High score');
    const audio = createHudValue('Audio');
    rightCluster.append(highScore.chip, audio.chip);
    hud.append(leftCluster, centerCluster, rightCluster);

    const overlay = createElement('section', 'overlay-screen');
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'space-invaders-modal-title');

    const panel = createElement('div', 'glass-panel');
    const eyebrow = createElement('p', 'eyebrow');
    const title = createElement('h1', 'display-title');
    title.id = 'space-invaders-modal-title';
    const titleAccent = createElement('span', '', 'Orbital defense');
    title.append(document.createTextNode('Space Invaders'), titleAccent);
    const copy = createElement('p', 'panel-copy');
    const result = createElement('p', 'mission-result');

    const buttonRow = createElement('div', 'button-row');
    const startButton = createButton('Begin campaign', COMMANDS.START);
    const resumeButton = createButton('Resume defense', COMMANDS.RESUME);
    const restartButton = createButton('Restart campaign', COMMANDS.RESTART);
    const backButton = createButton('Return to title', COMMANDS.BACK, true);
    const settingsButton = createButton('Settings', 'toggle-settings', true);
    buttonRow.append(startButton, resumeButton, restartButton, backButton, settingsButton);

    const settings = createElement('div', 'settings-grid');
    settings.hidden = true;
    const quality = document.createElement('select');
    quality.name = 'qualityMode';
    quality.dataset.command = COMMANDS.SET_QUALITY;
    for (const [value, label] of [['auto', 'Adaptive'], ['forced-high', 'High fidelity'], ['forced-low', 'Low power']]) {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = label;
      quality.append(option);
    }

    const reducedMotion = document.createElement('input');
    reducedMotion.type = 'checkbox';
    reducedMotion.name = 'reducedMotion';
    reducedMotion.dataset.command = COMMANDS.SET_REDUCED_MOTION;

    const highContrast = document.createElement('input');
    highContrast.type = 'checkbox';
    highContrast.name = 'highContrast';
    highContrast.dataset.command = COMMANDS.SET_HIGH_CONTRAST;

    const sfxVolume = this._createRange('sfxVolume', COMMANDS.SET_SFX_VOLUME);
    const musicVolume = this._createRange('musicVolume', COMMANDS.SET_MUSIC_VOLUME);
    const ambienceVolume = this._createRange('ambienceVolume', COMMANDS.SET_AMBIENCE_VOLUME);
    const muteButton = createButton('Toggle mute', COMMANDS.MUTE, true);

    settings.append(
      createSetting('Render quality', quality),
      createSetting('Reduced motion', reducedMotion),
      createSetting('High contrast', highContrast),
      createSetting('Effects volume', sfxVolume),
      createSetting('Music volume', musicVolume),
      createSetting('Ambience volume', ambienceVolume),
      muteButton,
    );

    const controls = createElement(
      'p',
      'control-legend',
      'Move  A / D or ← / →   ·   Fire  W / ↑ / Space   ·   Pause  Esc / P   ·   Mute  M',
    );
    panel.append(eyebrow, title, copy, result, buttonRow, settings, controls);
    overlay.append(panel);

    const transient = createElement('div', 'transient-banner');
    transient.hidden = true;
    transient.setAttribute('role', 'status');
    transient.setAttribute('aria-live', 'assertive');

    const controlHint = createElement('div', 'control-hint', 'A / D move  ·  Space fires  ·  Esc pauses');
    const audioHint = createElement('button', 'audio-hint', 'Press any key or click for audio');
    audioHint.type = 'button';
    audioHint.dataset.action = COMMANDS.UNLOCK_AUDIO;

    this.root.replaceChildren(hud, overlay, transient, controlHint, audioHint);
    this.root.addEventListener('click', this._onClick);
    this.root.addEventListener('change', this._onChange);
    this.root.addEventListener('input', this._onInput);

    Object.assign(this.nodes, {
      hud,
      score: score.valueNode,
      lives: lives.valueNode,
      wave: wave.valueNode,
      aliens: aliens.valueNode,
      highScore: highScore.valueNode,
      audio: audio.valueNode,
      overlay,
      panel,
      eyebrow,
      title,
      titleAccent,
      copy,
      result,
      buttonRow,
      startButton,
      resumeButton,
      restartButton,
      backButton,
      settingsButton,
      settings,
      quality,
      reducedMotion,
      highContrast,
      sfxVolume,
      musicVolume,
      ambienceVolume,
      muteButton,
      controls,
      transient,
      controlHint,
      audioHint,
    });
    this.mounted = true;
  }

  _createRange(name, settingCommand) {
    const range = document.createElement('input');
    range.type = 'range';
    range.name = name;
    range.min = '0';
    range.max = '1';
    range.step = '0.05';
    range.dataset.command = settingCommand;
    return range;
  }

  _onClick(event) {
    const button = event.target.closest?.('[data-action]');
    if (!button || !this.root.contains(button)) return;
    const action = button.dataset.action;
    if (action === 'toggle-settings') {
      this.settingsOpen = !this.settingsOpen;
      this.nodes.settings.hidden = !this.settingsOpen;
      button.setAttribute('aria-expanded', String(this.settingsOpen));
      return;
    }
    this.onCommand(action);
  }

  _onChange(event) {
    const control = event.target;
    const settingCommand = control?.dataset?.command;
    if (!settingCommand) return;
    this.onCommand(settingCommand, control.type === 'checkbox' ? control.checked : control.value);
  }

  _onInput(event) {
    const control = event.target;
    const settingCommand = control?.dataset?.command;
    if (!settingCommand || control.type !== 'range') return;
    this.onCommand(settingCommand, Number(control.value));
  }

  render(state, profile = {}, inputKind = 'keyboard') {
    if (!this.mounted || this.disposed) return;
    const mode = state?.mode ?? GAME_MODE.BOOT;
    const score = Number(state?.score) || 0;
    const highScore = Math.max(Number(state?.highScore) || 0, Number(profile.highScore) || 0, score);
    const livesValue = state?.lives ?? state?.player?.lives ?? 0;
    const waveValue = state?.wave ?? state?.waveNumber ?? 1;
    const livingAliens = readLivingAliens(state);

    this.nodes.score.textContent = formatScore(score);
    this.nodes.lives.textContent = String(Math.max(0, Number(livesValue) || 0));
    this.nodes.wave.textContent = `${Math.max(1, Number(waveValue) || 1)} / 9`;
    this.nodes.aliens.textContent = String(Math.max(0, livingAliens));
    this.nodes.highScore.textContent = formatScore(highScore);
    this.nodes.audio.textContent = profile.muted ? 'Muted' : this.audioLocked ? 'Standby' : 'Online';
    this.nodes.audio.classList.toggle('danger', Boolean(profile.muted));

    document.body.classList.toggle('reduced-motion', Boolean(profile.reducedMotion));
    document.body.classList.toggle('high-contrast', Boolean(profile.highContrast));
    document.body.dataset.danger = String(Math.max(0, Math.min(1, Number(state?.danger) || 0)));

    this.nodes.quality.value = profile.qualityMode ?? 'auto';
    this.nodes.reducedMotion.checked = Boolean(profile.reducedMotion);
    this.nodes.highContrast.checked = Boolean(profile.highContrast);
    this.nodes.sfxVolume.value = String(profile.sfxVolume ?? 0.78);
    this.nodes.musicVolume.value = String(profile.musicVolume ?? 0.32);
    this.nodes.ambienceVolume.value = String(profile.ambienceVolume ?? 0.28);
    this.nodes.muteButton.textContent = profile.muted ? 'Restore audio' : 'Mute audio';
    this.nodes.audioHint.hidden = !this.audioLocked || Boolean(profile.muted);
    this.nodes.controlHint.textContent = inputKind === 'gamepad'
      ? 'Left stick / D-pad moves  ·  A / X fires  ·  Menu pauses'
      : 'A / D move  ·  Space fires  ·  Esc pauses';

    this._renderOverlay(mode, state);
    this.lastMode = mode;
  }

  _renderOverlay(mode, state) {
    if (this.fatalError) {
      this._renderBlocking(
        'Runtime fault',
        'Defense lattice offline',
        this.fatalError,
        [{ node: this.nodes.restartButton, label: 'Reload', action: COMMANDS.RELOAD }],
      );
      return;
    }
    if (this.contextLost) {
      this._renderBlocking(
        'Graphics context interrupted',
        'Rebuilding signal',
        'The simulation is safely suspended while GPU resources are restored.',
        [],
      );
      return;
    }

    const transientMode = mode === GAME_MODE.READY || mode === GAME_MODE.PLAYER_DYING || mode === GAME_MODE.WAVE_CLEAR;
    const visible = mode !== GAME_MODE.PLAYING && !transientMode;
    this.nodes.overlay.hidden = !visible;
    this.nodes.controlHint.hidden = mode !== GAME_MODE.PLAYING && !transientMode;
    if (!visible) {
      if (mode !== this.lastMode) {
        if (mode === GAME_MODE.READY) this.showTransient(`Wave ${state?.wave ?? 1}  ·  defense lattice online`, 'info');
        else if (mode === GAME_MODE.WAVE_CLEAR) this.showTransient('Formation neutralized', 'success');
      }
      return;
    }

    const copy = MODE_COPY[mode] ?? MODE_COPY[GAME_MODE.BOOT];
    this.nodes.restartButton.textContent = 'Restart campaign';
    this.nodes.restartButton.dataset.action = COMMANDS.RESTART;
    this.nodes.eyebrow.textContent = copy.eyebrow;
    this.nodes.title.firstChild.nodeValue = copy.title;
    this.nodes.titleAccent.textContent = mode === GAME_MODE.TITLE ? 'Orbital defense' : `Wave ${state?.wave ?? 1}`;
    this.nodes.copy.textContent = copy.copy;
    this.nodes.result.textContent = '';
    this.nodes.result.hidden = true;

    if (mode === GAME_MODE.GAME_OVER) {
      const invasion = state?.gameOverReason === 'invasion';
      this.nodes.eyebrow.textContent = invasion ? 'Invasion perimeter crossed' : 'Reserve fleet exhausted';
      this.nodes.title.firstChild.nodeValue = invasion ? 'Line breached' : 'No reserves';
      this.nodes.titleAccent.textContent = invasion ? 'Formation overrun' : 'Final craft lost';
      this.nodes.copy.textContent = invasion
        ? 'The formation crossed the orbital line with reserve craft still standing.'
        : 'The final defender was destroyed before the sector could be secured.';
    }

    const buttonVisibility = {
      start: mode === GAME_MODE.TITLE,
      resume: mode === GAME_MODE.PAUSED,
      restart: mode === GAME_MODE.PAUSED || mode === GAME_MODE.VICTORY || mode === GAME_MODE.GAME_OVER,
      back: mode === GAME_MODE.PAUSED || mode === GAME_MODE.VICTORY || mode === GAME_MODE.GAME_OVER,
      settings: mode === GAME_MODE.TITLE || mode === GAME_MODE.PAUSED,
    };
    this.nodes.startButton.hidden = !buttonVisibility.start;
    this.nodes.resumeButton.hidden = !buttonVisibility.resume;
    this.nodes.restartButton.hidden = !buttonVisibility.restart;
    this.nodes.backButton.hidden = !buttonVisibility.back;
    this.nodes.settingsButton.hidden = !buttonVisibility.settings;
    this.nodes.settings.hidden = !buttonVisibility.settings || !this.settingsOpen;
    this.nodes.controls.hidden = !(mode === GAME_MODE.TITLE || mode === GAME_MODE.PAUSED);

    if (mode === GAME_MODE.VICTORY || mode === GAME_MODE.GAME_OVER) {
      this.nodes.result.hidden = false;
      const reason = mode === GAME_MODE.VICTORY
        ? 'Campaign complete'
        : state?.gameOverReason === 'invasion'
          ? 'Cause: invasion perimeter crossed'
          : 'Cause: reserve craft exhausted';
      this.nodes.result.textContent = `${reason}  ·  Score ${formatScore(state?.score)}`;
    }
  }

  _renderBlocking(eyebrow, title, copy, buttons) {
    this.nodes.overlay.hidden = false;
    this.nodes.controlHint.hidden = true;
    this.nodes.eyebrow.textContent = eyebrow;
    this.nodes.title.firstChild.nodeValue = title;
    this.nodes.titleAccent.textContent = 'System notice';
    this.nodes.copy.textContent = copy;
    this.nodes.result.hidden = true;
    this.nodes.settings.hidden = true;
    this.nodes.startButton.hidden = true;
    this.nodes.resumeButton.hidden = true;
    this.nodes.restartButton.hidden = true;
    this.nodes.backButton.hidden = true;
    this.nodes.settingsButton.hidden = true;
    for (let index = 0; index < buttons.length; index += 1) {
      const spec = buttons[index];
      spec.node.hidden = false;
      spec.node.textContent = spec.label;
      spec.node.dataset.action = spec.action;
    }
  }

  showTransient(text, tone = 'info') {
    if (!this.mounted || this.disposed) return;
    clearTimeout(this.transientTimer);
    this.nodes.transient.textContent = String(text);
    this.nodes.transient.dataset.tone = tone;
    this.nodes.transient.hidden = false;
    this.transientTimer = setTimeout(() => {
      if (this.nodes.transient) this.nodes.transient.hidden = true;
    }, tone === 'critical' ? 2200 : 1400);
  }

  setAudioLocked(value) {
    this.audioLocked = Boolean(value);
    if (this.mounted) this.nodes.audioHint.hidden = !this.audioLocked;
  }

  setContextLost(value) {
    this.contextLost = Boolean(value);
  }

  showFatalError(error) {
    this.fatalError = error instanceof Error ? error.message : String(error || 'Unknown runtime error');
    if (this.mounted) this._renderOverlay(this.lastMode ?? GAME_MODE.BOOT, {});
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    clearTimeout(this.transientTimer);
    if (this.mounted) {
      this.root.removeEventListener('click', this._onClick);
      this.root.removeEventListener('change', this._onChange);
      this.root.removeEventListener('input', this._onInput);
      this.root.replaceChildren();
    }
    document.body.classList.remove('reduced-motion', 'high-contrast');
    delete document.body.dataset.danger;
    this.mounted = false;
    this.onCommand = null;
    this.nodes = Object.create(null);
    this.root = null;
  }
}
