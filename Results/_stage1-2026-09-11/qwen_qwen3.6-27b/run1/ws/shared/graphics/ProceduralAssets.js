// shared/graphics/ProceduralAssets.js
// All assets generated via code — no external files.

import * as THREE from 'three';
import { fbm2D } from '../math/Noise.js';

// --- Texture Helpers ---

export function createCanvasTexture(width, height, drawFn) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    drawFn(ctx, width, height);
    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
}

export function createGridTexture(size, cellSize, lineColor, bgColor) {
    return createCanvasTexture(size, size, (ctx, w, h) => {
        ctx.fillStyle = bgColor || '#000000';
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = lineColor || '#00ffff';
        ctx.lineWidth = 1;
        for (let x = 0; x <= w; x += cellSize) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, h);
            ctx.stroke();
        }
        for (let y = 0; y <= h; y += cellSize) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(w, y);
            ctx.stroke();
        }
    });
}

export function createNoiseTexture(size, octaves, persistence, baseColor) {
    return createCanvasTexture(size, size, (ctx, w, h) => {
        const imageData = ctx.createImageData(w, h);
        const data = imageData.data;
        const r = (baseColor || 0x888888);
        const g = (baseColor >> 8) & 0xff;
        const b = (baseColor >> 16) & 0xff;
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                const nx = x / w;
                const ny = y / h;
                const value = (fbm2D(nx * 4, ny * 4, octaves, persistence) + 1) * 0.5;
                const idx = (y * w + x) * 4;
                data[idx] = Math.min(255, r * value);
                data[idx + 1] = Math.min(255, g * value);
                data[idx + 2] = Math.min(255, b * value);
                data[idx + 3] = 255;
            }
        }
        ctx.putImageData(imageData, 0, 0);
    });
}

// --- Material Helpers ---

export function createStandardMaterial(color, roughness, metalness, emissive, emissiveIntensity) {
    const mat = new THREE.MeshStandardMaterial({
        color: color || 0x888888,
        roughness: roughness ?? 0.5,
        metalness: metalness ?? 0.5,
    });
    if (emissive) {
        mat.emissive = new THREE.Color(emissive);
        mat.emissiveIntensity = emissiveIntensity ?? 1.0;
    }
    return mat;
}

export function createEmissiveMaterial(color, intensity) {
    return createStandardMaterial(
        color || 0xffffff,
        0.3,
        0.7,
        color || 0xffffff,
        intensity ?? 1.0
    );
}

// --- Geometry Builders ---

export function createBoxGeometry(w, h, d, ws, hs, ds) {
    return new THREE.BoxGeometry(
        w || 1, h || 1, d || 1,
        ws || 1, hs || 1, ds || 1
    );
}

export function createSphereGeometry(r, ws, hs) {
    return new THREE.SphereGeometry(r || 1, ws || 16, hs || 16);
}

export function createCylinderGeometry(rt, rb, h, segs) {
    return new THREE.CylinderGeometry(rt || 1, rb || 1, h || 1, segs || 8);
}

export function createTorusGeometry(r, tube, ar, ts) {
    return new THREE.TorusGeometry(r || 1, tube || 0.3, ar || 8, ts || 16);
}

export function createPlaneGeometry(w, h, ws, hs) {
    return new THREE.PlaneGeometry(w || 1, h || 1, ws || 1, hs || 1);
}

// Displaced plane — vertices perturbed by noise
export function createDisplacedPlaneGeometry(w, h, ws, hs, amplitude, frequency) {
    const geo = createPlaneGeometry(w, h, ws, hs);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const y = pos.getY(i);
        const nz = fbm2D(x * frequency, y * frequency, 3, 0.5);
        pos.setZ(i, nz * amplitude);
    }
    geo.computeVertexNormals();
    return geo;
}

// Procedural alien geometries — retro-futuristic bug shapes
export function createAlienGeometry(type, scale, freq) {
    const s = scale || 1.0;
    switch (type) {
        case 'octopus': {
            const group = new THREE.Group();
            // Body
            const body = new THREE.SphereGeometry(0.5 * s, 8, 6);
            group.add(new THREE.Mesh(body));
            // Eyes
            const eyeGeo = new THREE.SphereGeometry(0.15 * s, 6, 6);
            const leftEye = new THREE.Mesh(eyeGeo);
            leftEye.position.set(-0.2 * s, 0.15 * s, 0.35 * s);
            group.add(leftEye);
            const rightEye = new THREE.Mesh(eyeGeo);
            rightEye.position.set(0.2 * s, 0.15 * s, 0.35 * s);
            group.add(rightEye);
            // Tentacles
            const tentGeo = new THREE.CylinderGeometry(0.05 * s, 0.08 * s, 0.6 * s, 4);
            for (let i = -2; i <= 2; i++) {
                const tent = new THREE.Mesh(tentGeo);
                tent.position.set(i * 0.15 * s, -0.5 * s, 0);
                tent.rotation.z = i * 0.15;
                group.add(tent);
            }
            // Merge into single geometry
            const merged = new THREE.BufferGeometry();
            const positions = [];
            const normals = [];
            const dummy = new THREE.Object3D();
            group.updateMatrixWorld(true);
            group.traverse(child => {
                if (child.isMesh && child.geometry) {
                    const geo = child.geometry;
                    const posAttr = geo.attributes.position;
                    const normAttr = geo.attributes.normal;
                    for (let i = 0; i < posAttr.count; i++) {
                        dummy.position.set(posAttr.getX(i), posAttr.getY(i), posAttr.getZ(i));
                        dummy.applyMatrix4(child.matrixWorld);
                        positions.push(dummy.position.x, dummy.position.y, dummy.position.z);
                        if (normAttr) {
                            const n = new THREE.Vector3(normAttr.getX(i), normAttr.getY(i), normAttr.getZ(i));
                            n.applyQuaternion(child.matrixWorld.decompose(new THREE.Quaternion()).quaternion || new THREE.Quaternion());
                            normals.push(n.x, n.y, n.z);
                        }
                    }
                }
            });
            merged.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
            if (normals.length) merged.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
            merged.computeVertexNormals();
            return merged;
        }
        case 'squid':
        case 'squid2': {
            const geo = new THREE.ConeGeometry(0.4 * s, 0.7 * s, 6);
            geo.rotateX(Math.PI);
            return geo;
        }
        case 'crab':
        case 'crab2': {
            const geo = new THREE.BoxGeometry(0.7 * s, 0.4 * s, 0.3 * s);
            return geo;
        }
        default: {
            return new THREE.SphereGeometry(0.4 * s, 8, 6);
        }
    }
}

// --- Scene Builders ---

// Starfield using InstancedMesh for performance
export function createStarfield(scene, count, spread) {
    const geo = createSphereGeometry(0.05, 4, 4);
    const mat = createEmissiveMaterial(0xffffff, 1.5);
    const mesh = new THREE.InstancedMesh(geo, mat, count);
    const dummy = new THREE.Object3D();
    const colors = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
        dummy.position.set(
            (Math.random() - 0.5) * spread,
            (Math.random() - 0.5) * spread * 0.5,
            -Math.random() * spread * 0.5
        );
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
        const brightness = 0.5 + Math.random() * 0.5;
        const tint = Math.random();
        colors[i * 3] = brightness * (tint > 0.7 ? 1.0 : 0.8);
        colors[i * 3 + 1] = brightness * (tint > 0.5 ? 1.0 : 0.85);
        colors[i * 3 + 2] = brightness;
    }
    mesh.instanceColor = new THREE.InstancedBufferAttribute(colors, 3);
    scene.add(mesh);
    return { mesh, geometry: geo, material: mat };
}

// Retro-futuristic ground plane with emissive grid
export function createGroundPlane(scene, width, depth, gridDivisions) {
    const geo = createPlaneGeometry(width, depth, gridDivisions, gridDivisions);
    const gridTex = createGridTexture(512, 64, '#004444', '#050510');
    const mat = new THREE.MeshStandardMaterial({
        map: gridTex,
        roughness: 0.8,
        metalness: 0.2,
        emissive: new THREE.Color(0x001122),
        emissiveIntensity: 0.3,
        emissiveMap: gridTex,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = -8;
    scene.add(mesh);
    return { mesh, geometry: geo, material: mat, texture: gridTex };
}

// --- Disposal Helpers ---

export function disposeAsset(asset) {
    if (!asset) return;
    if (asset.geometry) asset.geometry.dispose();
    if (asset.material) {
        if (Array.isArray(asset.material)) {
            asset.material.forEach(m => m.dispose());
        } else {
            asset.material.dispose();
        }
    }
    if (asset.texture) asset.texture.dispose();
}
