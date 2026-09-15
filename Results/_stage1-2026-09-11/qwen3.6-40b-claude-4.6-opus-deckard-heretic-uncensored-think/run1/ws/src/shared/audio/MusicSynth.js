/**
 * Music Synthesis - Procedural music generation using Web Audio API oscillators and envelopes
 */
class MusicSynth {
    constructor(audioContext) {
        this.audioContext = audioContext;
        this._oscillators = [];
        this._gainNodes = [];
        this.isPlaying = false;

        // Initialize music parameters
        this._tempo = 120; // BPM
        this._key = 'C';
        this._scale = [4, 5, 6, 7]; // Scale degrees

        // Bind methods
        this._updateMusic = this._updateMusic.bind(this);
    }

    start(gainNode) {
        if (this.isPlaying) return;

        this._gainNode = gainNode;
        this._initializeOscillators();
        this._setupGainNodes();
        this._connectToGainNode();

        // Start music loop
        setInterval(this._updateMusic, 1000 / (this._tempo / 60));
        this.isPlaying = true;
    }

    stop() {
        if (!this.isPlaying) return;

        // Fade out and stop all oscillators
        this._oscillators.forEach(oscillator => {
            oscillator.stop();
        });

        this._gainNodes.forEach(gainNode => {
            gainNode.disconnect();
        });

        clearInterval(this._updateInterval);
        this.isPlaying = false;
    }

    _initializeOscillators() {
        // Create oscillators for different voices (bass, melody, harmony)
        const frequencies = [
            120, // Bass note
            240, // Melody note
            360  // Harmony note
        ];

        frequencies.forEach((freq, i) => {
            const oscillator = this.audioContext.createOscillator();
            oscillator.type = 'sawtooth';
            oscillator.frequency.value = freq;
            this._oscillators.push(oscillator);
        });
    }

    _setupGainNodes() {
        // Create gain nodes for each voice with different volumes
        const volumes = [0.3, 0.5, 0.2];

        this._oscillators.forEach((oscillator, i) => {
            const gainNode = this.audioContext.createGain();
            gainNode.gain.value = volumes[i];

            // Connect oscillator to gain node
            oscillator.connect(gainNode);
            this._gainNodes.push(gainNode);
        });
    }

    _connectToGainNode() {
        // Connect all gain nodes to main gain node
        this._gainNodes.forEach((gainNode, i) => {
            if (i === 0) {
                gainNode.connect(this._gainNode);
            } else {
                gainNode.connect(this._gainNode);
            }
        });
    }

    _updateMusic() {
        // Update music based on current time and tempo
        const currentTime = this.audioContext.currentTime;

        // Apply rhythmic patterns to gain nodes
        this._gainNodes.forEach((gainNode, i) => {
            // Simple rhythmic pattern (4/4 time signature)
            const beat = Math.floor(currentTime * this._tempo / 60);

            if ((beat % 4) === i) {
                gainNode.gain.value = 1.0;
            } else {
                gainNode.gain.value = 0.5;
            }
        });
    }

    destroy() {
        this.stop();

        // Clear references and dispose resources
        this._oscillators.forEach(oscillator => {
            oscillator.disconnect();
        });

        this._gainNodes.forEach(gainNode => {
            gainNode.disconnect();
        });

        this._oscillators = [];
        this._gainNodes = [];
    }
}

export default MusicSynth;
