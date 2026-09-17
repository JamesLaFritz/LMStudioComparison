// Synthwave backdrop: scrolling emissive grid floor, striped retro sun, fBm planet, two-layer
// instanced starfield, the fixed light rig, an invasion-pressure pulse light and pooled muzzle lights.
import {
  Mesh,
  PlaneGeometry,
  CircleGeometry,
  SphereGeometry,
  IcosahedronGeometry,
  InstancedMesh,
  MeshStandardMaterial,
  PointLight,
  Matrix4,
  Vector3,
  Quaternion,
  Color,
  Fog,
  DynamicDrawUsage,
} from 'three';
import { makeGridTexture, makeSunTexture, makePlanetTextures } from '@shared/procgen/TextureFactory.js';
import { floorMaterial, neonMaterial, enableInstanceEmissiveTint } from '@shared/procgen/MaterialLibrary.js';
import { createNeonLighting } from '@shared/render/Lighting.js';
import { clamp, damp } from '@shared/math/MathUtils.js';
import { WORLD, COLORS, RENDER } from '../config.js';

const _m = new Matrix4();
const _p = new Vector3();
const _q = new Quaternion();
const _s = new Vector3();
const _c = new Color();

const STAR_LAYERS = [
  { count: 500, radius: 0.05, speed: 0.8, zMin: -80, zMax: -55 },
  { count: 250, radius: 0.09, speed: 1.6, zMin: -55, zMax: -30 },
];
const STAR_Y_MIN = -25;
const STAR_Y_MAX = 70;
const STAR_PALETTE = [0xffffff, 0xcfe8ff, 0x19f0ff, 0xffd6f4, 0xff2bd6, 0xfff1c2];

export class Environment {
  /**
   * @param {import('three').Scene} scene
   * @param {import('@shared/core/ResourceTracker.js').ResourceTracker} tracker
   * @param {import('@shared/procgen/Random.js').Random} random
   */
  constructor(scene, tracker, random) {
    this.scene = scene;
    this.random = random;
    this.pressure = 0;
    this.pulseClock = 0;

    // Distance fog dissolves the grid's far edge into the void.
    scene.fog = new Fog(RENDER.fog.color, RENDER.fog.near, RENDER.fog.far);

    this.lighting = createNeonLighting(scene, {
      hemiIntensity: 0.8,
      keyIntensity: 1.4,
      rimIntensity: 0.6,
      keyPosition: [6, 18, 12],
      rimPosition: [-8, 6, -10],
      target: [0, WORLD.VIEW.centerY, 0],
    });

    // ── Grid floor.
    this.gridTexture = tracker.track(makeGridTexture({ size: 1024, cells: 32, repeat: [16, 16] }));
    const floorGeometry = tracker.track(new PlaneGeometry(200, 200, 1, 1));
    this.floorMaterial = tracker.track(floorMaterial({ map: this.gridTexture, emissive: COLORS.CYAN, intensity: 0.45, roughness: 0.6, metalness: 0.3 }));
    this.floor = new Mesh(floorGeometry, this.floorMaterial);
    this.floor.rotation.x = -Math.PI * 0.5;
    this.floor.position.set(0, WORLD.FLOOR_Y, -30);
    scene.add(this.floor);
    tracker.track(this.floor);

    // ── Retro sun.
    this.sunTexture = tracker.track(makeSunTexture({ size: 512 }));
    const sunGeometry = tracker.track(new CircleGeometry(15, 64));
    this.sunMaterial = tracker.track(
      new MeshStandardMaterial({
        map: this.sunTexture,
        emissiveMap: this.sunTexture,
        emissive: new Color(0xffffff),
        emissiveIntensity: 0.7,
        color: new Color(0x000000),
        transparent: true,
        depthWrite: false,
        roughness: 1,
        metalness: 0,
      }),
    );
    this.sun = new Mesh(sunGeometry, this.sunMaterial);
    this.sun.position.set(0, 3, -70);
    this.sun.renderOrder = -2;
    scene.add(this.sun);
    tracker.track(this.sun);

    // ── Planet.
    const planetMaps = makePlanetTextures({ size: 512, seed: 42 });
    tracker.track(planetMaps.map);
    tracker.track(planetMaps.emissiveMap);
    const planetGeometry = tracker.track(new SphereGeometry(9, 48, 32));
    this.planetMaterial = tracker.track(
      new MeshStandardMaterial({
        map: planetMaps.map,
        emissiveMap: planetMaps.emissiveMap,
        emissive: new Color(COLORS.AMBER),
        emissiveIntensity: 0.9,
        roughness: 0.9,
        metalness: 0.05,
      }),
    );
    this.planet = new Mesh(planetGeometry, this.planetMaterial);
    this.planet.position.set(-28, 20, -70);
    this.planet.rotation.z = 0.35;
    scene.add(this.planet);
    tracker.track(this.planet);

    // ── Starfield (two depth layers).
    this.starLayers = [];
    for (const layer of STAR_LAYERS) {
      const geometry = tracker.track(new IcosahedronGeometry(layer.radius, 0));
      const material = tracker.track(neonMaterial({ color: 0x000000, emissive: 0xffffff, intensity: 2.0, roughness: 1 }));
      enableInstanceEmissiveTint(material);
      const mesh = new InstancedMesh(geometry, material, layer.count);
      mesh.instanceMatrix.setUsage(DynamicDrawUsage);
      mesh.frustumCulled = false;
      _q.identity();
      for (let i = 0; i < layer.count; i++) {
        const scale = random.range(0.6, 1.6);
        _p.set(random.range(-90, 90), random.range(STAR_Y_MIN, STAR_Y_MAX), random.range(layer.zMin, layer.zMax));
        _s.set(scale, scale, scale);
        _m.compose(_p, _q, _s);
        mesh.setMatrixAt(i, _m);
        _c.set(random.pick(STAR_PALETTE)).multiplyScalar(random.range(0.5, 1));
        mesh.setColorAt(i, _c);
      }
      mesh.instanceMatrix.needsUpdate = true;
      mesh.instanceColor.needsUpdate = true;
      scene.add(mesh);
      tracker.track(mesh);
      this.starLayers.push({ mesh, speed: layer.speed, count: layer.count });
    }

    // ── Dynamic lights (fixed set, intensity-modulated).
    this.pulseLight = new PointLight(COLORS.RED, 0, 40, 2);
    this.pulseLight.position.set(0, 5, 4);
    scene.add(this.pulseLight);

    this.muzzleLights = [];
    for (let i = 0; i < 3; i++) {
      const light = new PointLight(COLORS.CYAN, 0, 14, 2);
      light.position.set(0, -50, 2);
      scene.add(light);
      this.muzzleLights.push({ light, energy: 0 });
    }
    this._muzzleCursor = 0;
    this.pulseIntensity = 0;
  }

  /** Flash a pooled muzzle light at (x, y). */
  flashMuzzle(x, y, intensity = 90) {
    const slot = this.muzzleLights[this._muzzleCursor];
    this._muzzleCursor = (this._muzzleCursor + 1) % this.muzzleLights.length;
    slot.light.position.set(x, y, 1.5);
    slot.energy = intensity;
    slot.light.intensity = intensity;
  }

  /** `pressure` ∈ [0, 1]: how close the invasion is. Drives the red pulse. */
  setPressure(pressure) {
    this.pressure = clamp(pressure, 0, 1);
  }

  update(dt) {
    this.gridTexture.offset.y -= 0.12 * dt;
    if (this.gridTexture.offset.y < -1) this.gridTexture.offset.y += 1;

    for (const layer of this.starLayers) {
      const mesh = layer.mesh;
      const dy = layer.speed * dt;
      for (let i = 0; i < layer.count; i++) {
        mesh.getMatrixAt(i, _m);
        let y = _m.elements[13] - dy;
        if (y < STAR_Y_MIN) y += STAR_Y_MAX - STAR_Y_MIN;
        _m.elements[13] = y;
        mesh.setMatrixAt(i, _m);
      }
      mesh.instanceMatrix.needsUpdate = true;
    }

    this.planet.rotation.y += dt * 0.02;

    // Invasion pulse: faster and brighter as the formation nears the cannon.
    this.pulseClock += dt * (1.5 + 2 * this.pressure);
    const target = this.pressure > 0.01 ? this.pressure * 140 * (0.5 + 0.5 * Math.sin(this.pulseClock * Math.PI * 2)) : 0;
    this.pulseIntensity = damp(this.pulseIntensity, target, 10, dt);
    this.pulseLight.intensity = this.pulseIntensity;

    for (const slot of this.muzzleLights) {
      if (slot.energy > 0) {
        slot.energy = Math.max(0, slot.energy - dt * 700);
        slot.light.intensity = slot.energy;
      }
    }
  }

  dispose() {
    this.scene.fog = null;
    this.lighting.dispose();
    this.scene.remove(this.pulseLight);
    this.pulseLight.dispose();
    for (const slot of this.muzzleLights) {
      this.scene.remove(slot.light);
      slot.light.dispose();
    }
    // Meshes, geometries, materials and textures are owned by the ResourceTracker.
  }
}
