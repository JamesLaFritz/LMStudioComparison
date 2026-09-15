// Procedural texture generation using Canvas API
export class TextureGenerator {
    static createEnemyTexture(type) {
        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 64;
        
        const ctx = canvas.getContext('2d');
        
        switch(type) {
            case 'basic': this.drawBasicPattern(ctx); break;
            case 'medium': this.drawMediumPattern(ctx); break;
            case 'elite': this.drawElitePattern(ctx); break;
        }
        
        return new THREE.CanvasTexture(canvas);
    }
    
    static drawBasicPattern(ctx) {
        // Basic enemy pattern - simple geometric shapes
        ctx.fillStyle = '#ff0066';
        for (let i = 0; i < 8; i++) {
            for (let j = 0; j < 8; j++) {
                if ((i + j) % 2 === 0) {
                    ctx.fillRect(i * 8, j * 8, 8, 8);
                }
            }
        }
    }
    
    static drawMediumPattern(ctx) {
        // Medium enemy pattern - more complex design
        ctx.fillStyle = '#ff6600';
        for (let i = 0; i < 8; i++) {
            for (let j = 0; j < 8; j++) {
                if ((i * j) % 3 === 0 || Math.abs(i - j) > 4) {
                    ctx.fillRect(i * 8, j * 8, 8, 8);
                }
            }
        }
    }
    
    static drawElitePattern(ctx) {
        // Elite enemy pattern - intricate design
        ctx.fillStyle = '#ff00ff';
        for (let i = 0; i < 8; i++) {
            for (let j = 0; j < 8; j++) {
                if ((i * j) % 2 === 0 || Math.abs(i - j) > 3) {
                    ctx.fillRect(i * 8, j * 8, 8, 8);
                }
            }
        }
    }
    
    static createPlayerTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 64;
        
        const ctx = canvas.getContext('2d');
        
        // Player texture - sleek design with highlights
        ctx.fillStyle = '#00ffaa';
        for (let i = 0; i < 8; i++) {
            for (let j = 0; j < 8; j++) {
                if (i > 2 && i < 6) {
                    ctx.fillRect(i * 8, j * 8, 8, 8);
                }
            }
        }
        
        return new THREE.CanvasTexture(canvas);
    }
    
    static createBackgroundTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 256;
        
        const ctx = canvas.getContext('2d');
        
        // Starfield background with nebula effects
        ctx.fillStyle = '#0a0a1a';
        ctx.fillRect(0, 0, 256, 256);
        
        // Add stars
        for (let i = 0; i < 100; i++) {
            const x = Math.random() * 256;
            const y = Math.random() * 256;
            const size = Math.random() * 2 + 1;
            
            ctx.beginPath();
            ctx.arc(x, y, size, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255, ${Math.random() * 100}, 255, ${Math.random()})`;
            ctx.fill();
        }
        
        return new THREE.CanvasTexture(canvas);
    }
}
