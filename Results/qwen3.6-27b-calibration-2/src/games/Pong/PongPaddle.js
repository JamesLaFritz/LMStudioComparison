import * as THREE from 'three';

export class PongPaddle {
  constructor(side, scene, options = {}) {
    this.side = side; // 'left' or 'right'
    this.scene = scene;
    this.speed = options.speed ?? 8.0;
    this.height = options.height ?? 2.0;
    this.width = options.width ?? 0.3;
    this.depth = options.depth ?? 0.15;
    this.clampMin = options.clampMin ?? -4.0;
    this.clampMax = options.clampMax ?? 4.0;
    this.color = side === 'left' ? 0xff00ff : 0x00ff88;
    this.group = new THREE.Group();
    this._build();
    scene.add(this.group);
  }

  _build() {
    // Main paddle body
    const geo = new THREE.BoxGeometry(this.width, this.height, this.depth);
    const mat = new THREE.MeshStandardMaterial({
      color: 0x111122,
      emissive: this.color,
      emissiveIntensity: 0.6,
      metalness: 0.8,
      roughness: 0.2,
    });
    this.mesh = new THREE.Mesh(geo, mat);
    this.group.add(this.mesh);

    // Edge glow wireframe
    const edgesGeo = new THREE.EdgesGeometry(geo);
    const edgesMat = new THREE.LineBasicMaterial({ color: this.color, linewidth: 2 });
    this.edges = new THREE.LineSegments(edgesGeo, edgesMat);
    this.group.add(this.edges);

    // Position
    const x = this.side === 'left' ? -7.0 : 7.0;
    this.group.position.set(x, 0, 0);
  }

  get position() {
    return this.group.position;
  }

  get worldMinY() {
    return this.group.position.y - this.height / 2;
  }

  get worldMaxY() {
    return this.group.position.y + this.height / 2;
  }

  get worldX() {
    return this.group.position.x;
  }

  update(dt, inputAxis) {
    this.group.position.y += this.speed * inputAxis * dt;
    this.group.position.y = Math.max(this.clampMin, Math.min(this.clampMax, this.group.position.y));
  }

  pulse() {
    this.mesh.material.emissiveIntensity = 2.0;
  }

  decayPulse(dt) {
    this.mesh.material.emissiveIntensity = Math.max(0.6, this.mesh.material.emissiveIntensity - dt * 3.0);
  }

  dispose() {
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
    this.edges.geometry.dispose();
    this.edges.material.dispose();
    this.scene.remove(this.group);
  }
}
