import * as THREE from 'three';

export interface FloatingScoreData {
    sprite: THREE.Sprite;
    startTime: number;
    lifetime: number;
}

let sprites: FloatingScoreData[] = [];

export function initFloatingScoreText(): void {
    sprites = [];
}

export function disposeFloatingScoreText(): void {
    for (const s of sprites) {
        if (s.sprite.material instanceof THREE.SpriteMaterial) {
            s.sprite.material.dispose();
        }
        s.sprite.geometry?.dispose();
    }
    sprites = [];
}

export function spawn(
    engine: { scene: THREE.Scene; clock: THREE.Clock },
    position: THREE.Vector3,
    text: string,
    color: string,
    lifetimeMs: number = 1000
): void {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 128;
    const ctx = canvas.getContext('2d')!;

    ctx.clearRect(0, 0, 256, 128);
    ctx.font = 'bold 72px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Glow effect
    ctx.shadowColor = color;
    ctx.shadowBlur = 20;
    ctx.fillStyle = color;
    ctx.fillText(text, 128, 64);

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    const material = new THREE.SpriteMaterial({ map: texture, transparent: true, opacity: 1.0 });
    const sprite = new THREE.Sprite(material);

    sprite.position.copy(position);
    sprite.position.y += 1.5;
    sprite.scale.set(2.0, 1.0, 1.0);

    engine.scene.add(sprite);

    sprites.push({ sprite, startTime: engine.clock.getElapsedTime(), lifetime: lifetimeMs / 1000 });
}

export function update(engine: { clock: THREE.Clock; scene: THREE.Scene }): void {
    const now = engine.clock.getElapsedTime();
    const toRemove: FloatingScoreData[] = [];

    for (const entry of sprites) {
        const elapsed = now - entry.startTime;
        const t = Math.min(elapsed / entry.lifetime, 1.0);

        // Fade out over lifetime
        if (entry.sprite.material instanceof THREE.SpriteMaterial) {
            entry.sprite.material.opacity = 1.0 - t;
        }

        // Float upward
        const delta = engine.clock.getDelta();
        entry.sprite.position.y += 0.8 * delta;

        // Scale pulse at start then shrink
        const scalePulse = 1.0 + Math.sin(t * Math.PI) * 0.3;
        entry.sprite.scale.set(2.0 * scalePulse, 1.0 * scalePulse, 1.0);

        if (t >= 1.0) {
            toRemove.push(entry);
        }
    }

    for (const entry of toRemove) {
        const idx = sprites.indexOf(entry);
        if (idx !== -1) {
            sprites.splice(idx, 1);
            if (entry.sprite.material instanceof THREE.SpriteMaterial) {
                entry.sprite.material.dispose();
            }
            entry.sprite.geometry?.dispose();
            engine.scene.remove(entry.sprite);
        }
    }
}
