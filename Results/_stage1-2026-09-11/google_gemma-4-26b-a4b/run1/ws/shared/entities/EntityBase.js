import * as THREE from 'three';

/**
 * Base class for all game entities.
 * Handles position, rotation, scale, and basic lifecycle.
 */
export class EntityBase {
    /**
     * @param {THREE.Object3D} object - The underlying Three.js object.
     */
    constructor(object) {
        this.object = object;
        this.active = false;
        this.id = THREE.MathUtils.generateUUID();
    }

    /**
     * Activates the entity and resets its state.
     * @param {THREE.Vector3} position 
     * @param {THREE.Quaternion} rotation 
     */
    activate(position, rotation) {
        this.active = true;
        this.object.position.copy(position);
        if (rotation) {
            this.object.quaternion.copy(rotation);
        } else {
            this.object.quaternion.set(0, 0, 0, 1);
        }
        this.object.visible = true;
    }

    /**
     * Deactivates the entity and hides it from the scene.
     */
    deactivate() {
        this.active = false;
        this.object.visible = false;
    }

    /**
     * Update logic for the entity.
     * @param {number} deltaTime - Time since last frame.
     * @param {number} timeScale - Current global time scale.
     */
    update(deltaTime, timeScale) {
        // To be overridden by subclasses
    }

    /**
     * Cleanup resources.
     */
    dispose() {
        // To be overridden by subclasses
    }
}
