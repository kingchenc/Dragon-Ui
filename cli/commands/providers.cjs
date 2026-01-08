/**
 * Provider CLI Commands
 * Commands for managing AI model providers
 */

const { providerManager, PROVIDER_DEFINITIONS } = require('../../services/provider-manager.cjs');

// Dynamic chalk import
let chalk = null;
async function getChalk() {
  if (!chalk) {
    try {
      chalk = (await import('chalk')).default;
    } catch {
      const identity = (text) => text;
      chalk = {
        bold: identity, gray: identity, cyan: identity,
        green: identity, yellow: identity, red: identity, white: identity,
        magenta: identity, blue: identity, hex: () => identity
      };
      Object.keys(chalk).forEach(key => {
        if (typeof chalk[key] === 'function') {
          chalk[key].bold = identity;
          chalk.bold[key] = identity;
        }
      });
    }
  }
  return chalk;
}

/**
 * List all providers
 */
async function listProviders(options = {}) {
  const chalk = await getChalk();
  const providers = providerManager.getAllProviders();
  const activeProvider = providerManager.getActiveProvider();

  console.log(chalk.bold('\n=== AI Model Providers ===\n'));

  for (const provider of providers) {
    const isActive = provider.id === activeProvider?.id;
    const activeMarker = isActive ? chalk.green(' (active)') : '';
    const customBadge = provider.isCustom ? chalk.gray(' [custom]') : '';
    const localBadge = provider.isLocal ? chalk.blue(' [local]') : '';

    const statusIcon = provider.enabled
      ? (provider.hasApiKey() ? chalk.green('✓') : chalk.yellow('○'))
      : chalk.red('✗');

    console.log(`  ${statusIcon} ${chalk.cyan(provider.id.padEnd(12))} ${provider.name}${activeMarker}${customBadge}${localBadge}`);

    if (options.verbose) {
      console.log(`     ${chalk.gray('API Key:')} ${provider.hasApiKey() ? chalk.green('Configured') : chalk.yellow('Not set')}`);
      console.log(`     ${chalk.gray('Base URL:')} ${provider.getBaseUrl() || chalk.gray('(default)')}`);

      const features = Object.entries(provider.features)
        .filter(([, enabled]) => enabled)
        .map(([name]) => name)
        .join(', ');
      if (features) {
        console.log(`     ${chalk.gray('Features:')} ${features}`);
      }
      console.log();
    }
  }

  const stats = providerManager.getProviderStats();
  console.log();
  console.log(`Total: ${stats.total} providers (${stats.enabled} enabled, ${stats.configured} configured)`);

  if (!options.verbose) {
    console.log(chalk.gray('\nUse --verbose for more details'));
  }
}

/**
 * Show provider info
 */
async function showProvider(id) {
  const chalk = await getChalk();

  if (!id) {
    const active = providerManager.getActiveProvider();
    if (active) {
      id = active.id;
    } else {
      console.log(chalk.red('\nNo provider specified and no active provider'));
      return;
    }
  }

  const provider = providerManager.getProvider(id);
  if (!provider) {
    console.log(chalk.red(`\nProvider not found: ${id}`));
    console.log(`Available providers: ${providerManager.getAllProviders().map(p => p.id).join(', ')}`);
    return;
  }

  const info = provider.getInfo();
  const isActive = providerManager.getActiveProvider()?.id === id;

  console.log(chalk.bold(`\n=== ${info.name} ===\n`));

  console.log(`  ID:          ${chalk.cyan(info.id)}${isActive ? chalk.green(' (active)') : ''}`);
  console.log(`  Status:      ${info.enabled ? chalk.green('Enabled') : chalk.red('Disabled')}`);
  console.log(`  API Key:     ${info.hasApiKey ? chalk.green('Configured') : chalk.yellow('Not configured')}`);

  if (info.baseUrl) {
    console.log(`  Base URL:    ${info.baseUrl}`);
  }

  if (info.docUrl) {
    console.log(`  Docs:        ${chalk.blue(info.docUrl)}`);
  }

  console.log();
  console.log(chalk.bold('  Features:'));
  for (const [feature, enabled] of Object.entries(info.features)) {
    const icon = enabled ? chalk.green('✓') : chalk.red('✗');
    console.log(`    ${icon} ${feature}`);
  }

  console.log();
  console.log(chalk.bold('  Model Prefixes:'));
  for (const prefix of info.modelPrefixes) {
    console.log(`    - ${prefix}*`);
  }

  console.log();
  console.log(chalk.bold('  Pricing:'));
  console.log(`    Currency: ${info.pricing.currency}`);
  console.log(`    Billing:  ${info.pricing.billingUnit}`);

  if (info.isLocal) {
    console.log();
    console.log(chalk.blue('  Note: This is a local provider (no API key required)'));
  }
}

/**
 * Set active provider
 */
async function setActiveProvider(id) {
  const chalk = await getChalk();

  if (!id) {
    console.log(chalk.red('\nProvider ID is required'));
    return;
  }

  try {
    const provider = providerManager.setActiveProvider(id);
    console.log(chalk.green(`\nActive provider set to: ${provider.name}`));
  } catch (error) {
    console.log(chalk.red(`\nError: ${error.message}`));
    console.log(`Available providers: ${providerManager.getAllProviders().map(p => p.id).join(', ')}`);
  }
}

/**
 * Enable provider
 */
async function enableProvider(id) {
  const chalk = await getChalk();

  if (!id) {
    console.log(chalk.red('\nProvider ID is required'));
    return;
  }

  if (providerManager.enableProvider(id)) {
    console.log(chalk.green(`\nProvider enabled: ${id}`));
  } else {
    console.log(chalk.red(`\nProvider not found: ${id}`));
  }
}

/**
 * Disable provider
 */
async function disableProvider(id) {
  const chalk = await getChalk();

  if (!id) {
    console.log(chalk.red('\nProvider ID is required'));
    return;
  }

  if (providerManager.disableProvider(id)) {
    console.log(chalk.yellow(`\nProvider disabled: ${id}`));
  } else {
    console.log(chalk.red(`\nProvider not found: ${id}`));
  }
}

/**
 * Check provider health
 */
async function checkHealth(id) {
  const chalk = await getChalk();

  const providers = id
    ? [providerManager.getProvider(id)].filter(Boolean)
    : providerManager.getEnabledProviders();

  if (providers.length === 0) {
    console.log(chalk.red('\nNo providers to check'));
    return;
  }

  console.log(chalk.bold('\n=== Provider Health Check ===\n'));

  for (const provider of providers) {
    process.stdout.write(`  Checking ${provider.name}... `);

    const health = await provider.checkHealth();

    let statusColor;
    switch (health.status) {
      case 'healthy':
      case 'configured':
        statusColor = chalk.green;
        break;
      case 'degraded':
      case 'unconfigured':
        statusColor = chalk.yellow;
        break;
      case 'disabled':
        statusColor = chalk.gray;
        break;
      default:
        statusColor = chalk.red;
    }

    console.log(`${statusColor(health.status)} - ${health.message}`);
  }
}

/**
 * Detect provider from model name
 */
async function detectProvider(modelName) {
  const chalk = await getChalk();

  if (!modelName) {
    console.log(chalk.red('\nModel name is required'));
    return;
  }

  const provider = providerManager.detectProviderFromModel(modelName);

  console.log(chalk.bold('\n=== Provider Detection ===\n'));
  console.log(`  Model:    ${chalk.cyan(modelName)}`);
  console.log(`  Provider: ${chalk.green(provider.name)} (${provider.id})`);
  console.log(`  Status:   ${provider.hasApiKey() ? chalk.green('Ready') : chalk.yellow('API key not configured')}`);
}

/**
 * Show provider statistics
 */
async function showStats() {
  const chalk = await getChalk();
  const stats = providerManager.getProviderStats();

  console.log(chalk.bold('\n=== Provider Statistics ===\n'));

  console.log(`  Total Providers:     ${stats.total}`);
  console.log(`  Enabled:             ${stats.enabled}`);
  console.log(`  Configured (API):    ${stats.configured}`);
  console.log(`  Custom:              ${stats.custom}`);

  console.log();
  console.log(chalk.bold('  By Status:'));

  const configured = stats.providers.filter(p => p.enabled && p.hasApiKey);
  const enabled = stats.providers.filter(p => p.enabled && !p.hasApiKey);
  const disabled = stats.providers.filter(p => !p.enabled);

  if (configured.length > 0) {
    console.log(`    ${chalk.green('Ready:')} ${configured.map(p => p.id).join(', ')}`);
  }
  if (enabled.length > 0) {
    console.log(`    ${chalk.yellow('Needs API Key:')} ${enabled.map(p => p.id).join(', ')}`);
  }
  if (disabled.length > 0) {
    console.log(`    ${chalk.gray('Disabled:')} ${disabled.map(p => p.id).join(', ')}`);
  }
}

/**
 * Show help
 */
async function showHelp() {
  const chalk = await getChalk();

  console.log(chalk.bold('\n=== Provider Commands ===\n'));

  console.log('  dragon-ui-claude-cli providers list [--verbose]');
  console.log(chalk.gray('    List all available providers\n'));

  console.log('  dragon-ui-claude-cli providers show <id>');
  console.log(chalk.gray('    Show detailed provider information\n'));

  console.log('  dragon-ui-claude-cli providers set <id>');
  console.log(chalk.gray('    Set the active provider\n'));

  console.log('  dragon-ui-claude-cli providers enable <id>');
  console.log(chalk.gray('    Enable a provider\n'));

  console.log('  dragon-ui-claude-cli providers disable <id>');
  console.log(chalk.gray('    Disable a provider\n'));

  console.log('  dragon-ui-claude-cli providers health [id]');
  console.log(chalk.gray('    Check provider health status\n'));

  console.log('  dragon-ui-claude-cli providers detect <model>');
  console.log(chalk.gray('    Detect provider from model name\n'));

  console.log('  dragon-ui-claude-cli providers stats');
  console.log(chalk.gray('    Show provider statistics\n'));

  console.log(chalk.bold('Available Providers:\n'));

  for (const [id, def] of Object.entries(PROVIDER_DEFINITIONS)) {
    console.log(`  ${chalk.cyan(id.padEnd(12))} ${def.name}`);
  }

  console.log(chalk.bold('\nAPI Key Configuration:\n'));
  console.log(chalk.gray('  Set API keys via environment variables:'));
  console.log('    ANTHROPIC_API_KEY=sk-ant-...');
  console.log('    OPENAI_API_KEY=sk-...');
  console.log('    GOOGLE_API_KEY=...');
  console.log();
}

module.exports = {
  listProviders,
  showProvider,
  setActiveProvider,
  enableProvider,
  disableProvider,
  checkHealth,
  detectProvider,
  showStats,
  showHelp
};
