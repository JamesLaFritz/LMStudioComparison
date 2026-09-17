import { CONFIG, PHASE, EVENT } from "./config.js";
import { Gameplay } from "./Gameplay.js";
import { World } from "./World.js";
import { HUD } from "./HUD.js";
import { GameLoop } from "../shared/core/GameLoop.js";
import { InputController } from "../shared/core/InputController.js";
import { ResourceScope } from "../shared/core/ResourceScope.js";
import { clamp } from "../shared/core/math.js";
import { RenderPipeline } from "../shared/rendering/RenderPipeline.js";
import { EffectsManager } from "../shared/vfx/EffectsManager.js";
import { AudioSystem } from "../shared/audio/AudioSystem.js";
const STORAGE = "neon-siege:v1";
const FX_DEFAULT = {
  x: 0,
  y: 0,
  vx: 0,
  vy: 0,
  count: 0,
  palette: 0,
  priority: 0,
  trauma: 0,
  freeze: 0,
  rings: 0,
  score: 0,
  radius: 0.12,
  life: 0.4,
  speed: 3,
};
const ALIEN_PALETTES = [1, 2, 3];
export class Game {
  constructor({ mount }) {
    this.mount = mount;
    this.scope = new ResourceScope();
    this.disposed = false;
    this.paused = false;
    this.settingsOpen = false;
    this.contextLost = false;
    this.presentationTime = 0;
    this.hudTimer = 0;
    this.lastPhase = "";
    this.resizePending = true;
    this.exhaustTimer = 0;
    this.slowTime = 0;
    this.qualityCooldown = 10;
    this.params = new URLSearchParams(location.search);
    this.best = 0;
    this.settings = {
      music: 0.25,
      sfx: 0.5,
      quality: "balanced",
      shake: true,
      reduced: matchMedia("(prefers-reduced-motion: reduce)").matches,
      touch: matchMedia("(pointer: coarse)").matches,
      muted: false,
    };
    this.loadSettings();
    this.fxSpec = { ...FX_DEFAULT };
    this.audioParams = { x: 0, priority: 1, note: 0 };
    this.musicParams = {
      tempo: 100,
      section: 0,
      tension: 0,
      playing: false,
      saucer: false,
    };
    this.fxFrame = {
      dt: 0,
      simulated: 0,
      paused: false,
      reduced: false,
      shake: true,
      density: 1,
      sources: null,
    };
    this.view = {
      state: null,
      settings: this.settings,
      best: this.best,
      paused: false,
      settingsOpen: false,
      remaining: 55,
      device: "keyboard",
    };
    this.handleAction = this.handleAction.bind(this);
    this.handleEvent = this.handleEvent.bind(this);
  }
  loadSettings() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE) || "null");
      if (!saved) return;
      if (Number.isFinite(saved.best) && saved.best >= 0)
        this.best = Math.min(999999999, Math.floor(saved.best));
      const s = saved.settings;
      if (!s || typeof s !== "object") return;
      for (const key of ["music", "sfx"])
        if (Number.isFinite(s[key])) this.settings[key] = clamp(s[key], 0, 1);
      for (const key of ["shake", "reduced", "touch", "muted"])
        if (typeof s[key] === "boolean") this.settings[key] = s[key];
      if (["high", "balanced", "low"].includes(s.quality))
        this.settings.quality = s.quality;
    } catch {
      /* Storage is optional; defaults remain usable. */
    }
  }
  persist() {
    try {
      localStorage.setItem(
        STORAGE,
        JSON.stringify({ best: this.best, settings: this.settings }),
      );
    } catch {
      /* Private/storage-disabled browsers can still play. */
    }
  }
  initialize() {
    this.input = new InputController();
    this.audio = new AudioSystem(128);
    this.hud = new HUD({
      mount: this.mount,
      onAction: this.handleAction,
      onVirtualInput: (...args) => this.input.setVirtual(...args),
    });
    this.pipeline = new RenderPipeline({
      mount: this.hud.stage,
      onContextLost: () => {
        this.contextLost = true;
        this.pause();
        this.world.releaseEnvironment();
      },
      onContextRestored: () => {
        if (this.disposed) return;
        this.world.rebuildEnvironment(this.pipeline.renderer);
        this.pipeline.rebuild();
        this.world.sync(this.gameplay, 1, this.presentationTime);
        this.pipeline.warmup();
        this.contextLost = false;
        this.paused = true;
        this.resizePending = true;
      },
      onError: (error) => this.fail(error),
    });
    this.world = new World({
      renderer: this.pipeline.renderer,
      config: CONFIG,
      seed: 128,
    });
    this.pipeline.setScene(this.world.scene, this.world.camera);
    this.gameplay = new Gameplay({ seed: 1 });
    this.view.state = this.gameplay.state;
    this.effects = new EffectsManager({
      scene: this.world.scene,
      camera: this.world.camera,
      labelRoot: this.hud.labelRoot,
      impactLights: this.world.impactLights,
      seed: 787,
      budgets: CONFIG.budgets,
    });
    this.fxFrame.sources = this.world.trailSources;
    this.loop = new GameLoop({
      fixedDt: 1 / 120,
      maxSteps: 8,
      beforeFrame: (dt) => this.beforeFrame(dt),
      fixedUpdate: (h) => {
        this.gameplay.step(h, this.actions);
        this.gameplay.events.drain(this.handleEvent);
        this.effects.flush();
      },
      render: (alpha, dt, simulated) => this.render(alpha, dt, simulated),
      getSimulationDelta: (dt) =>
        this.paused || this.contextLost ? 0 : this.effects.hitStop.consume(dt),
      shouldHaltSteps: () => this.paused || this.effects.hitStop.active,
    });
    const observe = new ResizeObserver(() => {
      this.resizePending = true;
    });
    observe.observe(this.hud.stage);
    this.scope.defer(() => observe.disconnect());
    const blur = () => {
      if (this.activePhase()) this.pause();
    };
    const visibility = () => {
      if (document.hidden && this.activePhase()) this.pause();
    };
    const error = (e) =>
      this.fail(e.error || new Error(e.message || "Unexpected runtime error"));
    for (const [target, name, fn] of [
      [window, "blur", blur],
      [document, "visibilitychange", visibility],
      [window, "error", error],
    ]) {
      target.addEventListener(name, fn);
      this.scope.defer(() => target.removeEventListener(name, fn));
    }
    if (this.params.has("debug")) {
      window.__SPACE_INVADERS__ = Object.freeze({
        snapshot: () => this.getDiagnostics(),
      });
      this.scope.defer(() => delete window.__SPACE_INVADERS__);
    }
    this.applySettings();
    this.resize();
    this.actions = this.input.sample();
    this.world.sync(this.gameplay, 1, 0);
    this.refreshHUD();
    this.pipeline.warmup();
    this.mount.querySelector("#startup-status")?.remove();
    this.loop.start();
  }
  activePhase() {
    const phase = this.gameplay?.state.phase;
    return (
      !!phase &&
      phase !== PHASE.TITLE &&
      phase !== PHASE.VICTORY &&
      phase !== PHASE.GAME_OVER
    );
  }
  pause() {
    if (!this.gameplay) return;
    this.paused = true;
    this.input.clear();
    this.effects?.hitStop.clear();
    this.loop?.resetTime();
    this.audio?.setPaused(true);
    this.refreshHUD();
  }
  handleAction(action, data) {
    if (this.disposed) return;
    if (action === "start") {
      const seed = this.params.has("seed")
        ? Number(this.params.get("seed")) >>> 0
        : crypto.getRandomValues(new Uint32Array(1))[0];
      this.paused = false;
      this.settingsOpen = false;
      this.effects.reset();
      this.audio.reset();
      this.gameplay.reset(seed);
      this.input.requireRelease();
      this.loop.resetTime();
      this.gameplay.events.drain(this.handleEvent);
      this.effects.flush();
      this.audio.setPaused(false);
      this.unlockAudio();
    } else if (action === "pause") {
      if (this.gameplay.state.phase === PHASE.TITLE) {
        this.settingsOpen = true;
        this.input.requireRelease();
      } else if (this.activePhase()) {
        if (this.paused) this.handleAction("resume");
        else this.pause();
      }
    } else if (action === "resume") {
      if (this.contextLost || document.hidden) return;
      this.paused = false;
      this.settingsOpen = false;
      this.input.requireRelease();
      this.loop.resetTime();
      this.audio.setPaused(false);
      this.unlockAudio();
    } else if (action === "settings") {
      this.settingsOpen = true;
      if (this.activePhase()) this.pause();
      this.input.requireRelease();
    } else if (action === "back") {
      if (this.settingsOpen) this.settingsOpen = false;
      else if (this.paused) this.handleAction("resume");
    } else if (action === "menu") {
      this.paused = false;
      this.settingsOpen = false;
      this.gameplay.showTitle();
      this.effects.reset();
      this.audio.reset();
      this.audio.setPaused(false);
      this.input.requireRelease();
      this.loop.resetTime();
    } else if (action === "audio") {
      if (this.audio.ready) this.settings.muted = !this.settings.muted;
      this.applySettings();
      this.persist();
      this.unlockAudio();
    } else if (action === "setting") {
      if (data.key === "music" || data.key === "sfx")
        this.settings[data.key] = clamp(Number(data.value), 0, 1);
      else if (
        data.key === "quality" &&
        ["high", "balanced", "low"].includes(data.value)
      )
        this.settings.quality = data.value;
      else if (["reduced", "shake", "touch"].includes(data.key))
        this.settings[data.key] = !!data.value;
      this.applySettings();
      this.persist();
    } else if (action === "reload") {
      location.reload();
      return;
    }
    this.refreshHUD();
  }
  unlockAudio() {
    this.audio.unlock().then((ready) => {
      if (this.disposed) return;
      const b = this.hud.root.querySelector('[data-action="audio"]');
      b.textContent = this.settings.muted ? "♪" : "♫";
      b.setAttribute(
        "aria-label",
        !ready
          ? "Enable audio"
          : this.settings.muted
            ? "Unmute audio"
            : "Mute audio",
      );
      b.title = !ready
        ? "Click to enable audio"
        : this.settings.muted
          ? "Audio muted"
          : "Audio enabled";
    });
  }
  applySettings() {
    this.audio?.setVolumes(
      this.settings.muted ? 0 : this.settings.music,
      this.settings.muted ? 0 : this.settings.sfx,
    );
    this.resizePending = true;
  }
  beforeFrame(dt) {
    this.actions = this.input.sample(dt);
    if (this.actions.disconnected && this.activePhase()) this.pause();
    if (this.actions.pausePressed && !this.settingsOpen) {
      this.handleAction("pause");
      this.actions.backPressed = false;
    }
    this.hud.handleNavigation(this.actions, dt);
    if (this.resizePending) this.resize();
  }
  resize() {
    if (!this.pipeline || !this.effects) return;
    this.resizePending = false;
    const rect = this.hud.stage.getBoundingClientRect();
    this.pipeline.resize(rect.width, rect.height, this.settings.quality);
    this.effects.resize(rect);
  }
  handleEvent(e) {
    this.best = Math.max(this.best, this.gameplay.state.score);
    const p = this.fxSpec;
    Object.assign(p, FX_DEFAULT);
    p.x = e.x;
    p.y = e.y;
    p.vx = e.vx;
    p.vy = e.vy;
    const sound = this.audioParams;
    sound.x = e.x;
    sound.priority = 1;
    sound.note = e.value;
    const impact = clamp(Math.abs(e.vx * e.nx + e.vy * e.ny) / 32, 0, 1);
    let cue = "";
    if (e.type === EVENT.SHOT) {
      p.count = e.owner ? 2 : 5;
      p.palette = e.owner;
      p.priority = 0;
      cue = e.owner ? "enemy" : "laser";
    } else if (e.type === EVENT.KILL) {
      p.count = 18;
      p.palette = ALIEN_PALETTES[e.owner];
      p.priority = 1;
      p.trauma = 0.08 + 0.1 * impact;
      p.freeze = 0.012 + 0.01 * impact;
      p.rings = 1;
      p.score = e.value;
      cue = "impact";
    } else if (e.type === EVENT.BUNKER) {
      p.count = 5;
      p.palette = 3;
      p.priority = 1;
      p.trauma = 0.015 * impact;
      cue = "chip";
    } else if (e.type === EVENT.INTERCEPT) {
      p.count = 6;
      p.palette = 0;
      p.priority = 1;
      p.trauma = 0.03;
      cue = "chip";
    } else if (e.type === EVENT.SHIELD) {
      p.count = 6;
      p.palette = 0;
      p.priority = 1;
      p.trauma = 0.04;
      p.rings = 1;
      p.speed = 2;
      cue = "chip";
    } else if (e.type === EVENT.DAMAGE) {
      p.count = 90;
      p.palette = 0;
      p.priority = 3;
      p.trauma = 0.48 + 0.22 * impact;
      p.freeze = 0.08;
      p.rings = 2;
      p.life = 0.65;
      p.speed = 6;
      cue = "heavy";
      sound.priority = 3;
    } else if (e.type === EVENT.SAUCER) {
      p.count = 48;
      p.palette = 2;
      p.priority = 2;
      p.trauma = 0.3;
      p.freeze = 0.05;
      p.rings = 1;
      p.score = e.value;
      p.speed = 5;
      p.life = 0.55;
      cue = "heavy";
      sound.priority = 2;
    } else if (e.type === EVENT.LIFE) {
      p.score = "HULL +1";
      p.palette = 0;
      p.priority = 2;
      p.count = 16;
      p.rings = 1;
      cue = "confirm";
    } else if (e.type === EVENT.MARCH) {
      cue = "march";
    } else if (e.type === EVENT.PHASE) {
      if (e.phase === PHASE.WAVE_CLEAR) {
        p.count = 40;
        p.priority = 2;
        p.rings = 1;
        p.life = 1;
        p.speed = 18;
        p.palette = 0;
        cue = "victory";
      } else if (e.phase === PHASE.VICTORY) {
        cue = "victory";
        this.persist();
      } else if (e.phase === PHASE.GAME_OVER) {
        cue = "defeat";
        this.persist();
      }
    }
    if (p.count || p.score || p.rings) this.effects.queue(p);
    if (cue) this.audio.play(cue, sound);
  }
  render(alpha, dt, simulated) {
    if (!this.paused) this.presentationTime += dt;
    this.world.sync(this.gameplay, alpha, this.presentationTime);
    if (!this.paused && this.gameplay.entities.player.activeCount) {
      this.exhaustTimer += dt;
      if (this.exhaustTimer > 0.06) {
        this.exhaustTimer = 0;
        const p = this.fxSpec;
        Object.assign(p, FX_DEFAULT);
        p.x = this.world.ship.position.x;
        p.y = CONFIG.playerY - 0.3;
        p.count = 1;
        p.vy = -18;
        this.effects.queue(p);
        this.effects.flush();
      }
    }
    const frame = this.fxFrame;
    frame.dt = dt;
    frame.simulated = simulated;
    frame.paused = this.paused;
    frame.reduced = this.settings.reduced;
    frame.shake = this.settings.shake;
    frame.density = this.settings.quality === "low" ? 0.6 : 1;
    this.effects.update(frame);
    const state = this.gameplay.state,
      music = this.musicParams;
    music.tempo = clamp(
      80 + (1 - this.gameplay.entities.aliens.activeCount / 55) * 70,
      80,
      150,
    );
    music.section = state.wave - 1;
    music.playing =
      state.phase === PHASE.PLAYING || state.phase === PHASE.COUNTDOWN;
    music.saucer = this.gameplay.entities.saucer.activeCount > 0;
    this.audio.setMusicState(music);
    this.audio.update(dt);
    this.pipeline.render(dt);
    this.hudTimer += dt;
    if (this.hudTimer >= 0.1 || this.lastPhase !== state.phase) {
      this.hudTimer = 0;
      this.lastPhase = state.phase;
      this.refreshHUD();
    }
    this.qualityCooldown = Math.max(0, this.qualityCooldown - dt);
    if (!this.paused && this.loop.stats.frameMs > 24) this.slowTime += dt;
    else this.slowTime = Math.max(0, this.slowTime - dt * 2);
    if (
      this.slowTime > 5 &&
      this.qualityCooldown === 0 &&
      this.settings.quality !== "low"
    ) {
      this.settings.quality =
        this.settings.quality === "high" ? "balanced" : "low";
      this.resizePending = true;
      this.qualityCooldown = 10;
      this.slowTime = 0;
    }
  }
  refreshHUD() {
    if (!this.hud || !this.gameplay) return;
    const v = this.view;
    v.state = this.gameplay.state;
    v.best = this.best;
    v.paused = this.paused;
    v.settingsOpen = this.settingsOpen;
    v.remaining = this.gameplay.entities.aliens.activeCount;
    v.device = this.actions?.lastDevice || "keyboard";
    this.hud.update(v);
  }
  fail(error) {
    if (this.disposed) return;
    console.error(error);
    this.paused = true;
    this.loop?.stop();
    this.audio?.setPaused(true);
    this.hud?.showError(error.message || String(error));
    this.refreshHUD();
  }
  getDiagnostics() {
    const e = this.gameplay.entities;
    let materialsValid = true;
    this.world.scene.traverse((o) => {
      if (o.material) {
        if (Array.isArray(o.material)) {
          for (const m of o.material)
            materialsValid &&= m.isMeshStandardMaterial === true;
        } else materialsValid &&= o.material.isMeshStandardMaterial === true;
      }
    });
    const records = (pool) =>
      Array.from(pool.activeIds.slice(0, pool.activeCount), (id) => {
        const p = pool.items[id];
        return {
          id,
          x: p.x,
          y: p.y,
          vx: p.vx,
          vy: p.vy,
          hx: p.hx,
          hy: p.hy,
          row: p.row,
          value: p.value,
        };
      });
    return {
      state: { ...this.gameplay.state },
      paused: this.paused,
      seedState: this.gameplay.rng.state,
      player: { ...e.player.items[0], active: e.player.activeCount > 0 },
      aliens: records(e.aliens),
      enemyShots: records(e.enemyShots),
      playerShots: records(e.playerShots),
      saucer: records(e.saucer),
      formation: {
        x: this.gameplay.formation.x,
        y: this.gameplay.formation.y,
        direction: this.gameplay.formation.direction,
        dropping: this.gameplay.formation.dropping,
        interval: this.gameplay.formation.interval,
      },
      bunkers: Array.from(this.gameplay.bunkers.health),
      effects: {
        ...this.effects.counts,
        dropped: this.effects.particles.dropped,
        labels: this.effects.text.pool.activeCount,
        freezeRemaining: this.effects.hitStop.remaining,
        trauma: this.effects.shake.trauma,
        cameraX: this.world.camera.position.x,
        cameraY: this.world.camera.position.y,
        cameraRoll: this.world.camera.rotation.z,
      },
      renderer: { ...this.pipeline.stats },
      loop: { ...this.loop.stats },
      audio: this.audio.context?.state || "locked",
      materialsValid,
      input: { ...this.actions },
      quality: this.settings.quality,
    };
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.loop?.dispose();
    this.scope.dispose();
    this.input?.dispose();
    this.audio?.dispose();
    this.effects?.dispose();
    this.world?.dispose();
    this.pipeline?.dispose();
    this.hud?.dispose();
    this.gameplay?.dispose();
  }
}
