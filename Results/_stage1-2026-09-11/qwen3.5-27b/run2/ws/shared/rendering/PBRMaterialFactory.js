/**
 * PBR Material Factory
 * Creates and manages MeshStandardMaterial presets for AAA Retro-Futurism aesthetic
 */

import * as THREE from 'three';

class PBRMaterialFactory {
    constructor() {
        this.materialCache = new Map();
        this.defaultMetalness = 0.4;
        this.defaultRoughness = 0.3;
    }

    /**
     * Create a neon emissive material for glowing objects
     */
    createNeonMaterial(color, emissiveIntensity = 1.5) {
        const key = `neon_${color}_${emissiveIntensity}`;
        if (this.materialCache.has(key)) {
            return this.materialCache.get(key).clone();
        }

        const material = new THREE.MeshStandardMaterial({
            color: 0x111111,
            emissive: new THREE.Color(color),
            emissiveIntensity: emissiveIntensity,
            metalness: this.defaultMetalness,
            roughness: this.defaultRoughness,
            envMapIntensity: 1.0
        });

        this.materialCache.set(key, material);
        return material.clone();
    }

    /**
     * Create a metallic sci-fi material for ships and structures
     */
    createMetallicMaterial(baseColor, metalness = 0.7, roughness = 0.2) {
        const key = `metal_${baseColor}_${metalness}_${roughness}`;
        if (this.materialCache.has(key)) {
            return this.materialCache.get(key).clone();
        }

        const material = new THREE.MeshStandardMaterial({
            color: baseColor,
            metalness: metalness,
            roughness: roughness,
            envMapIntensity: 1.2
        });

        this.materialCache.set(key, material);
        return material.clone();
    }

    /**
     * Create a transparent glass/plasma material for shields and energy effects
     */
    createGlassMaterial(color, opacity = 0.3, transmission = 0.5) {
        const key = `glass_${color}_${opacity}_${transmission}`;
        if (this.materialCache.has(key)) {
            return this.materialCache.get(key).clone();
        }

        const material = new THREE.MeshStandardMaterial({
            color: color,
            transparent: true,
            opacity: opacity,
            metalness: 0.1,
            roughness: 0.05,
            transmission: transmission,
            thickness: 1.0,
            envMapIntensity: 1.5
        });

        this.materialCache.set(key, material);
        return material.clone();
    }

    /**
     * Create a particle material for VFX
     */
    createParticleMaterial(color, additiveBlending = true) {
        const key = `particle_${color}_${additiveBlending}`;
        if (this.materialCache.has(key)) {
            return this.materialCache.get(key).clone();
        }

        const material = new THREE.MeshStandardMaterial({
            color: color,
            emissive: color,
            emissiveIntensity: 2.0,
            transparent: true,
            opacity: 1.0,
            depthWrite: false,
            blending: additiveBlending ? THREE.AdditiveBlending : THREE.NormalBlending,
            side: THREE.DoubleSide
        });

        this.materialCache.set(key, material);
        return material.clone();
    }

    /**
     * Create a shockwave ring material with strong emissive glow
     */
    createShockwaveMaterial(color = 0x00ffff) {
        const key = `shockwave_${color}`;
        if (this.materialCache.has(key)) {
            return this.materialCache.get(key).clone();
        }

        const material = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            emissive: color,
            emissiveIntensity: 3.0,
            transparent: true,
            opacity: 1.0,
            side: THREE.DoubleSide,
            depthWrite: false
        });

        this.materialCache.set(key, material);
        return material.clone();
    }

    /**
     * Create a trail ribbon material for motion trails
     */
    createTrailMaterial(color) {
        const key = `trail_${color}`;
        if (this.materialCache.has(key)) {
            return this.materialCache.get(key).clone();
        }

        const material = new THREE.MeshStandardMaterial({
            color: color,
            emissive: color,
            emissiveIntensity: 1.0,
            transparent: true,
            opacity: 0.8,
            depthWrite: false,
            side: THREE.DoubleSide
        });

        this.materialCache.set(key, material);
        return material.clone();
    }

    /**
     * Create a sprite material for floating text and UI elements
     */
    createSpriteMaterial(texture) {
        const material = new THREE.SpriteMaterial({
            map: texture,
            transparent: true,
            depthWrite: false,
            blending: THREE.NormalBlending
        });
        return material;
    }

    /**
     * Create a starfield point material
     */
    createStarMaterial(color = 0xffffff) {
        const key = `star_${color}`;
        if (this.materialCache.has(key)) {
            return this.materialCache.get(key).clone();
        }

        const material = new THREE.PointsMaterial({
            color: color,
            size: 0.1,
            transparent: true,
            opacity: 0.8,
            depthWrite: false
        });

        this.materialCache.set(key, material);
        return material.clone();
    }

    /**
     * Create a power-up collectible material with pulsing effect capability
     */
    createPowerUpMaterial(baseColor) {
        const key = `powerup_${baseColor}`;
        if (this.materialCache.has(key)) {
            return this.materialCache.get(key).clone();
        }

        const material = new THREE.MeshStandardMaterial({
            color: baseColor,
            emissive: baseColor,
            emissiveIntensity: 2.0,
            metalness: 0.5,
            roughness: 0.1,
            envMapIntensity: 1.5
        });

        this.materialCache.set(key, material);
        return material.clone();
    }

    /**
     * Create a UFO special material with unique properties
     */
    createUFOMaterial() {
        const key = `ufo`;
        if (this.materialCache.has(key)) {
            return this.materialCache.get(key).clone();
        }

        const material = new THREE.MeshStandardMaterial({
            color: 0xff3366,
            emissive: 0xff0044,
            emissiveIntensity: 1.8,
            metalness: 0.8,
            roughness: 0.15,
            envMapIntensity: 1.3
        });

        this.materialCache.set(key, material);
        return material.clone();
    }

    /**
     * Create a bullet laser material for player projectiles
     */
    createBulletMaterial() {
        const key = 'bullet';
        if (this.materialCache.has(key)) {
            return this.materialCache.get(key).clone();
        }

        const material = new THREE.MeshStandardMaterial({
            color: 0x00ffff,
            emissive: 0x00ffff,
            emissiveIntensity: 2.5,
            metalness: 0.3,
            roughness: 0.1,
            transparent: true,
            opacity: 1.0
        });

        this.materialCache.set(key, material);
        return material.clone();
    }

    /**
     * Create a bomb material for enemy projectiles
     */
    createBombMaterial() {
        const key = 'bomb';
        if (this.materialCache.has(key)) {
            return this.materialCache.get(key).clone();
        }

        const material = new THREE.MeshStandardMaterial({
            color: 0xff3366,
            emissive: 0xff0044,
            emissiveIntensity: 2.0,
            metalness: 0.5,
            roughness: 0.2
        });

        this.materialCache.set(key, material);
        return material.clone();
    }

    /**
     * Create a player ship material with cyan glow
     */
    createPlayerMaterial() {
        const key = 'player';
        if (this.materialCache.has(key)) {
            return this.materialCache.get(key).clone();
        }

        const material = new THREE.MeshStandardMaterial({
            color: 0x0088ff,
            emissive: 0x00ffff,
            emissiveIntensity: 1.5,
            metalness: 0.6,
            roughness: 0.25
        });

        this.materialCache.set(key, material);
        return material.clone();
    }

    /**
     * Create invader materials by type
     */
    createInvaderMaterial(type) {
        const colors = {
            squid: { base: 0xff6b9d, emissive: 0xff3377 },
            crab: { base: 0x4ecdc4, emissive: 0x2eb8a8 },
            octopus: { base: 0xffe66d, emissive: 0xffcc33 }
        };

        const colorInfo = colors[type] || colors.octopus;
        const key = `invader_${type}`;
        
        if (this.materialCache.has(key)) {
            return this.materialCache.get(key).clone();
        }

        const material = new THREE.MeshStandardMaterial({
            color: colorInfo.base,
            emissive: colorInfo.emissive,
            emissiveIntensity: 1.2,
            metalness: 0.4,
            roughness: 0.35
        });

        this.materialCache.set(key, material);
        return material.clone();
    }

    /**
     * Create a UFO material with pink/purple glow
     */
    createUFOMaterial() {
        const key = 'ufo';
        if (this.materialCache.has(key)) {
            return this.materialCache.get(key).clone();
        }

        const material = new THREE.MeshStandardMaterial({
            color: 0xff3366,
            emissive: 0xff00aa,
            emissiveIntensity: 2.0,
            metalness: 0.7,
            roughness: 0.15
        });

        this.materialCache.set(key, material);
        return material.clone();
    }

    /**
     * Create a power-up material by type
     */
    createPowerUpMaterial(type) {
        const colors = {
            spread: 0x00ff00,
            rapid: 0xffff00,
            shield: 0x0088ff
        };

        const color = colors[type] || 0xffffff;
        const key = `powerup_${type}`;
        
        if (this.materialCache.has(key)) {
            return this.materialCache.get(key).clone();
        }

        const material = new THREE.MeshStandardMaterial({
            color: color,
            emissive: color,
            emissiveIntensity: 2.5,
            metalness: 0.3,
            roughness: 0.1
        });

        this.materialCache.set(key, material);
        return material.clone();
    }

    /**
     * Create a neon glow material (alias for createNeonMaterial)
     */
    createNeonGlowMaterial(color, emissiveIntensity = 1.5) {
        return this.createNeonMaterial(color, emissiveIntensity);
    }

    /**
     * Create an energy shield material with glass-like properties
     */
    createEnergyShieldMaterial() {
        const key = 'energy_shield';
        if (this.materialCache.has(key)) {
            return this.materialCache.get(key).clone();
        }

        const material = new THREE.MeshStandardMaterial({
            color: 0x00ffff,
            emissive: 0x0088ff,
            emissiveIntensity: 1.5,
            transparent: true,
            opacity: 0.6,
            metalness: 0.2,
            roughness: 0.05,
            transmission: 0.7,
            thickness: 1.0,
            side: THREE.DoubleSide
        });

        this.materialCache.set(key, material);
        return material.clone();
    }

    /**
     * Dispose all cached materials (call on game shutdown)
     */
    disposeAll() {
        for (const [, material] of this.materialCache) {
            material.dispose();
        }
        this.materialCache.clear();
    }
}

export { PBRMaterialFactory };
export default PBRMaterialFactory;
