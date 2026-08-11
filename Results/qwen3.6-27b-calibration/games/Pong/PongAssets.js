/**
 * PongAssets — Procedural asset generation for Pong.
 */
import * as THREE from 'three';
import { TextureGen } from '../../shared/procedural/TextureGen.js';
import { GeometryGen } from '../../shared/procedural/GeometryGen.js';

export class PongAssets {
  /**
   * Generate all procedural assets needed for Pong.
   */
  static generate() {
    const assets = {};

    // Court grid texture
    assets.courtTexture = TextureGen.createGridTexture(512, 32, '#1a1a3e', '#050510');
    assets.courtTexture.repeat.set(2, 1);

    // Paddle textures (brushed metal with edge glow)
    assets.paddleTextureP1 = TextureGen.createBrushedMetalTexture(128, '#224444');
    assets.paddleTextureP2 = TextureGen.createBrushedMetalTexture(128, '#442233');

    // Court geometry (16 wide x 10 deep)
    assets.courtGeometry = GeometryGen.createCourtPlane(16, 10, 4, 2);

    // Paddle geometry
    assets.paddleGeometry = GeometryGen.createPaddleGeometry(0.25, 2.5, 0.15, 0.05);

    // Ball geometry
    assets.ballGeometry = new THREE.SphereGeometry(0.2, 16, 12);

    // Border frame geometry
    assets.borderGeometry = GeometryGen.createBorderFrame(16, 10);

    // Center line geometry
    assets.centerLineGeometry = GeometryGen.createCenterLine(10, 20);

    // Goal marker geometries
    assets.goalMarkerLeft = GeometryGen.createGoalMarker(0.1, 10);
    assets.goalMarkerRight = GeometryGen.createGoalMarker(0.1, 10);

    // Materials
    assets.courtMaterial = new THREE.MeshStandardMaterial({
      map: assets.courtTexture,
      roughness: 0.8,
      metalness: 0.1,
      color: 0x0a0a1a,
      emissive: 0x050510,
      emissiveIntensity: 0.3,
    });

    assets.paddleMaterialP1 = new THREE.MeshStandardMaterial({
      map: assets.paddleTextureP1,
      roughness: 0.2,
      metalness: 0.8,
      color: 0xff0066,
      emissive: 0xff0066,
      emissiveIntensity: 0.8,
    });

    assets.paddleMaterialP2 = new THREE.MeshStandardMaterial({
      map: assets.paddleTextureP2,
      roughness: 0.2,
      metalness: 0.8,
      color: 0x00ffcc,
      emissive: 0x00ffcc,
      emissiveIntensity: 0.8,
    });

    assets.ballMaterial = new THREE.MeshStandardMaterial({
      roughness: 0.1,
      metalness: 0.3,
      color: 0xffffff,
      emissive: 0xffffff,
      emissiveIntensity: 1.0,
    });

    assets.borderMaterial = new THREE.LineBasicMaterial({
      color: 0x333366,
      transparent: true,
      opacity: 0.6,
    });

    assets.centerLineMaterial = new THREE.LineBasicMaterial({
      color: 0x222244,
      transparent: true,
      opacity: 0.4,
    });

    assets.goalLineMaterial = new THREE.LineBasicMaterial({
      color: 0x444488,
      transparent: true,
      opacity: 0.5,
    });

    return assets;
  }

  /**
   * Dispose all generated assets.
   */
  static dispose(assets) {
    if (!assets) return;

    // Textures
    if (assets.courtTexture) assets.courtTexture.dispose();
    if (assets.paddleTextureP1) assets.paddleTextureP1.dispose();
    if (assets.paddleTextureP2) assets.paddleTextureP2.dispose();

    // Geometries
    if (assets.courtGeometry) assets.courtGeometry.dispose();
    if (assets.paddleGeometry) assets.paddleGeometry.dispose();
    if (assets.ballGeometry) assets.ballGeometry.dispose();
    if (assets.borderGeometry) assets.borderGeometry.dispose();
    if (assets.centerLineGeometry) assets.centerLineGeometry.dispose();
    if (assets.goalMarkerLeft) assets.goalMarkerLeft.dispose();
    if (assets.goalMarkerRight) assets.goalMarkerRight.dispose();

    // Materials
    if (assets.courtMaterial) assets.courtMaterial.dispose();
    if (assets.paddleMaterialP1) assets.paddleMaterialP1.dispose();
    if (assets.paddleMaterialP2) assets.paddleMaterialP2.dispose();
    if (assets.ballMaterial) assets.ballMaterial.dispose();
    if (assets.borderMaterial) assets.borderMaterial.dispose();
    if (assets.centerLineMaterial) assets.centerLineMaterial.dispose();
    if (assets.goalLineMaterial) assets.goalLineMaterial.dispose();
  }
}
