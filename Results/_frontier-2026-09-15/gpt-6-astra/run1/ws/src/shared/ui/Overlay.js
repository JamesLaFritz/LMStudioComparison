import { ResourceScope } from "../core/ResourceScope.js";
export class Overlay {
  constructor({ mount }) {
    this.mount = mount;
    this.scope = new ResourceScope();
    this.panels = new Map();
  }
  createPanel(id, { title = "", className = "" } = {}) {
    const panel = document.createElement("section");
    panel.className = `glass-panel ${className}`;
    panel.dataset.panel = id;
    panel.hidden = true;
    panel.setAttribute("aria-label", title || id);
    this.mount.append(panel);
    this.panels.set(id, panel);
    this.scope.defer(() => panel.remove());
    return panel;
  }
  showPanel(id) {
    for (const [key, p] of this.panels) p.hidden = key !== id;
  }
  hidePanel(id) {
    const p = this.panels.get(id);
    if (p) p.hidden = true;
  }
  focusFirst(id) {
    const panel = this.panels.get(id);
    panel?.querySelector("button,input,select")?.focus({ preventScroll: true });
  }
  dispose() {
    this.scope.dispose();
    this.panels.clear();
  }
}
