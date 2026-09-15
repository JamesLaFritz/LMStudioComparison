/**
 * InstancedMeshManager - Manages batched rendering for identical geometries
 * Optimizes draw calls by combining multiple instances into single mesh
 */

import * as THREE from 'three';

export class InstancedMeshManager {
    constructor() {
        this.meshes = new Map(); // key -> InstancedMesh + metadata
        this.dummy = new THREE.Object3D(); // Reusable for matrix calculations
    }

    /**
     * Create or get an instanced mesh manager for a specific geometry/material combo
     */
    createOrGet(geometry, material, maxInstances, key) {
        if (!this.meshes.has(key)) {
            const instancedMesh = new THREE.InstancedMesh(
                geometry, 
                material, 
                maxInstances
            );
            instancedMesh.count = 0; // Start with no visible instances
            
            this.meshes.set(key, {
                mesh: instancedMesh,
                positions: [], // Track logical positions for updates
                maxInstances: maxInstances
            });
            
            return instancedMesh;
        }
        
        const data = this.meshes.get(key);
        data.mesh.count = 0;
        data.positions = [];
        return data.mesh;
    }

    /**
     * Set the transform for a specific instance index
     */
    setInstance(instancedMesh, index, position, quaternion, scale) {
        this.dummy.position.copy(position);
        if (quaternion) {
            this.dummy.quaternion.copy(quaternion);
        } else {
            this.dummy.rotation.set(0, 0, 0);
        }
        this.dummy.scale.copy(scale);
        
        this.dummy.updateMatrix();
        instancedMesh.setMatrixAt(index, this.dummy.matrix);
    }

    /**
     * Add an instance at the given position (auto-increment index)
     */
    addInstance(instancedMesh, position, quaternion = null, scale = new THREE.Vector3(1, 1, 1)) {
        const data = this.getMeshData(instancedMesh);
        if (!data || data.positions.length >= data.maxInstances) {
            return -1; // No more capacity
        }
        
        const index = data.positions.length;
        data.positions.push({ position, quaternion, scale });
        
        this.setInstance(instancedMesh, index, position, quaternion, scale);
        instancedMesh.count = data.positions.length;
        instancedMesh.instanceMatrix.needsUpdate = true;
        
        return index;
    }

    /**
     * Update an existing instance's transform
     */
    updateInstance(instancedMesh, index, position, quaternion = null, scale = new THREE.Vector3(1, 1, 1)) {
        const data = this.getMeshData(instancedMesh);
        if (!data || index >= data.positions.length) {
            return;
        }
        
        data.positions[index] = { position, quaternion, scale };
        this.setInstance(instancedMesh, index, position, quaternion, scale);
        instancedMesh.instanceMatrix.needsUpdate = true;
    }

    /**
     * Remove an instance (swap with last for efficiency)
     */
    removeInstance(instancedMesh, index) {
        const data = this.getMeshData(instancedMesh);
        if (!data || index >= data.positions.length) {
            return;
        }
        
        // Swap with last element
        const lastIndex = data.positions.length - 1;
        if (index !== lastIndex) {
            data.positions[index] = data.positions[lastIndex];
            this.setInstance(instancedMesh, index, 
                data.positions[index].position,
                data.positions[index].quaternion,
                data.positions[index].scale
            );
        }
        
        data.positions.pop();
        instancedMesh.count = data.positions.length;
        instancedMesh.instanceMatrix.needsUpdate = true;
    }

    /**
     * Get metadata for an instanced mesh
     */
    getMeshData(instancedMesh) {
        for (const [key, data] of this.meshes.entries()) {
            if (data.mesh === instancedMesh) {
                return data;
            }
        }
        return null;
    }

    /**
     * Update all instances in batch
     */
    updateAllInstances(instancedMesh, updateCallback) {
        const data = this.getMeshData(instancedMesh);
        if (!data) return;
        
        for (let i = 0; i < data.positions.length; i++) {
            const posData = data.positions[i];
            const result = updateCallback(posData, i);
            
            if (result === false) {
                // Mark for removal - swap with last
                this.removeInstance(instancedMesh, i);
                i--; // Adjust index after removal
            } else if (result && typeof result === 'object') {
                // Update transform
                this.setInstance(instancedMesh, i, 
                    result.position || posData.position,
                    result.quaternion || posData.quaternion,
                    result.scale || posData.scale
                );
            }
        }
        
        instancedMesh.instanceMatrix.needsUpdate = true;
    }

    /**
     * Get the count of active instances
     */
    getInstanceCount(instancedMesh) {
        return instancedMesh.count;
    }

    /**
     * Check if instance at index is active
     */
    isActiveInstance(instancedMesh, index) {
        const data = this.getMeshData(instancedMesh);
        return data && index < data.positions.length;
    }

    /**
     * Clear all instances (reset count to 0)
     */
    clearInstances(instancedMesh) {
        instancedMesh.count = 0;
        const data = this.getMeshData(instancedMesh);
        if (data) {
            data.positions = [];
        }
    }

    /**
     * Dispose of an instanced mesh and its resources
     */
    dispose(key) {
        const data = this.meshes.get(key);
        if (data) {
            data.mesh.geometry.dispose();
            if (data.mesh.material.isArray) {
                data.mesh.material.forEach(m => m.dispose());
            } else {
                data.mesh.material.dispose();
            }
            this.meshes.delete(key);
        }
    }

    /**
     * Dispose all managed instanced meshes
     */
    disposeAll() {
        for (const key of this.meshes.keys()) {
            this.dispose(key);
        }
        this.dummy = null;
    }

    /**
     * Get total instance count across all meshes
     */
    getTotalInstanceCount() {
        let total = 0;
        for (const data of this.meshes.values()) {
            total += data.positions.length;
        }
        return total;
    }
}

// Singleton instance
export const instancedMeshManager = new InstancedMeshManager();
