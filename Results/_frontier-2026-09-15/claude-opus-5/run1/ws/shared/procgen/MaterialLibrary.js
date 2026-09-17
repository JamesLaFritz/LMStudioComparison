// Every material in the collection is a MeshStandardMaterial (PBR). These presets keep the
// look consistent: dark diffuse bases with saturated emissive so bloom catches only emitters.
import { MeshStandardMaterial, Color, DoubleSide, FrontSide } from 'three';

/**
 * Neon emitter: dark body, strong saturated emissive. `intensity` ≥ 1.6 crosses the bloom threshold.
 */
export function neonMaterial({
  color = 0x0a0a16,
  emissive = 0x19f0ff,
  intensity = 2,
  roughness = 0.35,
  metalness = 0.1,
  transparent = false,
  opacity = 1,
  side = FrontSide,
  depthWrite = true,
} = {}) {
  return new MeshStandardMaterial({
    color: new Color(color),
    emissive: new Color(emissive),
    emissiveIntensity: intensity,
    roughness,
    metalness,
    transparent,
    opacity,
    side,
    depthWrite,
  });
}

/** Lit hull plating with optional procedural maps. Never blooms. */
export function hullMaterial({
  color = 0x6b7390,
  map = null,
  roughnessMap = null,
  roughness = 0.55,
  metalness = 0.75,
  emissive = 0x000000,
  intensity = 0,
} = {}) {
  return new MeshStandardMaterial({
    color: new Color(color),
    map,
    roughnessMap,
    roughness,
    metalness,
    emissive: new Color(emissive),
    emissiveIntensity: intensity,
  });
}

export function chromeMaterial({ color = 0xcfd6ff, roughness = 0.15, metalness = 1.0 } = {}) {
  return new MeshStandardMaterial({ color: new Color(color), roughness, metalness });
}

/** Translucent energy / glass surfaces (shields, beams, domes). */
export function glassMaterial({
  color = 0x4ad3ff,
  emissive = color,
  intensity = 0.8,
  opacity = 0.35,
  roughness = 0.1,
  metalness = 0.0,
  side = DoubleSide,
} = {}) {
  return new MeshStandardMaterial({
    color: new Color(color),
    emissive: new Color(emissive),
    emissiveIntensity: intensity,
    transparent: true,
    opacity,
    roughness,
    metalness,
    side,
    depthWrite: false,
  });
}

export function matteMaterial({ color = 0x1a1d33, roughness = 0.9, metalness = 0.0 } = {}) {
  return new MeshStandardMaterial({ color: new Color(color), roughness, metalness });
}

/** Emissive grid floor; the same tileable texture drives both albedo and emission. */
export function floorMaterial({
  map = null,
  emissiveMap = map,
  color = 0xffffff,
  emissive = 0x19f0ff,
  intensity = 1.4,
  roughness = 0.6,
  metalness = 0.3,
} = {}) {
  return new MeshStandardMaterial({
    color: new Color(color),
    map,
    emissiveMap,
    emissive: new Color(emissive),
    emissiveIntensity: intensity,
    roughness,
    metalness,
  });
}

/**
 * Make an InstancedMesh's per-instance colour tint the emissive term as well as the diffuse term,
 * so instances can glow in their own colour (particles, damaged bunker cells, tinted stars).
 * Still a MeshStandardMaterial — this only extends the generated shader.
 */
export function enableInstanceEmissiveTint(material) {
  material.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <emissivemap_fragment>',
      [
        '#include <emissivemap_fragment>',
        '#ifdef USE_INSTANCING_COLOR',
        '\ttotalEmissiveRadiance *= vColor;',
        '#endif',
      ].join('\n'),
    );
  };
  material.customProgramCacheKey = () => 'instanceEmissiveTint';
  material.needsUpdate = true;
  return material;
}
