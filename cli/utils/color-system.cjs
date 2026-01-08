/**
 * Advanced Color System for Dragon-UI CLI
 * Supports multiple color levels: No Color, 16 Colors, 256 Colors, Truecolor
 *
 * @module cli/utils/color-system
 */

'use strict';

const { env, stdout } = require('process');

/**
 * Color level constants
 */
const COLOR_LEVELS = {
  NONE: 0,      // No colors
  BASIC: 1,     // 16 colors (ansi16)
  ANSI256: 2,   // 256 colors
  TRUECOLOR: 3  // 16 million colors (hex/rgb)
};

/**
 * ANSI escape codes
 */
const ANSI = {
  RESET: '\x1b[0m',
  BOLD: '\x1b[1m',
  DIM: '\x1b[2m',
  ITALIC: '\x1b[3m',
  UNDERLINE: '\x1b[4m',
  BLINK: '\x1b[5m',
  INVERSE: '\x1b[7m',
  HIDDEN: '\x1b[8m',
  STRIKETHROUGH: '\x1b[9m'
};

/**
 * Named color map - 32 colors (8 regular + 8 bright + 16 background)
 */
const COLOR_MAP = {
  // Regular foreground colors (30-37)
  black: { fg: 30, bg: 40, ansi256: 0, hex: '000000' },
  red: { fg: 31, bg: 41, ansi256: 1, hex: 'cc0000' },
  green: { fg: 32, bg: 42, ansi256: 2, hex: '00cc00' },
  yellow: { fg: 33, bg: 43, ansi256: 3, hex: 'cccc00' },
  blue: { fg: 34, bg: 44, ansi256: 4, hex: '0000cc' },
  magenta: { fg: 35, bg: 45, ansi256: 5, hex: 'cc00cc' },
  cyan: { fg: 36, bg: 46, ansi256: 6, hex: '00cccc' },
  white: { fg: 37, bg: 47, ansi256: 7, hex: 'cccccc' },

  // Bright foreground colors (90-97)
  brightBlack: { fg: 90, bg: 100, ansi256: 8, hex: '666666' },
  brightRed: { fg: 91, bg: 101, ansi256: 9, hex: 'ff0000' },
  brightGreen: { fg: 92, bg: 102, ansi256: 10, hex: '00ff00' },
  brightYellow: { fg: 93, bg: 103, ansi256: 11, hex: 'ffff00' },
  brightBlue: { fg: 94, bg: 104, ansi256: 12, hex: '0000ff' },
  brightMagenta: { fg: 95, bg: 105, ansi256: 13, hex: 'ff00ff' },
  brightCyan: { fg: 96, bg: 106, ansi256: 14, hex: '00ffff' },
  brightWhite: { fg: 97, bg: 107, ansi256: 15, hex: 'ffffff' },

  // Extended named colors (mapped to ansi256)
  orange: { fg: null, bg: null, ansi256: 208, hex: 'ff8700' },
  pink: { fg: null, bg: null, ansi256: 213, hex: 'ff87ff' },
  purple: { fg: null, bg: null, ansi256: 93, hex: '8700ff' },
  lime: { fg: null, bg: null, ansi256: 118, hex: '87ff00' },
  teal: { fg: null, bg: null, ansi256: 30, hex: '008787' },
  navy: { fg: null, bg: null, ansi256: 17, hex: '00005f' },
  maroon: { fg: null, bg: null, ansi256: 52, hex: '5f0000' },
  olive: { fg: null, bg: null, ansi256: 58, hex: '5f5f00' },
  silver: { fg: null, bg: null, ansi256: 7, hex: 'c0c0c0' },
  gray: { fg: null, bg: null, ansi256: 244, hex: '808080' },
  grey: { fg: null, bg: null, ansi256: 244, hex: '808080' },
  gold: { fg: null, bg: null, ansi256: 220, hex: 'ffd700' },
  coral: { fg: null, bg: null, ansi256: 209, hex: 'ff875f' },
  salmon: { fg: null, bg: null, ansi256: 210, hex: 'ff8787' },
  khaki: { fg: null, bg: null, ansi256: 228, hex: 'ffff87' },
  violet: { fg: null, bg: null, ansi256: 177, hex: 'd787ff' }
};

/**
 * Detect terminal color support level
 * @returns {number} Color level (0-3)
 */
function detectColorLevel() {
  // Check for explicit NO_COLOR environment variable
  if ('NO_COLOR' in env || env.TERM === 'dumb') {
    return COLOR_LEVELS.NONE;
  }

  // Check for explicit FORCE_COLOR
  if ('FORCE_COLOR' in env) {
    const forceColor = env.FORCE_COLOR;
    if (forceColor === 'false' || forceColor === '0') {
      return COLOR_LEVELS.NONE;
    }
    if (forceColor === 'true' || forceColor === '1' || forceColor === '') {
      return COLOR_LEVELS.BASIC;
    }
    if (forceColor === '2') {
      return COLOR_LEVELS.ANSI256;
    }
    if (forceColor === '3') {
      return COLOR_LEVELS.TRUECOLOR;
    }
  }

  // Check if stdout is a TTY
  if (!stdout.isTTY) {
    return COLOR_LEVELS.NONE;
  }

  // Check for Windows Terminal (supports truecolor)
  if (env.WT_SESSION) {
    return COLOR_LEVELS.TRUECOLOR;
  }

  // Check COLORTERM
  if (env.COLORTERM === 'truecolor' || env.COLORTERM === '24bit') {
    return COLOR_LEVELS.TRUECOLOR;
  }

  // Check for specific terminals
  const term = env.TERM || '';
  const termProgram = env.TERM_PROGRAM || '';

  // Terminals known to support truecolor
  const truecolorTerms = ['iterm', 'hyper', 'alacritty', 'kitty', 'wezterm', 'contour'];
  if (truecolorTerms.some(t => termProgram.toLowerCase().includes(t))) {
    return COLOR_LEVELS.TRUECOLOR;
  }

  // Check for 256-color support
  if (term.includes('256color') || term.includes('256-color')) {
    return COLOR_LEVELS.ANSI256;
  }

  // Check for xterm
  if (term.startsWith('xterm')) {
    return COLOR_LEVELS.ANSI256;
  }

  // Check for screen/tmux
  if (term.startsWith('screen') || term.startsWith('tmux')) {
    return COLOR_LEVELS.ANSI256;
  }

  // Windows 10 build 14931+ supports 256 colors
  if (process.platform === 'win32') {
    const osRelease = require('os').release().split('.');
    if (parseInt(osRelease[0], 10) >= 10 && parseInt(osRelease[2], 10) >= 14931) {
      return COLOR_LEVELS.ANSI256;
    }
  }

  // Default to basic colors for any other TTY
  return COLOR_LEVELS.BASIC;
}

/**
 * Parse hex color string to RGB values
 * @param {string} hex - Hex color (with or without #)
 * @returns {{r: number, g: number, b: number}|null}
 */
function hexToRgb(hex) {
  // Remove # if present
  const cleanHex = hex.replace(/^#/, '');

  // Validate hex format
  if (!/^[0-9a-fA-F]{6}$/.test(cleanHex)) {
    return null;
  }

  return {
    r: parseInt(cleanHex.slice(0, 2), 16),
    g: parseInt(cleanHex.slice(2, 4), 16),
    b: parseInt(cleanHex.slice(4, 6), 16)
  };
}

/**
 * Convert RGB to nearest ANSI 256 color
 * @param {number} r - Red (0-255)
 * @param {number} g - Green (0-255)
 * @param {number} b - Blue (0-255)
 * @returns {number} ANSI 256 color code
 */
function rgbToAnsi256(r, g, b) {
  // Check if it's a grayscale color
  if (r === g && g === b) {
    if (r < 8) return 16;
    if (r > 248) return 231;
    return Math.round((r - 8) / 247 * 24) + 232;
  }

  // Convert to 6x6x6 color cube
  const rIndex = Math.round(r / 255 * 5);
  const gIndex = Math.round(g / 255 * 5);
  const bIndex = Math.round(b / 255 * 5);

  return 16 + (36 * rIndex) + (6 * gIndex) + bIndex;
}

/**
 * Convert RGB to nearest ANSI 16 color
 * @param {number} r - Red (0-255)
 * @param {number} g - Green (0-255)
 * @param {number} b - Blue (0-255)
 * @returns {number} ANSI 16 color code (30-37 or 90-97)
 */
function rgbToAnsi16(r, g, b) {
  // Calculate perceived brightness
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  const isBright = brightness > 128;

  // Determine the base color
  const rBit = r > 128 ? 1 : 0;
  const gBit = g > 128 ? 1 : 0;
  const bBit = b > 128 ? 1 : 0;

  // Calculate color index (0-7)
  const colorIndex = (rBit << 0) | (gBit << 1) | (bBit << 2);

  // Return bright or normal variant
  return (isBright ? 90 : 30) + colorIndex;
}

/**
 * Color System class
 */
class ColorSystem {
  /**
   * Create a new ColorSystem instance
   * @param {Object} options
   * @param {number} [options.level] - Force a specific color level
   */
  constructor(options = {}) {
    this._level = options.level !== undefined ? options.level : detectColorLevel();
    this._enabled = this._level > COLOR_LEVELS.NONE;
  }

  /**
   * Get current color level
   * @returns {number}
   */
  get level() {
    return this._level;
  }

  /**
   * Set color level
   * @param {number} level
   */
  set level(level) {
    this._level = Math.max(0, Math.min(3, level));
    this._enabled = this._level > COLOR_LEVELS.NONE;
  }

  /**
   * Check if colors are enabled
   * @returns {boolean}
   */
  get enabled() {
    return this._enabled;
  }

  /**
   * Enable or disable colors
   * @param {boolean} value
   */
  set enabled(value) {
    this._enabled = value;
    if (!value) {
      this._level = COLOR_LEVELS.NONE;
    }
  }

  /**
   * Parse a color string and return ANSI escape code
   * Supports: named colors, ansi256:N, hex:XXXXXX, rgb:R,G,B
   * @param {string} color - Color specification
   * @param {boolean} [isBackground=false] - Whether this is a background color
   * @returns {string} ANSI escape code
   */
  parseColor(color, isBackground = false) {
    if (!this._enabled || !color) {
      return '';
    }

    const colorStr = String(color).toLowerCase().trim();

    // Check for ansi256:N format
    if (colorStr.startsWith('ansi256:')) {
      const colorCode = parseInt(colorStr.slice(8), 10);
      if (colorCode >= 0 && colorCode <= 255) {
        return this._formatAnsi256(colorCode, isBackground);
      }
      return '';
    }

    // Check for hex:XXXXXX format
    if (colorStr.startsWith('hex:')) {
      const hex = colorStr.slice(4);
      return this._formatHex(hex, isBackground);
    }

    // Check for rgb:R,G,B format
    if (colorStr.startsWith('rgb:')) {
      const parts = colorStr.slice(4).split(',').map(n => parseInt(n.trim(), 10));
      if (parts.length === 3 && parts.every(n => n >= 0 && n <= 255)) {
        return this._formatRgb(parts[0], parts[1], parts[2], isBackground);
      }
      return '';
    }

    // Check for #XXXXXX format
    if (colorStr.startsWith('#')) {
      return this._formatHex(colorStr.slice(1), isBackground);
    }

    // Check for raw ANSI code (number)
    if (/^\d+$/.test(colorStr)) {
      const code = parseInt(colorStr, 10);
      if (code >= 0 && code <= 255) {
        return this._formatAnsi256(code, isBackground);
      }
      return '';
    }

    // Check named colors
    const namedColor = COLOR_MAP[colorStr];
    if (namedColor) {
      return this._formatNamedColor(namedColor, isBackground);
    }

    return '';
  }

  /**
   * Format ANSI 256 color code
   * @private
   */
  _formatAnsi256(code, isBackground) {
    if (this._level >= COLOR_LEVELS.ANSI256) {
      return isBackground ? `\x1b[48;5;${code}m` : `\x1b[38;5;${code}m`;
    }

    // Downgrade to 16 colors
    if (this._level >= COLOR_LEVELS.BASIC) {
      const rgb = this._ansi256ToRgb(code);
      const ansi16 = rgbToAnsi16(rgb.r, rgb.g, rgb.b);
      return `\x1b[${isBackground ? ansi16 + 10 : ansi16}m`;
    }

    return '';
  }

  /**
   * Format hex color
   * @private
   */
  _formatHex(hex, isBackground) {
    const rgb = hexToRgb(hex);
    if (!rgb) return '';

    return this._formatRgb(rgb.r, rgb.g, rgb.b, isBackground);
  }

  /**
   * Format RGB color
   * @private
   */
  _formatRgb(r, g, b, isBackground) {
    if (this._level >= COLOR_LEVELS.TRUECOLOR) {
      return isBackground ? `\x1b[48;2;${r};${g};${b}m` : `\x1b[38;2;${r};${g};${b}m`;
    }

    if (this._level >= COLOR_LEVELS.ANSI256) {
      const code = rgbToAnsi256(r, g, b);
      return isBackground ? `\x1b[48;5;${code}m` : `\x1b[38;5;${code}m`;
    }

    if (this._level >= COLOR_LEVELS.BASIC) {
      const ansi16 = rgbToAnsi16(r, g, b);
      return `\x1b[${isBackground ? ansi16 + 10 : ansi16}m`;
    }

    return '';
  }

  /**
   * Format named color
   * @private
   */
  _formatNamedColor(colorDef, isBackground) {
    // Use direct ANSI code if available and level is basic
    if (this._level === COLOR_LEVELS.BASIC && colorDef.fg !== null) {
      return `\x1b[${isBackground ? colorDef.bg : colorDef.fg}m`;
    }

    // Use ANSI 256 or truecolor
    if (colorDef.hex) {
      return this._formatHex(colorDef.hex, isBackground);
    }

    // Fallback to ANSI 256
    if (colorDef.ansi256 !== undefined) {
      return this._formatAnsi256(colorDef.ansi256, isBackground);
    }

    return '';
  }

  /**
   * Convert ANSI 256 code to RGB
   * @private
   */
  _ansi256ToRgb(code) {
    // Standard colors (0-15)
    if (code < 16) {
      const colors = [
        { r: 0, g: 0, b: 0 },       // 0: black
        { r: 128, g: 0, b: 0 },     // 1: maroon
        { r: 0, g: 128, b: 0 },     // 2: green
        { r: 128, g: 128, b: 0 },   // 3: olive
        { r: 0, g: 0, b: 128 },     // 4: navy
        { r: 128, g: 0, b: 128 },   // 5: purple
        { r: 0, g: 128, b: 128 },   // 6: teal
        { r: 192, g: 192, b: 192 }, // 7: silver
        { r: 128, g: 128, b: 128 }, // 8: gray
        { r: 255, g: 0, b: 0 },     // 9: red
        { r: 0, g: 255, b: 0 },     // 10: lime
        { r: 255, g: 255, b: 0 },   // 11: yellow
        { r: 0, g: 0, b: 255 },     // 12: blue
        { r: 255, g: 0, b: 255 },   // 13: fuchsia
        { r: 0, g: 255, b: 255 },   // 14: aqua
        { r: 255, g: 255, b: 255 }  // 15: white
      ];
      return colors[code];
    }

    // Color cube (16-231)
    if (code < 232) {
      const index = code - 16;
      const r = Math.floor(index / 36);
      const g = Math.floor((index % 36) / 6);
      const b = index % 6;
      return {
        r: r > 0 ? r * 40 + 55 : 0,
        g: g > 0 ? g * 40 + 55 : 0,
        b: b > 0 ? b * 40 + 55 : 0
      };
    }

    // Grayscale (232-255)
    const gray = (code - 232) * 10 + 8;
    return { r: gray, g: gray, b: gray };
  }

  /**
   * Apply foreground color
   * @param {string} text - Text to colorize
   * @param {string} color - Color specification
   * @returns {string}
   */
  fg(text, color) {
    if (!this._enabled) return text;
    const code = this.parseColor(color, false);
    return code ? `${code}${text}${ANSI.RESET}` : text;
  }

  /**
   * Apply background color
   * @param {string} text - Text to colorize
   * @param {string} color - Color specification
   * @returns {string}
   */
  bg(text, color) {
    if (!this._enabled) return text;
    const code = this.parseColor(color, true);
    return code ? `${code}${text}${ANSI.RESET}` : text;
  }

  /**
   * Apply both foreground and background colors
   * @param {string} text - Text to colorize
   * @param {string} fgColor - Foreground color
   * @param {string} bgColor - Background color
   * @returns {string}
   */
  color(text, fgColor, bgColor) {
    if (!this._enabled) return text;
    const fgCode = this.parseColor(fgColor, false);
    const bgCode = this.parseColor(bgColor, true);
    if (!fgCode && !bgCode) return text;
    return `${bgCode}${fgCode}${text}${ANSI.RESET}`;
  }

  /**
   * Apply bold style
   * @param {string} text
   * @returns {string}
   */
  bold(text) {
    if (!this._enabled) return text;
    return `${ANSI.BOLD}${text}${ANSI.RESET}`;
  }

  /**
   * Apply dim style
   * @param {string} text
   * @returns {string}
   */
  dim(text) {
    if (!this._enabled) return text;
    return `${ANSI.DIM}${text}${ANSI.RESET}`;
  }

  /**
   * Apply italic style
   * @param {string} text
   * @returns {string}
   */
  italic(text) {
    if (!this._enabled) return text;
    return `${ANSI.ITALIC}${text}${ANSI.RESET}`;
  }

  /**
   * Apply underline style
   * @param {string} text
   * @returns {string}
   */
  underline(text) {
    if (!this._enabled) return text;
    return `${ANSI.UNDERLINE}${text}${ANSI.RESET}`;
  }

  /**
   * Apply inverse style
   * @param {string} text
   * @returns {string}
   */
  inverse(text) {
    if (!this._enabled) return text;
    return `${ANSI.INVERSE}${text}${ANSI.RESET}`;
  }

  /**
   * Apply strikethrough style
   * @param {string} text
   * @returns {string}
   */
  strikethrough(text) {
    if (!this._enabled) return text;
    return `${ANSI.STRIKETHROUGH}${text}${ANSI.RESET}`;
  }

  /**
   * Combine multiple styles
   * @param {string} text
   * @param {Object} styles
   * @param {string} [styles.fg] - Foreground color
   * @param {string} [styles.bg] - Background color
   * @param {boolean} [styles.bold]
   * @param {boolean} [styles.dim]
   * @param {boolean} [styles.italic]
   * @param {boolean} [styles.underline]
   * @param {boolean} [styles.inverse]
   * @param {boolean} [styles.strikethrough]
   * @returns {string}
   */
  style(text, styles) {
    if (!this._enabled || !styles) return text;

    let prefix = '';

    if (styles.bold) prefix += ANSI.BOLD;
    if (styles.dim) prefix += ANSI.DIM;
    if (styles.italic) prefix += ANSI.ITALIC;
    if (styles.underline) prefix += ANSI.UNDERLINE;
    if (styles.inverse) prefix += ANSI.INVERSE;
    if (styles.strikethrough) prefix += ANSI.STRIKETHROUGH;
    if (styles.bg) prefix += this.parseColor(styles.bg, true);
    if (styles.fg) prefix += this.parseColor(styles.fg, false);

    return prefix ? `${prefix}${text}${ANSI.RESET}` : text;
  }

  /**
   * Strip ANSI codes from text
   * @param {string} text
   * @returns {string}
   */
  strip(text) {
    // eslint-disable-next-line no-control-regex
    return text.replace(/\x1b\[[0-9;]*m/g, '');
  }

  /**
   * Get visible length of text (excluding ANSI codes)
   * @param {string} text
   * @returns {number}
   */
  visibleLength(text) {
    return this.strip(text).length;
  }

  /**
   * Create a gradient between two colors
   * @param {string} text - Text to apply gradient to
   * @param {string} startColor - Start color (hex)
   * @param {string} endColor - End color (hex)
   * @returns {string}
   */
  gradient(text, startColor, endColor) {
    if (!this._enabled || this._level < COLOR_LEVELS.TRUECOLOR) {
      return text;
    }

    const startRgb = hexToRgb(startColor);
    const endRgb = hexToRgb(endColor);

    if (!startRgb || !endRgb) return text;

    const chars = [...text];
    const len = chars.length;

    if (len <= 1) {
      return this.fg(text, `hex:${startColor}`);
    }

    let result = '';
    for (let i = 0; i < len; i++) {
      const ratio = i / (len - 1);
      const r = Math.round(startRgb.r + (endRgb.r - startRgb.r) * ratio);
      const g = Math.round(startRgb.g + (endRgb.g - startRgb.g) * ratio);
      const b = Math.round(startRgb.b + (endRgb.b - startRgb.b) * ratio);
      result += `\x1b[38;2;${r};${g};${b}m${chars[i]}`;
    }

    return result + ANSI.RESET;
  }

  /**
   * Create a rainbow gradient
   * @param {string} text
   * @returns {string}
   */
  rainbow(text) {
    if (!this._enabled) return text;

    const rainbowColors = [
      { r: 255, g: 0, b: 0 },     // Red
      { r: 255, g: 127, b: 0 },   // Orange
      { r: 255, g: 255, b: 0 },   // Yellow
      { r: 0, g: 255, b: 0 },     // Green
      { r: 0, g: 0, b: 255 },     // Blue
      { r: 75, g: 0, b: 130 },    // Indigo
      { r: 148, g: 0, b: 211 }    // Violet
    ];

    const chars = [...text];
    const len = chars.length;

    if (len === 0) return text;

    let result = '';
    for (let i = 0; i < len; i++) {
      const colorIndex = (i / len) * (rainbowColors.length - 1);
      const lower = Math.floor(colorIndex);
      const upper = Math.ceil(colorIndex);
      const ratio = colorIndex - lower;

      const startColor = rainbowColors[lower];
      const endColor = rainbowColors[Math.min(upper, rainbowColors.length - 1)];

      const r = Math.round(startColor.r + (endColor.r - startColor.r) * ratio);
      const g = Math.round(startColor.g + (endColor.g - startColor.g) * ratio);
      const b = Math.round(startColor.b + (endColor.b - startColor.b) * ratio);

      if (this._level >= COLOR_LEVELS.TRUECOLOR) {
        result += `\x1b[38;2;${r};${g};${b}m${chars[i]}`;
      } else if (this._level >= COLOR_LEVELS.ANSI256) {
        const code = rgbToAnsi256(r, g, b);
        result += `\x1b[38;5;${code}m${chars[i]}`;
      } else {
        const code = rgbToAnsi16(r, g, b);
        result += `\x1b[${code}m${chars[i]}`;
      }
    }

    return result + ANSI.RESET;
  }

  /**
   * Get list of named colors
   * @returns {string[]}
   */
  getNamedColors() {
    return Object.keys(COLOR_MAP);
  }

  /**
   * Get color level name
   * @param {number} [level] - Level to get name for (defaults to current)
   * @returns {string}
   */
  getLevelName(level) {
    const l = level !== undefined ? level : this._level;
    switch (l) {
      case COLOR_LEVELS.NONE: return 'none';
      case COLOR_LEVELS.BASIC: return 'basic (16 colors)';
      case COLOR_LEVELS.ANSI256: return '256 colors';
      case COLOR_LEVELS.TRUECOLOR: return 'truecolor (16M colors)';
      default: return 'unknown';
    }
  }

  /**
   * Get reset code
   * @returns {string}
   */
  get reset() {
    return this._enabled ? ANSI.RESET : '';
  }
}

// Create and export singleton instance
const colors = new ColorSystem();

module.exports = {
  ColorSystem,
  colors,
  COLOR_LEVELS,
  COLOR_MAP,
  ANSI,
  detectColorLevel,
  hexToRgb,
  rgbToAnsi256,
  rgbToAnsi16
};
