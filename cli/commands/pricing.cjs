/**
 * Pricing Command
 * CLI commands for managing model pricing
 */

const { modelPriceService } = require('../../services/model-price-service.cjs');

// Dynamic chalk import (ESM module)
let chalk = null;
async function getChalk() {
  if (!chalk) {
    try {
      chalk = (await import('chalk')).default;
    } catch {
      // Fallback mock
      const identity = (text) => text;
      chalk = {
        bold: identity, gray: identity, cyan: identity,
        green: identity, yellow: identity, red: identity, white: identity
      };
      Object.keys(chalk).forEach(key => {
        chalk[key].bold = identity;
        chalk.bold[key] = identity;
      });
    }
  }
  return chalk;
}

/**
 * Show current pricing for all models
 */
async function showPricing(options = {}) {
  const chalk = await getChalk();
  const prices = modelPriceService.getAllPrices();
  const source = modelPriceService.getPricingSource();

  console.log(chalk.bold('\n=== Model Pricing ===\n'));

  // Show pricing source
  console.log(chalk.gray(`Source: ${source.source}`));
  if (source.cacheAge) {
    console.log(chalk.gray(`Last Update: ${source.cacheAge} ago`));
  }
  if (source.warning) {
    console.log(chalk.yellow(`Warning: ${source.warning}`));
  }
  console.log();

  // Group by provider
  const providers = {
    'Claude (Anthropic)': [],
    'GPT (OpenAI)': [],
    'GLM (Zhipu)': []
  };

  for (const [model, pricing] of Object.entries(prices)) {
    if (model.startsWith('claude-')) {
      providers['Claude (Anthropic)'].push({ model, pricing });
    } else if (model.startsWith('gpt-')) {
      providers['GPT (OpenAI)'].push({ model, pricing });
    } else if (model.startsWith('glm-')) {
      providers['GLM (Zhipu)'].push({ model, pricing });
    }
  }

  // Display by provider
  for (const [provider, models] of Object.entries(providers)) {
    if (models.length === 0) continue;

    console.log(chalk.cyan.bold(`${provider}:`));
    console.log(chalk.gray('─'.repeat(60)));

    for (const { model, pricing } of models) {
      const input = `$${pricing.input.toFixed(2)}/M`;
      const output = `$${pricing.output.toFixed(2)}/M`;
      const cached = pricing.cacheRead ? `$${pricing.cacheRead.toFixed(2)}/M` : 'N/A';

      if (options.verbose) {
        console.log(`  ${chalk.white(model.padEnd(25))} Input: ${chalk.green(input.padEnd(10))} Output: ${chalk.yellow(output.padEnd(10))} Cache: ${chalk.gray(cached)}`);
      } else {
        console.log(`  ${chalk.white(model.padEnd(25))} ${chalk.green(input.padEnd(10))} / ${chalk.yellow(output)}`);
      }
    }
    console.log();
  }

  // Show tiered pricing info
  console.log(chalk.cyan.bold('Tiered Pricing:'));
  console.log(chalk.gray('─'.repeat(60)));
  console.log(`  Claude models: 50% discount after 200k tokens`);
  console.log(`  GPT-5 models:  25% discount after 128k tokens`);
  console.log();
}

/**
 * Refresh pricing from LiteLLM
 */
async function refreshPricing() {
  const chalk = await getChalk();
  console.log(chalk.cyan('Refreshing pricing from LiteLLM...'));

  try {
    const success = await modelPriceService.forceUpdate();
    if (success) {
      console.log(chalk.green('Pricing updated successfully!'));
    } else {
      console.log(chalk.yellow('No pricing updates available.'));
    }
  } catch (error) {
    console.log(chalk.red(`Failed to update pricing: ${error.message}`));
  }
}

/**
 * Detect model and show pricing
 */
async function detectModel(modelString) {
  const chalk = await getChalk();
  const result = modelPriceService.detectModel(modelString);

  console.log(chalk.bold('\n=== Model Detection ===\n'));
  console.log(`Input:    ${chalk.white(modelString)}`);
  console.log(`Detected: ${result.model ? chalk.green(result.model) : chalk.red('Not found')}`);
  console.log(`Tier:     ${result.tier > 0 ? chalk.cyan(`Tier ${result.tier}`) : chalk.gray('N/A')}`);
  console.log(`Score:    ${result.score > 0 ? chalk.yellow(`${result.score}/100`) : chalk.gray('0')}`);

  if (result.model) {
    const pricing = modelPriceService.getModelPrices(result.model);
    console.log();
    console.log(chalk.cyan('Pricing:'));
    console.log(`  Input:  ${chalk.green(`$${pricing.input.toFixed(2)}/M tokens`)}`);
    console.log(`  Output: ${chalk.yellow(`$${pricing.output.toFixed(2)}/M tokens`)}`);
    if (pricing.cacheRead) {
      console.log(`  Cache:  ${chalk.gray(`$${pricing.cacheRead.toFixed(2)}/M tokens (read)`)}`);
    }

    const contextWindow = modelPriceService.getContextWindow(result.model);
    console.log();
    console.log(chalk.cyan('Context Window:'));
    console.log(`  Max:    ${chalk.white(`${(contextWindow.max / 1000).toFixed(0)}k tokens`)}`);
    console.log(`  Usable: ${chalk.white(`${(contextWindow.usable / 1000).toFixed(0)}k tokens (80%)`)}`);
    console.log(`  Output: ${chalk.white(`${(contextWindow.output / 1000).toFixed(0)}k tokens max`)}`);
  }

  console.log();
}

/**
 * Calculate cost for given tokens
 */
async function calculateCost(inputTokens, outputTokens, model, options = {}) {
  const chalk = await getChalk();
  const detectedModel = modelPriceService.normalizeModelName(model) || 'claude-sonnet-4.5';

  console.log(chalk.bold('\n=== Cost Calculation ===\n'));
  console.log(`Model:  ${chalk.cyan(detectedModel)}`);
  console.log(`Input:  ${chalk.white(formatTokens(inputTokens))} tokens`);
  console.log(`Output: ${chalk.white(formatTokens(outputTokens))} tokens`);

  if (options.cached) {
    console.log(`Cached: ${chalk.gray(formatTokens(options.cached))} tokens`);
  }

  console.log();

  // Calculate with tiered pricing
  const tieredCost = modelPriceService.calculateTieredCost(
    inputTokens,
    outputTokens,
    detectedModel,
    { cachedTokens: options.cached || 0 }
  );

  console.log(chalk.cyan('Cost Breakdown:'));
  console.log(`  Input:  ${chalk.green(`$${tieredCost.input.toFixed(4)}`)}`);
  console.log(`  Output: ${chalk.yellow(`$${tieredCost.output.toFixed(4)}`)}`);
  if (tieredCost.cached > 0) {
    console.log(`  Cached: ${chalk.gray(`$${tieredCost.cached.toFixed(4)}`)}`);
  }
  console.log(chalk.gray('─'.repeat(30)));
  console.log(`  Total:  ${chalk.bold.white(`$${tieredCost.total.toFixed(4)}`)}`);

  if (tieredCost.tieredPricing && (inputTokens > tieredCost.threshold || outputTokens > tieredCost.threshold)) {
    console.log();
    console.log(chalk.cyan('Tiered Pricing Applied:'));
    if (tieredCost.breakdown.tier2.input) {
      console.log(`  Tier 1 Input: ${formatTokens(tieredCost.breakdown.tier1.input.tokens)} → $${tieredCost.breakdown.tier1.input.cost.toFixed(4)}`);
      console.log(`  Tier 2 Input: ${formatTokens(tieredCost.breakdown.tier2.input.tokens)} → $${tieredCost.breakdown.tier2.input.cost.toFixed(4)} (50% off)`);
    }
    if (tieredCost.breakdown.tier2.output) {
      console.log(`  Tier 1 Output: ${formatTokens(tieredCost.breakdown.tier1.output.tokens)} → $${tieredCost.breakdown.tier1.output.cost.toFixed(4)}`);
      console.log(`  Tier 2 Output: ${formatTokens(tieredCost.breakdown.tier2.output.tokens)} → $${tieredCost.breakdown.tier2.output.cost.toFixed(4)} (50% off)`);
    }
  }

  console.log();
}

/**
 * Format token count
 */
function formatTokens(tokens) {
  if (tokens >= 1000000) {
    return `${(tokens / 1000000).toFixed(2)}M`;
  } else if (tokens >= 1000) {
    return `${(tokens / 1000).toFixed(1)}k`;
  }
  return tokens.toString();
}

/**
 * Show pricing cache stats
 */
async function showCacheStats() {
  const chalk = await getChalk();
  const stats = modelPriceService.getPricingStats();

  console.log(chalk.bold('\n=== Pricing Cache Stats ===\n'));
  console.log(`Last Update: ${stats.lastUpdate ? stats.lastUpdate.toISOString() : 'Never'}`);
  console.log(`Using Defaults: ${stats.usingDefaults ? chalk.yellow('Yes') : chalk.green('No')}`);
  console.log(`Next Update Due: ${stats.nextUpdateDue.toISOString()}`);
  console.log(`Models Cached: ${Object.keys(stats.prices).length}`);
  console.log();
}

module.exports = {
  showPricing,
  refreshPricing,
  detectModel,
  calculateCost,
  showCacheStats,
  formatTokens
};
