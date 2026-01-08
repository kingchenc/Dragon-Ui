'use strict';

/**
 * Flex Terminal Layout
 * Features:
 * - Flex modes (full, full-minus-40, full-until-compact)
 * - Flex separators (auto-expand to fill space)
 * - Multiple flex separators with equal distribution
 * - Visual width calculation
 */

const { stripAnsi, visualWidth } = require('./powerline-alignment.cjs');

/**
 * Flex modes
 */
const FlexMode = {
  FULL: 'full',                     // Full terminal width
  FULL_MINUS_40: 'full-minus-40',   // Full width minus 40 chars
  FULL_MINUS_20: 'full-minus-20',   // Full width minus 20 chars
  FULL_UNTIL_COMPACT: 'full-until-compact', // Full until threshold, then compact
  COMPACT: 'compact',               // Minimum width, no flex
  AUTO: 'auto'                      // Auto-detect based on terminal
};

/**
 * Flex separator marker
 */
const FLEX_SEPARATOR = '{FLEX}';
const FLEX_MIN_WIDTH = 1;

/**
 * Flex item types
 */
const ItemType = {
  FIXED: 'fixed',
  FLEX: 'flex'
};

/**
 * Flex item
 */
class FlexItem {
  constructor(content, options = {}) {
    this.content = content;
    this.type = options.type || ItemType.FIXED;
    this.minWidth = options.minWidth || 0;
    this.maxWidth = options.maxWidth || Infinity;
    this.grow = options.grow || (this.type === ItemType.FLEX ? 1 : 0);
    this.shrink = options.shrink || 1;
    this.basis = options.basis || 'auto';
  }

  /**
   * Get current width
   * @returns {number}
   */
  getWidth() {
    return visualWidth(this.content);
  }

  /**
   * Check if this is a flex item
   * @returns {boolean}
   */
  get isFlex() {
    return this.type === ItemType.FLEX || this.grow > 0;
  }
}

/**
 * Flex Layout Container
 */
class FlexLayout {
  constructor(options = {}) {
    this._terminalWidth = options.terminalWidth || process.stdout.columns || 80;
    this._mode = options.mode || FlexMode.FULL;
    this._compactThreshold = options.compactThreshold || 60;
    this._reservedChars = options.reservedChars || 0;
    this._flexChar = options.flexChar || ' ';
    this._items = [];
  }

  /**
   * Get available width based on mode
   * @returns {number}
   */
  getAvailableWidth() {
    switch (this._mode) {
      case FlexMode.FULL:
        return this._terminalWidth - this._reservedChars;

      case FlexMode.FULL_MINUS_40:
        return Math.max(40, this._terminalWidth - 40 - this._reservedChars);

      case FlexMode.FULL_MINUS_20:
        return Math.max(40, this._terminalWidth - 20 - this._reservedChars);

      case FlexMode.FULL_UNTIL_COMPACT:
        if (this._terminalWidth < this._compactThreshold) {
          return this._calculateCompactWidth();
        }
        return this._terminalWidth - this._reservedChars;

      case FlexMode.COMPACT:
        return this._calculateCompactWidth();

      case FlexMode.AUTO:
        return this._calculateAutoWidth();

      default:
        return this._terminalWidth - this._reservedChars;
    }
  }

  /**
   * Calculate compact width (sum of fixed items)
   * @private
   */
  _calculateCompactWidth() {
    return this._items
      .filter(item => item.type === ItemType.FIXED)
      .reduce((sum, item) => sum + item.getWidth(), 0);
  }

  /**
   * Calculate auto width
   * @private
   */
  _calculateAutoWidth() {
    const fixedWidth = this._calculateCompactWidth();
    const available = this._terminalWidth - this._reservedChars;

    // Use full width if we have enough space
    if (available >= fixedWidth + 20) {
      return available;
    }

    // Otherwise use compact
    return fixedWidth;
  }

  /**
   * Set mode
   * @param {string} mode
   */
  setMode(mode) {
    if (Object.values(FlexMode).includes(mode)) {
      this._mode = mode;
    }
  }

  /**
   * Set terminal width
   * @param {number} width
   */
  setTerminalWidth(width) {
    this._terminalWidth = width;
  }

  /**
   * Add item
   * @param {string|FlexItem} item
   * @param {Object} [options]
   * @returns {FlexLayout}
   */
  add(item, options = {}) {
    if (item instanceof FlexItem) {
      this._items.push(item);
    } else {
      this._items.push(new FlexItem(item, options));
    }
    return this;
  }

  /**
   * Add fixed item
   * @param {string} content
   * @returns {FlexLayout}
   */
  addFixed(content) {
    return this.add(content, { type: ItemType.FIXED });
  }

  /**
   * Add flex separator
   * @param {Object} [options]
   * @returns {FlexLayout}
   */
  addFlex(options = {}) {
    return this.add('', {
      type: ItemType.FLEX,
      grow: options.grow || 1,
      minWidth: options.minWidth || FLEX_MIN_WIDTH,
      ...options
    });
  }

  /**
   * Clear items
   */
  clear() {
    this._items = [];
  }

  /**
   * Render layout
   * @returns {string}
   */
  render() {
    if (this._items.length === 0) return '';

    const availableWidth = this.getAvailableWidth();
    const fixedWidth = this._items
      .filter(item => !item.isFlex)
      .reduce((sum, item) => sum + item.getWidth(), 0);

    const flexItems = this._items.filter(item => item.isFlex);
    const totalGrow = flexItems.reduce((sum, item) => sum + item.grow, 0);
    const remainingSpace = Math.max(0, availableWidth - fixedWidth);

    // Calculate flex item widths
    const flexWidths = new Map();
    if (totalGrow > 0 && remainingSpace > 0) {
      let distributed = 0;
      flexItems.forEach((item, index) => {
        const isLast = index === flexItems.length - 1;
        let width;

        if (isLast) {
          // Give remaining space to last flex item to avoid rounding errors
          width = remainingSpace - distributed;
        } else {
          width = Math.floor(remainingSpace * (item.grow / totalGrow));
        }

        // Apply min/max constraints
        width = Math.max(item.minWidth, Math.min(item.maxWidth, width));
        flexWidths.set(item, width);
        distributed += width;
      });
    } else {
      // No space for flex - use minimum widths
      flexItems.forEach(item => {
        flexWidths.set(item, item.minWidth);
      });
    }

    // Build output
    let output = '';
    for (const item of this._items) {
      if (item.isFlex) {
        const width = flexWidths.get(item) || 0;
        output += this._flexChar.repeat(width);
      } else {
        output += item.content;
      }
    }

    return output;
  }

  /**
   * Parse string with flex markers
   * @param {string} template - String with {FLEX} markers
   * @returns {FlexLayout}
   */
  static parse(template, options = {}) {
    const layout = new FlexLayout(options);
    const parts = template.split(FLEX_SEPARATOR);

    parts.forEach((part, index) => {
      if (part) {
        layout.addFixed(part);
      }
      if (index < parts.length - 1) {
        layout.addFlex();
      }
    });

    return layout;
  }
}

/**
 * Quick flex render
 * @param {Array<string|Object>} items
 * @param {Object} [options]
 * @returns {string}
 */
function flexRender(items, options = {}) {
  const layout = new FlexLayout(options);

  for (const item of items) {
    if (typeof item === 'string') {
      if (item === FLEX_SEPARATOR || item === 'flex' || item === '') {
        layout.addFlex();
      } else {
        layout.addFixed(item);
      }
    } else if (item && typeof item === 'object') {
      if (item.flex || item.type === ItemType.FLEX) {
        layout.addFlex(item);
      } else {
        layout.addFixed(item.content || '');
      }
    }
  }

  return layout.render();
}

/**
 * Fill string to terminal width
 * @param {string} left - Left content
 * @param {string} right - Right content
 * @param {Object} [options]
 * @returns {string}
 */
function fillBetween(left, right, options = {}) {
  const termWidth = options.terminalWidth || process.stdout.columns || 80;
  const fillChar = options.fillChar || ' ';
  const leftWidth = visualWidth(left);
  const rightWidth = visualWidth(right);
  const fillWidth = Math.max(1, termWidth - leftWidth - rightWidth);

  return left + fillChar.repeat(fillWidth) + right;
}

/**
 * Create left-center-right layout
 * @param {string} left
 * @param {string} center
 * @param {string} right
 * @param {Object} [options]
 * @returns {string}
 */
function leftCenterRight(left, center, right, options = {}) {
  const termWidth = options.terminalWidth || process.stdout.columns || 80;
  const fillChar = options.fillChar || ' ';

  const leftWidth = visualWidth(left);
  const centerWidth = visualWidth(center);
  const rightWidth = visualWidth(right);

  const totalContent = leftWidth + centerWidth + rightWidth;
  const totalFill = Math.max(0, termWidth - totalContent);
  const leftFill = Math.floor(totalFill / 2);
  const rightFill = totalFill - leftFill;

  return left +
         fillChar.repeat(leftFill) +
         center +
         fillChar.repeat(rightFill) +
         right;
}

module.exports = {
  FlexLayout,
  FlexItem,
  FlexMode,
  ItemType,
  FLEX_SEPARATOR,
  flexRender,
  fillBetween,
  leftCenterRight
};
