/**
 * Shield barrier — destructible voxel grid (8 rows x 4 cols per shield).
 */

import {
  Mesh,
  Group,
  BoxGeometry,
  MeshStandardMaterial,
  Vector3,
} from 'three';
import { SHIELD_VOXEL_SIZE, SHIELD_ROWS, SHIELD_COLS } from '@shared/utils/Constants';

export class ShieldVoxel {
  mesh: Mesh;
  active: boolean = true;
  hp: number = 1;

  constructor() {
    const geo = new BoxGeometry(SHIELD_VOXEL_SIZE, SHIELD_VOXEL_SIZE, SHIELD_VOXEL_SIZE);
    const mat = new MeshStandardMaterial({
      color: 0x00ff88,
      emissive: 0x00aa44,
      emissiveIntensity: 0.5,
      metalness: 0.3,
      roughness: 0.6,
      transparent: true,
      opacity: 1,
    });
    this.mesh = new Mesh(geo, mat);
    this.mesh.visible = false;
  }

  activate(position: Vector3): void {
    this.active = true;
    this.hp = 1;
    this.mesh.position.copy(position);
    this.mesh.visible = true;
  }

  deactivate(): void {
    this.active = false;
    this.hp = 0;
    this.mesh.visible = false;
  }

  takeDamage(): boolean {
    if (!this.active) return false;
    this.hp -= 1;
    if (this.hp <= 0) {
      this.deactivate();
      return true; // destroyed
    }
    return false; // still alive but damaged
  }

  dispose(): void {
    if (this.mesh.geometry) this.mesh.geometry.dispose();
    if (this.mesh.material) this.mesh.material.dispose();
  }

  reset(): void {
    this.deactivate();
  }
}

export class ShieldBarrier {
  private voxels: ShieldVoxel[][] = [];
  private group: Group;
  private position: Vector3 = new Vector3();

  constructor() {
    this.group = new Group();
    this.buildGrid();
  }

  /** Build the voxel grid */
  buildGrid(): void {
    this.voxels = [];
    const vs = SHIELD_VOXEL_SIZE;

    for (let row = 0; row < SHIELD_ROWS; row++) {
      const rowVoxels: ShieldVoxel[] = [];
      for (let col = 0; col < SHIELD_COLS; col++) {
        const voxel = new ShieldVoxel();
        // Position within shield local space
        const x = (col - (SHIELD_COLS - 1) / 2) * vs;
        const y = ((SHIELD_ROWS - 1) / 2 - row) * vs;
        const z = 0;
        voxel.activate(new Vector3(x, y, z));
        this.group.add(voxel.mesh);
        rowVoxels.push(voxel);
      }
      this.voxels.push(rowVoxels);
    }

    // Shape the shield like a classic Space Invaders barrier (arched top)
    this.shapeShield();
  }

  /** Shape the shield — remove some voxels to create the iconic arch shape */
  private shapeShield(): void {
    // Remove center-top voxels for an arched opening
    const removePattern: [number, number][] = [
      [0, 1], [0, 2],
      [1, 1], [1, 2],
      [2, 1], [2, 2],
    ];

    for (const [row, col] of removePattern) {
      if (row < this.voxels.length && col < this.voxels[row].length) {
        this.voxels[row][col].deactivate();
      }
    }
  }

  /** Set the world position of the shield */
  setPosition(x: number, y: number, z: number): void {
    this.position.set(x, y, z);
    this.group.position.copy(this.position);
  }

  /** Check if a point (bullet position) hits any voxel. Returns destroyed voxel or null. */
  hitTest(pointX: number, pointY: number, pointZ: number): ShieldVoxel | null {
    const vs = SHIELD_VOXEL_SIZE;
    // Convert world point to local grid coordinates
    for (let row = 0; row < SHIELD_ROWS; row++) {
      for (let col = 0; col < SHIELD_COLS; col++) {
        const voxel = this.voxels[row][col];
        if (!voxel.active) continue;

        // Local position of this voxel center
        const localX = (col - (SHIELD_COLS - 1) / 2) * vs;
        const localY = ((SHIELD_ROWS - 1) / 2 - row) * vs;
        const localZ = 0;

        // Check if point is within voxel bounds
        const halfVoxel = vs / 2 + 0.05; // slight overlap tolerance
        if (Math.abs(pointX - this.position.x - localX) < halfVoxel &&
            Math.abs(pointY - this.position.y - localY) < halfVoxel &&
            Math.abs(pointZ - this.position.z - localZ) < halfVoxel) {
          return voxel;
        }
      }
    }
    return null;
  }

  /** Dispose all Three.js resources */
  dispose(): void {
    for (const row of this.voxels) {
      for (const voxel of row) {
        voxel.dispose();
      }
    }
    this.group.clear();
    this.voxels.length = 0;
  }

  /** Get the group for scene attachment */
  getGroup(): Group {
    return this.group;
  }
}
