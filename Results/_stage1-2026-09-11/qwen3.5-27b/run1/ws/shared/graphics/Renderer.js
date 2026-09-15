import * as THREE from 'three';

export function createRenderer(containerId, options = {}) {
  const {
    width = window.innerWidth,
    height = window.innerHeight,
    antialias = true,
    pixelRatio = Math.min(window.devicePixelRatio, 2)
  } = options;

  // Create renderer with PBR support
  const renderer = new THREE.WebGLRenderer({ 
    antialias,
    powerPreference: 'high-performance',
    alpha: false
  });
  renderer.setSize(width, height);
  renderer.setPixelRatio(pixelRatio);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;

  // Create orthographic camera for 2D gameplay feel with 3D depth
  const aspect = width / height;
  const frustumSize = 80;
  const camera = new THREE.OrthographicCamera(
    -frustumSize * aspect / 2,
    frustumSize * aspect / 2,
    frustumSize / 2,
    -frustumSize / 2,
    -1000,
    1000
  );
  camera.position.set(0, 0, 300);
  camera.lookAt(0, 0, 0);

  // Create scene with fog for depth perception
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a0a1a);
  scene.fog = new THREE.FogExp2(0x0a0a1a, 0.002);

  // Add ambient light for base illumination
  const ambientLight = new THREE.AmbientLight(0x404060, 0.5);
  scene.add(ambientLight);

  // Add directional light for subtle shading
  const dirLight = new THREE.DirectionalLight(0xffffff, 0.3);
  dirLight.position.set(50, 100, 200);
  scene.add(dirLight);

  // Mount renderer to container
  const container = document.getElementById(containerId);
  if (container) {
    container.appendChild(renderer.domElement);
  }

  // Handle resize
  let resizeTimeout;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
      const newWidth = window.innerWidth;
      const newHeight = window.innerHeight;
      const newAspect = newWidth / newHeight;

      camera.left = -frustumSize * newAspect / 2;
      camera.right = frustumSize * newAspect / 2;
      camera.top = frustumSize / 2;
      camera.bottom = -frustumSize / 2;
      camera.updateProjectionMatrix();

      renderer.setSize(newWidth, newHeight);
    }, 100);
  });

  return { renderer, camera, scene };
}

export function disposeRenderer({ renderer }) {
  renderer.dispose();
  if (renderer.domElement) {
    renderer.domElement.remove();
  }
}
