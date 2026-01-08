/**
 * OAuth CLI Commands for Dragon-UI
 * Manage OAuth authentication from the command line
 *
 * @module cli/commands/oauth
 */

'use strict';

const { getOAuthService, CONFIG } = require('../../services/oauth-service.cjs');

let chalk;
async function getChalk() {
  if (!chalk) {
    chalk = (await import('chalk')).default;
  }
  return chalk;
}

/**
 * Format time duration
 * @param {number} ms - Duration in milliseconds
 * @returns {string}
 */
function formatDuration(ms) {
  if (!ms || ms < 0) return 'N/A';

  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

/**
 * Format date for display
 * @param {string} date
 * @returns {string}
 */
function formatDate(date) {
  if (!date) return 'N/A';
  return new Date(date).toLocaleString();
}

/**
 * Get health status color
 * @param {string} status
 * @param {Function} c - Chalk instance
 * @returns {Function}
 */
function getHealthColor(status, c) {
  switch (status) {
    case 'healthy': return c.green;
    case 'expiring': return c.yellow;
    case 'expired': return c.red;
    case 'error': return c.red;
    default: return c.gray;
  }
}

/**
 * Start OAuth login flow
 */
async function login(accountId, options = {}) {
  const c = await getChalk();

  const effectiveAccountId = accountId || 'default';

  console.log(c.bold('\nStarting OAuth Login\n'));

  try {
    const service = getOAuthService();

    // Check if already authenticated
    const existingToken = service.getToken(effectiveAccountId);
    if (existingToken && !existingToken.isExpired()) {
      console.log(c.yellow(`Account "${effectiveAccountId}" already has a valid token.`));
      console.log(c.dim('Use --force to re-authenticate\n'));

      if (!options.force) {
        return;
      }
    }

    // Start callback server
    console.log(c.dim('Starting local callback server...'));
    await service.startCallbackServer();

    // Start auth flow
    const { authUrl, session } = await service.startAuthFlow({
      accountId: effectiveAccountId,
      scopes: options.scopes ? options.scopes.split(',') : ['read', 'write']
    });

    console.log(c.green('\nAuthorization URL generated.\n'));
    console.log(c.bold('Open this URL in your browser:'));
    console.log(c.cyan(authUrl));
    console.log();

    // Try to open browser automatically
    if (!options.noBrowser) {
      try {
        const { exec } = require('child_process');
        const openCommand = process.platform === 'win32' ? 'start' :
                           process.platform === 'darwin' ? 'open' : 'xdg-open';
        exec(`${openCommand} "${authUrl}"`);
        console.log(c.dim('Opening browser...'));
      } catch {
        console.log(c.dim('Please open the URL manually.'));
      }
    }

    console.log(c.dim('\nWaiting for authorization...'));
    console.log(c.dim('Press Ctrl+C to cancel.\n'));

    // Wait for callback
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        console.log(c.red('\nAuthorization timeout. Please try again.\n'));
        service.stopCallbackServer();
        resolve();
      }, 5 * 60 * 1000); // 5 minute timeout

      service.once('oauth_success', (token) => {
        clearTimeout(timeout);
        console.log(c.green(`\nAuthorization successful for account: ${token.accountId}\n`));
        console.log(`  Token Type:  ${token.tokenType}`);
        console.log(`  Expires At:  ${formatDate(token.expiresAt)}`);
        console.log(`  Scope:       ${token.scope || 'N/A'}`);
        console.log();
        service.stopCallbackServer();
        resolve();
      });

      service.once('oauth_error', (error) => {
        clearTimeout(timeout);
        console.log(c.red(`\nAuthorization failed: ${error.message || error}\n`));
        service.stopCallbackServer();
        resolve();
      });
    });

  } catch (error) {
    console.log(c.red(`Error: ${error.message}\n`));
  }
}

/**
 * Refresh an OAuth token
 */
async function refresh(accountId, options = {}) {
  const c = await getChalk();

  const effectiveAccountId = accountId || 'default';

  console.log(c.bold(`\nRefreshing Token for: ${effectiveAccountId}\n`));

  try {
    const service = getOAuthService();

    const token = service.getToken(effectiveAccountId);
    if (!token) {
      console.log(c.red(`No token found for account: ${effectiveAccountId}`));
      console.log(c.dim('Use "oauth login" to authenticate first.\n'));
      return;
    }

    console.log(c.dim('Refreshing token...'));

    const newToken = await service.refreshToken(effectiveAccountId);

    console.log(c.green('\nToken refreshed successfully!\n'));
    console.log(`  New Expiry: ${formatDate(newToken.expiresAt)}`);
    console.log(`  Valid For:  ${formatDuration(newToken.getTimeUntilExpiry())}`);
    console.log();

  } catch (error) {
    console.log(c.red(`\nRefresh failed: ${error.message}\n`));
  }
}

/**
 * Show OAuth status for all accounts
 */
async function status(options = {}) {
  const c = await getChalk();

  try {
    const service = getOAuthService();
    const healthStatuses = service.getAllTokenHealth();

    if (healthStatuses.length === 0) {
      console.log(c.yellow('\nNo OAuth tokens configured.\n'));
      console.log(c.dim('Use "oauth login <account-id>" to authenticate.\n'));
      return;
    }

    console.log(c.bold(`\nOAuth Token Status (${healthStatuses.length})\n`));

    // Table header
    const headers = ['Account', 'Status', 'Expires', 'Time Left', 'Last Refresh'];
    const widths = [20, 12, 22, 12, 22];

    console.log(c.dim(headers.map((h, i) => h.padEnd(widths[i])).join(' ')));
    console.log(c.dim('-'.repeat(widths.reduce((a, b) => a + b + 1, 0))));

    for (const health of healthStatuses) {
      const statusColor = getHealthColor(health.status, c);
      const statusIcon = health.status === 'healthy' ? '●' :
                        health.status === 'expiring' ? '◐' :
                        health.status === 'expired' ? '○' : '✕';

      const row = [
        health.accountId.slice(0, widths[0] - 1).padEnd(widths[0]),
        statusColor(`${statusIcon} ${health.status}`.padEnd(widths[1])),
        (formatDate(health.expiresAt) || 'N/A').slice(0, widths[2] - 1).padEnd(widths[2]),
        formatDuration(health.timeUntilExpiry).padEnd(widths[3]),
        (formatDate(health.lastRefreshAt) || 'Never').slice(0, widths[4] - 1).padEnd(widths[4])
      ];

      console.log(row.join(' '));

      if (health.lastRefreshError && options.verbose) {
        console.log(c.red(`    Error: ${health.lastRefreshError}`));
      }
    }

    console.log();

  } catch (error) {
    console.log(c.red(`Error: ${error.message}\n`));
  }
}

/**
 * Show token details for an account
 */
async function showToken(accountId, options = {}) {
  const c = await getChalk();

  const effectiveAccountId = accountId || 'default';

  try {
    const service = getOAuthService();
    const token = service.getToken(effectiveAccountId);

    if (!token) {
      console.log(c.red(`\nNo token found for account: ${effectiveAccountId}\n`));
      return;
    }

    const health = service.getTokenHealth(effectiveAccountId);
    const statusColor = getHealthColor(health.status, c);

    console.log(c.bold(`\nOAuth Token: ${effectiveAccountId}\n`));

    console.log(`  Status:        ${statusColor(health.status)}`);
    console.log(`  Token Type:    ${token.tokenType}`);
    console.log(`  Scope:         ${token.scope || 'N/A'}`);
    console.log(`  Created:       ${formatDate(token.createdAt)}`);
    console.log(`  Expires:       ${formatDate(token.expiresAt)}`);
    console.log(`  Time Left:     ${formatDuration(health.timeUntilExpiry)}`);
    console.log(`  Last Refresh:  ${formatDate(token.lastRefreshAt) || 'Never'}`);

    if (token.lastRefreshError) {
      console.log(c.red(`\n  Last Error:    ${token.lastRefreshError}`));
    }

    if (options.showToken) {
      console.log(c.dim(`\n  Access Token:  ${token.accessToken.slice(0, 20)}...`));
      if (token.refreshToken) {
        console.log(c.dim(`  Refresh Token: ${token.refreshToken.slice(0, 20)}...`));
      }
    }

    console.log();

  } catch (error) {
    console.log(c.red(`Error: ${error.message}\n`));
  }
}

/**
 * Revoke an OAuth token
 */
async function revoke(accountId, options = {}) {
  const c = await getChalk();

  const effectiveAccountId = accountId || 'default';

  try {
    const service = getOAuthService();

    const token = service.getToken(effectiveAccountId);
    if (!token) {
      console.log(c.red(`\nNo token found for account: ${effectiveAccountId}\n`));
      return;
    }

    // Confirm unless forced
    if (!options.force) {
      console.log(c.yellow(`\nWarning: This will revoke the OAuth token for "${effectiveAccountId}"`));
      console.log(c.dim('Use --force to skip confirmation\n'));

      const readline = require('readline');
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });

      const answer = await new Promise(resolve => {
        rl.question('Type "revoke" to confirm: ', answer => {
          rl.close();
          resolve(answer);
        });
      });

      if (answer.toLowerCase() !== 'revoke') {
        console.log(c.dim('\nRevocation cancelled.\n'));
        return;
      }
    }

    console.log(c.dim('\nRevoking token...'));

    const success = await service.revokeToken(effectiveAccountId);

    if (success) {
      console.log(c.green(`\nToken revoked for account: ${effectiveAccountId}\n`));
    } else {
      console.log(c.red(`\nFailed to revoke token.\n`));
    }

  } catch (error) {
    console.log(c.red(`Error: ${error.message}\n`));
  }
}

/**
 * Show database info
 */
async function showInfo() {
  const c = await getChalk();

  try {
    const service = getOAuthService();
    const info = service.getDbInfo();

    console.log(c.bold('\nOAuth Database Info\n'));

    console.log(`  Database Path:   ${info.dbPath}`);
    console.log(`  Total Tokens:    ${info.totalTokens}`);
    console.log(`  Healthy Tokens:  ${c.green(info.healthyTokens)}`);
    console.log(`  Active Sessions: ${info.activeSessions}`);
    console.log();

  } catch (error) {
    console.log(c.red(`Error: ${error.message}\n`));
  }
}

/**
 * Start health check daemon
 */
async function startHealthCheck() {
  const c = await getChalk();

  try {
    const service = getOAuthService();
    service.startHealthCheck();

    console.log(c.green('\nHealth check daemon started.\n'));
    console.log(c.dim(`Checking tokens every ${CONFIG.HEALTH_CHECK_INTERVAL / 60000} minutes.`));
    console.log(c.dim('Tokens will be auto-refreshed 30 minutes before expiry.\n'));

  } catch (error) {
    console.log(c.red(`Error: ${error.message}\n`));
  }
}

/**
 * Show help
 */
async function showHelp() {
  const c = await getChalk();

  console.log(c.bold('\nOAuth Commands\n'));

  console.log(c.cyan('  login [account-id]'));
  console.log('    Start OAuth login flow for an account');
  console.log(c.dim('    Options: --scopes, --force, --no-browser'));
  console.log();

  console.log(c.cyan('  refresh [account-id]'));
  console.log('    Manually refresh a token');
  console.log();

  console.log(c.cyan('  status'));
  console.log('    Show status of all OAuth tokens');
  console.log(c.dim('    Options: --verbose'));
  console.log();

  console.log(c.cyan('  show [account-id]'));
  console.log('    Show token details for an account');
  console.log(c.dim('    Options: --show-token'));
  console.log();

  console.log(c.cyan('  revoke [account-id]'));
  console.log('    Revoke an OAuth token');
  console.log(c.dim('    Options: --force'));
  console.log();

  console.log(c.cyan('  info'));
  console.log('    Show OAuth database info');
  console.log();

  console.log(c.cyan('  health-check'));
  console.log('    Start health check daemon');
  console.log();

  console.log(c.bold('Examples:\n'));
  console.log(c.dim('  dragon-ui-claude-cli oauth login my-account'));
  console.log(c.dim('  dragon-ui-claude-cli oauth status'));
  console.log(c.dim('  dragon-ui-claude-cli oauth refresh my-account'));
  console.log(c.dim('  dragon-ui-claude-cli oauth revoke my-account --force'));
  console.log();
}

/**
 * Register OAuth commands
 * @param {Command} program - Commander program
 */
function registerCommands(program) {
  const oauth = program
    .command('oauth')
    .description('Manage OAuth authentication')
    .addHelpText('after', `
Examples:
  dragon-ui-claude-cli oauth login
    Start OAuth login for default account

  dragon-ui-claude-cli oauth login my-account
    Start OAuth login for specific account

  dragon-ui-claude-cli oauth status
    Show status of all OAuth tokens

  dragon-ui-claude-cli oauth refresh my-account
    Refresh token for specific account

  dragon-ui-claude-cli oauth revoke my-account --force
    Revoke and delete OAuth token
`);

  oauth
    .command('login [account-id]')
    .description('Start OAuth login flow')
    .option('--scopes <scopes>', 'Comma-separated list of scopes', 'read,write')
    .option('-f, --force', 'Force re-authentication')
    .option('--no-browser', 'Don\'t open browser automatically')
    .action(login);

  oauth
    .command('refresh [account-id]')
    .description('Manually refresh a token')
    .action(refresh);

  oauth
    .command('status')
    .description('Show status of all OAuth tokens')
    .option('-v, --verbose', 'Show detailed information')
    .action(status);

  oauth
    .command('show [account-id]')
    .description('Show token details')
    .option('--show-token', 'Show token values (sensitive!)')
    .action(showToken);

  oauth
    .command('revoke [account-id]')
    .description('Revoke an OAuth token')
    .option('-f, --force', 'Skip confirmation')
    .action(revoke);

  oauth
    .command('info')
    .description('Show OAuth database info')
    .action(showInfo);

  oauth
    .command('health-check')
    .description('Start health check daemon')
    .action(startHealthCheck);

  oauth
    .command('help')
    .description('Show OAuth help')
    .action(showHelp);

  return oauth;
}

module.exports = {
  registerCommands,
  login,
  refresh,
  status,
  showToken,
  revoke,
  showInfo,
  startHealthCheck,
  showHelp
};
