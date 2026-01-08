/**
 * Model Detection Test
 * Tests the 3-tier model detection system
 */

const { modelPriceService } = require('../services/model-price-service.cjs');

console.log('=== 3-Tier Model Detection Test ===\n');

// Tier 1: Exact matches
console.log('--- Tier 1: Exact Matches ---');
const tier1Tests = ['claude-sonnet-4.5', 'gpt-5', 'glm-4.7', 'claude-opus-4-5-20251101'];
tier1Tests.forEach(test => {
  const result = modelPriceService.detectModel(test);
  console.log(`  ${test} -> ${result.model} (Tier ${result.tier}, Score ${result.score})`);
});

// Tier 2: Provider prefix matches
console.log('\n--- Tier 2: Provider Prefix ---');
const tier2Tests = ['anthropic/claude-sonnet-4.5', 'openai/gpt-4o', 'nanogpt/glm-4.7'];
tier2Tests.forEach(test => {
  const result = modelPriceService.detectModel(test);
  console.log(`  ${test} -> ${result.model} (Tier ${result.tier}, Score ${result.score})`);
});

// Tier 3: Fuzzy matches
console.log('\n--- Tier 3: Fuzzy Matches ---');
const tier3Tests = ['sonnet4', 'opus', 'haiku', 'codex', 'son'];
tier3Tests.forEach(test => {
  const result = modelPriceService.detectModel(test);
  console.log(`  ${test} -> ${result.model} (Tier ${result.tier}, Score ${result.score})`);
});

// Unknown models
console.log('\n--- Unknown Models ---');
const unknownTests = ['unknown-model', 'xyz123'];
unknownTests.forEach(test => {
  const result = modelPriceService.detectModel(test);
  console.log(`  ${test} -> ${result.model || 'null'} (Tier ${result.tier}, Score ${result.score})`);
});

// Tiered Pricing Test
console.log('\n=== Tiered Pricing Test ===');
const cost1 = modelPriceService.calculateTieredCost(100000, 50000, 'claude-sonnet-4.5');
console.log(`  100k in / 50k out: $${cost1.total.toFixed(4)} (tiered: ${cost1.tieredPricing})`);

const cost2 = modelPriceService.calculateTieredCost(250000, 100000, 'claude-sonnet-4.5');
console.log(`  250k in / 100k out: $${cost2.total.toFixed(4)} (tiered: ${cost2.tieredPricing})`);
console.log(`    Tier 1: ${cost2.breakdown.tier1.input?.tokens || 0} in, ${cost2.breakdown.tier1.output?.tokens || 0} out`);
console.log(`    Tier 2: ${cost2.breakdown.tier2.input?.tokens || 0} in, ${cost2.breakdown.tier2.output?.tokens || 0} out`);

// Pricing Source Test
console.log('\n=== Pricing Source Test ===');
const source = modelPriceService.getPricingSource();
console.log(`  Source: ${source.source}`);
console.log(`  Cache Age: ${source.cacheAge || 'N/A'}`);
if (source.warning) console.log(`  Warning: ${source.warning}`);

console.log('\n=== Model Detection Complete! ===');
