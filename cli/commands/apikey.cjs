/**
 * API Key CLI Commands for Dragon-UI
 * Manage API keys from the command line
 *
 * @module cli/commands/apikey
 */

'use strict';

const { getApiKeyService, CONFIG } = require('../../services/api-key-service.cjs');

let chalk;
async function getChalk() {
  if (!chalk) {
    chalk = (await import('chalk')).default;
  }
  return chalk;
}

/**
 * Format date for display
 * @param {string} date
 * @returns {string}
 */
function formatDate(date) {
  if (!date) return 'Never';
  return new Date(date).toLocaleString();
}

/**
 * Format relative time
 * @param {string} date
 * @returns {string}
 */
function formatRelativeTime(date) {
  if (!date) return 'Never';

  const now = new Date();
  const then = new Date(date);
  const diffMs = now - then;
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays > 0) return `${diffDays}d ago`;
  if (diffHours > 0) return `${diffHours}h ago`;
  if (diffMins > 0) return `${diffMins}m ago`;
  return 'Just now';
}

/**
 * Create a new API key
 */
async function createKey(name, options = {}) {
  const c = await getChalk();

  if (!name) {
    console.log(c.red('Error: Key name is required'));
    console.log(c.dim('Usage: dragon-ui-claude-cli apikey create <name> [--rate-limit N] [--expires N]'));
    return;
  }

  try {
    const service = getApiKeyService();

    const result = service.create({
      name,
      accountId: options.account,
      rateLimit: options.rateLimit ? parseInt(options.rateLimit, 10) : CONFIG.DEFAULT_RATE_LIMIT,
      expiresInDays: options.expires ? parseInt(options.expires, 10) : null
    });

    console.log(c.green('\nAPI Key Created Successfully!\n'));

    console.log(c.bold('API Key:'));
    console.log(c.yellow.bold(`  ${result.key}`));
    console.log(c.red('\n  IMPORTANT: Copy this key now. It will not be shown again!\n'));

    console.log(c.dim('Details:'));
    console.log(`  ID:       ${result.id}`);
    console.log(`  Name:     ${result.name}`);
    console.log(`  Preview:  ${result.preview}...`);
    if (result.expiresAt) {
      console.log(`  Expires:  ${formatDate(result.expiresAt)}`);
    }

    console.log(c.dim('\nUsage:'));
    console.log(c.dim(`  curl -H "Authorization: Bearer ${result.key}" <endpoint>`));

  } catch (error) {
    console.log(c.red(`Error: ${error.message}`));
  }
}

/**
 * List all API keys
 */
async function listKeys(options = {}) {
  const c = await getChalk();

  try {
    const service = getApiKeyService();
    const keys = service.list({
      enabledOnly: options.enabled,
      accountId: options.account
    });

    if (keys.length === 0) {
      console.log(c.yellow('\nNo API keys found.\n'));
      console.log(c.dim('Create one with: dragon-ui-claude-cli apikey create <name>'));
      return;
    }

    console.log(c.bold(`\nAPI Keys (${keys.length})\n`));

    // Table header
    const headers = ['ID', 'Name', 'Preview', 'Status', 'Rate Limit', 'Usage', 'Last Used'];
    const widths = [6, 20, 16, 10, 12, 10, 15];

    console.log(c.dim(
      headers.map((h, i) => h.padEnd(widths[i])).join(' ')
    ));
    console.log(c.dim('-'.repeat(widths.reduce((a, b) => a + b + 1, 0))));

    for (const key of keys) {
      const status = key.enabled
        ? c.green('Active')
        : c.red('Disabled');

      const isExpired = key.expiresAt && new Date(key.expiresAt) < new Date();
      const statusText = isExpired ? c.yellow('Expired') : status;

      const row = [
        String(key.id).padEnd(widths[0]),
        key.name.slice(0, widths[1] - 1).padEnd(widths[1]),
        (key.preview + '...').padEnd(widths[2]),
        statusText.padEnd(widths[3] + (statusText.length - 6)), // Account for ANSI codes
        String(key.rateLimit + '/min').padEnd(widths[4]),
        String(key.usageCount).padEnd(widths[5]),
        formatRelativeTime(key.lastUsedAt).padEnd(widths[6])
      ];

      console.log(row.join(' '));
    }

    console.log();

  } catch (error) {
    console.log(c.red(`Error: ${error.message}`));
  }
}

/**
 * Show API key details
 */
async function showKey(id, options = {}) {
  const c = await getChalk();

  if (!id) {
    console.log(c.red('Error: Key ID is required'));
    console.log(c.dim('Usage: dragon-ui-claude-cli apikey show <id>'));
    return;
  }

  try {
    const service = getApiKeyService();
    const key = service.getById(parseInt(id, 10));

    if (!key) {
      console.log(c.red(`Error: API key #${id} not found`));
      return;
    }

    console.log(c.bold(`\nAPI Key #${key.id}\n`));

    console.log(`  Name:        ${key.name}`);
    console.log(`  Preview:     ${key.preview}...`);
    console.log(`  Account:     ${key.accountId || c.dim('None')}`);

    const statusColor = key.enabled ? c.green : c.red;
    console.log(`  Status:      ${statusColor(key.enabled ? 'Active' : 'Disabled')}`);

    console.log(`  Rate Limit:  ${key.rateLimit} req/min`);

    if (key.expiresAt) {
      const isExpired = new Date(key.expiresAt) < new Date();
      const expiryColor = isExpired ? c.red : c.dim;
      console.log(`  Expires:     ${expiryColor(formatDate(key.expiresAt))}${isExpired ? c.red(' (EXPIRED)') : ''}`);
    } else {
      console.log(`  Expires:     ${c.dim('Never')}`);
    }

    console.log(`  Created:     ${formatDate(key.createdAt)}`);
    console.log(`  Updated:     ${formatDate(key.updatedAt)}`);
    console.log(`  Last Used:   ${formatDate(key.lastUsedAt)}`);
    console.log(`  Usage Count: ${key.usageCount}`);

    // Show usage stats if verbose
    if (options.verbose) {
      const stats = service.getUsageStats(key.id);
      console.log(c.bold('\n  Usage Stats (24h):\n'));
      console.log(`    Requests:      ${stats.totalRequests}`);
      console.log(`    Success Rate:  ${stats.successRate}%`);
      console.log(`    Avg Response:  ${stats.avgResponseTimeMs}ms`);
      console.log(`    Errors:        ${stats.errorCount}`);
    }

    console.log();

  } catch (error) {
    console.log(c.red(`Error: ${error.message}`));
  }
}

/**
 * Enable an API key
 */
async function enableKey(id) {
  const c = await getChalk();

  if (!id) {
    console.log(c.red('Error: Key ID is required'));
    return;
  }

  try {
    const service = getApiKeyService();
    const success = service.enable(parseInt(id, 10));

    if (success) {
      console.log(c.green(`\nAPI key #${id} enabled successfully\n`));
    } else {
      console.log(c.red(`Error: API key #${id} not found`));
    }

  } catch (error) {
    console.log(c.red(`Error: ${error.message}`));
  }
}

/**
 * Disable an API key
 */
async function disableKey(id) {
  const c = await getChalk();

  if (!id) {
    console.log(c.red('Error: Key ID is required'));
    return;
  }

  try {
    const service = getApiKeyService();
    const success = service.disable(parseInt(id, 10));

    if (success) {
      console.log(c.yellow(`\nAPI key #${id} disabled\n`));
    } else {
      console.log(c.red(`Error: API key #${id} not found`));
    }

  } catch (error) {
    console.log(c.red(`Error: ${error.message}`));
  }
}

/**
 * Delete an API key
 */
async function deleteKey(id, options = {}) {
  const c = await getChalk();

  if (!id) {
    console.log(c.red('Error: Key ID is required'));
    return;
  }

  try {
    const service = getApiKeyService();

    // Get key info first
    const key = service.getById(parseInt(id, 10));
    if (!key) {
      console.log(c.red(`Error: API key #${id} not found`));
      return;
    }

    // Confirm deletion unless --force
    if (!options.force) {
      console.log(c.yellow(`\nWarning: This will permanently delete API key "${key.name}" (${key.preview}...)`));
      console.log(c.dim('Use --force to skip this confirmation\n'));

      // Simple confirmation using readline
      const readline = require('readline');
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });

      const answer = await new Promise(resolve => {
        rl.question('Type "delete" to confirm: ', answer => {
          rl.close();
          resolve(answer);
        });
      });

      if (answer.toLowerCase() !== 'delete') {
        console.log(c.dim('\nDeletion cancelled\n'));
        return;
      }
    }

    const success = service.delete(parseInt(id, 10));

    if (success) {
      console.log(c.red(`\nAPI key #${id} deleted permanently\n`));
    } else {
      console.log(c.red(`Error: Failed to delete API key #${id}`));
    }

  } catch (error) {
    console.log(c.red(`Error: ${error.message}`));
  }
}

/**
 * Show usage statistics
 */
async function showStats(id) {
  const c = await getChalk();

  if (!id) {
    console.log(c.red('Error: Key ID is required'));
    return;
  }

  try {
    const service = getApiKeyService();
    const stats = service.getUsageStats(parseInt(id, 10));

    if (!stats.keyId) {
      console.log(c.red(`Error: API key #${id} not found`));
      return;
    }

    console.log(c.bold(`\nUsage Statistics for Key #${id}\n`));

    console.log(c.cyan('Last 24 Hours:'));
    console.log(`  Total Requests:    ${stats.totalRequests}`);
    console.log(`  Successful:        ${c.green(stats.successCount)}`);
    console.log(`  Errors:            ${stats.errorCount > 0 ? c.red(stats.errorCount) : stats.errorCount}`);
    console.log(`  Success Rate:      ${stats.successRate}%`);
    console.log(`  Avg Response Time: ${stats.avgResponseTimeMs}ms`);

    console.log(c.cyan('\nLifetime:'));
    console.log(`  Total Usage:       ${stats.lifetimeUsage}`);
    console.log(`  Last Used:         ${formatDate(stats.lastUsed)}`);

    console.log();

  } catch (error) {
    console.log(c.red(`Error: ${error.message}`));
  }
}

/**
 * Show recent usage logs
 */
async function showUsage(id, options = {}) {
  const c = await getChalk();

  if (!id) {
    console.log(c.red('Error: Key ID is required'));
    return;
  }

  try {
    const service = getApiKeyService();
    const limit = options.limit ? parseInt(options.limit, 10) : 20;
    const usage = service.getRecentUsage(parseInt(id, 10), limit);

    if (usage.length === 0) {
      console.log(c.yellow(`\nNo usage logs found for key #${id}\n`));
      return;
    }

    console.log(c.bold(`\nRecent Usage for Key #${id} (Last ${usage.length} requests)\n`));

    // Table header
    const headers = ['Time', 'Method', 'Endpoint', 'Status', 'Response'];
    const widths = [20, 8, 30, 8, 12];

    console.log(c.dim(headers.map((h, i) => h.padEnd(widths[i])).join(' ')));
    console.log(c.dim('-'.repeat(widths.reduce((a, b) => a + b + 1, 0))));

    for (const log of usage) {
      const time = formatRelativeTime(log.created_at);
      const method = log.method || '-';
      const endpoint = (log.endpoint || '-').slice(0, widths[2] - 1);
      const status = log.status_code || '-';
      const responseTime = log.response_time_ms ? `${log.response_time_ms}ms` : '-';

      // Color status code
      let statusStr = String(status);
      if (status >= 200 && status < 300) {
        statusStr = c.green(status);
      } else if (status >= 400) {
        statusStr = c.red(status);
      }

      const row = [
        time.padEnd(widths[0]),
        method.padEnd(widths[1]),
        endpoint.padEnd(widths[2]),
        statusStr.padEnd(widths[3] + (statusStr.length - String(status).length)),
        responseTime.padEnd(widths[4])
      ];

      console.log(row.join(' '));
    }

    console.log();

  } catch (error) {
    console.log(c.red(`Error: ${error.message}`));
  }
}

/**
 * Update API key settings
 */
async function updateKey(id, options = {}) {
  const c = await getChalk();

  if (!id) {
    console.log(c.red('Error: Key ID is required'));
    return;
  }

  const keyId = parseInt(id, 10);

  try {
    const service = getApiKeyService();

    // Check key exists
    const key = service.getById(keyId);
    if (!key) {
      console.log(c.red(`Error: API key #${id} not found`));
      return;
    }

    let updated = false;

    // Update name
    if (options.name) {
      service.updateName(keyId, options.name);
      console.log(c.green(`  Name updated to: ${options.name}`));
      updated = true;
    }

    // Update rate limit
    if (options.rateLimit) {
      const rateLimit = parseInt(options.rateLimit, 10);
      service.updateRateLimit(keyId, rateLimit);
      console.log(c.green(`  Rate limit updated to: ${rateLimit}/min`));
      updated = true;
    }

    if (updated) {
      console.log(c.green(`\nAPI key #${id} updated successfully\n`));
    } else {
      console.log(c.yellow('\nNo updates specified'));
      console.log(c.dim('Options: --name <name>, --rate-limit <N>'));
    }

  } catch (error) {
    console.log(c.red(`Error: ${error.message}`));
  }
}

/**
 * Cleanup expired keys and old logs
 */
async function cleanup() {
  const c = await getChalk();

  try {
    const service = getApiKeyService();
    const result = service.cleanup();

    console.log(c.bold('\nCleanup Complete\n'));
    console.log(`  Expired keys disabled: ${result.expiredKeys}`);
    console.log(`  Old usage logs removed: ${result.oldUsageLogs}`);
    console.log();

  } catch (error) {
    console.log(c.red(`Error: ${error.message}`));
  }
}

/**
 * Show database info
 */
async function showInfo() {
  const c = await getChalk();

  try {
    const service = getApiKeyService();
    const info = service.getDbInfo();

    console.log(c.bold('\nAPI Key Database Info\n'));
    console.log(`  Database Path:   ${info.dbPath}`);
    console.log(`  Total Keys:      ${info.totalKeys}`);
    console.log(`  Enabled Keys:    ${c.green(info.enabledKeys)}`);
    console.log(`  Usage Logs:      ${info.usageLogs}`);
    console.log();

  } catch (error) {
    console.log(c.red(`Error: ${error.message}`));
  }
}

/**
 * Register API key commands
 * @param {Command} program - Commander program
 */
function registerCommands(program) {
  const apikey = program
    .command('apikey')
    .description('Manage API keys')
    .addHelpText('after', `
Examples:
  dragon-ui-claude-cli apikey create "My Key"
    Create a new API key

  dragon-ui-claude-cli apikey create "Temp Key" --expires 30
    Create key that expires in 30 days

  dragon-ui-claude-cli apikey list
    List all API keys

  dragon-ui-claude-cli apikey show 1 -v
    Show detailed info for key #1

  dragon-ui-claude-cli apikey disable 1
    Disable key #1

  dragon-ui-claude-cli apikey stats 1
    Show usage statistics for key #1
`);

  apikey
    .command('create <name>')
    .description('Create a new API key')
    .option('-a, --account <id>', 'Associate with account ID')
    .option('-r, --rate-limit <n>', 'Requests per minute limit', String(CONFIG.DEFAULT_RATE_LIMIT))
    .option('-e, --expires <days>', 'Expire after N days')
    .action(createKey);

  apikey
    .command('list')
    .alias('ls')
    .description('List all API keys')
    .option('-e, --enabled', 'Show only enabled keys')
    .option('-a, --account <id>', 'Filter by account ID')
    .action(listKeys);

  apikey
    .command('show <id>')
    .description('Show API key details')
    .option('-v, --verbose', 'Show usage statistics')
    .action(showKey);

  apikey
    .command('enable <id>')
    .description('Enable an API key')
    .action(enableKey);

  apikey
    .command('disable <id>')
    .description('Disable an API key')
    .action(disableKey);

  apikey
    .command('delete <id>')
    .description('Delete an API key permanently')
    .option('-f, --force', 'Skip confirmation')
    .action(deleteKey);

  apikey
    .command('update <id>')
    .description('Update API key settings')
    .option('-n, --name <name>', 'New name')
    .option('-r, --rate-limit <n>', 'New rate limit')
    .action(updateKey);

  apikey
    .command('stats <id>')
    .description('Show usage statistics')
    .action(showStats);

  apikey
    .command('usage <id>')
    .description('Show recent usage logs')
    .option('-l, --limit <n>', 'Number of logs to show', '20')
    .action(showUsage);

  apikey
    .command('cleanup')
    .description('Cleanup expired keys and old logs')
    .action(cleanup);

  apikey
    .command('info')
    .description('Show database info')
    .action(showInfo);

  return apikey;
}

module.exports = {
  registerCommands,
  createKey,
  listKeys,
  showKey,
  enableKey,
  disableKey,
  deleteKey,
  updateKey,
  showStats,
  showUsage,
  cleanup,
  showInfo
};
