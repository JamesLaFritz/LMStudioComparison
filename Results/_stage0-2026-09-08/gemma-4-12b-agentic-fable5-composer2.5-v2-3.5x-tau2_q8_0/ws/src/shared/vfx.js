import * as THREE from 'three';

let shakeIntensity = 0;
const shakeDecay = 0.92;
function applyShake(camera) {
  if (shakeIntensity <= 0) return;
  camera.position.x += (Math.random() - 0.5) * shakeIntensity;
  camera.position.y += (Math.random() - 0.5) * shakeIntensity;
  shakeIntensity *= shakeDecay;
}

let hitStop = false;
function setHitStop(duration) {
  hitStop = true;
  setTimeout(() => { hitStop = false; }, duration);
}

const particles = [];
const particleCap = 500;
export function createBurst(scene, pos, color, count = 20, speed = 1.5) {
  for (let i = 0; i < Math.min(count, particleCap - particles.length); i++) {
    particles.push({
      mesh: new THREE.Mesh(new THREE.SphereGeometry(0.08), new THREE.MeshBasicMaterial({ color })),
      pos: pos.clone(),
      vel: new THREE.Vector3((Math.random() - 0.5) * speed, (Math.random() - 1) * speed, (Math.random() - 0.5) * speed),
      life: 1.0
    });
    scene.add(particles[i].mesh);
  }
}

export function updateVFX(dt, camera) {
  applyShake(camera);
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.pos.add(p.vel);
    p.life -= dt * 2;
    if (p.life <= 0) {
      p.mesh.geometry.dispose();
      p.mesh.material.dispose();
      scene.remove(p.mesh);
      particles.splice(i, 1);
    } else {
      p.mesh.position.copy(p.pos);
      p.mesh.scale.setScalar(p.life);
    }
  }
}

export function createShockwave(scene, pos) {
  const ring = new THREE.Mesh(new THREE.RingGeometry(0, 1.5, 32), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 1 }));
  ring.position.copy(pos);
  ring.lookAt(pos.x, pos.y, pos.z + 10);
  scene.add(ring); // Add BEFORE animating so first frame renders
  const anim = () => {
    r += dt * 5;
    ring.scale.setScalar(r);
    ring.material.opacity -= dt * 2;
    if (ring.material.opacity <= 0) {
      ring.geometry.dispose();
      ring.material.dispose();
      scene.remove(ring);
    } else requestAnimationFrame(anim);
  };
  requestAnimationFrame(anim);
}