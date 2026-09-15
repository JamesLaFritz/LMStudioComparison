import { Vector3 } from '../utils/math.js';
import { createTextGeometry } from '../assets/geometry.js';
import { MeshStandardMaterial } from 'three';

/**
 * Creates and manages floating 3D/HTML score text.
 *
 * @param {string} text - The score text to display.
 * @param {Vector3} position - Initial 3D position.
 * @param {number} duration - How long to float (seconds).
 * @returns {Object} - Object with dispose() method.
 */
export function spawnScoreText(text, position, duration = 2.0) {
  const scene = window.gameScene;
  const camera = window.gameCamera;
  const htmlContainer = document.getElementById('score-overlay');

  // Create 3D text
  const textGeometry = createTextGeometry(text, 0.05);
  const material = new MeshStandardMaterial({
    color: 0xff00ff,
    emissive: 0xff00ff,
    roughness: 0.2,
    metalness: 0.1
  });
  const textMesh = new THREE.Mesh(textGeometry, material);
  textMesh.position.copy(position);
  textMesh.position.y += 0.5;
  scene.add(textMesh);

  // Create HTML overlay
  const htmlDiv = document.createElement('div');
  htmlDiv.className = 'floating-score';
  htmlDiv.textContent = text;
  htmlDiv.style.position = 'absolute';
  htmlDiv.style.left = '50%';
  htmlDiv.style.top = '50%';
  htmlDiv.style.transform = 'translate(-50%, -50%)';
  htmlDiv.style.color = '#ff00ff';
  htmlDiv.style.fontSize = '24px';
  htmlDiv.style.fontFamily = 'monospace';
  htmlDiv.style.textShadow = '0 0 8px #ff00ff';
  htmlDiv.style.pointerEvents = 'none';
  htmlDiv.style.zIndex = '1000';
  htmlContainer.appendChild(htmlDiv);

  // Animation
  let startTime = Date.now();
  let isFading = false;

  const animate = () => {
    const elapsed = (Date.now() - startTime) / 1000;
    const progress = elapsed / duration;

    if (progress < 1.0) {
      // Float upward
      textMesh.position.y += 0.5 * 0.016; // ~60fps

      // HTML: move with camera
      const pos = new Vector3();
      pos.copy(textMesh.position);
      pos.project(camera);
      pos.x = (pos.x + 1) * window.innerWidth / 2;
      pos.y = (1 - pos.y) * window.innerHeight / 2;
      htmlDiv.style.left = pos.x + 'px';
      htmlDiv.style.top = pos.y + 'px';

      // Fade out
      if (progress > 0.8 && !isFading) {
        isFading = true;
        htmlDiv.style.opacity = '1';
      }
      if (isFading) {
        htmlDiv.style.opacity = String(1.0 - (progress - 0.8) / 0.2);
      }
    } else {
      // Cleanup
      scene.remove(textMesh);
      if (htmlDiv.parentElement) {
        htmlDiv.parentElement.removeChild(htmlDiv);
      }
      return;
    }

    requestAnimationFrame(animate);
  };

  requestAnimationFrame(animate);

  // Return dispose function
  return {
    dispose: () => {
      scene.remove(textMesh);
      if (htmlDiv.parentElement) {
        htmlDiv.parentElement.removeChild(htmlDiv);
      }
    }
  };
}

// Export for use in game
export default spawnScoreText;