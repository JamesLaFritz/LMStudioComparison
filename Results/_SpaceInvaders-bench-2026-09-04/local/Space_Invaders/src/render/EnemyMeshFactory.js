import * as THREE from 'three';
import * as C from '../utils/Constants.js';

export class EnemyMeshFactory {
  constructor() {
    // Pre-create geometries for each enemy type (5 types)
    this.geometries = [];
    for (let t = 0; t < 5; t++) {
      const group = new THREE.Group();
      this._buildEnemyType(group, t);
      
      const childGeos = [];
      group.traverse((child) => {
        if (child.isMesh && child.geometry) {
          const geo = child.geometry.clone();
          geo.applyMatrix4(child.matrix);
          childGeos.push(geo);
        }
      });
      this.geometries[t] = childGeos;
    }
    
    // Cache materials per type
    this.materials = [];
    for (let t = 0; t < 5; t++) {
      const typeInfo = C.ENEMY_COLORS[t];
      this.materials[t] = new THREE.MeshStandardMaterial({
        color: 0x888899,
        emissive: typeInfo.emissive,
        emissiveIntensity: typeInfo.emissiveIntensity * 0.5,
        metalness: 0.3,
        roughness: 0.4,
      });
    }
    
    this.allMeshes = [];
  }

  _buildEnemyType(group, typeIndex) {
    // Body — box
    const bodyGeo = new THREE.BoxGeometry(0.35, 0.25, 0.2);
    group.add(new THREE.Mesh(bodyGeo));
    
    // Top dome
    const topGeo = new THREE.SphereGeometry(0.12, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2);
    const topMesh = new THREE.Mesh(topGeo);
    topMesh.position.y = 0.125;
    group.add(topMesh);
    
    // Arms and legs (pose-dependent)
    const armGeo = new THREE.BoxGeometry(0.1, 0.2, 0.15);
    const leftArm = new THREE.Mesh(armGeo);
    leftArm.position.set(-0.22, -0.02, 0);
    group.add(leftArm);
    
    const rightArm = new THREE.Mesh(armGeo);
    rightArm.position.set(0.22, -0.02, 0);
    group.add(rightArm);
    
    const legGeo = new THREE.BoxGeometry(0.08, 0.15, 0.12);
    const leftLeg = new THREE.Mesh(legGeo);
    leftLeg.position.set(-0.1, -0.3, 0);
    group.add(leftLeg);
    
    const rightLeg = new THREE.Mesh(legGeo);
    rightLeg.position.set(0.1, -0.3, 0);
    group.add(rightLeg);
  }

  createAll(gridData, scene) {
    this.allMeshes = [];
    for (const enemy of gridData) {
      const typeIndex = enemy.row;
      const meshes = this.geometries[typeIndex].map(geo => 
        new THREE.Mesh(geo, this.materials[typeIndex])
      );
      
      const group = new THREE.Group();
      for (const m of meshes) {
        group.add(m);
      }
      scene.add(group);
      
      const meshObj = {
        group,
        type: enemy.row,
        visible: true,
        poseFrame: 0,
        
        // Methods required by Game.js update loop
        update(formationPos, dt) { /* handled by setPosition */ },
        setPosition(x, y, z) { this.group.position.set(x, y, z); },
        setPose(frame) { this.poseFrame = frame; },
        setVisible(v) { this.visible = v; this.group.visible = v; },
      };
      
      this.allMeshes.push(meshObj);
    }
    return this.allMeshes;
  }

  dispose() {
    for (const meshData of this.allMeshes) {
      if (meshData.group) {
        meshData.group.traverse((child) => {
          if (child.geometry) child.geometry.dispose();
          if (child.material) child.material.dispose();
        });
      }
    }
    for (const mat of this.materials) {
      mat.dispose();
    }
  }
}
