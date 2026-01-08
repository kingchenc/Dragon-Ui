/**
 * Terminal Utilities for Dragon-UI
 * Terminal width detection, fallbacks, and responsive rendering
 *
 * @module cli/utils/terminal-utils
 */

'use strict';

/**
 * Default terminal dimensions
 */
const DEFAULTS = {
  columns: 80,
  rows: 24,
  minColumns: 40,
  maxColumns: 300
};

/**
 * Breakpoints for responsive layouts
 */
const BREAKPOINTS = {
  xs: 60,   // Extra small
  sm: 80,   // Small (default)
  md: 120,  // Medium
  lg: 160,  // Large
  xl: 200   // Extra large
};

/**
 * Get terminal width
 * @returns {number}
 */
function getTerminalWidth() {
  // Try process.stdout.columns first
  if (process.stdout && typeof process.stdout.columns === 'number' && process.stdout.columns > 0) {
    return Math.min(Math.max(process.stdout.columns, DEFAULTS.minColumns), DEFAULTS.maxColumns);
  }

  // Try environment variable
  if (process.env.COLUMNS) {
    const envColumns = parseInt(process.env.COLUMNS, 10);
    if (!isNaN(envColumns) && envColumns > 0) {
      return Math.min(Math.max(envColumns, DEFAULTS.minColumns), DEFAULTS.maxColumns);
    }
  }

  // Try tput (Unix/Linux/macOS)
  try {
    const { execSync } = require('child_process');
    const result = execSync('tput cols', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] });
    const cols = parseInt(result.trim(), 10);
    if (!isNaN(cols) && cols > 0) {
      return Math.min(Math.max(cols, DEFAULTS.minColumns), DEFAULTS.maxColumns);
    }
  } catch (error) {
    // Ignore - tput not available
  }

  // Try stty (Unix/Linux/macOS)
  try {
    const { execSync } = require('child_process');
    const result = execSync('stty size', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] });
    const parts = result.trim().split(' ');
    if (parts.length >= 2) {
      const cols = parseInt(parts[1], 10);
      if (!isNaN(cols) && cols > 0) {
        return Math.min(Math.max(cols, DEFAULTS.minColumns), DEFAULTS.maxColumns);
      }
    }
  } catch (error) {
    // Ignore - stty not available
  }

  // Fallback to default
  return DEFAULTS.columns;
}

/**
 * Get terminal height
 * @returns {number}
 */
function getTerminalHeight() {
  if (process.stdout && typeof process.stdout.rows === 'number' && process.stdout.rows > 0) {
    return process.stdout.rows;
  }

  if (process.env.LINES) {
    const envLines = parseInt(process.env.LINES, 10);
    if (!isNaN(envLines) && envLines > 0) {
      return envLines;
    }
  }

  return DEFAULTS.rows;
}

/**
 * Get terminal dimensions
 * @returns {{columns: number, rows: number}}
 */
function getTerminalSize() {
  return {
    columns: getTerminalWidth(),
    rows: getTerminalHeight()
  };
}

/**
 * Get current breakpoint
 * @returns {string}
 */
function getBreakpoint() {
  const width = getTerminalWidth();

  if (width < BREAKPOINTS.xs) return 'xs';
  if (width < BREAKPOINTS.sm) return 'sm';
  if (width < BREAKPOINTS.md) return 'md';
  if (width < BREAKPOINTS.lg) return 'lg';
  return 'xl';
}

/**
 * Check if terminal supports specific width
 * @param {number} minWidth
 * @returns {boolean}
 */
function hasMinWidth(minWidth) {
  return getTerminalWidth() >= minWidth;
}

/**
 * Truncate string to fit terminal width
 * @param {string} str
 * @param {number} maxWidth
 * @param {string} suffix
 * @returns {string}
 */
function truncate(str, maxWidth = null, suffix = '...') {
  if (maxWidth === null) {
    maxWidth = getTerminalWidth() - 5;
  }

  if (str.length <= maxWidth) {
    return str;
  }

  return str.slice(0, maxWidth - suffix.length) + suffix;
}

/**
 * Pad string to specific width
 * @param {string} str
 * @param {number} width
 * @param {string} align
 * @param {string} char
 * @returns {string}
 */
function pad(str, width, align = 'left', char = ' ') {
  if (str.length >= width) {
    return str.slice(0, width);
  }

  const padding = char.repeat(width - str.length);

  switch (align) {
    case 'right':
      return padding + str;
    case 'center':
      const leftPad = Math.floor(padding.length / 2);
      const rightPad = padding.length - leftPad;
      return char.repeat(leftPad) + str + char.repeat(rightPad);
    default:
      return str + padding;
  }
}

/**
 * Calculate column widths based on terminal size
 * @param {Object[]} columns
 * @param {number} padding
 * @returns {Object[]}
 */
function calculateColumnWidths(columns, padding = 2) {
  const terminalWidth = getTerminalWidth();
  const totalPadding = padding * (columns.length - 1);
  const availableWidth = terminalWidth - totalPadding;

  // Calculate fixed and flex widths
  let fixedWidth = 0;
  let flexCount = 0;

  for (const col of columns) {
    if (col.width) {
      fixedWidth += col.width;
    } else if (col.minWidth) {
      fixedWidth += col.minWidth;
      flexCount++;
    } else {
      flexCount++;
    }
  }

  const remainingWidth = availableWidth - fixedWidth;
  const flexWidth = flexCount > 0 ? Math.floor(remainingWidth / flexCount) : 0;

  return columns.map(col => ({
    ...col,
    calculatedWidth: col.width || Math.max(col.minWidth || 10, flexWidth)
  }));
}

/**
 * Create responsive layout
 * @param {Object} layouts
 * @returns {any}
 */
function responsive(layouts) {
  const breakpoint = getBreakpoint();

  // Find best matching layout
  const order = ['xl', 'lg', 'md', 'sm', 'xs'];
  const startIndex = order.indexOf(breakpoint);

  for (let i = startIndex; i < order.length; i++) {
    if (layouts[order[i]]) {
      return layouts[order[i]];
    }
  }

  // Fallback to default or first available
  return layouts.default || layouts[Object.keys(layouts)[0]];
}

/**
 * Watch for terminal resize
 * @param {Function} callback
 * @returns {Function} - Cleanup function
 */
function onResize(callback) {
  const handler = () => {
    callback(getTerminalSize());
  };

  process.stdout.on('resize', handler);

  return () => {
    process.stdout.off('resize', handler);
  };
}

/**
 * Clear terminal
 */
function clear() {
  if (process.stdout.isTTY) {
    process.stdout.write('\x1B[2J\x1B[0f');
  }
}

/**
 * Move cursor to position
 * @param {number} x
 * @param {number} y
 */
function moveCursor(x, y) {
  if (process.stdout.isTTY) {
    process.stdout.write(`\x1B[${y};${x}H`);
  }
}

/**
 * Hide cursor
 */
function hideCursor() {
  if (process.stdout.isTTY) {
    process.stdout.write('\x1B[?25l');
  }
}

/**
 * Show cursor
 */
function showCursor() {
  if (process.stdout.isTTY) {
    process.stdout.write('\x1B[?25h');
  }
}

/**
 * Check if running in TTY
 * @returns {boolean}
 */
function isTTY() {
  return process.stdout.isTTY === true;
}

/**
 * Check if colors are supported
 * @returns {boolean}
 */
function supportsColor() {
  if (process.env.NO_COLOR) {
    return false;
  }

  if (process.env.FORCE_COLOR) {
    return true;
  }

  if (!isTTY()) {
    return false;
  }

  if (process.platform === 'win32') {
    return true;
  }

  if (process.env.COLORTERM === 'truecolor' || process.env.COLORTERM === '24bit') {
    return true;
  }

  if (process.env.TERM && process.env.TERM !== 'dumb') {
    return true;
  }

  return false;
}

/**
 * Get color level
 * @returns {number} - 0: none, 1: basic, 2: 256, 3: truecolor
 */
function getColorLevel() {
  if (!supportsColor()) {
    return 0;
  }

  if (process.env.COLORTERM === 'truecolor' || process.env.COLORTERM === '24bit') {
    return 3;
  }

  if (process.env.TERM && process.env.TERM.includes('256')) {
    return 2;
  }

  return 1;
}

module.exports = {
  DEFAULTS,
  BREAKPOINTS,
  getTerminalWidth,
  getTerminalHeight,
  getTerminalSize,
  getBreakpoint,
  hasMinWidth,
  truncate,
  pad,
  calculateColumnWidths,
  responsive,
  onResize,
  clear,
  moveCursor,
  hideCursor,
  showCursor,
  isTTY,
  supportsColor,
  getColorLevel
};
