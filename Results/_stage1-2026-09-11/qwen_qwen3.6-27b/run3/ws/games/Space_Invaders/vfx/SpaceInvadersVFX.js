import { CameraShake } from '../../../shared/vfx/CameraShake.js'
import { HitStop } from '../../../shared/vfx/HitStop.js'
import { MotionTrails } from '../../../shared/vfx/MotionTrails.js'
import { ShockwaveRings } from '../../../shared/vfx/ShockwaveRings.js'
import { FloatingScoreText } from '../../../shared/vfx/FloatingScoreText.js'
import { ParticleManager } from '../../../shared/particle/ParticleManager.js'

export function setupVFX(scene, bus, config) {
  const cameraShake = new CameraShake()
  const hitStop = new HitStop()
  const trails = new MotionTrails(scene)
  const rings = new ShockwaveRings(scene, 10)
  const scoreText = new FloatingScoreText(scene)
  const particles = new ParticleManager(scene, 500)

  // --- Alien death ---
  bus.on('alienDeath', (data) => {
    const color = config.alienTypes[data.type]?.color || '#ff6600'
    particles.burst('explosion', data.position, color, 30)
    rings.spawn(data.position, color)
    cameraShake.addTrauma(0.15)
    hitStop.trigger(0.03)
  })

  // --- Player hit ---
  bus.on('playerHit', (data) => {
    particles.burst('spark', data.position, '#ff0044', 20)
    cameraShake.addTrauma(0.3)
    hitStop.trigger(0.06)
  })

  // --- UFO death ---
  bus.on('ufoDeath', (data) => {
    particles.burst('explosion', data.position, '#ffdd00', 60)
    rings.spawn(data.position, '#ffdd00')
    cameraShake.addTrauma(0.5)
    hitStop.trigger(0.12)
  })

  // --- UFO appear ---
  bus.on('ufoAppear', () => {
    cameraShake.addTrauma(0.1)
  })

  // --- Player fire ---
  bus.on('playerFire', (data) => {
    particles.burst('spark', data.position, '#00ffff', 5)
  })

  // --- Alien fire ---
  bus.on('alienFire', (data) => {
    particles.burst('spark', data.position, '#ff3300', 5)
  })

  // --- Shield erosion ---
  bus.on('shieldErosion', (data) => {
    particles.burst('spark', data.position, '#00ff00', 8)
    cameraShake.addTrauma(0.05)
  })

  // --- Boss hit ---
  bus.on('bossHit', (data) => {
    particles.burst('explosion', data.position, '#ff0066', 40)
    rings.spawn(data.position, '#ff0066')
    cameraShake.addTrauma(0.4)
    hitStop.trigger(0.08)
  })

  // --- Boss death ---
  bus.on('bossDeath', (data) => {
    particles.burst('explosion', data.position, '#ff0066', 80)
    rings.spawn(data.position, '#ff0066')
    cameraShake.addTrauma(0.8)
    hitStop.trigger(0.15)
  })

  // --- Power-up collect ---
  bus.on('powerUpCollect', (data) => {
    particles.burst('spark', data.position, '#ffff00', 25)
  })

  // --- Wave clear ---
  bus.on('waveClear', () => {
    cameraShake.addTrauma(0.3)
    hitStop.trigger(0.1)
  })

  // --- Game over ---
  bus.on('gameOver', () => {
    cameraShake.addTrauma(1.0)
    hitStop.trigger(0.3)
  })

  // --- Bullet trails (spawn events) ---
  bus.on('playerBulletSpawn', (data) => {
    // trails handled by MotionTrails on the bullet mesh
  })

  bus.on('alienBulletSpawn', (data) => {
    // trails handled by MotionTrails on the bullet mesh
  })

  bus.on('ufoSpawn', (data) => {
    // UFO trail handled separately
  })

  function update(dt) {
    cameraShake.update(dt)
    hitStop.update(dt)
    trails.update(dt)
    rings.update(dt)
    scoreText.update(dt)
    particles.update(dt)
  }

  function applyShake(camera) {
    cameraShake.apply(camera)
  }

  function dispose() {
    trails.dispose()
    rings.dispose()
    scoreText.dispose()
    particles.dispose()
  }

  return { cameraShake, hitStop, trails, rings, scoreText, particles, update, applyShake, dispose }
}
