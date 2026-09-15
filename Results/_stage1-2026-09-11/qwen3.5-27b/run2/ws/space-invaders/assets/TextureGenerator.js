// Texture Generator for Space Invaders - Procedural Canvas-based Textures
import * as THREE from 'three';

export class TextureGenerator {
    constructor() {
        this.textures = {};
        this.init();
    }

    init() {
        // Generate all textures on initialization
        this.textures.playerShip = this.createPlayerShipTexture();
        this.textures.invaderSquid = this.createInvaderTexture('squid');
        this.textures.invaderCrab = this.createInvaderTexture('crab');
        this.textures.invaderOctopus = this.createInvaderTexture('octopus');
        this.textures.ufo = this.createUFOTexture();
        this.textures.powerUpSpread = this.createPowerUpTexture('spread', '#FF6B9D');
        this.textures.powerUpShield = this.createPowerUpTexture('shield', '#4ECDC4');
        this.textures.powerUpRapid = this.createPowerUpTexture('rapid', '#FFE66D');
        this.textures.bullet = this.createBulletTexture();
        this.textures.bomb = this.createBombTexture();
    }

    createPlayerShipTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 128;
        canvas.height = 128;
        const ctx = canvas.getContext('2d');

        // Transparent background
        ctx.clearRect(0, 0, 128, 128);

        // Ship body - triangle fuselage with neon cyan glow
        ctx.save();
        
        // Outer glow
        ctx.shadowColor = '#00ffff';
        ctx.shadowBlur = 20;
        
        // Main ship body (triangle pointing up)
        ctx.beginPath();
        ctx.moveTo(64, 16);   // Top center
        ctx.lineTo(96, 96);   // Bottom right
        ctx.lineTo(32, 96);   // Bottom left
        ctx.closePath();
        ctx.fillStyle = '#0088aa';
        ctx.fill();

        // Cockpit (center detail)
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.ellipse(64, 56, 8, 12, 0, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();

        // Engine glow at bottom
        ctx.shadowColor = '#ff6b9d';
        ctx.shadowBlur = 15;
        ctx.beginPath();
        ctx.moveTo(48, 96);
        ctx.lineTo(64, 108);
        ctx.lineTo(80, 96);
        ctx.fillStyle = '#ff6b9d';
        ctx.fill();

        // Side thrusters
        ctx.beginPath();
        ctx.moveTo(32, 88);
        ctx.lineTo(24, 100);
        ctx.lineTo(36, 96);
        ctx.fillStyle = '#00ffff';
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(96, 88);
        ctx.lineTo(104, 100);
        ctx.lineTo(92, 96);
        ctx.fillStyle = '#00ffff';
        ctx.fill();

        ctx.restore();

        const texture = new THREE.CanvasTexture(canvas);
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.NearestFilter;
        return texture;
    }

    createInvaderTexture(type) {
        const canvas = document.createElement('canvas');
        canvas.width = 128;
        canvas.height = 128;
        const ctx = canvas.getContext('2d');

        ctx.clearRect(0, 0, 128, 128);
        ctx.save();

        let color, glowColor;
        
        if (type === 'squid') {
            color = '#FF6B9D';
            glowColor = '#ff4477';
        } else if (type === 'crab') {
            color = '#4ECDC4';
            glowColor = '#33aabb';
        } else { // octopus
            color = '#FFE66D';
            glowColor = '#ccaa00';
        }

        ctx.shadowColor = glowColor;
        ctx.shadowBlur = 15;

        if (type === 'squid') {
            // Squid invader - tall, with tentacles
            this.drawSquid(ctx, color);
        } else if (type === 'crab') {
            // Crab invader - wide, with claws
            this.drawCrab(ctx, color);
        } else {
            // Octopus invader - round, with waving tentacles
            this.drawOctopus(ctx, color);
        }

        ctx.restore();

        const texture = new THREE.CanvasTexture(canvas);
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.NearestFilter;
        return texture;
    }

    drawSquid(ctx, color) {
        // Main body (oval)
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.ellipse(64, 50, 28, 22, 0, 0, Math.PI * 2);
        ctx.fill();

        // Eyes
        ctx.fillStyle = '#000000';
        ctx.beginPath();
        ctx.arc(52, 46, 4, 0, Math.PI * 2);
        ctx.arc(76, 46, 4, 0, Math.PI * 2);
        ctx.fill();

        // Eye highlights
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(50, 44, 2, 0, Math.PI * 2);
        ctx.arc(74, 44, 2, 0, Math.PI * 2);
        ctx.fill();

        // Tentacles (bottom)
        ctx.strokeStyle = color;
        ctx.lineWidth = 6;
        ctx.lineCap = 'round';
        
        for (let i = -3; i <= 3; i++) {
            ctx.beginPath();
            ctx.moveTo(40 + i * 12, 72);
            ctx.lineTo(40 + i * 12 + Math.sin(i) * 8, 96);
            ctx.stroke();
        }

        // Arms (top sides)
        ctx.beginPath();
        ctx.moveTo(36, 50);
        ctx.quadraticCurveTo(16, 40, 20, 28);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(92, 50);
        ctx.quadraticCurveTo(112, 40, 108, 28);
        ctx.stroke();
    }

    drawCrab(ctx, color) {
        // Main body (wider rectangle with rounded corners)
        ctx.fillStyle = color;
        this.roundRect(ctx, 32, 40, 64, 36, 8);
        ctx.fill();

        // Eyes on stalks
        ctx.strokeStyle = color;
        ctx.lineWidth = 5;
        
        ctx.beginPath();
        ctx.moveTo(44, 40);
        ctx.lineTo(36, 24);
        ctx.stroke();
        
        ctx.beginPath();
        ctx.moveTo(84, 40);
        ctx.lineTo(92, 24);
        ctx.stroke();

        // Eye balls
        ctx.fillStyle = '#000000';
        ctx.beginPath();
        ctx.arc(36, 24, 5, 0, Math.PI * 2);
        ctx.arc(92, 24, 5, 0, Math.PI * 2);
        ctx.fill();

        // Eye highlights
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(34, 22, 2, 0, Math.PI * 2);
        ctx.arc(90, 22, 2, 0, Math.PI * 2);
        ctx.fill();

        // Claws (sides)
        ctx.strokeStyle = color;
        ctx.lineWidth = 8;
        
        ctx.beginPath();
        ctx.moveTo(32, 56);
        ctx.lineTo(12, 48);
        ctx.lineTo(8, 60);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(96, 56);
        ctx.lineTo(116, 48);
        ctx.lineTo(120, 60);
        ctx.stroke();

        // Legs (bottom)
        ctx.lineWidth = 4;
        for (let i = 0; i < 4; i++) {
            ctx.beginPath();
            ctx.moveTo(36 + i * 18, 76);
            ctx.lineTo(28 + i * 18, 92);
            ctx.stroke();
        }
    }

    drawOctopus(ctx, color) {
        // Main body (circle)
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(64, 52, 30, 0, Math.PI * 2);
        ctx.fill();

        // Eyes
        ctx.fillStyle = '#000000';
        ctx.beginPath();
        ctx.ellipse(54, 48, 5, 6, -0.3, 0, Math.PI * 2);
        ctx.ellipse(74, 48, 5, 6, 0.3, 0, Math.PI * 2);
        ctx.fill();

        // Eye highlights
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(52, 46, 2, 0, Math.PI * 2);
        ctx.arc(76, 46, 2, 0, Math.PI * 2);
        ctx.fill();

        // Mouth (smile)
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(64, 58, 8, 0.2, Math.PI - 0.2);
        ctx.stroke();

        // Tentacles (wavy bottom)
        ctx.strokeStyle = color;
        ctx.lineWidth = 7;
        ctx.lineCap = 'round';
        
        const tentacleOffsets = [-45, -30, -15, 0, 15, 30, 45];
        tentacleOffsets.forEach((offset, i) => {
            ctx.beginPath();
            ctx.moveTo(64 + offset * 0.5, 78);
            const wave = Math.sin(i * 0.8) * 10;
            ctx.quadraticCurveTo(64 + offset * 0.3 + wave, 92, 64 + offset * 0.2 + wave * 1.5, 104);
            ctx.stroke();
        });
    }

    roundRect(ctx, x, y, width, height, radius) {
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + width - radius, y);
        ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
        ctx.lineTo(x + width, y + height - radius);
        ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
        ctx.lineTo(x + radius, y + height);
        ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);
        ctx.closePath();
    }

    createUFOTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 128;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');

        ctx.clearRect(0, 0, 128, 64);
        ctx.save();

        // UFO glow effect
        ctx.shadowColor = '#ff44ff';
        ctx.shadowBlur = 25;

        // Main saucer body (ellipse)
        const gradient = ctx.createLinearGradient(64, 10, 64, 50);
        gradient.addColorStop(0, '#cc33cc');
        gradient.addColorStop(0.5, '#ff66ff');
        gradient.addColorStop(1, '#990099');

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.ellipse(64, 32, 48, 18, 0, 0, Math.PI * 2);
        ctx.fill();

        // Dome on top
        ctx.shadowColor = '#ffffff';
        ctx.shadowBlur = 15;
        ctx.fillStyle = 'rgba(200, 255, 200, 0.8)';
        ctx.beginPath();
        ctx.arc(64, 22, 14, Math.PI, 0);
        ctx.fill();

        // Dome highlight
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.beginPath();
        ctx.arc(60, 18, 4, 0, Math.PI * 2);
        ctx.fill();

        // Bottom lights (thrusters)
        ctx.shadowColor = '#ff00ff';
        ctx.shadowBlur = 10;
        
        for (let i = -3; i <= 3; i++) {
            const x = 40 + i * 16;
            ctx.fillStyle = i % 2 === 0 ? '#ff00ff' : '#ffff00';
            ctx.beginPath();
            ctx.arc(x, 48, 4, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.restore();

        const texture = new THREE.CanvasTexture(canvas);
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.NearestFilter;
        return texture;
    }

    createPowerUpTexture(type, color) {
        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');

        ctx.clearRect(0, 0, 64, 64);
        ctx.save();

        // Outer glow ring
        ctx.shadowColor = color;
        ctx.shadowBlur = 20;
        
        // Main orb
        const gradient = ctx.createRadialGradient(32, 32, 4, 32, 32, 28);
        gradient.addColorStop(0, '#ffffff');
        gradient.addColorStop(0.3, color);
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(32, 32, 28, 0, Math.PI * 2);
        ctx.fill();

        // Inner symbol
        ctx.shadowBlur = 10;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        if (type === 'spread') {
            // Fan/triple shot symbol
            ctx.beginPath();
            ctx.moveTo(32, 16);
            ctx.lineTo(32, 48);
            ctx.stroke();
            
            ctx.beginPath();
            ctx.moveTo(32, 20);
            ctx.lineTo(20, 40);
            ctx.stroke();
            
            ctx.beginPath();
            ctx.moveTo(32, 20);
            ctx.lineTo(44, 40);
            ctx.stroke();
        } else if (type === 'shield') {
            // Shield symbol (circle with vertical line)
            ctx.beginPath();
            ctx.arc(32, 32, 16, 0, Math.PI * 2);
            ctx.stroke();
            
            ctx.beginPath();
            ctx.moveTo(32, 18);
            ctx.lineTo(32, 46);
            ctx.stroke();
        } else { // rapid
            // Lightning bolt symbol
            ctx.beginPath();
            ctx.moveTo(32, 16);
            ctx.lineTo(24, 30);
            ctx.lineTo(32, 30);
            ctx.lineTo(28, 48);
            ctx.lineTo(36, 32);
            ctx.lineTo(28, 32);
            ctx.lineTo(32, 16);
            ctx.stroke();
        }

        ctx.restore();

        const texture = new THREE.CanvasTexture(canvas);
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.NearestFilter;
        return texture;
    }

    createBulletTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 32;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');

        ctx.clearRect(0, 0, 32, 64);
        ctx.save();

        // Laser beam glow
        ctx.shadowColor = '#00ffff';
        ctx.shadowBlur = 15;

        // Main laser body (tall thin rectangle)
        const gradient = ctx.createLinearGradient(16, 0, 16, 64);
        gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
        gradient.addColorStop(0.3, '#00ffff');
        gradient.addColorStop(1, 'rgba(0, 200, 255, 0.8)');

        ctx.fillStyle = gradient;
        ctx.fillRect(10, 0, 12, 64);

        // Core (bright center line)
        ctx.shadowBlur = 5;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(13, 0, 6, 64);

        ctx.restore();

        const texture = new THREE.CanvasTexture(canvas);
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.NearestFilter;
        return texture;
    }

    createBombTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 32;
        canvas.height = 48;
        const ctx = canvas.getContext('2d');

        ctx.clearRect(0, 0, 32, 48);
        ctx.save();

        // Bomb glow (red/pink)
        ctx.shadowColor = '#ff6b9d';
        ctx.shadowBlur = 12;

        // Main bomb body
        const gradient = ctx.createLinearGradient(16, 0, 16, 48);
        gradient.addColorStop(0, '#ff6b9d');
        gradient.addColorStop(0.5, '#ff3366');
        gradient.addColorStop(1, '#cc0033');

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.moveTo(16, 0);
        ctx.lineTo(28, 24);
        ctx.lineTo(16, 48);
        ctx.lineTo(4, 24);
        ctx.closePath();
        ctx.fill();

        // Core glow
        ctx.shadowBlur = 5;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.moveTo(16, 4);
        ctx.lineTo(20, 24);
        ctx.lineTo(16, 44);
        ctx.lineTo(12, 24);
        ctx.closePath();
        ctx.fill();

        ctx.restore();

        const texture = new THREE.CanvasTexture(canvas);
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.NearestFilter;
        return texture;
    }

    // Getters for textures
    getPlayerShip() { return this.textures.playerShip; }
    getInvaderSquid() { return this.textures.invaderSquid; }
    getInvaderCrab() { return this.textures.invaderCrab; }
    getInvaderOctopus() { return this.textures.invaderOctopus; }
    getUFO() { return this.textures.ufo; }
    getPowerUpSpread() { return this.textures.powerUpSpread; }
    getPowerUpShield() { return this.textures.powerUpShield; }
    getPowerUpRapid() { return this.textures.powerUpRapid; }
    getBullet() { return this.textures.bullet; }
    getBomb() { return this.textures.bomb; }

    dispose() {
        Object.values(this.textures).forEach(texture => {
            texture.dispose();
        });
        this.textures = {};
    }
}

// Singleton instance
let textureGeneratorInstance = null;

export function getTextureGenerator() {
    if (!textureGeneratorInstance) {
        textureGeneratorInstance = new TextureGenerator();
    }
    return textureGeneratorInstance;
}

export default TextureGenerator;
