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
        // Show cached prices (only in Electron UI)
        if (!this.isCLI()) {
          Object.entries(this.currentPrices).forEach(([model, pricing]) => {
            console.log(`[PRICE] ${model}: Input $${pricing.input}/1M, Output $${pricing.output}/1M (cached)`);
          });
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

          // Only log if price actually changed
          if (!oldPrice || oldPrice.input !== newPrice.input || oldPrice.output !== newPrice.output) {
            if (!this.isCLI()) {
              console.log(`[PRICE] ${normalizedName}: Input $${inputPrice.toFixed(2)}/1M, Output $${outputPrice.toFixed(2)}/1M`);
            }
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
        if (!this.isCLI()) console.log('[PRICE] Model prices updated successfully');
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

  /**
   * Normalize model name to canonical form using aliases
   */
  normalizeModelName(model) {
    if (!model) return null;

    const lowerModel = model.toLowerCase().trim();

    // Direct match in prices
    if (this.currentPrices[lowerModel]) {
      return lowerModel;
    }

    // Check aliases
    for (const [canonical, aliases] of Object.entries(this.modelAliases)) {
      if (aliases.some(alias => lowerModel.includes(alias.toLowerCase()) || alias.toLowerCase().includes(lowerModel))) {
        return canonical;
      }
    }

    // Fuzzy matching for common patterns
    if (lowerModel.includes('opus') && lowerModel.includes('4.5')) return 'claude-opus-4.5';
    if (lowerModel.includes('sonnet') && lowerModel.includes('4.5')) return 'claude-sonnet-4.5';
    if (lowerModel.includes('haiku') && lowerModel.includes('4.5')) return 'claude-haiku-4.5';
    if (lowerModel.includes('opus') && lowerModel.includes('4')) return 'claude-opus-4';
    if (lowerModel.includes('sonnet') && lowerModel.includes('4')) return 'claude-sonnet-4';
    if (lowerModel.includes('opus') && lowerModel.includes('3')) return 'claude-3-opus';
    if (lowerModel.includes('sonnet') && lowerModel.includes('3.5')) return 'claude-3.5-sonnet';
    if (lowerModel.includes('sonnet') && lowerModel.includes('3')) return 'claude-3-sonnet';
    if (lowerModel.includes('haiku') && lowerModel.includes('3.5')) return 'claude-3.5-haiku';
    if (lowerModel.includes('haiku') && lowerModel.includes('3')) return 'claude-3-haiku';
    if (lowerModel.includes('gpt-5') || lowerModel.includes('gpt5')) return 'gpt-5';
    if (lowerModel.includes('gpt-4o-mini')) return 'gpt-4o-mini';
    if (lowerModel.includes('gpt-4o')) return 'gpt-4o';
    if (lowerModel.includes('codex')) return 'gpt-5-codex';
    if (lowerModel.includes('glm-4.7') || lowerModel.includes('glm4.7')) return 'glm-4.7';
    if (lowerModel.includes('glm-4.6v')) return 'glm-4.6v';
    if (lowerModel.includes('glm-4.6')) return 'glm-4.6';
    if (lowerModel.includes('glm-4')) return 'glm-4';

    return null;
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
}

// Export singleton instance
const modelPriceService = new ModelPriceService();
module.exports = { modelPriceService };