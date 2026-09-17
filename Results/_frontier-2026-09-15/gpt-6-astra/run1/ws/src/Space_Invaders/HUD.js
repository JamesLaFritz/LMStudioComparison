import { PHASE } from "./config.js";
import { Overlay } from "../shared/ui/Overlay.js";
import { ResourceScope } from "../shared/core/ResourceScope.js";
const score = (n) => Math.max(0, n).toString().padStart(6, "0");
const CONTROL_HINTS = {
  keyboard:
    "<kbd>A</kbd><kbd>D</kbd> MOVE <i></i><kbd>SPACE</kbd> FIRE <i></i><kbd>ESC</kbd> PAUSE",
  gamepad:
    "<kbd>STICK</kbd> MOVE <i></i><kbd>A / R2</kbd> FIRE <i></i><kbd>START</kbd> PAUSE",
  touch: "HOLD ◀ / ▶ TO MOVE <i></i> HOLD FIRE TO SHOOT",
};
export class HUD {
  constructor({ mount, onAction, onVirtualInput }) {
    this.scope = new ResourceScope();
    this.onAction = onAction;
    this.onVirtualInput = onVirtualInput;
    this.currentPanel = "";
    this.navTime = 0;
    this.navDirection = 0;
    this.lastUpdate = 0;
    this.error = "";
    this.root = document.createElement("main");
    this.root.className = "game-shell";
    this.root.innerHTML = `<header class="topbar"><div class="brand"><span class="brand-mark" aria-hidden="true">✣</span><div><strong>SPACE INVADERS</strong><small>ORBITAL DEFENSE DIVISION</small></div></div><div class="score-cluster"><div class="score-readout"><span>SCORE</span><b id="score">000000</b></div><div class="best-readout"><span>PERSONAL BEST</span><b id="best">000000</b></div></div><div class="top-actions"><span class="online"><i></i> SYSTEM ONLINE</span><button data-action="audio" class="icon-button" aria-label="Enable audio" title="Enable audio">♫</button><button data-action="pause" class="icon-button" aria-label="Pause game" title="Pause · Esc">Ⅱ</button></div></header><div class="mission-strip"><div><span class="live-dot"></span><b id="sector">SECTOR 01</b><span class="divider">/</span><span id="objective">EARTH'S LAST LINE OF DEFENSE</span></div><div class="lives"><span>HULLS</span><b id="lives" aria-label="3 lives">▰ ▰ ▰</b><span class="wave-count" id="wave">01 / 03</span></div></div><div class="stage"><div class="field-corner top-left">N 037° · E 122°<br><span>DEFENSE GRID // ACTIVE</span></div><div class="field-corner top-right"><span id="remaining">55 HOSTILES</span><br><span>RANGE: LOW ORBIT</span></div><div class="label-layer" aria-hidden="true"></div><div class="screen-shade" aria-hidden="true"></div><div class="transition-message" hidden><small></small><strong></strong><span></span></div><div class="modal-layer"></div><div class="field-bottom"><span>▲ PLANETARY DEFENSE LINE</span><span>SHIELD ARRAY <b>04</b></span></div></div><div class="touch-controls"><button data-control="left" aria-label="Move left">◀</button><button data-control="fire" class="primary" aria-label="Fire">FIRE</button><button data-control="right" aria-label="Move right">▶</button></div><footer class="footer"><span id="control-hints"><kbd>A</kbd><kbd>D</kbd> MOVE <i></i><kbd>SPACE</kbd> FIRE <i></i><kbd>ESC</kbd> PAUSE</span><span class="footer-right"><span id="input-label">KEYBOARD READY</span><i></i>NEON SIEGE <b>01.00</b></span></footer><div class="sr-only" role="status" aria-live="polite" id="announcement"></div>`;
    mount.append(this.root);
    this.scope.defer(() => this.root.remove());
    this.stage = this.root.querySelector(".stage");
    this.labelRoot = this.root.querySelector(".label-layer");
    this.modalLayer = this.root.querySelector(".modal-layer");
    this.overlay = new Overlay({ mount: this.modalLayer });
    this.nodes = {};
    for (const id of [
      "score",
      "best",
      "sector",
      "objective",
      "lives",
      "wave",
      "remaining",
      "input-label",
      "control-hints",
      "announcement",
    ])
      this.nodes[id] = this.root.querySelector(`#${id}`);
    this.message = this.root.querySelector(".transition-message");
    this.createPanels();
    const click = (e) => {
      const b = e.target.closest("[data-action]");
      if (b) this.onAction(b.dataset.action);
    };
    this.root.addEventListener("click", click);
    this.scope.defer(() => this.root.removeEventListener("click", click));
    const change = (e) => {
      const control = e.target.closest("[data-setting]");
      if (control)
        this.onAction("setting", {
          key: control.dataset.setting,
          value: control.type === "checkbox" ? control.checked : control.value,
        });
    };
    this.root.addEventListener("input", change);
    this.scope.defer(() => this.root.removeEventListener("input", change));
    for (const button of this.root.querySelectorAll("[data-control]")) {
      const down = (e) => {
        e.preventDefault();
        button.setPointerCapture(e.pointerId);
        this.onVirtualInput(button.dataset.control, true, e.pointerId);
      };
      const up = (e) =>
        this.onVirtualInput(button.dataset.control, false, e.pointerId);
      for (const [event, fn] of [
        ["pointerdown", down],
        ["pointerup", up],
        ["pointercancel", up],
        ["lostpointercapture", up],
      ]) {
        button.addEventListener(event, fn);
        this.scope.defer(() => button.removeEventListener(event, fn));
      }
    }
  }
  createPanels() {
    const title = this.overlay.createPanel("title", {
      title: "Start defense",
      className: "title-panel",
    });
    title.innerHTML = `<div class="eyebrow"><span></span> TRANSMISSION 001 · INCOMING</div><h1>NEON<br><em>SIEGE</em><span class="title-cross">+</span></h1><p class="tagline">THE LAST LINE IS YOURS.</p><p class="intro">An armada at the edge of the atmosphere.<br>One interceptor. Three waves. No retreat.</p><div class="threat-guide"><span><i class="species crab"></i>10 PTS</span><span><i class="species squid"></i>20 PTS</span><span><i class="species scout"></i>30 PTS</span><span class="bonus">◇ BONUS CRAFT</span></div><button class="primary start-button" data-action="start"><span>START DEFENSE <b>↗</b></span><kbd>ENTER</kbd></button><div class="title-bottom"><button data-action="settings" class="subtle">Settings & controls</button><span><i class="live-dot"></i> READY FOR LAUNCH</span></div>`;
    const pause = this.overlay.createPanel("pause", {
      title: "Game paused",
      className: "small-panel",
    });
    pause.innerHTML = `<div class="eyebrow">SIGNAL HELD</div><h2>Defense on hold.</h2><p>Your position is secure. Resume when ready.</p><button class="primary wide" data-action="resume">RESUME DEFENSE <span>↗</span></button><button class="wide" data-action="settings">Settings & controls</button><button class="wide subtle" data-action="menu">Return to title</button>`;
    const settings = this.overlay.createPanel("settings", {
      title: "Settings",
      className: "settings-panel",
    });
    settings.innerHTML = `<div class="eyebrow">COCKPIT CONFIGURATION</div><h2>Make it yours.</h2><label>Music <input data-setting="music" type="range" min="0" max="1" step=".05" aria-label="Music volume"></label><label>Sound effects <input data-setting="sfx" type="range" min="0" max="1" step=".05" aria-label="Sound effects volume"></label><label>Graphics <select data-setting="quality" aria-label="Graphics quality"><option value="high">High</option><option value="balanced">Balanced</option><option value="low">Low</option></select></label><label>Camera shake <input type="checkbox" data-setting="shake"></label><label>Reduced effects <input type="checkbox" data-setting="reduced"></label><label>Touch controls <input type="checkbox" data-setting="touch"></label><div class="control-reference"><b>KEYBOARD</b><span>A / D or ← / → move · Space / W / ↑ fire<br>Enter confirm · Esc pause</span><b>CONTROLLER</b><span>Left stick / D-pad move · A / R2 fire<br>A confirm · B back · Start pause</span></div><button class="primary wide" data-action="back">SAVE & RETURN <span>↗</span></button>`;
    const result = this.overlay.createPanel("result", {
      title: "Mission result",
      className: "result-panel",
    });
    result.innerHTML = `<div class="eyebrow" id="result-eyebrow"></div><h2 id="result-title"></h2><p id="result-description"></p><div class="result-score"><span>FINAL SCORE</span><strong id="result-score"></strong><small id="new-best"></small></div><div class="result-stats"><div><span>WAVES CLEARED</span><b id="result-waves"></b></div><div><span>ACCURACY</span><b id="result-accuracy"></b></div><div><span>SHOTS FIRED</span><b id="result-shots"></b></div></div><button class="primary wide" data-action="start">DEFEND AGAIN <span>↗</span></button><button class="wide subtle" data-action="menu">Return to title</button>`;
    const error = this.overlay.createPanel("error", {
      title: "Graphics or runtime error",
      className: "small-panel",
    });
    error.innerHTML =
      '<div class="eyebrow">SIGNAL INTERRUPTED</div><h2>Unable to continue.</h2><p class="error-message"></p><button class="primary wide" data-action="reload">RETRY</button>';
  }
  update(view) {
    const s = view.state,
      panel = this.error
        ? "error"
        : view.settingsOpen
          ? "settings"
          : view.paused
            ? "pause"
            : s.phase === PHASE.TITLE
              ? "title"
              : s.phase === PHASE.VICTORY || s.phase === PHASE.GAME_OVER
                ? "result"
                : "";
    if (panel !== this.currentPanel) {
      this.currentPanel = panel;
      this.overlay.showPanel(panel);
      this.modalLayer.hidden = !panel;
      this.root.dataset.menu = String(!!panel);
      if (panel) this.overlay.focusFirst(panel);
      this.nodes.announcement.textContent =
        panel === "result"
          ? s.phase === PHASE.VICTORY
            ? "Victory. Earth is secure."
            : "Mission ended. " + s.reason
          : panel === "pause"
            ? "Game paused."
            : "";
      if (panel === "settings")
        for (const element of this.root.querySelectorAll("[data-setting]")) {
          const value = view.settings[element.dataset.setting];
          if (element.type === "checkbox") element.checked = value;
          else element.value = value;
        }
    }
    this.root.dataset.touch = String(view.settings.touch);
    this.nodes.score.textContent = score(s.score);
    this.nodes.best.textContent = score(view.best);
    this.nodes.sector.textContent = `SECTOR ${String(s.wave).padStart(2, "0")}`;
    this.nodes.wave.textContent = `${String(s.wave).padStart(2, "0")} / 03`;
    this.nodes.lives.textContent =
      "▰ ".repeat(Math.max(0, s.lives)).trim() || "—";
    this.nodes.lives.setAttribute("aria-label", `${s.lives} lives`);
    this.nodes.remaining.textContent = `${String(view.remaining).padStart(2, "0")} HOSTILES`;
    this.nodes.objective.textContent =
      s.phase === PHASE.TITLE
        ? "EARTH'S LAST LINE OF DEFENSE"
        : s.phase === PHASE.VICTORY
          ? "ALL SECTORS SECURED"
          : "CLEAR ALL THREE WAVES · HOLD THE LINE";
    this.nodes["input-label"].textContent =
      `${view.device.toUpperCase()} READY`;
    if (this.hintDevice !== view.device) {
      this.hintDevice = view.device;
      this.nodes["control-hints"].innerHTML =
        CONTROL_HINTS[view.device] || CONTROL_HINTS.keyboard;
    }
    const transition =
      !panel &&
      [PHASE.COUNTDOWN, PHASE.RESPAWNING, PHASE.WAVE_CLEAR].includes(s.phase);
    this.message.hidden = !transition;
    if (transition) {
      this.message.children[0].textContent =
        s.phase === PHASE.WAVE_CLEAR ? "SIGNAL CLEAR" : `SECTOR 0${s.wave}`;
      this.message.children[1].textContent =
        s.phase === PHASE.COUNTDOWN
          ? String(Math.ceil(s.timer))
          : s.phase === PHASE.RESPAWNING
            ? "RECONSTRUCTING"
            : "WAVE SECURED";
      this.message.children[2].textContent =
        s.phase === PHASE.COUNTDOWN
          ? "PREPARE TO ENGAGE"
          : s.phase === PHASE.RESPAWNING
            ? "SHIELD ONLINE ON RETURN"
            : "DEFENSE GRID RESTORING";
    }
    if (panel === "result") {
      const win = s.phase === PHASE.VICTORY;
      this.root.querySelector("#result-eyebrow").textContent = win
        ? "TRANSMISSION COMPLETE"
        : "TRANSMISSION LOST";
      this.root.querySelector("#result-title").textContent = win
        ? "Earth is still ours."
        : "The signal fades.";
      this.root.querySelector("#result-description").textContent = win
        ? "Three waves repelled. The last line held."
        : s.reason + ". The next defense starts with you.";
      this.root.querySelector("#result-score").textContent = score(s.score);
      this.root.querySelector("#new-best").textContent =
        s.score > 0 && s.score >= view.best
          ? "PERSONAL BEST"
          : "MISSION RECORD";
      this.root.querySelector("#result-waves").textContent =
        `${s.wavesCleared} / 3`;
      this.root.querySelector("#result-accuracy").textContent =
        `${s.shots ? Math.round((s.hits / s.shots) * 100) : 0}%`;
      this.root.querySelector("#result-shots").textContent = s.shots;
    }
  }
  handleNavigation(input, dt) {
    if (!this.currentPanel) return;
    if (input.backPressed) {
      this.onAction("back");
      return;
    }
    const panel = this.overlay.panels.get(this.currentPanel),
      elements = panel.querySelectorAll("button,input,select");
    if (!elements.length) return;
    let index = Array.prototype.indexOf.call(elements, document.activeElement);
    if (index < 0) index = 0;
    const direction = Math.abs(input.navY) > 0.5 ? Math.sign(input.navY) : 0;
    this.navTime -= dt;
    if (direction && (direction !== this.navDirection || this.navTime <= 0)) {
      index = (index + direction + elements.length) % elements.length;
      elements[index].focus({ preventScroll: true });
      this.navTime = direction === this.navDirection ? 0.1 : 0.3;
    }
    this.navDirection = direction;
    const focused = elements[index];
    if (input.confirmPressed) {
      if (focused.tagName === "BUTTON") focused.click();
      else if (focused.type === "checkbox") {
        focused.checked = !focused.checked;
        focused.dispatchEvent(new Event("input", { bubbles: true }));
      }
    }
    if (
      input.lastDevice === "gamepad" &&
      Math.abs(input.navX) > 0.5 &&
      this.navTime <= 0
    ) {
      if (focused.type === "range") {
        focused.value = String(
          Number(focused.value) + Math.sign(input.navX) * 0.05,
        );
        focused.dispatchEvent(new Event("input", { bubbles: true }));
      } else if (focused.tagName === "SELECT") {
        focused.selectedIndex = Math.max(
          0,
          Math.min(
            focused.options.length - 1,
            focused.selectedIndex + Math.sign(input.navX),
          ),
        );
        focused.dispatchEvent(new Event("input", { bubbles: true }));
      }
      this.navTime = 0.15;
    }
  }
  showError(message) {
    this.error = message;
    this.overlay.panels
      .get("error")
      .querySelector(".error-message").textContent = message;
  }
  dispose() {
    this.overlay.dispose();
    this.scope.dispose();
  }
}
