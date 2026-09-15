import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { createBloomPass } from './bloom.js';

/**
 * Creates a fully configured EffectComposer with the standard post-processing stack.
 * 
 * @param {THREE.Scene} scene - The Three.js scene to render
 * @param {THREE.Camera} camera - The camera for rendering
 * @param {THREE.WebGLRenderer} renderer - The WebGL renderer instance
 * @param {Object} bloomConfig - Optional bloom configuration overrides
 * @returns {EffectComposer} Configured composer ready for use
 */
export function createComposer(scene, camera, renderer, bloomConfig = {}) {
  // Create the composer with the renderer's pixel ratio
  const composer = new EffectComposer(renderer);
  
  // Add the base render pass - renders the scene to a framebuffer
  const renderPass = new RenderPass(scene, camera);
  composer.addPass(renderPass);
  
  // Add bloom pass with tuned parameters for neon glow
  const bloomPass = createBloomPass(bloomConfig);
  composer.addPass(bloomPass);
  
  return composer;
}

/**
 * Creates a minimal composer without post-processing (for debugging or fallback).
 * 
 * @param {THREE.Scene} scene - The Three.js scene to render
 * @param {THREE.Camera} camera - The camera for rendering
 * @param {THREE.WebGLRenderer} renderer - The WebGL renderer instance
 * @returns {EffectComposer} Composer with only RenderPass
 */
export function createMinimalComposer(scene, camera, renderer) {
  const composer = new EffectComposer(renderer);
  const renderPass = new RenderPass(scene, camera);
  composer.addPass(renderPass);
  return composer;
}

/**
 * Updates the composer's render target size to match window changes.
 * Should be called on window resize events.
 * 
 * @param {EffectComposer} composer - The composer instance to update
 * @param {number} width - New width in pixels
 * @param {number} height - New height in pixels
 */
export function updateComposerSize(composer, width, height) {
  if (!composer) return;
  
  const pixelRatio = renderer ? renderer.getPixelRatio() : Math.min(window.devicePixelRatio, 2);
  composer.setSize(width * pixelRatio, height * pixelRatio);
}

/**
 * Disposes of all post-processing resources to prevent memory leaks.
 * 
 * @param {EffectComposer} composer - The composer instance to dispose
 */
export function disposeComposer(composer) {
  if (!composer) return;
  
  // Dispose each pass's render target
  for (let i = 0; i < composer.passes.length; i++) {
    const pass = composer.passes[i];
    
    if (pass.renderToScreen !== undefined && pass.renderTarget) {
      pass.renderTarget.dispose();
      pass.renderTarget = null;
    }
    
    // Some passes have their own materials to dispose
    if (pass.materials) {
      for (const material of pass.materials) {
        if (material && typeof material.dispose === 'function') {
          material.dispose();
        }
      }
    }
  }
  
  composer.passes = [];
}
