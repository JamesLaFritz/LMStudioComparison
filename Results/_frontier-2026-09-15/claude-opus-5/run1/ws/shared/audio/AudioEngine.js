// Web Audio graph owner. The AudioContext is created lazily on the first user gesture (browser
// autoplay policy), so `ctx` is null until `unlock()` succeeds — every consumer must tolerate that.
//   sfxBus ─┐
//           ├─► master ─► compressor ─► destination
//   musicBus┘

export class AudioEngine {
  constructor({ masterVolume = 0.8, sfxVolume = 0.9, musicVolume = 0.5 } = {}) {
    this.ctx = null;
    this.master = null;
    this.sfxBus = null;
    this.musicBus = null;
    this.compressor = null;
    this.unlocked = false;
    this._volumes = { master: masterVolume, sfx: sfxVolume, music: musicVolume };
    this._unlocking = null;
  }

  get now() {
    return this.ctx ? this.ctx.currentTime : 0;
  }

  /** Create (if needed) and resume the context. Safe to call repeatedly; must originate from a gesture. */
  unlock() {
    if (this.unlocked) return Promise.resolve(true);
    if (this._unlocking) return this._unlocking;

    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return Promise.resolve(false);

    if (!this.ctx) {
      this.ctx = new Ctor({ latencyHint: 'interactive' });
      this.master = this.ctx.createGain();
      this.compressor = this.ctx.createDynamicsCompressor();
      this.compressor.threshold.value = -12;
      this.compressor.knee.value = 20;
      this.compressor.ratio.value = 6;
      this.compressor.attack.value = 0.003;
      this.compressor.release.value = 0.2;
      this.sfxBus = this.ctx.createGain();
      this.musicBus = this.ctx.createGain();
      this.master.gain.value = this._volumes.master;
      this.sfxBus.gain.value = this._volumes.sfx;
      this.musicBus.gain.value = this._volumes.music;
      this.sfxBus.connect(this.master);
      this.musicBus.connect(this.master);
      this.master.connect(this.compressor);
      this.compressor.connect(this.ctx.destination);
    }

    const finish = () => {
      this._unlocking = null;
      this.unlocked = this.ctx.state === 'running';
      return this.unlocked;
    };

    if (this.ctx.state === 'running') return Promise.resolve(finish());
    this._unlocking = this.ctx.resume().then(finish, finish);
    return this._unlocking;
  }

  setVolume(bus, value) {
    const v = Math.max(0, Math.min(1, value));
    this._volumes[bus] = v;
    const node = bus === 'master' ? this.master : bus === 'sfx' ? this.sfxBus : bus === 'music' ? this.musicBus : null;
    if (node && this.ctx) node.gain.setTargetAtTime(v, this.ctx.currentTime, 0.02);
  }

  suspend() {
    if (this.ctx && this.ctx.state === 'running') this.ctx.suspend();
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }

  dispose() {
    if (this.ctx) {
      const ctx = this.ctx;
      this.ctx = null;
      this.unlocked = false;
      ctx.close().catch(() => {});
    }
  }
}
