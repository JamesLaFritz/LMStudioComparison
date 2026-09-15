import * as THREE from 'three';
import { ProceduralTextures } from './ProceduralTextures.js';
import { ProceduralGeometry } from './ProceduralGeometry.js';
import { ResourceTracker } from './ResourceTracker.js';

/**
 * Environment — reusable retro-futurist arena dressing:
 * synthwave grid floor, parallax starfield (InstancedMesh), retro sun,
 * neon arena walls, and blob shadows.
 *
 * Every build method returns { group, dispose() } so the owner can cascade.
 */
export class Environment {
  /**
   * Synthwave grid floor.
   * @param {number} width  X extent
   * @param {number} depth  Z extent
   * @param {ResourceTracker} [tracker]
   */
  static gridFloor(width, depth, tracker = null) {
    const tex = ProceduralTextures.grid();
    const mat = new THREE.MeshStandardMaterial({
      map: tex,
      emissiveMap: tex,
      emissive: new THREE.Color(0x00e5ff),
      emissiveIntensity: 0.32,
      color: 0x0a0d18,
      roughness: 0.92,
      metalness: 0.15,
    });
    const geo = new THREE.PlaneGeometry(width, depth);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    const group = new THREE.Group();
    group.add(mesh);
    return Environment._wrap(group, [geo, mat, tex], tracker);
  }

  /**
   * Parallax starfield — one InstancedMesh of tiny emissive octahedra in 3 depth shells.
   */
  static starfield({ count = 250, radius = 90, tracker = null } = {}) {
    const geo = new THREE.OctahedronGeometry(0.16, 0);
    const mat = new THREE.MeshStandardMaterial({
      color: 0x0b0e1a,
      emissive: new THREE.Color(0xbfe8ff),
      emissiveIntensity: 1.6,
      roughness: 1,
      metalness: 0,
    });
    const inst = new THREE.InstancedMesh(geo, mat, count);
    inst.instanceMatrix.setUsage(THREE.StaticDrawUsage);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3();
    const p = new THREE.Vector3();
    for (let i = 0; i < count; i++) {
      // Random point on a flattened sphere shell (3 depth bands).
      const band = i % 3;
      const r = radius * (0.55 + band * 0.22);
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      p.set(
        r * Math.sin(phi) * Math.cos(theta),
        Math.abs(r * Math.cos(phi)) * 0.8 + 2,
        r * Math.sin(phi) * Math.sin(theta)
      );
      const sc = 0.5 + Math.random() * 1.4;
      s.setScalar(sc);
      q.setFromEuler(new THREE.Euler(Math.random() * 3, Math.random() * 3, 0));
      m.compose(p, q, s);
      inst.setMatrixAt(i, m);
    }
    inst.instanceMatrix.needsUpdate = true;
    const group = new THREE.Group();
    group.add(inst);
    return Environment._wrap(group, [geo, mat], tracker);
  }

  /**
   * Retro sun — striped synthwave disc far behind the playfield.
   */
  static retroSun({ size = 30, position = new THREE.Vector3(0, 9, -70), tracker = null } = {}) {
    const tex = ProceduralTextures.retroSun();
    const mat = new THREE.MeshStandardMaterial({
      map: tex,
      emissiveMap: tex,
      emissive: new THREE.Color(0xffffff),
      emissiveIntensity: 1.15,
      color: 0x12060f,
      roughness: 1,
      metalness: 0,
      transparent: true,
      alphaTest: 0.05,
    });
    const geo = new THREE.CircleGeometry(size, 48);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(position);
    const group = new THREE.Group();
    group.add(mesh);
    return Environment._wrap(group, [geo, mat, tex], tracker);
  }

  /**
   * Neon arena walls — two side rails + a back wall, emissive edges.
   */
  static arenaWalls({ width = 24, depth = 34, height = 3.2, color = 0x00e5ff, tracker = null } = {}) {
    const group = new THREE.Group();
    const disposables = [];
    const railMat = new THREE.MeshStandardMaterial({
      color: 0x0a0f1e,
      emissive: new THREE.Color(color),
      emissiveIntensity: 0.9,
      roughness: 0.6,
      metalness: 0.4,
    });
    const railGeo = new THREE.BoxGeometry(0.35, height, depth);
    const left = new THREE.Mesh(railGeo, railMat);
    left.position.set(-width / 2, height / 2 - 0.2, 0);
    const right = new THREE.Mesh(railGeo, railMat);
    right.position.set(width / 2, height / 2 - 0.2, 0);
    const backMat = new THREE.MeshStandardMaterial({
      color: 0x0a0f1e,
      emissive: new THREE.Color(0xff2bd6),
      emissiveIntensity: 0.7,
      roughness: 0.6,
      metalness: 0.4,
    });
    const backGeo = new THREE.BoxGeometry(width, height, 0.35);
    const back = new THREE.Mesh(backGeo, backMat);
    back.position.set(0, height / 2 - 0.2, -depth / 2);
    group.add(left, right, back);
    disposables.push(railGeo, railMat, backGeo, backMat);
    return Environment._wrap(group, disposables, tracker);
  }

  /**
   * Blob shadow — soft dark disc to ground objects without shadow maps.
   */
  static blobShadow({ radius = 1, opacity = 0.35, color = 0x000000, tracker = null } = {}) {
    const tex = ProceduralTextures.blobShadow();
    const mat = new THREE.MeshStandardMaterial({
      color: 0x000000,
      emissive: new THREE.Color(color),
      emissiveIntensity: 0,
      alphaMap: tex,
      transparent: true,
      opacity,
      depthWrite: false,
    });
    const geo = new THREE.PlaneGeometry(radius * 2, radius * 2);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    const group = new THREE.Group();
    group.add(mesh);
    return Environment._wrap(group, [geo, mat, tex], tracker);
  }

  /**
   * Full arena package: floor + stars + sun + walls in one group.
   */
  static buildArena(opts = {}, tracker = null) {
    const group = new THREE.Group();
    const parts = [
      Environment.gridFloor(opts.width ?? 46, opts.depth ?? 60, tracker),
      Environment.starfield({ count: opts.stars ?? 250, radius: 90, tracker }),
      Environment.retroSun({ size: 30, position: new THREE.Vector3(0, 10, -72), tracker }),
      Environment.arenaWalls({ width: 24, depth: 34, height: 3.2, color: 0x00e5ff, tracker }),
    ];
    for (const part of parts) {
      group.add(part.group);
      part._disposables = null; // owned by tracker now
    }
    return { group, parts };
  }

  static _wrap(group, disposables, tracker) {
    if (tracker) for (const d of disposables) tracker.track(d);
    return {
      group,
      dispose() {
        for (const d of disposables) d.dispose();
      },
    };
  }
}
