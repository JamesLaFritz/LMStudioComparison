import * as THREE from 'three';

export class Starfield {
  constructor(scene, count = 500) {
    this.count = count;
    this.mesh = new THREE.InstancedMesh(
      new THREE.SphereGeometry(0.06, 4, 4),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1.0 }),
      count
    );

    const dummy = new THREE.Object3D();
    this._positions = [];
    this._freqs = [];
    this._phases = [];

    for (let i = 0; i < count; i++) {
      const x = (Math.random() - 0.5) * 40;
      const y = (Math.random() - 0.5) * 20;
      const z = 10 + Math.random() * 70;
      dummy.position.set(x, y, z);
      const scale = (0.03 + Math.random() * 0.06) * (1 + (z - 10) / 80);
      dummy.scale.setScalar(scale);
      dummy.updateMatrix();
      this.mesh.setMatrixAt(i, dummy.matrix);

      this._positions.push(x, y, z);
      this._freqs.push(0.5 + Math.random() * 2.0);
      this._phases.push(Math.random() * Math.PI * 2);
    }

    scene.add(this.mesh);
  }

  update(time) {
    const dummy = new THREE.Object3D();
    for (let i = 0; i < this.count; i++) {
      const ix = i * 3;
      const x = this._positions[ix];
      const y = this._positions[ix + 1];
      const z = this._positions[ix + 2];

      dummy.position.set(x, y, z);

      const scale = (0.03 + ((this._freqs[i] - 0.5) / 2.0) * 0.06) * (1 + (z - 10) / 80);
      const twinkle = 0.7 + 0.3 * Math.sin(time * this._freqs[i] + this._phases[i]);
      dummy.scale.setScalar(scale * twinkle);

      dummy.updateMatrix();
      this.mesh.setMatrixAt(i, dummy.matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  updateCamera(camera) {
    // Update starfield camera reference for parallax
    this.camera = camera;
  }

  dispose() {
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
  }
}
