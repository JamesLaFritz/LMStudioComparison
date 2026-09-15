import * as THREE from 'three';
import { ObjectPool } from '../../../shared/pool/ObjectPool.js';
import { ParticleManager } from '../../../shared/particles/ParticleManager.js';
import { CameraShake } from '../../../shared/vfx/CameraShake.js';
import { HitStop } from '../../../shared/vfx/HitStop.js';

const ALIEN_COLORS = {
  squid: 0xff00ff,
  octopus: 0x00ffff,
  crab: 0xffff00,
};

const ALIEN_POINTS = {
  squid: 30,
  octopus: 20,
  crab: 10,
};

const ALIEN_SHOOT_CHANCE = {
  squid: 0.002,
  octopus: 0.003,
  crab: 0.004,
};

export class Alien {
  constructor(type, gridCol, gridRow, scene, config) {
    this.type = type;
    this.gridCol = gridCol;
    this.gridRow = gridRow;
    this.scene = scene;
    this.config = config;
    this.alive = true;
    this.points = ALIEN_POINTS[type];
    this.shootChance = ALIEN_SHOOT_CHANCE[type];

    const color = ALIEN_COLORS[type];
    this.mesh = this._createGeometry(type, color);
    this.mesh.position.set(0, 0, 0);
    scene.add(this.mesh);

    // Animation state for walking cycle
    this.walkPhase = Math.random() * Math.PI * 2;
    this.walkSpeed = 3.0;

    // Formation morphing state
    this.basePosition = new THREE.Vector3();
    this.morphTarget = null;
    this.morphProgress = 1.0;
    this.morphDuration = 2.0;
    this.isMorphing = false;
  }

  _createGeometry(type, color) {
    const group = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({
      color: color,
      emissive: color,
      emissiveIntensity: 1.5,
      roughness: 0.3,
      metalness: 0.7,
    });

    if (type === 'squid') {
      // Sphere body + cone bottom
      const sphere = new THREE.SphereGeometry(0.25, 8, 6);
      const sphereMesh = new THREE.Mesh(sphere, mat);
      group.add(sphereMesh);

      const cone = new THREE.ConeGeometry(0.15, 0.3, 6);
      const coneMesh = new THREE.Mesh(cone, mat);
      coneMesh.position.y = -0.25;
      group.add(coneMesh);

      // Tentacle-like protrusions
      for (let i = -1; i <= 1; i += 0.67) {
        const tentacle = new THREE.Mesh(
          new THREE.BoxGeometry(0.04, 0.2, 0.04),
          mat
        );
        tentacle.position.set(i * 0.15, -0.35, 0);
        group.add(tentacle);
      }

      // Eyes
      const eyeMat = new THREE.MeshStandardMaterial({ color: 0x000000 });
      for (let side of [-1, 1]) {
        const eye = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 4), eyeMat);
        eye.position.set(side * 0.1, -0.05, 0.22);
        group.add(eye);
      }

    } else if (type === 'octopus') {
      // Icosahedron body with vertex displacement
      const geo = new THREE.IcosahedronGeometry(0.3, 1);
      const positions = geo.attributes.position;
      for (let i = 0; i < positions.count; i++) {
        const y = positions.getY(i);
        if (y < -0.1) {
          positions.setY(i, y * 1.5);
        }
      }
      geo.computeVertexNormals();
      const mesh = new THREE.Mesh(geo, mat);
      group.add(mesh);

      // Arms
      for (let i = 0; i < 6; i++) {
        const angle = (i / 6) * Math.PI * 2;
        const arm = new THREE.Mesh(
          new THREE.BoxGeometry(0.05, 0.15, 0.05),
          mat
        );
        arm.position.set(Math.cos(angle) * 0.3, -0.2, Math.sin(angle) * 0.3);
        group.add(arm);
      }

    } else if (type === 'crab') {
      // Box body with claw protrusions
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.3, 0.25), mat);
      group.add(body);

      // Claws
      for (let side of [-1, 1]) {
        const claw = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.2, 0.15), mat);
        claw.position.set(side * 0.35, 0.05, 0);
        group.add(claw);

        // Claw tip
        const tip = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.12, 0.08), mat);
        tip.position.set(side * 0.45, 0.2, 0);
        group.add(tip);
      }

      // Legs
      for (let side of [-1, 1]) {
        for (let z of [-0.1, 0.1]) {
          const leg = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.15, 0.06), mat);
          leg.position.set(side * 0.2, -0.22, z);
          group.add(leg);
        }
      }

      // Eyes
      const eyeMat = new THREE.MeshStandardMaterial({ color: 0x000000 });
      for (let side of [-1, 1]) {
        const eye = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 4), eyeMat);
        eye.position.set(side * 0.12, 0.18, 0.15);
        group.add(eye);
      }
    }

    this.material = mat;
    return group;
  }

  updatePosition(pos) {
    this.mesh.position.copy(pos);
  }

  update(deltaTime, direction, speed, alienCount, totalAliens) {
    if (!this.alive) return;

    // Walking animation - subtle bobbing and scaling
    this.walkPhase += deltaTime * this.walkSpeed;
    const walkOffset = Math.sin(this.walkPhase) * 0.03;
    this.mesh.position.y = walkOffset;

    // Subtle scale pulse for "breathing" effect
    const breathe = 1.0 + Math.sin(this.walkPhase * 0.5) * 0.02;
    this.mesh.scale.set(breathe, breathe / breathe, breathe);

    // Morphing animation
    if (this.isMorphing && this.morphProgress < 1.0) {
      this.morphProgress += deltaTime / this.morphDuration;
      if (this.morphProgress >= 1.0) {
        this.morphProgress = 1.0;
        this.isMorphing = false;
      } else {
        // Interpolate between base position and morph target
        const t = this._easeInOutCubic(this.morphProgress);
        this.mesh.position.lerpVectors(
          this.basePosition,
          this.morphTarget || this.basePosition,
          t
        );
      }
    }

    // Shooting logic
    if (this.shouldShoot(alienCount, totalAliens)) {
      return this.shoot();
    }

    return null;
  }

  _easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  shouldShoot(alienCount, totalAliens) {
    if (!this.alive) return false;

    // Scale probability: fewer aliens = higher chance
    const survivalRatio = alienCount / totalAliens;
    const adjustedChance = this.shootChance * (1 + (1 - survivalRatio) * 2);

    return Math.random() < adjustedChance;
  }

  shoot(projectilePool, scene) {
    if (!this.alive || !projectilePool) return null;

    const projectile = projectilePool.acquire();
    const pos = this.mesh.position.clone();
    pos.y -= 0.35; // Start below the alien

    const velocity = new THREE.Vector3(0, -8, 0);
    projectile.init(pos, velocity, 0xff4444, false);
    return projectile;
  }

  die(projectilePool, particleManager, cameraShake, hitStop) {
    if (!this.alive) return null;

    this.alive = false;
    this.mesh.visible = false;

    // Particle explosion burst
    const pos = this.mesh.position.clone();
    const color = ALIEN_COLORS[this.type];
    particleManager.spawnBurst(
      pos, 30, color, [2, 6], [0.3, 0.7]
    );

    // Shockwave ring
    this._spawnShockwave(pos, color);

    // Camera shake (subtle)
    cameraShake.addTrauma(0.15);

    // Hit-stop (brief)
    hitStop.trigger(0.06);

    return { position: pos.clone(), points: this.points };
  }

  _spawnShockwave(position, color) {
    const ringGeo = new THREE.TorusGeometry(0.1, 0.02, 16, 32);
    const ringMat = new THREE.MeshStandardMaterial({
      emissive: color,
      emissiveIntensity: 2.0,
      transparent: true,
      opacity: 1.0,
      side: THREE.DoubleSide,
    });

    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.copy(position);
    ring.rotation.x = Math.PI / 2;
    this.scene.add(ring);

    // Animate the shockwave
    let elapsed = 0;
    const duration = 0.4;
    const maxRadius = 1.5;

    const animateShockwave = () => {
      elapsed += 0.016;
      const t = Math.min(elapsed / duration, 1.0);
      const radius = 0.1 + (maxRadius - 0.1) * t;
      ring.scale.set(radius / 0.1, radius / 0.1, 1);
      ring.material.opacity = 1.0 - t;

      if (t < 1.0) {
        requestAnimationFrame(animateShockwave);
      } else {
        // Cleanup
        this.scene.remove(ring);
        ringGeo.dispose();
        ringMat.dispose();
      }
    };

    animateShockwave();
  }

  setFormationPosition(targetPos, animationDuration) {
    if (this.isMorphing) return;

    this.basePosition.copy(this.mesh.position);
    this.morphTarget = targetPos.clone();
    this.morphProgress = 0.0;
    this.morphDuration = animationDuration || 2.0;
    this.isMorphing = true;
  }

  destroy() {
    if (this.material) {
      this.material.dispose();
    }
    // Dispose all child geometries
    this.mesh.traverse((child) => {
      if (child.geometry) {
        child.geometry.dispose();
      }
    });
    this.scene.remove(this.mesh);
  }

  getMesh() {
    return this.mesh;
  }

  getPosition() {
    return this.mesh.position;
  }

  isAlive() {
    return this.alive;
  }

  setAlive(value) {
    this.alive = value;
    if (!value) {
      this.mesh.visible = false;
    } else {
      this.mesh.visible = true;
    }
  }
}
