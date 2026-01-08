/**
 * Proxy CLI Commands for Dragon-UI
 * Manage proxy server and load balancing from the command line
 *
 * @module cli/commands/proxy
 */

'use strict';

const { getProxyServer, DEFAULT_CONFIG: PROXY_CONFIG } = require('../../services/proxy-server.cjs');
const { getLoadBalancer, STRATEGIES, ACCOUNT_STATUS } = require('../../services/load-balancer.cjs');
const { getRateLimitTracker } = require('../../services/rate-limit-tracker.cjs');
const { getAccountRouter, ROUTING_REASON } = require('../../services/account-router.cjs');

let chalk;
async function getChalk() {
  if (!chalk) {
    chalk = (await import('chalk')).default;
  }
  return chalk;
}

/**
 * Format bytes for display
 * @param {number} bytes
 * @returns {string}
 */
function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

/**
 * Format duration for display
 * @param {number} ms
 * @returns {string}
 */
function formatDuration(ms) {
  if (!ms || ms < 0) return 'N/A';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  if (ms < 3600000) return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
  return `${Math.floor(ms / 3600000)}h ${Math.floor((ms % 3600000) / 60000)}m`;
}

/**
 * Format percentage
 * @param {number} value
 * @returns {string}
 */
function formatPercent(value) {
  return `${(value * 100).toFixed(1)}%`;
}

/**
 * Get status color
 * @param {string} status
 * @param {Function} c
 * @returns {Function}
 */
function getStatusColor(status, c) {
  switch (status) {
    case ACCOUNT_STATUS.ACTIVE:
    case 'running':
    case 'healthy':
      return c.green;
    case ACCOUNT_STATUS.RATE_LIMITED:
    case 'limited':
      return c.yellow;
    case ACCOUNT_STATUS.ERROR:
    case 'error':
      return c.red;
    case ACCOUNT_STATUS.DISABLED:
    case 'stopped':
      return c.gray;
    default:
      return c.white;
  }
}

/**
 * Start proxy server
 */
async function startProxy(options = {}) {
  const c = await getChalk();

  console.log(c.bold('\nStarting Proxy Server\n'));

  try {
    const proxy = getProxyServer({
      port: options.port ? parseInt(options.port, 10) : PROXY_CONFIG.port,
      host: options.host || PROXY_CONFIG.host,
      enableCors: options.cors !== false,
      logRequests: options.log !== false
    });

    if (proxy.isRunning()) {
      console.log(c.yellow('Proxy server is already running.'));
      const info = proxy.getInfo();
      console.log(`  Address: ${c.cyan(`http://${info.host}:${info.port}`)}`);
      console.log();
      return;
    }

    // Set up event handlers
    proxy.on('listening', ({ host, port }) => {
      console.log(c.green(`✓ Proxy server started`));
      console.log(`  Address: ${c.cyan(`http://${host}:${port}`)}`);
      console.log(`  Target:  ${c.dim('https://api.anthropic.com')}`);
      console.log();
    });

    proxy.on('request_complete', (metadata) => {
      if (options.verbose) {
        console.log(c.dim(`[${metadata.requestId}] ${metadata.method} ${metadata.url} -> ${metadata.accountId} (${metadata.duration}ms)`));
      }
    });

    proxy.on('rate_limited', ({ requestId, accountId }) => {
      console.log(c.yellow(`[${requestId}] Rate limited on account: ${accountId}`));
    });

    proxy.on('failover', ({ requestId, from, to, reason }) => {
      console.log(c.yellow(`[${requestId}] Failover: ${from} -> ${to} (${reason})`));
    });

    proxy.on('error', (error) => {
      console.log(c.red(`Error: ${error.message}`));
    });

    await proxy.start();

    if (!options.daemon) {
      console.log(c.dim('Press Ctrl+C to stop the server.\n'));

      process.on('SIGINT', async () => {
        console.log(c.dim('\nShutting down...'));
        await proxy.stop();
        process.exit(0);
      });

      // Keep process running
      await new Promise(() => {});
    }

  } catch (error) {
    console.log(c.red(`Failed to start proxy: ${error.message}\n`));
  }
}

/**
 * Stop proxy server
 */
async function stopProxy() {
  const c = await getChalk();

  console.log(c.bold('\nStopping Proxy Server\n'));

  try {
    const proxy = getProxyServer();

    if (!proxy.isRunning()) {
      console.log(c.yellow('Proxy server is not running.\n'));
      return;
    }

    await proxy.stop();
    console.log(c.green('✓ Proxy server stopped.\n'));

  } catch (error) {
    console.log(c.red(`Error: ${error.message}\n`));
  }
}

/**
 * Show proxy status
 */
async function proxyStatus(options = {}) {
  const c = await getChalk();

  try {
    const proxy = getProxyServer();
    const info = proxy.getInfo();
    const stats = proxy.getStats();

    console.log(c.bold('\nProxy Server Status\n'));

    // Server info
    const statusColor = getStatusColor(info.running ? 'running' : 'stopped', c);
    console.log(`  Status:   ${statusColor(info.running ? '● Running' : '○ Stopped')}`);
    if (info.running) {
      console.log(`  Address:  ${c.cyan(`http://${info.host}:${info.port}`)}`);
      console.log(`  Target:   ${info.targetHost}:${info.targetPort}`);
    }
    console.log();

    // Request stats
    console.log(c.bold('Request Statistics\n'));
    console.log(`  Total Requests:     ${stats.proxy.totalRequests}`);
    console.log(`  Successful:         ${c.green(stats.proxy.successfulRequests)}`);
    console.log(`  Failed:             ${c.red(stats.proxy.failedRequests)}`);
    console.log(`  Rate Limited:       ${c.yellow(stats.proxy.rateLimitedRequests)}`);
    console.log(`  Retried:            ${stats.proxy.retriedRequests}`);
    console.log(`  Active:             ${stats.proxy.activeRequests}`);
    console.log();

    // Bandwidth stats
    console.log(c.bold('Bandwidth\n'));
    console.log(`  Received:  ${formatBytes(stats.proxy.bytesReceived)}`);
    console.log(`  Sent:      ${formatBytes(stats.proxy.bytesSent)}`);
    console.log(`  Avg Time:  ${formatDuration(stats.proxy.avgResponseTime)}`);
    console.log();

    // Load balancer stats
    console.log(c.bold('Load Balancer\n'));
    console.log(`  Strategy:    ${stats.loadBalancer.strategy}`);
    console.log(`  Accounts:    ${stats.loadBalancer.availableAccounts}/${stats.loadBalancer.totalAccounts} available`);
    console.log(`  Rate Limited: ${c.yellow(stats.loadBalancer.rateLimitedAccounts)}`);
    console.log(`  Sessions:    ${stats.loadBalancer.activeSessions}`);
    console.log(`  Success Rate: ${formatPercent(stats.loadBalancer.overallSuccessRate)}`);
    console.log();

    // Show accounts if verbose
    if (options.verbose && stats.loadBalancer.accounts.length > 0) {
      console.log(c.bold('Accounts\n'));

      const headers = ['ID', 'Status', 'Priority', 'Requests', 'Success', 'Connections'];
      const widths = [20, 15, 10, 10, 10, 12];

      console.log(c.dim(headers.map((h, i) => h.padEnd(widths[i])).join(' ')));
      console.log(c.dim('-'.repeat(widths.reduce((a, b) => a + b + 1, 0))));

      for (const acc of stats.loadBalancer.accounts) {
        const statusColor = getStatusColor(acc.status, c);
        const row = [
          acc.id.slice(0, widths[0] - 1).padEnd(widths[0]),
          statusColor(acc.status.padEnd(widths[1])),
          acc.priority.toString().padEnd(widths[2]),
          acc.totalRequests.toString().padEnd(widths[3]),
          formatPercent(acc.successRate).padEnd(widths[4]),
          acc.activeConnections.toString().padEnd(widths[5])
        ];
        console.log(row.join(' '));
      }
      console.log();
    }

  } catch (error) {
    console.log(c.red(`Error: ${error.message}\n`));
  }
}

/**
 * Add account to load balancer
 */
async function addAccount(accountId, options = {}) {
  const c = await getChalk();

  if (!accountId) {
    console.log(c.red('\nError: Account ID is required.\n'));
    return;
  }

  if (!options.apiKey) {
    console.log(c.red('\nError: API key is required (--api-key).\n'));
    return;
  }

  try {
    const lb = getLoadBalancer();

    // Check if exists
    if (lb.getAccount(accountId)) {
      console.log(c.yellow(`\nAccount "${accountId}" already exists.\n`));
      return;
    }

    const account = lb.addAccount({
      id: accountId,
      apiKey: options.apiKey,
      priority: options.priority ? parseInt(options.priority, 10) : 50,
      weight: options.weight ? parseInt(options.weight, 10) : 1,
      enabled: true
    });

    console.log(c.green(`\n✓ Account added: ${accountId}\n`));
    console.log(`  Priority: ${account.priority}`);
    console.log(`  Weight:   ${account.weight}`);
    console.log(`  Status:   ${c.green('active')}`);
    console.log();

  } catch (error) {
    console.log(c.red(`\nError: ${error.message}\n`));
  }
}

/**
 * Remove account from load balancer
 */
async function removeAccount(accountId, options = {}) {
  const c = await getChalk();

  if (!accountId) {
    console.log(c.red('\nError: Account ID is required.\n'));
    return;
  }

  try {
    const lb = getLoadBalancer();

    if (!lb.getAccount(accountId)) {
      console.log(c.red(`\nAccount "${accountId}" not found.\n`));
      return;
    }

    if (!options.force) {
      console.log(c.yellow(`\nWarning: This will remove account "${accountId}" from the load balancer.`));
      console.log(c.dim('Use --force to skip confirmation.\n'));

      const readline = require('readline');
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });

      const answer = await new Promise(resolve => {
        rl.question('Type "remove" to confirm: ', answer => {
          rl.close();
          resolve(answer);
        });
      });

      if (answer.toLowerCase() !== 'remove') {
        console.log(c.dim('\nCancelled.\n'));
        return;
      }
    }

    lb.removeAccount(accountId);
    console.log(c.green(`\n✓ Account removed: ${accountId}\n`));

  } catch (error) {
    console.log(c.red(`\nError: ${error.message}\n`));
  }
}

/**
 * List all accounts
 */
async function listAccounts(options = {}) {
  const c = await getChalk();

  try {
    const lb = getLoadBalancer();
    const accounts = lb.getAllAccounts();

    if (accounts.length === 0) {
      console.log(c.yellow('\nNo accounts configured.\n'));
      console.log(c.dim('Use "proxy account add <id> --api-key <key>" to add an account.\n'));
      return;
    }

    console.log(c.bold(`\nLoad Balancer Accounts (${accounts.length})\n`));

    const headers = ['ID', 'Status', 'Priority', 'Weight', 'Requests', 'Success Rate', 'Last Used'];
    const widths = [20, 15, 10, 8, 10, 12, 20];

    console.log(c.dim(headers.map((h, i) => h.padEnd(widths[i])).join(' ')));
    console.log(c.dim('-'.repeat(widths.reduce((a, b) => a + b + 1, 0))));

    for (const acc of accounts) {
      const statusColor = getStatusColor(acc.status, c);
      const statusIcon = acc.status === ACCOUNT_STATUS.ACTIVE ? '●' :
                        acc.status === ACCOUNT_STATUS.RATE_LIMITED ? '◐' :
                        acc.status === ACCOUNT_STATUS.ERROR ? '✕' : '○';

      const row = [
        acc.id.slice(0, widths[0] - 1).padEnd(widths[0]),
        statusColor(`${statusIcon} ${acc.status}`.padEnd(widths[1])),
        acc.priority.toString().padEnd(widths[2]),
        acc.weight.toString().padEnd(widths[3]),
        acc.totalRequests.toString().padEnd(widths[4]),
        formatPercent(acc.getSuccessRate()).padEnd(widths[5]),
        (acc.lastUsed ? new Date(acc.lastUsed).toLocaleTimeString() : 'Never').padEnd(widths[6])
      ];

      console.log(row.join(' '));

      if (options.verbose && acc.lastError) {
        console.log(c.red(`    Error: ${acc.lastError}`));
      }
    }

    console.log();

  } catch (error) {
    console.log(c.red(`\nError: ${error.message}\n`));
  }
}

/**
 * Enable/disable account
 */
async function toggleAccount(accountId, enable) {
  const c = await getChalk();

  if (!accountId) {
    console.log(c.red('\nError: Account ID is required.\n'));
    return;
  }

  try {
    const lb = getLoadBalancer();

    const success = enable ?
      lb.enableAccount(accountId) :
      lb.disableAccount(accountId);

    if (!success) {
      console.log(c.red(`\nAccount "${accountId}" not found.\n`));
      return;
    }

    console.log(c.green(`\n✓ Account ${enable ? 'enabled' : 'disabled'}: ${accountId}\n`));

  } catch (error) {
    console.log(c.red(`\nError: ${error.message}\n`));
  }
}

/**
 * Set load balancing strategy
 */
async function setStrategy(strategy) {
  const c = await getChalk();

  if (!strategy) {
    console.log(c.red('\nError: Strategy is required.\n'));
    console.log(c.dim('Available strategies: round-robin, least-connections, weighted, session-sticky, random\n'));
    return;
  }

  try {
    const lb = getLoadBalancer();
    lb.setStrategy(strategy);

    console.log(c.green(`\n✓ Strategy set to: ${strategy}\n`));

  } catch (error) {
    console.log(c.red(`\nError: ${error.message}\n`));
  }
}

/**
 * Show rate limit status
 */
async function rateLimitStatus(options = {}) {
  const c = await getChalk();

  try {
    const tracker = getRateLimitTracker();
    const stats = tracker.getStats();
    const activeLimits = tracker.getActiveLimits();

    console.log(c.bold('\nRate Limit Status\n'));

    console.log(`  Active Limits:   ${c.yellow(stats.activeLimits)}`);
    console.log(`  Total Detected:  ${stats.totalDetected}`);
    console.log(`  Total Expired:   ${stats.totalExpired}`);
    console.log(`  Last 24h:        ${stats.recentLimits24h}`);
    console.log();

    if (activeLimits.length > 0) {
      console.log(c.bold('Active Rate Limits\n'));

      const headers = ['Account', 'Type', 'Detected', 'Expires In', 'Source'];
      const widths = [20, 18, 20, 15, 15];

      console.log(c.dim(headers.map((h, i) => h.padEnd(widths[i])).join(' ')));
      console.log(c.dim('-'.repeat(widths.reduce((a, b) => a + b + 1, 0))));

      for (const limit of activeLimits) {
        const row = [
          limit.accountId.slice(0, widths[0] - 1).padEnd(widths[0]),
          limit.type.padEnd(widths[1]),
          new Date(limit.detectedAt).toLocaleTimeString().padEnd(widths[2]),
          formatDuration(limit.getTimeUntilExpiry()).padEnd(widths[3]),
          limit.source.padEnd(widths[4])
        ];
        console.log(row.join(' '));
      }
      console.log();
    }

    // Show by type
    if (options.verbose) {
      console.log(c.bold('By Type\n'));
      for (const [type, count] of Object.entries(stats.byType)) {
        console.log(`  ${type}: ${count}`);
      }
      console.log();
    }

  } catch (error) {
    console.log(c.red(`\nError: ${error.message}\n`));
  }
}

/**
 * Clear rate limit for account
 */
async function clearRateLimit(accountId) {
  const c = await getChalk();

  if (!accountId) {
    console.log(c.red('\nError: Account ID is required.\n'));
    return;
  }

  try {
    const tracker = getRateLimitTracker();

    if (!tracker.isLimited(accountId)) {
      console.log(c.yellow(`\nAccount "${accountId}" is not rate limited.\n`));
      return;
    }

    tracker.clearLimit(accountId);
    console.log(c.green(`\n✓ Rate limit cleared for: ${accountId}\n`));

  } catch (error) {
    console.log(c.red(`\nError: ${error.message}\n`));
  }
}

/**
 * Show routing statistics
 */
async function routingStats(options = {}) {
  const c = await getChalk();

  try {
    const router = getAccountRouter();
    const stats = router.getStats();
    const sessionStats = router.getSessionStats();

    console.log(c.bold('\nRouting Statistics\n'));

    console.log(`  Total Routed:     ${stats.totalRouted}`);
    console.log(`  Active Sessions:  ${stats.activeSessions}`);
    console.log(`  User Preferences: ${stats.userPreferences}`);
    console.log(`  Failovers:        ${c.yellow(stats.failovers)}`);
    console.log(`  No Account Avail: ${c.red(stats.noAccountAvailable)}`);
    console.log();

    // By reason
    console.log(c.bold('By Routing Reason\n'));
    for (const [reason, count] of Object.entries(stats.byReason)) {
      if (count > 0) {
        console.log(`  ${reason}: ${count}`);
      }
    }
    console.log();

    // Session stats
    if (options.verbose) {
      console.log(c.bold('Session Statistics\n'));
      console.log(`  Total Sessions:      ${sessionStats.totalSessions}`);
      console.log(`  Active (last hour):  ${sessionStats.activeInLastHour}`);
      console.log(`  Avg Requests/Session: ${sessionStats.averageRequestsPerSession.toFixed(1)}`);
      console.log();

      if (Object.keys(sessionStats.sessionsByAccount).length > 0) {
        console.log(c.bold('Sessions by Account\n'));
        for (const [accountId, count] of Object.entries(sessionStats.sessionsByAccount)) {
          console.log(`  ${accountId}: ${count}`);
        }
        console.log();
      }
    }

  } catch (error) {
    console.log(c.red(`\nError: ${error.message}\n`));
  }
}

/**
 * Reset statistics
 */
async function resetStats() {
  const c = await getChalk();

  try {
    const proxy = getProxyServer();
    const lb = getLoadBalancer();
    const tracker = getRateLimitTracker();
    const router = getAccountRouter();

    proxy.resetStats();
    tracker.reset();
    router.reset();

    // Reset account stats
    for (const account of lb.getAllAccounts()) {
      lb.resetStats(account.id);
    }

    console.log(c.green('\n✓ All statistics reset.\n'));

  } catch (error) {
    console.log(c.red(`\nError: ${error.message}\n`));
  }
}

/**
 * Show help
 */
async function showHelp() {
  const c = await getChalk();

  console.log(c.bold('\nProxy Commands\n'));

  console.log(c.cyan('  start'));
  console.log('    Start the proxy server');
  console.log(c.dim('    Options: --port, --host, --no-cors, --no-log, --verbose, --daemon'));
  console.log();

  console.log(c.cyan('  stop'));
  console.log('    Stop the proxy server');
  console.log();

  console.log(c.cyan('  status'));
  console.log('    Show proxy server status');
  console.log(c.dim('    Options: --verbose'));
  console.log();

  console.log(c.cyan('  account add <id>'));
  console.log('    Add an account to the load balancer');
  console.log(c.dim('    Options: --api-key, --priority, --weight'));
  console.log();

  console.log(c.cyan('  account remove <id>'));
  console.log('    Remove an account from the load balancer');
  console.log(c.dim('    Options: --force'));
  console.log();

  console.log(c.cyan('  account list'));
  console.log('    List all accounts');
  console.log(c.dim('    Options: --verbose'));
  console.log();

  console.log(c.cyan('  account enable/disable <id>'));
  console.log('    Enable or disable an account');
  console.log();

  console.log(c.cyan('  strategy <name>'));
  console.log('    Set load balancing strategy');
  console.log(c.dim('    Strategies: round-robin, least-connections, weighted, session-sticky, random'));
  console.log();

  console.log(c.cyan('  ratelimit status'));
  console.log('    Show rate limit status');
  console.log(c.dim('    Options: --verbose'));
  console.log();

  console.log(c.cyan('  ratelimit clear <id>'));
  console.log('    Clear rate limit for an account');
  console.log();

  console.log(c.cyan('  routing'));
  console.log('    Show routing statistics');
  console.log(c.dim('    Options: --verbose'));
  console.log();

  console.log(c.cyan('  reset'));
  console.log('    Reset all statistics');
  console.log();

  console.log(c.bold('Examples:\n'));
  console.log(c.dim('  dragon-ui-claude-cli proxy start --port 8787'));
  console.log(c.dim('  dragon-ui-claude-cli proxy account add main --api-key sk-xxx --priority 100'));
  console.log(c.dim('  dragon-ui-claude-cli proxy account add backup --api-key sk-yyy --priority 50'));
  console.log(c.dim('  dragon-ui-claude-cli proxy strategy session-sticky'));
  console.log(c.dim('  dragon-ui-claude-cli proxy status --verbose'));
  console.log();
}

/**
 * Register proxy commands
 * @param {Command} program - Commander program
 */
function registerCommands(program) {
  const proxy = program
    .command('proxy')
    .description('Manage proxy server and load balancing')
    .addHelpText('after', `
Examples:
  dragon-ui-claude-cli proxy start
    Start the proxy server on default port

  dragon-ui-claude-cli proxy account add main --api-key sk-xxx
    Add an account to the load balancer

  dragon-ui-claude-cli proxy status --verbose
    Show detailed proxy status
`);

  proxy
    .command('start')
    .description('Start the proxy server')
    .option('-p, --port <port>', 'Port to listen on', PROXY_CONFIG.port.toString())
    .option('-h, --host <host>', 'Host to bind to', PROXY_CONFIG.host)
    .option('--no-cors', 'Disable CORS headers')
    .option('--no-log', 'Disable request logging')
    .option('-v, --verbose', 'Verbose output')
    .option('-d, --daemon', 'Run as daemon (don\'t block)')
    .action(startProxy);

  proxy
    .command('stop')
    .description('Stop the proxy server')
    .action(stopProxy);

  proxy
    .command('status')
    .description('Show proxy server status')
    .option('-v, --verbose', 'Show detailed information')
    .action(proxyStatus);

  // Account subcommands
  const account = proxy
    .command('account')
    .description('Manage load balancer accounts');

  account
    .command('add <id>')
    .description('Add an account')
    .option('-k, --api-key <key>', 'API key for the account')
    .option('-p, --priority <n>', 'Priority (0-100)', '50')
    .option('-w, --weight <n>', 'Weight for weighted distribution', '1')
    .action(addAccount);

  account
    .command('remove <id>')
    .description('Remove an account')
    .option('-f, --force', 'Skip confirmation')
    .action(removeAccount);

  account
    .command('list')
    .description('List all accounts')
    .option('-v, --verbose', 'Show detailed information')
    .action(listAccounts);

  account
    .command('enable <id>')
    .description('Enable an account')
    .action((id) => toggleAccount(id, true));

  account
    .command('disable <id>')
    .description('Disable an account')
    .action((id) => toggleAccount(id, false));

  proxy
    .command('strategy <name>')
    .description('Set load balancing strategy')
    .action(setStrategy);

  // Rate limit subcommands
  const ratelimit = proxy
    .command('ratelimit')
    .description('Manage rate limits');

  ratelimit
    .command('status')
    .description('Show rate limit status')
    .option('-v, --verbose', 'Show detailed information')
    .action(rateLimitStatus);

  ratelimit
    .command('clear <id>')
    .description('Clear rate limit for an account')
    .action(clearRateLimit);

  proxy
    .command('routing')
    .description('Show routing statistics')
    .option('-v, --verbose', 'Show detailed information')
    .action(routingStats);

  proxy
    .command('reset')
    .description('Reset all statistics')
    .action(resetStats);

  proxy
    .command('help')
    .description('Show proxy help')
    .action(showHelp);

  return proxy;
}

module.exports = {
  registerCommands,
  startProxy,
  stopProxy,
  proxyStatus,
  addAccount,
  removeAccount,
  listAccounts,
  toggleAccount,
  setStrategy,
  rateLimitStatus,
  clearRateLimit,
  routingStats,
  resetStats,
  showHelp
};
