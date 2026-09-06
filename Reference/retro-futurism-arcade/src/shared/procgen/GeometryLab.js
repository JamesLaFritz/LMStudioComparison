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
 * `rounded` replaces the flat boxes with corner-rounded ones and switches the
 * inner bevel shell off, because the two are alternative answers to the same
 * problem and stacking them wastes triangles. Rounding is what a Fresnel rim
 * needs: `pow(1 - |N.V|, k)` only resolves into a *thin line* where the normal
 * sweeps quickly through the grazing angle, which happens on a rounded edge
 * and nowhere else. On a hard 90-degree edge the term is a broad dim wash
 * across the whole front face instead. It also grooves the seams between
 * adjacent greedy rectangles, which reads as voxel construction rather than as
 * one flat slab — the reference's material language exactly.
 *
 * @param {string[]} rows sprite rows, top-first
 * @param {object} [opts]
 * @param {number} [opts.cell]     world size of one sprite pixel
 * @param {number} [opts.depth]    extrusion along Z
 * @param {number} [opts.bevel]    0 disables the inner shell; ignored when rounded
 * @param {number} [opts.gap]      shrink each box slightly to leave visible seams
 * @param {number} [opts.rounded]  corner radius as a fraction of `cell`; 0 = off
 * @param {number} [opts.roundSegments] subdivisions per box axis when rounded
 * @returns {THREE.BufferGeometry} centred on its own bounding box
 */
export function bitmapToGeometry(rows, opts = {}) {
  const {
    cell = 0.12,
    depth = 0.34,
    bevel = 0.16,
    gap = 0.0,
    center = true,
    rounded = 0,
    roundSegments = 2
  } = opts;

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

    if (rounded > 0) {
      // Rounded boxes already carry their own light-catching edge, so the
      // inner bevel shell is redundant and is skipped: at 55 instances the
      // second shell is the difference between a 29k-triangle formation and a
      // 58k one for no visible gain.
      const box = createRoundedBox(w, h, depth, cell * rounded, roundSegments);
      box.translate(cx, cy, 0);
      parts.push(box);
      continue;
    }

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
 * Build the **silhouette outline** of a sprite bitmap as real geometry: a thin
 * emissive picture-frame tracing every boundary between a lit cell and an
 * unlit one, interior holes included.
 *
 * ### Why this is geometry and not a shader term
 *
 * The visual reference's single most characteristic material feature is a
 * 1-2 px near-white line around every hull, and it is what lets a *dark* ship
 * read against a *dark* ground without the hull itself having to emit. The
 * two obvious implementations both fail on an extruded sprite:
 *
 *  - **A Fresnel term** resolves into a thin line only where the surface normal
 *    sweeps quickly through the grazing angle. An extruded bitmap is flat
 *    faces meeting at hard edges, so the term is a broad dim wash across the
 *    front face and then a hard jump at the rim - a gradient, not a line.
 *    Fresnel is still right for curved hulls; see `applyFresnelRim`.
 *  - **A scaled back-face shell** is a fixed *world-space* offset, so its
 *    apparent width changes with distance, and on an `InstancedMesh` it costs
 *    a second full draw of every instance.
 *
 * A strip of geometry at the exact silhouette gives an exactly specified world
 * width - 0.02-0.04 units here, which is 0.10-0.20% of frame height at this
 * project's camera, which is the 1-2 px the reference measures - and it rides
 * in the same draw call as the hull as a second geometry group.
 *
 * ### Runs, not cells
 *
 * Boundaries are emitted as **maximal runs**, not per-cell segments: an
 * eleven-cell-wide flat top is one strip, not eleven. On the crab that is the
 * difference between roughly 70 boxes and roughly 20, and at 22 instances the
 * saving is thousands of triangles for a pixel-identical result.
 *
 * Horizontal runs are extended by half a thickness at each end so that corners
 * close cleanly against the vertical strips rather than leaving a notch.
 *
 * Coordinates match `bitmapToGeometry` exactly - same cell size, same y-flip,
 * same origin - so the two can be merged and centred as one object. Both must
 * be built with `center: false` and centred together with `centerTogether`,
 * because the outline's bounding box is a half-thickness larger than the
 * hull's and centring them independently would misalign them by exactly the
 * width of the feature being drawn.
 *
 * @param {string[]} rows sprite rows, top-first
 * @param {object} [opts]
 * @param {number} [opts.cell]      world size of one sprite pixel
 * @param {number} [opts.depth]     extrusion along Z
 * @param {number} [opts.thickness] world width of the line
 * @param {boolean} [opts.center]   centre on the outline's own bounding box
 * @returns {THREE.BufferGeometry}
 */
export function bitmapOutlineGeometry(rows, opts = {}) {
  const { cell = 0.12, depth = 0.36, thickness = 0.03, center = false } = opts;

  const { width, height, bits } = parseBitmap(rows);
  const at = (x, y) => (x < 0 || y < 0 || x >= width || y >= height ? 0 : bits[y * width + x]);

  const half = thickness * 0.5;
  /** @type {THREE.BufferGeometry[]} */
  const parts = [];

  const addStrip = (cx, cy, w, h) => {
    const box = new THREE.BoxGeometry(w, h, depth);
    box.translate(cx, cy, 0);
    parts.push(box);
  };

  // --- Horizontal boundaries: top edges, then bottom edges -----------------
  // `dy` is the neighbour tested; -1 finds top edges, +1 finds bottom edges.
  for (const dy of [-1, 1]) {
    for (let y = 0; y < height; y++) {
      // World Y of this boundary. Sprite space is y-down and world is y-up, so
      // cell (x, y) spans world Y from -(y+1)*cell up to -y*cell.
      const edgeY = dy === -1 ? -y * cell : -(y + 1) * cell;
      let runStart = -1;
      for (let x = 0; x <= width; x++) {
        const isEdge = x < width && at(x, y) === 1 && at(x, y + dy) === 0;
        if (isEdge && runStart < 0) {
          runStart = x;
        } else if (!isEdge && runStart >= 0) {
          const x0 = runStart * cell - half;
          const x1 = x * cell + half;
          addStrip((x0 + x1) * 0.5, edgeY, x1 - x0, thickness);
          runStart = -1;
        }
      }
    }
  }

  // --- Vertical boundaries: left edges, then right edges -------------------
  for (const dx of [-1, 1]) {
    for (let x = 0; x < width; x++) {
      const edgeX = dx === -1 ? x * cell : (x + 1) * cell;
      let runStart = -1;
      for (let y = 0; y <= height; y++) {
        const isEdge = y < height && at(x, y) === 1 && at(x + dx, y) === 0;
        if (isEdge && runStart < 0) {
          runStart = y;
        } else if (!isEdge && runStart >= 0) {
          // Vertical runs are deliberately *not* extended: the horizontal
          // strips already overhang by half a thickness, and extending both
          // would double the material at every corner and read as a blob.
          const y0 = -y * cell;
          const y1 = -runStart * cell;
          addStrip(edgeX, (y0 + y1) * 0.5, thickness, y1 - y0);
          runStart = -1;
        }
      }
    }
  }

  if (parts.length === 0) {
    throw new Error('bitmapOutlineGeometry: bitmap has no boundary (empty or fully lit).');
  }

  const merged = mergeGeometries(parts, false);
  for (const p of parts) p.dispose();
  if (!merged) {
    throw new Error('bitmapOutlineGeometry: mergeGeometries failed.');
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

  merged.userData.stripCount = parts.length;
  merged.userData.spriteWidth = width;
  merged.userData.spriteHeight = height;

  return merged;
}

/**
 * Centre a group of geometries about their *common* bounding box.
 *
 * Centring a hull and its outline independently misaligns them by half the
 * outline's thickness, which is the entire width of the feature. Returns the
 * offset that was applied so a caller can place related objects (an eye dot, a
 * muzzle point) in the same frame.
 *
 * @param {THREE.BufferGeometry[]} geometries mutated in place
 * @returns {THREE.Vector3}
 */
export function centerTogether(geometries) {
  const offset = new THREE.Vector3();
  if (!geometries.length) return offset;

  const box = new THREE.Box3();
  for (const g of geometries) {
    g.computeBoundingBox();
    box.union(g.boundingBox);
  }
  box.getCenter(offset);

  for (const g of geometries) {
    g.translate(-offset.x, -offset.y, -offset.z);
    g.computeBoundingBox();
    g.computeBoundingSphere();
  }
  return offset;
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
