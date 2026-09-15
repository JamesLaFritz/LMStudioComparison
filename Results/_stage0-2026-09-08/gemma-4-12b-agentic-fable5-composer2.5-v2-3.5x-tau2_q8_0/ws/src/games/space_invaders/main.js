import * as THREE from 'three';

import { renderer, scene, camera } from '../../shared/renderer.js';

let score = 0;
let gameOver = false;
let win = false;
let lastFireTime = 0;
const FIRE_COOLDOWN = 350;

// Invader grid: 10 rows x 22 columns
const ROWS = 10, COLS = 22;
let invaderCount = ROWS * COLS;
let invaders = []; // { pos, vel, alive }
let direction = 1;
let dropCounter = 0;

// Player ship — InstancedMesh for the body + neon trails (simplified to a single mesh here)
const playerGeo = new THREE.Group();

// Hull — dark metallic body with glowing accents
const hullMat = new THREE.MeshStandardMaterial({ color: 0x2a3b4d, metalness: 0.8, roughness: 0.2 });
const wingL = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.6, 0.9), hullMat);

// Neon wingtip glow
const tipL = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.4, 0.8), new THREE.MeshStandardMaterial({ color: 0x44ff88, emissive: 0xffffff, emissiveIntensity: 2 }));
tipL.position.set(-1.5, -0.3, 0);
wingL.add(tipL);

wingL.position.set(-1.2, -0.3, 0);
playerGeo.add(wingL);

const wingR = wingL.clone();
wingR.position.x = 1.2;
playerGeo.add(wingR);

// Cockpit — bright emissive blue
const cockpitMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x4488ff, emissiveIntensity: 3 });
const cockpit = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.5, 0.7), cockpitMat);
cockpit.position.set(0, 0.6, -0.2);
playerGeo.add(cockpit);

// Neon trails — glowing lines trailing behind the ship
const trailMat = new THREE.MeshBasicMaterial({ color: 0x44ff88, transparent: true, opacity: 0.7 });
for (let i = 1; i <= 3; i++) {
  const t = i / 3;
  const trail = new THREE.Mesh(new THREE.BoxGeometry(2 * (1 - t), 0.4, 0.8), trailMat);
  trail.position.set(0, -0.5 + t * 0.6, -i * 0.7);
  playerGeo.add(trail);
}

const player = new THREE.Mesh(playerGeo, hullMat); // group's material is ignored; children render with their own
scene.add(player);

// Invader fleet — InstancedMesh for all 220 invaders in one draw call
const invaderGeo = new THREE.BoxGeometry(1.5, 1.3, 0.8);
const invaderMat = new THREE.MeshStandardMaterial({ color: 0xffaa00, emissive: 0x443300 });
const invadersInst = new THREE.InstancedMesh(invaderGeo, invaderMat, ROWS * COLS);

// Laser pool — pre-allocate 15 lasers to avoid runtime allocation
const laserPoolSize = 15;
const lasers = [];
for (let i = 0; i < laserPoolSize; i++) {
  lasers.push({ mesh: new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.2, 3), invaderMat), active: false });
}

function initInvaders() {
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const x = (c - COLS / 2) * 3 + Math.sin(r) * 1.5; // staggered rows
      const y = (ROWS / 2 - r) * 2.8;
      invaders.push({ pos: new THREE.Vector3(x, y, 0), vel: new THREE.Vector3(direction * 1.5 + Math.random() * 0.5, 0, 0), alive: true });
    }
  }

  const matrix = new THREE.Matrix4();
  invaders.forEach((_, i) => {
    matrix.makeTranslation(invaders[i].pos.x, invaders[i].pos.y, 0);
    invadersInst.setMatrixAt(i, matrix);
  });
}

initInvaders();

function update() {
  if (gameOver || win) return;

  // Player input & fire
  const move = getAxis(0); // Left/Right
  player.position.x += move * 7;
  player.position.x = Math.max(-12, Math.min(12, player.position.x));

  if ((getButton(0) || keys.has('Space')) && Date.now() - lastFireTime > FIRE_COOLDOWN) {
    lastFireTime = Date.now();
    playLaser();
    const laser = lasers.find((l) => !l.active);
    if (laser) {
      laser.active = true;
      laser.mesh.position.set(player.position.x, player.position.y + 0.4, -25);
      scene.add(laser.mesh);
    }
  }

  // Invader fleet movement & drop
  dropCounter += 1;
  if (dropCounter > 60) {
    let edge = false;
    invaders.forEach((inv) => {
      inv.pos.x += inv.vel.x;
      if ((inv.vel.x > 0 && inv.pos.x > 12) || (inv.vel.x < 0 && inv.pos.x < -12)) edge = true;
    });

    if (edge) {
      direction *= -1;
      invaders.forEach((inv) => {
        inv.vel.x *= -1;
        inv.pos.y -= 2.8;
        if (inv.pos.y < -3) gameOver = true; // Invasion reached bottom row — loss
      });
    }
    dropCounter = 0;
  }

  // Update invader InstancedMesh matrix
  const m = new THREE.Matrix4();
  invaders.forEach((inv, i) => {
    if (!inv.alive) return;
    m.makeTranslation(inv.pos.x, inv.pos.y, 0);
    invadersInst.setMatrixAt(i, m);
  });
  invadersInst.instanceMatrix.needsUpdate = true;

  // Laser collision & destruction
  lasers.forEach((l) => {
    if (!l.active) return;
    l.mesh.position.z += 15 * (Date.now() - lastFireTime) / FIRE_COOLDOWN; // speed scales with fire rate

    const hit = invaders.find((inv) => inv.alive && Math.abs(l.mesh.position.x - inv.pos.x) < 2 && Math.abs(l.mesh.position.z - inv.pos.z) < 1);
    if (hit || l.mesh.position.z > 5) {
      createBurst(scene, hit ? hit.pos : l.mesh.position, hit ? 0xffaa00 : 0x88ccff, 24, 3);
      createShockwave(scene, hit ? hit.pos : l.mesh.position);
      if (hit) {
        invaderCount--;
        score += 10;
        hit.alive = false;
        playExplosion();
      }
      l.active = false;
      scene.remove(l.mesh);
    }
  });

  updateVFX(0.016, camera);

  if (invaderCount === 0) { win = true; playWin(); }
}

function render() {
  requestAnimationFrame(render);
  update();
  renderer.render(); // calls shared renderer's render(), which does composer.render()
}

render();
