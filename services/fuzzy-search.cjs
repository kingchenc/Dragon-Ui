'use strict';

/**
 * Fuzzy Search Implementation
 * Provides scored partial matching for model detection
 * Supports substring inclusion, Levenshtein distance, and weighted scoring
 */

/**
 * Calculate Levenshtein distance between two strings
 * @param {string} a - First string
 * @param {string} b - Second string
 * @returns {number} Edit distance
 */
function levenshteinDistance(a, b) {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Calculate similarity ratio (0-1) based on Levenshtein distance
 * @param {string} a - First string
 * @param {string} b - Second string
 * @returns {number} Similarity ratio
 */
function levenshteinSimilarity(a, b) {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  const distance = levenshteinDistance(a, b);
  return 1 - distance / maxLen;
}

/**
 * Calculate longest common subsequence length
 * @param {string} a - First string
 * @param {string} b - Second string
 * @returns {number} LCS length
 */
function lcsLength(a, b) {
  const m = a.length;
  const n = b.length;
  const dp = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  return dp[m][n];
}

/**
 * Calculate LCS similarity ratio
 * @param {string} a - First string
 * @param {string} b - Second string
 * @returns {number} Similarity ratio
 */
function lcsSimilarity(a, b) {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return lcsLength(a, b) / maxLen;
}

/**
 * Check if query is a substring of target
 * @param {string} query - Search query
 * @param {string} target - Target string
 * @returns {Object} { found, position, ratio }
 */
function substringMatch(query, target) {
  const pos = target.indexOf(query);
  if (pos !== -1) {
    return {
      found: true,
      position: pos,
      ratio: query.length / target.length
    };
  }
  return { found: false, position: -1, ratio: 0 };
}

/**
 * Calculate word overlap score
 * @param {string} query - Search query
 * @param {string} target - Target string
 * @returns {number} Overlap ratio
 */
function wordOverlapScore(query, target) {
  const queryWords = new Set(query.split(/[-_\s\/\.]+/).filter(Boolean));
  const targetWords = new Set(target.split(/[-_\s\/\.]+/).filter(Boolean));

  if (queryWords.size === 0 || targetWords.size === 0) return 0;

  let matches = 0;
  for (const word of queryWords) {
    for (const targetWord of targetWords) {
      if (targetWord.includes(word) || word.includes(targetWord)) {
        matches++;
        break;
      }
    }
  }

  return matches / queryWords.size;
}

/**
 * Calculate prefix match score
 * @param {string} query - Search query
 * @param {string} target - Target string
 * @returns {number} Prefix match ratio
 */
function prefixScore(query, target) {
  let matchLen = 0;
  const minLen = Math.min(query.length, target.length);

  for (let i = 0; i < minLen; i++) {
    if (query[i] === target[i]) {
      matchLen++;
    } else {
      break;
    }
  }

  return matchLen / query.length;
}

/**
 * Search result with score
 */
class SearchResult {
  constructor(item, score, details = {}) {
    this.item = item;
    this.score = score;
    this.details = details;
  }

  toJSON() {
    return {
      item: this.item,
      score: this.score,
      details: this.details
    };
  }
}

/**
 * Fuzzy Search class for model matching
 */
class FuzzySearch {
  /**
   * @param {Array<string>} items - Items to search
   * @param {Object} [options] - Search options
   * @param {number} [options.threshold=0.5] - Minimum score threshold
   * @param {Object} [options.weights] - Score component weights
   */
  constructor(items = [], options = {}) {
    this._items = [];
    this._normalizedItems = [];
    this._threshold = options.threshold || 0.5;
    this._weights = {
      exact: 1.0,
      prefix: 0.3,
      substring: 0.25,
      wordOverlap: 0.25,
      levenshtein: 0.15,
      lcs: 0.05,
      ...options.weights
    };

    this.addItems(items);
  }

  /**
   * Add items to search index
   * @param {Array<string>} items
   */
  addItems(items) {
    for (const item of items) {
      this.addItem(item);
    }
  }

  /**
   * Add single item
   * @param {string} item
   */
  addItem(item) {
    if (typeof item === 'string' && item.length > 0) {
      this._items.push(item);
      this._normalizedItems.push(this._normalize(item));
    }
  }

  /**
   * Remove item
   * @param {string} item
   */
  removeItem(item) {
    const normalized = this._normalize(item);
    const index = this._normalizedItems.indexOf(normalized);
    if (index !== -1) {
      this._items.splice(index, 1);
      this._normalizedItems.splice(index, 1);
    }
  }

  /**
   * Clear all items
   */
  clear() {
    this._items = [];
    this._normalizedItems = [];
  }

  /**
   * Search for matching items
   * @param {string} query - Search query
   * @param {Object} [options] - Search options
   * @param {number} [options.limit] - Maximum results
   * @param {number} [options.threshold] - Override threshold
   * @returns {Array<SearchResult>}
   */
  search(query, options = {}) {
    if (!query || query.length === 0) return [];

    const normalizedQuery = this._normalize(query);
    const threshold = options.threshold ?? this._threshold;
    const limit = options.limit || Infinity;

    const results = [];

    for (let i = 0; i < this._items.length; i++) {
      const item = this._items[i];
      const normalizedItem = this._normalizedItems[i];

      const score = this._calculateScore(normalizedQuery, normalizedItem);

      if (score >= threshold) {
        results.push(new SearchResult(item, score, {
          normalized: normalizedItem,
          query: normalizedQuery
        }));
      }
    }

    // Sort by score descending
    results.sort((a, b) => b.score - a.score);

    // Apply limit
    return results.slice(0, limit);
  }

  /**
   * Calculate combined score
   * @private
   */
  _calculateScore(query, target) {
    // Exact match
    if (query === target) {
      return 1.0;
    }

    let score = 0;
    const w = this._weights;

    // Prefix match
    const prefixS = prefixScore(query, target);
    score += prefixS * w.prefix;

    // Substring match
    const subMatch = substringMatch(query, target);
    if (subMatch.found) {
      score += subMatch.ratio * w.substring;
      // Bonus for early position
      if (subMatch.position === 0) {
        score += 0.1;
      }
    }

    // Word overlap
    const wordS = wordOverlapScore(query, target);
    score += wordS * w.wordOverlap;

    // Levenshtein similarity
    const levS = levenshteinSimilarity(query, target);
    score += levS * w.levenshtein;

    // LCS similarity
    const lcsS = lcsSimilarity(query, target);
    score += lcsS * w.lcs;

    // Normalize score to 0-1 range
    const maxPossible = w.prefix + w.substring + 0.1 + w.wordOverlap + w.levenshtein + w.lcs;
    return Math.min(1, score / maxPossible);
  }

  /**
   * Normalize string for matching
   * @private
   */
  _normalize(str) {
    return str
      .toLowerCase()
      .replace(/[_\s]+/g, '-')
      .replace(/[^a-z0-9\-\/\.]/g, '')
      .trim();
  }

  /**
   * Get item count
   * @returns {number}
   */
  get size() {
    return this._items.length;
  }

  /**
   * Get all items
   * @returns {Array<string>}
   */
  getItems() {
    return [...this._items];
  }
}

/**
 * Create fuzzy matcher for models
 * @param {Array<string>} items - Items to match
 * @param {Object} [options] - Options
 * @returns {FuzzySearch}
 */
function createFuzzyMatcher(items, options = {}) {
  return new FuzzySearch(items, {
    threshold: options.threshold || 0.5,
    weights: {
      exact: 1.0,
      prefix: 0.35,
      substring: 0.25,
      wordOverlap: 0.25,
      levenshtein: 0.1,
      lcs: 0.05,
      ...options.weights
    }
  });
}

/**
 * Quick fuzzy match
 * @param {string} query - Search query
 * @param {Array<string>} candidates - Candidate strings
 * @param {Object} [options] - Options
 * @returns {SearchResult|null}
 */
function fuzzyMatch(query, candidates, options = {}) {
  const matcher = new FuzzySearch(candidates, options);
  const results = matcher.search(query, { limit: 1 });
  return results.length > 0 ? results[0] : null;
}

/**
 * Find best match
 * @param {string} query - Search query
 * @param {Array<string>} candidates - Candidate strings
 * @returns {string|null}
 */
function findBestMatch(query, candidates) {
  const result = fuzzyMatch(query, candidates);
  return result ? result.item : null;
}

module.exports = {
  FuzzySearch,
  SearchResult,
  createFuzzyMatcher,
  fuzzyMatch,
  findBestMatch,

  // Utility functions
  levenshteinDistance,
  levenshteinSimilarity,
  lcsLength,
  lcsSimilarity,
  substringMatch,
  wordOverlapScore,
  prefixScore
};
