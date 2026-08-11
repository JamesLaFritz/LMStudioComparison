import * as THREE from 'three';
import { ProceduralTextures } from '../../shared/rendering/ProceduralTextures.js';

/**
 * PongArena — builds the 3D playing field: floor, walls, net, decorative elements.
 */
export class PongArena {
  static build(scene) {
    const group = new THREE.Group();
    group.name = 'PongArena';

    // --- Floor ---
    const floorGeo = new THREE.PlaneGeometry(32, 20, 1, 1);
    const floorTex = ProceduralTextures.createGridTexture(512, 512, 32, '#0a0a2e', '#1a1a4e');
    const floorMat = new THREE.MeshStandardMaterial({
      map: floorTex,
      roughness: 0.8,
      metalness: 0.2,
      emissive: new THREE.Color(0x0a0a2e),
      emissiveIntensity: 0.15,
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -5.0;
    floor.receiveShadow = true;
    group.add(floor);

    // --- Back wall ---
    const backWallGeo = new THREE.PlaneGeometry(32, 10);
    const backWallTex = ProceduralTextures.createScanlineTexture(512, 256, '#050510', '#1a0033');
    const backWallMat = new THREE.MeshStandardMaterial({
      map: backWallTex,
      roughness: 0.9,
      metalness: 0.1,
      emissive: new THREE.Color(0x1a0033),
      emissiveIntensity: 0.1,
      side: THREE.DoubleSide,
    });
    const backWall = new THREE.Mesh(backWallGeo, backWallMat);
    backWall.position.set(0, 0, -6);
    group.add(backWall);

    // --- Side walls (left) ---
    const sideWallGeo = new THREE.BoxGeometry(0.3, 10, 12);
    const sideWallMat = new THREE.MeshStandardMaterial({
      color: 0x0a0a2e,
      roughness: 0.6,
      metalness: 0.4,
      emissive: new THREE.Color(0x1a0033),
      emissiveIntensity: 0.05,
    });

    const leftWall = new THREE.Mesh(sideWallGeo, sideWallMat);
    leftWall.position.set(-16, 0, 0);
    group.add(leftWall);

    const rightWall = new THREE.Mesh(sideWallGeo, sideWallMat);
    rightWall.position.set(16, 0, 0);
    group.add(rightWall);

    // --- Accent strips on side walls ---
    const stripGeo = new THREE.BoxGeometry(0.05, 9.5, 0.05);
    const leftStripMat = new THREE.MeshStandardMaterial({
      color: 0xff00ff,
      emissive: new THREE.Color(0xff00ff),
      emissiveIntensity: 2.0,
      roughness: 0.2,
      metalness: 0.8,
    });
    const rightStripMat = new THREE.MeshStandardMaterial({
      color: 0x00ff88,
      emissive: new THREE.Color(0x00ff88),
      emissiveIntensity: 2.0,
      roughness: 0.2,
      metalness: 0.8,
    });

    const leftStrip = new THREE.Mesh(stripGeo, leftStripMat);
    leftStrip.position.set(-15.8, 0, 0);
    group.add(leftStrip);

    const rightStrip = new THREE.Mesh(stripGeo, rightStripMat);
    rightStrip.position.set(15.8, 0, 0);
    group.add(rightStrip);

    // --- Holographic Net ---
    const netGeo = new THREE.PlaneGeometry(0.05, 9.0, 1, 20);
    const netMat = new THREE.MeshStandardMaterial({
      color: 0x00ffff,
      emissive: new THREE.Color(0x00ffff),
      emissiveIntensity: 1.5,
      transparent: true,
      opacity: 0.2,
      roughness: 0.1,
      metalness: 0.9,
      side: THREE.DoubleSide,
    });
    const net = new THREE.Mesh(netGeo, netMat);
    net.position.set(0, 0, 0);
    net.name = 'net';
    group.add(net);

    // --- Net posts ---
    const postGeo = new THREE.CylinderGeometry(0.08, 0.08, 9.5, 8);
    const postMat = new THREE.MeshStandardMaterial({
      color: 0x00ffff,
      emissive: new THREE.Color(0x00ffff),
      emissiveIntensity: 1.0,
      roughness: 0.3,
      metalness: 0.7,
    });

    const leftPost = new THREE.Mesh(postGeo, postMat);
    leftPost.position.set(0, 0, -4.75);
    group.add(leftPost);

    const rightPost = new THREE.Mesh(postGeo, postMat);
    rightPost.position.set(0, 0, 4.75);
    group.add(rightPost);

    // --- Corner pillars ---
    const pillarGeo = new THREE.CylinderGeometry(0.15, 0.2, 12, 8);
    const pillarMat = new THREE.MeshStandardMaterial({
      color: 0x1a0033,
      emissive: new THREE.Color(0x1a0033),
      emissiveIntensity: 0.3,
      roughness: 0.5,
      metalness: 0.6,
    });

    const corners = [
      [-15, 0, -5], [-15, 0, 5],
      [15, 0, -5], [15, 0, 5],
    ];
    for (const [x, y, z] of corners) {
      const pillar = new THREE.Mesh(pillarGeo, pillarMat);
      pillar.position.set(x, y, z);
      group.add(pillar);
    }

    scene.add(group);
    return { group, netMat, floorTex, backWallTex };
  }

  static dispose({ netMat, floorTex, backWallTex }) {
    netMat.dispose();
    floorTex.dispose();
    backWallTex.dispose();
  }
}
