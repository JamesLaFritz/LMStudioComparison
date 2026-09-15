import { TimeScale } from '../../shared/core/TimeScale.js';
import { AudioEngine } from '../../shared/audio/AudioEngine.js';
import { EventEmitter } from '../../shared/math/MathUtils.js';

export const GameState = {
    MENU: 'MENU',
    PLAYING: 'PLAYING',
    GAME_OVER: 'GAME_OVER',
    LEVEL_UP: 'LEVEL_UP'
};

export class Engine {
    constructor(renderer, world, entities, audio) {
        this.renderer = renderer;
        this.world = world;
        this.entities = entities;
        this.audio = audio;
        
        this.state = GameState.MENU;
        this.score = 0;
        this.level = 1;
        this.events = new EventEmitter();

        this.timeScale = new TimeScale();
    }

    start() {
        this.state = GameState.PLAYING;
        this.audio.play('start_game');
        this.resetLevel();
    }

    resetLevel() {
        this.world.reset();
        this.entities.reset();
        this.state = GameState.PLAYING;
        this.timeScale.set(1.0);
        this.events.emit('level_start', { level: this.level });
    }

    update(delta) {
        const scaledDelta = delta * this.timeScale.get();

        if (this.state === GameStarte.PLAYING) {
            this.entities.update(scaledDelta);
            this.checkCollisions();
            this.checkWinLoss();
        }

        // Handle hit-stop decay if time scale was changed
        if (this.timeScale.get() < 1.0 && this.timeScale.get() > 0.1) {
            // We don't actually need to do anything here, 
            // the TimeScale class handles its own recovery logic if implemented that way,
            // but let's assume we manually manage it or it's part of the update loop.
        }
    }

    checkCollisions() {
        // Collision logic is handled within the Entity/Collision system interaction
        // But high-level game rules (like alien reaching bottom) live here.
        const aliens = this.entities.getEntitiesByType('alien');
        for (const alien of aliens) {
            if (alien.position.y <= this.renderer.player.position.y + 1) {
                this.gameOver();
            }
        }
    }

    checkWinLoss() {
        const aliens = this.entities.getEntitiesByType('alien');
        if (aliens.length === 0) {
            this.levelUp();
        }
    }

    levelUp() {
        this.level++;
        this.events.emit('level_up', { level: this.level });
        this.resetLevel();
    }

    gameOver() {
        this.state = GameState.GAME_OVER;
        this.timeScale.set(0.1); // Hit stop effect
        setTimeout(() => this.timeScale.set(1.0), 200);
        this.audio.play('game_over');
        this.events.emit('game_over', { score: this.score });
    }

    addScore(points) {
        this.score += points;
        this.events.emit('score_changed', { score: this.score });
    }
}
