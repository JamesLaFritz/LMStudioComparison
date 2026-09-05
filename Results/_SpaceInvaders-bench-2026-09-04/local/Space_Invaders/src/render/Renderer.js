import * as THREE from 'three';

export class Renderer {
  constructor(container) {
    // Create scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0a0e14);
    this.scene.fog = new THREE.Fog(0x0a0e14, 20, 60);

    // Create camera
    this.camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 100);
    this.camera.position.set(0, 0, 15);
    this.camera.lookAt(0, 0, 0);

    // Create WebGL renderer and attach canvas to container
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(this.renderer.domElement);

    // Lights
    this.formationLight = new THREE.PointLight(0x8855ff, 3.0, 20);
    this.playerSpot = new THREE.SpotLight(0x00ffff, 2.0, 15, Math.PI / 6, 0.5);
    this.rimLight = new THREE.DirectionalLight(0xffffff, 0.8);

    this.scene.add(this.formationLight);
    this.scene.add(this.playerSpot);
    this.scene.add(this.rimLight);

    const ambient = new THREE.AmbientLight(0x404860, 0.4);
    this.scene.add(ambient);

    this.rimLight.position.set(0, 5, -10);
    this.playerSpot.position.set(0, 3, 2);
    this.playerSpot.target.position.set(0, 0, 2);
    this.scene.add(this.playerSpot.target);

    // Handle resize
    window.addEventListener('resize', () => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(w, h);
    });
  }

  updateFormationCenter(x, y) {
    this.formationLight.position.set(x, y, 3);
  }

  updatePlayerPosition(x, z) {
    this.playerSpot.position.set(x, 4, z + 2);
  }

  dispose() {
    this.scene.remove(this.formationLight);
    this.scene.remove(this.playerSpot);
    this.scene.remove(this.rimLight);
    this.formationLight.dispose();
    this.playerSpot.dispose();
    this.rimLight.dispose();
    if (this.renderer.domElement.parentNode) {
      this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
    }
    this.renderer.dispose();
  }
}
