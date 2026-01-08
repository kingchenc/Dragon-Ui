'use strict';

/**
 * Context Suffix Detector
 * Detects [1m] suffix in model display for 1M context window models
 * Features:
 * - Automatic detection of extended context models
 * - Dynamic context display based on model
 * - Support for Sonnet 4.5 with 1M context
 */

/**
 * Context window configurations by model
 */
const MODEL_CONTEXT_WINDOWS = {
  // Claude models - default 200k
  'claude-3-5-sonnet-20241022': { default: 200000, extended: 1000000 },
  'claude-3-5-haiku-20241022': { default: 200000, extended: null },
  'claude-3-opus-20240229': { default: 200000, extended: null },
  'claude-sonnet-4-20250514': { default: 200000, extended: 1000000 },
  'claude-opus-4-20250514': { default: 200000, extended: 1000000 },

  // GPT models
  'gpt-4o': { default: 128000, extended: null },
  'gpt-4o-mini': { default: 128000, extended: null },
  'gpt-4-turbo': { default: 128000, extended: null },
  'o1': { default: 200000, extended: null },
  'o1-mini': { default: 128000, extended: null },

  // Gemini models - 1M/2M context
  'gemini-2.0-flash': { default: 1000000, extended: null },
  'gemini-1.5-pro': { default: 2000000, extended: null },
  'gemini-1.5-flash': { default: 1000000, extended: null },

  // Llama models
  'llama-3.1-405b': { default: 128000, extended: null },
  'llama-3.1-70b': { default: 128000, extended: null }
};

/**
 * Context suffix patterns
 */
const CONTEXT_SUFFIXES = {
  '1m': 1000000,
  '1M': 1000000,
  '[1m]': 1000000,
  '[1M]': 1000000,
  '200k': 200000,
  '200K': 200000,
  '[200k]': 200000,
  '128k': 128000,
  '128K': 128000,
  '[128k]': 128000
};

/**
 * Detect context suffix in model ID
 * @param {string} modelId - Model ID to check
 * @returns {Object} { hasSuffix, suffix, contextWindow }
 */
function detectContextSuffix(modelId) {
  if (!modelId || typeof modelId !== 'string') {
    return { hasSuffix: false, suffix: null, contextWindow: null };
  }

  // Check for known suffix patterns
  for (const [suffix, contextWindow] of Object.entries(CONTEXT_SUFFIXES)) {
    if (modelId.includes(suffix) || modelId.endsWith(suffix)) {
      return {
        hasSuffix: true,
        suffix,
        contextWindow
      };
    }
  }

  return { hasSuffix: false, suffix: null, contextWindow: null };
}

/**
 * Get context window for model
 * @param {string} modelId - Model ID
 * @param {Object} [options] - Options
 * @returns {number} Context window size
 */
function getContextWindow(modelId, options = {}) {
  if (!modelId) return 200000; // Default

  // Check for suffix in model ID
  const suffixInfo = detectContextSuffix(modelId);
  if (suffixInfo.hasSuffix) {
    return suffixInfo.contextWindow;
  }

  // Normalize model ID for lookup
  const normalized = normalizeModelId(modelId);

  // Check known models
  const config = MODEL_CONTEXT_WINDOWS[normalized];
  if (config) {
    // Check if extended context is requested/detected
    if (options.extended && config.extended) {
      return config.extended;
    }
    return config.default;
  }

  // Prefix matching for versioned models
  for (const [key, value] of Object.entries(MODEL_CONTEXT_WINDOWS)) {
    if (normalized.startsWith(key.replace(/-\d{8}$/, ''))) {
      if (options.extended && value.extended) {
        return value.extended;
      }
      return value.default;
    }
  }

  // Default fallback
  return 200000;
}

/**
 * Normalize model ID
 * @param {string} modelId
 * @returns {string}
 */
function normalizeModelId(modelId) {
  return modelId
    .toLowerCase()
    .replace(/\[1m\]/gi, '')
    .replace(/\[200k\]/gi, '')
    .replace(/\[128k\]/gi, '')
    .trim();
}

/**
 * Format context window for display
 * @param {number} contextWindow
 * @returns {string}
 */
function formatContextWindow(contextWindow) {
  if (contextWindow >= 1000000) {
    const millions = contextWindow / 1000000;
    return millions === 1 ? '1M' : `${millions}M`;
  } else if (contextWindow >= 1000) {
    return `${contextWindow / 1000}k`;
  }
  return contextWindow.toString();
}

/**
 * Get model display with context suffix
 * @param {string} modelId - Model ID
 * @param {Object} [options] - Options
 * @returns {string} Display name with suffix if applicable
 */
function getModelDisplayWithContext(modelId, options = {}) {
  if (!modelId) return 'Unknown';

  const suffixInfo = detectContextSuffix(modelId);

  // If model already has suffix, return as-is
  if (suffixInfo.hasSuffix) {
    return modelId;
  }

  // Check if model supports extended context
  const normalized = normalizeModelId(modelId);
  const config = MODEL_CONTEXT_WINDOWS[normalized];

  if (config && config.extended && options.showExtended) {
    const suffix = formatContextWindow(config.extended);
    return `${modelId} [${suffix}]`;
  }

  return modelId;
}

/**
 * Check if model supports extended context
 * @param {string} modelId
 * @returns {boolean}
 */
function supportsExtendedContext(modelId) {
  if (!modelId) return false;

  const normalized = normalizeModelId(modelId);
  const config = MODEL_CONTEXT_WINDOWS[normalized];

  return config && config.extended !== null;
}

/**
 * Get context usage indicator
 * @param {number} usedTokens - Tokens used
 * @param {number} contextWindow - Context window size
 * @returns {Object} { percentage, indicator, color }
 */
function getContextUsageIndicator(usedTokens, contextWindow) {
  const percentage = (usedTokens / contextWindow) * 100;

  let indicator, color;

  if (percentage < 50) {
    indicator = '🟢';
    color = 'green';
  } else if (percentage < 80) {
    indicator = '🟡';
    color = 'yellow';
  } else {
    indicator = '🔴';
    color = 'red';
  }

  return {
    percentage: Math.round(percentage * 10) / 10,
    indicator,
    color,
    remaining: contextWindow - usedTokens,
    usable: Math.floor(contextWindow * 0.8)
  };
}

/**
 * Context Detector class for widget integration
 */
class ContextDetector {
  constructor(options = {}) {
    this._customModels = new Map();
    this._defaultWindow = options.defaultWindow || 200000;
  }

  /**
   * Register custom model context
   * @param {string} modelId
   * @param {Object} config
   */
  registerModel(modelId, config) {
    this._customModels.set(normalizeModelId(modelId), {
      default: config.default || config.contextWindow || this._defaultWindow,
      extended: config.extended || null
    });
  }

  /**
   * Get context window for model
   * @param {string} modelId
   * @param {Object} [options]
   * @returns {number}
   */
  getContextWindow(modelId, options = {}) {
    // Check custom models first
    const normalized = normalizeModelId(modelId);
    if (this._customModels.has(normalized)) {
      const config = this._customModels.get(normalized);
      if (options.extended && config.extended) {
        return config.extended;
      }
      return config.default;
    }

    // Fall back to global function
    return getContextWindow(modelId, options);
  }

  /**
   * Detect suffix in model ID
   * @param {string} modelId
   * @returns {Object}
   */
  detectSuffix(modelId) {
    return detectContextSuffix(modelId);
  }

  /**
   * Get display name with context
   * @param {string} modelId
   * @param {Object} [options]
   * @returns {string}
   */
  getDisplayName(modelId, options = {}) {
    return getModelDisplayWithContext(modelId, options);
  }

  /**
   * Get usage indicator
   * @param {number} usedTokens
   * @param {string} modelId
   * @param {Object} [options]
   * @returns {Object}
   */
  getUsageIndicator(usedTokens, modelId, options = {}) {
    const contextWindow = this.getContextWindow(modelId, options);
    return getContextUsageIndicator(usedTokens, contextWindow);
  }
}

// Singleton instance
let _detector = null;

/**
 * Get singleton detector
 * @param {Object} [options]
 * @returns {ContextDetector}
 */
function getContextDetector(options) {
  if (!_detector) {
    _detector = new ContextDetector(options);
  }
  return _detector;
}

module.exports = {
  ContextDetector,
  getContextDetector,
  detectContextSuffix,
  getContextWindow,
  getModelDisplayWithContext,
  supportsExtendedContext,
  getContextUsageIndicator,
  formatContextWindow,
  normalizeModelId,
  MODEL_CONTEXT_WINDOWS,
  CONTEXT_SUFFIXES
};
