import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { saturate } from '../util/MathUtils.js';

/**
 * Procedural geometry construction.
 *
 * The centrepiece is `bitmapToGeometry`, which turns a 1978 sprite bitmap into
 * a single merged, extruded, bevelled `BufferGeometry`. This is how every
 * character in the game is built: there are no model files, and the silhouettes
 * are pixel-exact to the originals because they *are* the original bitmaps.
 *
 * The naive approach — one `BoxGeometry` per lit pixel — produces 34 boxes for
 * an 11x8 invader, which is 408 triangles of mostly-hidden interior faces.
 * Greedy rectangle meshing collapses that to ~11 boxes before extrusion, and
 * the bevel shell is applied to the merged result rather than per-box. The
 * saving compounds: six species/pose combinations at 55 instances each.
 */

/* ================================================================== *
 * Bitmap parsing and greedy meshing
 * ================================================================== */

/**
 * Parse a human-readable sprite into a bit array.
 *
 * Bitmaps are authored as arrays of strings so they are legible and editable in
 * source — `'#'` (or any non-space, non-dot character) is a lit pixel. Row 0 is
 * the *top* of the sprite, matching how it reads in the file.
 *
 * @param {string[]} rows
 * @returns {{width:number, height:number, bits:Uint8Array}}
 */
export function parseBitmap(rows) {
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error('parseBitmap: expected a non-empty array of strings.');
  }
  const height = rows.length;
  const width = rows[0].length;

  for (let y = 0; y < height; y++) {
    if (rows[y].length !== width) {
      throw new Error(
        `parseBitmap: row ${y} has length ${rows[y].length}, expected ${width}. ` +
          'All rows must be the same width.'
      );
    }
  }

  const bits = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    const row = rows[y];
    for (let x = 0; x < width; x++) {
      const ch = row[x];
      bits[y * width + x] = ch === '.' || ch === ' ' || ch === '_' ? 0 : 1;
    }
  }
  return { width, height, bits };
}

/**
 * Greedy rectangle meshing.
 *
 * Scans in row-major order. For each unclaimed lit pixel it extends as far
 * right as it can, then extends that entire run downward for as long as every
 * pixel in the run is lit and unclaimed. The result is a small set of maximal
 * axis-aligned rectangles covering exactly the lit pixels.
 *
 * This is not an optimal rectangle partition — that problem is far more
 * expensive and the gain over greedy is a couple of percent on sprite-sized
 * inputs. Greedy runs in O(w·h) and gets an 11x8 invader from 34 boxes to 11.
 *
 * @param {Uint8Array} bits
 * @param {number} width
 * @param {number} height
 * @returns {Array<{x:number,y:number,w:number,h:number}>}
 */
export function greedyRects(bits, width, height) {
  const claimed = new Uint8Array(width * height);
  const rects = [];

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (!bits[i] || claimed[i]) continue;

      // Extend right.
      let w = 1;
      while (x + w < width) {
        const j = y * width + x + w;
        if (!bits[j] || claimed[j]) break;
        w++;
      }

      // Extend down, but only while the whole run matches.
      let h = 1;
      outer: while (y + h < height) {
        for (let k = 0; k < w; k++) {
          const j = (y + h) * width + x + k;
          if (!bits[j] || claimed[j]) break outer;
        }
        h++;
      }

      for (let dy = 0; dy < h; dy++) {
        for (let dx = 0; dx < w; dx++) {
          claimed[(y + dy) * width + x + dx] = 1;
        }
      }

      rects.push({ x, y, w, h });
    }
  }

  return rects;
}

/**
 * Build a merged, centred, extruded geometry from a sprite bitmap.
 *
 * `bevel` adds a second, slightly inset and slightly deeper shell. It is not a
 * true bevel — a real one would require per-edge geometry the sprite silhouette
 * does not justify — but it produces the light-catching edge highlight that
 * separates a shape from a flat slab under a hard key light, at the cost of one
 * extra box per rectangle.
 *
 * @param {string[]} rows sprite rows, top-first
 * @param {object} [opts]
 * @param {number} [opts.cell]   world size of one sprite pixel
 * @param {number} [opts.depth]  extrusion along Z
 * @param {number} [opts.bevel]  0 disables the inner shell
 * @param {number} [opts.gap]    shrink each box slightly to leave visible seams
 * @returns {THREE.BufferGeometry} centred on its own bounding box
 */
export function bitmapToGeometry(rows, opts = {}) {
  const { cell = 0.12, depth = 0.34, bevel = 0.16, gap = 0.0, center = true } = opts;

  const { width, height, bits } = parseBitmap(rows);
  const rects = greedyRects(bits, width, height);

  if (rects.length === 0) {
    throw new Error('bitmapToGeometry: bitmap contains no lit pixels.');
  }

  /** @type {THREE.BufferGeometry[]} */
  const parts = [];

  for (const r of rects) {
    const w = r.w * cell - gap;
    const h = r.h * cell - gap;

    // Sprite space is y-down; world space is y-up. Flip here so the sprite
    // reads the same way in the file as it does on screen.
    const cx = (r.x + r.w * 0.5) * cell;
    const cy = -(r.y + r.h * 0.5) * cell;

    const box = new THREE.BoxGeometry(w, h, depth);
    box.translate(cx, cy, 0);
    parts.push(box);

    if (bevel > 0) {
      const inset = cell * bevel;
      const iw = Math.max(w - inset * 2, cell * 0.2);
      const ih = Math.max(h - inset * 2, cell * 0.2);
      const inner = new THREE.BoxGeometry(iw, ih, depth * 1.22);
      inner.translate(cx, cy, 0);
      parts.push(inner);
    }
  }

  const merged = mergeGeometries(parts, false);
  // The source boxes are dead the moment they are merged; not disposing them
  // leaks one VBO per rectangle per species.
  for (const p of parts) p.dispose();

  if (!merged) {
    throw new Error('bitmapToGeometry: mergeGeometries failed (mismatched attributes).');
  }

  merged.computeBoundingBox();
  if (center) {
    const c = new THREE.Vector3();
    merged.boundingBox.getCenter(c);
    merged.translate(-c.x, -c.y, -c.z);
    merged.computeBoundingBox();
  }
  merged.computeBoundingSphere();
  merged.computeVertexNormals();

  // Record the source metrics; renderers use these to size hitboxes and to
  // scale the geometry to a target world width without guessing.
  merged.userData.spriteWidth = width;
  merged.userData.spriteHeight = height;
  merged.userData.rectCount = rects.length;
  merged.userData.worldWidth = width * cell;
  merged.userData.worldHeight = height * cell;

  return merged;
}

/**
 * Return the greedy rectangles of a bitmap in *centred world space*, matching
 * the layout `bitmapToGeometry` produces.
 *
 * The death-shatter effect replays these rectangles as individual debris
 * cubes, so the pieces a destroyed invader breaks into are exactly the pieces
 * it was assembled from. That is why the shatter reads as the object coming
 * apart rather than as a generic particle puff at its location.
 *
 * @returns {Array<{x:number,y:number,w:number,h:number}>} world-space, centred
 */
export function bitmapToWorldRects(rows, opts = {}) {
  const { cell = 0.12, gap = 0 } = opts;
  const { width, height, bits } = parseBitmap(rows);
  const rects = greedyRects(bits, width, height);

  const halfW = width * cell * 0.5;
  const halfH = height * cell * 0.5;

  return rects.map((r) => ({
    x: (r.x + r.w * 0.5) * cell - halfW,
    y: -((r.y + r.h * 0.5) * cell) + halfH,
    w: r.w * cell - gap,
    h: r.h * cell - gap
  }));
}

/* ================================================================== *
 * Geometry transforms
 * ================================================================== */

/**
 * Scale a geometry so its bounding box matches a target width, preserving
 * aspect. Used so that every invader species occupies the same lattice cell
 * regardless of its native sprite width (8, 11 and 12 pixels respectively).
 */
export function fitToWidth(geometry, targetWidth) {
  geometry.computeBoundingBox();
  const box = geometry.boundingBox;
  const current = box.max.x - box.min.x;
  if (current <= 0) return geometry;
  const s = targetWidth / current;
  geometry.scale(s, s, s);
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  geometry.userData.worldWidth = targetWidth;
  geometry.userData.worldHeight = (box.max.y - box.min.y) * s;
  return geometry;
}

/**
 * Displace every vertex along its normal by a noise field.
 *
 * Not used by Space Invaders — its silhouettes must stay crisp — but it is the
 * shared primitive that Asteroids' procedural rock fracturing is built on, and
 * it belongs with the rest of the geometry toolkit rather than in one game.
 *
 * @param {THREE.BufferGeometry} geometry mutated in place
 * @param {import('./SimplexNoise.js').SimplexNoise} noise
 */
export function displaceAlongNormals(geometry, noise, opts = {}) {
  const { amplitude = 0.2, frequency = 1.4, octaves = 3, seedOffset = 0 } = opts;

  const pos = geometry.attributes.position;
  const nrm = geometry.attributes.normal;
  if (!pos || !nrm) {
    throw new Error('displaceAlongNormals: geometry needs position and normal attributes.');
  }

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);

    const d =
      noise.fbm3D(
        x * frequency + seedOffset,
        y * frequency + seedOffset,
        z * frequency + seedOffset,
        octaves
      ) * amplitude;

    pos.setXYZ(i, x + nrm.getX(i) * d, y + nrm.getY(i) * d, z + nrm.getZ(i) * d);
  }

  pos.needsUpdate = true;
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

/**
 * Add a second UV channel that is a straight copy of UV1.
 *
 * `aoMap` samples `uv2` in Three.js. A geometry built by merging boxes has UV1
 * but no UV2, so an AO map silently does nothing until this is called — a
 * genuinely annoying half-hour of debugging if you have not hit it before.
 */
export function ensureUV2(geometry) {
  if (geometry.attributes.uv && !geometry.attributes.uv1) {
    geometry.setAttribute('uv1', geometry.attributes.uv.clone());
  }
  return geometry;
}

/**
 * A flat ring in the XY plane with UVs that run 0..1 radially outward, so a
 * radial gradient texture maps correctly onto it. `RingGeometry`'s built-in UVs
 * are box-projected, which puts the gradient's centre in the corner.
 */
export function makeRadialRingGeometry(innerRadius, outerRadius, segments = 64) {
  const geometry = new THREE.RingGeometry(innerRadius, outerRadius, segments, 1);
  const pos = geometry.attributes.position;
  const uv = geometry.attributes.uv;
  const span = outerRadius - innerRadius || 1;

  for (let i = 0; i < pos.count; i++) {
    const r = Math.hypot(pos.getX(i), pos.getY(i));
    const t = saturate((r - innerRadius) / span);
    // U runs across the ring's thickness, V is unused but kept in range.
    uv.setXY(i, t, 0.5);
  }
  uv.needsUpdate = true;
  return geometry;
}

/**
 * Merge a list of geometries and dispose the sources. Thin wrapper that exists
 * so no call site has to remember the disposal half.
 */
export function mergeAndDispose(geometries, useGroups = false) {
  const merged = mergeGeometries(geometries, useGroups);
  for (const g of geometries) g.dispose();
  if (!merged) throw new Error('mergeAndDispose: merge failed.');
  merged.computeBoundingBox();
  merged.computeBoundingSphere();
  return merged;
}

/**
 * Report the triangle count of a geometry. Used by the debug panel to verify
 * the greedy-meshing win is real rather than assumed.
 */
export function triangleCount(geometry) {
  if (geometry.index) return geometry.index.count / 3;
  return geometry.attributes.position.count / 3;
}

/**
 * Allocate an unindexed ribbon strip for a motion trail: `segments` quads, two
 * vertices per rib, with position and colour marked `DynamicDrawUsage` so the
 * trail renderer can rewrite them every frame without reallocating the buffer.
 *
 * UVs are static and written once: `v` runs 0 at the head to 1 at the tail, so
 * a material can fade along the ribbon without any per-frame UV work.
 */
export function createRibbonGeometry(segments) {
  const ribs = segments + 1;
  const vertexCount = ribs * 2;
  const geometry = new THREE.BufferGeometry();

  const positions = new Float32Array(vertexCount * 3);
  const uvs = new Float32Array(vertexCount * 2);
  const colors = new Float32Array(vertexCount * 3);

  const posAttr = new THREE.BufferAttribute(positions, 3);
  posAttr.setUsage(THREE.DynamicDrawUsage);
  const colAttr = new THREE.BufferAttribute(colors, 3);
  colAttr.setUsage(THREE.DynamicDrawUsage);

  for (let i = 0; i < ribs; i++) {
    const v = i / segments;
    uvs[i * 4 + 0] = 0;
    uvs[i * 4 + 1] = v;
    uvs[i * 4 + 2] = 1;
    uvs[i * 4 + 3] = v;
  }

  geometry.setAttribute('position', posAttr);
  geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geometry.setAttribute('color', colAttr);

  const indices = [];
  for (let i = 0; i < segments; i++) {
    const a = i * 2;
    indices.push(a, a + 1, a + 2, a + 2, a + 1, a + 3);
  }
  geometry.setIndex(indices);

  // The ribbon moves every frame, so a computed bounding sphere would be stale
  // instantly. An explicit oversized sphere keeps it out of the frustum-cull
  // false-negative case where a fast trail vanishes at the screen edge.
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e4);

  return geometry;
}

/**
 * A box whose corners are pushed out onto a rounded profile.
 *
 * Real bevelling of a box needs either a modifier stack or hand-authored
 * geometry. This projects the subdivided box's corner region onto a sphere of
 * radius `radius`, which produces genuine curvature at every edge for the cost
 * of a slightly denser box. The point is specular: a hard 90-degree edge
 * catches a highlight on exactly zero pixels, while a rounded one catches a
 * bright line along its whole length, which is most of what separates "AAA" from
 * "untextured primitive" under a single key light.
 */
export function createRoundedBox(width, height, depth, radius = 0.06, segments = 3) {
  const geometry = new THREE.BoxGeometry(width, height, depth, segments, segments, segments);
  const pos = geometry.attributes.position;

  const hx = width * 0.5;
  const hy = height * 0.5;
  const hz = depth * 0.5;
  const r = Math.min(radius, Math.min(hx, Math.min(hy, hz)) * 0.9);

  const ix = hx - r;
  const iy = hy - r;
  const iz = hz - r;

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);

    // Displacement of this vertex outside the inner box, per axis.
    const dx = Math.max(Math.abs(x) - ix, 0) * Math.sign(x);
    const dy = Math.max(Math.abs(y) - iy, 0) * Math.sign(y);
    const dz = Math.max(Math.abs(z) - iz, 0) * Math.sign(z);

    const len = Math.hypot(dx, dy, dz);
    if (len > 1e-6) {
      const s = r / len;
      pos.setXYZ(
        i,
        Math.sign(x) * ix + dx * s,
        Math.sign(y) * iy + dy * s,
        Math.sign(z) * iz + dz * s
      );
    }
  }

  pos.needsUpdate = true;
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}
