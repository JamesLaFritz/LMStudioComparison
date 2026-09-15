import * as THREE from 'three';

export class GeometryFactory {
  static createGridFloor(width: number, height: number, divisions: number): THREE.Mesh {
    const geometry = new THREE.PlaneGeometry(width, height, divisions, divisions);
    
    // Add subtle vertex displacement for retro-futurism feel
    const pos = geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const z = Math.sin(x * 0.5) * Math.cos(y * 0.5) * 0.02;
      pos.setZ(i, z);
    }
    geometry.computeVertexNormals();

    // Create grid texture via canvas
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;
    
    // Background
    ctx.fillStyle = '#0a0a1a';
    ctx.fillRect(0, 0, 256, 256);
    
    // Grid lines
    ctx.strokeStyle = 'rgba(0, 255, 255, 0.3)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 256; i += 32) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, 256);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(256, i);
      ctx.stroke();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(width / 10, height / 10);

    const material = new THREE.MeshStandardMaterial({
      map: texture,
      emissive: 0x0a0a2a,
      emissiveIntensity: 0.5,
      roughness: 0.8,
      metalness: 0.2,
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = -1.5;
    return mesh;
  }

  static createStarfield(count: number): THREE.InstancedMesh {
    const geometry = new THREE.OctahedronGeometry(0.02, 0);
    const material = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0x4444aa,
      emissiveIntensity: 0.5,
    });

    const instancedMesh = new THREE.InstancedMesh(geometry, material, count);
    const dummy = new THREE.Object3D();

    for (let i = 0; i < count; i++) {
      dummy.position.set(
        (Math.random() - 0.5) * 100,
        (Math.random() - 0.5) * 60 + 20,
        -20 - Math.random() * 80
      );
      dummy.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);
      const scale = 0.5 + Math.random() * 1.5;
      dummy.scale.set(scale, scale, scale);
      dummy.updateMatrix();
      instancedMesh.setMatrixAt(i, dummy.matrix);
    }

    return instancedMesh;
  }

  static createShieldBarrier(x: number, y: number): THREE.Group {
    const group = new THREE.Group();
    const voxelSize = 0.08;
    const barrierWidth = 9;
    const barrierHeight = 5;
    
    const material = new THREE.MeshStandardMaterial({
      color: 0x00ff88,
      emissive: 0x003322,
      emissiveIntensity: 0.5,
      transparent: true,
      opacity: 0.7,
    });

    for (let row = 0; row < barrierHeight; row++) {
      for (let col = 0; col < barrierWidth; col++) {
        // Create arch shape
        const centerX = barrierWidth / 2;
        if (row >= 3 && Math.abs(col - centerX) <= 1) continue;

        const voxel = new THREE.Mesh(
          new THREE.BoxGeometry(voxelSize, voxelSize, voxelSize),
          material.clone()
        );
        voxel.position.set(
          col * voxelSize - (barrierWidth * voxelSize) / 2,
          row * voxelSize - (barrierHeight * voxelSize) / 2,
          0
        );
        group.add(voxel);
      }
    }

    group.position.set(x, y, 0.1);
    return group;
  }

  static disposeGroup(group: THREE.Group): void {
    group.traverse((child) => {
      if ((child as THREE.Mesh).geometry) (child as THREE.Mesh).geometry.dispose();
      if ((child as THREE.Mesh).material) {
        const mat = (child as THREE.Mesh).material;
        if (Array.isArray(mat)) {
          mat.forEach(m => m.dispose());
        } else {
          mat.dispose();
        }
      }
    });
  }
}
