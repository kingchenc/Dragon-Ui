'use strict';

/**
 * Powerline Rendering Engine
 * Renders statusline with powerline-style arrow separators
 * Features:
 * - Arrow separators (, , , )
 * - Theme-based colors
 * - Start/End caps
 * - BG→FG color conversion for separators
 */

const { POWERLINE_THEMES, ALL_THEMES, getThemeRegistry } = require('../themes/powerline-themes.cjs');

/**
 * Powerline separator characters
 */
const SEPARATORS = {
  ARROW_RIGHT: '\uE0B0',      //
  ARROW_RIGHT_THIN: '\uE0B1', //
  ARROW_LEFT: '\uE0B2',       //
  ARROW_LEFT_THIN: '\uE0B3',  //
  ROUND_RIGHT: '\uE0B4',      //
  ROUND_LEFT: '\uE0B6',       //
  FLAME_RIGHT: '\uE0C0',      //
  FLAME_LEFT: '\uE0C2',       //
  PIXEL_RIGHT: '\uE0C4',      //
  PIXEL_LEFT: '\uE0C6',       //
  NONE: ''
};

/**
 * ANSI escape codes
 */
const ANSI = {
  RESET: '\x1b[0m',
  BOLD: '\x1b[1m',

  // Convert hex to ANSI truecolor
  fg: (hex) => {
    const rgb = hexToRgb(hex);
    return `\x1b[38;2;${rgb.r};${rgb.g};${rgb.b}m`;
  },
  bg: (hex) => {
    const rgb = hexToRgb(hex);
    return `\x1b[48;2;${rgb.r};${rgb.g};${rgb.b}m`;
  }
};

/**
 * Convert hex color to RGB
 * @param {string} hex - Hex color (#RRGGBB or RRGGBB)
 * @returns {Object} { r, g, b }
 */
function hexToRgb(hex) {
  const clean = hex.replace(/^#/, '');
  const num = parseInt(clean, 16);
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255
  };
}

/**
 * Powerline segment
 */
class PowerlineSegment {
  constructor(options = {}) {
    this.text = options.text || '';
    this.fg = options.fg || '#ffffff';
    this.bg = options.bg || '#333333';
    this.bold = options.bold || false;
    this.separator = options.separator !== undefined ? options.separator : SEPARATORS.ARROW_RIGHT;
    this.padding = options.padding !== undefined ? options.padding : 1;
  }

  /**
   * Get visual width (excluding ANSI codes)
   * @returns {number}
   */
  getWidth() {
    const paddingWidth = this.padding * 2;
    const separatorWidth = this.separator ? 1 : 0;
    return this.text.length + paddingWidth + separatorWidth;
  }
}

/**
 * Powerline Renderer
 */
class PowerlineRenderer {
  constructor(options = {}) {
    this._theme = null;
    this._themeName = options.theme || 'dracula';
    this._separator = options.separator || SEPARATORS.ARROW_RIGHT;
    this._startCap = options.startCap !== undefined ? options.startCap : '';
    this._endCap = options.endCap !== undefined ? options.endCap : SEPARATORS.ARROW_RIGHT;
    this._padding = options.padding !== undefined ? options.padding : 1;
    this._bold = options.bold || false;

    this._loadTheme(this._themeName);
  }

  /**
   * Load theme by name
   * @param {string} themeName
   */
  _loadTheme(themeName) {
    const registry = getThemeRegistry();
    this._theme = registry.get(themeName) || ALL_THEMES.dracula;
    this._themeName = themeName;
  }

  /**
   * Set theme
   * @param {string} themeName
   */
  setTheme(themeName) {
    this._loadTheme(themeName);
  }

  /**
   * Get current theme
   * @returns {Object}
   */
  getTheme() {
    return this._theme;
  }

  /**
   * Set separator style
   * @param {string} separator
   */
  setSeparator(separator) {
    this._separator = separator;
  }

  /**
   * Render segments with powerline styling
   * @param {Array<PowerlineSegment>} segments - Segments to render
   * @param {Object} [options] - Render options
   * @returns {string}
   */
  render(segments, options = {}) {
    if (!segments || segments.length === 0) return '';

    const termBg = options.terminalBg || null;
    let output = '';

    // Start cap
    if (this._startCap && segments.length > 0) {
      const firstBg = segments[0].bg || this._theme.colors.bg1;
      output += ANSI.fg(firstBg) + this._startCap;
    }

    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      const nextSegment = segments[i + 1];
      const isLast = i === segments.length - 1;

      const fg = segment.fg || this._theme.colors.fg1;
      const bg = segment.bg || this._theme.colors.bg1;
      const nextBg = nextSegment ? (nextSegment.bg || this._theme.colors.bg1) : termBg;

      // Render segment content
      output += ANSI.fg(fg) + ANSI.bg(bg);
      if (segment.bold || this._bold) {
        output += ANSI.BOLD;
      }

      // Padding and text
      const padding = ' '.repeat(segment.padding !== undefined ? segment.padding : this._padding);
      output += padding + segment.text + padding;

      // Reset bold if applied
      if (segment.bold || this._bold) {
        output += ANSI.RESET + ANSI.fg(fg) + ANSI.bg(bg);
      }

      // Separator
      const separator = segment.separator !== undefined ? segment.separator : this._separator;
      if (separator) {
        if (isLast) {
          // End cap - separator color is current bg, reset bg
          output += ANSI.RESET + ANSI.fg(bg) + separator;
        } else {
          // Middle separator - fg is current bg, bg is next segment's bg
          output += ANSI.fg(bg) + ANSI.bg(nextBg) + separator;
        }
      }
    }

    output += ANSI.RESET;
    return output;
  }

  /**
   * Create segment from widget data
   * @param {Object} widget - Widget data
   * @param {number} colorIndex - Color index for theme
   * @returns {PowerlineSegment}
   */
  createSegment(widget, colorIndex = 0) {
    const colors = this._theme.colors;
    const bgColors = [colors.bg1, colors.bg2, colors.bg3];
    const accentColors = [colors.accent1, colors.accent2, colors.accent3, colors.accent4];

    return new PowerlineSegment({
      text: widget.text || widget.value || '',
      fg: widget.fg || accentColors[colorIndex % accentColors.length] || colors.fg1,
      bg: widget.bg || bgColors[colorIndex % bgColors.length] || colors.bg1,
      bold: widget.bold || false,
      separator: widget.separator,
      padding: widget.padding
    });
  }

  /**
   * Create segments from widget array
   * @param {Array<Object>} widgets - Widget data array
   * @returns {Array<PowerlineSegment>}
   */
  createSegments(widgets) {
    return widgets.map((widget, index) => this.createSegment(widget, index));
  }

  /**
   * Render widgets directly
   * @param {Array<Object>} widgets - Widget data array
   * @param {Object} [options] - Render options
   * @returns {string}
   */
  renderWidgets(widgets, options = {}) {
    const segments = this.createSegments(widgets);
    return this.render(segments, options);
  }

  /**
   * Get available separator styles
   * @returns {Object}
   */
  static getSeparators() {
    return { ...SEPARATORS };
  }

  /**
   * Get available themes
   * @returns {Array<string>}
   */
  static getThemes() {
    return Object.keys(ALL_THEMES);
  }

  /**
   * Preview theme
   * @param {string} themeName
   * @returns {string}
   */
  previewTheme(themeName) {
    const savedTheme = this._themeName;
    this.setTheme(themeName);

    const segments = [
      new PowerlineSegment({ text: 'Model', fg: this._theme.colors.accent1, bg: this._theme.colors.bg1 }),
      new PowerlineSegment({ text: '$1.23', fg: this._theme.colors.accent2, bg: this._theme.colors.bg2 }),
      new PowerlineSegment({ text: '45k', fg: this._theme.colors.accent3, bg: this._theme.colors.bg3 }),
      new PowerlineSegment({ text: '2:34', fg: this._theme.colors.accent4, bg: this._theme.colors.bg2 })
    ];

    const preview = this.render(segments);
    this.setTheme(savedTheme);
    return preview;
  }

  /**
   * Get theme info
   * @returns {Object}
   */
  getThemeInfo() {
    return {
      name: this._theme.name,
      description: this._theme.description,
      colors: this._theme.colors
    };
  }
}

/**
 * Create powerline renderer
 * @param {Object} [options]
 * @returns {PowerlineRenderer}
 */
function createPowerlineRenderer(options) {
  return new PowerlineRenderer(options);
}

// Singleton instance
let _renderer = null;

/**
 * Get singleton renderer
 * @param {Object} [options]
 * @returns {PowerlineRenderer}
 */
function getPowerlineRenderer(options) {
  if (!_renderer) {
    _renderer = new PowerlineRenderer(options);
  }
  return _renderer;
}

/**
 * Reset singleton
 */
function resetPowerlineRenderer() {
  _renderer = null;
}

/**
 * Quick render
 * @param {Array<Object>} widgets
 * @param {Object} [options]
 * @returns {string}
 */
function renderPowerline(widgets, options = {}) {
  const renderer = options.renderer || getPowerlineRenderer(options);
  return renderer.renderWidgets(widgets, options);
}

module.exports = {
  PowerlineRenderer,
  PowerlineSegment,
  createPowerlineRenderer,
  getPowerlineRenderer,
  resetPowerlineRenderer,
  renderPowerline,
  SEPARATORS,
  ANSI,
  hexToRgb
};
