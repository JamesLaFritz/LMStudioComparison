import { Texture, CanvasTexture } from 'three';

export class AlienSpriteGenerator {
  private static readonly ALIEN_TYPES = [
    // Type 0: Squid-like (top row)
    {
      name: 'squid',
      draw: (ctx: CanvasRenderingContext2D, width: number, height: number, time: number) => {
        const cx = width / 2;
        const cy = height / 2;
        
        // Body - main oval shape
        ctx.fillStyle = '#00ff88';
        ctx.beginPath();
        ctx.ellipse(cx, cy, width * 0.35, height * 0.4, 0, 0, Math.PI * 2);
        ctx.fill();
        
        // Head - top section
        ctx.fillStyle = '#00cc66';
        ctx.beginPath();
        ctx.arc(cx, cy - height * 0.35, width * 0.25, 0, Math.PI * 2);
        ctx.fill();
        
        // Eyes - animated blinking
        const blinkPhase = Math.sin(time * 10) > 0.8 ? 0 : 1;
        if (blinkPhase === 1) {
          ctx.fillStyle = '#ff0000';
          ctx.beginPath();
          ctx.arc(cx - width * 0.1, cy - height * 0.35, width * 0.08, 0, Math.PI * 2);
          ctx.arc(cx + width * 0.1, cy - height * 0.35, width * 0.08, 0, Math.PI * 2);
          ctx.fill();
        }
        
        // Antennae - waving motion
        const waveTime = time * 5;
        for (let i = -1; i <= 1; i += 2) {
          ctx.strokeStyle = '#00ff88';
          ctx.lineWidth = width * 0.04;
          ctx.beginPath();
          ctx.moveTo(cx + i * width * 0.2, cy - height * 0.35);
          const tipX = cx + i * (width * 0.2 + Math.sin(waveTime + i) * width * 0.1);
          const tipY = cy - height * 0.5 - Math.cos(waveTime * 2) * height * 0.05;
          ctx.quadraticCurveTo(
            cx + i * width * 0.3,
            cy - height * 0.45,
            tipX,
            tipY
          );
          ctx.stroke();
        }
        
        // Legs - segmented animation
        const legPhase = Math.floor(time * 8) % 2;
        for (let i = -1; i <= 1; i += 2) {
          ctx.strokeStyle = '#00cc66';
          ctx.lineWidth = width * 0.03;
          
          // Upper leg segment
          ctx.beginPath();
          ctx.moveTo(cx + i * width * 0.3, cy);
          const kneeX = cx + i * (width * 0.4 + Math.sin(waveTime + i) * width * 0.05);
          const kneeY = cy + height * 0.2;
          ctx.lineTo(kneeX, kneeY);
          ctx.stroke();
          
          // Lower leg segment
          if (legPhase === 1 && i > 0 || legPhase === 0 && i < 0) {
            ctx.beginPath();
            ctx.moveTo(kneeX, kneeY);
            const footX = cx + i * (width * 0.5 + Math.cos(waveTime * 2) * width * 0.1);
            const footY = cy + height * 0.35;
            ctx.lineTo(footX, footY);
            ctx.stroke();
          }
        }
      }
    },
    // Type 1: Crab-like (middle rows)
    {
      name: 'crab',
      draw: (ctx: CanvasRenderingContext2D, width: number, height: number, time: number) => {
        const cx = width / 2;
        const cy = height / 2;
        
        // Body - wider oval
        ctx.fillStyle = '#ff6600';
        ctx.beginPath();
        ctx.ellipse(cx, cy, width * 0.4, height * 0.35, 0, 0, Math.PI * 2);
        ctx.fill();
        
        // Head - top section with eyes
        ctx.fillStyle = '#ff8800';
        ctx.beginPath();
        ctx.arc(cx, cy - height * 0.3, width * 0.35, 0, Math.PI * 2);
        ctx.fill();
        
        // Eyes - blinking animation
        const blinkPhase = Math.sin(time * 10) > 0.8 ? 0 : 1;
        if (blinkPhase === 1) {
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(cx - width * 0.12, cy - height * 0.3, width * 0.07, 0, Math.PI * 2);
          ctx.arc(cx + width * 0.12, cy - height * 0.3, width * 0.07, 0, Math.PI * 2);
          ctx.fill();
          
          // Pupils
          ctx.fillStyle = '#000000';
          ctx.beginPath();
          ctx.arc(cx - width * 0.12, cy - height * 0.3, width * 0.03, 0, Math.PI * 2);
          ctx.arc(cx + width * 0.12, cy - height * 0.3, width * 0.03, 0, Math.PI * 2);
          ctx.fill();
        }
        
        // Claws - animated opening/closing
        const clawPhase = Math.sin(time * 6) > 0 ? 'open' : 'closed';
        for (let i = -1; i <= 1; i += 2) {
          ctx.strokeStyle = '#ffaa00';
          ctx.lineWidth = width * 0.04;
          
          // Claw arm
          ctx.beginPath();
          ctx.moveTo(cx + i * width * 0.35, cy);
          
          if (clawPhase === 'open') {
            const elbowX = cx + i * (width * 0.5 + Math.abs(i) * width * 0.1);
            const elbowY = cy - height * 0.1;
            ctx.lineTo(elbowX, elbowY);
            
            // Claw hand
            ctx.beginPath();
            ctx.moveTo(elbowX, elbowY);
            const handX = cx + i * (width * 0.65 + Math.sin(time * 8) * width * 0.05);
            const handY = cy - height * 0.2;
            ctx.lineTo(handX, handY);
            ctx.stroke();
            
            // Claw fingers
            ctx.strokeStyle = '#ffcc00';
            ctx.lineWidth = width * 0.02;
            for (let f = -1; f <= 1; f += 2) {
              ctx.beginPath();
              ctx.moveTo(handX, handY + f * height * 0.03);
              ctx.lineTo(handX + i * width * 0.08, handY + f * height * 0.06);
              ctx.stroke();
            }
          } else {
            // Closed claws
            const elbowX = cx + i * (width * 0.45);
            const elbowY = cy - height * 0.15;
            ctx.lineTo(elbowX, elbowY);
            ctx.stroke();
            
            // Closed claw hand
            ctx.beginPath();
            ctx.moveTo(elbowX, elbowY);
            const handX = cx + i * (width * 0.48);
            const handY = cy - height * 0.2;
            ctx.lineTo(handX, handY);
            ctx.stroke();
          }
        }
        
        // Legs - multiple segments
        for (let i = -1; i <= 1; i += 2) {
          const legCount = 3;
          for (let j = 0; j < legCount; j++) {
            ctx.strokeStyle = '#ff8800';
            ctx.lineWidth = width * 0.025;
            
            const baseY = cy + height * 0.1 + j * height * 0.1;
            const kneeX = cx + i * (width * 0.35 + j * width * 0.05);
            const kneeY = cy + height * 0.25 + Math.sin(time * 4 + j) * height * 0.03;
            
            ctx.beginPath();
            ctx.moveTo(cx + i * width * 0.3, baseY);
            ctx.lineTo(kneeX, kneeY);
            ctx.stroke();
          }
        }
      }
    },
    // Type 2: Octopus-like (bottom rows)
    {
      name: 'octopus',
      draw: (ctx: CanvasRenderingContext2D, width: number, height: number, time: number) => {
        const cx = width / 2;
        const cy = height / 2;
        
        // Head - rounded top with eyes
        ctx.fillStyle = '#9900ff';
        ctx.beginPath();
        ctx.arc(cx, cy - height * 0.15, width * 0.38, Math.PI, 0);
        ctx.fill();
        
        // Body - wider bottom section
        ctx.beginPath();
        ctx.moveTo(cx - width * 0.38, cy - height * 0.15);
        ctx.bezierCurveTo(
          cx - width * 0.45, cy + height * 0.2,
          cx + width * 0.45, cy + height * 0.2,
          cx + width * 0.38, cy - height * 0.15
        );
        ctx.fill();
        
        // Eyes - large and expressive
        const blinkPhase = Math.sin(time * 10) > 0.8 ? 0 : 1;
        if (blinkPhase === 1) {
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(cx - width * 0.12, cy - height * 0.25, width * 0.09, 0, Math.PI * 2);
          ctx.arc(cx + width * 0.12, cy - height * 0.25, width * 0.09, 0, Math.PI * 2);
          ctx.fill();
          
          // Pupils - tracking animation
          const trackX = Math.sin(time * 3) * width * 0.03;
          ctx.fillStyle = '#000000';
          ctx.beginPath();
          ctx.arc(cx - width * 0.12 + trackX, cy - height * 0.25, width * 0.04, 0, Math.PI * 2);
          ctx.arc(cx + width * 0.12 + trackX, cy - height * 0.25, width * 0.04, 0, Math.PI * 2);
          ctx.fill();
        }
        
        // Tentacles - flowing motion
        const tentacleCount = 6;
        for (let i = 0; i < tentacleCount; i++) {
          const angleOffset = ((i / tentacleCount) - 0.5) * Math.PI;
          const waveTime = time + i * 0.5;
          
          ctx.strokeStyle = '#aa00ff';
          ctx.lineWidth = width * 0.03;
          
          // Start from bottom of head
          const startX = cx + Math.sin(angleOffset) * width * 0.3;
          const startY = cy - height * 0.15;
          
          ctx.beginPath();
          ctx.moveTo(startX, startY);
          
          // Tentacle path with wave motion
          let prevX = startX;
          let prevY = startY;
          
          for (let j = 1; j <= 3; j++) {
            const t = j / 3;
            const tipX = cx + Math.sin(angleOffset + Math.sin(waveTime * 2) * 0.3) * width * (0.35 + t * 0.1);
            const tipY = cy - height * 0.15 + t * height * 0.4 + Math.cos(waveTime * 3) * height * 0.05;
            
            // Quadratic bezier for smooth curve
            const cpX = (prevX + tipX) / 2;
            const cpY = prevY + (tipY - prevY) * 0.5;
            
            ctx.quadraticCurveTo(cpX, cpY, tipX, tipY);
            prevX = tipX;
            prevY = tipY;
          }
          
          ctx.stroke();
        }
        
        // Mouth - animated expression
        const mouthOpen = Math.abs(Math.sin(time * 5)) > 0.7 ? 1 : 0;
        if (mouthOpen) {
          ctx.fillStyle = '#6600cc';
          ctx.beginPath();
          ctx.ellipse(cx, cy + height * 0.05, width * 0.15, height * 0.08, 0, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  ];

  static generateAlienTexture(
    alienType: number,
    rowColor: number = 0xffffff,
    time: number = 0
  ): CanvasTexture {
    const width = 64;
    const height = 64;
    
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Failed to get canvas context');
    }
    
    // Clear background
    ctx.clearRect(0, 0, width, height);
    
    // Apply row color tint
    const baseColor = new THREE.Color(rowColor);
    
    // Draw alien based on type
    if (alienType >= 0 && alienType < this.ALIEN_TYPES.length) {
      const alienDef = this.ALIEN_TYPES[alienType];
      
      // Create gradient for depth effect
      const gradient = ctx.createLinearGradient(0, 0, 0, height);
      gradient.addColorStop(0, `hsl(${baseColor.getHSL().h * 360}, ${baseColor.getHSL().s * 100}%, 70%)`);
      gradient.addColorStop(0.5, `hsl(${baseColor.getHSL().h * 360}, ${baseColor.getHSL().s * 100}%, 50%)`);
      gradient.addColorStop(1, `hsl(${baseColor.getHSL().h * 360}, ${baseColor.getHSL().s * 100}%, 30%)`);
      
      // Temporarily replace color functions with gradient
      const originalFillStyle = ctx.fillStyle;
      const originalStrokeStyle = ctx.strokeStyle;
      ctx.fillStyle = gradient;
      ctx.strokeStyle = gradient;
      
      alienDef.draw(ctx, width, height, time);
      
      ctx.fillStyle = originalFillStyle;
      ctx.strokeStyle = originalStrokeStyle;
    } else {
      // Default alien if type out of range
      ctx.fillStyle = '#00ff88';
      ctx.fillRect(10, 10, 44, 44);
    }
    
    return new CanvasTexture(canvas);
  }

  static generateAlienSpriteFrames(
    alienType: number,
    rowColor: number = 0xffffff,
    frameCount: number = 2,
    fps: number = 10
  ): CanvasTexture[] {
    const frames: CanvasTexture[] = [];
    const duration = 1 / fps;
    
    for (let i = 0; i < frameCount; i++) {
      const time = i * duration;
      const texture = this.generateAlienTexture(alienType, rowColor, time);
      frames.push(texture);
    }
    
    return frames;
  }

  static generatePowerUpIcon(
    powerUpType: 'rapid' | 'spread' | 'shield',
    time: number = 0
  ): CanvasTexture {
    const width = 64;
    const height = 64;
    
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Failed to get canvas context');
    }
    
    // Clear background with transparency
    ctx.clearRect(0, 0, width, height);
    
    let color: string;
    let drawFunc: (ctx: CanvasRenderingContext2D, w: number, h: number, t: number) => void;
    
    switch (powerUpType) {
      case 'rapid':
        color = '#ff0088';
        drawFunc = (ctx, w, h, t) => {
          // Lightning bolt shape
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.moveTo(w * 0.3, h * 0.2);
          ctx.lineTo(w * 0.5, h * 0.4);
          ctx.lineTo(w * 0.4, h * 0.4);
          ctx.lineTo(w * 0.6, h * 0.7);
          ctx.lineTo(w * 0.3, h * 0.5);
          ctx.lineTo(w * 0.4, h * 0.5);
          ctx.closePath();
          ctx.fill();
          
          // Glow effect
          ctx.shadowColor = color;
          ctx.shadowBlur = 10;
          ctx.fill();
          ctx.shadowBlur = 0;
        };
        break;
        
      case 'spread':
        color = '#ffaa00';
        drawFunc = (ctx, w, h, t) => {
          // Three-projectile spread pattern
          for (let i = -1; i <= 1; i++) {
            ctx.fillStyle = color;
            ctx.beginPath();
            const offsetX = w * 0.3 + i * w * 0.2;
            const offsetY = h * 0.5 + Math.sin(t * 5 + i) * h * 0.1;
            ctx.arc(offsetX, offsetY, w * 0.12, 0, Math.PI * 2);
            ctx.fill();
            
            // Glow effect
            ctx.shadowColor = color;
            ctx.shadowBlur = 8;
            ctx.fill();
            ctx.shadowBlur = 0;
          }
        };
        break;
        
      case 'shield':
        color = '#00ccff';
        drawFunc = (ctx, w, h, t) => {
          // Shield dome with energy field
          const gradient = ctx.createRadialGradient(
            w * 0.32, h * 0.32, 0,
            w * 0.32, h * 0.32, w * 0.25
          );
          gradient.addColorStop(0, '#ffffff');
          gradient.addColorStop(0.3, color);
          gradient.addColorStop(1, 'transparent');
          
          ctx.fillStyle = gradient;
          ctx.beginPath();
          ctx.arc(w * 0.32, h * 0.4, w * 0.25, Math.PI, 0);
          ctx.fill();
          
          // Shield base
          ctx.fillStyle = color;
          ctx.fillRect(w * 0.2, h * 0.6, w * 0.24, h * 0.15);
          
          // Energy ring rotation
          const rotateAngle = t * Math.PI * 2;
          ctx.save();
          ctx.translate(w * 0.32, h * 0.4);
          ctx.rotate(rotateAngle);
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = w * 0.02;
          ctx.beginPath();
          ctx.arc(0, 0, w * 0.18, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        };
        break;
    }
    
    drawFunc(ctx, width, height, time);
    
    return new CanvasTexture(canvas);
  }

  static generateBackgroundStars(
    starCount: number = 200,
    layerSpeeds: number[] = [0.1, 0.5, 1.0]
  ): THREE.Points[] {
    const stars: THREE.Points[] = [];
    
    for (let layer = 0; layer < layerSpeeds.length; layer++) {
      const positions = new Float32Array(starCount * 3);
      const colors = new Float32Array(starCount * 3);
      
      for (let i = 0; i < starCount; i++) {
        const idx = i * 3;
        
        // Random position in wide area
        positions[idx] = (Math.random() - 0.5) * 100;     // x
        positions[idx + 1] = (Math.random() - 0.5) * 50;  // y
        positions[idx + 2] = (Math.random() - 0.5) * 30;  // z
        
        // Star color with slight variation
        const brightness = 0.7 + Math.random() * 0.3;
        colors[idx] = brightness;     // r
        colors[idx + 1] = brightness; // g
        colors[idx + 2] = brightness; // b
      }
      
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      
      const material = new THREE.PointsMaterial({
        size: layerSpeeds[layer] * 0.8,
        vertexColors: true,
        transparent: true,
        opacity: 0.8 - layer * 0.2,
        blending: THREE.AdditiveBlending
      });
      
      const points = new THREE.Points(geometry, material);
      points.userData.layerSpeed = layerSpeeds[layer];
      stars.push(points);
    }
    
    return stars;
  }

  static generateStarTwinkleAnimation(
    stars: THREE.Points[],
    deltaTime: number,
    time: number
  ): void {
    stars.forEach((starField, index) => {
      const speed = starField.userData.layerSpeed || 0.5;
      
      // Apply twinkle effect to opacity based on layer and time
      const baseOpacity = 0.8 - index * 0.2;
      const twinkleFactor = Math.sin(time * speed * 2 + starField.position.x) * 0.3;
      
      if (starField.material instanceof THREE.PointsMaterial) {
        starField.material.opacity = Math.max(0.3, baseOpacity + twinkleFactor);
      }
    });
  }

  static disposeAllTextures(textures: CanvasTexture[]): void {
    textures.forEach(texture => {
      texture.dispose();
    });
  }
}