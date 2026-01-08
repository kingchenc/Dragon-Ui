/**
 * Currency Formatter for Dragon-UI
 * Multi-currency support with symbols and formatting
 *
 * @module cli/utils/currency-formatter
 */

'use strict';

/**
 * Currency configurations
 */
const CURRENCIES = {
  USD: {
    code: 'USD',
    symbol: '$',
    name: 'US Dollar',
    locale: 'en-US',
    position: 'prefix',
    decimals: 2,
    thousandsSeparator: ',',
    decimalSeparator: '.'
  },
  EUR: {
    code: 'EUR',
    symbol: '€',
    name: 'Euro',
    locale: 'de-DE',
    position: 'suffix',
    decimals: 2,
    thousandsSeparator: '.',
    decimalSeparator: ','
  },
  GBP: {
    code: 'GBP',
    symbol: '£',
    name: 'British Pound',
    locale: 'en-GB',
    position: 'prefix',
    decimals: 2,
    thousandsSeparator: ',',
    decimalSeparator: '.'
  },
  JPY: {
    code: 'JPY',
    symbol: '¥',
    name: 'Japanese Yen',
    locale: 'ja-JP',
    position: 'prefix',
    decimals: 0,
    thousandsSeparator: ',',
    decimalSeparator: '.'
  },
  CNY: {
    code: 'CNY',
    symbol: '¥',
    name: 'Chinese Yuan',
    locale: 'zh-CN',
    position: 'prefix',
    decimals: 2,
    thousandsSeparator: ',',
    decimalSeparator: '.'
  },
  CAD: {
    code: 'CAD',
    symbol: 'CA$',
    name: 'Canadian Dollar',
    locale: 'en-CA',
    position: 'prefix',
    decimals: 2,
    thousandsSeparator: ',',
    decimalSeparator: '.'
  },
  AUD: {
    code: 'AUD',
    symbol: 'A$',
    name: 'Australian Dollar',
    locale: 'en-AU',
    position: 'prefix',
    decimals: 2,
    thousandsSeparator: ',',
    decimalSeparator: '.'
  },
  CHF: {
    code: 'CHF',
    symbol: 'CHF',
    name: 'Swiss Franc',
    locale: 'de-CH',
    position: 'prefix',
    decimals: 2,
    thousandsSeparator: "'",
    decimalSeparator: '.'
  },
  KRW: {
    code: 'KRW',
    symbol: '₩',
    name: 'South Korean Won',
    locale: 'ko-KR',
    position: 'prefix',
    decimals: 0,
    thousandsSeparator: ',',
    decimalSeparator: '.'
  },
  INR: {
    code: 'INR',
    symbol: '₹',
    name: 'Indian Rupee',
    locale: 'en-IN',
    position: 'prefix',
    decimals: 2,
    thousandsSeparator: ',',
    decimalSeparator: '.'
  },
  BRL: {
    code: 'BRL',
    symbol: 'R$',
    name: 'Brazilian Real',
    locale: 'pt-BR',
    position: 'prefix',
    decimals: 2,
    thousandsSeparator: '.',
    decimalSeparator: ','
  },
  MXN: {
    code: 'MXN',
    symbol: 'MX$',
    name: 'Mexican Peso',
    locale: 'es-MX',
    position: 'prefix',
    decimals: 2,
    thousandsSeparator: ',',
    decimalSeparator: '.'
  },
  SGD: {
    code: 'SGD',
    symbol: 'S$',
    name: 'Singapore Dollar',
    locale: 'en-SG',
    position: 'prefix',
    decimals: 2,
    thousandsSeparator: ',',
    decimalSeparator: '.'
  },
  HKD: {
    code: 'HKD',
    symbol: 'HK$',
    name: 'Hong Kong Dollar',
    locale: 'en-HK',
    position: 'prefix',
    decimals: 2,
    thousandsSeparator: ',',
    decimalSeparator: '.'
  },
  SEK: {
    code: 'SEK',
    symbol: 'kr',
    name: 'Swedish Krona',
    locale: 'sv-SE',
    position: 'suffix',
    decimals: 2,
    thousandsSeparator: ' ',
    decimalSeparator: ','
  },
  NOK: {
    code: 'NOK',
    symbol: 'kr',
    name: 'Norwegian Krone',
    locale: 'nb-NO',
    position: 'suffix',
    decimals: 2,
    thousandsSeparator: ' ',
    decimalSeparator: ','
  },
  DKK: {
    code: 'DKK',
    symbol: 'kr',
    name: 'Danish Krone',
    locale: 'da-DK',
    position: 'suffix',
    decimals: 2,
    thousandsSeparator: '.',
    decimalSeparator: ','
  },
  PLN: {
    code: 'PLN',
    symbol: 'zł',
    name: 'Polish Zloty',
    locale: 'pl-PL',
    position: 'suffix',
    decimals: 2,
    thousandsSeparator: ' ',
    decimalSeparator: ','
  },
  RUB: {
    code: 'RUB',
    symbol: '₽',
    name: 'Russian Ruble',
    locale: 'ru-RU',
    position: 'suffix',
    decimals: 2,
    thousandsSeparator: ' ',
    decimalSeparator: ','
  },
  TRY: {
    code: 'TRY',
    symbol: '₺',
    name: 'Turkish Lira',
    locale: 'tr-TR',
    position: 'suffix',
    decimals: 2,
    thousandsSeparator: '.',
    decimalSeparator: ','
  },
  THB: {
    code: 'THB',
    symbol: '฿',
    name: 'Thai Baht',
    locale: 'th-TH',
    position: 'prefix',
    decimals: 2,
    thousandsSeparator: ',',
    decimalSeparator: '.'
  },
  NZD: {
    code: 'NZD',
    symbol: 'NZ$',
    name: 'New Zealand Dollar',
    locale: 'en-NZ',
    position: 'prefix',
    decimals: 2,
    thousandsSeparator: ',',
    decimalSeparator: '.'
  }
};

/**
 * Default currency
 */
let defaultCurrency = 'USD';

/**
 * Exchange rates (to USD)
 * These should be updated from an API in production
 */
const EXCHANGE_RATES = {
  USD: 1.00,
  EUR: 0.92,
  GBP: 0.79,
  JPY: 149.50,
  CNY: 7.24,
  CAD: 1.36,
  AUD: 1.53,
  CHF: 0.88,
  KRW: 1320.00,
  INR: 83.12,
  BRL: 4.97,
  MXN: 17.15,
  SGD: 1.34,
  HKD: 7.82,
  SEK: 10.42,
  NOK: 10.68,
  DKK: 6.87,
  PLN: 3.98,
  RUB: 89.50,
  TRY: 32.10,
  THB: 35.60,
  NZD: 1.64
};

/**
 * Get currency configuration
 * @param {string} code
 * @returns {Object}
 */
function getCurrency(code) {
  const upper = (code || defaultCurrency).toUpperCase();
  return CURRENCIES[upper] || CURRENCIES.USD;
}

/**
 * Set default currency
 * @param {string} code
 */
function setDefaultCurrency(code) {
  const upper = code.toUpperCase();
  if (CURRENCIES[upper]) {
    defaultCurrency = upper;
  }
}

/**
 * Get default currency
 * @returns {string}
 */
function getDefaultCurrency() {
  return defaultCurrency;
}

/**
 * Format number with currency
 * @param {number} amount
 * @param {string} currencyCode
 * @param {Object} options
 * @returns {string}
 */
function formatCurrency(amount, currencyCode = null, options = {}) {
  const currency = getCurrency(currencyCode);
  const value = typeof amount === 'number' ? amount : parseFloat(amount) || 0;

  // Use Intl.NumberFormat if available and not disabled
  if (!options.simple && typeof Intl !== 'undefined') {
    try {
      const formatter = new Intl.NumberFormat(currency.locale, {
        style: 'currency',
        currency: currency.code,
        minimumFractionDigits: options.decimals ?? currency.decimals,
        maximumFractionDigits: options.decimals ?? currency.decimals
      });
      return formatter.format(value);
    } catch (error) {
      // Fall through to manual formatting
    }
  }

  // Manual formatting
  const decimals = options.decimals ?? currency.decimals;
  const formatted = formatNumber(value, decimals, currency.thousandsSeparator, currency.decimalSeparator);

  if (currency.position === 'suffix') {
    return `${formatted} ${currency.symbol}`;
  }
  return `${currency.symbol}${formatted}`;
}

/**
 * Format number with separators
 * @param {number} value
 * @param {number} decimals
 * @param {string} thousandsSep
 * @param {string} decimalSep
 * @returns {string}
 */
function formatNumber(value, decimals, thousandsSep, decimalSep) {
  const fixed = value.toFixed(decimals);
  const [intPart, decPart] = fixed.split('.');

  // Add thousands separator
  const withThousands = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, thousandsSep);

  if (decimals === 0 || !decPart) {
    return withThousands;
  }

  return withThousands + decimalSep + decPart;
}

/**
 * Format cost with appropriate precision
 * @param {number} cost
 * @param {string} currencyCode
 * @param {Object} options
 * @returns {string}
 */
function formatCost(cost, currencyCode = null, options = {}) {
  const currency = getCurrency(currencyCode);
  const value = typeof cost === 'number' ? cost : parseFloat(cost) || 0;

  // Determine decimal places based on value
  let decimals;
  if (options.decimals !== undefined) {
    decimals = options.decimals;
  } else if (Math.abs(value) < 0.01) {
    decimals = 4;
  } else if (Math.abs(value) < 1) {
    decimals = 3;
  } else {
    decimals = currency.decimals;
  }

  return formatCurrency(value, currencyCode, { ...options, decimals });
}

/**
 * Get currency symbol only
 * @param {string} currencyCode
 * @returns {string}
 */
function getSymbol(currencyCode) {
  return getCurrency(currencyCode).symbol;
}

/**
 * Convert between currencies
 * @param {number} amount
 * @param {string} from
 * @param {string} to
 * @returns {number}
 */
function convert(amount, from, to) {
  const fromRate = EXCHANGE_RATES[from.toUpperCase()] || 1;
  const toRate = EXCHANGE_RATES[to.toUpperCase()] || 1;

  // Convert to USD first, then to target currency
  const inUsd = amount / fromRate;
  return inUsd * toRate;
}

/**
 * Format with conversion
 * @param {number} amount
 * @param {string} from
 * @param {string} to
 * @param {Object} options
 * @returns {string}
 */
function formatWithConversion(amount, from, to, options = {}) {
  const converted = convert(amount, from, to);
  return formatCurrency(converted, to, options);
}

/**
 * Get all supported currencies
 * @returns {Object[]}
 */
function getSupportedCurrencies() {
  return Object.values(CURRENCIES).map(c => ({
    code: c.code,
    symbol: c.symbol,
    name: c.name
  }));
}

/**
 * Check if currency is supported
 * @param {string} code
 * @returns {boolean}
 */
function isSupported(code) {
  return CURRENCIES.hasOwnProperty(code.toUpperCase());
}

/**
 * Parse currency string to number
 * @param {string} str
 * @param {string} currencyCode
 * @returns {number}
 */
function parseCurrency(str, currencyCode = null) {
  const currency = getCurrency(currencyCode);

  // Remove currency symbol and whitespace
  let cleaned = str.replace(currency.symbol, '').trim();

  // Replace thousands separator with nothing
  cleaned = cleaned.split(currency.thousandsSeparator).join('');

  // Replace decimal separator with dot
  cleaned = cleaned.replace(currency.decimalSeparator, '.');

  return parseFloat(cleaned) || 0;
}

/**
 * Format compact currency (K, M, B)
 * @param {number} amount
 * @param {string} currencyCode
 * @returns {string}
 */
function formatCompact(amount, currencyCode = null) {
  const currency = getCurrency(currencyCode);
  const absValue = Math.abs(amount);

  let value, suffix;
  if (absValue >= 1e9) {
    value = amount / 1e9;
    suffix = 'B';
  } else if (absValue >= 1e6) {
    value = amount / 1e6;
    suffix = 'M';
  } else if (absValue >= 1e3) {
    value = amount / 1e3;
    suffix = 'K';
  } else {
    return formatCurrency(amount, currencyCode);
  }

  const formatted = value.toFixed(1).replace(/\.0$/, '');

  if (currency.position === 'suffix') {
    return `${formatted}${suffix} ${currency.symbol}`;
  }
  return `${currency.symbol}${formatted}${suffix}`;
}

/**
 * Format for statusline (short)
 * @param {number} amount
 * @param {string} currencyCode
 * @returns {string}
 */
function formatShort(amount, currencyCode = null) {
  const currency = getCurrency(currencyCode);
  const value = typeof amount === 'number' ? amount : parseFloat(amount) || 0;

  // Very small amounts
  if (Math.abs(value) < 0.01) {
    return `${currency.symbol}${value.toFixed(4)}`;
  }

  // Small amounts
  if (Math.abs(value) < 1) {
    return `${currency.symbol}${value.toFixed(3)}`;
  }

  // Regular amounts
  if (Math.abs(value) < 1000) {
    return `${currency.symbol}${value.toFixed(2)}`;
  }

  // Large amounts - use compact
  return formatCompact(value, currencyCode);
}

module.exports = {
  CURRENCIES,
  EXCHANGE_RATES,
  getCurrency,
  setDefaultCurrency,
  getDefaultCurrency,
  formatCurrency,
  formatNumber,
  formatCost,
  getSymbol,
  convert,
  formatWithConversion,
  getSupportedCurrencies,
  isSupported,
  parseCurrency,
  formatCompact,
  formatShort
};
