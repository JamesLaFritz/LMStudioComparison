// Glass HUD and menu screens for Space Invaders, built on the shared UIOverlay / MenuSystem.
import { UIOverlay, el } from '@shared/ui/UIOverlay.js';
import { MenuSystem } from '@shared/ui/MenuSystem.js';
import { COLORS, GAME } from '../config.js';

const POWER_LABEL = { SPREAD: 'SPREAD SHOT', RAPID: 'RAPID FIRE', SHIELD: 'SHIELD' };
const POWER_COLOR = { SPREAD: COLORS.CSS.AMBER, RAPID: COLORS.CSS.MAGENTA, SHIELD: COLORS.CSS.CYAN };
const MULT_COLOR = ['', COLORS.CSS.CYAN, COLORS.CSS.CYAN, COLORS.CSS.MAGENTA, COLORS.CSS.AMBER];

function formatTime(seconds) {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}

function pad(n) {
  return String(n).padStart(6, '0');
}

export class HUD {
  /**
   * @param {HTMLElement} container
   * @param {import('@shared/input/InputManager.js').InputManager} input
   * @param {import('@shared/core/EventBus.js').EventBus} events
   */
  constructor(container, input, events) {
    this.overlay = new UIOverlay(container);
    this.menu = new MenuSystem(this.overlay, input);
    this.events = events;
    this.menu.onNavigate = () => events.emit('ui:navigate', {});
    this.menu.onSelect = () => events.emit('ui:select', {});
    this._lives = -1;
    this._mult = -1;
    this._power = null;

    const o = this.overlay;

    const score = o.addPanel('scorePanel', { position: 'top-left' });
    score.appendChild(el('div', 'hud-label', 'Score'));
    o.bind('score', score.appendChild(el('div', 'hud-value', '000000')));

    const wave = o.addPanel('wavePanel', { position: 'top-center' });
    wave.appendChild(el('div', 'hud-label', 'Wave'));
    o.bind('wave', wave.appendChild(el('div', 'hud-value neon-magenta', '1')));

    const hi = o.addPanel('hiPanel', { position: 'top-right' });
    hi.appendChild(el('div', 'hud-label', 'Hi-Score'));
    o.bind('hiScore', hi.appendChild(el('div', 'hud-value neon-amber', '000000')));

    const lives = o.addPanel('livesPanel', { position: 'bottom-left' });
    lives.appendChild(el('div', 'hud-label', 'Cannons'));
    this.livesRow = lives.appendChild(el('div', 'hud-lives'));

    const status = o.addPanel('statusPanel', { position: 'bottom-right', className: 'hud-status empty' });
    this.statusPanel = status;
    this.comboChip = status.appendChild(el('div', 'chip off neon-cyan'));
    this.comboLabel = this.comboChip.appendChild(el('span', '', 'COMBO ×1'));
    const comboBar = this.comboChip.appendChild(el('div', 'chip-bar'));
    this.comboFill = comboBar.appendChild(el('i'));

    this.powerChip = status.appendChild(el('div', 'chip off neon-amber'));
    this.powerLabel = this.powerChip.appendChild(el('span', '', ''));
    const powerBar = this.powerChip.appendChild(el('div', 'chip-bar'));
    this.powerFill = powerBar.appendChild(el('i'));

    this.hint = o.root.appendChild(el('div', 'hint hidden', ''));
    this.setHudVisible(false);
  }

  setHudVisible(visible) {
    for (const id of ['scorePanel', 'wavePanel', 'hiPanel', 'livesPanel', 'statusPanel']) this.overlay.setVisible(id, visible);
  }

  setHint(text) {
    if (!text) {
      this.hint.classList.add('hidden');
      return;
    }
    this.hint.textContent = text;
    this.hint.classList.remove('hidden');
  }

  /**
   * @param {{score:number, hiScore:number, wave:number, lives:number, multiplier:number,
   *          comboProgress:number, power:{type:string|null, timer:number, duration:number}, shield:boolean}} s
   */
  update(s) {
    const o = this.overlay;
    o.setText('score', pad(s.score));
    o.setText('hiScore', pad(s.hiScore));
    o.setText('wave', String(s.wave));

    if (s.lives !== this._lives) {
      this._lives = s.lives;
      this.livesRow.replaceChildren();
      for (let i = 0; i < s.lives; i++) this.livesRow.appendChild(el('span', 'life-icon'));
    }

    const showCombo = s.multiplier > 1 || s.comboProgress > 0;
    this.comboChip.classList.toggle('off', !showCombo);
    if (showCombo) {
      if (s.multiplier !== this._mult) {
        this._mult = s.multiplier;
        this.comboLabel.textContent = `COMBO ×${s.multiplier}`;
        this.comboChip.style.color = MULT_COLOR[Math.min(4, s.multiplier)];
      }
      this.comboFill.style.transform = `scaleX(${s.comboProgress.toFixed(3)})`;
    } else {
      this._mult = -1;
    }

    const powerType = s.power.type || (s.shield ? 'SHIELD' : null);
    this.powerChip.classList.toggle('off', !powerType);
    this.statusPanel.classList.toggle('empty', !showCombo && !powerType);
    if (powerType) {
      if (powerType !== this._power) {
        this._power = powerType;
        this.powerLabel.textContent = POWER_LABEL[powerType];
        this.powerChip.style.color = POWER_COLOR[powerType];
      }
      const frac = s.power.type ? s.power.timer / s.power.duration : 1;
      this.powerFill.style.transform = `scaleX(${Math.max(0, Math.min(1, frac)).toFixed(3)})`;
    } else {
      this._power = null;
    }
  }

  banner(title, subtitle = '', opts = {}) {
    return this.overlay.banner(title, subtitle, opts);
  }

  toast(text, opts = {}) {
    return this.overlay.toast(text, opts);
  }

  _controlsFooter() {
    return (
      '<kbd>←</kbd><kbd>→</kbd> / <kbd>A</kbd><kbd>D</kbd> move &nbsp;·&nbsp; <kbd>SPACE</kbd> fire &nbsp;·&nbsp; <kbd>ESC</kbd> pause<br>' +
      'Gamepad: stick / d-pad move &nbsp;·&nbsp; <kbd>A</kbd> / <kbd>RT</kbd> fire &nbsp;·&nbsp; <kbd>START</kbd> pause'
    );
  }

  _statsBody(stats, score) {
    const grid = el('div', 'menu-stats');
    const rows = [
      ['Score', String(score)],
      ['Kills', String(stats.kills)],
      ['Accuracy', `${Math.round(stats.accuracy * 100)}%`],
      ['UFOs', String(stats.ufoKills)],
      ['Waves', String(stats.wavesCleared)],
      ['Time', formatTime(stats.time)],
    ];
    for (const [k, v] of rows) {
      const row = el('div', 'stat');
      row.appendChild(el('span', 'stat-k', k));
      row.appendChild(el('span', 'stat-v', v));
      grid.appendChild(row);
    }
    return grid;
  }

  showTitle({ onStart, hiScore }) {
    this.menu.show({
      eyebrow: 'Neon Arcade presents',
      title: 'SPACE INVADERS',
      subtitle: 'Neon Sector',
      body: `Repel ${GAME.WAVES_TO_WIN} waves to clear the sector.\nHi-score ${pad(hiScore)}`,
      items: [{ label: 'Start Mission', action: onStart }],
      footer: this._controlsFooter(),
    });
  }

  showPause({ onResume, onRestart, onQuit }) {
    this.menu.show({
      eyebrow: 'Stand by',
      title: 'PAUSED',
      titleClass: 'amber',
      items: [
        { label: 'Resume', action: onResume },
        { label: 'Restart', action: onRestart },
        { label: 'Quit to Title', action: onQuit },
      ],
      footer: this._controlsFooter(),
      onBack: onResume,
    });
  }

  showGameOver({ reason, stats, score, hiScore, isNewHi, onRetry, onTitle }) {
    this.menu.show({
      eyebrow: reason === 'invaded' ? 'The formation reached the surface' : 'All cannons lost',
      title: 'GAME OVER',
      titleClass: 'red',
      subtitle: isNewHi ? 'New hi-score!' : `Hi-score ${pad(hiScore)}`,
      body: this._statsBody(stats, score),
      items: [
        { label: 'Retry', action: onRetry },
        { label: 'Title', action: onTitle },
      ],
    });
  }

  showVictory({ stats, score, hiScore, isNewHi, onEndless, onTitle }) {
    this.menu.show({
      eyebrow: 'Sector secured',
      title: 'VICTORY',
      titleClass: 'lime',
      subtitle: isNewHi ? 'New hi-score!' : `Hi-score ${pad(hiScore)}`,
      body: this._statsBody(stats, score),
      items: [
        { label: 'Continue — Endless', action: onEndless },
        { label: 'Title', action: onTitle },
      ],
    });
  }

  hideMenu() {
    this.menu.hide();
  }

  get menuVisible() {
    return this.menu.visible;
  }

  updateMenu(realDt) {
    this.menu.update(realDt);
  }

  dispose() {
    this.menu.dispose();
    this.overlay.dispose();
  }
}
