import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/**
 * ProceduralGeometry — geometry helpers: 2D simplex noise and
 * box-composition merging for low-poly silhouettes.
 */
export class ProceduralGeometry {
  /**
   * 2D simplex noise (Stefan Gustavson / Ashima Arts, public domain).
   * Returns a function (x, y) → [-1, 1].
   */
  static simplex2(seed = 1337) {
    const grad = [
      [1, 1], [-1, 1], [1, -1], [-1, -1],
      [1, 0], [-1, 0], [0, 1], [0, -1],
    ];
    const p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) p[i] = i;
    // Seeded shuffle (mulberry32).
    let s = seed >>> 0;
    const rand = () => {
      s |= 0; s = (s + 0x6d2b79f5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      const tmp = p[i]; p[i] = p[j]; p[j] = tmp;
    }
    const perm = new Uint8Array(512);
    const permGrad = new Uint8Array(512);
    for (let i = 0; i < 512; i++) {
      perm[i] = p[i & 255];
      permGrad[i] = perm[i] % 8;
    }
    const F2 = 0.5 * (Math.sqrt(3) - 1);
    const G2 = (3 - Math.sqrt(3)) / 6;
    return (xin, yin) => {
      const s0 = (xin + yin) * F2;
      const i = Math.floor(xin + s0);
      const j = Math.floor(yin + s0);
      const t = (i + j) * G2;
      const x0 = xin - (i - t);
      const y0 = yin - (j - t);
      const i1 = x0 > y0 ? 1 : 0;
      const j1 = x0 > y0 ? 0 : 1;
      const x1 = x0 - i1 + G2;
      const y1 = y0 - j1 + G2;
      const x2 = x0 - 1 + 2 * G2;
      const y2 = y0 - 1 + 2 * G2;
      const ii = i & 255;
      const jj = j & 255;
      let n0 = 0, n1 = 0, n2 = 0;
      let t0 = 0.5 - x0 * x0 - y0 * y0;
      if (t0 >= 0) {
        const g = grad[permGrad[ii + perm[jj]]];
        t0 *= t0;
        n0 = t0 * t0 * (g[0] * x0 + g[1] * y0);
      }
      let t1 = 0.5 - x1 * x1 - y1 * y1;
      if (t1 >= 0) {
        const g = grad[permGrad[ii + i1 + perm[jj + j1]]];
        t1 *= t1;
        n1 = t1 * t1 * (g[0] * x1 + g[1] * y1);
      }
      let t2 = 0.5 - x2 * x2 - y2 * y2;
      if (t2 >= 0) {
        const g = grad[permGrad[ii + 1 + perm[jj + 1]]];
        t2 *= t2;
        n2 = t2 * t2 * (g[0] * x2 + g[1] * y2);
      }
      return 70 * (n0 + n1 + n2);
    };
  }

  /**
   * Displace a geometry's vertices with a function.
   * @param {THREE.BufferGeometry} geometry
   * @param {(x:number,y:number,z:number)=>number} fn — returns new Y (or offset)
   * @param {boolean} [inPlace=true]
   */
  static displaceY(geometry, fn, inPlace = true) {
    const pos = geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const z = pos.getZ(i);
      pos.setY(i, fn(x, y, z));
    }
    pos.needsUpdate = true;
    geometry.computeVertexNormals();
    return inPlace ? geometry : geometry;
  }

  /**
   * Build a box at (x, y, z) with size (sx, sy, sz), optionally rotated.
   * Returns a translated BoxGeometry.
   */
  static box(sx, sy, sz, x = 0, y = 0, z = 0, rotY = 0, rotZ = 0) {
    const g = new THREE.BoxGeometry(sx, sy, sz);
    if (rotY) g.rotateY(rotY);
    if (rotZ) g.rotateZ(rotZ);
    g.translate(x, y, z);
    return g;
  }

  /**
   * Merge a list of geometries into one (caller disposes inputs if wanted).
   * @param {THREE.BufferGeometry[]} geos
   * @param {boolean} [disposeInputs=true]
   */
  static merge(geos, disposeInputs = true) {
    const merged = mergeGeometries(geos, false);
    if (disposeInputs) for (const g of geos) g.dispose();
    return merged;
  }

  /**
   * A rounded-look box via beveled box (BoxGeometry with more segments).
   * Simple stand-in; keeps MeshStandardMaterial PBR.
   */
  static roundedBox(w, h, d, seg = 2) {
    return new THREE.BoxGeometry(w, h, d, seg, seg, seg);
  }

  /**
   * Lathe (surface of revolution) from a 2D profile.
   * @param {Array<[number, number]>} points — [radius, y] pairs, radius >= 0
   * @param {number} [segments=24]
   */
  static lathe(points, segments = 24) {
    const pts = points.map(([r, y]) => new THREE.Vector2(Math.max(0.001, r), y));
    return new THREE.LatheGeometry(pts, segments);
  }
}
