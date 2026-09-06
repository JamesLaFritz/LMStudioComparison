import * as THREE from 'three';
import { RENDER } from '../config.js';
import { PRNG } from '@shared/procgen/PRNG.js';

/**
 * Three parallax layers of stars — 260 + 180 + 90 = **530** point emitters.
 *
 * ### Why this is a density system, not a decoration
 *
 * The reference frames carry on the order of twenty thousand distinct bright
 * features each, one to two orders of magnitude past the mission directive's
 * 500-particle hard cap. That gap cannot be closed with the particle manager
 * and must not be attempted: a build that tries to buy density from particles
 * hits the cap, thrashes the pool, and still looks sparse. Density has to come
 * from geometry that is *not* particles, and this is the largest single
 * contributor — 530 individually-lit elements for three draw calls, before a
 * single spark is spawned.
 *
 * It is also the frame's supply of **isolated small emitters**, which is what
 * the bloom halo profile is measured on. In a quiet moment the stars are
 * essentially the only thing in the frame with a tight bright core and empty
 * space around it, exactly as the reference's quiet plate shows.
 *
 * ### The three-tier emissive split
 *
 * The layers are authored at 2.2 / 1.1 / 0.5. Only the two nearer layers clear
 * the 0.72 bloom threshold; the far layer sits below it and reads as dust
 * rather than as light. That split is what stops 530 emitters becoming a grey
 * wash: a uniform starfield at a single bright value is the classic way a
 * Three.js sky turns into haze under bloom.
 *
 * ### Stratified placement
 *
 * Stars are placed one per grid cell with a random offset inside it, not by
 * uniform sampling. Uniform sampling clumps visibly at these counts and reads
 * as noise rather than as a sky — the eye is extremely good at spotting the
 * clusters and voids that Poisson placement produces.
 */
export class StarField {
  /**
   * @param {object} deps
   * @param {THREE.Scene} deps.scene
   * @param {import('@shared/procgen/MaterialLibrary.js').MaterialLibrary} deps.materials
   * @param {import('@shared/core/Disposer.js').Disposer} deps.disposer
   */
  constructor({ scene, materials, disposer }) {
    this.scene = scene;
    this.materials = materials;
    this.disposer = disposer;
    this.rng = new PRNG('space-invaders-stars');
    this.time = 0;

    /** @type {Array<{mesh:THREE.InstancedMesh, parallax:number, baseX:number}>} */
    this.layers = [];
    /** Total instances across every layer. Asserted by the debug panel. */
    this.count = 0;

    // One shared geometry for all three layers. An icosahedron rather than a
    // sphere: 20 triangles, and at these screen sizes — under three pixels for
    // even the nearest layer — the silhouette difference is unobservable while
    // the vertex saving is a factor of twenty.
    this.geometry = new THREE.IcosahedronGeometry(1, 0);
    this.disposer.track(this.geometry);

    this._matrix = new THREE.Matrix4();
    this._position = new THREE.Vector3();
    this._quaternion = new THREE.Quaternion();
    this._scale = new THREE.Vector3();

    RENDER.STARS.forEach((layer, index) => this._buildLayer(layer, index));
  }

  /**
   * @param {{count:number, scale:number, z:number, intensity:number, parallax:number}} layer
   * @param {number} index
   */
  _buildLayer(layer, index) {
    const material = this.materials.get(`siStar${index}`, () =>
      new THREE.MeshStandardMaterial({
        color: 0x0a1418,
        // Very slightly cool white. Stars are the one place in the frame where
        // near-neutral light is correct — they are the reason `pct_white_240`
        // is non-zero in a quiet frame — but they stay desaturated enough not
        // to register in the lit-pixel hue histogram and skew the band.
        emissive: 0xdaeeff,
        emissiveIntensity: layer.intensity,
        roughness: 0.42,
        metalness: 0,
        // Stars sit beyond the fog's useful range; letting FogExp2 eat them
        // would leave the sky empty at exactly the depths that need it.
        fog: false
      })
    );

    const mesh = new THREE.InstancedMesh(this.geometry, material, layer.count);
    // The field spans far wider than the frustum so parallax never slides an
    // edge into view, which makes frustum culling actively wrong here.
    mesh.frustumCulled = false;
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    mesh.renderOrder = -15;

    // Depth spread within the layer, so a layer is a slab and not a wall.
    const depthSpread = 6;
    const spanX = 150;
    const spanY = 88;
    const cols = Math.ceil(Math.sqrt(layer.count));

    let placed = 0;
    for (let gy = 0; gy < cols && placed < layer.count; gy++) {
      for (let gx = 0; gx < cols && placed < layer.count; gx++) {
        const x = ((gx + this.rng.next()) / cols - 0.5) * spanX;
        const y = ((gy + this.rng.next()) / cols - 0.5) * spanY;
        const z = layer.z - this.rng.next() * depthSpread;

        // Size varies by +/-40% within a layer. A field of identical dots
        // reads as a texture; a field with a size distribution reads as depth.
        const s = layer.scale * this.rng.range(0.6, 1.4);

        this._position.set(x, y, z);
        this._scale.set(s, s, s);
        this._matrix.compose(this._position, this._quaternion, this._scale);
        mesh.setMatrixAt(placed, this._matrix);
        placed++;
      }
    }

    mesh.instanceMatrix.needsUpdate = true;
    mesh.count = placed;
    this.count += placed;

    this.scene.add(mesh);
    this.layers.push({ mesh, parallax: layer.parallax, baseX: 0, baseY: 0 });

    this.disposer.trackFn(() => {
      this.scene.remove(mesh);
      // InstancedMesh.dispose() dispatches the event WebGLObjects listens for
      // to free instanceMatrix and instanceColor. Nulling the typed arrays
      // instead would drop the JS side and orphan the GPU buffers.
      mesh.dispose();
    });
  }

  /**
   * Slide the layers against each other.
   *
   * Called with the camera's own parallax offset, so the near layer moves
   * about five times as far as the far one. This is the entire depth cue the
   * backdrop has, and it costs three position writes per frame rather than
   * rebuilding any instance matrices.
   *
   * @param {number} x camera parallax in world units
   * @param {number} dt seconds, unscaled
   */
  update(dt, x = 0) {
    this.time += dt;
    for (const layer of this.layers) {
      // The multiplier is negative because the field must move *against* the
      // camera to read as distance.
      layer.mesh.position.x = -x * layer.parallax * 8;
      // A drift so slow it is below the threshold of noticed motion, present
      // only so a paused frame and a live frame are not identical.
      layer.mesh.position.y = Math.sin(this.time * 0.017 + layer.parallax * 9) * 0.35;
    }
  }
}
