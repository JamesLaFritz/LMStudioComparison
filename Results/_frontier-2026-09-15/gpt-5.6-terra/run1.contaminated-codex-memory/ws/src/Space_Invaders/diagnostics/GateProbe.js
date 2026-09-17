const PROBE_VERSION = "1.0.0";
const GLOBAL_NAMES = ["__spaceInvadersGate", "__SPACE_INVADERS_GATE__"];

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function nonNegativeInteger(value, fallback = 0) {
  return Math.max(0, Math.floor(finite(value, fallback)));
}

function shallowRecord(source, fields) {
  const record = {};
  for (const field of fields) {
    const value = source?.[field];
    if (value === undefined || value === null) {
      continue;
    }
    if (typeof value === "number") {
      record[field] = Number.isFinite(value) ? value : 0;
    } else if (typeof value === "string" || typeof value === "boolean") {
      record[field] = value;
    }
  }
  return record;
}

function cloneState(value) {
  return JSON.parse(JSON.stringify(value));
}

export class GateProbe {
  constructor({ version = PROBE_VERSION, route = "space-invaders", target } = {}) {
    this.target = target ?? (typeof window === "undefined" ? null : window);
    this.runtime = null;
    this.installations = new Map();
    this.state = {
      version,
      ready: false,
      frame: 0,
      route,
      phase: "ATTRACT",
      clock: {
        real: 0,
        simulation: 0,
        accumulator: 0,
        delta: 0,
      },
      input: {
        downCount: 0,
        upCount: 0,
        lastCode: null,
        fireTapped: false,
        pauseTapped: false,
      },
      simulation: {
        score: 0,
        highScore: 0,
        wave: 1,
        lives: 3,
        invadersAlive: 0,
        playerProjectiles: 0,
        enemyProjectiles: 0,
      },
      vfx: {
        particles: { active: 0, cap: 500, spawned: 0 },
        shockwaves: { active: 0, spawned: 0 },
        trails: { active: 0 },
        floatingScores: { active: 0, spawned: 0 },
        hitStop: { active: false, remaining: 0 },
        shake: { trauma: 0 },
      },
    };
  }

  install() {
    if (!this.target) {
      return this;
    }
    const facade = {
      getState: () => this.snapshot(),
      getGateState: () => this.snapshot(),
      markReady: () => this.markReady(),
      get version() {
        return this.getState().version;
      },
      get ready() {
        return this.getState().ready;
      },
    };
    for (const name of GLOBAL_NAMES) {
      if (!this.installations.has(name)) {
        this.installations.set(name, this.target[name]);
      }
      this.target[name] = facade;
    }
    return this;
  }

  setRuntime(runtime) {
    this.runtime = runtime ?? null;
    return this;
  }

  setRoute(route) {
    this.state.route = String(route ?? "space-invaders");
    return this;
  }

  setPhase(phase) {
    this.state.phase = String(phase ?? "ATTRACT").replace(/[\s-]+/g, "_").toUpperCase();
    return this;
  }

  setInput(input = {}) {
    const target = this.state.input;
    target.downCount = nonNegativeInteger(input.downCount ?? input.keyDownCount, target.downCount);
    target.upCount = nonNegativeInteger(input.upCount ?? input.keyUpCount, target.upCount);
    if (input.lastCode !== undefined) {
      target.lastCode = input.lastCode == null ? null : String(input.lastCode);
    }
    if (input.fireTapped !== undefined) {
      target.fireTapped = Boolean(input.fireTapped);
    }
    if (input.pauseTapped !== undefined) {
      target.pauseTapped = Boolean(input.pauseTapped);
    }
    return this;
  }

  setSnapshot(snapshot = {}) {
    const simulation = this.state.simulation;
    simulation.score = nonNegativeInteger(snapshot.score ?? snapshot.points, simulation.score);
    simulation.highScore = nonNegativeInteger(
      snapshot.highScore ?? snapshot.highscore ?? snapshot.bestScore,
      simulation.highScore,
    );
    simulation.wave = Math.max(1, nonNegativeInteger(snapshot.wave ?? snapshot.level, simulation.wave));
    simulation.lives = nonNegativeInteger(snapshot.lives ?? snapshot.remainingLives, simulation.lives);
    simulation.invadersAlive = nonNegativeInteger(
      snapshot.invadersAlive ?? snapshot.formation?.aliveCount ?? snapshot.formation?.alive,
      simulation.invadersAlive,
    );
    simulation.playerProjectiles = nonNegativeInteger(
      snapshot.playerProjectiles ?? snapshot.projectiles?.playerActive,
      simulation.playerProjectiles,
    );
    simulation.enemyProjectiles = nonNegativeInteger(
      snapshot.enemyProjectiles ?? snapshot.projectiles?.enemyActive,
      simulation.enemyProjectiles,
    );
    simulation.player = shallowRecord(snapshot.player, ["x", "y", "alive", "respawning"]);
    simulation.formation = shallowRecord(snapshot.formation, ["x", "y", "direction", "aliveCount", "stepCount"]);
    simulation.projectiles = shallowRecord(snapshot.projectiles, ["playerActive", "enemyActive", "totalActive"]);
    simulation.bunkers = shallowRecord(snapshot.bunkers, ["aliveCells", "destroyedCells"]);
    if (snapshot.phase ?? snapshot.state) {
      this.setPhase(snapshot.phase ?? snapshot.state);
    }
    return this;
  }

  setVfx(vfx = {}) {
    const state = this.state.vfx;
    const particles = vfx.particles ?? vfx.particleManager ?? {};
    const shockwaves = vfx.shockwaves ?? {};
    const trails = vfx.trails ?? {};
    const floatingScores = vfx.floatingScores ?? vfx.floatingScore ?? {};
    const hitStop = vfx.hitStop ?? {};
    const shake = vfx.shake ?? vfx.cameraShake ?? {};
    state.particles.active = nonNegativeInteger(particles.active ?? particles.activeCount, state.particles.active);
    state.particles.cap = Math.min(500, Math.max(1, nonNegativeInteger(particles.cap ?? particles.hardCap, state.particles.cap)));
    state.particles.spawned = nonNegativeInteger(particles.spawned ?? particles.totalSpawned, state.particles.spawned);
    state.shockwaves.active = nonNegativeInteger(shockwaves.active ?? shockwaves.activeCount, state.shockwaves.active);
    state.shockwaves.spawned = nonNegativeInteger(shockwaves.spawned ?? shockwaves.totalSpawned, state.shockwaves.spawned);
    state.trails.active = nonNegativeInteger(trails.active ?? trails.activeCount, state.trails.active);
    state.floatingScores.active = nonNegativeInteger(floatingScores.active ?? floatingScores.activeCount, state.floatingScores.active);
    state.floatingScores.spawned = nonNegativeInteger(floatingScores.spawned ?? floatingScores.totalSpawned, state.floatingScores.spawned);
    state.hitStop.active = Boolean(hitStop.active ?? (finite(hitStop.remaining, 0) > 0));
    state.hitStop.remaining = Math.max(0, finite(hitStop.remaining ?? hitStop.remainingSeconds, state.hitStop.remaining));
    state.shake.trauma = Math.max(0, finite(shake.trauma, state.shake.trauma));
    return this;
  }

  tick(realDelta = 0, simulationDelta = 0) {
    let payload = null;
    if (typeof realDelta === "object" && realDelta !== null) {
      payload = realDelta;
      simulationDelta = payload.simulationDelta ?? payload.simDelta ?? 0;
      realDelta = payload.realDelta ?? payload.delta ?? 0;
    }
    this.state.frame += 1;
    this.state.clock.delta = Math.max(0, finite(realDelta));
    this.state.clock.real += this.state.clock.delta;
    this.state.clock.simulation += Math.max(0, finite(simulationDelta));
    if (payload) {
      if (payload.route !== undefined) this.setRoute(payload.route);
      if (payload.phase !== undefined) this.setPhase(payload.phase);
      if (payload.input) this.setInput(payload.input);
      if (payload.snapshot ?? payload.simulation) this.setSnapshot(payload.snapshot ?? payload.simulation);
      if (payload.vfx) this.setVfx(payload.vfx);
      if (payload.accumulator !== undefined) this.state.clock.accumulator = Math.max(0, finite(payload.accumulator));
    }
    this.captureRuntime();
    return this;
  }

  captureRuntime() {
    if (!this.runtime || typeof this.runtime.getGateState !== "function") {
      return;
    }
    const runtimeState = this.runtime.getGateState();
    if (!runtimeState || typeof runtimeState !== "object") {
      return;
    }
    if (runtimeState.route !== undefined) this.setRoute(runtimeState.route);
    if (runtimeState.phase !== undefined) this.setPhase(runtimeState.phase);
    if (runtimeState.input) this.setInput(runtimeState.input);
    if (runtimeState.snapshot ?? runtimeState.simulation) this.setSnapshot(runtimeState.snapshot ?? runtimeState.simulation);
    if (runtimeState.vfx) this.setVfx(runtimeState.vfx);
    if (runtimeState.clock) {
      this.state.clock.real = Math.max(0, finite(runtimeState.clock.real, this.state.clock.real));
      this.state.clock.simulation = Math.max(0, finite(runtimeState.clock.simulation, this.state.clock.simulation));
      this.state.clock.accumulator = Math.max(0, finite(runtimeState.clock.accumulator, this.state.clock.accumulator));
    }
  }

  markReady() {
    this.state.ready = true;
    if (this.target?.dispatchEvent) {
      this.target.dispatchEvent(new CustomEvent("space-invaders:ready", { detail: this.snapshot() }));
    }
    return this;
  }

  reset() {
    this.state.ready = false;
    this.state.frame = 0;
    this.state.clock.real = 0;
    this.state.clock.simulation = 0;
    this.state.clock.accumulator = 0;
    this.state.clock.delta = 0;
    this.setPhase("ATTRACT");
    return this;
  }

  snapshot() {
    return cloneState(this.state);
  }

  getState() {
    return this.snapshot();
  }

  getGateState() {
    return this.snapshot();
  }

  dispose() {
    if (this.target) {
      for (const [name, previous] of this.installations) {
        if (previous === undefined) {
          delete this.target[name];
        } else {
          this.target[name] = previous;
        }
      }
    }
    this.installations.clear();
    this.runtime = null;
  }
}

export function createGateProbe(options) {
  return new GateProbe(options);
}

export { PROBE_VERSION };
export default GateProbe;
