import { BufferGeometry, LineBasicMaterial, Line, Vector3 } from 'three';

const MAX_TRAIL_POINTS = 32;

export class MotionTrail {
    constructor(color = 0x00ffff, opacity = 0.6, lineWidth = 2) {
        this.positions = [];
        this.geometry = new BufferGeometry();
        this.material = new LineBasicMaterial({
            color: color,
            transparent: true,
            opacity: opacity,
            linewidth: lineWidth,
            depthWrite: false,
        });
        this.line = new Line(this.geometry, this.material);
        this.line.frustumCulled = false;
        this.maxPoints = MAX_TRAIL_POINTS;
        this._updateGeometry();
    }

    addPosition(pos) {
        const v = pos.clone();
        this.positions.unshift(v);
        if (this.positions.length > this.maxPoints) {
            this.positions.pop();
        }
        this._updateGeometry();
    }

    _updateGeometry() {
        const points = this.positions.map(p => new Vector3(p.x, p.y, p.z));
        this.geometry.setFromPoints(points);
    }

    setOpacity(opacity) {
        this.material.opacity = opacity;
    }

    setColor(color) {
        this.material.color.setHex(color);
    }

    clear() {
        this.positions.length = 0;
        this._updateGeometry();
    }

    dispose() {
        this.geometry.dispose();
        this.material.dispose();
    }
}
