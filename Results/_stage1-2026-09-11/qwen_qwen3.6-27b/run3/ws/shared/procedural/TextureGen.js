import SimplexNoise from './SimplexNoise.js'

/**
 * Create a Three.js CanvasTexture from a draw function.
 * @param {function(CanvasRenderingContext2D, number, number): void} drawFn
 * @param {number} width
 * @param {number} height
 * @returns {THREE.CanvasTexture}
 */
export function createCanvasTexture(drawFn, width = 256, height = 256) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  drawFn(ctx, width, height)
  const texture = new THREE.CanvasTexture(canvas)
  texture.generateMipmaps = false
  texture.minFilter = THREE.NearestFilter
  texture.magFilter = THREE.NearestFilter
  return texture
}

/**
 * Create a noise-based texture (nebula, terrain, etc.).
 * @param {number} width
 * @param {number} height
 * @param {number} octaves
 * @param {string[]} colorMap - Array of hex color strings for gradient mapping
 * @param {number} [seed=42]
 * @returns {THREE.CanvasTexture}
 */
export function createNoiseTexture(width = 512, height = 512, octaves = 4, colorMap = ['#1a0033', '#330066', '#003366', '#006666'], seed = 42) {
  const noise = new SimplexNoise(seed)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  const imageData = ctx.createImageData(width, height)
  const data = imageData.data
  const scale = 4.0

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let value = 0
      let amplitude = 1
      let frequency = 1
      for (let o = 0; o < octaves; o++) {
        value += amplitude * (noise.noise2D(x / width * scale * frequency, y / height * scale * frequency) + 1) * 0.5
        amplitude *= 0.5
        frequency *= 2
      }
      value = Math.max(0, Math.min(1, value))
      const colorIdx = Math.floor(value * (colorMap.length - 1))
      const t = value * (colorMap.length - 1) - colorIdx
      const c1 = hexToRgb(colorMap[Math.min(colorIdx, colorMap.length - 1)])
      const c2 = hexToRgb(colorMap[Math.min(colorIdx + 1, colorMap.length - 1)])
      const idx = (y * width + x) * 4
      data[idx] = c1.r + (c2.r - c1.r) * t
      data[idx + 1] = c1.g + (c2.g - c1.g) * t
      data[idx + 2] = c1.b + (c2.b - c1.b) * t
      data[idx + 3] = 255
    }
  }
  ctx.putImageData(imageData, 0, 0)
  const texture = new THREE.CanvasTexture(canvas)
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  return texture
}

/**
 * Create a pixel-art alien texture via Canvas.
 * @param {string} type - 'commander', 'elite', 'soldier', 'grunt', 'drone'
 * @param {number} frame - 0 or 1 for animation
 * @param {number} size - pixel size (default 32)
 * @returns {THREE.CanvasTexture}
 */
export function createAlienTexture(type, frame = 0, size = 32) {
  return createCanvasTexture((ctx, w, h) => {
    const colors = {
      commander: { body: '#ff0066', accent: '#ff6699' },
      elite: { body: '#ff3300', accent: '#ff8844' },
      soldier: { body: '#ff6600', accent: '#ffaa44' },
      grunt: { body: '#ffcc00', accent: '#ffee66' },
      drone: { body: '#66ff00', accent: '#aaff66' }
    }
    const c = colors[type] || colors.drone
    ctx.fillStyle = c.body
    const px = size / 16
    // Draw pixel-art alien shapes based on type
    const pixels = getAlienPixels(type, frame)
    for (const [px2, py, color] of pixels) {
      ctx.fillStyle = color === 'accent' ? c.accent : c.body
      ctx.fillRect(px2 * px, py * px, px, px)
    }
  }, size, size)
}

function getAlienPixels(type, frame) {
  // Returns array of [x, y, color] in 16x16 grid
  const legOffset = frame === 0 ? 0 : 1
  const pixels = []
  switch (type) {
    case 'commander':
      // Crown-like top, wide body
      pixels.push([7, 2, 'accent'], [8, 2, 'accent'])
      pixels.push([6, 3, 'body'], [7, 3, 'body'], [8, 3, 'body'], [9, 3, 'body'])
      pixels.push([5, 4, 'body'], [6, 4, 'body'], [7, 4, 'accent'], [8, 4, 'accent'], [9, 4, 'body'], [10, 4, 'body'])
      pixels.push([4, 5, 'body'], [5, 5, 'body'], [6, 5, 'body'], [7, 5, 'body'], [8, 5, 'body'], [9, 5, 'body'], [10, 5, 'body'], [11, 5, 'body'])
      pixels.push([3, 6, 'body'], [4, 6, 'body'], [5, 6, 'accent'], [6, 6, 'body'], [7, 6, 'body'], [8, 6, 'body'], [9, 6, 'body'], [10, 6, 'accent'], [11, 6, 'body'], [12, 6, 'body'])
      pixels.push([2, 7, 'body'], [3, 7, 'body'], [4, 7, 'body'], [5, 7, 'body'], [6, 7, 'body'], [7, 7, 'body'], [8, 7, 'body'], [9, 7, 'body'], [10, 7, 'body'], [11, 7, 'body'], [12, 7, 'body'], [13, 7, 'body'])
      pixels.push([3, 8, 'body'], [4, 8, 'body'], [5, 8, 'body'], [10, 8, 'body'], [11, 8, 'body'], [12, 8, 'body'])
      pixels.push([4, 9, 'body'], [5, 9, 'body'], [10, 9, 'body'], [11, 9, 'body'])
      pixels.push([4, 10 + legOffset, 'body'], [5, 10 + legOffset, 'body'], [10, 10 + legOffset, 'body'], [11, 10 + legOffset, 'body'])
      break
    case 'elite':
      pixels.push([6, 2, 'body'], [7, 2, 'body'], [8, 2, 'body'], [9, 2, 'body'])
      pixels.push([5, 3, 'body'], [6, 3, 'body'], [7, 3, 'body'], [8, 3, 'body'], [9, 3, 'body'], [10, 3, 'body'])
      pixels.push([4, 4, 'body'], [5, 4, 'accent'], [6, 4, 'body'], [7, 4, 'body'], [8, 4, 'body'], [9, 4, 'body'], [10, 4, 'accent'], [11, 4, 'body'])
      pixels.push([3, 5, 'body'], [4, 5, 'body'], [5, 5, 'body'], [6, 5, 'body'], [7, 5, 'body'], [8, 5, 'body'], [9, 5, 'body'], [10, 5, 'body'], [11, 5, 'body'], [12, 5, 'body'])
      pixels.push([2, 6, 'body'], [3, 6, 'body'], [4, 6, 'body'], [5, 6, 'body'], [10, 6, 'body'], [11, 6, 'body'], [12, 6, 'body'], [13, 6, 'body'])
      pixels.push([3, 7, 'body'], [4, 7, 'body'], [5, 7, 'body'], [10, 7, 'body'], [11, 7, 'body'], [12, 7, 'body'])
      pixels.push([4, 8, 'body'], [5, 8, 'body'], [10, 8, 'body'], [11, 8, 'body'])
      pixels.push([5, 9 + legOffset, 'body'], [6, 9 + legOffset, 'body'], [9, 9 + legOffset, 'body'], [10, 9 + legOffset, 'body'])
      break
    case 'soldier':
      pixels.push([7, 2, 'accent'], [8, 2, 'accent'])
      pixels.push([6, 3, 'body'], [7, 3, 'body'], [8, 3, 'body'], [9, 3, 'body'])
      pixels.push([5, 4, 'body'], [6, 4, 'body'], [7, 4, 'body'], [8, 4, 'body'], [9, 4, 'body'], [10, 4, 'body'])
      pixels.push([4, 5, 'body'], [5, 5, 'body'], [6, 5, 'accent'], [7, 5, 'body'], [8, 5, 'body'], [9, 5, 'accent'], [10, 5, 'body'], [11, 5, 'body'])
      pixels.push([3, 6, 'body'], [4, 6, 'body'], [5, 6, 'body'], [6, 6, 'body'], [9, 6, 'body'], [10, 6, 'body'], [11, 6, 'body'], [12, 6, 'body'])
      pixels.push([4, 7, 'body'], [5, 7, 'body'], [10, 7, 'body'], [11, 7, 'body'])
      pixels.push([5, 8 + legOffset, 'body'], [6, 8 + legOffset, 'body'], [9, 8 + legOffset, 'body'], [10, 8 + legOffset, 'body'])
      break
    case 'grunt':
      pixels.push([6, 3, 'body'], [7, 3, 'body'], [8, 3, 'body'], [9, 3, 'body'])
      pixels.push([5, 4, 'body'], [6, 4, 'body'], [7, 4, 'accent'], [8, 4, 'accent'], [9, 4, 'body'], [10, 4, 'body'])
      pixels.push([4, 5, 'body'], [5, 5, 'body'], [6, 5, 'body'], [7, 5, 'body'], [8, 5, 'body'], [9, 5, 'body'], [10, 5, 'body'], [11, 5, 'body'])
      pixels.push([3, 6, 'body'], [4, 6, 'body'], [5, 6, 'accent'], [6, 6, 'body'], [9, 6, 'body'], [10, 6, 'accent'], [11, 6, 'body'], [12, 6, 'body'])
      pixels.push([4, 7, 'body'], [5, 7, 'body'], [6, 7, 'body'], [9, 7, 'body'], [10, 7, 'body'], [11, 7, 'body'])
      pixels.push([5, 8 + legOffset, 'body'], [6, 8 + legOffset, 'body'], [9, 8 + legOffset, 'body'], [10, 8 + legOffset, 'body'])
      break
    case 'drone':
    default:
      pixels.push([7, 3, 'body'], [8, 3, 'body'])
      pixels.push([6, 4, 'body'], [7, 4, 'body'], [8, 4, 'body'], [9, 4, 'body'])
      pixels.push([5, 5, 'body'], [6, 5, 'body'], [7, 5, 'accent'], [8, 5, 'accent'], [9, 5, 'body'], [10, 5, 'body'])
      pixels.push([4, 6, 'body'], [5, 6, 'body'], [6, 6, 'body'], [7, 6, 'body'], [8, 6, 'body'], [9, 6, 'body'], [10, 6, 'body'], [11, 6, 'body'])
      pixels.push([5, 7, 'body'], [6, 7, 'body'], [9, 7, 'body'], [10, 7, 'body'])
      pixels.push([6, 8 + legOffset, 'body'], [7, 8 + legOffset, 'body'], [8, 8 + legOffset, 'body'], [9, 8 + legOffset, 'body'])
      break
  }
  return pixels
}

/**
 * Create player ship texture for a given damage state and animation frame.
 * @param {number} damageState - 0 (pristine) to 3 (critical)
 * @param {number} frame - 0 or 1
 * @param {number} size - pixel size
 * @returns {THREE.CanvasTexture}
 */
export function createPlayerShipTexture(damageState = 0, frame = 0, size = 32) {
  return createCanvasTexture((ctx, w, h) => {
    const px = size / 16
    ctx.fillStyle = '#003344'
    // Ship body - triangle shape
    const bodyPixels = [
      [7, 0], [8, 0],
      [6, 1], [7, 1], [8, 1], [9, 1],
      [5, 2], [6, 2], [7, 2], [8, 2], [9, 2], [10, 2],
      [4, 3], [5, 3], [6, 3], [7, 3], [8, 3], [9, 3], [10, 3], [11, 3],
      [3, 4], [4, 4], [5, 4], [6, 4], [7, 4], [8, 4], [9, 4], [10, 4], [11, 4], [12, 4],
      [3, 5], [4, 5], [5, 5], [6, 5], [7, 5], [8, 5], [9, 5], [10, 5], [11, 5], [12, 5],
      [4, 6], [5, 6], [6, 6], [7, 6], [8, 6], [9, 6], [10, 6], [11, 6],
      [5, 7], [6, 7], [9, 7], [10, 7],
      [6, 8], [7, 8], [8, 8], [9, 8]
    ]
    for (const [x, y] of bodyPixels) {
      ctx.fillStyle = '#003344'
      ctx.fillRect(x * px, y * px, px, px)
    }
    // Cockpit (emissive cyan)
    ctx.fillStyle = '#00ffff'
    ctx.fillRect(7 * px, 2 * px, px, px)
    ctx.fillRect(8 * px, 2 * px, px, px)
    ctx.fillRect(7 * px, 3 * px, px, px)
    ctx.fillRect(8 * px, 3 * px, px, px)
    // Engine glow
    const engineY = 8 + (frame === 0 ? 0 : 1)
    ctx.fillStyle = '#0088ff'
    ctx.fillRect(6 * px, engineY * px, px, px)
    ctx.fillRect(9 * px, engineY * px, px, px)
    // Damage overlays
    if (damageState >= 1) {
      ctx.fillStyle = 'rgba(255, 100, 0, 0.4)'
      ctx.fillRect(4 * px, 4 * px, px, px)
      ctx.fillRect(11 * px, 5 * px, px, px)
    }
    if (damageState >= 2) {
      ctx.fillStyle = 'rgba(255, 50, 0, 0.5)'
      ctx.fillRect(5 * px, 3 * px, px, px)
      ctx.fillRect(10 * px, 4 * px, px, px)
      ctx.fillRect(6 * px, 6 * px, px, px)
    }
    if (damageState >= 3) {
      ctx.fillStyle = 'rgba(255, 0, 0, 0.6)'
      ctx.fillRect(5 * px, 2 * px, px, px)
      ctx.fillRect(10 * px, 3 * px, px, px)
      ctx.fillRect(4 * px, 5 * px, px, px)
      ctx.fillRect(11 * px, 6 * px, px, px)
      ctx.fillRect(7 * px, 7 * px, px, px)
    }
  }, size, size)
}

function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : { r: 0, g: 0, b: 0 }
}
