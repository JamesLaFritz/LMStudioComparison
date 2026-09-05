const STORAGE_KEY = 'space_invaders_hs';

export class GameState {
  constructor() {
    this.score = 0;
    this.lives = 3;
    this.wave = 1;
    this.highScore = this._loadHighScore();
    this.gameOver = false;
    this.paused = false;
    this.kills = 0;
  }

  addScore(points) {
    this.score += points;
    if (this.score > this.highScore) {
      this.highScore = this.score;
      this._saveHighScore();
    }
    return this.score;
  }

  incrementKills() {
    this.kills++;
  }

  getKillCount() {
    return this.kills;
  }

  getWave() {
    return this.wave;
  }

  setGameOver(value) {
    this.gameOver = value;
  }

  resetForNewGame() {
    this.score = 0;
    this.lives = 3;
    this.wave = 1;
    this.kills = 0;
    this.gameOver = false;
    this.paused = false;
  }

  loseLife() {
    this.lives--;
    return this.lives <= 0;
  }

  _loadHighScore() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        return typeof data.score === 'number' ? data.score : 0;
      }
    } catch (_) { /* ignore */ }
    return 0;
  }

  _saveHighScore() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ score: this.highScore, timestamp: Date.now() }));
    } catch (_) { /* ignore */ }
  }
}
