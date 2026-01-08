/**
 * Compact Mode Toggle for Dragon-UI
 * Reduce display widths and enable compact layouts
 *
 * @module cli/utils/compact-mode
 */

'use strict';

const { getTerminalWidth } = require('./terminal-utils.cjs');

/**
 * Compact mode state
 */
let compactMode = false;

/**
 * Compact reduction factor (30%)
 */
const COMPACT_FACTOR = 0.7;

/**
 * Column width configurations
 */
const COLUMN_WIDTHS = {
  normal: {
    date: 12,
    time: 10,
    model: 30,
    tokens: 12,
    cost: 10,
    session: 20,
    project: 25,
    account: 20,
    status: 10,
    duration: 12,
    description: 40
  },
  compact: {
    date: 10,
    time: 8,
    model: 20,
    tokens: 8,
    cost: 7,
    session: 12,
    project: 15,
    account: 12,
    status: 6,
    duration: 8,
    description: 25
  }
};

/**
 * Table configurations
 */
const TABLE_CONFIG = {
  normal: {
    padding: 2,
    border: true,
    headerSeparator: true,
    rowSpacing: 0
  },
  compact: {
    padding: 1,
    border: false,
    headerSeparator: true,
    rowSpacing: 0
  }
};

/**
 * Text truncation lengths
 */
const TRUNCATE_LENGTHS = {
  normal: {
    model: 28,
    session: 18,
    project: 23,
    account: 18,
    description: 38,
    path: 50
  },
  compact: {
    model: 18,
    session: 10,
    project: 13,
    account: 10,
    description: 23,
    path: 30
  }
};

/**
 * Enable compact mode
 */
function enableCompactMode() {
  compactMode = true;
}

/**
 * Disable compact mode
 */
function disableCompactMode() {
  compactMode = false;
}

/**
 * Toggle compact mode
 * @returns {boolean} - New state
 */
function toggleCompactMode() {
  compactMode = !compactMode;
  return compactMode;
}

/**
 * Check if compact mode is enabled
 * @returns {boolean}
 */
function isCompactMode() {
  return compactMode;
}

/**
 * Set compact mode from CLI flag
 * @param {boolean} value
 */
function setCompactMode(value) {
  compactMode = value === true;
}

/**
 * Get column width
 * @param {string} column
 * @returns {number}
 */
function getColumnWidth(column) {
  const widths = compactMode ? COLUMN_WIDTHS.compact : COLUMN_WIDTHS.normal;
  return widths[column] || 10;
}

/**
 * Get all column widths
 * @returns {Object}
 */
function getColumnWidths() {
  return compactMode ? { ...COLUMN_WIDTHS.compact } : { ...COLUMN_WIDTHS.normal };
}

/**
 * Get table configuration
 * @returns {Object}
 */
function getTableConfig() {
  return compactMode ? { ...TABLE_CONFIG.compact } : { ...TABLE_CONFIG.normal };
}

/**
 * Get truncation length
 * @param {string} type
 * @returns {number}
 */
function getTruncateLength(type) {
  const lengths = compactMode ? TRUNCATE_LENGTHS.compact : TRUNCATE_LENGTHS.normal;
  return lengths[type] || 20;
}

/**
 * Adjust width for compact mode
 * @param {number} width
 * @returns {number}
 */
function adjustWidth(width) {
  if (!compactMode) return width;
  return Math.round(width * COMPACT_FACTOR);
}

/**
 * Calculate available width for content
 * @param {number} reservedColumns
 * @returns {number}
 */
function getAvailableWidth(reservedColumns = 0) {
  const termWidth = getTerminalWidth();
  const config = getTableConfig();
  const reserved = reservedColumns * (compactMode ? 1 : 2);
  return termWidth - reserved - (config.padding * 2);
}

/**
 * Format value for compact display
 * @param {string} value
 * @param {string} type
 * @returns {string}
 */
function formatCompact(value, type) {
  if (!value) return '';

  const maxLen = getTruncateLength(type);

  if (value.length <= maxLen) {
    return value;
  }

  // Smart truncation based on type
  switch (type) {
    case 'model':
      // Keep model family visible
      return truncateModel(value, maxLen);

    case 'session':
      // Show start and end of session ID
      return truncateMiddle(value, maxLen);

    case 'path':
      // Show filename with partial path
      return truncatePath(value, maxLen);

    default:
      // Standard truncation with ellipsis
      return value.slice(0, maxLen - 1) + '…';
  }
}

/**
 * Truncate model name intelligently
 * @param {string} model
 * @param {number} maxLen
 * @returns {string}
 */
function truncateModel(model, maxLen) {
  // Try to preserve model family (sonnet, opus, haiku)
  const families = ['sonnet', 'opus', 'haiku'];

  for (const family of families) {
    if (model.toLowerCase().includes(family)) {
      const familyCapitalized = family.charAt(0).toUpperCase() + family.slice(1);
      if (familyCapitalized.length <= maxLen) {
        // Extract version if space allows
        const versionMatch = model.match(/(\d+(?:\.\d+)?)/);
        if (versionMatch) {
          const withVersion = `${familyCapitalized} ${versionMatch[1]}`;
          if (withVersion.length <= maxLen) {
            return withVersion;
          }
        }
        return familyCapitalized;
      }
    }
  }

  return model.slice(0, maxLen - 1) + '…';
}

/**
 * Truncate from middle
 * @param {string} str
 * @param {number} maxLen
 * @returns {string}
 */
function truncateMiddle(str, maxLen) {
  if (str.length <= maxLen) return str;

  const ellipsis = '…';
  const charsToShow = maxLen - ellipsis.length;
  const frontChars = Math.ceil(charsToShow / 2);
  const backChars = Math.floor(charsToShow / 2);

  return str.slice(0, frontChars) + ellipsis + str.slice(-backChars);
}

/**
 * Truncate path intelligently
 * @param {string} pathStr
 * @param {number} maxLen
 * @returns {string}
 */
function truncatePath(pathStr, maxLen) {
  if (pathStr.length <= maxLen) return pathStr;

  const path = require('path');
  const parts = pathStr.split(path.sep);

  // Always show filename
  const filename = parts[parts.length - 1];

  if (filename.length >= maxLen - 3) {
    return '…' + filename.slice(-(maxLen - 1));
  }

  // Build path from end
  let result = filename;
  for (let i = parts.length - 2; i >= 0; i--) {
    const next = parts[i] + path.sep + result;
    if (next.length + 1 > maxLen) {
      return '…' + path.sep + result;
    }
    result = next;
  }

  return result;
}

/**
 * Create compact table row
 * @param {Object} columns
 * @param {Object} widths
 * @returns {string}
 */
function formatTableRow(columns, widths = null) {
  const colWidths = widths || getColumnWidths();
  const config = getTableConfig();
  const padding = ' '.repeat(config.padding);

  const cells = [];
  for (const [key, value] of Object.entries(columns)) {
    const width = colWidths[key] || 10;
    const formatted = formatCompact(String(value), key);
    cells.push(formatted.padEnd(width).slice(0, width));
  }

  return padding + cells.join(padding) + padding;
}

/**
 * Get compact mode display suffix
 * @returns {string}
 */
function getCompactIndicator() {
  return compactMode ? ' [compact]' : '';
}

/**
 * Apply compact mode to options object
 * @param {Object} options
 * @returns {Object}
 */
function applyCompactMode(options) {
  if (!options.compact) {
    return options;
  }

  setCompactMode(true);

  return {
    ...options,
    _compactApplied: true,
    columnWidths: getColumnWidths(),
    tableConfig: getTableConfig(),
    truncateLengths: compactMode ? TRUNCATE_LENGTHS.compact : TRUNCATE_LENGTHS.normal
  };
}

/**
 * Create CLI option for compact mode
 * @returns {Object}
 */
function getCompactOption() {
  return {
    flags: '-c, --compact',
    description: 'Use compact display mode (reduced widths)',
    action: () => enableCompactMode()
  };
}

/**
 * Middleware to apply compact mode from CLI
 * @param {Object} options
 * @returns {Object}
 */
function compactMiddleware(options) {
  if (options && options.compact) {
    enableCompactMode();
  }
  return options;
}

module.exports = {
  COMPACT_FACTOR,
  COLUMN_WIDTHS,
  TABLE_CONFIG,
  TRUNCATE_LENGTHS,
  enableCompactMode,
  disableCompactMode,
  toggleCompactMode,
  isCompactMode,
  setCompactMode,
  getColumnWidth,
  getColumnWidths,
  getTableConfig,
  getTruncateLength,
  adjustWidth,
  getAvailableWidth,
  formatCompact,
  truncateModel,
  truncateMiddle,
  truncatePath,
  formatTableRow,
  getCompactIndicator,
  applyCompactMode,
  getCompactOption,
  compactMiddleware
};
