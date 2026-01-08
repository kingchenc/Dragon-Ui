/**
 * Date Formatter for Dragon-UI
 * Timezone and locale-aware date formatting
 *
 * @module cli/utils/date-formatter
 */

'use strict';

/**
 * Default configuration
 */
const DEFAULT_CONFIG = {
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  locale: Intl.DateTimeFormat().resolvedOptions().locale,
  dateStyle: 'medium',
  timeStyle: 'medium',
  hour12: undefined // Use locale default
};

/**
 * Predefined format presets
 */
const FORMAT_PRESETS = {
  full: { dateStyle: 'full', timeStyle: 'long' },
  long: { dateStyle: 'long', timeStyle: 'long' },
  medium: { dateStyle: 'medium', timeStyle: 'medium' },
  short: { dateStyle: 'short', timeStyle: 'short' },
  date: { dateStyle: 'medium' },
  time: { timeStyle: 'medium' },
  iso: 'ISO',
  relative: 'RELATIVE',
  compact: 'COMPACT'
};

/**
 * Common timezone aliases
 */
const TIMEZONE_ALIASES = {
  'EST': 'America/New_York',
  'EDT': 'America/New_York',
  'CST': 'America/Chicago',
  'CDT': 'America/Chicago',
  'MST': 'America/Denver',
  'MDT': 'America/Denver',
  'PST': 'America/Los_Angeles',
  'PDT': 'America/Los_Angeles',
  'GMT': 'Europe/London',
  'BST': 'Europe/London',
  'CET': 'Europe/Paris',
  'CEST': 'Europe/Paris',
  'JST': 'Asia/Tokyo',
  'IST': 'Asia/Kolkata',
  'AEST': 'Australia/Sydney',
  'AEDT': 'Australia/Sydney',
  'UTC': 'UTC'
};

/**
 * Resolve timezone alias
 * @param {string} tz
 * @returns {string}
 */
function resolveTimezone(tz) {
  if (!tz) return DEFAULT_CONFIG.timezone;
  return TIMEZONE_ALIASES[tz.toUpperCase()] || tz;
}

/**
 * Validate timezone
 * @param {string} tz
 * @returns {boolean}
 */
function isValidTimezone(tz) {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate locale
 * @param {string} locale
 * @returns {boolean}
 */
function isValidLocale(locale) {
  try {
    Intl.DateTimeFormat(locale);
    return true;
  } catch {
    return false;
  }
}

/**
 * Date Formatter class
 */
class DateFormatter {
  constructor(config = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    // Resolve timezone alias
    if (this.config.timezone) {
      this.config.timezone = resolveTimezone(this.config.timezone);
    }

    // Validate timezone
    if (!isValidTimezone(this.config.timezone)) {
      console.warn(`Invalid timezone: ${this.config.timezone}, using system default`);
      this.config.timezone = DEFAULT_CONFIG.timezone;
    }

    // Validate locale
    if (this.config.locale && !isValidLocale(this.config.locale)) {
      console.warn(`Invalid locale: ${this.config.locale}, using system default`);
      this.config.locale = DEFAULT_CONFIG.locale;
    }
  }

  /**
   * Set timezone
   * @param {string} timezone
   * @returns {DateFormatter}
   */
  setTimezone(timezone) {
    const resolved = resolveTimezone(timezone);
    if (isValidTimezone(resolved)) {
      this.config.timezone = resolved;
    }
    return this;
  }

  /**
   * Set locale
   * @param {string} locale
   * @returns {DateFormatter}
   */
  setLocale(locale) {
    if (isValidLocale(locale)) {
      this.config.locale = locale;
    }
    return this;
  }

  /**
   * Parse date input
   * @param {any} input
   * @returns {Date}
   */
  parseDate(input) {
    if (input instanceof Date) {
      return input;
    }
    if (typeof input === 'number') {
      return new Date(input);
    }
    if (typeof input === 'string') {
      const parsed = new Date(input);
      if (!isNaN(parsed.getTime())) {
        return parsed;
      }
    }
    return new Date();
  }

  /**
   * Format date with preset or options
   * @param {any} date
   * @param {string|Object} formatOrOptions
   * @returns {string}
   */
  format(date, formatOrOptions = 'medium') {
    const d = this.parseDate(date);

    // Handle string presets
    if (typeof formatOrOptions === 'string') {
      const preset = FORMAT_PRESETS[formatOrOptions];

      if (preset === 'ISO') {
        return this.formatISO(d);
      }

      if (preset === 'RELATIVE') {
        return this.formatRelative(d);
      }

      if (preset === 'COMPACT') {
        return this.formatCompact(d);
      }

      if (preset && typeof preset === 'object') {
        formatOrOptions = preset;
      } else {
        formatOrOptions = FORMAT_PRESETS.medium;
      }
    }

    const options = {
      ...formatOrOptions,
      timeZone: this.config.timezone
    };

    if (this.config.hour12 !== undefined) {
      options.hour12 = this.config.hour12;
    }

    try {
      return new Intl.DateTimeFormat(this.config.locale, options).format(d);
    } catch (error) {
      return d.toLocaleString(this.config.locale);
    }
  }

  /**
   * Format as ISO string
   * @param {any} date
   * @returns {string}
   */
  formatISO(date) {
    const d = this.parseDate(date);
    return d.toISOString();
  }

  /**
   * Format as relative time (e.g., "5 minutes ago")
   * @param {any} date
   * @returns {string}
   */
  formatRelative(date) {
    const d = this.parseDate(date);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const absDiff = Math.abs(diff);

    const units = [
      { unit: 'year', ms: 365 * 24 * 60 * 60 * 1000 },
      { unit: 'month', ms: 30 * 24 * 60 * 60 * 1000 },
      { unit: 'week', ms: 7 * 24 * 60 * 60 * 1000 },
      { unit: 'day', ms: 24 * 60 * 60 * 1000 },
      { unit: 'hour', ms: 60 * 60 * 1000 },
      { unit: 'minute', ms: 60 * 1000 },
      { unit: 'second', ms: 1000 }
    ];

    for (const { unit, ms } of units) {
      if (absDiff >= ms) {
        const value = Math.floor(absDiff / ms);

        try {
          const rtf = new Intl.RelativeTimeFormat(this.config.locale, { numeric: 'auto' });
          return rtf.format(diff > 0 ? -value : value, unit);
        } catch {
          // Fallback
          const suffix = diff > 0 ? 'ago' : 'from now';
          return `${value} ${unit}${value !== 1 ? 's' : ''} ${suffix}`;
        }
      }
    }

    return 'just now';
  }

  /**
   * Format as compact string (e.g., "2024-01-15 14:30")
   * @param {any} date
   * @returns {string}
   */
  formatCompact(date) {
    const d = this.parseDate(date);

    // Convert to timezone
    const options = {
      timeZone: this.config.timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    };

    try {
      const parts = new Intl.DateTimeFormat(this.config.locale, options).formatToParts(d);
      const values = {};
      for (const part of parts) {
        values[part.type] = part.value;
      }

      return `${values.year}-${values.month}-${values.day} ${values.hour}:${values.minute}`;
    } catch {
      return d.toISOString().slice(0, 16).replace('T', ' ');
    }
  }

  /**
   * Format date only
   * @param {any} date
   * @param {string} style
   * @returns {string}
   */
  formatDate(date, style = 'medium') {
    return this.format(date, { dateStyle: style, timeZone: this.config.timezone });
  }

  /**
   * Format time only
   * @param {any} date
   * @param {string} style
   * @returns {string}
   */
  formatTime(date, style = 'medium') {
    return this.format(date, { timeStyle: style, timeZone: this.config.timezone });
  }

  /**
   * Format duration in milliseconds
   * @param {number} ms
   * @param {Object} options
   * @returns {string}
   */
  formatDuration(ms, options = {}) {
    const { compact = false, maxUnits = 2 } = options;

    const units = [
      { name: 'day', short: 'd', ms: 24 * 60 * 60 * 1000 },
      { name: 'hour', short: 'h', ms: 60 * 60 * 1000 },
      { name: 'minute', short: 'm', ms: 60 * 1000 },
      { name: 'second', short: 's', ms: 1000 },
      { name: 'millisecond', short: 'ms', ms: 1 }
    ];

    if (ms < 1000 && !options.showMs) {
      return compact ? '<1s' : 'less than a second';
    }

    const parts = [];
    let remaining = Math.abs(ms);

    for (const unit of units) {
      if (unit.name === 'millisecond' && !options.showMs) continue;

      if (remaining >= unit.ms || (parts.length > 0 && unit.name !== 'millisecond')) {
        const value = Math.floor(remaining / unit.ms);
        remaining = remaining % unit.ms;

        if (value > 0) {
          if (compact) {
            parts.push(`${value}${unit.short}`);
          } else {
            const plural = value !== 1 ? 's' : '';
            parts.push(`${value} ${unit.name}${plural}`);
          }

          if (parts.length >= maxUnits) break;
        }
      }
    }

    if (parts.length === 0) {
      return compact ? '0s' : '0 seconds';
    }

    return parts.join(compact ? '' : ', ');
  }

  /**
   * Get current date in configured timezone
   * @returns {Date}
   */
  now() {
    return new Date();
  }

  /**
   * Get start of day in configured timezone
   * @param {any} date
   * @returns {Date}
   */
  startOfDay(date) {
    const d = this.parseDate(date);
    const options = {
      timeZone: this.config.timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    };

    const formatted = new Intl.DateTimeFormat('en-CA', options).format(d);
    return new Date(formatted + 'T00:00:00');
  }

  /**
   * Get end of day in configured timezone
   * @param {any} date
   * @returns {Date}
   */
  endOfDay(date) {
    const d = this.parseDate(date);
    const options = {
      timeZone: this.config.timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    };

    const formatted = new Intl.DateTimeFormat('en-CA', options).format(d);
    return new Date(formatted + 'T23:59:59.999');
  }

  /**
   * Get configuration
   * @returns {Object}
   */
  getConfig() {
    return { ...this.config };
  }

  /**
   * Get available timezones
   * @returns {string[]}
   */
  static getTimezones() {
    return Intl.supportedValuesOf('timeZone');
  }

  /**
   * Get timezone aliases
   * @returns {Object}
   */
  static getTimezoneAliases() {
    return { ...TIMEZONE_ALIASES };
  }
}

// Singleton instance
let instance = null;

/**
 * Get Date Formatter instance
 * @param {Object} config
 * @returns {DateFormatter}
 */
function getDateFormatter(config) {
  if (!instance) {
    instance = new DateFormatter(config);
  } else if (config) {
    // Update config
    if (config.timezone) instance.setTimezone(config.timezone);
    if (config.locale) instance.setLocale(config.locale);
  }
  return instance;
}

module.exports = {
  DateFormatter,
  getDateFormatter,
  resolveTimezone,
  isValidTimezone,
  isValidLocale,
  FORMAT_PRESETS,
  TIMEZONE_ALIASES,
  DEFAULT_CONFIG
};
