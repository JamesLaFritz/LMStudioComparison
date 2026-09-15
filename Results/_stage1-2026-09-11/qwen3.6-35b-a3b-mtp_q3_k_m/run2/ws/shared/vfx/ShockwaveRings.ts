import * as THREE from 'three';

export interface ShockwaveRingData {
    mesh: THREE.Mesh;
    born: number;
    lifetime: number;
    maxRadius: number;
}

const RING_GEOMETRY = new THREE.TorusGeometry(1, 0.06, 8, 48);
const ringInstances: ShockwaveRingData[] = [];
let nextIndex = 0;

export function spawnShockwave(
    position: THREE.Vector3,
    color: number,
    maxRadius: number = 2.0,
    lifetime: number = 0.4,
): void {
    const mat = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 1.0,
        side: THREE.DoubleSide,
        depthWrite: false,
    });

    const mesh = new THREE.Mesh(RING_GEOMETRY.clone(), mat);
    mesh.position.copy(position);
    mesh.rotation.x = -Math.PI / 2;
    mesh.scale.set(0.01, 0.01, 0.01);

    ringInstances.push({ mesh, born: performance.now(), lifetime, maxRadius });
}

export function update(now: number): void {
    for (let i = ringInstances.length - 1; i >= 0; i--) {
        const r = ringInstances[i];
        const elapsed = (now - r.born) / 1000;
        if (elapsed >= r.lifetime) {
            r.mesh.material.dispose();
            r.mesh.geometry.dispose();
            r.mesh.parent?.remove(r.mesh);
            ringInstances.splice(i, 1);
            continue;
        }

        const t = elapsed / r.lifetime;
        const radius = r.maxRadius * easeOutQuad(t);
        r.mesh.scale.set(radius, radius, radius);
        (r.mesh.material as THREE.MeshBasicMaterial).opacity = 1.0 - t;
    }
}

export function disposeAll(): void {
    for (const r of ringInstances) {
        r.mesh.material.dispose();
        r.mesh.geometry.dispose();
        if (r.mesh.parent) r.mesh.parent.remove(r.mesh);
    }
    ringInstances.length = 0;
}

function easeOutQuad(t: number): number {
    return 1 - (1 - t) * (1 - t);
}
