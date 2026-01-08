/**
 * Compile-time Pricing System for Dragon-UI
 * Build-time pricing embed and optimization
 *
 * @module lib/pricing-compiler
 */

'use strict';

const fs = require('fs');
const path = require('path');
const https = require('https');

/**
 * Default Claude model pricing (per 1M tokens)
 * Updated: January 2025
 */
const DEFAULT_PRICING = {
  // Claude 3.5 Models
  'claude-3-5-sonnet-20241022': {
    input: 3.00,
    output: 15.00,
    cacheRead: 0.30,
    cacheWrite: 3.75
  },
  'claude-3-5-sonnet-20240620': {
    input: 3.00,
    output: 15.00,
    cacheRead: 0.30,
    cacheWrite: 3.75
  },
  'claude-3-5-haiku-20241022': {
    input: 1.00,
    output: 5.00,
    cacheRead: 0.10,
    cacheWrite: 1.25
  },
  // Claude 3 Models
  'claude-3-opus-20240229': {
    input: 15.00,
    output: 75.00,
    cacheRead: 1.50,
    cacheWrite: 18.75
  },
  'claude-3-sonnet-20240229': {
    input: 3.00,
    output: 15.00,
    cacheRead: 0.30,
    cacheWrite: 3.75
  },
  'claude-3-haiku-20240307': {
    input: 0.25,
    output: 1.25,
    cacheRead: 0.03,
    cacheWrite: 0.30
  },
  // Claude 4 / Opus 4 Models (estimated pricing)
  'claude-opus-4-5-20251101': {
    input: 15.00,
    output: 75.00,
    cacheRead: 1.50,
    cacheWrite: 18.75
  },
  'claude-sonnet-4-20250514': {
    input: 3.00,
    output: 15.00,
    cacheRead: 0.30,
    cacheWrite: 3.75
  },
  // GPT-5 / Codex Models
  'gpt-5': {
    input: 1.25,
    output: 10.00,
    cacheRead: 0.125,
    cacheWrite: 0.625
  },
  'o1': {
    input: 15.00,
    output: 60.00,
    cacheRead: 1.50,
    cacheWrite: 7.50
  },
  'o1-pro': {
    input: 150.00,
    output: 600.00,
    cacheRead: 15.00,
    cacheWrite: 75.00
  }
};

/**
 * Model family aliases for matching
 */
const MODEL_ALIASES = {
  'sonnet': 'claude-3-5-sonnet-20241022',
  'haiku': 'claude-3-5-haiku-20241022',
  'opus': 'claude-3-opus-20240229',
  'claude-3': 'claude-3-5-sonnet-20241022',
  'claude-3.5': 'claude-3-5-sonnet-20241022',
  'claude-3-5': 'claude-3-5-sonnet-20241022',
  'claude-4': 'claude-sonnet-4-20250514',
  'claude-opus-4': 'claude-opus-4-5-20251101'
};

/**
 * Pricing sources configuration
 */
const PRICING_SOURCES = [
  {
    name: 'anthropic-api',
    url: 'https://api.anthropic.com/v1/pricing',
    parser: parseAnthropicPricing
  },
  {
    name: 'openrouter',
    url: 'https://openrouter.ai/api/v1/models',
    parser: parseOpenRouterPricing
  }
];

/**
 * Parse Anthropic API pricing response
 * @param {Object} data
 * @returns {Object}
 */
function parseAnthropicPricing(data) {
  const pricing = {};

  if (data.models) {
    for (const model of data.models) {
      pricing[model.id] = {
        input: model.input_price_per_mtok || 0,
        output: model.output_price_per_mtok || 0,
        cacheRead: model.cache_read_price_per_mtok || 0,
        cacheWrite: model.cache_write_price_per_mtok || 0
      };
    }
  }

  return pricing;
}

/**
 * Parse OpenRouter API pricing response
 * @param {Object} data
 * @returns {Object}
 */
function parseOpenRouterPricing(data) {
  const pricing = {};

  if (data.data) {
    for (const model of data.data) {
      if (model.id && model.id.startsWith('anthropic/')) {
        const modelId = model.id.replace('anthropic/', '');
        pricing[modelId] = {
          input: parseFloat(model.pricing?.prompt || 0) * 1000000,
          output: parseFloat(model.pricing?.completion || 0) * 1000000,
          cacheRead: 0,
          cacheWrite: 0
        };
      }
    }
  }

  return pricing;
}

/**
 * Fetch pricing from URL
 * @param {string} url
 * @returns {Promise<Object>}
 */
function fetchPricing(url) {
  return new Promise((resolve, reject) => {
    const request = https.get(url, {
      headers: {
        'User-Agent': 'dragon-ui/1.0',
        'Accept': 'application/json'
      },
      timeout: 10000
    }, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`HTTP ${response.statusCode}`));
        return;
      }

      let data = '';
      response.on('data', chunk => data += chunk);
      response.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (error) {
          reject(new Error('Invalid JSON response'));
        }
      });
    });

    request.on('error', reject);
    request.on('timeout', () => {
      request.destroy();
      reject(new Error('Request timeout'));
    });
  });
}

/**
 * Pricing Compiler class
 */
class PricingCompiler {
  constructor(options = {}) {
    this.outputDir = options.outputDir || path.join(process.cwd(), 'generated');
    this.cacheFile = options.cacheFile || path.join(this.outputDir, 'pricing.json');
    this.sourceFile = options.sourceFile || path.join(this.outputDir, 'pricing.cjs');
    this.pricing = { ...DEFAULT_PRICING };
    this.metadata = {
      version: '1.0.0',
      generatedAt: null,
      source: 'default',
      expires: null
    };
  }

  /**
   * Prefetch pricing from remote sources
   * @returns {Promise<Object>}
   */
  async prefetchPricing() {
    const results = [];

    for (const source of PRICING_SOURCES) {
      try {
        const data = await fetchPricing(source.url);
        const parsed = source.parser(data);

        if (Object.keys(parsed).length > 0) {
          results.push({
            source: source.name,
            pricing: parsed,
            fetchedAt: new Date().toISOString()
          });
        }
      } catch (error) {
        // Silently continue on fetch errors
      }
    }

    // Merge fetched pricing with defaults (fetched takes precedence)
    if (results.length > 0) {
      for (const result of results) {
        this.pricing = { ...this.pricing, ...result.pricing };
      }
      this.metadata.source = results.map(r => r.source).join(',');
    }

    this.metadata.generatedAt = new Date().toISOString();
    this.metadata.expires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    return this.pricing;
  }

  /**
   * Compile pricing to JavaScript module
   * @returns {string}
   */
  compile() {
    const code = `/**
 * Dragon-UI Pricing Data (Auto-generated)
 * Generated: ${this.metadata.generatedAt || new Date().toISOString()}
 * Source: ${this.metadata.source}
 * DO NOT EDIT MANUALLY - This file is generated by pricing-compiler
 *
 * @module generated/pricing
 */

'use strict';

/**
 * Compiled pricing metadata
 */
const PRICING_METADATA = ${JSON.stringify(this.metadata, null, 2)};

/**
 * Compiled model pricing (per 1M tokens)
 */
const MODEL_PRICING = ${JSON.stringify(this.pricing, null, 2)};

/**
 * Model aliases for lookup
 */
const MODEL_ALIASES = ${JSON.stringify(MODEL_ALIASES, null, 2)};

/**
 * Get pricing for model
 * @param {string} modelId
 * @returns {Object|null}
 */
function getModelPricing(modelId) {
  // Direct lookup
  if (MODEL_PRICING[modelId]) {
    return MODEL_PRICING[modelId];
  }

  // Alias lookup
  const aliasedModel = MODEL_ALIASES[modelId.toLowerCase()];
  if (aliasedModel && MODEL_PRICING[aliasedModel]) {
    return MODEL_PRICING[aliasedModel];
  }

  // Partial match (model family)
  for (const [key, pricing] of Object.entries(MODEL_PRICING)) {
    if (key.includes(modelId) || modelId.includes(key)) {
      return pricing;
    }
  }

  return null;
}

/**
 * Calculate cost for tokens
 * @param {string} modelId
 * @param {Object} tokens
 * @returns {number}
 */
function calculateCost(modelId, tokens) {
  const pricing = getModelPricing(modelId);
  if (!pricing) return 0;

  const inputCost = ((tokens.input || 0) / 1000000) * pricing.input;
  const outputCost = ((tokens.output || 0) / 1000000) * pricing.output;
  const cacheReadCost = ((tokens.cacheRead || 0) / 1000000) * pricing.cacheRead;
  const cacheWriteCost = ((tokens.cacheWrite || 0) / 1000000) * pricing.cacheWrite;

  return inputCost + outputCost + cacheReadCost + cacheWriteCost;
}

/**
 * Get all available models
 * @returns {string[]}
 */
function getAvailableModels() {
  return Object.keys(MODEL_PRICING);
}

/**
 * Check if pricing is expired
 * @returns {boolean}
 */
function isPricingExpired() {
  if (!PRICING_METADATA.expires) return true;
  return new Date() > new Date(PRICING_METADATA.expires);
}

/**
 * Get pricing metadata
 * @returns {Object}
 */
function getPricingMetadata() {
  return { ...PRICING_METADATA };
}

module.exports = {
  PRICING_METADATA,
  MODEL_PRICING,
  MODEL_ALIASES,
  getModelPricing,
  calculateCost,
  getAvailableModels,
  isPricingExpired,
  getPricingMetadata
};
`;

    return code;
  }

  /**
   * Write compiled pricing to file
   * @param {string} outputPath
   */
  async writeCompiledPricing(outputPath = this.sourceFile) {
    // Ensure output directory exists
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const code = this.compile();
    fs.writeFileSync(outputPath, code);

    return outputPath;
  }

  /**
   * Write pricing cache file
   * @param {string} cachePath
   */
  async writePricingCache(cachePath = this.cacheFile) {
    const dir = path.dirname(cachePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const cache = {
      metadata: this.metadata,
      pricing: this.pricing,
      aliases: MODEL_ALIASES
    };

    fs.writeFileSync(cachePath, JSON.stringify(cache, null, 2));

    return cachePath;
  }

  /**
   * Load pricing from cache
   * @param {string} cachePath
   * @returns {boolean}
   */
  loadFromCache(cachePath = this.cacheFile) {
    if (!fs.existsSync(cachePath)) {
      return false;
    }

    try {
      const content = fs.readFileSync(cachePath, 'utf8');
      const cache = JSON.parse(content);

      // Check expiration
      if (cache.metadata?.expires) {
        if (new Date() > new Date(cache.metadata.expires)) {
          return false;
        }
      }

      this.pricing = cache.pricing;
      this.metadata = cache.metadata;

      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Full build process
   * @param {Object} options
   * @returns {Promise<Object>}
   */
  async build(options = {}) {
    const useCache = options.useCache !== false;
    const forceRefresh = options.forceRefresh === true;

    // Try loading from cache first
    if (useCache && !forceRefresh && this.loadFromCache()) {
      // Cache is valid, just recompile
    } else {
      // Fetch fresh pricing
      await this.prefetchPricing();

      // Write cache
      await this.writePricingCache();
    }

    // Write compiled module
    const outputPath = await this.writeCompiledPricing();

    return {
      outputPath,
      cachePath: this.cacheFile,
      modelCount: Object.keys(this.pricing).length,
      metadata: this.metadata
    };
  }
}

/**
 * Build-time macro implementation
 * Creates a virtual module with embedded pricing
 */
class PricingMacro {
  constructor() {
    this.compiler = new PricingCompiler();
  }

  /**
   * Generate inline pricing code
   * @returns {string}
   */
  generateInlineCode() {
    return `
// Inline pricing data (embedded at build time)
const __EMBEDDED_PRICING__ = ${JSON.stringify(this.compiler.pricing)};
const __PRICING_METADATA__ = ${JSON.stringify(this.compiler.metadata)};

function getEmbeddedPricing(modelId) {
  return __EMBEDDED_PRICING__[modelId] || null;
}

function getEmbeddedMetadata() {
  return __PRICING_METADATA__;
}
`;
  }

  /**
   * Transform source code with embedded pricing
   * @param {string} source
   * @returns {string}
   */
  transform(source) {
    // Replace macro calls with actual values
    const replacements = [
      {
        pattern: /prefetchClaudePricing\(\)/g,
        replacement: JSON.stringify(this.compiler.pricing)
      },
      {
        pattern: /__PRICING_VERSION__/g,
        replacement: `"${this.compiler.metadata.version}"`
      },
      {
        pattern: /__PRICING_GENERATED_AT__/g,
        replacement: `"${this.compiler.metadata.generatedAt || new Date().toISOString()}"`
      }
    ];

    let result = source;
    for (const { pattern, replacement } of replacements) {
      result = result.replace(pattern, replacement);
    }

    return result;
  }
}

/**
 * Vite/Rollup plugin for compile-time pricing
 * @param {Object} options
 * @returns {Object}
 */
function pricingPlugin(options = {}) {
  const compiler = new PricingCompiler(options);
  let built = false;

  return {
    name: 'dragon-ui-pricing',

    async buildStart() {
      if (!built) {
        await compiler.build(options);
        built = true;
      }
    },

    resolveId(id) {
      if (id === 'virtual:dragon-ui-pricing') {
        return id;
      }
      return null;
    },

    load(id) {
      if (id === 'virtual:dragon-ui-pricing') {
        return compiler.compile();
      }
      return null;
    },

    transform(code, id) {
      if (id.endsWith('.js') || id.endsWith('.cjs') || id.endsWith('.mjs')) {
        const macro = new PricingMacro();
        return macro.transform(code);
      }
      return null;
    }
  };
}

/**
 * Webpack plugin for compile-time pricing
 */
class PricingWebpackPlugin {
  constructor(options = {}) {
    this.options = options;
    this.compiler = new PricingCompiler(options);
  }

  apply(compiler) {
    compiler.hooks.beforeRun.tapPromise('PricingWebpackPlugin', async () => {
      await this.compiler.build(this.options);
    });

    compiler.hooks.watchRun.tapPromise('PricingWebpackPlugin', async () => {
      await this.compiler.build({ ...this.options, useCache: true });
    });
  }
}

/**
 * CLI build command
 * @param {Object} options
 * @returns {Promise<Object>}
 */
async function buildPricing(options = {}) {
  const compiler = new PricingCompiler(options);
  return compiler.build(options);
}

/**
 * Get current compiled pricing
 * @returns {Object}
 */
function getCompiledPricing() {
  const compiler = new PricingCompiler();

  // Try to load from generated file first
  const generatedPath = path.join(process.cwd(), 'generated', 'pricing.cjs');
  if (fs.existsSync(generatedPath)) {
    try {
      return require(generatedPath);
    } catch (error) {
      // Fall through to default
    }
  }

  // Return default pricing
  return {
    PRICING_METADATA: {
      version: '1.0.0',
      generatedAt: new Date().toISOString(),
      source: 'default',
      expires: null
    },
    MODEL_PRICING: DEFAULT_PRICING,
    MODEL_ALIASES,
    getModelPricing: (modelId) => {
      if (DEFAULT_PRICING[modelId]) return DEFAULT_PRICING[modelId];
      const aliased = MODEL_ALIASES[modelId.toLowerCase()];
      if (aliased && DEFAULT_PRICING[aliased]) return DEFAULT_PRICING[aliased];
      return null;
    },
    calculateCost: (modelId, tokens) => {
      const pricing = DEFAULT_PRICING[modelId] || DEFAULT_PRICING[MODEL_ALIASES[modelId.toLowerCase()]];
      if (!pricing) return 0;

      const inputCost = ((tokens.input || 0) / 1000000) * pricing.input;
      const outputCost = ((tokens.output || 0) / 1000000) * pricing.output;
      const cacheReadCost = ((tokens.cacheRead || 0) / 1000000) * pricing.cacheRead;
      const cacheWriteCost = ((tokens.cacheWrite || 0) / 1000000) * pricing.cacheWrite;

      return inputCost + outputCost + cacheReadCost + cacheWriteCost;
    },
    getAvailableModels: () => Object.keys(DEFAULT_PRICING),
    isPricingExpired: () => false,
    getPricingMetadata: () => ({
      version: '1.0.0',
      generatedAt: new Date().toISOString(),
      source: 'default',
      expires: null
    })
  };
}

// Singleton instance
let instance = null;

/**
 * Get PricingCompiler instance
 * @param {Object} options
 * @returns {PricingCompiler}
 */
function getPricingCompiler(options) {
  if (!instance) {
    instance = new PricingCompiler(options);
  }
  return instance;
}

module.exports = {
  DEFAULT_PRICING,
  MODEL_ALIASES,
  PRICING_SOURCES,
  PricingCompiler,
  PricingMacro,
  PricingWebpackPlugin,
  pricingPlugin,
  buildPricing,
  getCompiledPricing,
  getPricingCompiler
};
