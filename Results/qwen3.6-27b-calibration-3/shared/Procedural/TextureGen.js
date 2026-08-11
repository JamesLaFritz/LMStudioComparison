/**
 * TextureGen — Canvas API procedural texture generation.
 * All textures are generated at runtime; no external image files.
 */

/**
 * Generate a neon grid texture (used for court floors, backgrounds).
 */
export function createGridTexture(width = 512, height = 512, cellSize = 32, lineColor = '#00ffff', bgColor = '#050510', lineWidth = 2) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  // Background
  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, width, height);

  // Grid lines
  ctx.strokeStyle = lineColor;
  ctx.lineWidth = lineWidth;
  ctx.globalAlpha = 0.4;

  for (let x = 0; x <= width; x += cellSize) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  for (let y = 0; y <= height; y += cellSize) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  ctx.globalAlpha = 1.0;
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

/**
 * Generate a starfield texture for background.
 */
export function createStarfieldTexture(width = 1024, height = 1024, starCount = 500) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  // Dark background
  ctx.fillStyle = '#020208';
  ctx.fillRect(0, 0, width, height);

  // Stars
  for (let i = 0; i < starCount; i++) {
    const x = Math.random() * width;
    const y = Math.random() * height;
    const radius = Math.random() * 2 + 0.5;
    const brightness = Math.random() * 0.7 + 0.3;
    const hue = Math.random() > 0.7 ? (Math.random() * 60 + 180) : 0; // Mostly white, some blue/purple
    const sat = hue === 0 ? 0 : 80;

    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = `hsla(${hue}, ${sat}%, ${brightness * 100}%, ${brightness})`;
    ctx.fill();

    // Glow for brighter stars
    if (radius > 1.5) {
      const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius * 4);
      gradient.addColorStop(0, `hsla(${hue}, ${sat}%, 80%, 0.3)`);
      gradient.addColorStop(1, `hsla(${hue}, ${sat}%, 80%, 0)`);
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(x, y, radius * 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  return texture;
}

/**
 * Generate a noise texture (grain/static).
 */
export function createNoiseTexture(width = 256, height = 256, intensity = 0.15) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  const imageData = ctx.createImageData(width, height);
  const data = imageData.data;

  for (let i = 0; i < data.length; i += 4) {
    const noise = Math.random() * 255;
    data[i] = noise;
    data[i + 1] = noise;
    data[i + 2] = noise;
    data[i + 3] = noise * intensity;
  }

  ctx.putImageData(imageData, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

/**
 * Generate a scanline overlay texture.
 */
export function createScanlineTexture(width = 256, height = 256, lineSpacing = 4) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = 'rgba(0, 0, 0, 0)';
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
  for (let y = 0; y < height; y += lineSpacing) {
    ctx.fillRect(0, y, width, 1);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

/**
 * Generate a gradient texture (radial or linear).
 */
export function createGradientTexture(width = 512, height = 512, color1 = '#00ffff', color2 = '#050510', type = 'radial') {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  let gradient;
  if (type === 'radial') {
    gradient = ctx.createRadialGradient(width / 2, height / 2, 0, width / 2, height / 2, width / 2);
  } else {
    gradient = ctx.createLinearGradient(0, 0, width, height);
  }

  gradient.addColorStop(0, color1);
  gradient.addColorStop(1, color2);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  const texture = new THREE.CanvasTexture(canvas);
  return texture;
}

/**
 * Generate a neon glow texture (soft radial glow).
 */
export function createGlowTexture(width = 128, height = 128, color = '#00ffff') {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  const gradient = ctx.createRadialGradient(width / 2, height / 2, 0, width / 2, height / 2, width / 2);
  gradient.addColorStop(0, color);
  gradient.addColorStop(0.3, color + '88');
  gradient.addColorStop(0.7, color + '22');
  gradient.addColorStop(1, 'transparent');

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  const texture = new THREE.CanvasTexture(canvas);
  return texture;
}

/**
 * Generate a checkerboard texture.
 */
export function createCheckerTexture(width = 256, height = 256, cellSize = 32, color1 = '#0a0a2e', color2 = '#0f0f3d') {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  const cols = width / cellSize;
  const rows = height / cellSize;

  for (let x = 0; x < cols; x++) {
    for (let y = 0; y < rows; y++) {
      ctx.fillStyle = (x + y) % 2 === 0 ? color1 : color2;
      ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

/**
 * Generate a holographic / iridescent texture.
 */
export function createHoloTexture(width = 512, height = 512) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  const imageData = ctx.createImageData(width, height);
  const data = imageData.data;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const hue = ((x / width) * 360 + (y / height) * 180) % 360;
      const [r, g, b] = hslToRgb(hue / 360, 0.8, 0.5);
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = 255;
    }
  }

  ctx.putImageData(imageData, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  return texture;
}

// HSL to RGB helper
function hslToRgb(h, s, l) {
  let r, g, b;
  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}
