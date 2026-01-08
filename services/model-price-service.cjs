const fs = require('fs');
const path = require('path');
const os = require('os');
const https = require('https');

/**
 * Model Price Service
 * Fetches and caches latest model pricing from LiteLLM repository
 * Updates hardcoded defaults for Sonnet 4 and Opus 3
 */
class ModelPriceService {
  constructor() {
    this.cacheFile = path.join(os.homedir(), '.dragon-ui-model-prices.json');
    this.lastUpdateFile = path.join(os.homedir(), '.dragon-ui-price-update.json');
    this.litellmUrl = 'https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json';
    
    // Context window sizes for each model (in tokens)
    // Sources: Anthropic, OpenAI, Zhipu AI official documentation (Dec 2025)
    this.contextWindows = {
      // Claude 4.5 (Extended context)
      'claude-opus-4.5': { max: 200000, usable: 160000, output: 32000 },
      'claude-sonnet-4.5': { max: 200000, usable: 160000, output: 16000 },
      'claude-haiku-4.5': { max: 200000, usable: 160000, output: 8192 },

      // Claude 4
      'claude-sonnet-4': { max: 200000, usable: 160000, output: 16000 },
      'claude-opus-4': { max: 200000, usable: 160000, output: 32000 },

      // Claude 3.5
      'claude-3.5-sonnet': { max: 200000, usable: 160000, output: 8192 },
      'claude-3.5-haiku': { max: 200000, usable: 160000, output: 8192 },

      // Claude 3 (Legacy)
      'claude-3-opus': { max: 200000, usable: 160000, output: 4096 },
      'claude-3-sonnet': { max: 200000, usable: 160000, output: 4096 },
      'claude-3-haiku': { max: 200000, usable: 160000, output: 4096 },

      // OpenAI GPT-5 Series (Extended)
      'gpt-5': { max: 1000000, usable: 800000, output: 100000 },
      'gpt-5-codex': { max: 1000000, usable: 800000, output: 100000 },
      'gpt-5-codex-mini': { max: 200000, usable: 160000, output: 16384 },
      'gpt-5.1-codex': { max: 1000000, usable: 800000, output: 100000 },

      // OpenAI GPT-4.5/4o
      'gpt-4.5-preview': { max: 128000, usable: 100000, output: 16384 },
      'gpt-4o': { max: 128000, usable: 100000, output: 16384 },
      'gpt-4o-mini': { max: 128000, usable: 100000, output: 16384 },

      // Zhipu GLM
      'glm-4.7': { max: 128000, usable: 100000, output: 8192 },
      'glm-4.6': { max: 128000, usable: 100000, output: 8192 },
      'glm-4.6v': { max: 128000, usable: 100000, output: 8192 },
      'glm-4.5': { max: 128000, usable: 100000, output: 8192 },
      'glm-4': { max: 128000, usable: 100000, output: 4096 }
    };

    // Default context window for unknown models
    this.defaultContextWindow = { max: 200000, usable: 160000, output: 8192 };

    // Default fallback prices (per million tokens in USD)
    // Sources: Anthropic, OpenAI, Zhipu AI official pricing (Dec 2025)
    this.defaultPrices = {
      // ============ ANTHROPIC CLAUDE ============
      // Claude 4.5 (Latest - Nov/Dec 2025)
      'claude-opus-4.5': { input: 5.0, output: 25.0, cacheWrite: 6.25, cacheRead: 0.50, batch: { input: 2.5, output: 12.5 } },
      'claude-sonnet-4.5': { input: 3.0, output: 15.0, cacheWrite: 3.75, cacheRead: 0.30, batch: { input: 1.5, output: 7.5 } },
      'claude-haiku-4.5': { input: 1.0, output: 5.0, cacheWrite: 1.25, cacheRead: 0.10, batch: { input: 0.5, output: 2.5 } },

      // Claude 4 (2024)
      'claude-sonnet-4': { input: 3.0, output: 15.0, cacheWrite: 3.75, cacheRead: 0.30, batch: { input: 1.5, output: 7.5 } },
      'claude-opus-4': { input: 15.0, output: 75.0, cacheWrite: 18.75, cacheRead: 1.50, batch: { input: 7.5, output: 37.5 } },

      // Claude 3.5 (2024)
      'claude-3.5-sonnet': { input: 3.0, output: 15.0, cacheWrite: 3.75, cacheRead: 0.30, batch: { input: 1.5, output: 7.5 } },
      'claude-3.5-haiku': { input: 0.25, output: 1.25, cacheWrite: 0.30, cacheRead: 0.03, batch: { input: 0.125, output: 0.625 } },

      // Claude 3 (Legacy - 2024)
      'claude-3-opus': { input: 15.0, output: 75.0, cacheWrite: 18.75, cacheRead: 1.50, batch: { input: 7.5, output: 37.5 } },
      'claude-3-sonnet': { input: 3.0, output: 15.0, cacheWrite: 3.75, cacheRead: 0.30, batch: { input: 1.5, output: 7.5 } },
      'claude-3-haiku': { input: 0.25, output: 1.25, cacheWrite: 0.30, cacheRead: 0.03, batch: { input: 0.125, output: 0.625 } },

      // ============ OPENAI ============
      // GPT-5 Series (2025)
      'gpt-5': { input: 1.25, output: 10.0, cacheWrite: 1.25, cacheRead: 0.125 },
      'gpt-5-codex': { input: 1.50, output: 6.0, cacheWrite: 1.50, cacheRead: 0.15 },
      'gpt-5-codex-mini': { input: 1.50, output: 6.0, cacheWrite: 1.50, cacheRead: 0.15 },
      'gpt-5.1-codex': { input: 1.50, output: 6.0, cacheWrite: 1.50, cacheRead: 0.15 },

      // GPT-4.5 (2025)
      'gpt-4.5-preview': { input: 2.0, output: 8.0, cacheWrite: 2.0, cacheRead: 0.20 },

      // GPT-4o (2024)
      'gpt-4o': { input: 2.50, output: 10.0, cacheWrite: 2.50, cacheRead: 0.25 },
      'gpt-4o-mini': { input: 0.15, output: 0.60, cacheWrite: 0.15, cacheRead: 0.015 },

      // ============ ZHIPU AI (GLM) ============
      // GLM-4 Series (2025)
      'glm-4.7': { input: 0.60, output: 2.20, cacheWrite: 0.60, cacheRead: 0.11 },
      'glm-4.6': { input: 0.50, output: 2.0, cacheWrite: 0.50, cacheRead: 0.10 },
      'glm-4.6v': { input: 0.30, output: 0.90, cacheWrite: 0.30, cacheRead: 0.06 },
      'glm-4.5': { input: 0.40, output: 1.60, cacheWrite: 0.40, cacheRead: 0.08 },
      'glm-4': { input: 0.30, output: 1.20, cacheWrite: 0.30, cacheRead: 0.06 }
    };

    // Provider prefixes for Tier 2 detection
    this.providerPrefixes = {
      'anthropic': ['claude-'],
      'openai': ['gpt-', 'o1-', 'o3-'],
      'zhipu': ['glm-'],
      'nanogpt': ['nano-', 'glm-'],
      'minimax': ['minimax-'],
      'zai': ['claude-'],
      'bedrock': ['anthropic.claude-', 'amazon.'],
      'vertex': ['claude-'],
      'azure': ['gpt-']
    };

    // Short aliases for quick model detection
    this.shortAliases = {
      'son': 'claude-sonnet-4.5',
      'sonnet': 'claude-sonnet-4.5',
      'opus': 'claude-opus-4.5',
      'haiku': 'claude-haiku-4.5',
      '4o': 'gpt-4o',
      '4omini': 'gpt-4o-mini',
      'codex': 'gpt-5-codex',
      'glm': 'glm-4.7'
    };

    // Model name mappings for detection (alias -> canonical name)
    this.modelAliases = {
      // Claude 4.5
      'claude-opus-4.5': ['claude-opus-4.5', 'claude-4.5-opus', 'opus-4.5', 'opus4.5', 'claude-opus-4-5-20251101', 'claude-opus-4-5'],
      'claude-sonnet-4.5': ['claude-sonnet-4.5', 'claude-4.5-sonnet', 'sonnet-4.5', 'sonnet4.5', 'claude-sonnet-4-5'],
      'claude-haiku-4.5': ['claude-haiku-4.5', 'claude-4.5-haiku', 'haiku-4.5', 'haiku4.5', 'claude-haiku-4-5'],

      // Claude 4
      'claude-sonnet-4': ['claude-sonnet-4', 'claude-4-sonnet', 'sonnet-4', 'sonnet4'],
      'claude-opus-4': ['claude-opus-4', 'claude-4-opus', 'opus-4', 'opus4'],

      // Claude 3.5
      'claude-3.5-sonnet': ['claude-3.5-sonnet', 'claude-3-5-sonnet', 'sonnet-3.5', 'claude-3.5-sonnet-20240620', 'claude-3-5-sonnet-20240620', 'claude-3-5-sonnet-20241022'],
      'claude-3.5-haiku': ['claude-3.5-haiku', 'claude-3-5-haiku', 'haiku-3.5', 'claude-3-5-haiku-20241022'],

      // Claude 3
      'claude-3-opus': ['claude-3-opus', 'opus-3', 'claude-3-opus-20240229'],
      'claude-3-sonnet': ['claude-3-sonnet', 'sonnet-3', 'claude-3-sonnet-20240229'],
      'claude-3-haiku': ['claude-3-haiku', 'haiku-3', 'claude-3-haiku-20240307'],

      // OpenAI GPT-5
      'gpt-5': ['gpt-5', 'gpt5', 'openai-gpt-5'],
      'gpt-5-codex': ['gpt-5-codex', 'codex', 'gpt5-codex', 'openai-codex'],
      'gpt-5-codex-mini': ['gpt-5-codex-mini', 'codex-mini', 'codex-mini-latest'],
      'gpt-5.1-codex': ['gpt-5.1-codex', 'gpt-5-1-codex'],

      // OpenAI GPT-4.5/4o
      'gpt-4.5-preview': ['gpt-4.5-preview', 'gpt-4.5', 'gpt4.5'],
      'gpt-4o': ['gpt-4o', 'gpt-4-o', 'gpt4o'],
      'gpt-4o-mini': ['gpt-4o-mini', 'gpt-4-o-mini', 'gpt4o-mini'],

      // Zhipu GLM
      'glm-4.7': ['glm-4.7', 'glm-4-7', 'glm4.7', 'zhipu-glm-4.7'],
      'glm-4.6': ['glm-4.6', 'glm-4-6', 'glm4.6'],
      'glm-4.6v': ['glm-4.6v', 'glm-4-6v', 'glm4.6v', 'glm-4.6-vision'],
      'glm-4.5': ['glm-4.5', 'glm-4-5', 'glm4.5'],
      'glm-4': ['glm-4', 'glm4', 'zhipu-glm-4']
    };
    
    this.currentPrices = { ...this.defaultPrices };
    this.lastUpdate = null;
    this.updateInterval = 60 * 60 * 1000; // 1 hour in milliseconds
    
    this.loadCachedPrices();
    this.startPeriodicUpdates();
  }

  /**
   * Check if running in CLI mode (suppress logs for CLI)
   */
  isCLI() {
    return process.argv.some(arg => arg.includes('cli') || arg.includes('dragon-ui-claude-cli'));
  }

  /**
   * Load cached prices from disk
   */
  loadCachedPrices() {
    try {
      if (fs.existsSync(this.cacheFile)) {
        const cachedData = JSON.parse(fs.readFileSync(this.cacheFile, 'utf8'));
        
        // Check if cache contains old Opus 3 data - if so, clear it
        if (cachedData['claude-opus-3'] && !cachedData['claude-opus-4']) {
          if (!this.isCLI()) console.log('[PRICE] Detected old Opus 3 cache, clearing for Opus 4 update...');
          fs.unlinkSync(this.cacheFile);
          if (fs.existsSync(this.lastUpdateFile)) {
            fs.unlinkSync(this.lastUpdateFile);
          }
          this.currentPrices = { ...this.defaultPrices };
          this.lastUpdate = null;
          return;
        }
        
        this.currentPrices = { ...this.defaultPrices, ...cachedData };
        // Show cached prices summary (only in Electron UI)
        if (!this.isCLI()) {
          const priceCount = Object.keys(this.currentPrices).length;
          console.log(`[PRICE] Loaded ${priceCount} model prices from cache`);
        }
      }
      
      if (fs.existsSync(this.lastUpdateFile)) {
        const updateData = JSON.parse(fs.readFileSync(this.lastUpdateFile, 'utf8'));
        this.lastUpdate = new Date(updateData.timestamp);
        if (!this.isCLI()) console.log(`[PRICE] Last price update: ${this.lastUpdate.toISOString()}`);
      }
    } catch (error) {
      if (!this.isCLI()) console.error('[PRICE] Error loading cached prices:', error.message);
      this.currentPrices = { ...this.defaultPrices };
    }
  }

  /**
   * Save prices to cache
   */
  savePricesToCache() {
    try {
      fs.writeFileSync(this.cacheFile, JSON.stringify(this.currentPrices, null, 2));
      fs.writeFileSync(this.lastUpdateFile, JSON.stringify({
        timestamp: new Date().toISOString(),
        source: 'litellm'
      }, null, 2));
      if (!this.isCLI()) console.log('[PRICE] Model prices saved to cache');
    } catch (error) {
      if (!this.isCLI()) console.error('[PRICE] Error saving prices to cache:', error.message);
    }
  }

  /**
   * Fetch latest prices from LiteLLM repository
   */
  async fetchLatestPrices() {
    return new Promise((resolve, reject) => {
      if (!this.isCLI()) console.log('[PRICE] Fetching latest model prices from LiteLLM...');
      
      const request = https.get(this.litellmUrl, (response) => {
        let data = '';
        
        response.on('data', (chunk) => {
          data += chunk;
        });
        
        response.on('end', () => {
          try {
            const priceData = JSON.parse(data);
            if (!this.isCLI()) console.log('[PRICE] Successfully fetched price data from LiteLLM');
            resolve(priceData);
          } catch (error) {
            if (!this.isCLI()) console.error('[PRICE] Error parsing LiteLLM response:', error.message);
            reject(error);
          }
        });
      });
      
      request.on('error', (error) => {
        if (!this.isCLI()) console.error('[PRICE] Error fetching from LiteLLM:', error.message);
        reject(error);
      });
      
      request.setTimeout(10000, () => {
        if (!this.isCLI()) console.error('[PRICE] Request timeout fetching from LiteLLM');
        request.abort();
        reject(new Error('Request timeout'));
      });
    });
  }

  /**
   * Extract model prices from LiteLLM data (Claude, OpenAI, GLM)
   */
  extractClaudePrices(priceData) {
    const updatedPrices = { ...this.defaultPrices };
    let foundUpdates = false;

    // Providers to look for
    const providerPatterns = [
      { pattern: /claude/i, provider: 'anthropic' },
      { pattern: /gpt|openai|codex/i, provider: 'openai' },
      { pattern: /glm|zhipu/i, provider: 'zhipu' }
    ];

    for (const [modelName, modelData] of Object.entries(priceData)) {
      // Check if this model matches any of our providers
      const matchedProvider = providerPatterns.find(p => p.pattern.test(modelName));
      if (!matchedProvider) continue;

      // Extract pricing information
      const inputCost = modelData.input_cost_per_token || modelData.input_cost_per_1k_tokens;
      const outputCost = modelData.output_cost_per_token || modelData.output_cost_per_1k_tokens;

      if (inputCost && outputCost) {
        // Convert to per-million token pricing
        const inputPrice = inputCost * (modelData.input_cost_per_token ? 1000000 : 1000);
        const outputPrice = outputCost * (modelData.output_cost_per_token ? 1000000 : 1000);

        // Normalize model name using our alias system
        const normalizedName = this.normalizeModelName(modelName);

        if (normalizedName && this.defaultPrices[normalizedName]) {
          const oldPrice = this.currentPrices[normalizedName];
          const newPrice = {
            input: inputPrice,
            output: outputPrice,
            cacheWrite: inputPrice * 1.25,
            cacheRead: inputPrice * 0.1,
            batch: oldPrice?.batch || { input: inputPrice * 0.5, output: outputPrice * 0.5 }
          };

          // Track if price actually changed (no individual logging - too spammy)
          if (!oldPrice || oldPrice.input !== newPrice.input || oldPrice.output !== newPrice.output) {
            foundUpdates = true;
          }

          updatedPrices[normalizedName] = newPrice;
        }
      }
    }

    return { updatedPrices, foundUpdates };
  }

  /**
   * Update model prices from LiteLLM
   */
  async updatePrices() {
    try {
      if (!this.isCLI()) console.log('[PRICE] Starting price update...');
      const priceData = await this.fetchLatestPrices();
      
      const { updatedPrices, foundUpdates } = this.extractClaudePrices(priceData);
      
      if (foundUpdates) {
        this.currentPrices = updatedPrices;
        this.lastUpdate = new Date();
        this.savePricesToCache();
        const priceCount = Object.keys(updatedPrices).length;
        if (!this.isCLI()) console.log(`[PRICE] Updated ${priceCount} model prices from LiteLLM`);
        return true;
      } else {
        if (!this.isCLI()) console.log('[PRICE] No Claude model updates found in LiteLLM data');
        return false;
      }
    } catch (error) {
      if (!this.isCLI()) console.error('[PRICE] Failed to update prices:', error.message);
      if (!this.isCLI()) console.log('[PRICE] Using cached/default prices');
      return false;
    }
  }

  /**
   * Check if prices need updating (every hour)
   */
  shouldUpdatePrices() {
    if (!this.lastUpdate) return true;
    
    const hoursSinceUpdate = (Date.now() - this.lastUpdate.getTime()) / (1000 * 60 * 60);
    return hoursSinceUpdate >= 1;
  }

  /**
   * Start periodic price updates
   */
  startPeriodicUpdates() {
    // Force initial update after service changes
    setTimeout(() => {
      if (!this.isCLI()) console.log('[PRICE] Forcing initial price update for new Opus 4 mapping...');
      this.updatePrices();
    }, 2000); // 2 seconds after startup
    
    // Set up hourly updates
    setInterval(() => {
      if (this.shouldUpdatePrices()) {
        this.updatePrices();
      }
    }, this.updateInterval);
    
    if (!this.isCLI()) console.log('[PRICE] Periodic price updates enabled (every hour)');
  }

  // ============ 3-TIER MODEL DETECTION SYSTEM ============

  /**
   * Detect model using 3-tier fallback system
   * Tier 1: Exact match
   * Tier 2: Provider prefix stripping (e.g., anthropic/claude-sonnet-4.5)
   * Tier 3: Scored fuzzy matching
   *
   * @param {string} modelString - Model name to detect
   * @returns {object} - { model, tier, score, original }
   */
  detectModel(modelString) {
    if (!modelString) return { model: null, tier: 0, score: 0, original: null };

    const original = modelString;
    const input = modelString.toLowerCase().trim();

    // Tier 1: Exact match
    const tier1Result = this.tier1ExactMatch(input);
    if (tier1Result) {
      return { model: tier1Result, tier: 1, score: 100, original };
    }

    // Tier 2: Provider prefix stripping
    const tier2Result = this.tier2ProviderPrefix(input);
    if (tier2Result) {
      return { model: tier2Result, tier: 2, score: 90, original };
    }

    // Tier 3: Fuzzy matching with scoring
    const tier3Result = this.tier3FuzzyMatch(input);
    if (tier3Result.model && tier3Result.score >= 50) {
      return { model: tier3Result.model, tier: 3, score: tier3Result.score, original };
    }

    return { model: null, tier: 0, score: 0, original };
  }

  /**
   * Tier 1: Exact match in prices or aliases
   */
  tier1ExactMatch(input) {
    // Direct match in current prices
    if (this.currentPrices[input]) {
      return input;
    }

    // Check exact alias matches
    for (const [canonical, aliases] of Object.entries(this.modelAliases)) {
      if (aliases.some(alias => alias.toLowerCase() === input)) {
        return canonical;
      }
    }

    // Check short aliases
    if (this.shortAliases[input]) {
      return this.shortAliases[input];
    }

    return null;
  }

  /**
   * Tier 2: Extract model from provider-prefixed string
   * e.g., "anthropic/claude-sonnet-4.5" -> "claude-sonnet-4.5"
   */
  tier2ProviderPrefix(input) {
    // Check for provider/model format
    if (input.includes('/')) {
      const parts = input.split('/');
      const provider = parts[0];
      const modelPart = parts.slice(1).join('/');

      // Try exact match on extracted model
      const exactMatch = this.tier1ExactMatch(modelPart);
      if (exactMatch) {
        return exactMatch;
      }

      // Try stripping known provider prefixes
      for (const [providerName, prefixes] of Object.entries(this.providerPrefixes)) {
        for (const prefix of prefixes) {
          if (modelPart.startsWith(prefix)) {
            const extracted = modelPart;
            const exactMatch = this.tier1ExactMatch(extracted);
            if (exactMatch) return exactMatch;
          }
        }
      }
    }

    // Check for embedded provider prefixes (bedrock format: anthropic.claude-3-sonnet)
    for (const [providerName, prefixes] of Object.entries(this.providerPrefixes)) {
      for (const prefix of prefixes) {
        if (input.startsWith(prefix)) {
          // Try the full string as is
          const exactMatch = this.tier1ExactMatch(input);
          if (exactMatch) return exactMatch;
        }
      }
    }

    return null;
  }

  /**
   * Tier 3: Fuzzy matching with scoring system
   * Returns highest-scoring match above threshold
   */
  tier3FuzzyMatch(input) {
    const candidates = Object.keys(this.currentPrices);
    let bestMatch = { model: null, score: 0 };

    for (const candidate of candidates) {
      const score = this.calculateFuzzyScore(input, candidate);
      if (score > bestMatch.score) {
        bestMatch = { model: candidate, score };
      }
    }

    return bestMatch;
  }

  /**
   * Calculate fuzzy match score between input and candidate
   * Max score: 100 (exact match)
   */
  calculateFuzzyScore(input, candidate) {
    const inputLower = input.toLowerCase();
    const candidateLower = candidate.toLowerCase();
    let score = 0;

    // Exact match (100 points)
    if (inputLower === candidateLower) return 100;

    // Substring inclusion (50 points)
    if (candidateLower.includes(inputLower)) score += 50;
    else if (inputLower.includes(candidateLower)) score += 40;

    // Provider priority (30 points for Anthropic/Claude)
    if (candidate.startsWith('claude-')) score += 30;
    else if (candidate.startsWith('gpt-')) score += 20;
    else if (candidate.startsWith('glm-')) score += 15;

    // Version number matching (20 points)
    const inputVersion = this.extractVersion(inputLower);
    const candidateVersion = this.extractVersion(candidateLower);
    if (inputVersion && candidateVersion && inputVersion === candidateVersion) {
      score += 20;
    }

    // Model family matching (15 points)
    const families = ['opus', 'sonnet', 'haiku', 'gpt', 'glm', 'codex'];
    for (const family of families) {
      if (inputLower.includes(family) && candidateLower.includes(family)) {
        score += 15;
        break;
      }
    }

    // Common character ratio (up to 10 points)
    const commonChars = this.countCommonChars(inputLower, candidateLower);
    const maxLen = Math.max(inputLower.length, candidateLower.length);
    score += Math.min(10, Math.floor((commonChars / maxLen) * 10));

    return score;
  }

  /**
   * Extract version number from model string
   */
  extractVersion(str) {
    const match = str.match(/(\d+\.?\d*)/);
    return match ? match[1] : null;
  }

  /**
   * Count common characters between two strings
   */
  countCommonChars(str1, str2) {
    const chars1 = new Set(str1);
    const chars2 = new Set(str2);
    let count = 0;
    for (const char of chars1) {
      if (chars2.has(char)) count++;
    }
    return count;
  }

  /**
   * Normalize model name to canonical form (wrapper for detectModel)
   */
  normalizeModelName(model) {
    const result = this.detectModel(model);
    return result.model;
  }

  /**
   * Get current prices for a model
   */
  getModelPrices(model) {
    const normalizedModel = this.normalizeModelName(model);

    if (normalizedModel && this.currentPrices[normalizedModel]) {
      return this.currentPrices[normalizedModel];
    }

    // Default fallback for unknown models (use Sonnet 4.5 pricing as it's most common)
    if (!this.isCLI()) {
      console.log(`[PRICE] Unknown model "${model}", using claude-sonnet-4.5 pricing as fallback`);
    }
    return this.currentPrices['claude-sonnet-4.5'] || this.currentPrices['claude-sonnet-4'];
  }

  /**
   * Get list of all supported models
   */
  getSupportedModels() {
    return Object.keys(this.currentPrices);
  }

  /**
   * Get model info including pricing and aliases
   */
  getModelInfo(model) {
    const normalizedModel = this.normalizeModelName(model);
    if (!normalizedModel) return null;

    return {
      canonical: normalizedModel,
      pricing: this.currentPrices[normalizedModel],
      aliases: this.modelAliases[normalizedModel] || [normalizedModel]
    };
  }

  /**
   * Get all current prices
   */
  getAllPrices() {
    return { ...this.currentPrices };
  }

  /**
   * Get pricing statistics
   */
  getPricingStats() {
    return {
      lastUpdate: this.lastUpdate,
      usingDefaults: !this.lastUpdate,
      prices: this.currentPrices,
      nextUpdateDue: this.lastUpdate ? 
        new Date(this.lastUpdate.getTime() + this.updateInterval) : 
        new Date()
    };
  }

  /**
   * Force price update
   */
  async forceUpdate() {
    console.log('[PRICE] Forcing price update...');
    return await this.updatePrices();
  }

  // ============ TIERED PRICING SUPPORT ============

  /**
   * Tiered pricing thresholds and multipliers
   * Claude models have tiered pricing for tokens > 200k
   */
  getTieredPricingConfig(model) {
    const normalizedModel = this.normalizeModelName(model);

    // Claude models have tiered pricing at 200k threshold
    if (normalizedModel && normalizedModel.startsWith('claude-')) {
      return {
        enabled: true,
        threshold: 200000,
        tier2Multiplier: 0.5 // 50% discount for tokens above threshold
      };
    }

    // GPT-5 has tiered pricing at 128k threshold
    if (normalizedModel && normalizedModel.startsWith('gpt-5')) {
      return {
        enabled: true,
        threshold: 128000,
        tier2Multiplier: 0.75
      };
    }

    return { enabled: false, threshold: 0, tier2Multiplier: 1.0 };
  }

  /**
   * Calculate cost with tiered pricing support
   * @param {number} inputTokens - Total input tokens
   * @param {number} outputTokens - Total output tokens
   * @param {string} model - Model name
   * @param {object} options - { cachedTokens, cacheWriteTokens }
   * @returns {object} - { total, input, output, cached, breakdown }
   */
  calculateTieredCost(inputTokens, outputTokens, model, options = {}) {
    const pricing = this.getModelPrices(model);
    const tieredConfig = this.getTieredPricingConfig(model);
    const cachedTokens = options.cachedTokens || 0;
    const cacheWriteTokens = options.cacheWriteTokens || 0;

    let inputCost = 0;
    let outputCost = 0;
    let cachedCost = 0;
    let cacheWriteCost = 0;
    let breakdown = { tier1: {}, tier2: {} };

    // Calculate input cost with tiering
    if (tieredConfig.enabled && inputTokens > tieredConfig.threshold) {
      const tier1Tokens = tieredConfig.threshold;
      const tier2Tokens = inputTokens - tieredConfig.threshold;

      const tier1Cost = (tier1Tokens / 1000000) * pricing.input;
      const tier2Cost = (tier2Tokens / 1000000) * pricing.input * tieredConfig.tier2Multiplier;

      inputCost = tier1Cost + tier2Cost;
      breakdown.tier1.input = { tokens: tier1Tokens, cost: tier1Cost };
      breakdown.tier2.input = { tokens: tier2Tokens, cost: tier2Cost };
    } else {
      inputCost = (inputTokens / 1000000) * pricing.input;
      breakdown.tier1.input = { tokens: inputTokens, cost: inputCost };
    }

    // Calculate output cost with tiering
    if (tieredConfig.enabled && outputTokens > tieredConfig.threshold) {
      const tier1Tokens = tieredConfig.threshold;
      const tier2Tokens = outputTokens - tieredConfig.threshold;

      const tier1Cost = (tier1Tokens / 1000000) * pricing.output;
      const tier2Cost = (tier2Tokens / 1000000) * pricing.output * tieredConfig.tier2Multiplier;

      outputCost = tier1Cost + tier2Cost;
      breakdown.tier1.output = { tokens: tier1Tokens, cost: tier1Cost };
      breakdown.tier2.output = { tokens: tier2Tokens, cost: tier2Cost };
    } else {
      outputCost = (outputTokens / 1000000) * pricing.output;
      breakdown.tier1.output = { tokens: outputTokens, cost: outputCost };
    }

    // Cache costs (no tiering)
    if (cachedTokens > 0 && pricing.cacheRead) {
      cachedCost = (cachedTokens / 1000000) * pricing.cacheRead;
    }
    if (cacheWriteTokens > 0 && pricing.cacheWrite) {
      cacheWriteCost = (cacheWriteTokens / 1000000) * pricing.cacheWrite;
    }

    const total = inputCost + outputCost + cachedCost + cacheWriteCost;

    return {
      total,
      input: inputCost,
      output: outputCost,
      cached: cachedCost,
      cacheWrite: cacheWriteCost,
      breakdown,
      tieredPricing: tieredConfig.enabled,
      threshold: tieredConfig.threshold
    };
  }

  /**
   * Simple cost calculation (without tiering, for backwards compatibility)
   */
  calculateSimpleCost(inputTokens, outputTokens, model, cachedTokens = 0) {
    const pricing = this.getModelPrices(model);

    const inputCost = (inputTokens / 1000000) * pricing.input;
    const outputCost = (outputTokens / 1000000) * pricing.output;
    const cachedCost = cachedTokens > 0 && pricing.cacheRead
      ? (cachedTokens / 1000000) * pricing.cacheRead
      : 0;

    return {
      total: inputCost + outputCost + cachedCost,
      input: inputCost,
      output: outputCost,
      cached: cachedCost
    };
  }

  // ============ OFFLINE MODE SUPPORT ============

  /**
   * Check if we're in offline mode
   */
  isOffline() {
    return this._offlineMode === true;
  }

  /**
   * Set offline mode
   */
  setOfflineMode(enabled) {
    this._offlineMode = enabled;
    if (!this.isCLI()) {
      console.log(`[PRICE] Offline mode ${enabled ? 'enabled' : 'disabled'}`);
    }
  }

  /**
   * Get pricing source info
   */
  getPricingSource() {
    if (this._offlineMode) {
      return {
        source: 'offline',
        lastUpdate: this.lastUpdate,
        cacheAge: this.lastUpdate ? Math.floor((Date.now() - this.lastUpdate.getTime()) / (1000 * 60 * 60 * 24)) : null,
        warning: this.lastUpdate
          ? `Using offline pricing (last updated: ${this.getCacheAge()} ago)`
          : 'Using hardcoded default pricing'
      };
    }

    if (this.lastUpdate) {
      return {
        source: 'litellm',
        lastUpdate: this.lastUpdate,
        cacheAge: this.getCacheAge(),
        warning: null
      };
    }

    return {
      source: 'defaults',
      lastUpdate: null,
      cacheAge: null,
      warning: 'Using hardcoded default pricing'
    };
  }

  /**
   * Get human-readable cache age
   */
  getCacheAge() {
    if (!this.lastUpdate) return 'never';

    const ms = Date.now() - this.lastUpdate.getTime();
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days} day${days > 1 ? 's' : ''}`;
    if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''}`;
    return 'just now';
  }

  // ============ CONTEXT WINDOW DETECTION ============

  /**
   * Get context window size for a model
   * @param {string} model - Model name or alias
   * @returns {object} - { max, usable, output } token limits
   */
  getContextWindow(model) {
    const normalizedModel = this.normalizeModelName(model);

    if (normalizedModel && this.contextWindows[normalizedModel]) {
      return this.contextWindows[normalizedModel];
    }

    // Return default context window for unknown models
    return this.defaultContextWindow;
  }

  /**
   * Calculate context usage percentage
   * @param {number} usedTokens - Total tokens used in context
   * @param {string} model - Model name or alias
   * @param {boolean} useUsableLimit - Use 80% usable limit instead of max
   * @returns {object} - { percentage, used, max, status, warning }
   */
  calculateContextUsage(usedTokens, model, useUsableLimit = true) {
    const contextWindow = this.getContextWindow(model);
    const limit = useUsableLimit ? contextWindow.usable : contextWindow.max;
    const percentage = (usedTokens / limit) * 100;

    let status = 'normal';
    let warning = null;

    if (percentage >= 90) {
      status = 'critical';
      warning = 'Context window almost full. Consider starting a new session.';
    } else if (percentage >= 75) {
      status = 'warning';
      warning = 'Context window is filling up.';
    } else if (percentage >= 50) {
      status = 'moderate';
    }

    return {
      percentage: Math.min(100, percentage),
      used: usedTokens,
      max: limit,
      absoluteMax: contextWindow.max,
      outputLimit: contextWindow.output,
      status,
      warning,
      formatted: this.formatContextUsage(usedTokens, limit)
    };
  }

  /**
   * Format context usage for display
   * @param {number} used - Used tokens
   * @param {number} max - Max tokens
   * @returns {string} - Formatted string like "45.2k / 200k"
   */
  formatContextUsage(used, max) {
    const formatTokens = (tokens) => {
      if (tokens >= 1000000) {
        return `${(tokens / 1000000).toFixed(1)}M`;
      } else if (tokens >= 1000) {
        return `${(tokens / 1000).toFixed(1)}k`;
      }
      return tokens.toString();
    };

    return `${formatTokens(used)} / ${formatTokens(max)}`;
  }

  /**
   * Check if model has extended context (1M+)
   * @param {string} model - Model name or alias
   * @returns {boolean}
   */
  hasExtendedContext(model) {
    const contextWindow = this.getContextWindow(model);
    return contextWindow.max >= 1000000;
  }

  /**
   * Get remaining context tokens
   * @param {number} usedTokens - Total tokens used
   * @param {string} model - Model name or alias
   * @param {boolean} useUsableLimit - Use 80% usable limit
   * @returns {number} - Remaining tokens
   */
  getRemainingContext(usedTokens, model, useUsableLimit = true) {
    const contextWindow = this.getContextWindow(model);
    const limit = useUsableLimit ? contextWindow.usable : contextWindow.max;
    return Math.max(0, limit - usedTokens);
  }

  /**
   * Estimate remaining output capacity
   * @param {number} usedContextTokens - Tokens used in context
   * @param {string} model - Model name or alias
   * @returns {number} - Estimated remaining output tokens
   */
  getOutputCapacity(usedContextTokens, model) {
    const contextWindow = this.getContextWindow(model);
    const remainingContext = this.getRemainingContext(usedContextTokens, model, false);
    return Math.min(contextWindow.output, remainingContext);
  }

  /**
   * Get all context window configurations
   * @returns {object} - All context window configurations
   */
  getAllContextWindows() {
    return { ...this.contextWindows };
  }

  /**
   * Get extended model info including context window
   * @param {string} model - Model name or alias
   * @returns {object} - Full model info with pricing and context
   */
  getExtendedModelInfo(model) {
    const normalizedModel = this.normalizeModelName(model);
    if (!normalizedModel) return null;

    return {
      canonical: normalizedModel,
      pricing: this.currentPrices[normalizedModel],
      contextWindow: this.contextWindows[normalizedModel] || this.defaultContextWindow,
      aliases: this.modelAliases[normalizedModel] || [normalizedModel],
      hasExtendedContext: this.hasExtendedContext(normalizedModel)
    };
  }
}

// Export singleton instance
const modelPriceService = new ModelPriceService();
module.exports = { modelPriceService };