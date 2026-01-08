/**
 * Live Monitoring Dashboard
 * Real-time usage tracking with auto-refresh
 */

const { calculateSessionBurnRate, getContextIndicator, formatBurnRate } = require('../utils/burn-rate.cjs');
const { calculateSessionProjections, formatCostProjection, getBlockTimeRemaining, formatMinutes } = require('../utils/projections.cjs');

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
        magenta: identity, blue: identity, hex: () => identity, dim: identity
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

// Frame rate limiting
const MIN_RENDER_INTERVAL = 100; // 10fps max for terminal
let lastRenderTime = 0;
let frameCount = 0;

/**
 * Sleep utility
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Clear screen and move cursor to top
 */
function clearScreen() {
  process.stdout.write('\x1b[2J\x1b[H');
}

/**
 * Format token count
 */
function formatTokens(tokens) {
  if (tokens >= 1000000) {
    return `${(tokens / 1000000).toFixed(2)}M`;
  }
  if (tokens >= 1000) {
    return `${(tokens / 1000).toFixed(1)}k`;
  }
  return tokens.toString();
}

/**
 * Format duration
 */
function formatDuration(minutes) {
  if (minutes < 1) return '< 1m';
  if (minutes < 60) return `${Math.round(minutes)}m`;

  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  return `${hours}h ${mins}m`;
}

/**
 * Get current time formatted
 */
function getCurrentTime() {
  return new Date().toLocaleTimeString('en-US', { hour12: false });
}

/**
 * Render dashboard header
 */
async function renderHeader(chalk, interval, running) {
  const time = getCurrentTime();
  const status = running ? chalk.green('LIVE') : chalk.red('STOPPED');

  console.log(chalk.bold.hex('#e94560')('┌─────────────────────────────────────────────────────────────────┐'));
  console.log(chalk.bold.hex('#e94560')(`│ 🐲 Dragon UI - Live Monitoring              ${status} [${interval / 1000}s] ${time} │`));
  console.log(chalk.bold.hex('#e94560')('├─────────────────────────────────────────────────────────────────┤'));
}

/**
 * Render session info
 */
async function renderSessionInfo(chalk, sessionData, burnRate) {
  const sessionId = sessionData.sessionId || 'N/A';
  const model = sessionData.model || 'claude-sonnet-4.5';
  const duration = formatDuration(burnRate.durationMinutes || 0);

  const truncatedId = sessionId.length > 8 ? sessionId.substring(0, 8) + '...' : sessionId;

  console.log(`│ Session: ${chalk.cyan(truncatedId.padEnd(15))} Model: ${chalk.white(model.padEnd(20))} │`);
  console.log(`│ Duration: ${chalk.yellow(duration.padEnd(10))} Burn Rate: ${burnRate.indicator.icon} ${chalk.white(formatBurnRate(burnRate.tokensPerMinute).padEnd(15))} │`);
  console.log(chalk.gray('├─────────────────────────────────────────────────────────────────┤'));
}

/**
 * Render token info
 */
async function renderTokenInfo(chalk, sessionData, contextIndicator) {
  const tokensIn = formatTokens(sessionData.tokensIn || 0);
  const tokensOut = formatTokens(sessionData.tokensOut || 0);
  const tokensCached = formatTokens(sessionData.tokensCached || 0);
  const tokensTotal = formatTokens((sessionData.tokensIn || 0) + (sessionData.tokensOut || 0));

  const contextUsed = sessionData.contextUsed || ((sessionData.tokensIn || 0) + (sessionData.tokensOut || 0));
  const contextMax = 160000; // Usable context
  const contextPercent = Math.round((contextUsed / contextMax) * 100);

  console.log(`│ ${chalk.bold('Tokens:')}                                                          │`);
  console.log(`│   Input: ${chalk.blue(tokensIn.padEnd(10))} Output: ${chalk.magenta(tokensOut.padEnd(10))} Cached: ${chalk.gray(tokensCached.padEnd(10))} │`);
  console.log(`│   Total: ${chalk.yellow(tokensTotal.padEnd(10))} Context: ${contextIndicator.icon} ${chalk.white(`${contextPercent}%`.padEnd(5))} (${formatTokens(contextUsed)} / ${formatTokens(contextMax)}) │`);
  console.log(chalk.gray('├─────────────────────────────────────────────────────────────────┤'));
}

/**
 * Render cost info
 */
async function renderCostInfo(chalk, sessionData, projections) {
  const sessionCost = `$${(sessionData.cost || 0).toFixed(2)}`;
  const perHour = formatCostProjection(projections.perHourCost);
  const blockProjected = formatCostProjection(projections.blockProjection);

  console.log(`│ ${chalk.bold('Cost:')}                                                            │`);
  console.log(`│   Session: ${chalk.green(sessionCost.padEnd(10))} Per Hour: ${chalk.yellow(perHour.padEnd(10))} Block Proj: ${chalk.cyan(blockProjected.padEnd(8))} │`);
  console.log(chalk.gray('├─────────────────────────────────────────────────────────────────┤'));
}

/**
 * Render block info
 */
async function renderBlockInfo(chalk, projections) {
  const blockTime = getBlockTimeRemaining();

  console.log(`│ ${chalk.bold('5-Hour Block:')}                                                    │`);
  console.log(`│   ${blockTime.blockLabel.padEnd(30)} Remaining: ${chalk.yellow(blockTime.formatted.padEnd(10))} │`);

  if (projections.contextExhaustion && !projections.contextExhaustion.exhausted) {
    console.log(`│   Context Exhaustion: ${chalk.red(`~${projections.contextExhaustion.formatted}`.padEnd(15))} at current rate       │`);
  }

  console.log(chalk.gray('├─────────────────────────────────────────────────────────────────┤'));
}

/**
 * Render footer
 */
async function renderFooter(chalk, frameCount) {
  console.log(`│ Press ${chalk.bold('Ctrl+C')} to exit                            Frame: ${String(frameCount).padStart(6)} │`);
  console.log(chalk.bold.hex('#e94560')('└─────────────────────────────────────────────────────────────────┘'));
}

/**
 * Render full dashboard
 */
async function renderDashboard(sessionData, interval, running = true) {
  const chalk = await getChalk();

  // Calculate metrics
  const burnRate = calculateSessionBurnRate(sessionData);
  const projections = calculateSessionProjections(sessionData);
  const contextUsed = sessionData.contextUsed || ((sessionData.tokensIn || 0) + (sessionData.tokensOut || 0));
  const contextIndicator = getContextIndicator(contextUsed, 160000);

  // Clear and render
  clearScreen();

  await renderHeader(chalk, interval, running);
  await renderSessionInfo(chalk, sessionData, burnRate);
  await renderTokenInfo(chalk, sessionData, contextIndicator);
  await renderCostInfo(chalk, sessionData, projections);
  await renderBlockInfo(chalk, projections);
  await renderFooter(chalk, frameCount);

  frameCount++;
}

/**
 * Fetch live data from data adapter
 */
async function fetchLiveData(dataAdapter) {
  try {
    const activeData = await dataAdapter.getActiveData();

    return {
      sessionId: activeData.sessionId || activeData.currentSessionId,
      model: activeData.model || 'claude-sonnet-4.5',
      startTime: activeData.startTime || activeData.sessionStart || new Date(),
      tokensIn: activeData.tokensIn || activeData.inputTokens || 0,
      tokensOut: activeData.tokensOut || activeData.outputTokens || 0,
      tokensCached: activeData.tokensCached || activeData.cachedTokens || 0,
      cost: activeData.cost || activeData.sessionCost || 0,
      contextUsed: activeData.contextUsed || activeData.totalTokens || 0
    };
  } catch (error) {
    // Return mock data if database unavailable
    return {
      sessionId: 'demo-session',
      model: 'claude-sonnet-4.5',
      startTime: new Date(Date.now() - 30 * 60 * 1000), // 30 min ago
      tokensIn: 45000,
      tokensOut: 12000,
      tokensCached: 8500,
      cost: 2.45,
      contextUsed: 57000
    };
  }
}

/**
 * Start live monitoring dashboard
 */
async function startLiveDashboard(options = {}) {
  const chalk = await getChalk();
  const interval = options.interval || 2000;
  const compact = options.compact || false;

  let running = true;
  let dataAdapter = null;

  // Try to initialize data adapter
  try {
    const CLIDataAdapter = require('../data-adapter.cjs');
    dataAdapter = new CLIDataAdapter({});
    await dataAdapter.init();
  } catch (error) {
    console.log(chalk.yellow('Warning: Using demo data (database unavailable)'));
    await sleep(2000);
  }

  // Handle Ctrl+C gracefully
  const exitHandler = async () => {
    running = false;
    clearScreen();

    console.log(chalk.yellow('\n[Live] Dashboard stopped\n'));

    // Show session summary
    try {
      const finalData = await fetchLiveData(dataAdapter);
      const burnRate = calculateSessionBurnRate(finalData);

      console.log(chalk.bold('Session Summary:'));
      console.log(`  Duration:     ${formatDuration(burnRate.durationMinutes)}`);
      console.log(`  Total Tokens: ${formatTokens(burnRate.totalTokens)}`);
      console.log(`  Total Cost:   $${(burnRate.totalCost || 0).toFixed(2)}`);
      console.log(`  Avg Burn:     ${formatBurnRate(burnRate.tokensPerMinute)}`);
      console.log();
    } catch {
      // Silent fail on summary
    }

    process.exit(0);
  };

  process.on('SIGINT', exitHandler);
  process.on('SIGTERM', exitHandler);

  // Main loop
  while (running) {
    const now = Date.now();

    // Frame rate limiting
    if (now - lastRenderTime >= MIN_RENDER_INTERVAL) {
      lastRenderTime = now;

      try {
        const data = await fetchLiveData(dataAdapter);
        await renderDashboard(data, interval, running);
      } catch (error) {
        console.log(chalk.red(`Error: ${error.message}`));
      }
    }

    await sleep(interval);
  }
}

/**
 * Show live dashboard help
 */
async function showLiveHelp() {
  const chalk = await getChalk();

  console.log(chalk.bold('\n=== Live Monitoring Dashboard ===\n'));

  console.log('  dragon-ui-claude-cli live');
  console.log(chalk.gray('    Start live monitoring with default 2s refresh\n'));

  console.log('  dragon-ui-claude-cli live --interval <ms>');
  console.log(chalk.gray('    Set custom refresh interval in milliseconds\n'));

  console.log('  dragon-ui-claude-cli live --compact');
  console.log(chalk.gray('    Use compact display mode\n'));

  console.log(chalk.bold('During monitoring:'));
  console.log('  Press Ctrl+C to stop and show session summary\n');

  console.log(chalk.bold('Indicators:'));
  console.log('  🔥 High burn rate (> 1000 tokens/min)');
  console.log('  ⚡ Moderate burn rate (500-1000 tokens/min)');
  console.log('  ⏱️  Low burn rate (100-500 tokens/min)');
  console.log('  💤 Idle (< 100 tokens/min)');
  console.log();
  console.log('  🟢 Context < 50%');
  console.log('  🟡 Context 50-80%');
  console.log('  🟠 Context 80-90%');
  console.log('  🔴 Context > 90%');
  console.log();
}

module.exports = {
  startLiveDashboard,
  showLiveHelp,
  renderDashboard,
  fetchLiveData
};
