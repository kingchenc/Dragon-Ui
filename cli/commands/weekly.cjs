/**
 * Weekly Reports CLI Commands for Dragon-UI
 * Generate weekly usage reports and statistics
 *
 * @module cli/commands/weekly
 */

'use strict';

const path = require('path');
const fs = require('fs');

let chalk;
async function getChalk() {
  if (!chalk) {
    chalk = (await import('chalk')).default;
  }
  return chalk;
}

/**
 * Week start day options
 */
const WEEK_START = {
  SUNDAY: 0,
  MONDAY: 1,
  SATURDAY: 6
};

/**
 * Get ISO week number
 * @param {Date} date
 * @returns {number}
 */
function getISOWeekNumber(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

/**
 * Get week number with configurable start day
 * @param {Date} date
 * @param {number} startDay - 0=Sunday, 1=Monday
 * @returns {number}
 */
function getWeekNumber(date, startDay = WEEK_START.MONDAY) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);

  // Adjust for start day
  const dayOfWeek = d.getDay();
  const diff = (dayOfWeek < startDay ? 7 : 0) + dayOfWeek - startDay;

  // Get first day of week
  d.setDate(d.getDate() - diff);

  // Get first week of year
  const firstDayOfYear = new Date(d.getFullYear(), 0, 1);
  const firstDayOfWeek = firstDayOfYear.getDay();
  const firstWeekStart = new Date(firstDayOfYear);

  if (firstDayOfWeek !== startDay) {
    const daysToAdd = (startDay - firstDayOfWeek + 7) % 7;
    firstWeekStart.setDate(firstWeekStart.getDate() + daysToAdd);
  }

  const weekNum = Math.ceil(((d - firstWeekStart) / 86400000 + 1) / 7);
  return weekNum > 0 ? weekNum : 52;
}

/**
 * Get week bounds (start and end dates)
 * @param {Date} date
 * @param {number} startDay
 * @returns {Object}
 */
function getWeekBounds(date, startDay = WEEK_START.MONDAY) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);

  const dayOfWeek = d.getDay();
  const diff = (dayOfWeek < startDay ? 7 : 0) + dayOfWeek - startDay;

  const weekStart = new Date(d);
  weekStart.setDate(d.getDate() - diff);

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);

  return { start: weekStart, end: weekEnd };
}

/**
 * Format date for display
 * @param {Date} date
 * @returns {string}
 */
function formatDate(date) {
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric'
  });
}

/**
 * Format cost for display
 * @param {number} cost
 * @returns {string}
 */
function formatCost(cost) {
  if (cost >= 1) {
    return `$${cost.toFixed(2)}`;
  }
  return `$${cost.toFixed(4)}`;
}

/**
 * Format number with commas
 * @param {number} num
 * @returns {string}
 */
function formatNumber(num) {
  return num.toLocaleString();
}

/**
 * Format duration
 * @param {number} ms
 * @returns {string}
 */
function formatDuration(ms) {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  if (ms < 3600000) return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
  return `${Math.floor(ms / 3600000)}h ${Math.floor((ms % 3600000) / 60000)}m`;
}

/**
 * Get weekly data from database
 * @param {Object} db - Database instance
 * @param {Date} weekStart
 * @param {Date} weekEnd
 * @returns {Object}
 */
function getWeeklyData(db, weekStart, weekEnd) {
  const startTs = weekStart.getTime();
  const endTs = weekEnd.getTime();

  // Get sessions in this week
  const sessions = db.prepare(`
    SELECT
      session_id,
      model,
      start_time,
      end_time,
      total_input_tokens,
      total_output_tokens,
      total_cache_read_tokens,
      total_cache_creation_tokens,
      total_cost
    FROM sessions
    WHERE start_time >= ? AND start_time <= ?
    ORDER BY start_time ASC
  `).all(startTs, endTs);

  // Aggregate by day
  const dailyStats = {};
  const modelStats = {};

  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let totalCacheReadTokens = 0;
  let totalCost = 0;
  let totalSessions = 0;
  let totalDuration = 0;

  for (const session of sessions) {
    // Daily aggregation
    const dayKey = new Date(session.start_time).toISOString().split('T')[0];
    if (!dailyStats[dayKey]) {
      dailyStats[dayKey] = {
        date: dayKey,
        sessions: 0,
        inputTokens: 0,
        outputTokens: 0,
        cacheReadTokens: 0,
        cost: 0,
        duration: 0
      };
    }

    const inputTokens = session.total_input_tokens || 0;
    const outputTokens = session.total_output_tokens || 0;
    const cacheReadTokens = session.total_cache_read_tokens || 0;
    const cost = session.total_cost || 0;
    const duration = (session.end_time || Date.now()) - session.start_time;

    dailyStats[dayKey].sessions++;
    dailyStats[dayKey].inputTokens += inputTokens;
    dailyStats[dayKey].outputTokens += outputTokens;
    dailyStats[dayKey].cacheReadTokens += cacheReadTokens;
    dailyStats[dayKey].cost += cost;
    dailyStats[dayKey].duration += duration;

    // Model aggregation
    const model = session.model || 'unknown';
    if (!modelStats[model]) {
      modelStats[model] = {
        sessions: 0,
        inputTokens: 0,
        outputTokens: 0,
        cost: 0
      };
    }
    modelStats[model].sessions++;
    modelStats[model].inputTokens += inputTokens;
    modelStats[model].outputTokens += outputTokens;
    modelStats[model].cost += cost;

    // Totals
    totalInputTokens += inputTokens;
    totalOutputTokens += outputTokens;
    totalCacheReadTokens += cacheReadTokens;
    totalCost += cost;
    totalSessions++;
    totalDuration += duration;
  }

  return {
    weekStart,
    weekEnd,
    totalSessions,
    totalInputTokens,
    totalOutputTokens,
    totalCacheReadTokens,
    totalCost,
    totalDuration,
    dailyStats: Object.values(dailyStats),
    modelStats
  };
}

/**
 * Show weekly report
 */
async function showWeekly(options = {}) {
  const c = await getChalk();

  try {
    // Determine week start day
    const startDay = options.startOfWeek === 'sunday' ? WEEK_START.SUNDAY :
                     options.startOfWeek === 'saturday' ? WEEK_START.SATURDAY :
                     WEEK_START.MONDAY;

    // Determine which week to show
    let targetDate = new Date();
    if (options.week) {
      // Parse week specification (e.g., "2024-W01", "-1" for last week)
      if (options.week.startsWith('-')) {
        const weeksBack = parseInt(options.week.slice(1), 10);
        targetDate.setDate(targetDate.getDate() - (weeksBack * 7));
      } else if (options.week.includes('-W')) {
        const [year, weekStr] = options.week.split('-W');
        const weekNum = parseInt(weekStr, 10);
        targetDate = new Date(parseInt(year, 10), 0, 1 + (weekNum - 1) * 7);
      }
    }

    const { start: weekStart, end: weekEnd } = getWeekBounds(targetDate, startDay);
    const weekNum = getWeekNumber(weekStart, startDay);
    const isoWeek = getISOWeekNumber(weekStart);

    console.log(c.bold(`\nWeekly Report - Week ${weekNum} (ISO W${isoWeek.toString().padStart(2, '0')})\n`));
    console.log(`${formatDate(weekStart)} - ${formatDate(weekEnd)}`);
    console.log();

    // Load database
    const { getDatabase } = require('../../services/database.cjs');
    const db = getDatabase();

    if (!db) {
      console.log(c.yellow('No database available. Run some Claude sessions first.\n'));
      return;
    }

    const data = getWeeklyData(db, weekStart, weekEnd);

    if (data.totalSessions === 0) {
      console.log(c.yellow('No sessions found for this week.\n'));
      return;
    }

    // Summary section
    console.log(c.bold('Summary\n'));
    console.log(`  Sessions:       ${formatNumber(data.totalSessions)}`);
    console.log(`  Total Duration: ${formatDuration(data.totalDuration)}`);
    console.log(`  Input Tokens:   ${formatNumber(data.totalInputTokens)}`);
    console.log(`  Output Tokens:  ${formatNumber(data.totalOutputTokens)}`);
    console.log(`  Cache Tokens:   ${formatNumber(data.totalCacheReadTokens)}`);
    console.log(`  Total Cost:     ${c.green(formatCost(data.totalCost))}`);
    console.log();

    // Daily breakdown
    if (data.dailyStats.length > 0) {
      console.log(c.bold('Daily Breakdown\n'));

      const headers = ['Date', 'Sessions', 'Input', 'Output', 'Cache', 'Cost'];
      const widths = [12, 10, 12, 12, 12, 10];

      console.log(c.dim(headers.map((h, i) => h.padEnd(widths[i])).join(' ')));
      console.log(c.dim('-'.repeat(widths.reduce((a, b) => a + b + 1, 0))));

      for (const day of data.dailyStats) {
        const dayDate = new Date(day.date);
        const dayName = dayDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

        const row = [
          dayName.slice(0, widths[0] - 1).padEnd(widths[0]),
          day.sessions.toString().padEnd(widths[1]),
          formatNumber(day.inputTokens).slice(0, widths[2] - 1).padEnd(widths[2]),
          formatNumber(day.outputTokens).slice(0, widths[3] - 1).padEnd(widths[3]),
          formatNumber(day.cacheReadTokens).slice(0, widths[4] - 1).padEnd(widths[4]),
          formatCost(day.cost).padEnd(widths[5])
        ];

        console.log(row.join(' '));
      }
      console.log();
    }

    // Model breakdown
    if (Object.keys(data.modelStats).length > 0) {
      console.log(c.bold('By Model\n'));

      const headers = ['Model', 'Sessions', 'Input', 'Output', 'Cost'];
      const widths = [25, 10, 15, 15, 10];

      console.log(c.dim(headers.map((h, i) => h.padEnd(widths[i])).join(' ')));
      console.log(c.dim('-'.repeat(widths.reduce((a, b) => a + b + 1, 0))));

      const sortedModels = Object.entries(data.modelStats)
        .sort((a, b) => b[1].cost - a[1].cost);

      for (const [model, stats] of sortedModels) {
        const row = [
          model.slice(0, widths[0] - 1).padEnd(widths[0]),
          stats.sessions.toString().padEnd(widths[1]),
          formatNumber(stats.inputTokens).slice(0, widths[2] - 1).padEnd(widths[2]),
          formatNumber(stats.outputTokens).slice(0, widths[3] - 1).padEnd(widths[3]),
          formatCost(stats.cost).padEnd(widths[4])
        ];

        console.log(row.join(' '));
      }
      console.log();
    }

    // Comparison with previous week (if verbose)
    if (options.verbose) {
      const prevWeekStart = new Date(weekStart);
      prevWeekStart.setDate(prevWeekStart.getDate() - 7);
      const prevWeekEnd = new Date(weekEnd);
      prevWeekEnd.setDate(prevWeekEnd.getDate() - 7);

      const prevData = getWeeklyData(db, prevWeekStart, prevWeekEnd);

      if (prevData.totalSessions > 0) {
        console.log(c.bold('Comparison with Previous Week\n'));

        const costChange = data.totalCost - prevData.totalCost;
        const costPercent = prevData.totalCost > 0 ?
          ((costChange / prevData.totalCost) * 100).toFixed(1) : 0;
        const sessionChange = data.totalSessions - prevData.totalSessions;
        const tokenChange = (data.totalInputTokens + data.totalOutputTokens) -
                           (prevData.totalInputTokens + prevData.totalOutputTokens);

        const costColor = costChange > 0 ? c.red : c.green;
        const costSymbol = costChange > 0 ? '+' : '';

        console.log(`  Cost Change:    ${costColor(`${costSymbol}${formatCost(costChange)} (${costSymbol}${costPercent}%)`)}`);
        console.log(`  Session Change: ${sessionChange >= 0 ? '+' : ''}${sessionChange}`);
        console.log(`  Token Change:   ${tokenChange >= 0 ? '+' : ''}${formatNumber(tokenChange)}`);
        console.log();
      }
    }

    // JSON output option
    if (options.json) {
      console.log(JSON.stringify({
        weekNumber: weekNum,
        isoWeek,
        weekStart: weekStart.toISOString(),
        weekEnd: weekEnd.toISOString(),
        ...data,
        dailyStats: data.dailyStats,
        modelStats: data.modelStats
      }, null, 2));
    }

  } catch (error) {
    console.log(c.red(`Error: ${error.message}\n`));
  }
}

/**
 * Show weekly comparison
 */
async function compareWeeks(weeks = 4, options = {}) {
  const c = await getChalk();

  try {
    const startDay = options.startOfWeek === 'sunday' ? WEEK_START.SUNDAY : WEEK_START.MONDAY;

    console.log(c.bold(`\nWeekly Comparison (Last ${weeks} weeks)\n`));

    const { getDatabase } = require('../../services/database.cjs');
    const db = getDatabase();

    if (!db) {
      console.log(c.yellow('No database available.\n'));
      return;
    }

    const weeklyData = [];
    const today = new Date();

    for (let i = 0; i < weeks; i++) {
      const targetDate = new Date(today);
      targetDate.setDate(targetDate.getDate() - (i * 7));
      const { start, end } = getWeekBounds(targetDate, startDay);
      const data = getWeeklyData(db, start, end);
      data.weekNum = getWeekNumber(start, startDay);
      weeklyData.push(data);
    }

    // Reverse to show oldest first
    weeklyData.reverse();

    // Table header
    const headers = ['Week', 'Sessions', 'Input', 'Output', 'Cost', 'Trend'];
    const widths = [8, 10, 12, 12, 10, 8];

    console.log(c.dim(headers.map((h, i) => h.padEnd(widths[i])).join(' ')));
    console.log(c.dim('-'.repeat(widths.reduce((a, b) => a + b + 1, 0))));

    let prevCost = 0;
    for (const data of weeklyData) {
      const trend = prevCost > 0 ?
        (data.totalCost > prevCost ? c.red('▲') :
         data.totalCost < prevCost ? c.green('▼') : c.dim('─')) : '';

      const row = [
        `W${data.weekNum.toString().padStart(2, '0')}`.padEnd(widths[0]),
        data.totalSessions.toString().padEnd(widths[1]),
        formatNumber(data.totalInputTokens).slice(0, widths[2] - 1).padEnd(widths[2]),
        formatNumber(data.totalOutputTokens).slice(0, widths[3] - 1).padEnd(widths[3]),
        formatCost(data.totalCost).padEnd(widths[4]),
        trend
      ];

      console.log(row.join(' '));
      prevCost = data.totalCost;
    }
    console.log();

    // Summary
    const totalCost = weeklyData.reduce((sum, d) => sum + d.totalCost, 0);
    const avgCost = totalCost / weeks;
    console.log(`  Average Weekly Cost: ${formatCost(avgCost)}`);
    console.log(`  Total (${weeks} weeks):    ${formatCost(totalCost)}`);
    console.log();

  } catch (error) {
    console.log(c.red(`Error: ${error.message}\n`));
  }
}

/**
 * Show help
 */
async function showHelp() {
  const c = await getChalk();

  console.log(c.bold('\nWeekly Report Commands\n'));

  console.log(c.cyan('  weekly'));
  console.log('    Show current week report');
  console.log(c.dim('    Options: --start-of-week <day>, --week <spec>, --verbose, --json'));
  console.log();

  console.log(c.cyan('  weekly compare [weeks]'));
  console.log('    Compare multiple weeks');
  console.log(c.dim('    Options: --start-of-week <day>'));
  console.log();

  console.log(c.bold('Week Specification:\n'));
  console.log(c.dim('  --week -1           Last week'));
  console.log(c.dim('  --week -2           Two weeks ago'));
  console.log(c.dim('  --week 2024-W01     Specific ISO week'));
  console.log();

  console.log(c.bold('Examples:\n'));
  console.log(c.dim('  dragon-ui-claude-cli weekly'));
  console.log(c.dim('  dragon-ui-claude-cli weekly --week -1'));
  console.log(c.dim('  dragon-ui-claude-cli weekly --start-of-week sunday'));
  console.log(c.dim('  dragon-ui-claude-cli weekly compare 8'));
  console.log();
}

/**
 * Register weekly commands
 * @param {Command} program
 */
function registerCommands(program) {
  const weekly = program
    .command('weekly')
    .description('Show weekly usage reports')
    .option('-s, --start-of-week <day>', 'Week starts on (monday|sunday|saturday)', 'monday')
    .option('-w, --week <spec>', 'Week to show (e.g., -1, 2024-W01)')
    .option('-v, --verbose', 'Show comparison with previous week')
    .option('-j, --json', 'Output as JSON')
    .action(showWeekly);

  weekly
    .command('compare [weeks]')
    .description('Compare multiple weeks')
    .option('-s, --start-of-week <day>', 'Week starts on (monday|sunday)', 'monday')
    .action((weeks, options) => compareWeeks(parseInt(weeks, 10) || 4, options));

  weekly
    .command('help')
    .description('Show weekly report help')
    .action(showHelp);

  return weekly;
}

module.exports = {
  registerCommands,
  showWeekly,
  compareWeeks,
  showHelp,
  getWeekNumber,
  getISOWeekNumber,
  getWeekBounds,
  WEEK_START
};
