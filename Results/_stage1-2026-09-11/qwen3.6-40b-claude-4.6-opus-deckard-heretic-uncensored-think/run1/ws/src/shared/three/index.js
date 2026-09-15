/**
 * Three.js Shared Module - Re-export of Three.js components for consistent imports
 */
export { 
    Scene, 
    PerspectiveCamera, 
    WebGLRenderer, 
    MeshStandardMaterial, 
    BoxGeometry, 
    CylinderGeometry,
    Vector2,
    Vector3,
    Color
} from 'three';

// Export post-processing effects
export { EffectComposer } from 'three/examples/controls/OrbitControls.js';
export { UnrealBloomPass } from 'three/examples/postprocessing/UnrealBloomPass.js';
