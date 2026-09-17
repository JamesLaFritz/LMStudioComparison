// Maps game events to synthesised sounds and drives the music bed. Subscribes on construction,
// unsubscribes on dispose. The four-note march is locked to formation steps.
import { SFXSynth } from '@shared/audio/SFXSynth.js';
import { MusicSequencer } from '@shared/audio/MusicSequencer.js';
import { WORLD } from '../config.js';

export class SoundBank {
  /**
   * @param {import('@shared/audio/AudioEngine.js').AudioEngine} audio
   * @param {import('@shared/core/EventBus.js').EventBus} events
   */
  constructor(audio, events) {
    this.audio = audio;
    this.events = events;
    this.sfx = new SFXSynth(audio);
    this.music = new MusicSequencer(audio, { bpm: 96 });
    this.marchIndex = 0;
    this.ufoHandle = null;
    this.musicWanted = false;
    this.intensity = 0.3;

    const pan = (x) => Math.max(-1, Math.min(1, x / WORLD.HALF_WIDTH)) * 0.6;

    this._subs = [
      events.on('player:fired', ({ x }) => this.sfx.play('laser', { volume: 0.9, pan: pan(x) })),
      events.on('invader:killed', ({ x, pitch }) => this.sfx.play('hitInvader', { pitch: pitch ?? 1, pan: pan(x) })),
      events.on('invader:step', ({ aliveCount }) => {
        const tempo = 1 - aliveCount / 55;
        this.sfx.march(this.marchIndex++, { volume: 0.85 + 0.15 * tempo, pitch: 1 + 0.08 * tempo });
      }),
      events.on('invader:drop', () => this.sfx.play('drop', { volume: 0.8 })),
      events.on('invader:fired', ({ x }) => this.sfx.play('laserAlien', { volume: 0.5, pan: pan(x) })),
      events.on('bunker:hit', ({ x }) => this.sfx.play('bunkerHit', { volume: 0.8, pan: pan(x) })),
      events.on('bullet:cancelled', ({ x }) => this.sfx.play('cancel', { pan: pan(x) })),
      events.on('player:shielded', () => this.sfx.play('shieldHit')),
      events.on('player:died', () => {
        this.stopUfo();
        this.sfx.play('playerDeath');
      }),
      events.on('ufo:spawn', () => {
        this.stopUfo();
        this.ufoHandle = this.sfx.ufoLoop({ volume: 0.9 });
      }),
      events.on('ufo:escaped', () => this.stopUfo()),
      events.on('ufo:killed', ({ x }) => {
        this.stopUfo();
        this.sfx.play('ufoKill', { pan: pan(x) });
      }),
      events.on('powerup:collected', () => this.sfx.play('powerup')),
      events.on('life:extra', () => this.sfx.play('extraLife')),
      events.on('wave:clear', () => this.sfx.play('waveClear')),
      events.on('game:over', () => {
        this.stopUfo();
        this.setMusic(false);
        this.sfx.play('gameOver');
      }),
      events.on('game:victory', () => {
        this.stopUfo();
        this.setMusic(false);
        this.sfx.play('victory');
      }),
      events.on('ui:navigate', () => this.sfx.play('ui', { volume: 0.7 })),
      events.on('ui:select', () => this.sfx.play('uiSelect', { volume: 0.8 })),
    ];
  }

  stopUfo() {
    if (this.ufoHandle) {
      this.ufoHandle.stop();
      this.ufoHandle = null;
    }
  }

  /** Music can only start once audio is unlocked; `update()` retries until it does. */
  setMusic(on, intensity = this.intensity) {
    this.musicWanted = on;
    this.intensity = intensity;
    if (on) {
      this.music.setIntensity(intensity);
      this.music.start();
    } else {
      this.music.stop();
    }
  }

  setIntensity(value) {
    this.intensity = value;
    this.music.setIntensity(value);
  }

  update() {
    if (this.musicWanted && !this.music.running && this.audio.unlocked) this.music.start();
  }

  dispose() {
    for (const off of this._subs) off();
    this._subs = [];
    this.stopUfo();
    this.music.dispose();
  }
}
