import { Vector3, Matrix4 } from 'three';
import { InvaderType } from './Invader.js';

const INVADER_SPEED_BASE = 0.8;
const INVADER_DESCENT_STEP = 0.4;
const INVADER_SHOOT_CHANCE_BASE = 0.002;
const UFO_SPAWN_INTERVAL_MIN = 15000;
const UFO_SPAWN_INTERVAL_MAX = 30000;

export class InvaderFormation {
    constructor(scene, entityPool) {
        this.scene = scene;
        this.entityPool = entityPool;
        this.invaders = [];
        this.rows = 5;
        this.cols = 11;
        this.spacingX = 2.0;
        this.spacingY = 1.6;
        this.startPos = new Vector3(-9, 4, 0);
        this.direction = 1;
        this.moveSpeed = INVADER_SPEED_BASE;
        this.shootChance = INVADER_SHOOT_CHANCE_BASE;
        this.waveNumber = 1;
        this.state = 'IDLE';
        this.idleTimer = 0;
        this.descentInProgress = false;
        this.ufoSpawnTimer = 0;
        this.ufoInterval = UFO_SPAWN_INTERVAL_MIN + Math.random() * (UFO_SPAWN_INTERVAL_MAX - UFO_SPAWN_INTERVAL_MIN);
        this.ufo = null;
        this.marchPhase = 0;
    }

    initialize(waveNumber, playerShip) {
        this.waveNumber = waveNumber;
        this.moveSpeed = INVADER_SPEED_BASE * (1 + (waveNumber - 1) * 0.35);
        this.shootChance = INVADER_SHOOT_CHANCE_BASE * (1 + (waveNumber - 1) * 0.4);
        this.direction = 1;
        this.state = 'IDLE';
        this.idleTimer = 0.8;
        this.descentInProgress = false;
        this.ufoSpawnTimer = 0;
        this.ufoInterval = Math.max(10000, UFO_SPAWN_INTERVAL_MIN - (waveNumber - 1) * 2000);
        this.marchPhase = 0;

        for (let i = 0; i < this.invaders.length; i++) {
            const inv = this.invaders[i];
            if (inv && inv.mesh) {
                this.scene.remove(inv.mesh);
                inv.dispose();
            }
        }
        this.invaders = [];

        for (let row = 0; row < this.rows; row++) {
            for (let col = 0; col < this.cols; col++) {
                const type = this._getTypeForRow(row);
                const invader = this.entityPool.acquire();
                if (!invader) continue;

                const x = this.startPos.x + (col - Math.floor(this.cols / 2)) * this.spacingX;
                const y = this.startPos.y - row * this.spacingY;

                invader.initialize(type, new Vector3(x, y, 0));
                this.scene.add(invader.mesh);
                this.invaders.push(invader);
            }
        }

        if (this.ufo) {
            this.scene.remove(this.ufo.mesh);
            this.ufo.dispose();
            this.ufo = null;
        }
    }

    _getTypeForRow(row) {
        if (row === 0) return InvaderType.TOP;
        if (row <= 2) return InvaderType.MID;
        return InvaderType.BOTTOM;
    }

    update(dt, playerShip, audioSynth, particleManager, hitStopController, cameraShake) {
        this.marchPhase += dt * (3 + this.waveNumber * 0.5);

        if (this.state === 'IDLE') {
            this.idleTimer -= dt;
            if (this.idleTimer <= 0) {
                this.state = 'MOVING';
            }
            return;
        }

        const aliveCount = this.invaders.filter(inv => inv.alive).length;
        if (aliveCount === 0) {
            this.state = 'WAVE_COMPLETE';
            return;
        }

        const speedMultiplier = Math.max(1.0, (55 - aliveCount) / 20);
        const currentSpeed = this.moveSpeed * speedMultiplier;

        let needDescent = false;
        let minX = Infinity;
        let maxX = -Infinity;

        for (const inv of this.invaders) {
            if (!inv.alive) continue;
            inv.mesh.position.x += currentSpeed * this.direction * dt;
            const bobOffset = Math.sin(this.marchPhase + inv.mesh.position.x * 0.5) * 0.08;
            inv.mesh.position.y += bobOffset * dt * 2;

            if (inv.mesh.position.x < minX) minX = inv.mesh.position.x;
            if (inv.mesh.position.x > maxX) maxX = inv.mesh.position.x;
        }

        const edgeThreshold = 10.5;
        if ((this.direction > 0 && maxX >= edgeThreshold) || (this.direction < 0 && minX <= -edgeThreshold)) {
            needDescent = true;
        }

        if (needDescent) {
            this.direction *= -1;
            for (const inv of this.invaders) {
                if (!inv.alive) continue;
                inv.mesh.position.y -= INVADER_DESCENT_STEP * Math.min(1, this.waveNumber * 0.3);
                if (inv.mesh.position.y < -5.5) {
                    inv.die(false);
                    cameraShake.addTrauma(2.0);
                }
            }
        }

        for (const inv of this.invaders) {
            if (!inv.alive) continue;
            if (Math.random() < this.shootChance * speedMultiplier * dt) {
                inv.fire(playerShip, audioSynth, particleManager, hitStopController);
            }
        }

        this.ufoSpawnTimer += dt * 1000;
        if (!this.ufo && this.ufoSpawnTimer >= this.ufoInterval) {
            this.ufoSpawnTimer = 0;
            this._spawnUFO();
        }

        if (this.ufo) {
            this.ufo.update(dt);
            if (!this.ufo.active) {
                this.scene.remove(this.ufo.mesh);
                this.ufo.dispose();
                this.ufo = null;
            }
        }
    }

    _spawnUFO() {
        const ufoModule = require('./UFO.js');
        const ufo = this.entityPool.acquireUFO();
        if (!ufo) return;

        const side = Math.random() > 0.5 ? 1 : -1;
        ufo.initialize(new Vector3(side * 14, 6.5, 0));
        this.scene.add(ufo.mesh);
        this.ufo = ufo;
    }

    dispose() {
        for (const inv of this.invaders) {
            if (inv && inv.mesh) {
                this.scene.remove(inv.mesh);
                inv.dispose();
            }
        }
        this.invaders = [];

        if (this.ufo) {
            this.scene.remove(this.ufo.mesh);
            this.ufo.dispose();
            this.ufo = null;
        }
    }

    getActiveInvaders() {
        return this.invaders.filter(inv => inv.alive);
    }
}
