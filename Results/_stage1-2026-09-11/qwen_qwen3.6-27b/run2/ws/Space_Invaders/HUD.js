export class HUD {
  constructor() {
    this._panel = document.getElementById('hud-panel');
    this._scoreEl = document.getElementById('hud-score');
    this._waveEl = document.getElementById('hud-wave');
    this._hpBar = document.getElementById('hud-hp-bar');
    this._comboEl = document.getElementById('hud-combo');
    this._multiplierEl = document.getElementById('hud-multiplier');
    this._overlay = document.getElementById('game-over-overlay');
    this._finalScore = document.getElementById('final-score');
    this._finalWave = document.getElementById('final-wave');
    this._finalKills = document.getElementById('final-kills');
    this._finalAccuracy = document.getElementById('final-accuracy');
    this._waveOverlay = document.getElementById('wave-overlay');
    this._waveText = document.getElementById('wave-text');
    this._startOverlay = document.getElementById('start-overlay');
    this._visible = true;
    this._maxHp = 3;
  }

  init() {
    // Build HP pips
    this._hpBar.innerHTML = '';
    for (let i = 0; i < this._maxHp; i++) {
      const pip = document.createElement('div');
      pip.className = 'hp-pip';
      this._hpBar.appendChild(pip);
    }
    this._pips = this._hpBar.querySelectorAll('.hp-pip');
    // Hide overlays
    this._overlay.classList.remove('visible');
    this._waveOverlay.classList.remove('visible');
  }

  update(score, wave, hp, maxHp, combo, multiplier) {
    if (!this._visible) return;
    this._scoreEl.textContent = score.toLocaleString();
    this._waveEl.textContent = `WAVE ${wave}`;
    // Update HP pips
    this._maxHp = maxHp;
    for (let i = 0; i < this._pips.length; i++) {
      if (i < hp) {
        this._pips[i].classList.remove('lost');
      } else {
        this._pips[i].classList.add('lost');
      }
    }
    if (multiplier > 1) {
      this._comboEl.style.display = 'block';
      this._comboEl.textContent = `COMBO ×${multiplier}`;
      this._comboEl.classList.add('active');
      this._multiplierEl.style.display = 'block';
      this._multiplierEl.textContent = `${combo}/${5}`;
    } else {
      this._comboEl.style.display = 'none';
      this._comboEl.classList.remove('active');
      this._multiplierEl.style.display = 'none';
    }
  }

  showGameOver(stats) {
    this._visible = false;
    this._panel.style.display = 'none';
    this._finalScore.textContent = stats.score.toLocaleString();
    this._finalWave.textContent = stats.wave;
    this._finalKills.textContent = stats.invadersKilled;
    this._finalAccuracy.textContent = `${stats.accuracy || 0}%`;
    this._overlay.classList.add('visible');
  }

  showWaveComplete(wave) {
    this._waveText.textContent = `WAVE ${wave} COMPLETE`;
    this._waveOverlay.classList.add('visible');
    setTimeout(() => { this._waveOverlay.classList.remove('visible'); }, 2500);
  }

  hide() { this._panel.style.display = 'none'; }

  dispose() {
    this._visible = false;
  }
}
