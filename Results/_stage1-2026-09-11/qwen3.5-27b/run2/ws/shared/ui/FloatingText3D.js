/**
 * FloatingText3D - Dynamic 3D score/damage text sprites
 * Creates rising, fading text that floats upward from spawn position
 */

import * as THREE from 'three';

export class FloatingText3D {
    constructor(text, position, options = {}) {
        this.text = text;
        this.position = position.clone();
        
        const {
            color = 0xffff00,
            size = 24,
            lifetime = 1.5,
            riseSpeed = 0.15,
            fontSize = 32,
            fontWeight = 'bold',
            fontFamily = 'Arial'
        } = options;

        this.lifetime = lifetime;
        this.riseSpeed = riseSpeed;
        this.age = 0;
        this.active = true;

        // Create canvas for text rendering
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = 256;
        canvas.height = 128;

        // Clear with transparency
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Style the text
        ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
        ctx.fillStyle = this.hexToRgbString(color);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        // Add glow effect via shadow
        ctx.shadowColor = this.hexToRgbString(color);
        ctx.shadowBlur = 10;
        
        // Draw text centered
        ctx.fillText(text, canvas.width / 2, canvas.height / 2);

        // Create texture and material
        const texture = new THREE.CanvasTexture(canvas);
        texture.needsUpdate = true;

        this.material = new THREE.SpriteMaterial({
            map: texture,
            transparent: true,
            opacity: 1.0,
            depthWrite: false,
            blending: THREE.AdditiveBlending
        });

        // Create sprite mesh
        this.sprite = new THREE.Sprite(this.material);
        this.sprite.position.copy(position);
        this.sprite.scale.set(3, 1.5, 1);

        // Store original color for potential modifications
        this.originalColor = color;
    }

    hexToRgbString(hex) {
        const h = parseInt(hex.toString(16), 16);
        const r = (h >> 16) & 255;
        const g = (h >> 8) & 255;
        const b = h & 255;
        return `rgb(${r}, ${g}, ${b})`;
    }

    update(deltaTime) {
        if (!this.active) return false;

        this.age += deltaTime;

        // Rise upward
        this.sprite.position.y += this.riseSpeed * (deltaTime * 60);

        // Fade out based on lifetime progress
        const progress = this.age / this.lifetime;
        
        // Ease out for fade - stay visible longer, then fade quickly at end
        let opacity = 1.0;
        if (progress > 0.7) {
            opacity = 1.0 - ((progress - 0.7) / 0.3);
        }

        this.material.opacity = Math.max(0, opacity);

        // Scale up slightly then down at end
        const scaleProgress = progress * Math.PI;
        const scaleMultiplier = 1 + Math.sin(scaleProgress) * 0.2;
        this.sprite.scale.set(3 * scaleMultiplier, 1.5 * scaleMultiplier, 1);

        // Check if expired
        if (this.age >= this.lifetime || this.material.opacity <= 0.01) {
            this.active = false;
            return false;
        }

        return true;
    }

    dispose() {
        this.active = false;
        
        if (this.sprite) {
            if (this.material.map) {
                this.material.map.dispose();
            }
            this.material.dispose();
            this.sprite = null;
        }
    }

    getMesh() {
        return this.sprite;
    }

    setColor(color) {
        this.originalColor = color;
        
        // Update canvas texture
        const canvas = this.material.map.image;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.font = 'bold 32px Arial';
        ctx.fillStyle = this.hexToRgbString(color);
        ctx.shadowColor = this.hexToRgbString(color);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.text, canvas.width / 2, canvas.height / 2);
        
        this.material.map.needsUpdate = true;
    }

    setText(text) {
        this.text = text;
        
        // Update canvas texture
        const canvas = this.material.map.image;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.font = 'bold 32px Arial';
        ctx.fillStyle = this.hexToRgbString(this.originalColor);
        ctx.shadowColor = this.hexToRgbString(this.originalColor);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, canvas.width / 2, canvas.height / 2);
        
        this.material.map.needsUpdate = true;
    }
}

/**
 * FloatingTextPool - Object pool for floating text instances
 */
export class FloatingTextPool {
    constructor(maxCapacity = 30) {
        this.maxCapacity = maxCapacity;
        this.pool = [];
        this.active = [];
        
        // Pre-warm the pool
        for (let i = 0; i < maxCapacity; i++) {
            const dummyPosition = new THREE.Vector3(0, 0, 0);
            this.pool.push(new FloatingText3D('', dummyPosition));
        }
    }

    acquire(text, position, options = {}) {
        // If pool is empty and at capacity, remove oldest active text
        if (this.active.length >= this.maxCapacity && this.pool.length === 0) {
            const oldest = this.active.shift();
            oldest.dispose();
            this.pool.push(oldest);
        }

        if (this.pool.length > 0) {
            const instance = this.pool.pop();
            
            // Reset the instance with new data
            instance.text = text;
            instance.position.copy(position);
            instance.lifetime = options.lifetime || 1.5;
            instance.riseSpeed = options.riseSpeed || 0.15;
            instance.age = 0;
            instance.active = true;

            // Update the sprite position and color
            instance.sprite.position.copy(position);
            
            if (options.color) {
                instance.setColor(options.color);
            } else {
                instance.setColor(0xffff00);
            }

            this.active.push(instance);
            return instance;
        }

        // Fallback: create new if somehow pool exhausted
        return new FloatingText3D(text, position, options);
    }

    release(instance) {
        const index = this.active.indexOf(instance);
        if (index > -1) {
            this.active.splice(index, 1);
            
            // Reset instance state
            instance.age = instance.lifetime; // Mark as expired
            instance.sprite.position.set(0, -100, 0); // Move off-screen
            
            this.pool.push(instance);
        }
    }

    update(deltaTime) {
        for (let i = this.active.length - 1; i >= 0; i--) {
            const text = this.active[i];
            
            if (!text.update(deltaTime)) {
                // Text expired, release it
                this.release(text);
            }
        }
    }

    getActiveMeshes() {
        return this.active.map(t => t.getMesh());
    }

    clearAll() {
        for (const text of this.active) {
            text.dispose();
            this.pool.push(text);
        }
        this.active = [];
    }

    dispose() {
        this.clearAll();
        for (const text of this.pool) {
            text.dispose();
        }
        this.pool = [];
    }
}
