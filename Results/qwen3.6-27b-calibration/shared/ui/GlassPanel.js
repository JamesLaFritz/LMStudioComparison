/**
 * GlassPanel — Glassmorphism HTML overlay builder.
 * Shared across all games.
 */

export class GlassPanel {
  /**
   * Create a glassmorphism panel element.
   * @param {object} [options]
   */
  static create(options = {}) {
    const panel = document.createElement('div');
    panel.className = 'glass-panel';

    // Default styles
    Object.assign(panel.style, {
      background: 'rgba(10, 10, 30, 0.6)',
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
      borderRadius: '12px',
      border: `1px solid ${options.borderColor || 'rgba(0, 255, 204, 0.3)'}`,
      boxShadow: `0 0 20px ${options.glowColor || 'rgba(0, 255, 204, 0.15)'}, inset 0 0 20px rgba(0, 255, 204, 0.05)`,
      padding: options.padding || '16px',
      color: options.color || '#e0e0ff',
      fontFamily: "'Segoe UI', Arial, sans-serif",
      fontSize: options.fontSize || '14px',
      position: options.position || 'relative',
      display: options.display || 'block',
    });

    if (options.width) panel.style.width = options.width;
    if (options.height) panel.style.height = options.height;
    if (options.id) panel.id = options.id;
    if (options.content) panel.innerHTML = options.content;

    return panel;
  }

  /**
   * Create a full-screen overlay panel.
   */
  static createOverlay(options = {}) {
    const overlay = document.createElement('div');
    overlay.className = 'glass-overlay';

    Object.assign(overlay.style, {
      position: 'fixed',
      top: '0',
      left: '0',
      width: '100%',
      height: '100%',
      background: 'rgba(5, 5, 20, 0.85)',
      backdropFilter: 'blur(8px)',
      WebkitBackdropFilter: 'blur(8px)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: '1000',
      color: '#e0e0ff',
      fontFamily: "'Segoe UI', Arial, sans-serif",
    });

    if (options.content) overlay.innerHTML = options.content;
    if (options.id) overlay.id = options.id;

    return overlay;
  }

  /**
   * Create a neon button.
   */
  static createButton(text, onClick, options = {}) {
    const btn = document.createElement('button');
    btn.textContent = text;
    btn.className = 'neon-button';

    const color = options.color || '#00ffcc';

    Object.assign(btn.style, {
      background: 'transparent',
      border: `2px solid ${color}`,
      borderRadius: '8px',
      color: color,
      padding: '12px 32px',
      fontSize: '18px',
      fontFamily: "'Segoe UI', Arial, sans-serif",
      fontWeight: 'bold',
      cursor: 'pointer',
      textTransform: 'uppercase',
      letterSpacing: '2px',
      boxShadow: `0 0 10px ${color}, inset 0 0 10px rgba(0,0,0,0.5)`,
      transition: 'all 0.2s ease',
      margin: options.margin || '8px',
    });

    btn.addEventListener('mouseenter', () => {
      btn.style.boxShadow = `0 0 25px ${color}, inset 0 0 15px ${color}33`;
      btn.style.transform = 'scale(1.05)';
      btn.style.background = `${color}22`;
    });

    btn.addEventListener('mouseleave', () => {
      btn.style.boxShadow = `0 0 10px ${color}, inset 0 0 10px rgba(0,0,0,0.5)`;
      btn.style.transform = 'scale(1)';
      btn.style.background = 'transparent';
    });

    if (onClick) {
      btn.addEventListener('click', onClick);
    }

    return btn;
  }

  /**
   * Create a neon text element.
   */
  static createNeonText(text, options = {}) {
    const el = document.createElement('div');
    el.textContent = text;

    const color = options.color || '#00ffcc';
    const size = options.size || '36px';

    Object.assign(el.style, {
      fontSize: size,
      fontWeight: 'bold',
      color: color,
      textShadow: `0 0 10px ${color}, 0 0 20px ${color}, 0 0 40px ${color}88`,
      fontFamily: "'Segoe UI', Arial, sans-serif",
      textAlign: 'center',
      margin: options.margin || '8px 0',
      letterSpacing: options.letterSpacing || '2px',
    });

    return el;
  }

  /**
   * Create a score display row.
   */
  static createScoreRow(label, value, options = {}) {
    const row = document.createElement('div');
    row.style.display = 'flex';
    row.style.justifyContent = 'space-between';
    row.style.alignItems = 'center';
    row.style.padding = '4px 0';
    row.style.borderBottom = `1px solid ${options.borderColor || 'rgba(0, 255, 204, 0.15)'}`;

    const labelEl = document.createElement('span');
    labelEl.textContent = label;
    labelEl.style.color = '#8888aa';
    labelEl.style.fontSize = '14px';
    labelEl.style.textTransform = 'uppercase';
    labelEl.style.letterSpacing = '1px';

    const valueEl = document.createElement('span');
    valueEl.textContent = value;
    valueEl.style.color = options.valueColor || '#00ffcc';
    valueEl.style.fontSize = '24px';
    valueEl.style.fontWeight = 'bold';
    valueEl.style.textShadow = `0 0 10px ${options.valueColor || '#00ffcc'}`;
    valueEl.className = options.valueClass || '';

    row.appendChild(labelEl);
    row.appendChild(valueEl);

    return row;
  }
}
