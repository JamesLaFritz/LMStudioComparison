import { Texture, CanvasTexture } from 'three';

export enum EnemyType {
    GRUNT = 'grunt',
    ELITE = 'elite',
    BOSS = 'boss'
}

export function createEnemyTexture(type: EnemyType): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d')!;

    // Clear background
    ctx.clearRect(0, 0, 128, 128);

    if (type === EnemyType.GRUNT) {
        ctx.fillStyle = '#00FF00';
        // Body
        ctx.fillRect(32, 48, 64, 32);
        // Top section
        ctx.fillRect(16, 32, 96, 16);
        // Arms
        ctx.fillRect(8, 48, 16, 24);
        ctx.fillRect(104, 48, 16, 24);
        // Eyes
        ctx.fillStyle = '#000';
        ctx.fillRect(40, 52, 16, 8);
        ctx.fillRect(72, 52, 16, 8);
    } else if (type === EnemyType.ELITE) {
        ctx.fillStyle = '#FF00FF';
        // Elite has more complex shape
        ctx.beginPath();
        ctx.moveTo(32, 48);
        ctx.lineTo(96, 48);
        ctx.lineTo(112, 72);
        ctx.lineTo(16, 72);
        ctx.closePath();
        ctx.fill();
        // Top detail
        ctx.fillRect(40, 32, 48, 16);
        // Eyes
        ctx.fillStyle = '#000';
        ctx.fillRect(48, 56, 12, 8);
        ctx.fillRect(68, 56, 12, 8);
    } else if (type === EnemyType.BOSS) {
        ctx.fillStyle = '#FFD700';
        // Boss is large and imposing
        ctx.beginPath();
        ctx.moveTo(16, 48);
        ctx.lineTo(112, 48);
        ctx.lineTo(128, 96);
        ctx.lineTo(0, 96);
        ctx.closePath();
        ctx.fill();
        // Core detail
        ctx.fillStyle = '#FFA500';
        ctx.fillRect(48, 56, 32, 24);
        // Eyes
        ctx.fillStyle = '#000';
        ctx.fillRect(32, 64, 16, 12);
        ctx.fillRect(80, 64, 16, 12);
    }

    return canvas;
}

export function createShieldTexture(): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d')!;

    // Shield dome shape
    ctx.fillStyle = '#00FFFF';
    ctx.beginPath();
    ctx.arc(64, 96, 50, Math.PI, 0);
    ctx.fill();

    // Grid pattern for retro feel
    ctx.strokeStyle = '#0088FF';
    ctx.lineWidth = 2;
    for (let i = 0; i < 10; i++) {
        ctx.beginPath();
        ctx.moveTo(64 + (i - 5) * 8, 96);
        ctx.lineTo(64 + (i - 5) * 8, 128);
        ctx.stroke();
    }

    return canvas;
}

export function createPowerUpTexture(type: string): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;

    if (type === 'spread') {
        ctx.fillStyle = '#FF00FF';
        ctx.beginPath();
        for (let i = 0; i < 5; i++) {
            const angle = (i * 72 - 90) * Math.PI / 180;
            const x = 32 + Math.cos(angle) * 24;
            const y = 32 + Math.sin(angle) * 24;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fill();
    } else if (type === 'rapid') {
        ctx.fillStyle = '#FFA500';
        ctx.fillRect(16, 16, 32, 32);
        ctx.strokeStyle = '#FFF';
        ctx.lineWidth = 4;
        ctx.strokeRect(20, 20, 24, 24);
    } else if (type === 'life') {
        ctx.fillStyle = '#00FF00';
        ctx.beginPath();
        ctx.moveTo(32, 16);
        ctx.bezierCurveTo(48, 16, 56, 32, 56, 40);
        ctx.bezierCurveTo(56, 56, 32, 64, 32, 64);
        ctx.bezierCurveTo(32, 64, 8, 56, 8, 40);
        ctx.bezierCurveTo(8, 32, 16, 16, 32, 16);
        ctx.fill();
    } else if (type === 'shield') {
        ctx.fillStyle = '#00FFFF';
        ctx.beginPath();
        ctx.arc(32, 32, 24, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#FFF';
        ctx.lineWidth = 4;
        ctx.stroke();
    }

    return canvas;
}

export function createStarTexture(): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext('2d')!;

    // Random star shape
    const points = Math.floor(Math.random() * 3) + 4;
    const outerRadius = 10;
    const innerRadius = 5;
    const cx = 16;
    const cy = 16;

    ctx.fillStyle = '#FFF';
    ctx.beginPath();
    for (let i = 0; i < points * 2; i++) {
        const angle = (i * Math.PI) / points - Math.PI / 2;
        const radius = i % 2 === 0 ? outerRadius : innerRadius;
        const x = cx + Math.cos(angle) * radius;
        const y = cy + Math.sin(angle) * radius;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();

    return canvas;
}

export function createBackgroundTexture(): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;

    // Deep space gradient
    const gradient = ctx.createLinearGradient(0, 0, 0, 512);
    gradient.addColorStop(0, '#000011');
    gradient.addColorStop(0.5, '#000033');
    gradient.addColorStop(1, '#000011');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 512, 512);

    // Random stars
    for (let i = 0; i < 200; i++) {
        const x = Math.random() * 512;
        const y = Math.random() * 512;
        const size = Math.random() * 2 + 1;
        const alpha = Math.random() * 0.8 + 0.2;

        ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fill();
    }

    return canvas;
}