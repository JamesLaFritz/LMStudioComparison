function element(tagName, className, text) {
  const node = document.createElement(tagName);
  if (className) {
    node.className = className;
  }
  if (text !== undefined) {
    node.textContent = text;
  }
  return node;
}

function finiteInteger(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.floor(number)) : fallback;
}

function displayScore(value) {
  return String(finiteInteger(value)).padStart(6, "0");
}

function readSnapshotValue(snapshot, names, fallback) {
  for (const name of names) {
    if (snapshot?.[name] !== undefined && snapshot?.[name] !== null) {
      return snapshot[name];
    }
  }
  return fallback;
}

export class SpaceInvadersHUD {
  constructor(options = {}) {
    this.options = options;
    this.root = null;
    this.scoreValue = null;
    this.highScoreValue = null;
    this.waveValue = null;
    this.livesValue = null;
    this.phaseValue = null;
    this.messageValue = null;
    this.lifeIcons = [];
    this.currentLives = -1;
    this.currentPhase = "ATTRACT";
  }

  mount(container) {
    if (!(container instanceof Element)) {
      throw new TypeError("SpaceInvadersHUD.mount requires a DOM container.");
    }
    this.dispose();

    const root = element("aside", "si-hud");
    root.setAttribute("aria-label", "Space Invaders status");
    root.dataset.phase = "ATTRACT";

    const scoreCluster = element("section", "si-hud__cluster glass-panel");
    scoreCluster.setAttribute("aria-label", "Scoreboard");
    scoreCluster.append(
      this.createStat("Score", "score"),
      this.createStat("High", "high-score"),
      this.createStat("Wave", "wave"),
    );

    const lifeCluster = element("section", "si-hud__lives glass-panel");
    lifeCluster.setAttribute("aria-label", "Remaining interceptors");
    const lifeHeader = element("span", "si-hud__label", "Fleet");
    this.livesValue = element("span", "si-hud__lives-value", "03");
    this.livesValue.dataset.gate = "lives";
    const lifeIcons = element("span", "si-hud__life-icons");
    lifeIcons.setAttribute("aria-hidden", "true");
    for (let index = 0; index < 6; index += 1) {
      const icon = element("span", "si-hud__life-icon");
      icon.dataset.gate = "life-icon";
      icon.dataset.index = String(index + 1);
      icon.hidden = index >= 3;
      lifeIcons.append(icon);
      this.lifeIcons.push(icon);
    }
    lifeCluster.append(lifeHeader, this.livesValue, lifeIcons);

    const phaseCluster = element("div", "si-hud__phase");
    this.phaseValue = element("span", "si-hud__phase-value", "STANDBY");
    this.messageValue = element("span", "si-hud__message", "Press fire to begin");
    this.messageValue.setAttribute("aria-live", "polite");
    phaseCluster.append(this.phaseValue, this.messageValue);

    root.append(scoreCluster, lifeCluster, phaseCluster);
    container.append(root);
    this.root = root;
    this.update({ score: 0, highScore: 0, wave: 1, lives: 3, phase: "ATTRACT" });
    return this;
  }

  createStat(label, gate) {
    const stat = element("div", "si-hud__stat");
    const labelNode = element("span", "si-hud__label", label);
    const value = element("strong", "si-hud__value", gate === "wave" ? "01" : "000000");
    value.dataset.gate = gate;
    stat.append(labelNode, value);
    if (gate === "score") {
      this.scoreValue = value;
    } else if (gate === "high-score") {
      this.highScoreValue = value;
    } else if (gate === "wave") {
      this.waveValue = value;
    }
    return stat;
  }

  update(snapshot = {}) {
    if (!this.root) {
      return;
    }
    const score = finiteInteger(readSnapshotValue(snapshot, ["score", "points"], 0));
    const highScore = finiteInteger(readSnapshotValue(snapshot, ["highScore", "highscore", "bestScore"], 0));
    const wave = Math.max(1, finiteInteger(readSnapshotValue(snapshot, ["wave", "level"], 1), 1));
    const lives = finiteInteger(readSnapshotValue(snapshot, ["lives", "remainingLives"], 3), 3);
    const phase = readSnapshotValue(snapshot, ["phase", "state"], this.currentPhase);

    this.scoreValue.textContent = displayScore(score);
    this.highScoreValue.textContent = displayScore(Math.max(score, highScore));
    this.waveValue.textContent = String(wave).padStart(2, "0");
    this.setLives(lives);
    this.setPhase(phase);
  }

  setLives(lives) {
    const normalized = Math.min(this.lifeIcons.length, finiteInteger(lives, 0));
    if (normalized === this.currentLives) {
      return;
    }
    this.currentLives = normalized;
    this.livesValue.textContent = String(normalized).padStart(2, "0");
    this.lifeIcons.forEach((icon, index) => {
      icon.hidden = index >= normalized;
    });
  }

  setPhase(phase, message) {
    const normalized = String(phase ?? "ATTRACT").replace(/[\s-]+/g, "_").toUpperCase();
    this.currentPhase = normalized;
    if (this.root) {
      this.root.dataset.phase = normalized;
    }
    if (this.phaseValue) {
      this.phaseValue.textContent = this.phaseLabel(normalized);
    }
    if (message !== undefined) {
      this.setMessage(message);
    } else if (this.messageValue) {
      this.messageValue.textContent = this.phaseMessage(normalized);
    }
  }

  setMessage(message) {
    if (this.messageValue) {
      this.messageValue.textContent = String(message ?? "");
    }
  }

  setVisible(visible) {
    if (this.root) {
      this.root.hidden = !visible;
    }
  }

  phaseLabel(phase) {
    const labels = {
      ATTRACT: "STANDBY",
      PLAYING: "ENGAGED",
      PAUSED: "PAUSED",
      LIFE_LOST: "REBUILDING",
      WAVE_CLEAR: "SECTOR CLEAR",
      GAME_OVER: "SIGNAL LOST",
      VICTORY: "VICTORY",
    };
    return labels[phase] ?? phase.replaceAll("_", " ");
  }

  phaseMessage(phase) {
    const messages = {
      ATTRACT: "Press fire to begin",
      PLAYING: "Defend the orbital lane",
      PAUSED: "Press pause to resume",
      LIFE_LOST: "Interceptor recalibrating",
      WAVE_CLEAR: "Prepare for the next wave",
      GAME_OVER: "Press restart to relaunch",
      VICTORY: "Orbit secured",
    };
    return messages[phase] ?? "";
  }

  dispose() {
    this.root?.remove();
    this.root = null;
    this.scoreValue = null;
    this.highScoreValue = null;
    this.waveValue = null;
    this.livesValue = null;
    this.phaseValue = null;
    this.messageValue = null;
    this.lifeIcons = [];
    this.currentLives = -1;
  }
}

export default SpaceInvadersHUD;
