/**
 * Analytics CLI Commands for Dragon-UI
 * Terminal-based analytics and visualization
 *
 * @module cli/commands/analytics
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
  if (value >= 1000000) {
    return (value / 1000000).toFixed(2) + 'M';
  }
  if (value >= 1000) {
    return (value / 1000).toFixed(1) + 'K';
  }
  return value.toLocaleString();
}

/**
 * Format percentage
 * @param {number} value
 * @returns {string}
 */
function formatPercent(value) {
  if (typeof value !== 'number' || isNaN(value)) return '0%';
  const sign = value >= 0 ? '+' : '';
  return sign + value.toFixed(1) + '%';
}

/**
 * Generate ASCII bar
 * @param {number} value
 * @param {number} max
 * @param {number} width
 * @returns {string}
 */
function generateBar(value, max, width = 30) {
  if (max === 0) return '';
  const filled = Math.round((value / max) * width);
  return '█'.repeat(filled) + '░'.repeat(width - filled);
}

/**
 * Generate sparkline
 * @param {Array} values
 * @returns {string}
 */
function generateSparkline(values) {
  if (!values || values.length === 0) return '';

  const chars = '▁▂▃▄▅▆▇█';
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  return values.map(v => {
    const index = Math.floor(((v - min) / range) * (chars.length - 1));
    return chars[Math.max(0, Math.min(chars.length - 1, index))];
  }).join('');
}

/**
 * Print section header
 * @param {string} title
 */
function printHeader(title) {
  console.log();
  console.log(chalk.bold.cyan('═'.repeat(60)));
  console.log(chalk.bold.cyan(`  ${title}`));
  console.log(chalk.bold.cyan('═'.repeat(60)));
}

/**
 * Print sub-header
 * @param {string} title
 */
function printSubHeader(title) {
  console.log();
  console.log(chalk.bold.white(`── ${title} ──`));
}

/**
 * Register analytics commands
 * @param {Command} program
 */
function registerCommands(program) {
  const analytics = program
    .command('analytics')
    .description('View analytics and usage statistics')
    .option('-d, --days <days>', 'Number of days to analyze', '30')
    .option('--json', 'Output as JSON')
    .action(async (options) => {
      await showDashboard(options);
    });

  analytics
    .command('summary')
    .description('Show summary statistics')
    .option('-d, --days <days>', 'Number of days', '30')
    .option('--json', 'Output as JSON')
    .action(async (options) => {
      await showSummary(options);
    });

  analytics
    .command('models')
    .description('Show model breakdown')
    .option('-d, --days <days>', 'Number of days', '30')
    .option('-s, --sort <field>', 'Sort by: cost, tokens, requests, sessions', 'cost')
    .option('--json', 'Output as JSON')
    .action(async (options) => {
      await showModelBreakdown(options);
    });

  analytics
    .command('tokens')
    .description('Show token breakdown')
    .option('-d, --days <days>', 'Number of days', '30')
    .option('--json', 'Output as JSON')
    .action(async (options) => {
      await showTokenBreakdown(options);
    });

  analytics
    .command('timeseries')
    .description('Show time series data')
    .option('-d, --days <days>', 'Number of days', '30')
    .option('-m, --metric <metric>', 'Metric: cost, tokens, sessions, requests', 'cost')
    .option('-p, --period <period>', 'Period: hour, day, week, month', 'day')
    .option('--json', 'Output as JSON')
    .action(async (options) => {
      await showTimeSeries(options);
    });

  analytics
    .command('projects')
    .description('Show project breakdown')
    .option('-d, --days <days>', 'Number of days', '30')
    .option('--json', 'Output as JSON')
    .action(async (options) => {
      await showProjects(options);
    });

  analytics
    .command('sessions')
    .description('Show session statistics')
    .option('-d, --days <days>', 'Number of days', '30')
    .option('-l, --limit <limit>', 'Number of sessions to show', '20')
    .option('--json', 'Output as JSON')
    .action(async (options) => {
      await showSessions(options);
    });

  analytics
    .command('export')
    .description('Export analytics data to JSON file')
    .argument('<file>', 'Output file path')
    .option('-d, --days <days>', 'Number of days', '30')
    .action(async (file, options) => {
      await exportAnalytics(file, options);
    });
}

/**
 * Get analytics dashboard instance
 * @returns {Object}
 */
async function getAnalyticsDashboard() {
  const path = require('path');
  const DatabaseService = require('../../services/database.cjs');
  const { getAnalyticsDashboard } = require('../../services/analytics-dashboard.cjs');

  const dbPath = path.join(process.cwd(), 'usage.db');
  const db = new DatabaseService(dbPath);
  return getAnalyticsDashboard(db);
}

/**
 * Show full dashboard
 * @param {Object} options
 */
async function showDashboard(options) {
  const days = parseInt(options.days, 10);

  try {
    const dashboard = await getAnalyticsDashboard();
    const data = dashboard.getDashboardData({ days });

    if (options.json) {
      console.log(JSON.stringify(data, null, 2));
      return;
    }

    printHeader(`Analytics Dashboard (${days} days)`);

    // Summary cards
    const summary = data.summary.current;
    const comparison = data.summary.comparison;

    console.log();
    console.log(chalk.bold('  Quick Stats'));
    console.log(chalk.dim('  ─────────────────────────────────────────────'));

    const costColor = comparison.costChange >= 0 ? chalk.red : chalk.green;
    const tokenColor = comparison.tokenChange >= 0 ? chalk.yellow : chalk.green;
    const sessionColor = comparison.sessionChange >= 0 ? chalk.blue : chalk.dim;

    console.log(`  ${chalk.bold('Total Cost:')}     ${chalk.green(formatCurrency(summary.cost))} ${costColor(formatPercent(comparison.costChange))}`);
    console.log(`  ${chalk.bold('Total Tokens:')}   ${chalk.yellow(formatTokens(summary.tokens))} ${tokenColor(formatPercent(comparison.tokenChange))}`);
    console.log(`  ${chalk.bold('Sessions:')}       ${chalk.blue(summary.sessions)} ${sessionColor(formatPercent(comparison.sessionChange))}`);
    console.log(`  ${chalk.bold('Models Used:')}    ${chalk.magenta(summary.models)}`);
    console.log(`  ${chalk.bold('Active Days:')}    ${chalk.cyan(summary.activeDays)}`);

    // Cost trend sparkline
    if (data.timeSeries.cost && data.timeSeries.cost.values) {
      const sparkline = generateSparkline(data.timeSeries.cost.values);
      console.log();
      console.log(`  ${chalk.bold('Cost Trend:')}     ${chalk.green(sparkline)}`);
    }

    // Model breakdown (top 5)
    printSubHeader('Top Models by Cost');
    const topModels = data.modelBreakdown.models.slice(0, 5);
    const maxModelCost = topModels.length > 0 ? topModels[0].total_cost : 0;

    for (const model of topModels) {
      const bar = generateBar(model.total_cost, maxModelCost, 25);
      const name = (model.model || 'Unknown').padEnd(25);
      console.log(`  ${chalk.cyan(name)} ${chalk.green(bar)} ${formatCurrency(model.total_cost)}`);
    }

    // Token breakdown
    printSubHeader('Token Distribution');
    const tokens = data.tokenBreakdown.breakdown;
    const maxTokens = Math.max(
      tokens.input.count,
      tokens.output.count,
      tokens.cacheCreation.count,
      tokens.cacheRead.count
    );

    console.log(`  ${chalk.blue('Input:'.padEnd(16))} ${generateBar(tokens.input.count, maxTokens, 20)} ${formatTokens(tokens.input.count)} (${tokens.input.percentage}%)`);
    console.log(`  ${chalk.green('Output:'.padEnd(16))} ${generateBar(tokens.output.count, maxTokens, 20)} ${formatTokens(tokens.output.count)} (${tokens.output.percentage}%)`);
    console.log(`  ${chalk.yellow('Cache Create:'.padEnd(16))} ${generateBar(tokens.cacheCreation.count, maxTokens, 20)} ${formatTokens(tokens.cacheCreation.count)} (${tokens.cacheCreation.percentage}%)`);
    console.log(`  ${chalk.magenta('Cache Read:'.padEnd(16))} ${generateBar(tokens.cacheRead.count, maxTokens, 20)} ${formatTokens(tokens.cacheRead.count)} (${tokens.cacheRead.percentage}%)`);

    console.log();
    console.log(chalk.dim(`  Cache Efficiency: ${data.tokenBreakdown.metrics.cacheEfficiency}%`));
    console.log(chalk.dim(`  Input/Output Ratio: ${data.tokenBreakdown.metrics.inputOutputRatio}x`));

    console.log();
    console.log(chalk.dim(`  Generated at: ${new Date(data.generatedAt).toLocaleString()}`));

  } catch (error) {
    console.error(chalk.red('Error loading dashboard:'), error.message);
    process.exit(1);
  }
}

/**
 * Show summary statistics
 * @param {Object} options
 */
async function showSummary(options) {
  const days = parseInt(options.days, 10);

  try {
    const dashboard = await getAnalyticsDashboard();
    const summary = dashboard.getSummaryStats({ days });

    if (options.json) {
      console.log(JSON.stringify(summary, null, 2));
      return;
    }

    printHeader(`Summary Statistics (${days} days)`);

    const current = summary.current;
    const comparison = summary.comparison;

    console.log();
    console.log(chalk.bold('  Current Period'));
    console.log(chalk.dim('  ─────────────────────────────────────────────'));
    console.log(`  Total Cost:           ${chalk.green(formatCurrency(current.cost))}`);
    console.log(`  Total Tokens:         ${chalk.yellow(formatTokens(current.tokens))}`);
    console.log(`  Total Requests:       ${chalk.blue(current.requests.toLocaleString())}`);
    console.log(`  Total Sessions:       ${chalk.magenta(current.sessions.toLocaleString())}`);
    console.log(`  Models Used:          ${chalk.cyan(current.models)}`);
    console.log(`  Projects:             ${current.projects}`);
    console.log(`  Active Days:          ${current.activeDays}`);
    console.log(`  Avg Cost/Request:     ${formatCurrency(current.avgCostPerRequest)}`);

    console.log();
    console.log(chalk.bold('  Period Comparison'));
    console.log(chalk.dim('  ─────────────────────────────────────────────'));

    const costColor = comparison.costChange >= 0 ? chalk.red : chalk.green;
    const tokenColor = comparison.tokenChange >= 0 ? chalk.yellow : chalk.green;
    const sessionColor = comparison.sessionChange >= 0 ? chalk.blue : chalk.dim;

    console.log(`  Cost Change:          ${costColor(formatPercent(comparison.costChange))} (prev: ${formatCurrency(comparison.previousPeriod.cost)})`);
    console.log(`  Token Change:         ${tokenColor(formatPercent(comparison.tokenChange))} (prev: ${formatTokens(comparison.previousPeriod.tokens)})`);
    console.log(`  Session Change:       ${sessionColor(formatPercent(comparison.sessionChange))} (prev: ${comparison.previousPeriod.sessions})`);

    if (current.firstActivity) {
      console.log();
      console.log(chalk.dim(`  First Activity: ${new Date(current.firstActivity).toLocaleString()}`));
      console.log(chalk.dim(`  Last Activity:  ${new Date(current.lastActivity).toLocaleString()}`));
    }

  } catch (error) {
    console.error(chalk.red('Error loading summary:'), error.message);
    process.exit(1);
  }
}

/**
 * Show model breakdown
 * @param {Object} options
 */
async function showModelBreakdown(options) {
  const days = parseInt(options.days, 10);
  const sortBy = options.sort;

  try {
    const dashboard = await getAnalyticsDashboard();
    const breakdown = dashboard.getModelBreakdown({ days, sortBy });

    if (options.json) {
      console.log(JSON.stringify(breakdown, null, 2));
      return;
    }

    printHeader(`Model Breakdown (${days} days)`);

    console.log();
    console.log(chalk.bold('  Model Usage by ' + sortBy.toUpperCase()));
    console.log(chalk.dim('  ─────────────────────────────────────────────────────────────────────'));

    // Table header
    console.log(chalk.dim('  ' +
      'Model'.padEnd(30) +
      'Cost'.padStart(12) +
      'Tokens'.padStart(12) +
      'Requests'.padStart(10) +
      'Sessions'.padStart(10) +
      '%'.padStart(8)
    ));
    console.log(chalk.dim('  ' + '─'.repeat(82)));

    for (const model of breakdown.models) {
      const name = (model.model || 'Unknown').substring(0, 29).padEnd(30);
      const cost = formatCurrency(model.total_cost).padStart(12);
      const tokens = formatTokens(model.total_tokens).padStart(12);
      const requests = (model.request_count || 0).toString().padStart(10);
      const sessions = (model.session_count || 0).toString().padStart(10);
      const percent = (model.cost_percentage + '%').padStart(8);

      console.log(`  ${chalk.cyan(name)}${chalk.green(cost)}${chalk.yellow(tokens)}${chalk.blue(requests)}${chalk.magenta(sessions)}${chalk.dim(percent)}`);
    }

    console.log(chalk.dim('  ' + '─'.repeat(82)));
    console.log(`  ${chalk.bold('TOTAL'.padEnd(30))}${chalk.green(formatCurrency(breakdown.totals.cost).padStart(12))}${chalk.yellow(formatTokens(breakdown.totals.tokens).padStart(12))}${chalk.blue(breakdown.totals.requests.toString().padStart(10))}`);

  } catch (error) {
    console.error(chalk.red('Error loading model breakdown:'), error.message);
    process.exit(1);
  }
}

/**
 * Show token breakdown
 * @param {Object} options
 */
async function showTokenBreakdown(options) {
  const days = parseInt(options.days, 10);

  try {
    const dashboard = await getAnalyticsDashboard();
    const breakdown = dashboard.getTokenBreakdown({ days });

    if (options.json) {
      console.log(JSON.stringify(breakdown, null, 2));
      return;
    }

    printHeader(`Token Breakdown (${days} days)`);

    const tokens = breakdown.breakdown;
    const totals = breakdown.totals;
    const metrics = breakdown.metrics;

    console.log();
    console.log(chalk.bold('  Token Distribution'));
    console.log(chalk.dim('  ─────────────────────────────────────────────'));

    const maxCount = Math.max(
      tokens.input.count,
      tokens.output.count,
      tokens.cacheCreation.count,
      tokens.cacheRead.count
    );

    console.log(`  ${chalk.blue('Input Tokens:'.padEnd(20))} ${generateBar(tokens.input.count, maxCount, 25)} ${formatTokens(tokens.input.count).padStart(10)} (${tokens.input.percentage}%)`);
    console.log(`  ${chalk.green('Output Tokens:'.padEnd(20))} ${generateBar(tokens.output.count, maxCount, 25)} ${formatTokens(tokens.output.count).padStart(10)} (${tokens.output.percentage}%)`);
    console.log(`  ${chalk.yellow('Cache Creation:'.padEnd(20))} ${generateBar(tokens.cacheCreation.count, maxCount, 25)} ${formatTokens(tokens.cacheCreation.count).padStart(10)} (${tokens.cacheCreation.percentage}%)`);
    console.log(`  ${chalk.magenta('Cache Read:'.padEnd(20))} ${generateBar(tokens.cacheRead.count, maxCount, 25)} ${formatTokens(tokens.cacheRead.count).padStart(10)} (${tokens.cacheRead.percentage}%)`);

    console.log();
    console.log(chalk.bold('  Summary'));
    console.log(chalk.dim('  ─────────────────────────────────────────────'));
    console.log(`  Total Tokens:         ${chalk.yellow(formatTokens(totals.total))}`);
    console.log(`  Total Requests:       ${chalk.blue(totals.requests.toLocaleString())}`);
    console.log(`  Total Sessions:       ${chalk.magenta(totals.sessions.toLocaleString())}`);
    console.log(`  Avg Tokens/Request:   ${formatTokens(totals.avgPerRequest)}`);

    console.log();
    console.log(chalk.bold('  Cache Metrics'));
    console.log(chalk.dim('  ─────────────────────────────────────────────'));
    console.log(`  Cache Efficiency:     ${metrics.cacheEfficiency}%`);
    console.log(`  Cache Hit Rate:       ${metrics.cacheHitRate}%`);
    console.log(`  Input/Output Ratio:   ${metrics.inputOutputRatio}x`);

  } catch (error) {
    console.error(chalk.red('Error loading token breakdown:'), error.message);
    process.exit(1);
  }
}

/**
 * Show time series data
 * @param {Object} options
 */
async function showTimeSeries(options) {
  const days = parseInt(options.days, 10);
  const metric = options.metric;
  const period = options.period;

  try {
    const dashboard = await getAnalyticsDashboard();
    const series = dashboard.getTimeSeries({ period, metric, days });

    if (options.json) {
      console.log(JSON.stringify(series, null, 2));
      return;
    }

    printHeader(`Time Series: ${metric.toUpperCase()} (${period}ly, ${days} days)`);

    const stats = series.statistics;

    console.log();
    console.log(chalk.bold('  Statistics'));
    console.log(chalk.dim('  ─────────────────────────────────────────────'));
    console.log(`  Total:      ${metric === 'cost' ? formatCurrency(stats.total) : formatTokens(stats.total)}`);
    console.log(`  Average:    ${metric === 'cost' ? formatCurrency(stats.average) : formatTokens(stats.average)}`);
    console.log(`  Min:        ${metric === 'cost' ? formatCurrency(stats.min) : formatTokens(stats.min)}`);
    console.log(`  Max:        ${metric === 'cost' ? formatCurrency(stats.max) : formatTokens(stats.max)}`);
    console.log(`  Trend:      ${stats.trendDirection} (${stats.trend >= 0 ? '+' : ''}${stats.trend})`);

    // Sparkline
    console.log();
    console.log(chalk.bold('  Trend Chart'));
    console.log(`  ${generateSparkline(series.values)}`);

    // Recent data table
    printSubHeader('Recent Data');

    const recentData = series.raw.slice(-10);
    const maxValue = Math.max(...series.values);

    for (const entry of recentData) {
      const value = metric === 'cost' ? entry.total_cost : entry.total_tokens;
      const bar = generateBar(value, maxValue, 30);
      const label = entry.period.padEnd(12);
      const formatted = metric === 'cost' ? formatCurrency(value) : formatTokens(value);

      console.log(`  ${chalk.cyan(label)} ${chalk.green(bar)} ${formatted.padStart(12)}`);
    }

  } catch (error) {
    console.error(chalk.red('Error loading time series:'), error.message);
    process.exit(1);
  }
}

/**
 * Show project breakdown
 * @param {Object} options
 */
async function showProjects(options) {
  const days = parseInt(options.days, 10);

  try {
    const dashboard = await getAnalyticsDashboard();
    const performance = dashboard.getAccountPerformance({ days });

    if (options.json) {
      console.log(JSON.stringify(performance.projects, null, 2));
      return;
    }

    printHeader(`Project Breakdown (${days} days)`);

    console.log();
    console.log(chalk.bold('  Projects by Cost'));
    console.log(chalk.dim('  ─────────────────────────────────────────────────────────────────'));

    // Table header
    console.log(chalk.dim('  ' +
      'Project'.padEnd(35) +
      'Cost'.padStart(12) +
      'Tokens'.padStart(12) +
      'Sessions'.padStart(10) +
      '%'.padStart(8)
    ));
    console.log(chalk.dim('  ' + '─'.repeat(77)));

    const maxCost = performance.projects.length > 0 ? performance.projects[0].cost : 0;

    for (const project of performance.projects) {
      const name = (project.name || 'Unknown').substring(0, 34).padEnd(35);
      const cost = formatCurrency(project.cost).padStart(12);
      const tokens = formatTokens(project.tokens).padStart(12);
      const sessions = project.sessions.toString().padStart(10);
      const percent = (project.cost_percentage + '%').padStart(8);

      console.log(`  ${chalk.cyan(name)}${chalk.green(cost)}${chalk.yellow(tokens)}${chalk.magenta(sessions)}${chalk.dim(percent)}`);
    }

    console.log();
    console.log(chalk.dim(`  Total: ${performance.projects.length} projects`));

  } catch (error) {
    console.error(chalk.red('Error loading projects:'), error.message);
    process.exit(1);
  }
}

/**
 * Show session statistics
 * @param {Object} options
 */
async function showSessions(options) {
  const days = parseInt(options.days, 10);
  const limit = parseInt(options.limit, 10);

  try {
    const dashboard = await getAnalyticsDashboard();
    const performance = dashboard.getAccountPerformance({ days });

    if (options.json) {
      console.log(JSON.stringify(performance.sessions.slice(0, limit), null, 2));
      return;
    }

    printHeader(`Session Statistics (${days} days)`);

    const summary = performance.summary;

    console.log();
    console.log(chalk.bold('  Summary'));
    console.log(chalk.dim('  ─────────────────────────────────────────────'));
    console.log(`  Total Sessions:       ${chalk.blue(summary.totalSessions)}`);
    console.log(`  Total Cost:           ${chalk.green(formatCurrency(summary.totalCost))}`);
    console.log(`  Total Duration:       ${chalk.yellow(summary.totalDuration)} min`);
    console.log(`  Avg Cost/Session:     ${formatCurrency(parseFloat(summary.avgCostPerSession))}`);
    console.log(`  Avg Duration/Session: ${summary.avgDurationPerSession} min`);
    console.log(`  Avg Cost/Minute:      ${formatCurrency(parseFloat(summary.avgCostPerMinute))}`);

    printSubHeader(`Top ${limit} Sessions by Cost`);

    // Table header
    console.log(chalk.dim('  ' +
      'Session ID'.padEnd(20) +
      'Cost'.padStart(10) +
      'Tokens'.padStart(10) +
      'Duration'.padStart(10) +
      'Requests'.padStart(10)
    ));
    console.log(chalk.dim('  ' + '─'.repeat(60)));

    const topSessions = performance.sessions.slice(0, limit);

    for (const session of topSessions) {
      const id = (session.session_id || 'Unknown').substring(0, 19).padEnd(20);
      const cost = formatCurrency(session.total_cost).padStart(10);
      const tokens = formatTokens(session.total_tokens).padStart(10);
      const duration = (session.duration_minutes + 'm').padStart(10);
      const requests = session.request_count.toString().padStart(10);

      console.log(`  ${chalk.cyan(id)}${chalk.green(cost)}${chalk.yellow(tokens)}${chalk.blue(duration)}${chalk.dim(requests)}`);
    }

  } catch (error) {
    console.error(chalk.red('Error loading sessions:'), error.message);
    process.exit(1);
  }
}

/**
 * Export analytics to JSON file
 * @param {string} file
 * @param {Object} options
 */
async function exportAnalytics(file, options) {
  const days = parseInt(options.days, 10);

  try {
    const dashboard = await getAnalyticsDashboard();
    const filePath = dashboard.exportToJSON(file, { days });

    console.log(chalk.green(`Analytics exported to: ${filePath}`));

  } catch (error) {
    console.error(chalk.red('Error exporting analytics:'), error.message);
    process.exit(1);
  }
}

module.exports = {
  registerCommands
};
