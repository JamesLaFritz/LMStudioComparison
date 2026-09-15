/**
 * LivesDisplay - UI component for displaying player lives.
 * Renders heart icons with visual feedback on damage/death.
 */

class LivesDisplay {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    if (!this.container) {
      console.warn(`LivesDisplay: Container #${containerId} not found`);
      return;
    }
    this.lives = 3;
    this.maxLives = 3;
    this.createHeartIcons();
  }

  createHeartIcons() {
    // Clear existing content
    this.container.innerHTML = '';

    for (let i = 0; i < this.maxLives; i++) {
      const heart = document.createElement('div');
      heart.className = 'heart-icon';
      heart.style.opacity = i < this.lives ? '1' : '0.25';
      heart.style.transform = `scale(${i < this.lives ? 1 : 0.7})`;
      this.container.appendChild(heart);
    }
  }

  updateLives(lives) {
    if (lives !== this.lives) {
      this.lives = lives;
      const hearts = this.container.querySelectorAll('.heart-icon');
      for (let i = 0; i < hearts.length; i++) {
        hearts[i].style.opacity = i < this.lives ? '1' : '0.25';
        hearts[i].style.transform = `scale(${i < this.lives ? 1 : 0.7})`;
      }
    }
  }

  showDeathEffect() {
    // Flash all hearts red briefly on death
    const hearts = this.container.querySelectorAll('.heart-icon');
    hearts.forEach((heart, i) => {
      if (i < this.lives) {
        heart.style.color = '#ff3333';
        heart.style.transform = 'scale(1.2)';
        setTimeout(() => {
          heart.style.color = '';
          heart.style.transform = '';
        }, 500);
      }
    });
  }

  reset() {
    this.lives = this.maxLives;
    this.createHeartIcons();
  }
}

export default LivesDisplay;