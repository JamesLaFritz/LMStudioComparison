import { Vector3 } from '../utils/math';

/**
 * Trauma-based camera shake system.
 * @param {THREE.Camera} camera - The scene camera.
 * @param {number} intensity - Shake intensity (0–1).
 * @param {number} decay - Decay rate (e.g., 0.5).
 * @param {number} duration - Duration in seconds (e.g., 0.4).
 */
export function shakeCamera(camera, intensity, decay, duration) {
  const originalPosition = new Vector3();
  const shakeVelocity = new Vector3();
  const shakeTimer = { elapsed: 0 };

  // Save original position
  camera.position.clone(originalPosition);

  // Start shake
  const shake = () => {
    if (shakeTimer.elapsed >= duration) return;

    // Apply random offset
    shakeVelocity.x = (Math.random() - 0.5) * intensity;
    shakeVelocity.y = (Math.random() - 0.5) * intensity;
    shakeVelocity.z = (Math.random() - 0.5) * intensity;

    // Update camera position
    camera.position.x = originalPosition.x + shakeVelocity.x;
    camera.position.y = originalPosition.y + shakeVelocity.y;
    camera.position.z = originalPosition.z + shakeVelocity.z;

    // Decay shake
    intensity *= (1 - decay);
    shakeTimer.elapsed += 0.016; // ~60 FPS

    // Continue until duration
    if (shakeTimer.elapsed < duration) {
      requestAnimationFrame(shake);
    }
  };

  shake();
}

// Export for use in VFX manager
export default shakeCamera;