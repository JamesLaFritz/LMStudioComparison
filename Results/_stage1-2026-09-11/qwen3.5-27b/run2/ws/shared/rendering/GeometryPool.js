/**
 * GeometryPool - Reusable geometry cache for common shapes
 * Prevents redundant geometry creation and enables efficient disposal
 */

import * as THREE from 'three';

export class GeometryPool {
    constructor() {
        this.cache = new Map(); // key -> { geometry, refCount }
        
        // Pre-create commonly used geometries
        this._prewarmGeometries();
    }

    /**
     * Get a geometry by key, incrementing reference count
     * @param {string} key - Unique identifier for the geometry type
     * @param {Object} options - Optional override parameters
     * @returns {THREE.BufferGeometry} The cached or newly created geometry
     */
    get(key, options = {}) {
        const cacheEntry = this.cache.get(key);
        
        if (cacheEntry) {
            cacheEntry.refCount++;
            return cacheEntry.geometry;
        }

        // Create new geometry based on key pattern
        let geometry = this._createGeometryFromKey(key, options);
        
        if (!geometry) {
            console.warn(`GeometryPool: Unknown geometry key "${key}"`);
            // Fallback to box
            geometry = new THREE.BoxGeometry(1, 1, 1);
        }

        this.cache.set(key, { geometry, refCount: 1 });
        return geometry;
    }

    /**
     * Release a geometry, decrementing reference count
     * Disposes when refCount reaches zero
     * @param {string} key - The geometry key to release
     */
    release(key) {
        const cacheEntry = this.cache.get(key);
        
        if (!cacheEntry) return;

        cacheEntry.refCount--;

        if (cacheEntry.refCount <= 0) {
            // Dispose the geometry
            cacheEntry.geometry.dispose();
            this.cache.delete(key);
        }
    }

    /**
     * Manually add a custom geometry to the pool
     * @param {string} key - Unique identifier
     * @param {THREE.BufferGeometry} geometry - The geometry to store
     */
    add(key, geometry) {
        if (this.cache.has(key)) {
            console.warn(`GeometryPool: Key "${key}" already exists`);
            return;
        }

        this.cache.set(key, { geometry, refCount: 1 });
    }

    /**
     * Remove a geometry immediately without waiting for refCount
     * @param {string} key - The geometry key to remove
     */
    remove(key) {
        const cacheEntry = this.cache.get(key);
        
        if (!cacheEntry) return;

        cacheEntry.geometry.dispose();
        this.cache.delete(key);
    }

    /**
     * Clear all geometries from the pool
     * Use with caution - should only be called on full game reset
     */
    clear() {
        for (const [key, entry] of this.cache) {
            entry.geometry.dispose();
        }
        this.cache.clear();
        
        // Re-prewarm for next use
        this._prewarmGeometries();
    }

    /**
     * Get the current cache statistics
     * @returns {Object} Statistics about cached geometries
     */
    getStats() {
        let totalGeometries = 0;
        let totalRefCount = 0;

        for (const entry of this.cache.values()) {
            totalGeometries++;
            totalRefCount += entry.refCount;
        }

        return {
            cachedKeys: this.cache.size,
            totalGeometries,
            totalRefCount
        };
    }

    /**
     * Pre-warm commonly used geometries for instant access
     */
    _prewarmGeometries() {
        // Basic shapes
        this.get('box-1');           // Unit cube
        this.get('sphere-1');        // Unit sphere
        this.get('plane-1');         // Unit plane
        
        // Particle shapes
        this.get('particle-sphere');  // Small sphere for particles
        this.get('particle-cube');    // Cube variant for particles
        
        // UI elements
        this.get('ring-thin');       // Thin ring for shockwaves
        this.get('ring-medium');     // Medium ring
        
        // Game-specific shapes (will be extended per game)
        this.get('bullet-sphere');   // Bullet projectile shape
        this.get('bomb-cylinder');   // Bomb/missile shape
        
        // Release the prewarmed references (they stay in cache due to internal handling)
        // Actually, we want them cached, so we don't release - they have refCount 1
    }

    /**
     * Create geometry based on key pattern
     * @param {string} key - The geometry identifier
     * @param {Object} options - Override parameters
     * @returns {THREE.BufferGeometry|null} Created geometry or null if unknown
     */
    _createGeometryFromKey(key, options = {}) {
        const parts = key.split('-');
        const type = parts[0];

        switch (type) {
            case 'box':
                const width = parseFloat(parts[1]) || 1;
                const height = parseFloat(parts[2]) || 1;
                const depth = parseFloat(parts[3]) || 1;
                return new THREE.BoxGeometry(width, height, depth);

            case 'sphere':
                const radius = parseFloat(parts[1]) || 0.5;
                const widthSegs = parseInt(parts[2]) || 16;
                const heightSegs = parseInt(parts[3]) || 16;
                return new THREE.SphereGeometry(radius, widthSegs, heightSegs);

            case 'plane':
                const planeWidth = parseFloat(parts[1]) || 1;
                const planeHeight = parseFloat(parts[2]) || 1;
                return new THREE.PlaneGeometry(planeWidth, planeHeight);

            case 'cylinder':
                const cylRadiusTop = parseFloat(parts[1]) || 0.5;
                const cylRadiusBottom = parseFloat(parts[2]) || 0.5;
                const cylHeight = parseFloat(parts[3]) || 1;
                const cylRadSegs = parseInt(parts[4]) || 8;
                return new THREE.CylinderGeometry(cylRadiusTop, cylRadiusBottom, cylHeight, cylRadSegs);

            case 'cone':
                const coneRadius = parseFloat(parts[1]) || 0.5;
                const coneHeight = parseFloat(parts[2]) || 1;
                const coneRadSegs = parseInt(parts[3]) || 8;
                return new THREE.ConeGeometry(coneRadius, coneHeight, coneRadSegs);

            case 'torus':
                const torusRadius = parseFloat(parts[1]) || 0.5;
                const torusTube = parseFloat(parts[2]) || 0.1;
                const torusRadSegs = parseInt(parts[3]) || 8;
                const torusTubSegs = parseInt(parts[4]) || 16;
                return new THREE.TorusGeometry(torusRadius, torusTube, torusRadSegs, torusTubSegs);

            case 'particle':
                // Small optimized geometry for particles
                if (parts[1] === 'sphere') {
                    return new THREE.SphereGeometry(0.15, 6, 6);
                } else if (parts[1] === 'cube') {
                    return new THREE.BoxGeometry(0.2, 0.2, 0.2);
                }
                return new THREE.SphereGeometry(0.15, 6, 6);

            case 'ring':
                // Ring/torus for shockwaves and effects
                const ringThickness = parts[1] === 'thin' ? 0.08 : 
                                     parts[1] === 'thick' ? 0.2 : 0.1;
                return new THREE.TorusGeometry(0.5, ringThickness, 8, 24);

            case 'bullet':
                // Bullet/projectile shape
                if (parts[1] === 'sphere') {
                    return new THREE.SphereGeometry(0.15, 8, 8);
                } else if (parts[1] === 'cylinder') {
                    return new THREE.CylinderGeometry(0.08, 0.08, 0.6, 8);
                }
                return new THREE.SphereGeometry(0.15, 8, 8);

            case 'bomb':
                // Bomb/missile shape
                if (parts[1] === 'cylinder') {
                    return new THREE.CylinderGeometry(0.2, 0.15, 0.8, 8);
                } else if (parts[1] === 'sphere') {
                    return new THREE.SphereGeometry(0.3, 12, 12);
                }
                return new THREE.CylinderGeometry(0.2, 0.15, 0.8, 8);

            case 'invader':
                // Invader ship base shape (will be customized per type)
                if (parts[1] === 'squid') {
                    return this._createSquidGeometry();
                } else if (parts[1] === 'crab') {
                    return this._createCrabGeometry();
                } else if (parts[1] === 'octopus') {
                    return this._createOctopusGeometry();
                }
                return this._createDefaultInvaderGeometry();

            case 'player':
                // Player ship shape
                if (parts[1] === 'ship') {
                    return this._createPlayerShipGeometry();
                }
                return this._createPlayerShipGeometry();

            case 'shield':
                // Shield energy dome
                return new THREE.SphereGeometry(1.5, 16, 8);

            case 'ufo':
                // UFO bonus ship
                return this._createUFOGeometry();

            case 'powerup':
                // Power-up collectible
                if (parts[1] === 'spread') {
                    return new THREE.OctahedronGeometry(0.3);
                } else if (parts[1] === 'shield') {
                    return new THREE.IcosahedronGeometry(0.3, 0);
                } else if (parts[1] === 'rapid') {
                    return new THREE.TetrahedronGeometry(0.3);
                } else if (parts[1] === 'health') {
                    return new THREE.SphereGeometry(0.25, 8, 8);
                }
                return new THREE.OctahedronGeometry(0.3);

            default:
                console.warn(`GeometryPool._createGeometryFromKey: Unknown type "${type}"`);
                return null;
        }
    }

    /**
     * Create player ship geometry (triangle fuselage)
     */
    _createPlayerShipGeometry() {
        const geometry = new THREE.BufferGeometry();
        
        // Triangle-based ship shape
        const vertices = new Float32Array([
            // Top point
            0, 0.8, 0,
            // Bottom left
            -0.6, -0.4, 0,
            // Bottom right
            0.6, -0.4, 0,
            // Center (for engine detail)
            0, -0.2, 0.15,
        ]);

        const indices = [
            0, 1, 2,  // Main triangle
            0, 3, 1,  // Left side with depth
            0, 2, 3,  // Right side with depth
            1, 3, 2   // Bottom with depth
        ];

        geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
        geometry.setIndex(indices);
        geometry.computeVertexNormals();
        
        return geometry;
    }

    /**
     * Create squid invader geometry (top row)
     */
    _createSquidGeometry() {
        const geometry = new THREE.BoxGeometry(1.2, 0.8, 0.6);
        
        // Add some detail by creating a more complex shape
        const positions = geometry.attributes.position;
        const count = positions.count;
        
        // Modify vertices to create squid-like shape
        for (let i = 0; i < count; i++) {
            const y = positions.getY(i);
            if (y > 0) {
                // Narrow the top
                positions.setX(i, positions.getX(i) * 0.7);
                positions.setZ(i, positions.getZ(i) * 0.8);
            }
        }
        
        geometry.attributes.position.needsUpdate = true;
        geometry.computeVertexNormals();
        
        return geometry;
    }

    /**
     * Create crab invader geometry (middle rows)
     */
    _createCrabGeometry() {
        const geometry = new THREE.BoxGeometry(1.4, 0.9, 0.7);
        
        // Crab has wider body with "claws" on sides
        const positions = geometry.attributes.position;
        const count = positions.count;
        
        for (let i = 0; i < count; i++) {
            const x = positions.getX(i);
            const y = positions.getY(i);
            
            // Extend sides at mid-height for claws
            if (Math.abs(y) < 0.3 && Math.abs(x) > 0.5) {
                positions.setX(i, x * 1.2);
            }
        }
        
        geometry.attributes.position.needsUpdate = true;
        geometry.computeVertexNormals();
        
        return geometry;
    }

    /**
     * Create octopus invader geometry (bottom row)
     */
    _createOctopusGeometry() {
        const geometry = new THREE.BoxGeometry(1.0, 0.7, 0.5);
        
        // Octopus is more compact with tentacles suggestion
        const positions = geometry.attributes.position;
        const count = positions.count;
        
        for (let i = 0; i < count; i++) {
            const y = positions.getY(i);
            
            // Widen the bottom slightly
            if (y < -0.2) {
                positions.setX(i, positions.getX(i) * 1.15);
                positions.setZ(i, positions.getZ(i) * 1.1);
            }
        }
        
        geometry.attributes.position.needsUpdate = true;
        geometry.computeVertexNormals();
        
        return geometry;
    }

    /**
     * Create default invader geometry (fallback)
     */
    _createDefaultInvaderGeometry() {
        return new THREE.BoxGeometry(1.2, 0.8, 0.6);
    }

    /**
     * Create UFO bonus ship geometry
     */
    _createUFOGeometry() {
        const group = new THREE.Group();
        
        // Main saucer body
        const saucerGeo = new THREE.CylinderGeometry(1.5, 1.2, 0.3, 16);
        const saucerMesh = new THREE.Mesh(saucerGeo);
        group.add(saucerMesh);
        
        // Dome on top
        const domeGeo = new THREE.SphereGeometry(0.8, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2);
        const domeMesh = new THREE.Mesh(domeGeo);
        domeMesh.position.y = 0.3;
        group.add(domeMesh);
        
        // Convert to single geometry for efficiency
        return THREE.BufferGeometryUtils ? 
            THREE.BufferGeometryUtils.mergeGeometries([saucerGeo, domeGeo]) : 
            saucerGeo;
    }
}

// Create and export singleton instance
export const geometryPool = new GeometryPool();
