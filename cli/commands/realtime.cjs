/**
 * Real-time Dashboard CLI Commands for Dragon-UI
 * Live monitoring and SSE server management
 *
 * @module cli/commands/realtime
 */

'use strict';

const chalk = require('chalk');
const { Command } = require('commander');

/**
 * Format currency value
 * @param {number} value
 * @returns {string}
 */
function formatCurrency(value) {
  if (typeof value !== 'number' || isNaN(value)) return '$0.00';
  return '$' + value.toFixed(4);
}

/**
 * Format token count
 * @param {number} value
 * @returns {string}
 */
function formatTokens(value) {
  if (typeof value !== 'number' || isNaN(value)) return '0';
  if (value >= 1000000) return (value / 1000000).toFixed(2) + 'M';
  if (value >= 1000) return (value / 1000).toFixed(1) + 'K';
  return value.toLocaleString();
}

/**
 * Print header
 * @param {string} title
 */
function printHeader(title) {
  console.log();
  console.log(chalk.bold.cyan('═'.repeat(60)));
  console.log(chalk.bold.cyan(`  ${title}`));
  console.log(chalk.bold.cyan('═'.repeat(60)));
}

/**
 * Register realtime commands
 * @param {Command} program
 */
function registerCommands(program) {
  const realtime = program
    .command('realtime')
    .description('Real-time dashboard and monitoring')
    .action(() => {
      showHelp();
    });

  realtime
    .command('start')
    .description('Start the real-time dashboard server')
    .option('-p, --port <port>', 'Server port', '3001')
    .option('-H, --host <host>', 'Server host', '127.0.0.1')
    .option('-r, --refresh <ms>', 'Refresh interval in ms', '30000')
    .option('--open', 'Open dashboard in browser')
    .action(async (options) => {
      await startServer(options);
    });

  realtime
    .command('stop')
    .description('Stop the real-time dashboard server')
    .action(async () => {
      await stopServer();
    });

  realtime
    .command('status')
    .description('Show server status')
    .option('--json', 'Output as JSON')
    .action(async (options) => {
      await showStatus(options);
    });

  realtime
    .command('stats')
    .description('Show current real-time statistics')
    .option('--json', 'Output as JSON')
    .action(async (options) => {
      await showStats(options);
    });

  realtime
    .command('watch')
    .description('Watch live events in terminal')
    .option('-c, --count <count>', 'Number of events to show', '20')
    .action(async (options) => {
      await watchEvents(options);
    });

  realtime
    .command('history')
    .description('Show stats history')
    .option('-c, --count <count>', 'Number of snapshots', '20')
    .option('--json', 'Output as JSON')
    .action(async (options) => {
      await showHistory(options);
    });
}

/**
 * Show help
 */
function showHelp() {
  printHeader('Real-time Dashboard');

  console.log();
  console.log(chalk.bold('  Available Commands:'));
  console.log(chalk.dim('  ───────────────────────────────────────────'));
  console.log(`  ${chalk.cyan('realtime start')}     Start the dashboard server`);
  console.log(`  ${chalk.cyan('realtime stop')}      Stop the dashboard server`);
  console.log(`  ${chalk.cyan('realtime status')}    Show server status`);
  console.log(`  ${chalk.cyan('realtime stats')}     Show current statistics`);
  console.log(`  ${chalk.cyan('realtime watch')}     Watch live events`);
  console.log(`  ${chalk.cyan('realtime history')}   Show stats history`);

  console.log();
  console.log(chalk.bold('  Options:'));
  console.log(chalk.dim('  ───────────────────────────────────────────'));
  console.log(`  ${chalk.cyan('-p, --port <port>')}  Server port (default: 3001)`);
  console.log(`  ${chalk.cyan('-H, --host <host>')}  Server host (default: 127.0.0.1)`);
  console.log(`  ${chalk.cyan('--open')}             Open dashboard in browser`);

  console.log();
  console.log(chalk.bold('  Dashboard URL:'));
  console.log(chalk.dim('  ───────────────────────────────────────────'));
  console.log(`  ${chalk.green('http://127.0.0.1:3001')}`);
  console.log();
}

/**
 * Get dashboard instance
 * @param {Object} options
 * @returns {Object}
 */
function getDashboard(options = {}) {
  const { getRealtimeDashboard } = require('../../services/realtime-dashboard.cjs');
  return getRealtimeDashboard({
    port: parseInt(options.port || '3001', 10),
    host: options.host || '127.0.0.1',
    refreshInterval: parseInt(options.refresh || '30000', 10)
  });
}

/**
 * Start the server
 * @param {Object} options
 */
async function startServer(options) {
  const port = parseInt(options.port, 10);
  const host = options.host;

  try {
    const dashboard = getDashboard(options);

    console.log(chalk.cyan(`Starting real-time dashboard server on ${host}:${port}...`));

    await dashboard.start();

    console.log();
    console.log(chalk.green('Real-time Dashboard Started'));
    console.log(chalk.dim('───────────────────────────────────────────'));
    console.log(`  ${chalk.bold('URL:')}     ${chalk.cyan(`http://${host}:${port}`)}`);
    console.log(`  ${chalk.bold('Events:')} ${chalk.cyan(`http://${host}:${port}/events`)}`);
    console.log(`  ${chalk.bold('Stats:')}  ${chalk.cyan(`http://${host}:${port}/stats`)}`);
    console.log(`  ${chalk.bold('Health:')} ${chalk.cyan(`http://${host}:${port}/health`)}`);
    console.log();
    console.log(chalk.dim('Press Ctrl+C to stop the server'));

    // Open browser if requested
    if (options.open) {
      const url = `http://${host}:${port}`;
      try {
        const { exec } = require('child_process');
        const platform = process.platform;
        let cmd;

        if (platform === 'win32') {
          cmd = `start ${url}`;
        } else if (platform === 'darwin') {
          cmd = `open ${url}`;
        } else {
          cmd = `xdg-open ${url}`;
        }

        exec(cmd, (error) => {
          if (error) {
            console.log(chalk.yellow(`Could not open browser automatically. Please visit: ${url}`));
          }
        });
      } catch (e) {
        console.log(chalk.yellow(`Could not open browser. Please visit: ${url}`));
      }
    }

    // Keep process running
    process.on('SIGINT', async () => {
      console.log();
      console.log(chalk.yellow('Stopping server...'));
      await dashboard.stop();
      process.exit(0);
    });

    // Keep alive
    await new Promise(() => {});

  } catch (error) {
    console.error(chalk.red('Error starting server:'), error.message);
    process.exit(1);
  }
}

/**
 * Stop the server
 */
async function stopServer() {
  try {
    const dashboard = getDashboard();
    await dashboard.stop();
    console.log(chalk.green('Real-time dashboard server stopped'));
  } catch (error) {
    console.error(chalk.red('Error stopping server:'), error.message);
    process.exit(1);
  }
}

/**
 * Show server status
 * @param {Object} options
 */
async function showStatus(options) {
  try {
    const dashboard = getDashboard();
    const state = dashboard.getState();

    if (options.json) {
      console.log(JSON.stringify(state, null, 2));
      return;
    }

    printHeader('Real-time Dashboard Status');

    const stateColor = state.state === 'running' ? chalk.green : chalk.yellow;

    console.log();
    console.log(`  ${chalk.bold('State:')}    ${stateColor(state.state)}`);
    console.log(`  ${chalk.bold('Host:')}     ${chalk.cyan(state.host)}:${chalk.cyan(state.port)}`);
    console.log(`  ${chalk.bold('Clients:')} ${chalk.blue(state.clients)}`);

    if (state.stats) {
      console.log();
      console.log(chalk.bold('  Statistics:'));
      console.log(chalk.dim('  ───────────────────────────────────────────'));
      console.log(`  Uptime:           ${chalk.cyan(state.stats.uptimeFormatted)}`);
      console.log(`  Total Requests:   ${chalk.blue(state.stats.requests.total)}`);
      console.log(`  Success Rate:     ${chalk.green(state.stats.successRate)}%`);
      console.log(`  Active Requests:  ${chalk.yellow(state.stats.activeRequests)}`);
    }

  } catch (error) {
    console.error(chalk.red('Error getting status:'), error.message);
    process.exit(1);
  }
}

/**
 * Show current stats
 * @param {Object} options
 */
async function showStats(options) {
  try {
    const dashboard = getDashboard();
    const stats = dashboard.stats.getSnapshot();

    if (options.json) {
      console.log(JSON.stringify(stats, null, 2));
      return;
    }

    printHeader('Real-time Statistics');

    console.log();
    console.log(chalk.bold('  Request Statistics'));
    console.log(chalk.dim('  ───────────────────────────────────────────'));
    console.log(`  Total:       ${chalk.blue(stats.requests.total)}`);
    console.log(`  Success:     ${chalk.green(stats.requests.success)}`);
    console.log(`  Failed:      ${chalk.red(stats.requests.failed)}`);
    console.log(`  Pending:     ${chalk.yellow(stats.requests.pending)}`);
    console.log(`  Req/Min:     ${chalk.cyan(stats.requestsPerMinute)}`);
    console.log(`  Success %:   ${chalk.green(stats.successRate)}%`);

    console.log();
    console.log(chalk.bold('  Token Statistics'));
    console.log(chalk.dim('  ───────────────────────────────────────────'));
    console.log(`  Input:       ${chalk.blue(formatTokens(stats.tokens.input))}`);
    console.log(`  Output:      ${chalk.green(formatTokens(stats.tokens.output))}`);
    console.log(`  Cached:      ${chalk.yellow(formatTokens(stats.tokens.cached))}`);

    console.log();
    console.log(chalk.bold('  Response Time'));
    console.log(chalk.dim('  ───────────────────────────────────────────'));
    console.log(`  Average:     ${chalk.cyan(stats.responseTime.avg)}ms`);
    console.log(`  Min:         ${chalk.green(stats.responseTime.min)}ms`);
    console.log(`  Max:         ${chalk.red(stats.responseTime.max)}ms`);

    console.log();
    console.log(chalk.bold('  Cost'));
    console.log(chalk.dim('  ───────────────────────────────────────────'));
    console.log(`  Total:       ${chalk.green(formatCurrency(stats.cost))}`);

    if (Object.keys(stats.byModel).length > 0) {
      console.log();
      console.log(chalk.bold('  By Model'));
      console.log(chalk.dim('  ───────────────────────────────────────────'));
      for (const [model, data] of Object.entries(stats.byModel)) {
        console.log(`  ${chalk.cyan(model.padEnd(25))} ${chalk.blue(data.count)} requests, ${chalk.green(formatCurrency(data.cost))}`);
      }
    }

    console.log();
    console.log(chalk.dim(`  Uptime: ${stats.uptimeFormatted}`));

  } catch (error) {
    console.error(chalk.red('Error getting stats:'), error.message);
    process.exit(1);
  }
}

/**
 * Watch live events
 * @param {Object} options
 */
async function watchEvents(options) {
  const count = parseInt(options.count, 10);

  try {
    const dashboard = getDashboard();

    console.log(chalk.cyan(`Watching live events (showing last ${count})...`));
    console.log(chalk.dim('Press Ctrl+C to stop'));
    console.log();

    // Show recent events first
    const recent = dashboard.eventStream.getRecentEvents(count);
    for (const event of recent) {
      printEvent(event);
    }

    // Subscribe to new events
    const subId = dashboard.eventStream.subscribe((event) => {
      printEvent(event);
    });

    // Handle exit
    process.on('SIGINT', () => {
      dashboard.eventStream.unsubscribe(subId);
      console.log();
      console.log(chalk.yellow('Stopped watching events'));
      process.exit(0);
    });

    // Keep alive
    await new Promise(() => {});

  } catch (error) {
    console.error(chalk.red('Error watching events:'), error.message);
    process.exit(1);
  }
}

/**
 * Print event to console
 * @param {Object} event
 */
function printEvent(event) {
  const time = new Date(event.timestamp).toLocaleTimeString();
  let typeColor;

  switch (event.type) {
    case 'request:start':
      typeColor = chalk.green;
      break;
    case 'request:complete':
      typeColor = chalk.blue;
      break;
    case 'request:fail':
      typeColor = chalk.red;
      break;
    case 'stats:update':
      typeColor = chalk.cyan;
      break;
    case 'rate:limit':
      typeColor = chalk.yellow;
      break;
    default:
      typeColor = chalk.dim;
  }

  const data = event.data;
  let info = '';

  if (data.model) info += ` model=${data.model}`;
  if (data.statusCode) info += ` status=${data.statusCode}`;
  if (data.duration) info += ` duration=${data.duration}ms`;
  if (data.cost) info += ` cost=${formatCurrency(data.cost)}`;

  console.log(`${chalk.dim(time)} ${typeColor(event.type.padEnd(18))}${chalk.dim(info)}`);
}

/**
 * Show stats history
 * @param {Object} options
 */
async function showHistory(options) {
  const count = parseInt(options.count, 10);

  try {
    const dashboard = getDashboard();
    const history = dashboard.stats.getHistory(count);

    if (options.json) {
      console.log(JSON.stringify(history, null, 2));
      return;
    }

    printHeader(`Stats History (Last ${count} Snapshots)`);

    if (history.length === 0) {
      console.log();
      console.log(chalk.yellow('  No history available yet'));
      return;
    }

    console.log();
    console.log(chalk.dim('  Time                 Requests  Success%  Cost        Tokens'));
    console.log(chalk.dim('  ─────────────────────────────────────────────────────────────'));

    for (const snapshot of history) {
      const time = new Date(snapshot.timestamp).toLocaleTimeString().padEnd(20);
      const requests = snapshot.requests.total.toString().padStart(8);
      const success = (snapshot.successRate + '%').padStart(9);
      const cost = formatCurrency(snapshot.cost).padStart(11);
      const tokens = formatTokens(snapshot.tokens.input + snapshot.tokens.output).padStart(10);

      console.log(`  ${chalk.dim(time)}${chalk.blue(requests)}${chalk.green(success)}${chalk.cyan(cost)}${chalk.yellow(tokens)}`);
    }

  } catch (error) {
    console.error(chalk.red('Error getting history:'), error.message);
    process.exit(1);
  }
}

module.exports = {
  registerCommands
};
