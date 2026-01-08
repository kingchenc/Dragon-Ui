'use strict';

/**
 * Blocks CLI Command
 * Shows 5-hour usage blocks with live monitoring support
 */

const chalk = require('chalk');

/**
 * Register blocks command with Commander
 */
function registerBlocksCommand(program, services) {
  const blocks = program
    .command('blocks')
    .description('Show 5-hour usage blocks')
    .option('-n, --count <number>', 'Number of blocks to show', '5')
    .option('-l, --live', 'Enable live monitoring mode')
    .option('-i, --interval <seconds>', 'Refresh interval for live mode', '30')
    .option('--no-color', 'Disable color output')
    .option('--json', 'Output as JSON')
    .option('--compact', 'Compact output mode')
    .action(async (options) => {
      await handleBlocks(options, services);
    });

  return blocks;
}

/**
 * Handle blocks command
 */
async function handleBlocks(options, services) {
  const count = Math.min(parseInt(options.count, 10) || 5, 20);
  const interval = parseInt(options.interval, 10) || 30;

  if (options.live) {
    await runLiveMode(options, services, count, interval);
  } else {
    await showBlocks(options, services, count);
  }
}

/**
 * Show blocks (non-live mode)
 */
async function showBlocks(options, services, count) {
  const coreDataService = services.coreDataService;

  try {
    let blocks = [];

    if (coreDataService) {
      const data = await coreDataService.getTabData('daily');
      blocks = (data.blocks || []).slice(0, count);
    }

    if (options.json) {
      console.log(JSON.stringify({ blocks }, null, 2));
      return;
    }

    if (blocks.length === 0) {
      console.log(chalk.yellow('No usage blocks found.'));
      return;
    }

    console.log('');
    console.log(chalk.bold('5-Hour Usage Blocks'));
    console.log('═'.repeat(60));
    console.log('');

    renderBlocksTable(blocks, options);

  } catch (error) {
    console.error(chalk.red('Error:'), error.message);
    process.exit(1);
  }
}

/**
 * Render blocks table
 */
function renderBlocksTable(blocks, options) {
  const compact = options.compact;

  // Header
  if (!compact) {
    console.log(
      chalk.gray('Block Start'.padEnd(20)) +
      chalk.gray('Duration'.padEnd(12)) +
      chalk.gray('Tokens'.padEnd(15)) +
      chalk.gray('Cost'.padEnd(12)) +
      chalk.gray('Status')
    );
    console.log('─'.repeat(70));
  }

  for (const block of blocks) {
    const startTime = formatTime(block.startTime || block.start);
    const duration = formatDuration(block.duration);
    const tokens = formatTokens(block.tokens || block.totalTokens || 0);
    const cost = formatCost(block.cost || block.totalCost || 0);
    const status = getBlockStatus(block);

    if (compact) {
      console.log(`${startTime} │ ${tokens} │ ${cost} │ ${status}`);
    } else {
      console.log(
        chalk.white(startTime.padEnd(20)) +
        chalk.cyan(duration.padEnd(12)) +
        chalk.yellow(tokens.padEnd(15)) +
        chalk.green(cost.padEnd(12)) +
        status
      );
    }
  }

  console.log('');
}

/**
 * Run live mode
 */
async function runLiveMode(options, services, count, interval) {
  const coreDataService = services.coreDataService;

  console.log(chalk.cyan('Starting live monitoring mode...'));
  console.log(chalk.gray(`Refreshing every ${interval} seconds. Press Ctrl+C to exit.`));
  console.log('');

  let running = true;

  // Handle Ctrl+C
  process.on('SIGINT', () => {
    running = false;
    console.log('\n' + chalk.yellow('Stopping live monitoring...'));
    process.exit(0);
  });

  // Initial render
  await renderLive(coreDataService, count, options);

  // Refresh loop
  while (running) {
    await sleep(interval * 1000);
    if (!running) break;

    // Clear screen and re-render
    clearScreen();
    await renderLive(coreDataService, count, options);
  }
}

/**
 * Render live view
 */
async function renderLive(coreDataService, count, options) {
  const now = new Date().toLocaleTimeString();

  console.log(chalk.bold.cyan(`5-Hour Usage Blocks (Live)`));
  console.log(chalk.gray(`Last update: ${now}`));
  console.log('═'.repeat(70));
  console.log('');

  try {
    let blocks = [];
    let activeSession = null;

    if (coreDataService) {
      const dailyData = await coreDataService.getTabData('daily');
      blocks = (dailyData.blocks || []).slice(0, count);

      const activeData = await coreDataService.getTabData('active');
      activeSession = activeData;
    }

    // Show current session info
    if (activeSession && activeSession.status !== 'idle') {
      console.log(chalk.bold.white('Current Session'));
      console.log('─'.repeat(40));

      const sessionCost = formatCost(activeSession.currentCost || 0);
      const sessionTokens = formatTokens(activeSession.tokensUsed || 0);
      const sessionDuration = activeSession.duration || '0m';
      const burnRate = getBurnRateIndicator(activeSession.burnRate || 0);

      console.log(`  Status: ${chalk.green('Active')} ${burnRate}`);
      console.log(`  Duration: ${chalk.cyan(sessionDuration)}`);
      console.log(`  Tokens: ${chalk.yellow(sessionTokens)}`);
      console.log(`  Cost: ${chalk.green(sessionCost)}`);

      if (activeSession.timeLeft) {
        console.log(`  Block Time Left: ${chalk.magenta(activeSession.timeLeft)}`);
      }

      console.log('');
    }

    // Show blocks
    if (blocks.length > 0) {
      console.log(chalk.bold.white('Recent Blocks'));
      console.log('─'.repeat(40));
      renderBlocksTable(blocks, options);
    } else {
      console.log(chalk.yellow('No usage blocks found.'));
    }

    // Show projections
    await renderProjections(coreDataService);

  } catch (error) {
    console.error(chalk.red('Error:'), error.message);
  }
}

/**
 * Render projections
 */
async function renderProjections(coreDataService) {
  try {
    const { UsageProjections } = require('../../services/usage-projections.cjs');

    const projections = new UsageProjections();
    const blockProjection = projections.projectToEndOfBlock();
    const hourlyProjection = projections.projectNextHour();

    console.log(chalk.bold.white('Projections'));
    console.log('─'.repeat(40));
    console.log(`  End of block: ${chalk.yellow(formatTokens(blockProjection.tokens))} / ${chalk.green(formatCost(blockProjection.cost))}`);
    console.log(`  Next hour: ${chalk.yellow(formatTokens(hourlyProjection.tokens))} / ${chalk.green(formatCost(hourlyProjection.cost))}`);
    console.log('');

  } catch (error) {
    // Projections not available
  }
}

/**
 * Get block status indicator
 */
function getBlockStatus(block) {
  const isActive = block.active || block.isActive;
  const isComplete = block.complete || block.isComplete;

  if (isActive) {
    return chalk.green('● Active');
  } else if (isComplete) {
    return chalk.gray('○ Complete');
  } else {
    return chalk.yellow('◐ Partial');
  }
}

/**
 * Get burn rate indicator
 */
function getBurnRateIndicator(rate) {
  if (rate > 1000) {
    return chalk.red('🔥');
  } else if (rate > 500) {
    return chalk.yellow('⚡');
  } else {
    return chalk.gray('⏱️');
  }
}

/**
 * Format time
 */
function formatTime(time) {
  if (!time) return 'N/A';

  try {
    const date = new Date(time);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return String(time);
  }
}

/**
 * Format duration
 */
function formatDuration(duration) {
  if (!duration) return 'N/A';

  if (typeof duration === 'number') {
    const hours = Math.floor(duration / 3600000);
    const minutes = Math.floor((duration % 3600000) / 60000);
    return `${hours}h ${minutes}m`;
  }

  return String(duration);
}

/**
 * Format tokens
 */
function formatTokens(tokens) {
  if (typeof tokens !== 'number') return '0';

  if (tokens >= 1000000) {
    return (tokens / 1000000).toFixed(2) + 'M';
  } else if (tokens >= 1000) {
    return (tokens / 1000).toFixed(1) + 'k';
  }

  return tokens.toString();
}

/**
 * Format cost
 */
function formatCost(cost) {
  if (typeof cost !== 'number') return '$0.00';
  return '$' + cost.toFixed(2);
}

/**
 * Clear screen
 */
function clearScreen() {
  process.stdout.write('\x1b[2J\x1b[H');
}

/**
 * Sleep helper
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = {
  registerBlocksCommand
};
