function makeNode(tagName, className, text) {
  const node = document.createElement(tagName);
  if (className) {
    node.className = className;
  }
  if (text !== undefined) {
    node.textContent = text;
  }
  return node;
}

function normalizePhase(phase) {
  return String(phase ?? "PLAYING").replace(/[\s-]+/g, "_").toUpperCase();
}

const OVERLAY_CONTENT = Object.freeze({
  ATTRACT: {
    eyebrow: "Orbital command // sector 05",
    title: "Space Invaders",
    message: "A hostile formation is moving through the upper atmosphere.",
    prompt: "Press fire or select begin defense",
    primary: "Begin defense",
    action: "start",
  },
  PAUSED: {
    eyebrow: "Combat link suspended",
    title: "Mission paused",
    message: "The simulation is held. Your formation and score remain intact.",
    prompt: "Press P, Escape, or resume",
    primary: "Resume mission",
    action: "resume",
  },
  GAME_OVER: {
    eyebrow: "Orbital defense // signal lost",
    title: "Game over",
    message: "The invasion breached the defense line.",
    prompt: "Press R or launch a fresh defense run",
    primary: "Restart run",
    action: "restart",
  },
  VICTORY: {
    eyebrow: "Orbital defense // sector secure",
    title: "Victory",
    message: "All five formations have been cleared from the orbital lane.",
    prompt: "Press fire to continue or restart for another campaign",
    primary: "Restart campaign",
    action: "restart",
  },
});

export class ScreenOverlay {
  constructor({ onStart, onResume, onRestart, onExit } = {}) {
    this.onStart = typeof onStart === "function" ? onStart : () => {};
    this.onResume = typeof onResume === "function" ? onResume : () => {};
    this.onRestart = typeof onRestart === "function" ? onRestart : () => {};
    this.onExit = typeof onExit === "function" ? onExit : () => {};
    this.root = null;
    this.eyebrow = null;
    this.title = null;
    this.message = null;
    this.prompt = null;
    this.primary = null;
    this.currentPhase = "PLAYING";
    this.abortController = null;
  }

  mount(container) {
    if (!(container instanceof Element)) {
      throw new TypeError("ScreenOverlay.mount requires a DOM container.");
    }
    this.dispose();

    this.abortController = new AbortController();
    const signal = this.abortController.signal;
    const root = makeNode("section", "si-screen-overlay");
    root.hidden = true;
    root.setAttribute("aria-live", "polite");
    root.setAttribute("aria-atomic", "true");
    root.dataset.phase = "PLAYING";

    const panel = makeNode("div", "si-screen-overlay__panel glass-panel");
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-modal", "false");
    panel.setAttribute("aria-labelledby", "si-screen-title");
    this.eyebrow = makeNode("p", "eyebrow");
    this.title = makeNode("h1", "si-screen-overlay__title");
    this.title.id = "si-screen-title";
    this.message = makeNode("p", "si-screen-overlay__message");
    this.prompt = makeNode("p", "si-screen-overlay__prompt");
    const actions = makeNode("div", "si-screen-overlay__actions");
    this.primary = makeNode("button", "neon-button neon-button--primary");
    this.primary.type = "button";
    this.primary.dataset.gate = "restart";
    this.primary.addEventListener("click", () => this.invokePrimary(), { signal });
    const exit = makeNode("button", "neon-button", "Return to arcade");
    exit.type = "button";
    exit.addEventListener("click", () => this.onExit(), { signal });
    actions.append(this.primary, exit);
    panel.append(this.eyebrow, this.title, this.message, this.prompt, actions);
    root.append(panel);
    container.append(root);
    this.root = root;
    return this;
  }

  update(snapshot = {}) {
    const phase = typeof snapshot === "string" ? snapshot : snapshot?.phase ?? snapshot?.state;
    this.setPhase(phase, typeof snapshot === "object" ? snapshot : {});
  }

  setPhase(phase, details = {}) {
    const normalized = normalizePhase(phase);
    this.currentPhase = normalized;
    const content = OVERLAY_CONTENT[normalized];
    if (!this.root) {
      return;
    }
    this.root.dataset.phase = normalized;
    this.root.dataset.gate = normalized === "GAME_OVER" ? "game-over" : "overlay";
    this.root.hidden = !content;
    this.root.setAttribute("aria-hidden", String(!content));
    if (!content) {
      return;
    }

    this.eyebrow.textContent = content.eyebrow;
    this.title.textContent = content.title;
    this.message.textContent = this.composeMessage(content.message, details);
    this.prompt.textContent = content.prompt;
    this.primary.textContent = content.primary;
    this.primary.dataset.action = content.action;
    this.primary.dataset.gate = content.action === "restart" ? "restart" : "overlay-action";
  }

  composeMessage(defaultMessage, details) {
    if (details?.message) {
      return String(details.message);
    }
    if (this.currentPhase === "GAME_OVER" && Number.isFinite(Number(details?.score))) {
      return `${defaultMessage} Final score: ${Math.max(0, Math.floor(Number(details.score))).toLocaleString()}.`;
    }
    return defaultMessage;
  }

  invokePrimary() {
    const action = this.primary?.dataset.action;
    if (action === "start") {
      this.onStart();
    } else if (action === "resume") {
      this.onResume();
    } else if (action === "restart") {
      this.onRestart();
    }
  }

  hide() {
    this.setPhase("PLAYING");
  }

  dispose() {
    this.abortController?.abort();
    this.abortController = null;
    this.root?.remove();
    this.root = null;
    this.eyebrow = null;
    this.title = null;
    this.message = null;
    this.prompt = null;
    this.primary = null;
  }
}

export default ScreenOverlay;
