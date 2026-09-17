import { GAME_STATES } from '../config.js';

export class GameUI {
  constructor(root, callbacks = {}) {
    this.root = root;
    this.callbacks = {
      start: callbacks.start ?? (() => {}),
      resume: callbacks.resume ?? (() => {}),
      restart: callbacks.restart ?? (() => {}),
      toggleMute: callbacks.toggleMute ?? (() => {}),
      setReducedMotion: callbacks.setReducedMotion ?? (() => {}),
      setReducedFlashes: callbacks.setReducedFlashes ?? (() => {}),
    };
    this.abortController = new AbortController();
    this.cache = new Map();
    this.contextLost = false;
    this._build();
    this._bind();
  }

  _build() {
    this.root.innerHTML = `
      <div class="scanlines" aria-hidden="true"></div>
      <section class="hud" aria-label="Mission status">
        <div class="glass-chip hud__score">
          <span class="hud__label">SCORE</span>
          <strong id="hud-score">000000</strong>
          <span class="hud__sub">HI <b id="hud-high-score">000000</b></span>
        </div>
        <div class="glass-chip hud__wave">
          <span class="hud__label">SECTOR</span>
          <strong id="hud-wave">01 / 05</strong>
          <span id="hud-combo" class="hud__combo" hidden>×1.25 CHAIN</span>
        </div>
        <div class="glass-chip hud__status">
          <span class="hud__label">CANNONS</span>
          <strong id="hud-lives" aria-label="3 lives">◆ ◆ ◆</strong>
          <span class="hud__sub"><b id="hud-audio">AUDIO ON</b> · <b id="hud-pad">KEYS</b></span>
        </div>
      </section>

      <div id="world-text-layer" class="world-text-layer" aria-hidden="true"></div>
      <div id="toast" class="toast glass-chip" role="status" aria-live="polite" hidden></div>

      <section id="screen-title" class="screen screen--title" aria-labelledby="title-heading">
        <div class="screen__panel glass-panel">
          <p class="eyebrow">ORBITAL DEFENSE NETWORK // NODE 1978</p>
          <h1 id="title-heading"><span>SPACE</span> INVADERS</h1>
          <p class="title-deck">NEON BASTION</p>
          <div class="signal-line" aria-hidden="true"></div>
          <p class="objective">Hold the line through five descending sectors. Shields erode. The fleet accelerates.</p>
          <button id="start-button" class="neon-button" type="button">Initialize defense</button>
          <p class="controls"><kbd>A</kbd><kbd>D</kbd> / <kbd>←</kbd><kbd>→</kbd> move &nbsp; <kbd>SPACE</kbd> fire &nbsp; <kbd>P</kbd> pause</p>
          <p class="controller-hint">Gamepad: left stick / D-pad + A</p>
        </div>
      </section>

      <section id="screen-pause" class="screen" aria-labelledby="pause-heading" hidden>
        <div class="screen__panel glass-panel screen__panel--compact">
          <p class="eyebrow">TACTICAL FREEZE</p>
          <h2 id="pause-heading">Defense paused</h2>
          <button id="resume-button" class="neon-button" type="button">Resume</button>
          <div class="settings-grid">
            <label><input id="setting-mute" type="checkbox" /> Mute audio</label>
            <label><input id="setting-motion" type="checkbox" /> Reduce motion</label>
            <label><input id="setting-flashes" type="checkbox" /> Reduce flashes</label>
          </div>
          <button id="pause-restart-button" class="text-button" type="button">Restart campaign</button>
        </div>
      </section>

      <section id="screen-wave" class="screen screen--announcement" aria-live="polite" hidden>
        <div class="announcement">
          <p class="eyebrow">HOSTILE SIGNAL COLLAPSED</p>
          <h2 id="wave-message">Sector clear</h2>
        </div>
      </section>

      <section id="screen-victory" class="screen" aria-labelledby="victory-heading" hidden>
        <div class="screen__panel glass-panel">
          <p class="eyebrow">ALL SECTORS SECURED</p>
          <h2 id="victory-heading">Bastion holds</h2>
          <p class="result-score">Final score <strong id="victory-score">000000</strong></p>
          <p id="victory-record" class="record" hidden>NEW DEFENSE RECORD</p>
          <button id="victory-restart-button" class="neon-button" type="button">Defend again</button>
        </div>
      </section>

      <section id="screen-game-over" class="screen" aria-labelledby="game-over-heading" hidden>
        <div class="screen__panel glass-panel glass-panel--danger">
          <p class="eyebrow">DEFENSE NETWORK OFFLINE</p>
          <h2 id="game-over-heading">Game over</h2>
          <p id="game-over-cause" class="failure-cause">CANNON DESTROYED</p>
          <p class="result-score">Final score <strong id="game-over-score">000000</strong></p>
          <button id="game-over-restart-button" class="neon-button neon-button--danger" type="button">Reinitialize</button>
        </div>
      </section>

      <section id="screen-context" class="screen screen--context" role="alert" hidden>
        <div class="screen__panel glass-panel glass-panel--danger">
          <p class="eyebrow">RENDER LINK INTERRUPTED</p>
          <h2>Restoring graphics core…</h2>
          <p>The tactical simulation is safely paused.</p>
        </div>
      </section>

      <div id="announcer" class="sr-only" aria-live="assertive"></div>
    `;

    const byId = (id) => this.root.querySelector(`#${id}`);
    this.elements = {
      score: byId('hud-score'),
      highScore: byId('hud-high-score'),
      wave: byId('hud-wave'),
      combo: byId('hud-combo'),
      lives: byId('hud-lives'),
      audio: byId('hud-audio'),
      pad: byId('hud-pad'),
      toast: byId('toast'),
      title: byId('screen-title'),
      pause: byId('screen-pause'),
      waveScreen: byId('screen-wave'),
      waveMessage: byId('wave-message'),
      victory: byId('screen-victory'),
      victoryScore: byId('victory-score'),
      victoryRecord: byId('victory-record'),
      gameOver: byId('screen-game-over'),
      gameOverCause: byId('game-over-cause'),
      gameOverScore: byId('game-over-score'),
      context: byId('screen-context'),
      announcer: byId('announcer'),
      worldText: byId('world-text-layer'),
      muteSetting: byId('setting-mute'),
      motionSetting: byId('setting-motion'),
      flashesSetting: byId('setting-flashes'),
    };
  }

  _bind() {
    const options = { signal: this.abortController.signal };
    const bind = (id, event, callback) => this.root.querySelector(`#${id}`).addEventListener(event, callback, options);
    bind('start-button', 'click', () => this.callbacks.start());
    bind('resume-button', 'click', () => this.callbacks.resume());
    bind('pause-restart-button', 'click', () => this.callbacks.restart());
    bind('victory-restart-button', 'click', () => this.callbacks.restart());
    bind('game-over-restart-button', 'click', () => this.callbacks.restart());
    bind('setting-mute', 'change', (event) => this.callbacks.toggleMute(event.target.checked));
    bind('setting-motion', 'change', (event) => this.callbacks.setReducedMotion(event.target.checked));
    bind('setting-flashes', 'change', (event) => this.callbacks.setReducedFlashes(event.target.checked));
  }

  sync(simulation, profile, usingGamepad = false, audioAvailable = true) {
    this._setText('score', String(simulation.score).padStart(6, '0'));
    this._setText('highScore', String(simulation.highScore).padStart(6, '0'));
    this._setText('wave', `${String(simulation.wave).padStart(2, '0')} / 05`);
    this._setText('lives', simulation.player.lives > 0 ? '◆ '.repeat(simulation.player.lives).trim() : '—');
    this.elements.lives.setAttribute('aria-label', `${simulation.player.lives} lives`);
    const comboVisible = simulation.comboTier > 0 && simulation.state === GAME_STATES.PLAYING;
    this.elements.combo.hidden = !comboVisible;
    if (comboVisible) this._setText('combo', `×${(1 + simulation.comboTier * 0.25).toFixed(2)} CHAIN`);
    this._setText('audio', audioAvailable ? (profile.muted ? 'AUDIO OFF' : 'AUDIO ON') : 'AUDIO N/A');
    this._setText('pad', usingGamepad ? 'GAMEPAD' : 'KEYS');
    this.elements.muteSetting.checked = profile.muted;
    this.elements.motionSetting.checked = profile.reducedMotion;
    this.elements.flashesSetting.checked = profile.reducedFlashes;
    this.root.dataset.reducedMotion = String(profile.reducedMotion);
    this._showState(simulation);
    const shell = document.querySelector('#game-shell');
    shell.dataset.gameState = simulation.state;
    shell.dataset.score = String(simulation.score);
    shell.dataset.wave = String(simulation.wave);
    shell.dataset.lives = String(simulation.player.lives);
    shell.dataset.invaders = String(simulation.invaders.aliveCount);
  }

  _showState(simulation) {
    const state = simulation.state;
    this.elements.title.hidden = state !== GAME_STATES.TITLE;
    this.elements.pause.hidden = state !== GAME_STATES.PAUSED;
    this.elements.waveScreen.hidden = state !== GAME_STATES.WAVE_CLEAR;
    this.elements.victory.hidden = state !== GAME_STATES.VICTORY;
    this.elements.gameOver.hidden = state !== GAME_STATES.GAME_OVER;
    if (state === GAME_STATES.WAVE_CLEAR) {
      this.elements.waveMessage.textContent = simulation.wave >= 5 ? 'Campaign secured' : `Sector ${simulation.wave} clear`;
    }
    if (state === GAME_STATES.VICTORY) {
      this.elements.victoryScore.textContent = String(simulation.score).padStart(6, '0');
      this.elements.victoryRecord.hidden = simulation.score < simulation.highScore || simulation.score === 0;
    }
    if (state === GAME_STATES.GAME_OVER) {
      this.elements.gameOverScore.textContent = String(simulation.score).padStart(6, '0');
      this.elements.gameOverCause.textContent = simulation.gameOverCause.toUpperCase();
    }
  }

  _setText(key, value) {
    if (this.cache.get(key) === value) return;
    this.cache.set(key, value);
    this.elements[key].textContent = value;
  }

  announce(message) {
    this.elements.announcer.textContent = '';
    requestAnimationFrame(() => { this.elements.announcer.textContent = message; });
  }

  toast(message, duration = 1800) {
    clearTimeout(this.toastTimer);
    this.elements.toast.textContent = message;
    this.elements.toast.hidden = false;
    this.toastTimer = setTimeout(() => { this.elements.toast.hidden = true; }, duration);
  }

  setContextLost(lost) {
    this.contextLost = lost;
    this.elements.context.hidden = !lost;
    if (lost) this.announce('Graphics context lost. Simulation paused while recovery is attempted.');
  }

  dispose() {
    clearTimeout(this.toastTimer);
    this.abortController.abort();
    this.root.replaceChildren();
    this.cache.clear();
  }
}
