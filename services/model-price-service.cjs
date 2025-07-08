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
    
    // Default fallback prices (current hardcoded values)
    this.defaultPrices = {
      'claude-sonnet-4': { input: 3.0, output: 15.0, cacheWrite: 3.75, cacheRead: 0.30 },
      'claude-opus-4': { input: 15.0, output: 75.0, cacheWrite: 18.75, cacheRead: 1.50 }
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
   * Extract Claude model prices from LiteLLM data
   */
  extractClaudePrices(priceData) {
    const updatedPrices = { ...this.defaultPrices };
    let foundUpdates = false;
    
    // Look for Claude models in the price data
    for (const [modelName, modelData] of Object.entries(priceData)) {
      if (modelName.toLowerCase().includes('claude')) {
        // Extract pricing information
        const inputCost = modelData.input_cost_per_token || modelData.input_cost_per_1k_tokens;
        const outputCost = modelData.output_cost_per_token || modelData.output_cost_per_1k_tokens;
        
        if (inputCost && outputCost) {
          // Convert to per-million token pricing if needed
          const inputPrice = inputCost * (modelData.input_cost_per_token ? 1000000 : 1000);
          const outputPrice = outputCost * (modelData.output_cost_per_token ? 1000000 : 1000);
          
          // Map to our model naming convention (only latest versions)
          let mappedName = null;
          if (modelName.toLowerCase().includes('sonnet') && modelName.includes('4')) {
            mappedName = 'claude-sonnet-4';
          } else if (modelName.toLowerCase().includes('opus') && modelName.includes('4')) {
            mappedName = 'claude-opus-4';
          }
          
          if (mappedName) {
            // Only log if price actually changed
            const oldPrice = this.currentPrices[mappedName];
            const newPrice = {
              input: inputPrice,
              output: outputPrice,
              cacheWrite: inputPrice * 1.25,
              cacheRead: inputPrice * 0.1
            };
            
            if (!oldPrice || oldPrice.input !== newPrice.input || oldPrice.output !== newPrice.output) {
              if (!this.isCLI()) console.log(`[PRICE] ${mappedName}: Input $${inputPrice}/1M, Output $${outputPrice}/1M`);
            }
            
            updatedPrices[mappedName] = newPrice;
            foundUpdates = true;
          }
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
   * Get current prices for a model
   */
  getModelPrices(model) {
    // Normalize model name for lookup
    let modelKey = null;
    
    if (model.includes('sonnet') && (model.includes('4') || model.includes('3.5'))) {
      modelKey = 'claude-sonnet-4';
    } else if (model.includes('opus') && model.includes('4')) {
      modelKey = 'claude-opus-4';
    }
    
    if (modelKey && this.currentPrices[modelKey]) {
      return this.currentPrices[modelKey];
    }
    
    // Default fallback for unknown models (use Sonnet pricing)
    return this.currentPrices['claude-sonnet-4'];
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