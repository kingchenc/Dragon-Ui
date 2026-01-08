/**
 * Widget Base Class
 * Base class for all statusline widgets
 */

/**
 * ANSI color codes for widget formatting
 */
const ANSI_COLORS = {
  // Foreground colors
  black: '\x1b[30m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  gray: '\x1b[90m',

  // Bright foreground colors
  brightRed: '\x1b[91m',
  brightGreen: '\x1b[92m',
  brightYellow: '\x1b[93m',
  brightBlue: '\x1b[94m',
  brightMagenta: '\x1b[95m',
  brightCyan: '\x1b[96m',
  brightWhite: '\x1b[97m',

  // Background colors
  bgBlack: '\x1b[40m',
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgBlue: '\x1b[44m',
  bgMagenta: '\x1b[45m',
  bgCyan: '\x1b[46m',
  bgWhite: '\x1b[47m',

  // Styles
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  italic: '\x1b[3m',
  underline: '\x1b[4m',
  reset: '\x1b[0m'
};

/**
 * Widget configuration interface
 * @typedef {Object} WidgetConfig
 * @property {string} id - Unique widget identifier
 * @property {string} name - Display name
 * @property {boolean} enabled - Whether widget is enabled
 * @property {Object} color - Color configuration { fg, bg }
 * @property {boolean} bold - Use bold text
 * @property {boolean} raw - Disable all formatting
 * @property {string} character - Custom separator character
 * @property {string} merge - Merge mode: 'left', 'right', 'both', 'none'
 * @property {Object} metadata - Widget-specific configuration
 */

class Widget {
  /**
   * Create a widget instance
   * @param {WidgetConfig} config - Widget configuration
   */
  constructor(config = {}) {
    this.id = config.id || 'unknown';
    this.name = config.name || 'Unknown Widget';
    this.description = config.description || '';
    this.enabled = config.enabled !== false;
    this.color = config.color || { fg: 'white', bg: null };
    this.bold = config.bold || false;
    this.raw = config.raw || false;
    this.character = config.character || '';
    this.merge = config.merge || 'none';
    this.keybind = config.keybind || null;
    this.metadata = config.metadata || {};
    this.cacheTimeout = config.cacheTimeout || 5000; // Cache for 5 seconds by default
    this._cache = null;
    this._cacheTime = 0;
  }

  /**
   * Get the widget value (override in subclass)
   * @param {Object} data - Data context for the widget
   * @returns {Promise<string>|string} - Widget value
   */
  async getValue(data) {
    return '';
  }

  /**
   * Get cached value or fetch new value
   * @param {Object} data - Data context
   * @returns {Promise<string>} - Widget value
   */
  async getCachedValue(data) {
    const now = Date.now();
    if (this._cache !== null && (now - this._cacheTime) < this.cacheTimeout) {
      return this._cache;
    }

    const value = await this.getValue(data);
    this._cache = value;
    this._cacheTime = now;
    return value;
  }

  /**
   * Clear the cache
   */
  clearCache() {
    this._cache = null;
    this._cacheTime = 0;
  }

  /**
   * Format the value with colors and styles
   * @param {string} value - Raw value
   * @returns {string} - Formatted value
   */
  format(value) {
    if (this.raw || !value) return value;

    let result = '';

    // Apply bold
    if (this.bold) {
      result += ANSI_COLORS.bold;
    }

    // Apply background color
    if (this.color.bg && ANSI_COLORS[`bg${this.capitalizeFirst(this.color.bg)}`]) {
      result += ANSI_COLORS[`bg${this.capitalizeFirst(this.color.bg)}`];
    }

    // Apply foreground color
    if (this.color.fg && ANSI_COLORS[this.color.fg]) {
      result += ANSI_COLORS[this.color.fg];
    }

    result += value;
    result += ANSI_COLORS.reset;

    return result;
  }

  /**
   * Capitalize first letter
   * @param {string} str - Input string
   * @returns {string}
   */
  capitalizeFirst(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  /**
   * Get widget info for registry
   * @returns {Object}
   */
  getInfo() {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      enabled: this.enabled,
      color: this.color,
      bold: this.bold,
      raw: this.raw,
      character: this.character,
      merge: this.merge,
      keybind: this.keybind,
      metadata: this.metadata
    };
  }

  /**
   * Update widget configuration
   * @param {Object} config - New configuration
   */
  updateConfig(config) {
    if (config.enabled !== undefined) this.enabled = config.enabled;
    if (config.color) this.color = { ...this.color, ...config.color };
    if (config.bold !== undefined) this.bold = config.bold;
    if (config.raw !== undefined) this.raw = config.raw;
    if (config.character !== undefined) this.character = config.character;
    if (config.merge !== undefined) this.merge = config.merge;
    if (config.keybind !== undefined) this.keybind = config.keybind;
    if (config.metadata) this.metadata = { ...this.metadata, ...config.metadata };
    this.clearCache();
  }

  /**
   * Format token count for display
   * @param {number} tokens - Token count
   * @returns {string}
   */
  formatTokens(tokens) {
    if (tokens >= 1000000) {
      return `${(tokens / 1000000).toFixed(1)}M`;
    } else if (tokens >= 1000) {
      return `${(tokens / 1000).toFixed(1)}k`;
    }
    return tokens.toString();
  }

  /**
   * Format cost for display
   * @param {number} cost - Cost in USD
   * @param {string} currency - Currency code
   * @returns {string}
   */
  formatCost(cost, currency = 'USD') {
    const symbols = {
      USD: '$', EUR: '€', GBP: '£', JPY: '¥', CNY: '¥',
      AUD: 'A$', CAD: 'C$', CHF: 'CHF', INR: '₹', KRW: '₩'
    };
    const symbol = symbols[currency] || '$';
    return `${symbol}${cost.toFixed(2)}`;
  }

  /**
   * Format duration for display
   * @param {number} ms - Duration in milliseconds
   * @returns {string}
   */
  formatDuration(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    }
    return `${seconds}s`;
  }
}

module.exports = {
  Widget,
  ANSI_COLORS
};
