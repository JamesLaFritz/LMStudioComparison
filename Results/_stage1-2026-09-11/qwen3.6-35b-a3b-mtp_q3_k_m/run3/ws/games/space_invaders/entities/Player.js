import * as THREE from 'three';

export class Player {
  constructor(scene, config) {
    this.scene = scene;
    this.config = config;
    this.position = new THREE.Vector3(0, config.PLAYER_Y, 0);
    this.velocity = new THREE.Vector3(0, 0, 0);
    this.direction = 0;
    this.lives = config.PLAYER_LIVES;
    this.shootCooldown = 0;
    this.isInvulnerable = false;
    this.invulnerabilityTimer = 0;
    this.blinkTimer = 0;
    this.mesh = new THREE.Group();

    // Player ship geometry — retro-futuristic fighter shape
    const bodyGeo = new THREE.ConeGeometry(0.3, 0.8, 4);
    bodyGeo.rotateX(Math.PI / 2);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0x00ff88,
      emissive: 0x00ff88,
      emissiveIntensity: 1.5,
      metalness: 0.3,
      roughness: 0.4,
    });
    this.body = new THREE.Mesh(bodyGeo, bodyMat);
    this.mesh.add(this.body);

    // Wing extensions
    const wingGeo = new THREE.BoxGeometry(1.2, 0.08, 0.35);
    const wingMat = new THREE.MeshStandardMaterial({
      color: 0x00cc66,
      emissive: 0x00cc66,
      emissiveIntensity: 0.8,
      metalness: 0.2,
      roughness: 0.5,
    });
    this.wings = new THREE.Mesh(wingGeo, wingMat);
    this.wings.position.set(0, -0.1, 0.15);
    this.mesh.add(this.wings);

    // Engine glow
    const engineGeo = new THREE.SphereGeometry(0.12, 8, 6);
    const engineMat = new THREE.MeshStandardMaterial({
      color: 0x44ffcc,
      emissive: 0x44ffcc,
      emissiveIntensity: 2.5,
      transparent: true,
      opacity: 0.9,
    });
    this.engine = new THREE.Mesh(engineGeo, engineMat);
    this.engine.position.set(0, -0.35, 0.1);
    this.mesh.add(this.engine);

    this.mesh.position.copy(this.position);
    scene.add(this.mesh);

    // Shield visual (for power-up)
    const shieldGeo = new THREE.SphereGeometry(0.8, 16, 12);
    const shieldMat = new THREE.MeshStandardMaterial({
      color: 0x44aaff,
      emissive: 0x44aaff,
      emissiveIntensity: 0.5,
      transparent: true,
      opacity: 0.15,
      side: THREE.DoubleSide,
    });
    this.shieldMesh = new THREE.Mesh(shieldGeo, shieldMat);
    this.shieldMesh.visible = false;
    this.mesh.add(this.shieldMesh);
    this.hasShield = false;
    this.shieldTimer = 0;

    // Spread shot power-up state
    this.spreadShotActive = false;
    this.spreadShotTimer = 0;

    // Rapid fire power-up state
    this.rapidFireActive = false;
    this.rapidFireTimer = 0;
  }

  update(deltaTime, input) {
    if (this.lives <= 0) return;

    // Handle shooting cooldown
    this.shootCooldown -= deltaTime;

    // Handle invulnerability blink timer
    if (this.isInvulnerable) {
      this.invulnerabilityTimer -= deltaTime;
      this.blinkTimer += deltaTime;
      const visible = Math.floor(this.blinkTimer * 8) % 2 === 0;
      this.mesh.visible = visible;

      if (this.invulnerabilityTimer <= 0) {
        this.isInvulnerable = false;
        this.mesh.visible = true;
      }
    }

    // Handle shield timer
    if (this.hasShield) {
      this.shieldTimer -= deltaTime;
      this.shieldMesh.visible = true;
      this.shieldMesh.rotation.y += deltaTime * 2;
      if (this.shieldTimer <= 0) {
        this.hasShield = false;
        this.shieldMesh.visible = false;
      }
    }

    // Handle spread shot timer
    if (this.spreadShotActive) {
      this.spreadShotTimer -= deltaTime;
      if (this.spreadShotTimer <= 0) {
        this.spreadShotActive = false;
      }
    }

    // Handle rapid fire timer
    if (this.rapidFireActive) {
      this.rapidFireTimer -= deltaTime;
      if (this.rapidFireTimer <= 0) {
        this.rapidFireActive = false;
      }
    }

    // Movement input
    const moveInput = input.getAxis('move');
    const speed = this.config.PLAYER_SPEED;
    this.velocity.x = moveInput * speed;
    this.position.x += this.velocity.x * deltaTime;
    this.position.x = Math.max(this.config.PLAYER_X_MIN, Math.min(this.config.PLAYER_X_MAX, this.position.x));

    // Update mesh position
    this.mesh.position.copy(this.position);

    // Engine flicker effect
    if (moveInput !== 0) {
      this.engine.scale.setScalar(0.8 + Math.random() * 0.4);
    } else {
      this.engine.scale.setScalar(1.0);
    }
  }

  shoot(projectilePool, projectiles) {
    if (this.lives <= 0 || this.isInvulnerable) return null;

    const cooldown = this.rapidFireActive ? this.config.RAPID_FIRE_COOLDOWN : this.config.PLAYER_SHOOT_COOLDOWN;
    if (this.shootCooldown > 0) return null;

    this.shootCooldown = cooldown;

    if (this.spreadShotActive) {
      // Spread shot: fire 3 projectiles in a fan pattern
      for (let i = -1; i <= 1; i++) {
        const p = projectilePool.acquire();
        const vel = new THREE.Vector3(i * 2, this.config.PROJECTILE_SPEED, 0);
        p.init(
          new THREE.Vector3(this.position.x + i * 0.3, this.position.y + 0.5, 0),
          vel,
          0x44ffcc,
          true
        );
        projectiles.push(p);
      }
    } else {
      // Single shot
      const projectile = projectilePool.acquire();
      const vel = new THREE.Vector3(0, this.config.PROJECTILE_SPEED, 0);
      projectile.init(this.position.clone().add(new THREE.Vector3(0, 0.5, 0)), vel, 0x44ffcc, true);
      projectiles.push(projectile);
    }

    return null;
  }

  takeDamage() {
    if (this.isInvulnerable || this.hasShield) return false;

    this.lives--;

    // Set invulnerability frames
    this.isInvulnerable = true;
    this.invulnerabilityTimer = 1.5;
    this.blinkTimer = 0;

    return this.lives <= 0;
  }

  activateShield(duration) {
    this.hasShield = true;
    this.shieldTimer = duration;
  }

  deactivateShield() {
    this.hasShield = false;
    this.shieldMesh.visible = false;
  }

  setSpreadShot(active) {
    this.spreadShotActive = active;
    if (active) {
      this.spreadShotTimer = this.config.POWERUP_DURATION_SPREAD;
    } else {
      this.spreadShotTimer = 0;
    }
  }

  setRapidFire(active) {
    this.rapidFireActive = active;
    if (active) {
      this.rapidFireTimer = this.config.POWERUP_DURATION_RAPID;
    } else {
      this.rapidFireTimer = 0;
    }
  }

  destroy() {
    this.scene.remove(this.mesh);
    this.body.geometry.dispose();
    this.body.material.dispose();
    this.wings.geometry.dispose();
    this.wings.material.dispose();
    this.engine.geometry.dispose();
    this.engine.material.dispose();
    if (this.shieldMesh) {
      this.shieldMesh.geometry.dispose();
      this.shieldMesh.material.dispose();
    }
  }

  getMesh() {
    return this.mesh;
  }

  getPosition() {
    return this.position.clone();
  }

  isInvulnerable() {
    return this.isInvulnerable;
  }

  getInputDirection() {
    return this.direction;
  }

  getBounds() {
    const pos = this.position;
    return {
      minX: pos.x - 0.6,
      maxX: pos.x + 0.6,
      minY: pos.y - 0.4,
      maxY: pos.y + 0.4,
    };
  }

  reset() {
    this.lives = this.config.PLAYER_LIVES;
    this.position.set(0, this.config.PLAYER_Y, 0);
    this.isInvulnerable = false;
    this.invulnerabilityTimer = 0;
    this.hasShield = false;
    this.shieldMesh.visible = false;
    this.spreadShotActive = false;
    this.rapidFireActive = false;
    this.mesh.position.copy(this.position);
    this.mesh.visible = true;
  }
}
