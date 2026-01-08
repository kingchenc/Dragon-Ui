'use strict';

/**
 * Tiered Pricing Calculator
 * Handles token-based pricing tiers:
 * - 200k token threshold for Claude
 * - 128k token threshold for Gemini
 * - Automatic threshold detection
 * - Split cost calculations
 */

const { getLiteLLMFetcher, DEFAULT_PRICING } = require('./litellm-fetcher.cjs');

/**
 * Tiered pricing thresholds by provider/model
 */
const TIER_THRESHOLDS = {
  // Claude models - 200k threshold
  'claude-3-5-sonnet': { threshold: 200000, multiplier: 1.25 },
  'claude-3-5-haiku': { threshold: 200000, multiplier: 1.25 },
  'claude-3-opus': { threshold: 200000, multiplier: 1.25 },
  'claude-sonnet-4': { threshold: 200000, multiplier: 1.25 },
  'claude-opus-4': { threshold: 200000, multiplier: 1.25 },

  // Gemini models - 128k threshold
  'gemini-1.5-pro': { threshold: 128000, multiplier: 2.0 },
  'gemini-1.5-flash': { threshold: 128000, multiplier: 2.0 },
  'gemini-2.0-flash': { threshold: 128000, multiplier: 2.0 },

  // GPT models - no tiering currently
  'gpt-4o': { threshold: null, multiplier: 1.0 },
  'gpt-4-turbo': { threshold: null, multiplier: 1.0 }
};

/**
 * Cost breakdown result
 */
class CostBreakdown {
  constructor(options = {}) {
    this.modelId = options.modelId || '';
    this.tokens = {
      input: options.inputTokens || 0,
      output: options.outputTokens || 0,
      cached: options.cachedTokens || 0,
      total: 0
    };
    this.tokens.total = this.tokens.input + this.tokens.output;

    this.pricing = {
      inputPer1M: options.inputPer1M || 0,
      outputPer1M: options.outputPer1M || 0,
      cachedPer1M: options.cachedPer1M || 0
    };

    this.tiered = {
      enabled: options.tieredEnabled || false,
      threshold: options.threshold || null,
      multiplier: options.multiplier || 1.0,
      tokensBeforeThreshold: 0,
      tokensAfterThreshold: 0
    };

    this.costs = {
      input: 0,
      output: 0,
      cached: 0,
      tierSurcharge: 0,
      total: 0
    };

    this._calculate();
  }

  /**
   * Calculate costs
   * @private
   */
  _calculate() {
    const { input, output, cached } = this.tokens;
    const { inputPer1M, outputPer1M, cachedPer1M } = this.pricing;
    const { enabled, threshold, multiplier } = this.tiered;

    // Base costs
    this.costs.output = (output / 1000000) * outputPer1M;
    this.costs.cached = (cached / 1000000) * cachedPer1M;

    // Input cost with tiering
    if (enabled && threshold && input > threshold) {
      // Split input tokens
      const belowThreshold = threshold;
      const aboveThreshold = input - threshold;

      this.tiered.tokensBeforeThreshold = belowThreshold;
      this.tiered.tokensAfterThreshold = aboveThreshold;

      // Base rate for tokens below threshold
      const baseCost = (belowThreshold / 1000000) * inputPer1M;

      // Premium rate for tokens above threshold
      const premiumRate = inputPer1M * multiplier;
      const premiumCost = (aboveThreshold / 1000000) * premiumRate;

      this.costs.input = baseCost + premiumCost;
      this.costs.tierSurcharge = premiumCost - ((aboveThreshold / 1000000) * inputPer1M);

    } else {
      // No tiering or below threshold
      this.costs.input = (input / 1000000) * inputPer1M;
      this.tiered.tokensBeforeThreshold = input;
      this.tiered.tokensAfterThreshold = 0;
    }

    this.costs.total = this.costs.input + this.costs.output + this.costs.cached;
  }

  /**
   * Get formatted summary
   * @returns {Object}
   */
  toSummary() {
    return {
      model: this.modelId,
      totalCost: this.costs.total,
      totalTokens: this.tokens.total,
      breakdown: {
        input: { tokens: this.tokens.input, cost: this.costs.input },
        output: { tokens: this.tokens.output, cost: this.costs.output },
        cached: { tokens: this.tokens.cached, cost: this.costs.cached }
      },
      tiering: this.tiered.enabled ? {
        threshold: this.tiered.threshold,
        multiplier: this.tiered.multiplier,
        tokensBelow: this.tiered.tokensBeforeThreshold,
        tokensAbove: this.tiered.tokensAfterThreshold,
        surcharge: this.costs.tierSurcharge
      } : null
    };
  }

  toJSON() {
    return this.toSummary();
  }
}

/**
 * Tiered Pricing Calculator
 */
class TieredPricingCalculator {
  constructor(options = {}) {
    this._thresholds = { ...TIER_THRESHOLDS, ...options.thresholds };
    this._pricingFetcher = options.pricingFetcher || getLiteLLMFetcher();
    this._cache = new Map();
    this._cacheMaxSize = options.cacheMaxSize || 100;
  }

  /**
   * Calculate cost with tiered pricing
   * @param {string} modelId - Model ID
   * @param {Object} tokens - Token counts { input, output, cached }
   * @returns {Promise<CostBreakdown>}
   */
  async calculateCost(modelId, tokens) {
    const pricing = await this._getPricing(modelId);
    const tierConfig = this._getTierConfig(modelId);

    return new CostBreakdown({
      modelId,
      inputTokens: tokens.input || 0,
      outputTokens: tokens.output || 0,
      cachedTokens: tokens.cached || 0,
      inputPer1M: pricing.input || 0,
      outputPer1M: pricing.output || 0,
      cachedPer1M: pricing.cached || pricing.input * 0.1 || 0,
      tieredEnabled: !!tierConfig.threshold,
      threshold: tierConfig.threshold,
      multiplier: tierConfig.multiplier
    });
  }

  /**
   * Calculate simple cost (no breakdown)
   * @param {string} modelId - Model ID
   * @param {Object} tokens - Token counts
   * @returns {Promise<number>}
   */
  async calculateSimpleCost(modelId, tokens) {
    const breakdown = await this.calculateCost(modelId, tokens);
    return breakdown.costs.total;
  }

  /**
   * Get tier configuration for model
   * @param {string} modelId
   * @returns {Object}
   */
  _getTierConfig(modelId) {
    // Check exact match
    if (this._thresholds[modelId]) {
      return this._thresholds[modelId];
    }

    // Check prefix match
    const normalized = modelId.toLowerCase();
    for (const [key, config] of Object.entries(this._thresholds)) {
      if (normalized.startsWith(key.toLowerCase())) {
        return config;
      }
    }

    // Default: no tiering
    return { threshold: null, multiplier: 1.0 };
  }

  /**
   * Get pricing for model
   * @private
   */
  async _getPricing(modelId) {
    // Check cache
    if (this._cache.has(modelId)) {
      return this._cache.get(modelId);
    }

    // Fetch pricing
    const pricing = await this._pricingFetcher.getModelPricing(modelId);

    if (pricing) {
      this._addToCache(modelId, pricing);
      return pricing;
    }

    // Default fallback
    return DEFAULT_PRICING[modelId] || { input: 0, output: 0, cached: 0 };
  }

  /**
   * Add to cache with LRU eviction
   * @private
   */
  _addToCache(key, value) {
    if (this._cache.size >= this._cacheMaxSize) {
      const firstKey = this._cache.keys().next().value;
      this._cache.delete(firstKey);
    }
    this._cache.set(key, value);
  }

  /**
   * Register custom tier threshold
   * @param {string} modelPattern - Model pattern to match
   * @param {Object} config - Tier configuration
   */
  registerTier(modelPattern, config) {
    this._thresholds[modelPattern] = {
      threshold: config.threshold || null,
      multiplier: config.multiplier || 1.0
    };
  }

  /**
   * Get all tier configurations
   * @returns {Object}
   */
  getTiers() {
    return { ...this._thresholds };
  }

  /**
   * Check if model has tiered pricing
   * @param {string} modelId
   * @returns {boolean}
   */
  hasTieredPricing(modelId) {
    const config = this._getTierConfig(modelId);
    return config.threshold !== null;
  }

  /**
   * Get threshold for model
   * @param {string} modelId
   * @returns {number|null}
   */
  getThreshold(modelId) {
    const config = this._getTierConfig(modelId);
    return config.threshold;
  }

  /**
   * Clear cache
   */
  clearCache() {
    this._cache.clear();
  }
}

// Singleton instance
let _calculator = null;

/**
 * Get singleton calculator instance
 * @param {Object} [options]
 * @returns {TieredPricingCalculator}
 */
function getTieredPricingCalculator(options) {
  if (!_calculator) {
    _calculator = new TieredPricingCalculator(options);
  }
  return _calculator;
}

/**
 * Reset singleton (for testing)
 */
function resetTieredPricingCalculator() {
  _calculator = null;
}

/**
 * Quick cost calculation
 * @param {string} modelId - Model ID
 * @param {Object} tokens - Token counts
 * @returns {Promise<number>}
 */
async function calculateCost(modelId, tokens) {
  const calculator = getTieredPricingCalculator();
  return calculator.calculateSimpleCost(modelId, tokens);
}

/**
 * Quick cost breakdown
 * @param {string} modelId - Model ID
 * @param {Object} tokens - Token counts
 * @returns {Promise<CostBreakdown>}
 */
async function getCostBreakdown(modelId, tokens) {
  const calculator = getTieredPricingCalculator();
  return calculator.calculateCost(modelId, tokens);
}

module.exports = {
  TieredPricingCalculator,
  CostBreakdown,
  getTieredPricingCalculator,
  resetTieredPricingCalculator,
  calculateCost,
  getCostBreakdown,
  TIER_THRESHOLDS
};
