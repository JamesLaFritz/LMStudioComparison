export class TelemetryOverlay {
  constructor(parent) {
    this.enabled = new URLSearchParams(window.location.search).has('debug');
    this.element = document.createElement('pre');
    this.element.className = 'telemetry';
    this.element.hidden = !this.enabled;
    parent.appendChild(this.element);
  }

  update(state, renderer, particles) {
    if (!this.enabled) {
      return;
    }
    const info = renderer.info;
    this.element.textContent = [
      'phase  ' + state.phase,
      'wave   ' + state.campaignWave,
      'draws  ' + info.render.calls,
      'tris   ' + info.render.triangles,
      'geo    ' + info.memory.geometries,
      'tex    ' + info.memory.textures,
      'inv    ' + state.invaderPool.activeCount,
      'beam   ' + (state.playerProjectilePool.activeCount + state.alienProjectilePool.activeCount),
      'fx     ' + particles.activeCount + '/500',
    ].join('\n');
  }

  dispose() {
    this.element.remove();
  }
}
