'use strict';

/**
 * Model Matcher Service
 * 3-Tier Fallback System for model detection:
 * - Tier 1: Exact Match
 * - Tier 2: Suffix Match (provider/model-name)
 * - Tier 3: Fuzzy Match (scored partial matching)
 */

const { FuzzySearch, createFuzzyMatcher } = require('./fuzzy-search.cjs');

/**
 * Match result with confidence
 */
class MatchResult {
  constructor(modelId, matchedId, tier, score, provider) {
    this.modelId = modelId;           // Original query
    this.matchedId = matchedId;       // Matched model ID
    this.tier = tier;                 // 1, 2, or 3
    this.score = score;               // 0-1 confidence
    this.provider = provider;         // Provider if detected
  }

  get isExact() {
    return this.tier === 1;
  }

  get isSuffix() {
    return this.tier === 2;
  }

  get isFuzzy() {
    return this.tier === 3;
  }

  toJSON() {
    return {
      modelId: this.modelId,
      matchedId: this.matchedId,
      tier: this.tier,
      score: this.score,
      provider: this.provider
    };
  }
}

/**
 * Model Matcher with 3-tier fallback
 */
class ModelMatcher {
  constructor(options = {}) {
    this._models = new Map();
    this._aliases = new Map();
    this._providerPrefixes = new Map();
    this._fuzzyMatcher = null;
    this._cache = new Map();
    this._cacheMaxSize = options.cacheMaxSize || 1000;
    this._fuzzyThreshold = options.fuzzyThreshold || 0.5;
  }

  /**
   * Register a model
   * @param {string} modelId - Model ID
   * @param {Object} info - Model info
   */
  registerModel(modelId, info = {}) {
    const normalized = this._normalize(modelId);
    this._models.set(normalized, {
      id: modelId,
      ...info
    });
    this._invalidateCache();
  }

  /**
   * Register multiple models
   * @param {Object} models - Map of model ID to info
   */
  registerModels(models) {
    for (const [id, info] of Object.entries(models)) {
      this.registerModel(id, info);
    }
  }

  /**
   * Register an alias
   * @param {string} alias - Alias name
   * @param {string} targetId - Target model ID
   */
  registerAlias(alias, targetId) {
    const normalizedAlias = this._normalize(alias);
    const normalizedTarget = this._normalize(targetId);
    this._aliases.set(normalizedAlias, normalizedTarget);
    this._invalidateCache();
  }

  /**
   * Register provider prefix
   * @param {string} prefix - Provider prefix (e.g., "openai", "anthropic")
   * @param {string} providerId - Provider ID
   */
  registerProviderPrefix(prefix, providerId) {
    this._providerPrefixes.set(this._normalize(prefix), providerId);
  }

  /**
   * Match a model ID using 3-tier fallback
   * @param {string} modelId - Model ID to match
   * @returns {MatchResult|null}
   */
  match(modelId) {
    if (!modelId) return null;

    const normalized = this._normalize(modelId);

    // Check cache
    if (this._cache.has(normalized)) {
      return this._cache.get(normalized);
    }

    let result = null;

    // Tier 1: Exact Match
    result = this._tier1ExactMatch(normalized, modelId);
    if (result) {
      this._addToCache(normalized, result);
      return result;
    }

    // Tier 2: Suffix Match (handles "provider/model" format)
    result = this._tier2SuffixMatch(normalized, modelId);
    if (result) {
      this._addToCache(normalized, result);
      return result;
    }

    // Tier 3: Fuzzy Match
    result = this._tier3FuzzyMatch(normalized, modelId);
    if (result) {
      this._addToCache(normalized, result);
      return result;
    }

    return null;
  }

  /**
   * Tier 1: Exact Match
   * @private
   */
  _tier1ExactMatch(normalized, original) {
    // Direct model match
    if (this._models.has(normalized)) {
      const model = this._models.get(normalized);
      return new MatchResult(original, model.id, 1, 1.0, model.provider);
    }

    // Alias match
    if (this._aliases.has(normalized)) {
      const targetNorm = this._aliases.get(normalized);
      if (this._models.has(targetNorm)) {
        const model = this._models.get(targetNorm);
        return new MatchResult(original, model.id, 1, 1.0, model.provider);
      }
    }

    return null;
  }

  /**
   * Tier 2: Suffix Match
   * Handles "provider/model-name" format
   * @private
   */
  _tier2SuffixMatch(normalized, original) {
    // Check if it's in "provider/model" format
    const slashIndex = normalized.indexOf('/');
    let provider = null;
    let modelPart = normalized;

    if (slashIndex !== -1) {
      const prefix = normalized.substring(0, slashIndex);
      modelPart = normalized.substring(slashIndex + 1);

      // Check if prefix is a known provider
      if (this._providerPrefixes.has(prefix)) {
        provider = this._providerPrefixes.get(prefix);
      } else {
        provider = prefix;
      }
    }

    // Try matching without provider prefix
    if (this._models.has(modelPart)) {
      const model = this._models.get(modelPart);
      return new MatchResult(original, model.id, 2, 0.95, provider || model.provider);
    }

    // Check if modelPart is an alias
    if (this._aliases.has(modelPart)) {
      const targetNorm = this._aliases.get(modelPart);
      if (this._models.has(targetNorm)) {
        const model = this._models.get(targetNorm);
        return new MatchResult(original, model.id, 2, 0.95, provider || model.provider);
      }
    }

    // Check suffix match against all models
    for (const [key, model] of this._models) {
      if (key.endsWith(modelPart) || key.endsWith('/' + modelPart)) {
        return new MatchResult(original, model.id, 2, 0.9, provider || model.provider);
      }
    }

    return null;
  }

  /**
   * Tier 3: Fuzzy Match
   * Uses scored partial matching
   * @private
   */
  _tier3FuzzyMatch(normalized, original) {
    if (!this._fuzzyMatcher) {
      this._buildFuzzyMatcher();
    }

    const results = this._fuzzyMatcher.search(normalized, { limit: 1 });

    if (results.length > 0 && results[0].score >= this._fuzzyThreshold) {
      const match = results[0];
      const model = this._models.get(this._normalize(match.item));
      if (model) {
        return new MatchResult(original, model.id, 3, match.score, model.provider);
      }
    }

    return null;
  }

  /**
   * Build fuzzy matcher from registered models
   * @private
   */
  _buildFuzzyMatcher() {
    const items = [];

    for (const [key, model] of this._models) {
      items.push(model.id);
    }

    for (const [alias, target] of this._aliases) {
      items.push(alias);
    }

    this._fuzzyMatcher = createFuzzyMatcher(items, {
      threshold: this._fuzzyThreshold
    });
  }

  /**
   * Normalize model ID for matching
   * @private
   */
  _normalize(modelId) {
    return modelId
      .toLowerCase()
      .replace(/[_\s]+/g, '-')
      .replace(/[^a-z0-9\-\/\.]/g, '')
      .trim();
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
   * Invalidate cache
   * @private
   */
  _invalidateCache() {
    this._cache.clear();
    this._fuzzyMatcher = null;
  }

  /**
   * Get all registered models
   * @returns {Array<Object>}
   */
  getModels() {
    return Array.from(this._models.values());
  }

  /**
   * Get model by ID
   * @param {string} modelId
   * @returns {Object|null}
   */
  getModel(modelId) {
    const normalized = this._normalize(modelId);
    return this._models.get(normalized) || null;
  }

  /**
   * Check if model exists
   * @param {string} modelId
   * @returns {boolean}
   */
  hasModel(modelId) {
    return this._models.has(this._normalize(modelId));
  }

  /**
   * Get cache statistics
   * @returns {Object}
   */
  getCacheStats() {
    return {
      size: this._cache.size,
      maxSize: this._cacheMaxSize,
      hitRate: this._cacheHits / (this._cacheHits + this._cacheMisses) || 0
    };
  }

  /**
   * Clear all data
   */
  clear() {
    this._models.clear();
    this._aliases.clear();
    this._providerPrefixes.clear();
    this._cache.clear();
    this._fuzzyMatcher = null;
  }
}

// Singleton instance
let _matcher = null;

/**
 * Get singleton model matcher
 * @param {Object} [options]
 * @returns {ModelMatcher}
 */
function getModelMatcher(options) {
  if (!_matcher) {
    _matcher = new ModelMatcher(options);
  }
  return _matcher;
}

/**
 * Reset singleton (for testing)
 */
function resetModelMatcher() {
  _matcher = null;
}

/**
 * Initialize matcher with common models
 * @param {ModelMatcher} matcher
 */
function initializeCommonModels(matcher) {
  // Claude models
  matcher.registerModel('claude-3-5-sonnet-20241022', { provider: 'anthropic', name: 'Claude 3.5 Sonnet' });
  matcher.registerModel('claude-3-5-haiku-20241022', { provider: 'anthropic', name: 'Claude 3.5 Haiku' });
  matcher.registerModel('claude-3-opus-20240229', { provider: 'anthropic', name: 'Claude 3 Opus' });
  matcher.registerModel('claude-sonnet-4-20250514', { provider: 'anthropic', name: 'Claude Sonnet 4' });
  matcher.registerModel('claude-opus-4-20250514', { provider: 'anthropic', name: 'Claude Opus 4' });

  // Claude aliases
  matcher.registerAlias('sonnet', 'claude-3-5-sonnet-20241022');
  matcher.registerAlias('haiku', 'claude-3-5-haiku-20241022');
  matcher.registerAlias('opus', 'claude-3-opus-20240229');
  matcher.registerAlias('claude-sonnet', 'claude-3-5-sonnet-20241022');
  matcher.registerAlias('claude-haiku', 'claude-3-5-haiku-20241022');
  matcher.registerAlias('claude-opus', 'claude-3-opus-20240229');
  matcher.registerAlias('claude-4-sonnet', 'claude-sonnet-4-20250514');
  matcher.registerAlias('claude-4-opus', 'claude-opus-4-20250514');

  // GPT models
  matcher.registerModel('gpt-4o', { provider: 'openai', name: 'GPT-4o' });
  matcher.registerModel('gpt-4o-mini', { provider: 'openai', name: 'GPT-4o Mini' });
  matcher.registerModel('gpt-4-turbo', { provider: 'openai', name: 'GPT-4 Turbo' });
  matcher.registerModel('gpt-3.5-turbo', { provider: 'openai', name: 'GPT-3.5 Turbo' });
  matcher.registerModel('o1', { provider: 'openai', name: 'o1' });
  matcher.registerModel('o1-mini', { provider: 'openai', name: 'o1-mini' });

  // GPT aliases
  matcher.registerAlias('gpt4o', 'gpt-4o');
  matcher.registerAlias('gpt-4', 'gpt-4-turbo');
  matcher.registerAlias('gpt4', 'gpt-4-turbo');
  matcher.registerAlias('gpt-3.5', 'gpt-3.5-turbo');

  // Provider prefixes
  matcher.registerProviderPrefix('anthropic', 'anthropic');
  matcher.registerProviderPrefix('openai', 'openai');
  matcher.registerProviderPrefix('google', 'google');
  matcher.registerProviderPrefix('meta', 'meta');
  matcher.registerProviderPrefix('mistral', 'mistral');

  return matcher;
}

module.exports = {
  ModelMatcher,
  MatchResult,
  getModelMatcher,
  resetModelMatcher,
  initializeCommonModels
};
