/**
 * WaveIndicator - Displays current wave number and progress to next wave.
 */

class WaveIndicator {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    if (!this.container) return;

    // Create the indicator UI
    this.waveNumber = document.createElement('div');
    this.waveNumber.className = 'wave-number';
    this.waveNumber.textContent = 'Wave 1';
    this.container.appendChild(this.waveNumber);

    this.progressBarContainer = document.createElement('div');
    this.progressBarContainer.className = 'progress-bar-container';

    const progressBar = document.createElement('div');
    progressBar.className = 'progress-bar';
    this.progressBarContainer.appendChild(progressBar);

    this.progressText = document.createElement('div');
    this.progressText.className = 'progress-text';
    this.progressBarContainer.appendChild(this.progressText);

    this.container.appendChild(this.progressBarContainer);

    // Initialize wave indicator
    this.waveNumber.textContent = 'Wave 1';
  }

  update(wave) {
    if (wave !== undefined) {
      this.waveNumber.textContent = `Wave ${wave}`;
    }
  }

  setProgress(progress) {
    const progressBar = this.progressBarContainer.querySelector('.progress-bar');
    if (progressBar) {
      progressBar.style.width = `${Math.min(100, Math.max(0, progress * 100))}%`;
    }
  }

  showNextWaveMessage() {
    // Show a "Next Wave" message that fades out after delay
    const message = document.createElement('div');
    message.className = 'wave-message';
    message.textContent = 'Next Wave';
    this.container.appendChild(message);

    setTimeout(() => {
      if (message.parentNode) {
        message.remove();
      }
    }, 3000);
  }

  dispose() {
    // Clean up UI elements
    if (this.waveNumber.parentNode) {
      this.waveNumber.remove();
    }
    if (this.progressBarContainer.parentNode) {
      this.progressBarContainer.remove();
    }
  }
}

export default WaveIndicator;