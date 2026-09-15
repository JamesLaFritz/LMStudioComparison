import * as THREE from 'three';
import { ProceduralTextures } from '../shared/core/ProceduralTextures.js';
import { randRange } from '../shared/utils/Math.js';

/**
 * Static environment: neon grid floor, side rails, parallax starfield,
 * lighting rig, and a pooled explosion light-flash system.
 * All solid geometry is MeshStandardMaterial; the starfield is a background
 * emitter (Points) and is the only deliberate non-PBR surface.
 */
export class Arena {
  constructor(scene, textures) {
    this.scene = scene;
    this.textures = textures;
    this.disposables = [];
    this._flashPool = [];
    this._flashCursor = 0;

    this._buildFloor();
    this._buildRails();
    this._buildStarfield();
    this._buildLights();
    this._buildFlashPool();
  }

  _track(obj) {
    this.disposables.push(obj);
    return obj;
  }

  _buildFloor() {
    const grid = this.textures.gridFloor();
    const rough = this.textures.roughnessNoise();

    const mat = this._track(new THREE.MeshStandardMaterial({
      color: 0x05070f,
      metalness: 0.85,
      roughness: 0.4,
      roughnessMap: rough,
      emissive: new THREE.Color(0x00e5ff),
      emissiveMap: grid,
      emissiveIntensity: 0.55,
    }));

    const geo = this._track(new THREE.PlaneGeometry(44, 30));
    const floor = new THREE.Mesh(geo, mat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, -0.6, -2);
    this.scene.add(floor);
  }

  _buildRails() {
    const railGeo = this._track(new THREE.BoxGeometry(0.35, 0.35, 26));

    const defs = [
      { x: -11.4, color: 0x00e5ff },
      { x: 11.4, color: 0xff2fd6 },
    ];
    for (const d of defs) {
      const mat = this._track(new THREE.MeshStandardMaterial({
        color: 0x0a0f1a,
        metalness: 0.6,
        roughness: 0.3,
        emissive: new THREE.Color(d.color),
        emissiveIntensity: 2.6,
      }));
      const rail = new THREE.Mesh(railGeo, mat);
      rail.position.set(d.x, -0.45, -1);
      this.scene.add(rail);
    }
  }

  _buildStarfield() {
    const sprite = this.textures.glowSprite('#ffffff');
    const layers = [
      { count: 420, speed: 0.05, size: 0.16, z: -14, color: 0x9fd8ff },
      { count: 320, speed: 0.10, size: 0.22, z: -10, color: 0xffffff },
      { count: 160, speed: 0.20, size: 0.30, z: -6, color: 0xffd9f4 },
    ];

    this._starLayers = [];
    for (const L of layers) {
      const pos = new Float32Array(L.count * 3);
      for (let i = 0; i < L.count; i++) {
        pos[i * 3 + 0] = randRange(-26, 26);
        pos[i * 3 + 1] = randRange(-2, 20);
        pos[i * 3 + 2] = L.z + randRange(-2, 2);
      }
      const geo = this._track(new THREE.BufferGeometry());
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));

      const mat = this._track(new THREE.PointsMaterial({
        color: L.color,
        size: L.size,
        map: sprite,
        transparent: true,
        opacity: 0.85,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        sizeAttenuation: true,
      }));

      const points = new THREE.Points(geo, mat);
      this.scene.add(points);
      this._starLayers.push({ points, speed: L.speed, geo, count: L.count });
    }
  }

  _buildLights() {
    const ambient = new THREE.AmbientLight(0x223344, 0.7);
    this.scene.add(ambient);

    const key = new THREE.DirectionalLight(0xbfd9ff, 0.9);
    key.position.set(4, 12, 8);
    this.scene.add(key);

    const rimL = new THREE.PointLight(0x00e5ff, 22, 34, 1.6);
    rimL.position.set(-10, 6, 4);
    this.scene.add(rimL);

    const rimR = new THREE.PointLight(0xff2fd6, 22, 34, 1.6);
    rimR.position.set(10, 6, 4);
    this.scene.add(rimR);
  }

  _buildFlashPool() {
    // Pooled explosion flashes: max 2 active, round-robin steal.
    for (let i = 0; i < 2; i++) {
      const light = new THREE.PointLight(0xffffff, 0, 18, 2.0);
      light.visible = false;
      this.scene.add(light);
      this._flashPool.push({ light, t: 0, active: false, peak: 60 });
    }
  }

  /**
   * Flash a pooled point light at a world position.
   * @param {THREE.Vector3} position
   * @param {number} [peak=60] peak intensity
   * @param {number} [duration=0.25] seconds
   * @param {number|string} [color=0xffffff]
   */
  flash(position, peak = 60, duration = 0.25, color = 0xffffff) {
    const slot = this._flashPool[this._flashCursor];
    this._flashCursor = (this._flashCursor + 1) % this._flashPool.length;
    slot.active = true;
    slot.t = duration;
    slot.peak = peak;
    slot.light.color.set(color);
    slot.light.position.copy(position);
    slot.light.intensity = peak;
    slot.light.visible = true;
  }

  /** Advance starfield drift + light flashes. Runs on real dt (unaffected by hit-stop). */
  update(dt) {
    for (const L of this._starLayers) {
      const attr = L.geo.attributes.position;
      const arr = attr.array;
      for (let i = 0; i < L.count; i++) {
        arr[i * 3 + 1] -= L.speed * dt;
        if (arr[i * 3 + 1] < -2) arr[i * 3 + 1] += 22;
      }
      attr.needsUpdate = true;
    }

    for (const slot of this._flashPool) {
      if (!slot.active) continue;
      slot.t -= dt;
      if (slot.t <= 0) {
        slot.active = false;
        slot.light.visible = false;
        slot.light.intensity = 0;
      } else {
        slot.light.intensity = slot.peak * (slot.t / 0.25);
      }
    }
  }

  dispose() {
    for (const d of this.disposables) d.dispose();
    this.disposables.length = 0;
  }
}
