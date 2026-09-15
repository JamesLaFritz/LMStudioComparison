// ============================================================
// spriteGenerator.js — Procedural pixel-art texture generator
// Generates all Space Invaders sprites via Canvas API
// ============================================================

import { vec3 } from '../shared/utils/math.js';

/**
 * Generate a pixel-art texture for the given alien type.
 * @param {string} type - 'squid' | 'crab' | 'octopus'
 * @returns {Canvas2DImageData} The raw image data (width x height x 4 RGBA)
 */
export function generateAlienTexture(type) {
  const width = 32;
  const height = 32;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  // Color palette per alien type (RGB values)
  const colors = {
    squid:   [0, 255, 255],      // Cyan
    crab:    [255, 0, 255],      // Magenta
    octopus: [255, 255, 0],      // Yellow
  };

  const c = colors[type];

  // Draw pixel art for each alien type
  drawSquid(ctx, width, height, c[0], c[1], c[2]);
  drawCrab(ctx, width, height, c[0], c[1], c[2]);
  drawOctopus(ctx, width, height, c[0], c[1], c[2]);

  return canvas.getImageData(0, 0, width, height);
}

/**
 * Draw a squid alien (top row) — distinctive antenna and body shape.
 */
function drawSquid(ctx, w, h, r, g, b) {
  const px = 1; // pixel size

  // Antenna (two points at top center)
  ctx.fillStyle = `rgb(${r},${g},${b})`;
  ctx.fillRect(13 * px, 0, 2 * px, 4);
  ctx.fillRect(16 * px, 0, 2 * px, 4);

  // Head body (wide)
  ctx.fillRect(7 * px, 5, 18 * px, 4);

  // Body middle
  ctx.fillRect(6 * px, 9, 20 * px, 4);

  // Body bottom
  ctx.fillRect(8 * px, 13, 16 * px, 4);

  // Legs (spread out)
  ctx.fillRect(5 * px, 17, 2 * px, 6);
  ctx.fillRect(9 * px, 17, 2 * px, 6);
  ctx.fillRect(13 * px, 17, 2 * px, 6);
  ctx.fillRect(17 * px, 17, 2 * px, 6);

  // Tentacles (long downward)
  ctx.fillRect(5 * px, 21, 2 * px, 8);
  ctx.fillRect(9 * px, 21, 2 * px, 8);
  ctx.fillRect(13 * px, 21, 2 * px, 8);
  ctx.fillRect(17 * px, 21, 2 * px, 8);

  // Eyes (two small dots)
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.fillRect(10 * px, 9, 2 * px, 2);
  ctx.fillRect(13 * px, 9, 2 * px, 2);

  // Reset to full color for any remaining details
  ctx.fillStyle = `rgb(${r},${g},${b})`;
}

/**
 * Draw a crab alien (middle rows) — claws and body.
 */
function drawCrab(ctx, w, h, r, g, b) {
  const px = 1;

  // Claws (top-left and top-right)
  ctx.fillStyle = `rgb(${r},${g},${b})`;
  ctx.fillRect(4 * px, 2, 6 * px, 3);
  ctx.fillRect(22 * px, 2, 6 * px, 3);

  // Head
  ctx.fillRect(7 * px, 5, 18 * px, 4);

  // Body
  ctx.fillRect(6 * px, 9, 20 * px, 4);

  // Lower body
  ctx.fillRect(8 * px, 13, 16 * px, 4);

  // Legs (middle)
  ctx.fillRect(5 * px, 17, 2 * px, 5);
  ctx.fillRect(9 * px, 17, 2 * px, 5);
  ctx.fillRect(13 * px, 17, 2 * px, 5);
  ctx.fillRect(17 * px, 17, 2 * px, 5);

  // Antennae (top)
  ctx.fillRect(10 * px, 0, 2 * px, 3);
  ctx.fillRect(16 * px, 0, 2 * px, 3);

  // Eyes
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.fillRect(10 * px, 9, 2 * px, 2);
  ctx.fillRect(13 * px, 9, 2 * px, 2);

  // Reset to full color
  ctx.fillStyle = `rgb(${r},${g},${b})`;
}

/**
 * Draw an octopus alien (bottom rows) — compact body.
 */
function drawOctopus(ctx, w, h, r, g, b) {
  const px = 1;

  // Head
  ctx.fillStyle = `rgb(${r},${g},${b})`;
  ctx.fillRect(8 * px, 4, 16 * px, 5);

  // Body
  ctx.fillRect(7 * px, 9, 18 * px, 4);

  // Legs (spread)
  ctx.fillRect(5 * px, 13, 2 * px, 6);
  ctx.fillRect(9 * px, 13, 2 * px, 6);
  ctx.fillRect(13 * px, 13, 2 * px, 6);
  ctx.fillRect(17 * px, 13, 2 * px, 6);

  // Tentacles (long)
  ctx.fillRect(5 * px, 19, 2 * px, 8);
  ctx.fillRect(9 * px, 19, 2 * px, 8);
  ctx.fillRect(13 * px, 19, 2 * px, 8);
  ctx.fillRect(17 * px, 19, 2 * px, 8);

  // Eyes
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.fillRect(10 * px, 6, 2 * px, 2);
  ctx.fillRect(13 * px, 6, 2 * px, 2);

  // Reset to full color
  ctx.fillStyle = `rgb(${r},${g},${b})`;
}