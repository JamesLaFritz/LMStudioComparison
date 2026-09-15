import * as THREE from 'three';

export interface AlienPattern {
    pixels: number[]; // 16x16 = 256 entries, 0 or 1
}

const ALIEN_COLORS = ['#00ffff', '#ff00ff', '#ffff00', '#00ff88', '#ff3366'];

const PATTERNS: AlienPattern[] = [
    // Type 0: squid-like (top row, worth 50)
    { pixels: [
        0,0,0,0,0,1,1,0,0,0,0,0,0,0,0,0,
        0,0,0,0,1,1,1,1,0,0,0,0,0,0,0,0,
        0,0,0,1,1,1,1,1,1,0,0,0,0,0,0,0,
        0,0,1,1,1,1,1,1,1,1,0,0,0,0,0,0,
        0,1,1,0,1,1,0,1,1,1,1,0,0,0,0,0,
        0,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,
        0,0,0,1,1,0,0,1,1,0,0,0,0,0,0,0,
        0,0,0,1,1,0,0,1,1,0,0,0,0,0,0,0,
        1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
        1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
        1,0,0,1,1,0,0,1,1,0,0,1,1,0,0,1,
        1,0,0,1,1,0,0,1,1,0,0,1,1,0,0,1,
        0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
        0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
        0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
        0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
    ]},
    // Type 1: crab-like (rows 1-2, worth 40)
    { pixels: [
        0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
        0,0,0,0,0,1,1,0,0,1,1,0,0,0,0,0,
        0,0,0,0,1,1,1,1,1,1,1,1,0,0,0,0,
        0,0,0,1,1,1,1,1,1,1,1,1,1,0,0,0,
        0,0,1,1,1,1,1,1,1,1,1,1,1,1,0,0,
        0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,
        1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
        1,1,1,1,0,0,0,0,0,0,0,0,1,1,1,1,
        1,1,1,0,0,0,0,0,0,0,0,0,0,1,1,1,
        1,1,0,0,0,0,0,0,0,0,0,0,0,0,1,1,
        0,0,0,0,0,0,1,0,0,1,0,0,0,0,0,0,
        0,0,0,0,0,1,0,0,0,0,1,0,0,0,0,0,
        0,0,0,0,1,0,0,0,0,0,0,1,0,0,0,0,
        0,0,0,1,0,0,0,0,0,0,0,0,1,0,0,0,
        0,0,1,0,0,0,0,0,0,0,0,0,0,1,0,0,
        0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
    ]},
    // Type 2: octopus-like (rows 3-4, worth 30)
    { pixels: [
        0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
        0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
        0,0,0,0,0,1,1,0,0,1,1,0,0,0,0,0,
        0,0,0,1,1,1,1,1,1,1,1,1,1,0,0,0,
        0,0,1,1,1,1,1,1,1,1,1,1,1,1,0,0,
        0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,
        1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
        1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
        1,1,1,1,0,0,0,0,0,0,0,0,1,1,1,1,
        1,1,1,0,0,0,0,0,0,0,0,0,0,1,1,1,
        0,0,0,0,0,0,1,0,0,1,0,0,0,0,0,0,
        0,0,0,0,0,0,1,1,1,1,0,0,0,0,0,0,
        0,0,0,0,0,1,0,0,0,0,1,0,0,0,0,0,
        0,0,0,0,1,0,0,0,0,0,0,1,0,0,0,0,
        0,0,0,1,0,0,0,0,0,0,0,0,1,0,0,0,
        0,0,1,0,0,0,0,0,0,0,0,0,0,1,0,0,
    ]},
    // Type 3: classic alien (bottom rows, worth 20)
    { pixels: [
        0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
        0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
        0,0,1,0,0,0,0,0,0,0,0,1,0,0,0,0,
        0,0,0,1,0,0,0,0,0,0,1,0,0,0,0,0,
        0,0,0,0,1,1,0,0,0,1,1,0,0,0,0,0,
        0,0,0,1,1,1,1,1,1,1,1,1,0,0,0,0,
        0,0,1,1,1,1,1,1,1,1,1,1,1,0,0,0,
        0,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,
        1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,
        1,1,1,1,0,0,0,0,0,0,0,1,1,1,1,1,
        1,1,1,0,0,0,0,0,0,0,0,0,1,1,1,1,
        0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
        0,0,0,0,0,0,1,0,0,1,0,0,0,0,0,0,
        0,0,0,0,1,1,1,1,1,1,1,1,0,0,0,0,
        0,0,0,1,1,0,0,0,0,0,0,1,1,0,0,0,
        0,0,1,1,0,0,0,0,0,0,0,0,1,1,0,0,
    ]},
    // Type 4: elite (bonus row, worth 20)
    { pixels: [
        0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
        0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
        0,0,0,0,1,1,1,1,1,1,1,1,0,0,0,0,
        0,0,0,1,1,1,1,1,1,1,1,1,1,0,0,0,
        0,0,1,1,1,1,1,1,1,1,1,1,1,1,0,0,
        0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,
        1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
        1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
        1,1,1,0,0,0,0,0,0,0,0,0,0,1,1,1,
        1,1,0,0,0,0,0,0,0,0,0,0,0,0,1,1,
        0,0,0,0,0,0,1,0,0,1,0,0,0,0,0,0,
        0,0,0,0,0,1,1,1,1,1,1,1,0,0,0,0,
        0,0,0,0,1,1,0,0,0,0,1,1,0,0,0,0,
        0,0,0,1,1,0,0,0,0,0,0,1,1,0,0,0,
        0,0,1,1,0,0,0,0,0,0,0,0,1,1,0,0,
        0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
    ]},
];

export function generateAlienTexture(type: number, frame: number = 0): THREE.CanvasTexture {
    const pattern = PATTERNS[type];
    if (!pattern) {
        return createBlankTexture();
    }

    const canvas = document.createElement('canvas');
    canvas.width = 16;
    canvas.height = 16;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = 'transparent';
    ctx.fillRect(0, 0, 16, 16);

    const pixels = pattern.pixels.slice();

    // Animation frame: shift bottom row for "walking" effect
    if (frame === 1) {
        const lastRow = pixels.splice(pixels.length - 16);
        pixels.unshift(...lastRow);
    }

    const color = ALIEN_COLORS[type];
    ctx.fillStyle = color;

    for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
            if (pixels[y * 16 + x]) {
                ctx.fillRect(x, y, 1, 1);
            }
        }
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
}

export function generatePlayerTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 16;
    const ctx = canvas.getContext('2d')!;

    // Player ship shape - wedge/saucer design
    ctx.fillStyle = '#00ffff';
    ctx.beginPath();
    ctx.moveTo(16, 0);
    ctx.lineTo(32, 16);
    ctx.lineTo(28, 16);
    ctx.lineTo(24, 10);
    ctx.lineTo(8, 10);
    ctx.lineTo(4, 16);
    ctx.lineTo(0, 16);
    ctx.closePath();
    ctx.fill();

    // Engine glow detail
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(15, 12, 2, 3);

    const tex = new THREE.CanvasTexture(canvas);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
}

export function generateProjectileTexture(isPlayer: boolean): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 4;
    canvas.height = 8;
    const ctx = canvas.getContext('2d')!;

    if (isPlayer) {
        ctx.fillStyle = '#00ffff';
        ctx.fillRect(1, 0, 2, 8);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(1, 2, 2, 4);
    } else {
        ctx.fillStyle = '#ff3366';
        ctx.fillRect(1, 0, 2, 8);
        ctx.fillStyle = '#ff9966';
        ctx.fillRect(1, 2, 2, 4);
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
}

export function generateShieldBlockTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 8;
    canvas.height = 8;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#00ff88';
    ctx.fillRect(0, 0, 8, 8);
    ctx.fillStyle = '#00cc66';
    ctx.fillRect(1, 1, 6, 6);
    ctx.fillStyle = '#00ff88';
    ctx.fillRect(2, 2, 4, 4);

    const tex = new THREE.CanvasTexture(canvas);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
}

export function generateStarfieldTexture(): THREE.DataTexture {
    const size = 2048;
    const data = new Uint8Array(size * size * 3);
    for (let i = 0; i < size * size; i++) {
        const brightness = Math.random() > 0.7 ? Math.floor(Math.random() * 255) : 0;
        data[i * 3] = brightness;
        data[i * 3 + 1] = brightness;
        data[i * 3 + 2] = brightness;
    }

    const tex = new THREE.DataTexture(data, size, size);
    tex.needsUpdate = true;
    return tex;
}

function createBlankTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 16;
    canvas.height = 16;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#ff00ff';
    ctx.fillRect(0, 0, 16, 16);

    const tex = new THREE.CanvasTexture(canvas);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
}
