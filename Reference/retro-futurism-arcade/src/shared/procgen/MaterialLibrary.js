import * as THREE from 'three';
import { disposeMaterial } from '../core/Disposer.js';

/**
 * Cached `MeshStandardMaterial` factory and shader-extension toolkit.
 *
 * Two hard rules from the project directive are enforced here:
 *
 *  1. **Every material is a `MeshStandardMaterial`.** Nothing in this arcade
 *     uses `ShaderMaterial`, `MeshBasicMaterial` or `MeshPhongMaterial`. When a
 *     custom effect is needed it is injected into the standard shader with
 *     `onBeforeCompile`, so the surface keeps full PBR lighting, correct
 *     tone-mapping and correct colour management. A neon bolt in this game is
 *     genuinely lit by the scene; it is not a flat unlit quad pretending.
 *
 *  2. **Unique material count is capped.** Every distinct material is a
 *     distinct shader program and a distinct draw call batch. The library keys
 *     materials by name so that a hundred meshes asking for `'hull'` get one
 *     material, and the debug panel can assert the total.
 *
 * ### On `customProgramCacheKey`
 *
 * Any material that receives an `onBeforeCompile` patch **must** also define
 * `customProgramCacheKey`. Three.js caches compiled programs by a key derived
 * from the material's public parameters, which knows nothing about injected
 * source. Two materials patched differently would otherwise collide on one
 * cached program and silently render with the wrong shader — and shader
 * recompilation churn mid-game causes multi-frame hitches.
 */

/* ================================================================== *
 * Shader extension helpers
 * ================================================================== */

/**
 * Per-instance tint for an `InstancedMesh`, driven by a custom
 * `instanceTint` attribute.
 *
 * Three's built-in `instanceColor` multiplies only the diffuse term, so it
 * cannot tint an emitter. This injection multiplies both diffuse *and*
 * `totalEmissiveRadiance`, which is what lets one 500-instance particle mesh
 * render orange sparks, cyan plasma and white-hot debris in a single draw call
 * with every one of them blooming in its own colour.
 *
 * Declaring our own attribute and varying rather than relying on `USE_COLOR`
 * also removes any dependence on Three's internal define names.
 *
 * @param {THREE.MeshStandardMaterial} material mutated in place
 * @param {string} cacheKey unique key for this patch variant
 */
export function applyInstanceTint(material, cacheKey = 'instance-tint') {
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
         attribute vec3 instanceTint;
         varying vec3 vInstanceTint;`
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
         vInstanceTint = instanceTint;`
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
         varying vec3 vInstanceTint;`
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
         totalEmissiveRadiance *= vInstanceTint;
         diffuseColor.rgb *= vInstanceTint;`
      );
  };
  material.customProgramCacheKey = () => cacheKey;
  return material;
}

/**
 * Per-instance emissive *intensity* on top of the tint, driven by an
 * `instanceEnergy` float attribute.
 *
 * Particles fade by dimming their emission rather than by going transparent.
 * Alpha fading requires sorted transparent draws and fights the depth buffer;
 * dimming an emitter to black under a bloom threshold is both cheaper and a
 * better visual match for something burning out.
 */
export function applyInstanceTintAndEnergy(material, cacheKey = 'instance-tint-energy') {
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
         attribute vec3 instanceTint;
         attribute float instanceEnergy;
         varying vec3 vInstanceTint;
         varying float vInstanceEnergy;`
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
         vInstanceTint = instanceTint;
         vInstanceEnergy = instanceEnergy;`
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
         varying vec3 vInstanceTint;
         varying float vInstanceEnergy;`
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
         totalEmissiveRadiance *= vInstanceTint * vInstanceEnergy;
         diffuseColor.rgb *= vInstanceTint;`
      );
  };
  material.customProgramCacheKey = () => cacheKey;
  return material;
}

/**
 * The neon projectile shader.
 *
 * Adds two terms to a standard material's emission:
 *
 *  - **Fresnel rim.** `pow(1 - |dot(N, V)|, k)` peaks at grazing angles, so the
 *    silhouette of the bolt glows hotter than its face. This is what reads as
 *    "energy contained in a shell" rather than "a glowing stick".
 *  - **Travelling core pulse.** A band scrolling along the bolt's local Y,
 *    built from `fract` so it wraps seamlessly, giving the projectile a sense
 *    of direction and velocity even in a still frame.
 *
 * Returns a handle exposing the live `uTime` uniform so the render layer can
 * drive it without reaching into shader internals.
 *
 * @returns {{material:THREE.MeshStandardMaterial, setTime:(t:number)=>void,
 *            setCore:(v:number)=>void}}
 */
export function applyNeonBolt(material, opts = {}) {
  const {
    cacheKey = 'neon-bolt',
    rimPower = 2.2,
    rimGain = 1.8,
    baseGain = 0.6,
    coreGain = 2.4,
    scrollSpeed = 2.4,
    bandCount = 3.0,
    bandWidth = 0.42
  } = opts;

  const uniforms = {
    uTime: { value: 0 },
    uCore: { value: coreGain }
  };

  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uniforms.uTime;
    shader.uniforms.uCore = uniforms.uCore;

    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
         varying vec3 vBoltNormal;
         varying vec3 vBoltViewDir;
         varying vec2 vBoltUv;`
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
         vBoltUv = uv;
         vec4 boltViewPos = modelViewMatrix * vec4(transformed, 1.0);
         vBoltViewDir = normalize(-boltViewPos.xyz);
         vBoltNormal = normalize(normalMatrix * objectNormal);`
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
         uniform float uTime;
         uniform float uCore;
         varying vec3 vBoltNormal;
         varying vec3 vBoltViewDir;
         varying vec2 vBoltUv;`
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
         float boltFresnel = pow(1.0 - abs(dot(normalize(vBoltNormal), normalize(vBoltViewDir))), ${rimPower.toFixed(
           2
         )});
         totalEmissiveRadiance *= ${baseGain.toFixed(2)} + ${rimGain.toFixed(2)} * boltFresnel;
         float boltBand = fract(vBoltUv.y * ${bandCount.toFixed(1)} - uTime * ${scrollSpeed.toFixed(
           2
         )});
         float boltPulse = smoothstep(${bandWidth.toFixed(2)}, 0.0, abs(boltBand - 0.5));
         totalEmissiveRadiance += uCore * boltPulse * diffuseColor.rgb;`
      );
  };

  material.customProgramCacheKey = () => cacheKey;

  return {
    material,
    setTime: (t) => {
      uniforms.uTime.value = t;
    },
    setCore: (v) => {
      uniforms.uCore.value = v;
    }
  };
}

/**
 * A thin, bright Fresnel rim traced around a lit hull's silhouette.
 *
 * This is the material change that makes a *dark* object read against a *dark*
 * background, and it is the reason the invader formation can be pulled out of
 * the bloom buffer without dissolving into the fog. At magnification every
 * enemy hull in the visual reference shows the same three things: a saturated
 * mid-dark albedo with real faceted PBR shading, a 1-2 px near-white line
 * tracing the whole outline, and one small hot accent that does glow. The
 * outline is this function; the hot accent is a separate emitter.
 *
 * ### Why Fresnel and not a scaled back-face shell
 *
 * The target width is 0.10-0.20% of frame height — one to two pixels at 1080p,
 * which at this project's camera is 0.02-0.04 world units. A shell that thin
 * cannot hold a steady width: it is a fixed world-space offset, so it thickens
 * as an object nears the camera and disappears as it recedes, and on an
 * `InstancedMesh` it costs a second full draw of every instance. A Fresnel
 * term is view-relative by construction, so the line stays the same apparent
 * width everywhere in the frame, and it is free — one dot product in a shader
 * that was already computing the normal.
 *
 * ### Why the geometry has to be rounded for this to work
 *
 * `pow(1 - |N.V|, k)` only produces a *narrow* band where the surface normal
 * sweeps quickly through the grazing angle, which happens at a rounded edge
 * and nowhere else. On a hard 90-degree box edge the two adjacent faces are
 * flat, so the term is broad and dim across the front face and then jumps: a
 * wash, not a line. Pair this with `bitmapToGeometry({ rounded: ... })`.
 *
 * ### The intensity contract
 *
 * `emissiveIntensity` on the material is the *body* value. `rimIntensity` is
 * what the silhouette reaches. The patch multiplies rather than adds, so both
 * ends stay on the material's authored emissive hue:
 *
 *     totalEmissiveRadiance *= 1 + (rimIntensity / bodyIntensity - 1) * rim
 *
 * That means `material.emissiveIntensity` must be non-zero and must be the
 * body value at the time this is called. The ratio is baked into the shader
 * source as a constant, so changing `emissiveIntensity` afterwards moves both
 * the body and the rim together, which is the behaviour the emissive-scale
 * accessibility path wants.
 *
 * @param {THREE.MeshStandardMaterial} material mutated in place
 * @param {object} [opts]
 * @param {number} [opts.rimIntensity] emissive intensity at the silhouette
 * @param {number} [opts.power]        Fresnel exponent; higher is a thinner line
 * @param {number} [opts.bias]         floor subtracted before the ramp, kills
 *                                     the broad dim wash across flat faces
 * @param {string} [opts.cacheKey]     unique per patch variant — mandatory
 */
export function applyFresnelRim(material, opts = {}) {
  const {
    rimIntensity = 1.05,
    power = 3.4,
    bias = 0.28,
    cacheKey = 'fresnel-rim'
  } = opts;

  const body = material.emissiveIntensity || 1;
  // How much brighter the silhouette is than the body, as a multiplier.
  const gain = Math.max(0, rimIntensity / body - 1);
  const invBias = 1 / Math.max(1e-3, 1 - bias);

  material.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <emissivemap_fragment>',
      `#include <emissivemap_fragment>
       {
         // normal and vViewPosition are both already in scope here:
         // <normal_fragment_begin> runs three chunks earlier, and
         // vViewPosition is declared unconditionally by meshphysical_frag.
         float rimFacing = abs(dot(normalize(normal), normalize(vViewPosition)));
         float rimRaw = clamp((1.0 - rimFacing - ${bias.toFixed(3)}) * ${invBias.toFixed(
           4
         )}, 0.0, 1.0);
         float rimTerm = pow(rimRaw, ${power.toFixed(2)});
         totalEmissiveRadiance *= 1.0 + ${gain.toFixed(4)} * rimTerm;
       }`
    );
  };
  material.customProgramCacheKey = () => cacheKey;
  return material;
}

/**
 * Vertex-colour driven emission, for ribbon trails.
 *
 * Trails taper in brightness along their length. `vertexColors = true` is a
 * first-class Three feature so `vColor` is guaranteed present here — unlike the
 * instanced case above, no custom attribute is needed.
 */
export function applyVertexColorEmissive(material, cacheKey = 'vcol-emissive') {
  material.vertexColors = true;
  material.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <emissivemap_fragment>',
      `#include <emissivemap_fragment>
       totalEmissiveRadiance *= vColor;`
    );
  };
  material.customProgramCacheKey = () => cacheKey;
  return material;
}

/**
 * Emissive scanline sweep for the arena floor.
 *
 * A soft band travels along world Y, briefly lifting the grid's emission as it
 * passes. Driven from world position rather than UV so the sweep stays
 * continuous across the floor and both walls, which are separate meshes.
 */
export function applyScanSweep(material, opts = {}) {
  const { cacheKey = 'scan-sweep', width = 2.4, gain = 1.6, axisScale = 0.06 } = opts;

  const uniforms = {
    uSweepY: { value: 0 },
    uSweepGain: { value: gain },
    uPulse: { value: 0 }
  };

  material.onBeforeCompile = (shader) => {
    shader.uniforms.uSweepY = uniforms.uSweepY;
    shader.uniforms.uSweepGain = uniforms.uSweepGain;
    shader.uniforms.uPulse = uniforms.uPulse;

    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
         varying vec3 vSweepWorld;`
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
         vSweepWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;`
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
         uniform float uSweepY;
         uniform float uSweepGain;
         uniform float uPulse;
         varying vec3 vSweepWorld;`
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
         float sweepDist = abs(vSweepWorld.y - uSweepY) + abs(vSweepWorld.z) * ${axisScale.toFixed(
           3
         )};
         float sweepBand = smoothstep(${width.toFixed(2)}, 0.0, sweepDist);
         totalEmissiveRadiance *= 1.0 + uSweepGain * sweepBand + uPulse;`
      );
  };

  material.customProgramCacheKey = () => cacheKey;

  return {
    material,
    setSweep: (y) => {
      uniforms.uSweepY.value = y;
    },
    setPulse: (v) => {
      uniforms.uPulse.value = v;
    }
  };
}

/* ================================================================== *
 * The library
 * ================================================================== */

/**
 * Named, cached material store with a single disposal path.
 *
 * Materials are *never* created inline at a call site. Everything goes through
 * `get(name, factory)`, so the total count is knowable, the debug panel can
 * report it, and teardown is one call.
 */
export class MaterialLibrary {
  /** @param {import('../core/Disposer.js').Disposer} [disposer] */
  constructor(disposer = null) {
    /** @type {Map<string, THREE.MeshStandardMaterial>} */
    this.materials = new Map();
    this.disposer = disposer;
    this.disposed = false;
  }

  /**
   * Fetch a material by name, creating it on first request.
   * @param {string} name
   * @param {() => THREE.MeshStandardMaterial} factory
   */
  get(name, factory) {
    let mat = this.materials.get(name);
    if (mat) return mat;
    if (this.disposed) {
      throw new Error(`MaterialLibrary: requested "${name}" after disposal.`);
    }
    mat = factory();
    mat.name = name;
    this.materials.set(name, mat);
    return mat;
  }

  /**
   * Create and register a standard material from a plain parameter object.
   * Applies project-wide defaults: no transparency unless asked for (sorted
   * transparent geometry is the most common source of Z-fighting artefacts in
   * a bloom-heavy scene), and shadow casting left to the mesh.
   */
  standard(name, params = {}) {
    return this.get(name, () => new THREE.MeshStandardMaterial(params));
  }

  /** Register a material that was built elsewhere (e.g. after a shader patch). */
  register(name, material) {
    if (this.materials.has(name)) {
      throw new Error(`MaterialLibrary: "${name}" is already registered.`);
    }
    material.name = name;
    this.materials.set(name, material);
    return material;
  }

  /** True if a material with this name exists. */
  has(name) {
    return this.materials.has(name);
  }

  /** Number of unique materials, surfaced in the debug panel. */
  get size() {
    return this.materials.size;
  }

  /** All material names, for diagnostics. */
  names() {
    return [...this.materials.keys()];
  }

  /**
   * Scale every registered material's emissive intensity by a common factor.
   *
   * Used by the reduced-motion and colour-blind paths, and by the quality
   * governor at the lowest tier, where bloom resolution has dropped far enough
   * that the original emissive values over-bloom into a white smear. The
   * baseline is captured on first call so repeated adjustments compose from the
   * authored value rather than compounding.
   */
  setEmissiveScale(scale) {
    for (const mat of this.materials.values()) {
      if (mat.emissiveIntensity === undefined) continue;
      if (mat.userData.baseEmissiveIntensity === undefined) {
        mat.userData.baseEmissiveIntensity = mat.emissiveIntensity;
      }
      mat.emissiveIntensity = mat.userData.baseEmissiveIntensity * scale;
    }
  }

  /**
   * Enable or disable dithering across the library.
   *
   * The arena is built from very smooth, very dark gradients, which is exactly
   * the case where 8-bit output banding is visible. Dithering costs a few
   * instructions and removes it; it is the first thing switched off at the
   * lowest quality tier because banding is preferable to a dropped frame.
   */
  setDithering(enabled) {
    for (const mat of this.materials.values()) {
      if (mat.dithering === enabled) continue;
      mat.dithering = enabled;
      mat.needsUpdate = true;
    }
  }

  /** Dispose every material and every texture they reference. */
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    for (const mat of this.materials.values()) {
      disposeMaterial(mat);
    }
    this.materials.clear();
  }
}
