// shared/audio/mixer.js - Volume mixing, ducking, master control

export class Mixer {
  constructor() {
    this.masterGain = null;
    this.musicGain = null;
    this.sfxGain = null;
    
    // Ducking state
    this.duckTargetLevel = -12; // dB to duck to during impact
    this.duckDuration = 0.3; // seconds
    this.duckReleaseTime = 0.5; // seconds to return to normal
    
    this.isDucking = false;
    this.duckStartTime = 0;
    
    this.initialMusicVolume = -6; // dB (about 50%)
    this.currentMusicVolume = this.initialMusicVolume;
  }

  init(audioContext) {
    // Master gain node
    this.masterGain = audioContext.createGain();
    this.masterGain.gain.value = 0.8; // 80% master volume
    
    // Music gain node (for ducking)
    this.musicGain = audioContext.createGain();
    this.musicGain.gain.value = this.initialMusicVolume / 20 * Math.log10(Math.pow(10, 2/this.initialMusicVolume));
    
    // SFX gain node
    this.sfxGain = audioContext.createGain();
    this.sfxGain.gain.value = 0; // Start muted until user interaction
    
    // Connect: music -> master, sfx -> master, master -> destination
    this.musicGain.connect(this.masterGain);
    this.sfxGain.connect(this.masterGain);
    this.masterGain.connect(audioContext.destination);
    
    return {
      masterNode: this.masterGain,
      musicNode: this.musicGain,
      sfxNode: this.sfxGain
    };
  }

  setMasterVolume(value) {
    // value: 0.0 to 1.0
    if (this.masterGain) {
      this.masterGain.gain.value = Math.max(0, Math.min(1, value));
    }
  }

  setMusicVolume(value) {
    // value: 0.0 to 1.0
    if (this.musicGain) {
      const dbValue = this.dbFromLinear(value);
      this.musicGain.gain.setTargetAtTime(dbValue, this.musicGain.context.currentTime, 0.1);
      this.initialMusicVolume = dbValue;
    }
  }

  setSFXVolume(value) {
    // value: 0.0 to 1.0
    if (this.sfxGain) {
      this.sfxGain.gain.value = Math.max(0, Math.min(1, value));
    }
  }

  enableAudio() {
    // Unmute SFX on user interaction
    if (this.sfxGain) {
      this.sfxGain.gain.setTargetAtTime(1.0, this.sfxGain.context.currentTime, 0.1);
    }
  }

  triggerDucking() {
    const now = performance.now();
    
    if (!this.isDucking || (now - this.duckStartTime > this.duckDuration * 1000)) {
      this.isDucking = true;
      this.duckStartTime = now;
      
      if (this.musicGain) {
        const ctxTime = this.musicGain.context.currentTime;
        
        // Duck down quickly
        this.musicGain.gain.cancelScheduledValues(ctxTime);
        this.musicGain.gain.setValueAtTime(this.musicGain.gain.value, ctxTime);
        this.musicGain.gain.linearRampToValueAtTime(
          this.duckTargetLevel / 20 * Math.log10(Math.pow(10, 2/this.duckTargetLevel)),
          ctxTime + 0.05
        );
        
        // Schedule release after duck duration
        const releaseStart = ctxTime + this.duckDuration;
        this.musicGain.gain.linearRampToValueAtTime(
          this.initialMusicVolume / 20 * Math.log10(Math.pow(10, 2/this.initialMusicVolume)),
          releaseStart + this.duckReleaseTime
        );
      }
    }
  }

  dbFromLinear(linear) {
    // Convert linear volume (0-1) to decibels
    if (linear <= 0.001) return -Infinity;
    return 20 * Math.log10(linear);
  }

  linearFromDb(db) {
    // Convert decibels to linear volume (0-1)
    return Math.pow(10, db / 20);
  }
}
