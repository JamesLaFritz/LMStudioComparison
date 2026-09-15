import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/**
 * GeometryFactory — code-generated hulls for the retro-futurist roster.
 * Every sprite is a boolean pixel map; filled cells become unit boxes merged
 * into one BufferGeometry (one draw call per mesh). Two frames per species
 * drive the classic stomp animation. All geometries are cached and disposed
 * exactly once via disposeAll().
 */

const CELL = 0.92;   // box edge length — small gap reads as "vector" detail
const DEPTH = 0.62;  // hull thickness for PBR interest

// ── classic sprite bitmaps (two frames each) ────────────────────────────────
const SPRITES = {
	squid: [
		[
			'....##....',
			'...####...',
			'..######..',
			'.########.',
			'##########',
			'.#.####.#.',
			'#.#.##.#.#',
			'...##.##..'
		],
		[
			'....##....',
			'...####...',
			'..######..',
			'.########.',
			'##########',
			'#.#.##.#.#',
			'##.....###',
			'.#......#.'
		]
	],
	crab: [
		[
			'..#.....#..',
			'...#...#...',
			'..#######..',
			'.##.###.##.',
			'###########',
			'#.#######.#',
			'#.#.....#.#',
			'...#...#...'
		],
		[
			'..#.....#..',
			'#..#...#..#',
			'#.#######.#',
			'###.###.###',
			'############',
			'.##########.',
			'..#.....#..',
			'.#.......#.'
		]
	],
	octopus: [
		[
			'....####....',
			'.##########.',
			'############',
			'###.####.###',
			'############',
			'..#.#..#.#..',
			'#.######.#..',
			'##.#.##.#.##'
		],
		[
			'....####....',
			'.##########.',
			'############',
			'###.####.###',
			'############',
			'..#.#..#.#..',
			'...######...',
			'..#.#..#.#..'
		]
	],
	player: [
		[
			'......#......',
			'.....###.....',
			'.....###.....',
			'.###########.',
			'#############',
			'#############'
		]
	],
	ufo: [
		[
			'....#######....',
			'..###########..',
			'.#############.',
			'#.#.#.#.#.#.#.#',
			'###############'
		]
	]
};

const cache = new Map(); // key -> BufferGeometry

function hullFromMap(rows) {
	const boxes = [];
	for (let y = 0; y < rows.length; y++) {
		const row = rows[y];
		for (let x = 0; x < row.length; x++) {
			if (row[x] !== '#') continue;
			const box = new THREE.BoxGeometry(CELL, CELL, DEPTH);
			box.translate(x - (row.length - 1) / 2, y - (rows.length - 1) / 2, 0);
			boxes.push(box);
		}
	}
	if (!boxes.length) return new THREE.BoxGeometry(CELL, CELL, DEPTH);
	const merged = mergeGeometries(boxes, false);
	for (const b of boxes) b.dispose(); // source boxes are consumed by the merge
	return merged;
}

/** Cached hull geometry for a species + animation frame. */
export function invaderHull(species, frame = 0) {
	const key = `${species}:${frame}`;
	let geo = cache.get(key);
	if (!geo) {
		const frames = SPRITES[species] || SPRITES.crab;
		geo = hullFromMap(frames[frame % frames.length]);
		cache.set(key, geo);
	}
	return geo;
}

/** World-space bounding size (w, h) of a species' merged hull — for scaling to arena fit. */
export function hullBounds(species) {
	const frames = SPRITES[species] || SPRITES.crab;
	let w = 0;
	for (const row of frames[0]) if (row.includes('#')) w = Math.max(w, row.length);
	return { w: w * CELL, h: frames[0].length * CELL };
}

/** Cached player cannon hull. */
export function playerHull() {
	let geo = cache.get('player:0');
	if (!geo) {
		geo = hullFromMap(SPRITES.player[0]);
		cache.set('player:0', geo);
	}
	return geo;
}

/** Cached UFO saucer hull. */
export function ufoHull() {
	let geo = cache.get('ufo:0');
	if (!geo) {
		geo = hullFromMap(SPRITES.ufo[0]);
		cache.set('ufo:0', geo);
	}
	return geo;
}

/** Shared slim bullet geometry (player shot). */
export function bulletGeometry() {
	let geo = cache.get('bullet');
	if (!geo) {
		const g = new THREE.BoxGeometry(0.16, 0.72, 0.3);
		cache.set('bullet', g);
		return g;
	}
	return geo;
}

/** Shared bomb geometry (invader shot). */
export function bombGeometry() {
	let geo = cache.get('bomb');
	if (!geo) {
		const g = new THREE.BoxGeometry(0.26, 0.5, 0.3);
		g.translate(0, -0.18, 0); // tail offset reads as a falling bolt
		cache.set('bomb', g);
		return g;
	}
	return geo;
}

/** Shared power-up icon geometry (rounded cube). */
export function powerupGeometry() {
	let geo = cache.get('powerup');
	if (!geo) {
		const g = new THREE.BoxGeometry(0.5, 0.5, 0.34);
		cache.set('powerup', g);
		return g;
	}
	return geo;
}

/** Shared shield cell geometry (one bunker brick). */
export function shieldCellGeometry() {
	let geo = cache.get('shieldcell');
	if (!geo) {
		const g = new THREE.BoxGeometry(0.42, 0.3, 0.5);
		cache.set('shieldcell', g);
		return g;
	}
	return geo;
}

/** Dispose every cached geometry exactly once (Engine teardown). */
export function disposeAll() {
	for (const [key, geo] of cache) {
		geo.dispose();
		cache.delete(key);
	}
}
