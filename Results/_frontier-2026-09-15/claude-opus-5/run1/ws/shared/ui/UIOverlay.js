// HTML HUD layer over the canvas. Panels are glass cards anchored to the viewport edges;
// text updates are cached so the DOM is only touched when a value actually changes.

export function el(tag, className = '', text = null) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== null && text !== undefined) node.textContent = text;
  return node;
}

export class UIOverlay {
  constructor(container) {
    this.container = container;
    this.root = el('div', 'ui-root');
    container.appendChild(this.root);
    this._elements = new Map();
    this._textCache = new Map();
  }

  /**
   * Add a glass panel. `position` is one of top-left, top-center, top-right,
   * bottom-left, bottom-center, bottom-right.
   */
  addPanel(id, { position = 'top-left', className = '' } = {}) {
    const panel = el('div', `glass-panel hud-panel pos-${position}${className ? ' ' + className : ''}`);
    panel.dataset.id = id;
    this.root.appendChild(panel);
    this._elements.set(id, panel);
    return panel;
  }

  /** Register any element under an id so `setText` / `setVisible` can address it. */
  bind(id, element) {
    this._elements.set(id, element);
    return element;
  }

  get(id) {
    return this._elements.get(id) || null;
  }

  setText(id, text) {
    const node = this._elements.get(id);
    if (!node) return;
    const str = String(text);
    if (this._textCache.get(id) === str) return;
    this._textCache.set(id, str);
    node.textContent = str;
  }

  setVisible(id, visible) {
    const node = this._elements.get(id);
    if (!node) return;
    node.classList.toggle('hidden', !visible);
  }

  setClass(id, className, on) {
    const node = this._elements.get(id);
    if (node) node.classList.toggle(className, on);
  }

  /** Transient centred message. */
  toast(text, { duration = 1.6, color = null } = {}) {
    const node = el('div', 'glass-panel toast', text);
    if (color) node.style.color = color;
    node.style.animationDuration = `${duration}s`;
    this.root.appendChild(node);
    window.setTimeout(() => node.remove(), duration * 1000 + 50);
    return node;
  }

  /** Large centred banner (wave intro etc.). */
  banner(title, subtitle = '', { duration = 1.8, color = null } = {}) {
    const node = el('div', 'banner');
    const t = el('div', 'banner-title', title);
    if (color) t.style.color = color;
    node.appendChild(t);
    if (subtitle) node.appendChild(el('div', 'banner-sub', subtitle));
    node.style.animationDuration = `${duration}s`;
    this.root.appendChild(node);
    window.setTimeout(() => node.remove(), duration * 1000 + 50);
    return node;
  }

  dispose() {
    this.root.remove();
    this._elements.clear();
    this._textCache.clear();
  }
}
