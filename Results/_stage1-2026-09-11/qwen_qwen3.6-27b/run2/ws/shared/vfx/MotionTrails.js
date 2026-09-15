import * as THREE from 'three';
import { clamp } from 'shared/math/MathUtils.js';
import { MemoryTracker } from 'shared/memory/MemoryTracker.js';

const tracker = new MemoryTracker();

export class MotionTrails {
  constructor(scene) {
    this.scene = scene;
    this.trails = new Map(); // mesh.uuid -> trail data
  }

  attach(mesh, length = 8, color = 0x00ffff, lineWidth = 2) {
    const uuid = mesh.uuid;
    if (this.trails.has(uuid)) return;

    const positions = new Float32Array(length * 3);
    const colors = new Float32Array(length * 3);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    tracker.trackGeometry(geometry);

    const c = new THREE.Color(color);
    const material = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      linewidth: lineWidth,
      depthWrite: false,
    });
    tracker.trackMaterial(material);

    const line = new THREE.Line(geometry, material);
    line.frustumCulled = false;
    this.scene.add(line);

    const history = [];
    for (let i = 0; i < length; i++) {
      history.push(new THREE.Vector3());
    }

    this.trails.set(uuid, { line, geometry, material, history, length, color: c, visible: false });
  }

  detach(mesh) {
    const uuid = mesh.uuid;
    const data = this.trails.get(uuid);
    if (!data) return;
    this.scene.remove(data.line);
    data.geometry.dispose();
    data.material.dispose();
    this.trails.delete(uuid);
  }

  update(dt) {
    for (const [uuid, data] of this.trails) {
      const mesh = this.scene.getObjectByProperty('uuid', uuid);
      if (!mesh || !mesh.visible) {
        data.visible = false;
        data.line.visible = false;
        continue;
      }

      data.visible = true;
      data.line.visible = true;

      // Shift history
      for (let i = data.history.length - 1; i > 0; i--) {
        data.history[i].copy(data.history[i - 1]);
      }
      mesh.getWorldPosition(data.history[0]);

      const posAttr = data.geometry.getAttribute('position');
      const colAttr = data.geometry.getAttribute('color');

      for (let i = 0; i < data.length; i++) {
        const p = data.history[i];
        posAttr.setXYZ(i, p.x, p.y, p.z);

        const alpha = 1.0 - (i / data.length);
        colAttr.setXYZ(i, data.color.r, data.color.g, data.color.b);
      }

      posAttr.needsUpdate = true;
      colAttr.needsUpdate = true;
    }
  }

  clear() {
    for (const [uuid, data] of this.trails) {
      this.scene.remove(data.line);
      data.geometry.dispose();
      data.material.dispose();
    }
    this.trails.clear();
  }
}
