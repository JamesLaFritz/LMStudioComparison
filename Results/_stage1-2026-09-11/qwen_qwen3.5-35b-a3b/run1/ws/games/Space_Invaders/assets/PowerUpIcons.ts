import { MathUtils } from '../../../shared/utils/MathUtils.js';

export class PowerUpIconGenerator {
  private static readonly ICON_COLORS: number[] = [0xff00ff, 0x00ffff, 0xffff00]; // Magenta, Cyan, Yellow
  
  /**
   * Generate canvas texture for power-up icons based on type
   */
  static generatePowerUpIcon(type: 'rapid' | 'spread' | 'shield'): HTMLCanvasElement {
    const size = 64;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    
    // Clear background with transparency
    ctx.clearRect(0, 0, size, size);
    
    const color = this.ICON_COLORS[type === 'rapid' ? 0 : type === 'spread' ? 1 : 2];
    const centerX = size / 2;
    const centerY = size / 2;
    
    // Draw outer glow ring
    ctx.beginPath();
    ctx.arc(centerX, centerY, 28, 0, Math.PI * 2);
    ctx.strokeStyle = `#${this.hexToRgbString(color).padStart(6, '0')}`;
    ctx.lineWidth = 3;
    ctx.stroke();
    
    // Draw inner glow
    const gradient = ctx.createRadialGradient(centerX, centerY, 10, centerX, centerY, 25);
    gradient.addColorStop(0, `rgba(${this.hexToRgb(color)}, 0.8)`);
    gradient.addColorStop(1, `rgba(${this.hexToRgb(color)}, 0.2)`);
    
    ctx.beginPath();
    ctx.arc(centerX, centerY, 25, 0, Math.PI * 2);
    ctx.fillStyle = gradient;
    ctx.fill();
    
    // Draw specific icon shape based on type
    ctx.fillStyle = '#ffffff';
    
    switch (type) {
      case 'rapid':
        // Lightning bolt shape for rapid fire
        this.drawLightningBolt(ctx, centerX, centerY);
        break;
        
      case 'spread':
        // Three-pronged star for spread shot
        this.drawSpreadStar(ctx, centerX, centerY);
        break;
        
      case 'shield':
        // Shield shape for protection
        this.drawShieldIcon(ctx, centerX, centerY);
        break;
    }
    
    return canvas;
  }
  
  private static drawLightningBolt(ctx: CanvasRenderingContext2D, x: number, y: number): void {
    ctx.beginPath();
    ctx.moveTo(x - 8, y - 10);
    ctx.lineTo(x + 6, y - 3);
    ctx.lineTo(x - 4, y + 2);
    ctx.lineTo(x + 8, y + 8);
    ctx.lineTo(x - 6, y + 5);
    ctx.closePath();
    ctx.fill();
  }
  
  private static drawSpreadStar(ctx: CanvasRenderingContext2D, x: number, y: number): void {
    const points = [
      { dx: 0, dy: -12 },
      { dx: 10, dy: -4 },
      { dx: 8, dy: 6 },
      { dx: -8, dy: 6 },
      { dx: -10, dy: -4 }
    ];
    
    ctx.beginPath();
    ctx.moveTo(x + points[0].dx, y + points[0].dy);
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(x + points[i].dx, y + points[i].dy);
    }
    ctx.closePath();
    ctx.fill();
    
    // Add center dot
    ctx.beginPath();
    ctx.arc(x, y, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  
  private static drawShieldIcon(ctx: CanvasRenderingContext2D, x: number, y: number): void {
    const width = 16;
    const height = 20;
    
    ctx.beginPath();
    ctx.moveTo(x - width/2, y - height/2);
    ctx.lineTo(x + width/2, y - height/2);
    ctx.lineTo(x + width/2, y + height/4);
    ctx.quadraticCurveTo(x, y + height/2, x - width/2, y + height/4);
    ctx.closePath();
    ctx.fill();
    
    // Add shield border
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
  
  private static hexToRgbString(hex: number): string {
    return (hex & 0xFF0000).toString(16).padStart(6, '0') + 
           (hex & 0x00FF00).toString(16).padStart(4, '0') + 
           (hex & 0x0000FF).toString(16).padStart(2, '0');
  }
  
  private static hexToRgb(hex: number): string {
    const r = (hex >> 16) & 0xFF;
    const g = (hex >> 8) & 0xFF;
    const b = hex & 0xFF;
    return `${r}, ${g}, ${b}`;
  }
  
  /**
   * Generate a rotating power-up mesh for the game world
   */
  static createPowerUpMesh(type: 'rapid' | 'spread' | 'shield'): THREE.Mesh {
    const texture = this.generatePowerUpIcon(type);
    const material = new THREE.SpriteMaterial({
      map: new THREE.CanvasTexture(texture),
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthTest: false,
      depthWrite: false
    });
    
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(2, 2, 1);
    
    return sprite;
  }
  
  /**
   * Get power-up type from color
   */
  static getPowerUpTypeFromColor(color: number): 'rapid' | 'spread' | 'shield' {
    if (color === this.ICON_COLORS[0]) return 'rapid';
    if (color === this.ICON_COLORS[1]) return 'spread';
    if (color === this.ICON_COLORS[2]) return 'shield';
    return 'rapid'; // default
  }
}
