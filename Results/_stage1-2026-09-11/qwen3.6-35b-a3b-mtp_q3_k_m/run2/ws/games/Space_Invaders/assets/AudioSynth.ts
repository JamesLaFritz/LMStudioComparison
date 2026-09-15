import { AudioContextType } from '@shared/Engine';

export class AudioSynth {
    private ctx: AudioContextType | null = null;
    private masterGain: GainNode | null = null;
    private musicStarted = false;
    private musicNodes: (AudioScheduledSourceNode | GainNode)[] = [];
    private musicIntervalId: number | null = null;

    init(): void {
        if (this.ctx) return;
        this.ctx = new AudioContext();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = 0.3;
        this.masterGain.connect(this.ctx.destination);
    }

    private ensureCtx(): AudioContextType {
        if (!this.ctx) this.init();
        if (this.ctx!.state === 'suspended') this.ctx!.resume();
        return this.ctx!;
    }

    playShoot(): void {
        const ctx = this.ensureCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.25, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
        osc.connect(gain);
        gain.connect(this.masterGain!);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.12);
    }

    playAlienKill(): void {
        const ctx = this.ensureCtx();
        const t = ctx.currentTime;
        // Descending tone
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(600, t);
        osc.frequency.exponentialRampToValueAtTime(100, t + 0.25);
        gain.gain.setValueAtTime(0.3, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
        osc.connect(gain);
        gain.connect(this.masterGain!);
        osc.start(t);
        osc.stop(t + 0.27);
        // Noise burst
        const bufferSize = ctx.sampleRate * 0.1;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 3);
        }
        const noise = ctx.createBufferSource();
        noise.buffer = buffer;
        const nGain = ctx.createGain();
        nGain.gain.setValueAtTime(0.2, t);
        nGain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
        const filter = ctx.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.value = 2000;
        noise.connect(filter);
        filter.connect(nGain);
        nGain.connect(this.masterGain!);
        noise.start(t);
    }

    playPlayerDeath(): void {
        const ctx = this.ensureCtx();
        const t = ctx.currentTime;
        // Low rumble
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(80, t);
        osc.frequency.exponentialRampToValueAtTime(30, t + 0.6);
        gain.gain.setValueAtTime(0.5, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
        osc.connect(gain);
        gain.connect(this.masterGain!);
        osc.start(t);
        osc.stop(t + 0.62);
        // Sub-bass layer
        const sub = ctx.createOscillator();
        const subGain = ctx.createGain();
        sub.type = 'sine';
        sub.frequency.setValueAtTime(50, t);
        sub.frequency.exponentialRampToValueAtTime(20, t + 0.8);
        subGain.gain.setValueAtTime(0.4, t);
        subGain.gain.exponentialRampToValueAtTime(0.001, t + 0.8);
        sub.connect(subGain);
        subGain.connect(this.masterGain!);
        sub.start(t);
        sub.stop(t + 0.82);
    }

    playShieldHit(): void {
        const ctx = this.ensureCtx();
        const t = ctx.currentTime;
        const bufferSize = ctx.sampleRate * 0.06;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 5);
        }
        const noise = ctx.createBufferSource();
        noise.buffer = buffer;
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.15, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
        const filter = ctx.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.value = 3000;
        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain!);
        noise.start(t);
    }

    playSaucerBeep(): void {
        const ctx = this.ensureCtx();
        const t = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1200, t);
        gain.gain.setValueAtTime(0.15, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
        osc.connect(gain);
        gain.connect(this.masterGain!);
        osc.start(t);
        osc.stop(t + 0.1);
    }

    playWaveStart(): void {
        const ctx = this.ensureCtx();
        const t = ctx.currentTime;
        // Ascending arpeggio
        const notes = [261.6, 329.6, 392, 523.3];
        notes.forEach((freq, i) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.value = freq;
            const start = t + i * 0.1;
            gain.gain.setValueAtTime(0, start);
            gain.gain.linearRampToValueAtTime(0.2, start + 0.05);
            gain.gain.exponentialRampToValueAtTime(0.001, start + 0.3);
            osc.connect(gain);
            gain.connect(this.masterGain!);
            osc.start(start);
            osc.stop(start + 0.32);
        });
    }

    stopMusic(): void {
        this.musicNodes.forEach(n => { try { n.disconnect(); if ('stop' in n) (n as AudioScheduledSourceNode).stop(); } catch {} });
        this.musicNodes = [];
        if (this.musicIntervalId !== null) { clearInterval(this.musicIntervalId); this.musicIntervalId = null; }
        this.musicStarted = false;
    }

    startMusic(): void {
        if (this.musicStarted || !this.masterGain) return;
        this.musicStarted = true;
        const ctx = this.ensureCtx();
        let beatIndex = 0;
        // Bass pattern loop every 8 beats
        const bassPattern = [55, 55, 65.41, 65.41, 73.42, 73.42, 55, 55];
        const padChords = [[220, 330], [261.6, 392], [293.7, 440], [261.6, 392]];

        this.musicIntervalId = window.setInterval(() => {
            if (!this.ctx || !this.masterGain) return;
            const t = this.ctx.currentTime;
            const beat = beatIndex % 8;

            // Bass note
            const bassOsc = this.ctx.createOscillator();
            const bassGain = this.ctx.createGain();
            bassOsc.type = 'sawtooth';
            bassOsc.frequency.value = bassPattern[beat];
            bassGain.gain.setValueAtTime(0.15, t);
            bassGain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
            const bassFilter = this.ctx.createBiquadFilter();
            bassFilter.type = 'lowpass';
            bassFilter.frequency.value = 200;
            bassOsc.connect(bassFilter);
            bassFilter.connect(bassGain);
            bassGain.connect(this.masterGain);
            bassOsc.start(t);
            bassOsc.stop(t + 0.38);
            this.musicNodes.push(bassOsc, bassGain);

            // Hi-hat on beats 2 and 4 (index 1 and 3)
            if (beat % 2 === 1) {
                const hLen = ctx.sampleRate * 0.05;
                const hBuf = this.ctx.createBuffer(1, hLen, ctx.sampleRate);
                const hData = hBuf.getChannelData(0);
                for (let i = 0; i < hLen; i++) {
                    hData[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / hLen, 8);
                }
                const hNoise = this.ctx.createBufferSource();
                hNoise.buffer = hBuf;
                const hGain = this.ctx.createGain();
                hGain.gain.setValueAtTime(0.06, t);
                const hFilter = this.ctx.createBiquadFilter();
                hFilter.type = 'highpass';
                hFilter.frequency.value = 7000;
                hNoise.connect(hFilter);
                hFilter.connect(hGain);
                hGain.connect(this.masterGain);
                hNoise.start(t);
                this.musicNodes.push(hGain);
            }

            // Pad chord changes every 4 beats
            if (beat === 0) {
                const chordIdx = Math.floor(beatIndex / 4) % padChords.length;
                const freqs = padChords[chordIdx];
                freqs.forEach(f => {
                    const pOsc = this.ctx!.createOscillator();
                    const pGain = this.ctx.createGain();
                    pOsc.type = 'triangle';
                    pOsc.frequency.value = f;
                    pGain.gain.setValueAtTime(0.04, t);
                    pGain.gain.linearRampToValueAtTime(0.06, t + 0.5);
                    pGain.gain.exponentialRampToValueAtTime(0.001, t + 2);
                    pOsc.connect(pGain);
                    pGain.connect(this.masterGain!);
                    pOsc.start(t);
                    pOsc.stop(t + 2.1);
                    this.musicNodes.push(pOsc, pGain);
                });
            }

            beatIndex++;
        }, 250); // 4 BPM-ish (8 beats per 2 seconds)
    }
}
