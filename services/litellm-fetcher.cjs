'use strict';

/**
 * LiteLLM Pricing Fetcher
 * Fetches dynamic pricing from models.dev API with 24-hour caching
 * Falls back to bundled pricing when API is unavailable
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const LITELLM_API_URL = 'https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json';
const MODELS_DEV_API_URL = 'https://api.models.dev/v1/models';
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours
const CACHE_FILE = path.join(os.tmpdir(), 'dragon-ui-litellm-pricing.json');

/**
 * Default bundled pricing (fallback)
 */
const DEFAULT_PRICING = {
  // Claude models
  'claude-3-5-sonnet-20241022': { input: 3.0, output: 15.0, cached: 0.3 },
  'claude-3-5-haiku-20241022': { input: 0.8, output: 4.0, cached: 0.08 },
  'claude-3-opus-20240229': { input: 15.0, output: 75.0, cached: 1.5 },
  'claude-sonnet-4-20250514': { input: 3.0, output: 15.0, cached: 0.3 },
  'claude-opus-4-20250514': { input: 15.0, output: 75.0, cached: 1.5 },

  // GPT models
  'gpt-4o': { input: 2.5, output: 10.0, cached: 1.25 },
  'gpt-4o-mini': { input: 0.15, output: 0.6, cached: 0.075 },
  'gpt-4-turbo': { input: 10.0, output: 30.0, cached: 5.0 },
  'gpt-3.5-turbo': { input: 0.5, output: 1.5, cached: 0.25 },
  'o1': { input: 15.0, output: 60.0, cached: 7.5 },
  'o1-mini': { input: 3.0, output: 12.0, cached: 1.5 },

  // Gemini models
  'gemini-2.0-flash': { input: 0.1, output: 0.4, cached: 0.025 },
  'gemini-1.5-pro': { input: 1.25, output: 5.0, cached: 0.3125 },
  'gemini-1.5-flash': { input: 0.075, output: 0.3, cached: 0.01875 },

  // Llama models
  'llama-3.3-70b': { input: 0.59, output: 0.79, cached: 0.295 },
  'llama-3.1-405b': { input: 3.0, output: 3.0, cached: 1.5 },
  'llama-3.1-70b': { input: 0.52, output: 0.75, cached: 0.26 },
  'llama-3.1-8b': { input: 0.05, output: 0.08, cached: 0.025 },

  // Mistral models
  'mistral-large': { input: 2.0, output: 6.0, cached: 1.0 },
  'mixtral-8x7b': { input: 0.24, output: 0.24, cached: 0.12 },
  'mixtral-8x22b': { input: 0.65, output: 0.65, cached: 0.325 }
};

/**
 * LiteLLM Pricing Fetcher
 */
class LiteLLMFetcher {
  constructor(options = {}) {
    this._cacheFile = options.cacheFile || CACHE_FILE;
    this._cacheTTL = options.cacheTTL || CACHE_TTL;
    this._pricing = null;
    this._lastFetch = null;
    this._fetchPromise = null;
    this._useCache = options.useCache !== false;
  }

  /**
   * Get pricing for all models
   * @param {boolean} [forceRefresh=false] - Force refresh from API
   * @returns {Promise<Object>}
   */
  async getPricing(forceRefresh = false) {
    // Return cached if valid
    if (!forceRefresh && this._pricing && this._isCacheValid()) {
      return this._pricing;
    }

    // Try to load from file cache
    if (!forceRefresh && this._useCache) {
      const fileCached = this._loadFromFile();
      if (fileCached) {
        this._pricing = fileCached.pricing;
        this._lastFetch = fileCached.timestamp;
        return this._pricing;
      }
    }

    // Fetch from API
    try {
      // Prevent concurrent fetches
      if (this._fetchPromise) {
        return await this._fetchPromise;
      }

      this._fetchPromise = this._fetchFromAPI();
      this._pricing = await this._fetchPromise;
      this._lastFetch = Date.now();

      // Save to file cache
      if (this._useCache) {
        this._saveToFile();
      }

      return this._pricing;

    } catch (error) {
      console.error('Failed to fetch LiteLLM pricing:', error.message);
      // Fall back to default pricing
      return DEFAULT_PRICING;

    } finally {
      this._fetchPromise = null;
    }
  }

  /**
   * Get pricing for a specific model
   * @param {string} modelId - Model ID
   * @returns {Promise<Object|null>}
   */
  async getModelPricing(modelId) {
    const pricing = await this.getPricing();
    return this._findModelPricing(modelId, pricing);
  }

  /**
   * Find model pricing with fallback search
   * @private
   */
  _findModelPricing(modelId, pricing) {
    // Exact match
    if (pricing[modelId]) {
      return pricing[modelId];
    }

    // Normalize and try again
    const normalized = modelId.toLowerCase().replace(/[_\s]/g, '-');
    if (pricing[normalized]) {
      return pricing[normalized];
    }

    // Try without version suffix
    const baseModel = modelId.replace(/-\d{8}$/, '');
    if (pricing[baseModel]) {
      return pricing[baseModel];
    }

    // Try prefix match
    for (const [key, value] of Object.entries(pricing)) {
      if (key.startsWith(normalized) || normalized.startsWith(key)) {
        return value;
      }
    }

    return null;
  }

  /**
   * Fetch pricing from LiteLLM API
   * @private
   */
  async _fetchFromAPI() {
    const pricing = {};

    // Try LiteLLM GitHub first
    try {
      const response = await fetch(LITELLM_API_URL, {
        timeout: 10000
      });

      if (response.ok) {
        const data = await response.json();
        this._parseLiteLLMPricing(data, pricing);
      }
    } catch (e) {
      console.warn('LiteLLM GitHub fetch failed:', e.message);
    }

    // If we got pricing, return it
    if (Object.keys(pricing).length > 0) {
      return pricing;
    }

    // Fall back to default
    return DEFAULT_PRICING;
  }

  /**
   * Parse LiteLLM pricing format
   * @private
   */
  _parseLiteLLMPricing(data, pricing) {
    for (const [modelId, info] of Object.entries(data)) {
      if (info.input_cost_per_token || info.output_cost_per_token) {
        pricing[modelId] = {
          input: (info.input_cost_per_token || 0) * 1000000,
          output: (info.output_cost_per_token || 0) * 1000000,
          cached: (info.cache_read_input_token_cost || info.input_cost_per_token * 0.1 || 0) * 1000000,
          contextWindow: info.max_tokens || info.max_input_tokens || 128000,
          maxOutput: info.max_output_tokens
        };
      }
    }
  }

  /**
   * Check if cache is valid
   * @private
   */
  _isCacheValid() {
    if (!this._lastFetch) return false;
    return Date.now() - this._lastFetch < this._cacheTTL;
  }

  /**
   * Load pricing from file cache
   * @private
   */
  _loadFromFile() {
    try {
      if (!fs.existsSync(this._cacheFile)) {
        return null;
      }

      const content = fs.readFileSync(this._cacheFile, 'utf8');
      const data = JSON.parse(content);

      // Check if file cache is still valid
      if (Date.now() - data.timestamp < this._cacheTTL) {
        return data;
      }

      return null;

    } catch (error) {
      console.warn('Failed to load pricing cache:', error.message);
      return null;
    }
  }

  /**
   * Save pricing to file cache
   * @private
   */
  _saveToFile() {
    try {
      const data = {
        timestamp: this._lastFetch,
        version: '1.0',
        pricing: this._pricing
      };

      fs.writeFileSync(this._cacheFile, JSON.stringify(data, null, 2));

    } catch (error) {
      console.warn('Failed to save pricing cache:', error.message);
    }
  }

  /**
   * Clear cache
   */
  clearCache() {
    this._pricing = null;
    this._lastFetch = null;

    try {
      if (fs.existsSync(this._cacheFile)) {
        fs.unlinkSync(this._cacheFile);
      }
    } catch (e) {
      // Ignore
    }
  }

  /**
   * Get cache status
   * @returns {Object}
   */
  getCacheStatus() {
    return {
      hasPricing: !!this._pricing,
      modelCount: this._pricing ? Object.keys(this._pricing).length : 0,
      lastFetch: this._lastFetch ? new Date(this._lastFetch).toISOString() : null,
      cacheValid: this._isCacheValid(),
      cacheFile: this._cacheFile,
      cacheTTL: this._cacheTTL
    };
  }

  /**
   * Get default pricing
   * @returns {Object}
   */
  static getDefaultPricing() {
    return { ...DEFAULT_PRICING };
  }
}

// Singleton instance
let _fetcher = null;

/**
 * Get singleton fetcher instance
 * @param {Object} [options]
 * @returns {LiteLLMFetcher}
 */
function getLiteLLMFetcher(options) {
  if (!_fetcher) {
    _fetcher = new LiteLLMFetcher(options);
  }
  return _fetcher;
}

/**
 * Reset singleton (for testing)
 */
function resetLiteLLMFetcher() {
  if (_fetcher) {
    _fetcher.clearCache();
  }
  _fetcher = null;
}

/**
 * Quick pricing lookup
 * @param {string} modelId - Model ID
 * @returns {Promise<Object|null>}
 */
async function getModelPricing(modelId) {
  const fetcher = getLiteLLMFetcher();
  return fetcher.getModelPricing(modelId);
}

module.exports = {
  LiteLLMFetcher,
  getLiteLLMFetcher,
  resetLiteLLMFetcher,
  getModelPricing,
  DEFAULT_PRICING,
  LITELLM_API_URL,
  CACHE_TTL
};
