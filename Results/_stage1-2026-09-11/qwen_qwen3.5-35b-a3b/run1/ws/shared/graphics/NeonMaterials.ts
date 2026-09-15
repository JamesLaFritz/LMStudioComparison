import { MeshStandardMaterial, Color } from 'three';

/**
 * NeonMaterials - PBR material presets for retro-futurism aesthetic
 * All materials use MeshStandardMaterial with tuned emissive properties
 * to create glowing neon effects without washing out.
 */
export class NeonMaterials {
  private static _instance: NeonMaterials | null = null;

  // Player ship materials
  public playerMain!: MeshStandardMaterial;
  public playerAccent!: MeshStandardMaterial;
  public playerShield!: MeshStandardMaterial;

  // Enemy materials (row-based color variation)
  public enemyRowMaterials: MeshStandardMaterial[] = [];

  // Projectile materials
  public playerProjectile!: MeshStandardMaterial;
  public enemyProjectile!: MeshStandardMaterial;

  // Power-up materials
  public powerUpRapidFire!: MeshStandardMaterial;
  public powerUpSpreadShot!: MeshStandardMaterial;
  public powerUpShield!: MeshStandardMaterial;

  // UI element materials (for in-game 3D elements)
  public scoreTextEmissive!: MeshStandardMaterial;

  private constructor() {
    this.initMaterials();
  }

  /**
   * Singleton pattern for material management
   */
  static getInstance(): NeonMaterials {
    if (!NeonMaterials._instance) {
      NeonMaterials._instance = new NeonMaterials();
    }
    return NeonMaterials._instance;
  }

  /**
   * Initialize all materials with retro-futurism color palette
   */
  private initMaterials(): void {
    // Player ship - cyan neon
    this.playerMain = new MeshStandardMaterial({
      color: new Color(0x00ffff),
      emissive: new Color(0x0088ff),
      emissiveIntensity: 0.85,
      metalness: 0.7,
      roughness: 0.25,
    });

    this.playerAccent = new MeshStandardMaterial({
      color: new Color(0xffffff),
      emissive: new Color(0x00ffff),
      emissiveIntensity: 1.2,
      metalness: 0.9,
      roughness: 0.15,
    });

    this.playerShield = new MeshStandardMaterial({
      color: new Color(0x00ff88),
      emissive: new Color(0x00ffaa),
      emissiveIntensity: 0.6,
      metalness: 0.5,
      roughness: 0.3,
      transparent: true,
      opacity: 0.7,
    });

    // Enemy materials - row-based color variation (top rows worth more points)
    const enemyRowColors = [
      new Color(0xff0066), // Row 0: Magenta (30 pts)
      new Color(0xff6600), // Row 1: Orange (20 pts)
      new Color(0xffcc00), // Row 2: Yellow (10 pts)
      new Color(0x00ff66), // Row 3: Green
      new Color(0x00ccff), // Row 4: Light blue
    ];

    this.enemyRowMaterials = enemyRowColors.map((color, index) => {
      const intensity = 0.5 + (index / enemyRowColors.length) * 0.5;
      return new MeshStandardMaterial({
        color: color.clone().multiplyScalar(0.8),
        emissive: color.clone(),
        emissiveIntensity: intensity,
        metalness: 0.6,
        roughness: 0.3,
      });
    });

    // Projectiles - distinct colors for player vs enemy
    this.playerProjectile = new MeshStandardMaterial({
      color: new Color(0x00ffff),
      emissive: new Color(0x0088ff),
      emissiveIntensity: 1.0,
      metalness: 0.8,
      roughness: 0.2,
    });

    this.enemyProjectile = new MeshStandardMaterial({
      color: new Color(0xff3366),
      emissive: new Color(0xff0044),
      emissiveIntensity: 1.0,
      metalness: 0.8,
      roughness: 0.2,
    });

    // Power-up materials
    this.powerUpRapidFire = new MeshStandardMaterial({
      color: new Color(0xffaa00),
      emissive: new Color(0xff6600),
      emissiveIntensity: 0.9,
      metalness: 0.7,
      roughness: 0.25,
    });

    this.powerUpSpreadShot = new MeshStandardMaterial({
      color: new Color(0xaa00ff),
      emissive: new Color(0x8800cc),
      emissiveIntensity: 0.9,
      metalness: 0.7,
      roughness: 0.25,
    });

    this.powerUpShield = new MeshStandardMaterial({
      color: new Color(0x00ffaa),
      emissive: new Color(0x00cc88),
      emissiveIntensity: 0.9,
      metalness: 0.6,
      roughness: 0.3,
    });

    // Score text material (for in-game floating elements)
    this.scoreTextEmissive = new MeshStandardMaterial({
      color: new Color(0xffffff),
      emissive: new Color(0xffff00),
      emissiveIntensity: 1.5,
      metalness: 0.8,
      roughness: 0.2,
    });

    // Cache materials for disposal tracking
    (NeonMaterials as unknown as { _materials: MeshStandardMaterial[] })._materials = [
      this.playerMain,
      this.playerAccent,
      this.playerShield,
      ...this.enemyRowMaterials,
      this.playerProjectile,
      this.enemyProjectile,
      this.powerUpRapidFire,
      this.powerUpSpreadShot,
      this.powerUpShield,
      this.scoreTextEmissive,
    ];
  }

  /**
   * Get material for specific enemy row (0 = top row)
   */
  getEnemyMaterial(rowIndex: number): MeshStandardMaterial {
    const index = Math.max(0, Math.min(rowIndex, this.enemyRowMaterials.length - 1));
    return this.enemyRowMaterials[index];
  }

  /**
   * Get material for specific power-up type
   */
  getPowerUpMaterial(type: 'rapid' | 'spread' | 'shield'): MeshStandardMaterial {
    switch (type) {
      case 'rapid':
        return this.powerUpRapidFire;
      case 'spread':
        return this.powerUpSpreadShot;
      case 'shield':
        return this.powerUpShield;
      default:
        return this.playerMain;
    }
  }

  /**
   * Dispose all materials and clear references
   */
  dispose(): void {
    const materials = (NeonMaterials as unknown as { _materials: MeshStandardMaterial[] })._materials || [];
    
    materials.forEach(material => {
      material.dispose();
    });

    this.enemyRowMaterials.forEach(mat => mat.dispose());
    this.enemyRowMaterials.length = 0;

    NeonMaterials._instance = null;
  }
}