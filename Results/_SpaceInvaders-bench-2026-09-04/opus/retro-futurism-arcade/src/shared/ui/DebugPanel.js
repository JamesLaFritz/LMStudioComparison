/**
 * F3 diagnostics overlay.
 *
 * Not a developer toy. Three of the readouts here are the acceptance criteria
 * for constraints the project directive imposes, and having them on screen is
 * how those constraints stay honest rather than aspirational:
 *
 *  - **Live particles vs the cap.** The 500-particle limit is verifiable at a
 *    glance during a player death inside a full firefight, which is the only
 *    moment it can actually be breached.
 *  - **Draw calls, triangles, unique materials.** The per-game performance
 *    budget is a number in a plan document until something displays the actual
 *    value next to it.
 *  - **Geometries and textures held by the renderer.** After unmounting a game
 *    these must return to the hub baseline. Any drift is a leak, and this is
 *    where it shows up.
 *
 * ### Update rate
 *
 * Refreshed five times a second, not every frame. Reading `renderer.info` is
 * cheap, but rewriting a dozen DOM nodes at 144Hz is not — and a panel that
 * updates faster than the eye can read is worse at its job anyway, because the
 * numbers become an unreadable blur exactly when they matter.
 */
export class DebugPanel {
  /**
   * @param {HTMLElement} root overlay root
   * @param {object} [opts]
   */
  constructor(root, opts = {}) {
    const { refreshHz = 5, visible = false } = opts;

    this.refreshInterval = 1 / refreshHz;
    this.accumulator = 0;

    this.el = document.createElement('div');
    this.el.className = 'debug-panel glass';
    this.el.setAttribute('aria-hidden', 'true');
    root.appendChild(this.el);

    /** @type {Map<string, {row:HTMLElement, value:HTMLElement, text:string}>} */
    this.rows = new Map();
    /** @type {Map<string, HTMLElement>} */
    this.sections = new Map();

    /** @type {Array<() => Record<string, {value:string, level?:string}>>} */
    this.providers = [];

    this.visible = visible;
    this.setVisible(visible);
  }

  /**
   * Register a data source.
   *
   * Providers are pull-based rather than push-based so that a system does not
   * pay any cost for diagnostics while the panel is hidden — nothing is called
   * at all until F3 is pressed.
   *
   * @param {string} section
   * @param {() => Record<string, string|number|{value:string|number, level?:'warn'|'bad'}>} fn
   */
  addProvider(section, fn) {
    this.providers.push({ section, fn });
    return this;
  }

  /** Toggle visibility. */
  toggle() {
    this.setVisible(!this.visible);
    return this.visible;
  }

  setVisible(visible) {
    this.visible = visible;
    this.el.classList.toggle('debug-panel--visible', visible);
    // Force an immediate refresh on the frame it opens rather than making the
    // player wait up to 200ms for the first numbers.
    this.accumulator = this.refreshInterval;
  }

  /**
   * @param {number} unscaledDt
   */
  update(unscaledDt) {
    if (!this.visible) return;

    this.accumulator += unscaledDt;
    if (this.accumulator < this.refreshInterval) return;
    this.accumulator = 0;

    for (const { section, fn } of this.providers) {
      let data;
      try {
        data = fn();
      } catch (err) {
        // A throwing diagnostic provider must never take down the frame it is
        // diagnosing.
        data = { error: { value: String(err && err.message), level: 'bad' } };
      }
      if (!data) continue;

      for (const [key, raw] of Object.entries(data)) {
        const normalised =
          raw !== null && typeof raw === 'object'
            ? { value: String(raw.value), level: raw.level || '' }
            : { value: String(raw), level: '' };
        this._setRow(section, key, normalised.value, normalised.level);
      }
    }
  }

  _section(name) {
    let el = this.sections.get(name);
    if (el) return el;

    el = document.createElement('div');
    el.className = 'debug-section';

    const heading = document.createElement('div');
    heading.className = 'debug-row debug-row__key';
    heading.textContent = name.toUpperCase();
    el.appendChild(heading);

    this.el.appendChild(el);
    this.sections.set(name, el);
    return el;
  }

  _setRow(section, key, value, level) {
    const id = `${section}.${key}`;
    let entry = this.rows.get(id);

    if (!entry) {
      const row = document.createElement('div');
      row.className = 'debug-row';

      const keyEl = document.createElement('span');
      keyEl.className = 'debug-row__key';
      keyEl.textContent = key;

      const valueEl = document.createElement('span');
      valueEl.textContent = value;

      row.append(keyEl, valueEl);
      this._section(section).appendChild(row);

      entry = { row, value: valueEl, text: value, level: '' };
      this.rows.set(id, entry);
    }

    if (entry.text !== value) {
      entry.text = value;
      entry.value.textContent = value;
    }

    if (entry.level !== level) {
      entry.level = level;
      entry.row.classList.toggle('debug-row--warn', level === 'warn');
      entry.row.classList.toggle('debug-row--bad', level === 'bad');
    }
  }

  /**
   * Standard renderer provider, shared by every title so the same four numbers
   * always appear in the same place regardless of which cabinet is running.
   *
   * @param {import('three').WebGLRenderer} renderer
   * @param {import('../util/Perf.js').Perf} perf
   * @param {object} [budget] target values used to colour the rows
   */
  addRendererProvider(renderer, perf, budget = {}) {
    const { drawCalls = 60, triangles = 150000 } = budget;

    this.addProvider('render', () => {
      const info = renderer.info;
      return {
        fps: {
          value: perf.fps.toFixed(0),
          level: perf.fps < 45 ? 'bad' : perf.fps < 58 ? 'warn' : ''
        },
        frame: {
          value: `${perf.meanFrameMs.toFixed(1)}ms`,
          level: perf.meanFrameMs > 16.6 ? 'bad' : perf.meanFrameMs > 11 ? 'warn' : ''
        },
        tier: perf.tier.name,
        calls: {
          value: String(info.render.calls),
          level: info.render.calls > drawCalls ? 'warn' : ''
        },
        tris: {
          value: info.render.triangles.toLocaleString(),
          level: info.render.triangles > triangles ? 'warn' : ''
        },
        geometries: String(info.memory.geometries),
        textures: String(info.memory.textures),
        programs: String(info.programs ? info.programs.length : 0)
      };
    });
    return this;
  }

  /**
   * Standard VFX provider. The particle row is the enforcement point for the
   * project-wide 500 cap and is coloured the moment it is exceeded — which,
   * given the eviction policy in `ParticleManager`, should never happen.
   *
   * @param {import('../vfx/VFXDirector.js').VFXDirector} vfx
   */
  addVfxProvider(vfx) {
    this.addProvider('vfx', () => {
      const stats = vfx.stats();
      const p = stats.particles;
      return {
        particles: {
          value: `${p.live}/${p.cap} (peak ${p.highWater})`,
          level: p.live > p.hardCap ? 'bad' : p.live >= p.cap ? 'warn' : ''
        },
        evicted: String(p.evictions),
        dropped: {
          value: String(p.rejected),
          level: p.rejected > 0 ? 'warn' : ''
        },
        rings: `${stats.shockwaves.live}/${stats.shockwaves.capacity}`,
        trauma: stats.trauma.toFixed(2),
        timescale: {
          value: stats.timeScale.toFixed(2),
          level: stats.timeScale < 0.99 ? 'warn' : ''
        }
      };
    });
    return this;
  }

  dispose() {
    this.providers.length = 0;
    this.rows.clear();
    this.sections.clear();
    if (this.el.parentNode) this.el.parentNode.removeChild(this.el);
  }
}
