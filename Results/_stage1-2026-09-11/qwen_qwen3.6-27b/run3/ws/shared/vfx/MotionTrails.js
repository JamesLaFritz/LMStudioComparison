import * as THREE from 'three';

export class MotionTrails {
  constructor(scene) {
    this.scene = scene;
    this.trails = new Map(); // mesh.uuid → trail data
  }

  add(mesh, maxPoints = 5) {
    const points = [];
    const trailGroup = new THREE.Group();
    trailGroup.name = 'trail_' + mesh.uuid;
    for (let i = 0; i < maxPoints; i++) {
      const clone = mesh.clone();
      clone.material = mesh.material.clone();
      clone.material.transparent = true;
      clone.material.opacity = 0;
      clone.material.depthWrite = false;
      clone.visible = false;
      trailGroup.add(clone);
      points.push({ mesh: clone, time: 0 });
    }
    this.scene.add(trailGroup);
    this.trails.set(mesh.uuid, { points, trailGroup, lastPos: new THREE.Vector3(), lastTime: 0, interval: 0.03 });
  }

  update(dt) {
    const now = performance.now() / 1000;
    for (const [uuid, trail] of this.trails) {
      const mainMesh = trail.trailGroup.parent && trail.trailGroup.parent.children.find(c => c.uuid === uuid);
      if (!mainMesh || !mainMesh.visible) {
        trail.points.forEach(p => { p.mesh.visible = false; p.mesh.material.opacity = 0; });
        continue;
      }
      trail.lastTime += dt;
      if (trail.lastTime >= trail.interval) {
        trail.lastTime = 0;
        trail.lastPos.copy(mainMesh.position);
        trail.points.forEach((p, i) => {
          if (i === 0) {
            p.mesh.position.copy(trail.lastPos);
            p.mesh.visible = true;
            p.mesh.material.opacity = 0.4;
            p.mesh.scale.setScalar(0.8);
          } else {
            const prev = trail.points[i - 1];
            p.mesh.position.copy(prev.mesh.position);
            p.mesh.visible = prev.mesh.visible;
            p.mesh.material.opacity = prev.mesh.material.opacity * 0.6;
            p.mesh.scale.setScalar(prev.mesh.scale.x * 0.8);
          }
          p.time = 0;
        });
      }
      trail.points.forEach(p => {
        p.time += dt;
        if (p.time > 0.3) {
          p.mesh.material.opacity = Math.max(0, p.mesh.material.opacity - dt * 2);
          if (p.mesh.material.opacity <= 0) p.mesh.visible = false;
        }
      });
    }
  }

  remove(uuid) {
    const trail = this.trails.get(uuid);
    if (!trail) return;
    this.scene.remove(trail.trailGroup);
    trail.points.forEach(p => { p.mesh.geometry.dispose(); p.mesh.material.dispose(); });
    this.trails.delete(uuid);
  }

  dispose() {
    for (const [uuid, trail] of this.trails) {
      this.scene.remove(trail.trailGroup);
      trail.points.forEach(p => { p.mesh.geometry.dispose(); p.mesh.material.dispose(); });
    }
    this.trails.clear();
  }
}
