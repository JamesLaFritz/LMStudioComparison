import * as THREE from 'three'
import { ObjectPool } from '../../../shared/pool/ObjectPool.js'

export class Bullets {
  constructor(scene, config, bus) {
    this.scene = scene
    this.config = config
    this.bus = bus

    this.playerPool = new ObjectPool(() => this._createBullet(config.playerBulletColor, config.playerBulletEmissive), config.maxPlayerBullets)
    this.alienPool = new ObjectPool(() => this._createBullet(config.alienBulletColor, config.alienBulletEmissive), config.maxAlienBullets)

    this.playerBullets = []
    this.alienBullets = []
  }

  _createBullet(color, emissive) {
    const geo = new THREE.BoxGeometry(0.06, 0.2, 0.06)
    const mat = new THREE.MeshStandardMaterial({
      color,
      emissive,
      emissiveIntensity: 1.5,
      metalness: 0.5,
      roughness: 0.3
    })
    const mesh = new THREE.Mesh(geo, mat)
    mesh.visible = false
    this.scene.add(mesh)

    // Wrapper object with direct properties the game code expects
    const bullet = {
      mesh,
      alive: false,
      position: new THREE.Vector3(),
      halfSize: 0.12,
      _geo: geo,
      _mat: mat
    }
    return bullet
  }

  spawnPlayerBullet(position) {
    const bullet = this.playerPool.acquire()
    if (!bullet) return null
    bullet.position.copy(position)
    bullet.position.y += 0.3
    bullet.mesh.position.copy(bullet.position)
    bullet.mesh.visible = true
    bullet.alive = true
    this.playerBullets.push(bullet)
    this.bus.emit('playerFire', { position: { x: bullet.position.x, y: bullet.position.y } })
    return bullet
  }

  spawnAlienBullet(position) {
    const bullet = this.alienPool.acquire()
    if (!bullet) return null
    bullet.position.copy(position)
    bullet.position.y -= 0.2
    bullet.mesh.position.copy(bullet.position)
    bullet.mesh.visible = true
    bullet.alive = true
    this.alienBullets.push(bullet)
    this.bus.emit('alienFire', { position: { x: bullet.position.x, y: bullet.position.y } })
    return bullet
  }

  update(dt) {
    for (let i = this.playerBullets.length - 1; i >= 0; i--) {
      const b = this.playerBullets[i]
      b.position.y += this.config.playerBulletSpeed * dt
      b.mesh.position.copy(b.position)
      if (b.position.y > 5) {
        this._recyclePlayer(b)
        this.playerBullets.splice(i, 1)
      }
    }
    for (let i = this.alienBullets.length - 1; i >= 0; i--) {
      const b = this.alienBullets[i]
      b.position.y -= this.config.alienBulletSpeed * dt
      b.mesh.position.copy(b.position)
      if (b.position.y < -5) {
        this._recycleAlien(b)
        this.alienBullets.splice(i, 1)
      }
    }
  }

  _recyclePlayer(bullet) {
    bullet.alive = false
    bullet.mesh.visible = false
    this.playerPool.release(bullet)
  }

  _recycleAlien(bullet) {
    bullet.alive = false
    bullet.mesh.visible = false
    this.alienPool.release(bullet)
  }

  clear() {
    while (this.playerBullets.length > 0) {
      this._recyclePlayer(this.playerBullets.pop())
    }
    while (this.alienBullets.length > 0) {
      this._recycleAlien(this.alienBullets.pop())
    }
  }

  dispose() {
    this.clear()
    this.playerPool._items.forEach(b => {
      if (b._geo) b._geo.dispose()
      if (b._mat) b._mat.dispose()
      if (b.mesh && b.mesh.parent) b.mesh.parent.remove(b.mesh)
    })
    this.alienPool._items.forEach(b => {
      if (b._geo) b._geo.dispose()
      if (b._mat) b._mat.dispose()
      if (b.mesh && b.mesh.parent) b.mesh.parent.remove(b.mesh)
    })
  }
}
