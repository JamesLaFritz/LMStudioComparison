import * as THREE from 'three';

/**
 * The resource ledger.
 *
 * Three.js does not garbage-collect GPU resources. Dropping the last JavaScript
 * reference to a `BufferGeometry` frees the JS wrapper and leaks the VBO. The
 * only way to reclaim it is an explicit `.dispose()`, and the only way to
 * reliably issue those calls across a codebase this size is to record every
 * allocation at the moment it happens.
 *
 * Usage is deliberately blunt: anything you create, you `track()`. Teardown
 * then runs in exact reverse order of creation, which matters because a
 * material must outlive nothing but is safest disposed after the meshes that
 * referenced it.
 */
export class Disposer {
  constructor(label = 'disposer') {
    this.label = label;
    /** @type {Array<{kind:string, value:*}>} */
    this.entries = [];
    this.disposed = false;
  }

  /**
   * Track any resource exposing `.dispose()`, or an Object3D subtree, or a
   * plain teardown function.
   * @template T
   * @param {T} resource
   * @returns {T} the same resource, so calls can wrap allocations inline
   */
  track(resource) {
    if (resource === null || resource === undefined) return resource;
    if (this.disposed) {
      console.warn(`${this.label}: tracking after disposal — resource will leak.`);
      return resource;
    }

    if (typeof resource === 'function') {
      this.entries.push({ kind: 'fn', value: resource });
    } else if (resource.isObject3D) {
      this.entries.push({ kind: 'object3d', value: resource });
    } else if (typeof resource.dispose === 'function') {
      this.entries.push({ kind: 'disposable', value: resource });
    } else {
      console.warn(`${this.label}: cannot track resource without dispose():`, resource);
    }
    return resource;
  }

  /** Track many resources at once. */
  trackAll(list) {
    for (const item of list) this.track(item);
    return list;
  }

  /**
   * Register a raw teardown callback — DOM listener removal, `clearTimeout`,
   * audio node disconnection and so on.
   * @param {() => void} fn
   */
  trackFn(fn) {
    return this.track(fn);
  }

  /**
   * Add a DOM event listener that is automatically removed on disposal. This
   * pattern removes an entire category of leak: a `resize` handler holding a
   * closure over a disposed scene.
   */
  addEventListener(target, type, handler, options) {
    target.addEventListener(type, handler, options);
    this.trackFn(() => target.removeEventListener(type, handler, options));
    return handler;
  }

  /** Run every teardown in reverse creation order and empty the ledger. */
  disposeAll() {
    if (this.disposed) return;
    this.disposed = true;

    for (let i = this.entries.length - 1; i >= 0; i--) {
      const { kind, value } = this.entries[i];
      try {
        if (kind === 'fn') {
          value();
        } else if (kind === 'object3d') {
          disposeObject3D(value);
        } else {
          value.dispose();
        }
      } catch (err) {
        console.error(`${this.label}: disposal of a ${kind} threw:`, err);
      }
    }
    this.entries.length = 0;
  }

  /** How many resources are currently tracked. Surfaced in the debug panel. */
  get size() {
    return this.entries.length;
  }
}

/**
 * Recursively dispose an Object3D subtree: geometry, materials, and every
 * texture-bearing material slot.
 *
 * Materials are collected into a Set first because the whole point of
 * `MaterialLibrary` is that many meshes share one material — disposing it once
 * per mesh would emit a stream of warnings and, worse, disposing it at all is
 * wrong if the library still owns it. Callers that share materials should keep
 * them out of the mesh-level ledger and dispose the library separately; this
 * function is for subtrees that exclusively own their materials.
 */
export function disposeObject3D(root, { disposeMaterials = true } = {}) {
  if (!root) return;

  /** @type {Set<THREE.Material>} */
  const materials = new Set();

  root.traverse((node) => {
    if (node.geometry) {
      node.geometry.dispose();
    }
    if (node.material) {
      if (Array.isArray(node.material)) {
        for (const m of node.material) materials.add(m);
      } else {
        materials.add(node.material);
      }
    }
    // Instanced attributes are separate GPU buffers with their own lifetime.
    // Nulling the CPU-side arrays frees nothing on the GPU and leaves the buffers
    // orphaned; `dispose()` is what actually releases them.
    if (node.isInstancedMesh) {
      node.dispose();
    }
  });

  if (disposeMaterials) {
    for (const material of materials) disposeMaterial(material);
  }

  if (root.parent) root.parent.remove(root);
}

/** Texture-bearing slots on the standard material set. */
const TEXTURE_SLOTS = [
  'map',
  'alphaMap',
  'aoMap',
  'bumpMap',
  'displacementMap',
  'emissiveMap',
  'envMap',
  'lightMap',
  'metalnessMap',
  'normalMap',
  'roughnessMap',
  'clearcoatMap',
  'clearcoatNormalMap',
  'clearcoatRoughnessMap',
  'iridescenceMap',
  'sheenColorMap',
  'sheenRoughnessMap',
  'specularMap',
  'specularColorMap',
  'specularIntensityMap',
  'transmissionMap',
  'thicknessMap',
  'gradientMap',
  'matcap'
];

/** Dispose a material and every texture it references. */
export function disposeMaterial(material) {
  if (!material) return;
  for (const slot of TEXTURE_SLOTS) {
    const tex = material[slot];
    if (tex && tex.isTexture) tex.dispose();
  }
  material.dispose();
}

/**
 * Snapshot of renderer-held GPU resources. The hub compares this before and
 * after a game mount; any drift is a leak and is reported rather than ignored.
 */
export function memorySnapshot(renderer) {
  return {
    geometries: renderer.info.memory.geometries,
    textures: renderer.info.memory.textures,
    programs: renderer.info.programs ? renderer.info.programs.length : 0
  };
}

/**
 * Compare two snapshots.
 * @returns {{clean:boolean, geometries:number, textures:number, programs:number}}
 */
export function memoryDelta(before, after) {
  const geometries = after.geometries - before.geometries;
  const textures = after.textures - before.textures;
  const programs = after.programs - before.programs;
  return {
    clean: geometries <= 0 && textures <= 0,
    geometries,
    textures,
    programs
  };
}
