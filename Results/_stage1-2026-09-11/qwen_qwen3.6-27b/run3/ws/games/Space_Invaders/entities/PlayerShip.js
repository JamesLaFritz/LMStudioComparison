import * as THREE from 'three';

export class PlayerShip {
  constructor(scene, input, bus, config) {
    this.input = input;
    this.bus = bus;
    this.config = config;
    this.hp = config.player.maxHp;
    this.maxHp = config.player.maxHp;
    this.vx = 0;
    this.x = 0;
    this.y = config.player.y;
    this.fireTimer = 0;
    this.invulnTimer = 0;
    this.invulnerable = false;
    this.blinkTimer = 0;
    this.blinkVisible = true;
    this.combo = 0;
    this.comboTimer = 0;
    this.powerUp = null;
    this.powerUpTimer = 0;

    // Create ship mesh
    const geo = new THREE.BoxGeometry(config.player.width, config.player.height, config.player.depth);
    const mat = new THREE.MeshStandardMaterial({
      color: 0x003344,
      emissive: 0x00ffff,
      emissiveIntensity: 0.5,
      metalness: 0.7,
      roughness: 0.2,
    });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.position.set(0, this.y, 0);
    scene.add(this.mesh);

    // Engine glow
    const glowGeo = new THREE.SphereGeometry(0.15, 8, 8);
    const glowMat = new THREE.MeshStandardMaterial({
      color: 0x00ffff,
      emissive: 0x00ffff,
      emissiveIntensity: 2.0,
      transparent: true,
      opacity: 0.8,
    });
    this.engineGlow = new THREE.Mesh(glowGeo, glowMat);
    this.engineGlow.position.set(0, -0.2, 0);
    this.mesh.add(this.engineGlow);

    // Point light following player
    this.light = new THREE.PointLight(0x00ffff, 2, 8);
    this.light.position.set(0, 0, 1);
    this.mesh.add(this.light);
  }

  get position() {
    return this.mesh.position;
  }

  get halfSize() {
    const c = this.config.player;
    return Math.max(c.width, c.height) / 2;
  }

  get aabb() {
    const c = this.config.player;
    return {
      minX: this.x - c.width / 2,
      maxX: this.x + c.width / 2,
      minY: this.y - c.height / 2,
      maxY: this.y + c.height / 2,
    };
  }

  update(dt, time) {
    // Movement
    const input = this.input.axis;
    let moveX = 0;
    if (input.left < 0) moveX -= 1;
    if (input.right > 0) moveX += 1;

    this.vx += moveX * this.config.player.accel * dt;
    this.vx = THREE.MathUtils.clamp(this.vx, -this.config.player.maxSpeed, this.config.player.maxSpeed);
    this.vx *= (1 - this.config.player.friction * dt);
    this.x += this.vx * dt;
    this.x = THREE.MathUtils.clamp(this.x, -this.config.bounds.x, this.config.bounds.x);

    this.mesh.position.x = this.x;

    // Engine glow pulse
    const pulse = 0.8 + 0.2 * Math.sin(time * 5);
    this.engineGlow.scale.setScalar(pulse);

    // Firing
    this.fireTimer -= dt;
    const fireRate = this.powerUp === 'rapidFire' ? this.config.player.fireCooldown * 0.4 : this.config.player.fireCooldown;
    if (input.fire && this.fireTimer <= 0) {
      this.fireTimer = fireRate;
      this.bus.emit('playerFire', { position: { x: this.x, y: this.y + this.config.player.height / 2 + 0.1 } });
    }

    // Invulnerability
    if (this.invulnerable) {
      this.invulnTimer -= dt;
      this.blinkTimer -= dt;
      if (this.blinkTimer <= 0) {
        this.blinkTimer = 0.0625; // 8 Hz
        this.blinkVisible = !this.blinkVisible;
        this.mesh.visible = this.blinkVisible;
      }
      if (this.invulnTimer <= 0) {
        this.invulnerable = false;
        this.mesh.visible = true;
        this.mesh.material.emissive.setHex(0x00ffff);
      }
    }

    // Power-up timer
    if (this.powerUp) {
      this.powerUpTimer -= dt;
      if (this.powerUpTimer <= 0) {
        this.powerUp = null;
        this.bus.emit('powerUpExpired', {});
      }
    }

    // Combo timer
    if (this.combo > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) {
        this.combo = 0;
      }
    }
  }

  takeDamage() {
    if (this.invulnerable) return false;
    this.hp--;
    this.invulnerable = true;
    this.invulnTimer = this.config.player.invulnDuration;
    this.combo = 0;
    this.mesh.material.emissive.setHex(0xff0000);
    this.bus.emit('playerHit', { position: { x: this.x, y: this.y } });
    return this.hp <= 0;
  }

  heal(amount) {
    this.hp = Math.min(this.maxHp, this.hp + amount);
  }

  addCombo() {
    this.combo++;
    this.comboTimer = 5.0;
  }

  getMultiplier() {
    return Math.min(3.0, 1.0 + this.combo * 0.1);
  }

  activatePowerUp(type) {
    this.powerUp = type;
    this.powerUpTimer = 8.0;
    this.bus.emit('powerUpActivated', { type });
  }

  dispose() {
    this.mesh.traverse((child) => {
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
        else child.material.dispose();
      }
    });
    if (this.light) this.light.dispose();
    this.mesh.parent?.remove(this.mesh);
  }
}
