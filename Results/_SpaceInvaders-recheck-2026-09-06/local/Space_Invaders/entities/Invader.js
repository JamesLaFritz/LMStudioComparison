import * as THREE from 'three';
import { MaterialFactory } from '../../shared/rendering/MaterialFactory.js';
import { AudioSynth } from '../../shared/audio/AudioSynth.js';

const INVADER_TYPES = {
  squid: {
    points: 30,
    color: 0xff2266,
    emissive: 0xff1144,
    spritePixels: 8,
    name: 'squid',
  },
  crab: {
    points: 20,
    color: 0x22ff66,
    emissive: 0x11ff44,
    spritePixels: 8,
    name: 'crab',
  },
  octopus: {
    points: 10,
    color: 0x2266ff,
    emissive: 0x1144ff,
    spritePixels: 8,
    name: 'octopus',
  },
};

const SPRITE_FRAMES = {
  squid: [
    [
      [0,0,0,1,1,0,0,0],
      [0,0,1,1,1,1,0,0],
      [0,1,1,1,1,1,1,0],
      [1,1,0,1,1,0,1,1],
      [1,1,1,1,1,1,1,1],
      [0,0,1,0,0,1,0,0],
      [0,1,0,1,1,0,1,0],
      [1,0,1,0,0,1,0,1],
    ],
    [
      [0,0,0,1,1,0,0,0],
      [0,0,1,1,1,1,0,0],
      [0,1,1,1,1,1,1,0],
      [1,1,0,1,1,0,1,1],
      [1,1,1,1,1,1,1,1],
      [0,1,0,0,0,0,1,0],
      [1,0,0,1,1,0,0,1],
      [0,1,0,0,0,0,1,0],
    ],
  ],
  crab: [
    [
      [0,0,1,0,0,1,0,0],
      [0,0,0,1,1,0,0,0],
      [0,0,1,1,1,1,0,0],
      [0,1,1,0,0,1,1,0],
      [1,1,1,1,1,1,1,1],
      [1,0,1,1,1,1,0,1],
      [1,0,1,0,0,1,0,1],
      [0,0,0,1,1,0,0,0],
    ],
    [
      [0,0,1,0,0,1,0,0],
      [1,0,0,1,1,0,0,1],
      [1,0,1,1,1,1,0,1],
      [0,1,1,0,0,1,1,0],
      [1,1,1,1,1,1,1,1],
      [0,0,1,1,1,1,0,0],
      [0,1,0,0,0,0,1,0],
      [1,0,0,0,0,0,0,1],
    ],
  ],
  octopus: [
    [
      [0,0,0,1,1,0,0,0],
      [0,0,1,1,1,1,0,0],
      [0,1,1,1,1,1,1,0],
      [1,1,0,1,1,0,1,1],
      [1,1,1,1,1,1,1,1],
      [0,0,0,1,1,0,0,0],
      [0,0,1,0,0,1,0,0],
      [0,1,0,0,0,0,1,0],
    ],
    [
      [0,0,0,1,1,0,0,0],
      [0,0,1,1,1,1,0,0],
      [0,1,1,1,1,1,1,0],
      [1,1,0,1,1,0,1,1],
      [1,1,1,1,1,1,1,1],
      [0,0,0,1,1,0,0,0],
      [0,0,1,0,0,1,0,0],
      [1,0,0,0,0,0,0,1],
    ],
  ],
};

export class Invader {
  constructor(type, gridX, gridY) {
    this.type = type;
    this.gridX = gridX;
    this.gridY = gridY;
    this.alive = true;
    this.frame = 0;
    this.animTimer = 0;

    const config = INVADER_TYPES[type];
    this.points = config.points;
    this.spritePixels = config.spritePixels;

    this.mesh = this._createMesh(config);
    this.light = new THREE.PointLight(config.emissive, 2.0, 4);
    this.light.position.set(0, 0.3, 0);
    this.mesh.add(this.light);

    this.scale = new THREE.Vector3();
    this.targetScale = new THREE.Vector3();
    this.deathTimer = 0;
    this.isDying = false;
  }

  _createMesh(config) {
    const group = new THREE.Group();
    const frames = SPRITE_FRAMES[config.name];
    const frameData = frames[this.frame % frames.length];

    const canvas = document.createElement('canvas');
    canvas.width = config.spritePixels;
    canvas.height = config.spritePixels;
    const ctx = canvas.getContext('2d');
    this._drawSprite(ctx, frameData, config.color);

    const texture = new THREE.CanvasTexture(canvas);
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    texture.colorSpace = THREE.SRGBColorSpace;

    const material = MaterialFactory.createEmissive(
      config.color,
      config.emissive,
      2.0,
      texture
    );

    const planeGeo = new THREE.PlaneGeometry(0.35, 0.35);
    const mesh = new THREE.Mesh(planeGeo, material);
    group.add(mesh);

    this._meshRef = mesh;
    this._materialRef = material;
    this._textureRef = texture;
    this._canvasRef = canvas;
    this._ctxRef = ctx;
    this._configRef = config;

    return group;
  }

  _drawSprite(ctx, frameData, color) {
    const size = this.spritePixels;
    const cellW = 1 / size;
    const cellH = 1 / size;

    ctx.clearRect(0, 0, size, size);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        if (frameData[y][x]) {
          const r = ((color >> 16) & 0xff);
          const g = ((color >> 8) & 0xff);
          const b = (color & 0xff);
          ctx.fillStyle = `rgb(${r},${g},${b})`;
          ctx.fillRect(x * cellW, y * cellH, cellW + 0.01, cellH + 0.01);
        }
      }
    }
  }

  animate(delta) {
    this.animTimer += delta;
    if (this.animTimer > 0.5) {
      this.animTimer = 0;
      this.frame = (this.frame + 1) % 2;
      const frames = SPRITE_FRAMES[this._configRef.name];
      const frameData = frames[this.frame % frames.length];
      this._drawSprite(this._ctxRef, frameData, this._configRef.color);
      this._textureRef.needsUpdate = true;
    }

    if (this.isDying) {
      this.deathTimer += delta;
      const t = Math.min(1.0, this.deathTimer / 0.3);
      this.mesh.scale.setScalar(1.0 + t * 2.0);
      this._materialRef.opacity = 1.0 - t;
      if (t >= 1.0) {
        return true; // fully dead, safe to remove
      }
    }

    return false;
  }

  kill() {
    this.alive = false;
    this.isDying = true;
    this.deathTimer = 0;
    AudioSynth.play('invaderDeath');
  }

  dispose() {
    if (this._materialRef) {
      this._materialRef.dispose();
    }
    if (this._textureRef) {
      this._textureRef.dispose();
    }
    if (this._meshRef) {
      this._meshRef.geometry.dispose();
    }
    this.mesh.traverse((child) => {
      if (child.isLight) {
        this.light = null;
      }
    });
  }

  setGridPosition(gridX, gridY, cellWidth, cellHeight, offsetX, offsetY) {
    const worldX = gridX * cellWidth + offsetX;
    const worldZ = gridY * cellHeight + offsetY;
    this.mesh.position.set(worldX, 0.5, worldZ);
  }

  setScale(sx, sy, sz) {
    this.targetScale.set(sx, sy, sz);
  }

  updateScale(delta) {
    const lerpSpeed = 4.0 * delta;
    this.scale.lerp(this.targetScale, lerpSpeed);
    if (this.alive && !this.isDying) {
      this.mesh.scale.set(this.scale.x, this.scale.y, this.scale.z);
    }
  }

  getBounds() {
    return new THREE.Box3().setFromObject(this.mesh);
  }
}
