function finite(value, digits = 1) {
  return Number.isFinite(value) ? Number(value).toFixed(digits) : '—';
}

function appendPoolLines(lines, pools) {
  if (!pools || typeof pools !== 'object') return;
  lines.push('POOLS');
  for (const [name, stats] of Object.entries(pools)) {
    if (stats && typeof stats === 'object') {
      lines.push(`  ${name}: ${stats.active ?? stats.current ?? 0}/${stats.capacity ?? '—'}`);
    } else {
      lines.push(`  ${name}: ${stats}`);
    }
  }
}

/** Compact, opt-in DOM diagnostics surface. */
export class DiagnosticsPanel {
  constructor({ root = globalThis.document?.body } = {}) {
    this._root = root;
    this._element = null;
    this._visible = false;
    this._disposed = false;
  }

  mount() {
    if (this._disposed) throw new Error('Cannot mount a disposed DiagnosticsPanel');
    if (this._element) return this._element;
    const documentRef = this._root?.ownerDocument ?? globalThis.document;
    if (!documentRef || !this._root?.appendChild) return null;
    const element = documentRef.createElement('pre');
    element.className = 'diagnostics-panel glass-panel';
    element.dataset.diagnostics = 'true';
    element.setAttribute('aria-hidden', 'true');
    element.hidden = true;
    element.textContent = 'DIAGNOSTICS\nAwaiting frame data…';
    this._root.appendChild(element);
    this._element = element;
    return element;
  }

  update(snapshot = {}) {
    if (this._disposed) return;
    if (!this._element) this.mount();
    if (!this._element) return;

    const render = snapshot.render ?? snapshot.renderer ?? {};
    const particles = snapshot.particles ?? {};
    const lines = [
      'DIAGNOSTICS',
      `FPS ${finite(snapshot.fps)}  EMA ${finite(snapshot.emaFps ?? snapshot.fpsEma)}`,
      `FRAME ${finite(snapshot.frameMs)}ms  SIM ${finite(snapshot.simulationMs)}ms  RENDER ${finite(snapshot.renderMs)}ms`,
      `MODE ${snapshot.mode ?? '—'}  WAVE ${snapshot.wave ?? '—'}  ALIENS ${snapshot.liveAliens ?? snapshot.aliveAliens ?? '—'}`,
      `INPUT ${snapshot.inputKind ?? '—'}  QUALITY ${snapshot.qualityTier ?? snapshot.effectiveTier ?? '—'}  CONTEXT ${snapshot.contextState ?? 'ok'}`,
      `DROPPED ${finite(snapshot.droppedTimeMs ?? snapshot.droppedMs)}ms  SATURATION ${snapshot.substepSaturation ?? 0}`,
      `DRAWS ${render.drawCalls ?? render.calls ?? snapshot.drawCalls ?? '—'}  TRIANGLES ${render.triangles ?? snapshot.triangles ?? '—'}`,
      `PROGRAMS ${render.programs ?? snapshot.programs ?? '—'}  GEO ${render.geometries ?? snapshot.geometries ?? '—'}  TEX ${render.textures ?? snapshot.textures ?? '—'}`,
      `EVENT OVERFLOW ${snapshot.eventOverflow ?? snapshot.eventOverflowCount ?? 0}`,
      `HASH ${snapshot.stateHash ?? '—'}`,
      `PARTICLES ${particles.current ?? particles.active ?? 0}/${particles.capacity ?? 500} peak ${particles.peak ?? 0}`,
      `  req ${particles.requested ?? 0} emit ${particles.emitted ?? 0} reject ${particles.rejected ?? 0} preempt ${particles.preempted ?? 0}`,
    ];
    appendPoolLines(lines, snapshot.pools);
    this._element.textContent = lines.join('\n');
  }

  setVisible(value) {
    if (this._disposed) return false;
    if (!this._element) this.mount();
    const visible = Boolean(value);
    if (visible === this._visible) return false;
    this._visible = visible;
    if (this._element) {
      this._element.hidden = !visible;
      this._element.setAttribute('aria-hidden', String(!visible));
    }
    return true;
  }

  dispose() {
    if (this._disposed) return;
    this._element?.remove();
    this._element = null;
    this._root = null;
    this._disposed = true;
  }
}
