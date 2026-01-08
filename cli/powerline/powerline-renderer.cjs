/**
 * Powerline Renderer
 * Renders statusline with powerline-style arrows and themes
 */

// Powerline separator characters (require Powerline-patched fonts)
const SEPARATORS = {
  arrows: {
    right: '\uE0B0',      //
    rightThin: '\uE0B1',  //
    left: '\uE0B2',       //
    leftThin: '\uE0B3'    //
  },
  blocks: {
    right: '\u2588',      // █
    rightThin: '\u258C',  // ▌
    left: '\u2588',       // █
    leftThin: '\u2590'    // ▐
  },
  triangles: {
    right: '\u25B6',      // ▶
    rightThin: '\u25B7',  // ▷
    left: '\u25C0',       // ◀
    leftThin: '\u25C1'    // ◁
  },
  slant: {
    right: '/',
    rightThin: '/',
    left: '\\',
    leftThin: '\\'
  },
  none: {
    right: '',
    rightThin: ' ',
    left: '',
    leftThin: ' '
  }
};

// ANSI escape codes
const ANSI = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',

  // Foreground colors (30-37, 90-97)
  fg: {
    black: '\x1b[30m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    white: '\x1b[37m',
    gray: '\x1b[90m',
    brightRed: '\x1b[91m',
    brightGreen: '\x1b[92m',
    brightYellow: '\x1b[93m',
    brightBlue: '\x1b[94m',
    brightMagenta: '\x1b[95m',
    brightCyan: '\x1b[96m',
    brightWhite: '\x1b[97m'
  },

  // Background colors (40-47, 100-107)
  bg: {
    black: '\x1b[40m',
    red: '\x1b[41m',
    green: '\x1b[42m',
    yellow: '\x1b[43m',
    blue: '\x1b[44m',
    magenta: '\x1b[45m',
    cyan: '\x1b[46m',
    white: '\x1b[47m',
    gray: '\x1b[100m',
    brightRed: '\x1b[101m',
    brightGreen: '\x1b[102m',
    brightYellow: '\x1b[103m',
    brightBlue: '\x1b[104m',
    brightMagenta: '\x1b[105m',
    brightCyan: '\x1b[106m',
    brightWhite: '\x1b[107m'
  }
};

/**
 * Convert hex color to ANSI 256 color code
 */
function hexToAnsi256(hex) {
  if (!hex || !hex.startsWith('#')) return null;

  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);

  // Convert to 256-color palette
  if (r === g && g === b) {
    // Grayscale
    if (r < 8) return 16;
    if (r > 248) return 231;
    return Math.round(((r - 8) / 247) * 24) + 232;
  }

  // RGB color cube (6x6x6)
  const rIdx = Math.round(r / 255 * 5);
  const gIdx = Math.round(g / 255 * 5);
  const bIdx = Math.round(b / 255 * 5);

  return 16 + (36 * rIdx) + (6 * gIdx) + bIdx;
}

/**
 * Get ANSI foreground code for color
 */
function getFgCode(color) {
  if (!color) return '';

  // Named color
  if (ANSI.fg[color]) return ANSI.fg[color];

  // Hex color
  if (color.startsWith('#')) {
    const code = hexToAnsi256(color);
    return code ? `\x1b[38;5;${code}m` : '';
  }

  return '';
}

/**
 * Get ANSI background code for color
 */
function getBgCode(color) {
  if (!color) return '';

  // Named color
  if (ANSI.bg[color]) return ANSI.bg[color];

  // Hex color
  if (color.startsWith('#')) {
    const code = hexToAnsi256(color);
    return code ? `\x1b[48;5;${code}m` : '';
  }

  return '';
}

/**
 * Powerline Renderer Class
 */
class PowerlineRenderer {
  constructor(options = {}) {
    this.separatorType = options.separatorType || 'arrows';
    this.useThinSeparators = options.useThinSeparators || false;
    this.showStartCap = options.showStartCap !== false;
    this.showEndCap = options.showEndCap !== false;
    this.padding = options.padding || 1;
    this.align = options.align || 'left'; // 'left', 'center', 'right'
  }

  /**
   * Get separator characters based on type
   */
  getSeparators() {
    return SEPARATORS[this.separatorType] || SEPARATORS.arrows;
  }

  /**
   * Render a single segment with powerline styling
   */
  renderSegment(content, fgColor, bgColor, nextBgColor, isFirst, isLast) {
    const separators = this.getSeparators();
    let result = '';

    const fg = getFgCode(fgColor || 'white');
    const bg = getBgCode(bgColor);
    const padding = ' '.repeat(this.padding);

    // Start cap (only for first segment)
    if (isFirst && this.showStartCap && bgColor) {
      result += getFgCode(bgColor) + separators.right + ANSI.reset;
    }

    // Segment content
    result += bg + fg + padding + content + padding + ANSI.reset;

    // Separator (between segments)
    if (!isLast) {
      const sepFg = bgColor || 'gray';
      const sepBg = nextBgColor || null;

      if (this.useThinSeparators) {
        // Thin separator (same BG as current)
        result += bg + getFgCode('white') + separators.rightThin + ANSI.reset;
      } else {
        // Arrow separator (current BG as FG, next BG as BG)
        result += getFgCode(sepFg) + getBgCode(sepBg) + separators.right + ANSI.reset;
      }
    }

    // End cap (only for last segment)
    if (isLast && this.showEndCap && bgColor) {
      result += getFgCode(bgColor) + separators.right + ANSI.reset;
    }

    return result;
  }

  /**
   * Render an array of segments into a powerline statusline
   */
  renderLine(segments) {
    if (!segments || segments.length === 0) return '';

    let result = '';

    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      const nextSegment = segments[i + 1];
      const isFirst = i === 0;
      const isLast = i === segments.length - 1;

      result += this.renderSegment(
        segment.content,
        segment.fg || 'white',
        segment.bg,
        nextSegment?.bg,
        isFirst,
        isLast
      );
    }

    return result;
  }

  /**
   * Render widgets into powerline segments
   */
  async renderWidgets(widgets, data, theme = null) {
    const segments = [];

    for (let i = 0; i < widgets.length; i++) {
      const widget = widgets[i];

      // Get widget value
      let value;
      if (typeof widget.getValue === 'function') {
        value = await widget.getValue(data);
      } else {
        value = widget.value || '';
      }

      if (!value) continue;

      // Determine colors
      let fg = widget.color?.fg || 'white';
      let bg = widget.color?.bg || null;

      // Apply theme colors if provided
      if (theme && theme.colors) {
        bg = theme.colors[i % theme.colors.length];
        fg = theme.foreground || 'white';
      }

      segments.push({
        content: value,
        fg,
        bg,
        id: widget.id
      });
    }

    return this.renderLine(segments);
  }

  /**
   * Calculate aligned widths for multi-line rendering
   */
  calculateAlignedWidths(lines) {
    if (!lines || lines.length === 0) return [];

    const maxWidgets = Math.max(...lines.map(l => l.length));
    const widths = new Array(maxWidgets).fill(0);

    // Find max width for each widget position
    for (const line of lines) {
      for (let i = 0; i < line.length; i++) {
        const contentLength = (line[i].content || '').length;
        widths[i] = Math.max(widths[i], contentLength);
      }
    }

    return widths;
  }

  /**
   * Pad segment content to specified width
   */
  padSegment(segment, width) {
    const content = segment.content || '';
    const padding = width - content.length;

    if (padding <= 0) return segment;

    const leftPad = Math.floor(padding / 2);
    const rightPad = padding - leftPad;

    return {
      ...segment,
      content: ' '.repeat(leftPad) + content + ' '.repeat(rightPad)
    };
  }

  /**
   * Render multiple lines with aligned columns
   */
  renderAlignedLines(lines) {
    const widths = this.calculateAlignedWidths(lines);
    const result = [];

    for (const line of lines) {
      const alignedSegments = line.map((segment, i) =>
        this.padSegment(segment, widths[i])
      );
      result.push(this.renderLine(alignedSegments));
    }

    return result;
  }

  /**
   * Get available separator types
   */
  static getSeparatorTypes() {
    return Object.keys(SEPARATORS);
  }

  /**
   * Preview all separator types
   */
  static previewSeparators() {
    const sample = [
      { content: 'Model', fg: 'white', bg: 'blue' },
      { content: 'Branch', fg: 'black', bg: 'green' },
      { content: 'Tokens', fg: 'white', bg: 'magenta' }
    ];

    const previews = {};

    for (const type of Object.keys(SEPARATORS)) {
      const renderer = new PowerlineRenderer({ separatorType: type });
      previews[type] = renderer.renderLine(sample);
    }

    return previews;
  }
}

module.exports = {
  PowerlineRenderer,
  SEPARATORS,
  ANSI,
  hexToAnsi256,
  getFgCode,
  getBgCode
};
