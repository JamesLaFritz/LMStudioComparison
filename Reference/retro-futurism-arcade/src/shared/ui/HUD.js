/**
 * Base HUD.
 *
 * Provides the DOM scaffolding and update discipline every title's HUD extends.
 * The layout budget is fixed by the design system and deliberately austere:
 *
 *   top-left      one objective chip
 *   top-right     one compact status strip
 *   bottom-centre one transient prompt
 *
 * That is the entire permanent chrome. No lore panels, no controls reference
 * pinned to the screen, no fourth corner. The playfield is the product.
 *
 * ### The dirty-check discipline
 *
 * Every setter compares against a cached value and returns early when nothing
 * changed. This is not micro-optimisation. Assigning to `textContent` — even
 * the identical string — invalidates the element and schedules a style
 * recalculation, and a HUD with six readouts updated every frame at 144Hz is
 * nearly a thousand needless recalcs per second. Since the score only changes
 * on a kill and lives only on a death, the overwhelming majority of those
 * writes are pure waste.
 */
export class HUD {
  /**
   * @param {HTMLElement} root overlay root element
   */
  constructor(root) {
    this.root = root;

    this.layer = document.createElement('div');
    this.layer.className = 'hud-layer';
    this.layer.setAttribute('aria-live', 'polite');
    root.appendChild(this.layer);

    /** @type {Map<string, {el:HTMLElement, value:*}>} */
    this.fields = new Map();

    this.visible = true;
    this._promptTimer = 0;
    this._promptEl = null;
  }

  /**
   * Create a positioned corner container.
   * @param {'tl'|'tr'|'bc'} position
   */
  createCorner(position) {
    const el = document.createElement('div');
    el.className = `hud-corner hud-corner--${position}`;
    this.layer.appendChild(el);
    return el;
  }

  /**
   * Create an objective chip: a small uppercase label above a value.
   *
   * @param {HTMLElement} parent
   * @param {string} key       identifier used by `set`
   * @param {string} label
   * @param {string} [initial]
   * @param {string} [valueClass] e.g. 'neon neon--lime'
   */
  createChip(parent, key, label, initial = '', valueClass = 'neon') {
    const chip = document.createElement('div');
    chip.className = 'hud-chip';

    const labelEl = document.createElement('span');
    labelEl.className = 'hud-chip__label';
    labelEl.textContent = label;

    const valueEl = document.createElement('span');
    valueEl.className = `hud-chip__value tabular ${valueClass}`;
    valueEl.textContent = initial;

    chip.append(labelEl, valueEl);
    parent.appendChild(chip);

    this.fields.set(key, { el: valueEl, value: initial });
    return chip;
  }

  /** Create a horizontal status strip to hold several stats. */
  createStrip(parent) {
    const strip = document.createElement('div');
    strip.className = 'hud-strip';
    parent.appendChild(strip);
    return strip;
  }

  /**
   * Add one stat to a strip.
   * @param {HTMLElement} strip
   * @param {string} key
   * @param {string} label
   * @param {string} [initial]
   * @param {string} [valueClass]
   */
  createStat(strip, key, label, initial = '0', valueClass = 'neon') {
    const stat = document.createElement('div');
    stat.className = 'hud-stat';

    const labelEl = document.createElement('span');
    labelEl.className = 'hud-stat__label';
    labelEl.textContent = label;

    const valueEl = document.createElement('span');
    valueEl.className = `hud-stat__value tabular ${valueClass}`;
    valueEl.textContent = initial;

    stat.append(labelEl, valueEl);
    strip.appendChild(stat);

    this.fields.set(key, { el: valueEl, value: initial });
    return stat;
  }

  /**
   * Set a field's text, skipping the DOM write when unchanged.
   *
   * @param {string} key
   * @param {string|number} value
   * @param {boolean} [pop] play the scale-kick animation on change
   */
  set(key, value, pop = false) {
    const field = this.fields.get(key);
    if (!field) return;

    const text = String(value);
    if (field.value === text) return;

    field.value = text;
    field.el.textContent = text;

    if (pop) {
      // Removing and re-adding in the same frame does not restart a CSS
      // animation — the browser coalesces the class changes and sees no
      // transition. Forcing a reflow between them is the standard fix.
      field.el.classList.remove('hud-stat__value--pop');
      void field.el.offsetWidth;
      field.el.classList.add('hud-stat__value--pop');
    }
  }

  /** Change a field's colour class without touching its text. */
  setFieldClass(key, valueClass) {
    const field = this.fields.get(key);
    if (!field) return;
    const base = field.el.className.split(' ')[0];
    const next = `${base} tabular ${valueClass}`;
    if (field.el.className !== next) field.el.className = next;
  }

  /**
   * Create a row of life glyphs.
   *
   * Drawn as CSS `clip-path` silhouettes rather than as a number. A player can
   * read three icons at a glance without parsing a digit, and losing one is a
   * visible event rather than a number quietly decrementing.
   */
  createLives(parent, key, max = 3) {
    const wrap = document.createElement('div');
    wrap.className = 'hud-lives';

    const glyphs = [];
    for (let i = 0; i < max; i++) {
      const g = document.createElement('span');
      g.className = 'hud-life';
      wrap.appendChild(g);
      glyphs.push(g);
    }

    parent.appendChild(wrap);
    this.fields.set(key, { el: wrap, value: max, glyphs, max });
    return wrap;
  }

  /** Update how many life glyphs are lit. */
  setLives(key, count) {
    const field = this.fields.get(key);
    if (!field || !field.glyphs) return;
    if (field.value === count) return;
    field.value = count;

    for (let i = 0; i < field.glyphs.length; i++) {
      const spent = i >= count;
      field.glyphs[i].classList.toggle('hud-life--spent', spent);
    }
  }

  /**
   * Create the transient bottom-centre prompt.
   *
   * It is hidden by default and auto-dismisses. A controls hint that stays on
   * screen forever is the exact anti-pattern the layout budget exists to
   * prevent — after the first ten seconds it is pure noise occupying the one
   * screen edge the player's eye returns to most.
   */
  createPrompt(parent) {
    const el = document.createElement('div');
    el.className = 'hud-prompt';
    parent.appendChild(el);
    this._promptEl = el;
    return el;
  }

  /**
   * Show the prompt for a limited time.
   * @param {string} html small trusted markup, e.g. '<kbd>A</kbd> to move'
   * @param {number} [seconds] 0 keeps it until explicitly hidden
   */
  showPrompt(html, seconds = 4) {
    if (!this._promptEl) return;
    this._promptEl.innerHTML = html;
    this._promptEl.classList.add('hud-prompt--visible');
    this._promptTimer = seconds;
  }

  /** Hide the prompt immediately. */
  hidePrompt() {
    if (!this._promptEl) return;
    this._promptEl.classList.remove('hud-prompt--visible');
    this._promptTimer = 0;
  }

  /**
   * Per-frame tick. Only drives the prompt timer in the base class; subclasses
   * override and call `super.update(dt)`.
   *
   * Uses the unscaled delta — the HUD must not freeze during hit-stop.
   */
  update(unscaledDt) {
    if (this._promptTimer > 0) {
      this._promptTimer -= unscaledDt;
      if (this._promptTimer <= 0) this.hidePrompt();
    }
  }

  /** Show or hide the entire HUD, e.g. behind a modal. */
  setVisible(visible) {
    if (this.visible === visible) return;
    this.visible = visible;
    this.layer.style.opacity = visible ? '1' : '0';
    // Also stop it participating in hit-testing while hidden.
    this.layer.style.pointerEvents = 'none';
  }

  /** Remove every node this HUD created. */
  dispose() {
    if (this.layer.parentNode) this.layer.parentNode.removeChild(this.layer);
    this.fields.clear();
    this._promptEl = null;
  }
}
