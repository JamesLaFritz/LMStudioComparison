import * as THREE from 'three';

export class ScoreComponent {
    constructor() {
        this.score = 0;
        this.listeners = [];
    }

    addPoints(points, position3D) {
        if (points <= 0) return;
        this.score += points;
        for (const listener of this.listeners) {
            listener(this.score, points, position3D);
        }
    }

    onScoreChange(callback) {
        this.listeners.push(callback);
    }

    getScore() {
        return this.score;
    }

    reset() {
        this.score = 0;
        this.listeners.length = 0;
    }
}
