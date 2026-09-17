import {
  Scene,
  Color,
  FogExp2,
  OrthographicCamera,
  HemisphereLight,
  DirectionalLight,
  PointLight,
  Mesh,
  Group,
  InstancedMesh,
  MeshStandardMaterial,
  BoxGeometry,
  PlaneGeometry,
  TorusGeometry,
  LatheGeometry,
  OctahedronGeometry,
  Vector2,
  Object3D,
  DynamicDrawUsage,
  PMREMGenerator,
} from "three";
import { CONFIG } from "./config.js";
import {
  makeBeveledBox,
  mergeOwned,
  makePanelTextures,
  makeEnvironmentTexture,
} from "../shared/rendering/Procedural.js";
import { ResourceScope } from "../shared/core/ResourceScope.js";
import { SeededRandom } from "../shared/core/SeededRandom.js";
import { lerp, damp, clamp } from "../shared/core/math.js";
const EYE_OFFSETS = [-0.27, 0.27];
const ENVIRONMENT_COLORS = [0x277686, 0x65528f, 0x925441];
export class World {
  constructor({ renderer, config = CONFIG, seed = 8 }) {
    this.config = config;
    this.seed = seed;
    this.scope = new ResourceScope();
    this.scene = new Scene();
    this.scene.background = new Color(0x050914);
    this.scene.fog = new FogExp2(0x050914, 0.005);
    this.camera = new OrthographicCamera(-18, 18, 14, -14, 0.1, 100);
    this.camera.position.set(0, 0, 40);
    this.camera.lookAt(0, 0, 0);
    this.dummy = new Object3D();
    this.color = new Color();
    this.tint = new Color();
    this.bunkerVersion = -1;
    this.previousTime = 0;
    this.scene.add(new HemisphereLight(0x8ecfff, 0x152039, 1.3));
    const key = new DirectionalLight(0xd8eaff, 3.5);
    key.position.set(-6, 10, 18);
    this.scene.add(key);
    this.keyLight = key;
    this.impactLights = [
      new PointLight(0x42e8f5, 0, 10, 2),
      new PointLight(0xff548c, 0, 10, 2),
    ];
    for (const light of this.impactLights) this.scene.add(light);
    this.rebuildEnvironment(renderer);
    this.createStage();
    this.createAliens();
    this.createPlayer();
    this.createSaucer();
    this.createStars();
    this.bunkerMaterial = this.material({
      color: 0x4a988b,
      metalness: 0.4,
      roughness: 0.6,
      emissive: 0x1b6657,
      emissiveIntensity: 0.35,
    });
    this.bunkers = this.instances(
      this.geometry(new BoxGeometry(0.307, 0.307, 0.36)),
      this.bunkerMaterial,
      384,
    );
    this.shotBatches = [0, 1].map((i) =>
      this.instances(
        this.geometry(makeBeveledBox(i ? 0.2 : 0.14, 0.5, 0.18, 0.02)),
        this.material({
          color: config.palette[i],
          emissive: config.palette[i],
          emissiveIntensity: i ? 3 : 2.8,
          roughness: 0.35,
        }),
        i ? 24 : 3,
      ),
    );
    this.trailSources = Array.from({ length: 27 }, (_, id) => ({
      id,
      generation: 0,
      active: false,
      x: 0,
      y: 0,
      z: 0.08,
      palette: id < 3 ? 0 : 1,
    }));
  }
  geometry(g) {
    return this.scope.own(g);
  }
  material(params) {
    return this.scope.own(new MeshStandardMaterial(params));
  }
  mesh(g, m, parent = this.scene) {
    const mesh = new Mesh(g, m);
    parent.add(mesh);
    this.scope.defer(() => mesh.removeFromParent());
    return mesh;
  }
  instances(g, m, count) {
    const mesh = new InstancedMesh(g, m, count);
    mesh.instanceMatrix.setUsage(DynamicDrawUsage);
    mesh.frustumCulled = false;
    mesh.count = 0;
    this.scene.add(mesh);
    this.scope.own(mesh);
    this.scope.defer(() => mesh.removeFromParent());
    return mesh;
  }
  put(batch, index, x, y, z, sx = 1, sy = 1, sz = 1, rz = 0) {
    const d = this.dummy;
    d.position.set(x, y, z);
    d.rotation.set(0, 0, rz);
    d.scale.set(sx, sy, sz);
    d.updateMatrix();
    batch.setMatrixAt(index, d.matrix);
  }
  createStage() {
    const tex = makePanelTextures(this.seed);
    this.scope.own(tex.color);
    this.scope.own(tex.roughness);
    const plate = this.material({
      color: 0x93a8be,
      map: tex.color,
      roughnessMap: tex.roughness,
      metalness: 0.2,
      roughness: 0.9,
      transparent: true,
      opacity: 0.8,
    });
    this.mesh(this.geometry(new PlaneGeometry(33.4, 25.2)), plate).position.z =
      -1.8;
    const frame = this.material({
      color: 0x1d3048,
      metalness: 0.72,
      roughness: 0.35,
    });
    const pieces = [];
    for (const x of [-16.8, 16.8]) {
      const g = makeBeveledBox(0.36, 25.8, 0.55, 0.08);
      g.translate(x, 0, -0.9);
      pieces.push(g);
    }
    for (const y of [-12.9, 12.9]) {
      const g = makeBeveledBox(33.9, 0.34, 0.55, 0.08);
      g.translate(0, y, -0.9);
      pieces.push(g);
    }
    this.mesh(this.geometry(mergeOwned(pieces)), frame);
    this.railMaterial = this.material({
      color: 0x223f51,
      emissive: 0x277686,
      emissiveIntensity: 1.4,
      metalness: 0.4,
      roughness: 0.35,
    });
    const railGeometry = this.geometry(new BoxGeometry(0.035, 22.5, 0.06));
    for (const x of [-16.5, 16.5])
      this.mesh(railGeometry, this.railMaterial).position.set(x, 0, -0.5);
    const ticks = [];
    for (let i = 0; i < 50; i++) {
      const x = -15.5 + i * (31 / 49);
      const g = new BoxGeometry(0.17, 0.018, 0.035);
      g.translate(x, this.config.breach, -0.4);
      ticks.push(g);
    }
    this.defenseMaterial = this.material({
      color: 0x93304c,
      emissive: 0xff3264,
      emissiveIntensity: 0.32,
      roughness: 0.7,
    });
    this.mesh(this.geometry(mergeOwned(ticks)), this.defenseMaterial);
    const marks = [];
    for (let r = 0; r < 24; r++)
      for (const x of [-16.15, 16.15]) {
        const g = new BoxGeometry(r % 4 === 0 ? 0.3 : 0.12, 0.025, 0.04);
        g.translate(x, -11.5 + r, -0.45);
        marks.push(g);
      }
    this.mesh(
      this.geometry(mergeOwned(marks)),
      this.material({
        color: 0x496780,
        emissive: 0x263d52,
        emissiveIntensity: 0.4,
      }),
    );
  }
  createAliens() {
    const colors = [0xff829e, 0xb7a0ed, 0x68cdb5];
    this.alienBatches = [];
    const unit = makeBeveledBox(0.177, 0.122, 0.28, 0.018);
    for (let species = 0; species < 3; species++) {
      const material = this.material({
        color: colors[species],
        metalness: 0.42,
        roughness: 0.35,
        emissive: colors[species],
        emissiveIntensity: 0.12,
      });
      for (let pose = 0; pose < 2; pose++) {
        const parts = [],
          mask = this.config.masks[species * 2 + pose];
        for (let y = 0; y < 8; y++)
          for (let x = 0; x < 8; x++)
            if (mask[y][x] === "1") {
              const g = unit.clone();
              g.translate((x - 3.5) * 0.18, (3.5 - y) * 0.125, 0);
              parts.push(g);
            }
        this.alienBatches.push(
          this.instances(this.geometry(mergeOwned(parts)), material, 55),
        );
      }
    }
    unit.dispose();
    this.eyes = this.instances(
      this.geometry(new BoxGeometry(0.14, 0.08, 0.06)),
      this.material({
        color: 0xffe3ce,
        emissive: 0xffbdb1,
        emissiveIntensity: 2.4,
      }),
      110,
    );
  }
  createPlayer() {
    this.ship = new Group();
    this.scene.add(this.ship);
    this.scope.defer(() => this.ship.removeFromParent());
    const hull = this.material({
        color: 0x83bdce,
        metalness: 0.65,
        roughness: 0.28,
      }),
      dark = this.material({ color: 0x152b3e, metalness: 0.6, roughness: 0.3 });
    const parts = [];
    for (const [x, y, w, h, d] of [
      [0, 0, 0.76, 0.5, 0.4],
      [-0.5, -0.04, 0.42, 0.27, 0.25],
      [0.5, -0.04, 0.42, 0.27, 0.25],
      [0, 0.22, 0.4, 0.4, 0.28],
    ]) {
      const g = makeBeveledBox(w, h, d, 0.05);
      g.translate(x, y, 0);
      parts.push(g);
    }
    this.mesh(this.geometry(mergeOwned(parts)), hull, this.ship);
    this.mesh(
      this.geometry(makeBeveledBox(0.28, 0.28, 0.16, 0.04)),
      dark,
      this.ship,
    ).position.set(0, 0.09, 0.28);
    const glow = this.material({
      color: 0x42e8f5,
      emissive: 0x42e8f5,
      emissiveIntensity: 3,
    });
    this.cannon = this.mesh(
      this.geometry(makeBeveledBox(0.12, 0.46, 0.13, 0.025)),
      glow,
      this.ship,
    );
    this.cannon.position.set(0, 0.43, 0);
    this.engines = [];
    const engine = this.geometry(new BoxGeometry(0.13, 0.12, 0.08));
    for (const x of [-0.48, 0.48]) {
      const m = this.mesh(engine, glow, this.ship);
      m.position.set(x, -0.22, 0.12);
      this.engines.push(m);
    }
    this.halo = this.mesh(
      this.geometry(new TorusGeometry(0.98, 0.023, 4, 64)),
      this.material({
        color: 0x42e8f5,
        emissive: 0x42e8f5,
        emissiveIntensity: 2,
        transparent: true,
        opacity: 0.55,
        depthWrite: false,
      }),
      this.ship,
    );
    this.halo.position.z = -0.12;
  }
  createSaucer() {
    this.ufo = new Group();
    this.scene.add(this.ufo);
    this.scope.defer(() => this.ufo.removeFromParent());
    const profile = [
      new Vector2(0, -0.17),
      new Vector2(0.6, -0.17),
      new Vector2(1.03, 0),
      new Vector2(0.62, 0.15),
      new Vector2(0.4, 0.33),
      new Vector2(0, 0.4),
    ];
    const body = this.mesh(
      this.geometry(new LatheGeometry(profile, 32)),
      this.material({ color: 0xbbb0ac, metalness: 0.75, roughness: 0.24 }),
      this.ufo,
    );
    body.rotation.x = 0.4;
    const glow = this.material({
      color: 0xffc46b,
      emissive: 0xffc46b,
      emissiveIntensity: 2.5,
    });
    this.mesh(
      this.geometry(new TorusGeometry(0.9, 0.04, 6, 48)),
      glow,
      this.ufo,
    ).scale.y = 0.22;
    const windowGeometry = this.geometry(new BoxGeometry(0.09, 0.07, 0.08));
    for (let i = 0; i < 9; i++) {
      const m = this.mesh(windowGeometry, glow, this.ufo);
      m.position.set((i - 4) * 0.18, 0.03, 0.53);
    }
  }
  createStars() {
    const rng = new SeededRandom(this.seed ^ 0xab32);
    this.stars = [];
    const g = this.geometry(new OctahedronGeometry(1, 0));
    for (let layer = 0; layer < 3; layer++) {
      const batch = this.instances(
        g,
        this.material({
          color: 0x6990ae,
          emissive: 0x92b7d7,
          emissiveIntensity: layer === 0 ? 1 : 0.5,
          roughness: 1,
        }),
        300,
      );
      const records = Array.from({ length: 300 }, () => ({
        x: rng.range(-38, 38),
        y: rng.range(-28, 28),
        z: -5 - layer * 4,
        size: rng.range(0.018, 0.065),
        phase: rng.range(0, 6.28),
      }));
      this.stars.push({ batch, records });
    }
  }
  releaseEnvironment() {
    if (this.environment) {
      this.scene.environment = null;
      this.scope.disposeOwned(this.environment);
      this.environment = null;
    }
  }
  rebuildEnvironment(renderer) {
    this.releaseEnvironment();
    const texture = makeEnvironmentTexture(this.seed),
      generator = new PMREMGenerator(renderer);
    try {
      this.environment = this.scope.own(generator.fromEquirectangular(texture));
      this.scene.environment = this.environment.texture;
      this.scene.environmentIntensity = 0.75;
    } finally {
      texture.dispose();
      generator.dispose();
    }
  }
  sync(game, alpha, time) {
    const e = game.entities,
      s = game.state,
      dt = Math.min(0.1, time - this.previousTime);
    this.previousTime = time;
    for (const batch of this.alienBatches) batch.count = 0;
    this.eyes.count = 0;
    let lowest = 10;
    for (let i = 0; i < e.aliens.activeCount; i++) {
      const a = e.aliens.items[e.aliens.activeIds[i]],
        x = lerp(a.px, a.x, alpha),
        y = lerp(a.py, a.y, alpha);
      lowest = Math.min(lowest, y);
      const batch = this.alienBatches[a.species * 2 + game.formation.phase],
        bob = 0.035 * Math.sin(time * 3 + a.col * 0.5);
      this.put(
        batch,
        batch.count++,
        x,
        y,
        bob,
        1,
        1,
        1,
        Math.sin(time * 2 + a.col) * 0.018,
      );
      for (const offset of EYE_OFFSETS)
        this.put(
          this.eyes,
          this.eyes.count++,
          x + offset,
          y + 0.02,
          0.185 + bob,
        );
    }
    for (const batch of this.alienBatches)
      batch.instanceMatrix.needsUpdate = true;
    this.eyes.instanceMatrix.needsUpdate = true;
    const p = e.player.items[0];
    this.ship.visible = e.player.activeCount > 0;
    this.ship.position.set(
      lerp(p.px, p.x, alpha),
      lerp(p.py, p.y, alpha),
      0.08,
    );
    this.ship.rotation.z = damp(
      this.ship.rotation.z,
      (-p.vx / 16) * 0.14,
      16,
      dt,
    );
    this.cannon.position.y = 0.43 - 0.1 * p.recoil;
    this.halo.visible = p.invulnerability > 0;
    this.halo.scale.setScalar(1 + 0.04 * Math.sin(time * 12));
    this.halo.material.opacity = 0.3 + 0.35 * (0.5 + 0.5 * Math.sin(time * 12));
    if (p.invulnerability > 0)
      this.ship.scale.setScalar(0.98 + 0.02 * Math.sin(time * 28));
    else this.ship.scale.setScalar(1);
    for (let i = 0; i < this.engines.length; i++)
      this.engines[i].scale.y = 1 + 0.6 * (0.5 + 0.5 * Math.sin(time * 30 + i));
    this.ufo.visible = e.saucer.activeCount > 0;
    if (this.ufo.visible) {
      const u = e.saucer.items[0];
      this.ufo.position.set(lerp(u.px, u.x, alpha), u.y, 0.1);
      this.ufo.rotation.z = Math.sin(time * 3) * 0.06;
    }
    if (this.bunkerVersion !== game.bunkers.version) {
      this.bunkerVersion = game.bunkers.version;
      this.bunkers.count = 0;
      for (const cell of game.bunkers.cells)
        if (game.bunkers.health[cell.id]) {
          const index = this.bunkers.count++;
          this.put(
            this.bunkers,
            index,
            cell.x,
            cell.y,
            -0.05,
            1,
            1,
            game.bunkers.health[cell.id] === 1 ? 0.65 : 1,
          );
          this.color.setHex(
            game.bunkers.health[cell.id] === 1 ? 0x5a7567 : 0x9ce2c4,
          );
          this.bunkers.setColorAt(index, this.color);
        }
      this.bunkers.instanceMatrix.needsUpdate = true;
      if (this.bunkers.instanceColor)
        this.bunkers.instanceColor.needsUpdate = true;
    }
    for (let owner = 0; owner < 2; owner++) {
      const pool = owner === 0 ? e.playerShots : e.enemyShots,
        batch = this.shotBatches[owner];
      batch.count = 0;
      for (let id = 0; id < pool.capacity; id++) {
        const source = this.trailSources[owner === 0 ? id : 3 + id];
        source.active = pool.isActive(id);
        source.generation = pool.generations[id];
        if (!source.active) continue;
        const shot = pool.items[id];
        source.x = lerp(shot.px, shot.x, alpha);
        source.y = lerp(shot.py, shot.y, alpha);
        this.put(
          batch,
          batch.count++,
          source.x,
          source.y,
          0.15,
          1,
          1,
          1,
          owner ? Math.atan2(-shot.vx, -shot.vy) : 0,
        );
      }
      batch.instanceMatrix.needsUpdate = true;
    }
    for (let layer = 0; layer < 3; layer++) {
      const { batch, records } = this.stars[layer];
      batch.count = records.length;
      for (let i = 0; i < records.length; i++) {
        const star = records[i],
          size = star.size * (0.85 + 0.15 * Math.sin(time * 0.6 + star.phase));
        this.put(
          batch,
          i,
          star.x - p.x * 0.01 * (layer + 1),
          star.y,
          star.z,
          size,
          size,
          size,
        );
      }
      batch.instanceMatrix.needsUpdate = true;
    }
    this.color.setHex(ENVIRONMENT_COLORS[s.wave - 1] || ENVIRONMENT_COLORS[0]);
    this.railMaterial.emissive.lerp(this.color, 1 - Math.exp(-dt * 2));
    this.tint.copy(this.color);
    this.color.setHex(0xd8eaff).lerp(this.tint, 0.15);
    this.keyLight.color.lerp(this.color, 1 - Math.exp(-dt * 2));
    this.color.setHex(0x050914).lerp(this.tint, 0.03);
    this.scene.fog.color.lerp(this.color, 1 - Math.exp(-dt * 2));
    this.defenseMaterial.emissiveIntensity =
      lowest < -3 ? 0.6 + 0.4 * Math.sin(time * 5) : 0.28;
  }
  dispose() {
    this.scene.environment = null;
    this.scope.dispose();
    this.scene.clear();
  }
}
