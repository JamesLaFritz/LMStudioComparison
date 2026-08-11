/**
 * GlassPanel — Glassmorphism HTML overlay builder.
 * Creates panels with backdrop-filter blur, semi-transparent backgrounds,
 * and neon glowing borders.
 */

export class GlassPanel {
  /**
   * @param {string} id - Unique element ID
   * @param {object} opts
   * @param {string} opts.position - CSS position (absolute/fixed)
   * @param {string} opts.top - CSS top
   * @param {string} opts.left - CSS left
   * @param {string} opts.width - CSS width
   * @param {string} opts.height - CSS height
   * @param {string} opts.glowColor - Neon glow color (hex)
   * @param {string} opts.borderRadius - Border radius
   * @param {number} opts.blur - Backdrop blur amount in px
   * @param {string} opts.background - Background color override
   */
  static create(id, opts = {}) {
    const {
      position = 'absolute',
      top = '0',
      left = '0',
      width = '100%',
      height = 'auto',
      glowColor = '#00ffff',
      borderRadius = '12px',
      blur = 16,
      background = 'rgba(255, 255, 255, 0.06)',
    } = opts;

    const panel = document.createElement('div');
    panel.id = id;
    panel.style.cssText = `
      position: ${position};
      top: ${top};
      left: ${left};
      width: ${width};
      min-height: ${height};
      padding: 16px;
      border-radius: ${borderRadius};
      backdrop-filter: blur(${blur}px);
      -webkit-backdrop-filter: blur(${blur}px);
      background: ${background};
      border: 1px solid rgba(255, 255, 255, 0.12);
      box-shadow: 0 0 20px ${glowColor}44, inset 0 0 20px rgba(255,255,255,0.03);
      color: #ffffff;
      font-family: 'Segoe UI', system-ui, sans-serif;
      pointer-events: none;
      user-select: none;
    `;

    return panel;
  }

  /**
   * Create a neon-glowing text element.
   * @param {string} text
   * @param {string} color - Neon color (hex)
   * @param {string} fontSize - Font size
   * @param {string} fontWeight - Font weight
   */
  static neonText(text, color = '#00ffff', fontSize = '24px', fontWeight = 'bold') {
    const el = document.createElement('span');
    el.textContent = text;
    el.style.cssText = `
      color: ${color};
      font-size: ${fontSize};
      font-weight: ${fontWeight};
      text-shadow: 0 0 10px ${color}, 0 0 20px ${color}88, 0 0 40px ${color}44;
    `;
    return el;
  }

  /**
   * Create a divider line with neon glow.
   * @param {string} color
   */
  static divider(color = '#00ffff') {
    const hr = document.createElement('hr');
    hr.style.cssText = `
      border: none;
      height: 1px;
      background: linear-gradient(90deg, transparent, ${color}, transparent);
      margin: 8px 0;
      box-shadow: 0 0 8px ${color}88;
    `;
    return hr;
  }
}
