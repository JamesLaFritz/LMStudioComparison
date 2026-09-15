import * as THREE from 'three';

export function createScene() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a0a1a);
  scene.fog = new THREE.FogExp2(0x0a0a1a, 0.02);
  
  return scene;
}

export function createCamera(aspect) {
  const camera = new THREE.PerspectiveCamera(75, aspect, 0.1, 1000);
  camera.position.set(0, 8, 15);
  camera.lookAt(0, 0, 0);
  
  return camera;
}

export function createLights() {
  const lights = [];
  
  // Ambient light for base illumination
  const ambientLight = new THREE.AmbientLight(0x404060, 0.5);
  lights.push(ambientLight);
  
  // Directional light from above
  const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
  dirLight.position.set(10, 20, 10);
  dirLight.castShadow = true;
  lights.push(dirLight);
  
  // Point lights for dramatic effect (cyan and magenta)
  const pointLight1 = new THREE.PointLight(0x00ffff, 0.5, 30);
  pointLight1.position.set(-10, 5, 5);
  lights.push(pointLight1);
  
  const pointLight2 = new THREE.PointLight(0xff00ff, 0.5, 30);
  pointLight2.position.set(10, 5, 5);
  lights.push(pointLight2);
  
  return lights;
}

export function createStarfield(count = 200) {
  const starsGeometry = new THREE.BufferGeometry();
  const positions = [];
  const colors = [];
  
  for (let i = 0; i < count; i++) {
    const x = (Math.random() - 0.5) * 100;
    const y = Math.random() * 30 + 5;
    const z = (Math.random() - 0.5) * 50 - 10;
    
    positions.push(x, y, z);
    
    // Random star colors (white, cyan, magenta tinted)
    const colorType = Math.random();
    let r, g, b;
    
    if (colorType < 0.6) {
      // White stars
      const brightness = 0.7 + Math.random() * 0.3;
      r = g = b = brightness;
    } else if (colorType < 0.8) {
      // Cyan tinted
      r = 0.5 + Math.random() * 0.2;
      g = 0.8 + Math.random() * 0.2;
      b = 1.0;
    } else {
      // Magenta tinted
      r = 1.0;
      g = 0.5 + Math.random() * 0.3;
      b = 0.8 + Math.random() * 0.2;
    }
    
    colors.push(r, g, b);
  }
  
  starsGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  starsGeometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  
  const starsMaterial = new THREE.PointsMaterial({
    size: 0.15,
    vertexColors: true,
    transparent: true,
    opacity: 0.9,
    blending: THREE.AdditiveBlending
  });
  
  const starfield = new THREE.Points(starsGeometry, starsMaterial);
  
  return { mesh: starfield, positions: starsGeometry.attributes.position.array };
}

export function updateStarfieldParallax(positions, playerX) {
  // Subtle parallax effect based on player position
  for (let i = 0; i < positions.length; i += 3) {
    const depthFactor = (positions[i + 2] + 25) / 45; // Normalize z from -20 to 25
    positions[i] -= playerX * 0.02 * depthFactor;
    
    // Wrap around screen edges
    if (positions[i] < -50) positions[i] += 100;
    if (positions[i] > 50) positions[i] -= 100;
  }
}

export function createBoundaryWalls() {
  const walls = [];
  const wallMaterial = new THREE.MeshStandardMaterial({
    color: 0x222244,
    emissive: 0x004488,
    emissiveIntensity: 0.3,
    metalness: 0.5,
    roughness: 0.3
  });
  
  // Left wall
  const leftWall = new THREE.Mesh(new THREE.BoxGeometry(1, 25, 0.5), wallMaterial);
  leftWall.position.set(-14, 12.5, 0);
  walls.push(leftWall);
  
  // Right wall
  const rightWall = new THREE.Mesh(new THREE.BoxGeometry(1, 25, 0.5), wallMaterial);
  rightWall.position.set(14, 12.5, 0);
  walls.push(rightWall);
  
  // Bottom barrier (aliens can't pass)
  const bottomBarrier = new THREE.Mesh(new THREE.BoxGeometry(30, 0.5, 0.5), wallMaterial);
  bottomBarrier.position.set(0, -2, 0);
  walls.push(bottomBarrier);
  
  return walls;
}

export function disposeSceneElements(scene) {
  // Remove all meshes except camera and lights
  scene.children.forEach(child => {
    if (child.isMesh || child.isPoints) {
      scene.remove(child);
      
      if (child.geometry) {
        child.geometry.dispose();
      }
      
      if (child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach(m => m.dispose());
        } else {
          child.material.dispose();
        }
      }
    }
  });
}
