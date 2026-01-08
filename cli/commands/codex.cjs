/**
 * Codex CLI Commands for Dragon-UI
 * OpenAI Codex/GPT-5 usage reports and statistics
 *
 * @module cli/commands/codex
 */

'use strict';

const { getCodexLoader, CODEX_PRICING } = require('../../services/codex-loader.cjs');

let chalk;
async function getChalk() {
  if (!chalk) {
    chalk = (await import('chalk')).default;
  }
  return chalk;
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
 * Show Codex overview
 */
async function showOverview(options = {}) {
  const c = await getChalk();

  console.log(c.bold('\nCodex/GPT-5 Usage Overview\n'));

  try {
    const loader = getCodexLoader({
      configDir: options.configDir
    });

    const configDir = loader.options.configDir;
    if (!configDir) {
      console.log(c.yellow('Codex config directory not found.'));
      console.log(c.dim('Set CODEX_CONFIG_DIR environment variable or create ~/.codex directory.\n'));
      return;
    }

    console.log(c.dim(`Config: ${configDir}\n`));

    console.log(c.dim('Loading sessions...'));
    const { sessions, stats, files } = await loader.loadAll();

    if (sessions.length === 0) {
      console.log(c.yellow('\nNo Codex sessions found.\n'));
      return;
    }

    console.log(c.green(`\nLoaded ${sessions.length} sessions from ${files} files\n`));

    // Summary
    console.log(c.bold('Summary\n'));
    console.log(`  Sessions:         ${formatNumber(stats.sessionCount)}`);
    console.log(`  Input Tokens:     ${formatNumber(stats.totalInputTokens)}`);
    console.log(`  Output Tokens:    ${formatNumber(stats.totalOutputTokens)}`);
    console.log(`  Cached Tokens:    ${formatNumber(stats.totalCachedTokens)}`);
    console.log(`  Reasoning Tokens: ${formatNumber(stats.totalReasoningTokens)}`);
    console.log(`  Total Cost:       ${c.green(formatCost(stats.totalCost))}`);
    console.log(`  Avg Cost/Session: ${formatCost(stats.averageCostPerSession)}`);
    console.log();

    // By Model
    if (Object.keys(stats.byModel).length > 0) {
      console.log(c.bold('By Model\n'));

      const headers = ['Model', 'Sessions', 'Input', 'Output', 'Cost'];
      const widths = [20, 10, 15, 15, 12];

      console.log(c.dim(headers.map((h, i) => h.padEnd(widths[i])).join(' ')));
      console.log(c.dim('-'.repeat(widths.reduce((a, b) => a + b + 1, 0))));

      const sortedModels = Object.entries(stats.byModel)
        .sort((a, b) => b[1].cost - a[1].cost);

      for (const [model, modelStats] of sortedModels) {
        const row = [
          model.slice(0, widths[0] - 1).padEnd(widths[0]),
          modelStats.sessions.toString().padEnd(widths[1]),
          formatNumber(modelStats.inputTokens).slice(0, widths[2] - 1).padEnd(widths[2]),
          formatNumber(modelStats.outputTokens).slice(0, widths[3] - 1).padEnd(widths[3]),
          formatCost(modelStats.cost).padEnd(widths[4])
        ];
        console.log(row.join(' '));
      }
      console.log();
    }

    // Recent Sessions (if verbose)
    if (options.verbose) {
      const recentSessions = sessions.slice(-10).reverse();

      console.log(c.bold('Recent Sessions\n'));

      const headers = ['Session ID', 'Model', 'Duration', 'Tokens', 'Cost'];
      const widths = [20, 15, 12, 12, 10];

      console.log(c.dim(headers.map((h, i) => h.padEnd(widths[i])).join(' ')));
      console.log(c.dim('-'.repeat(widths.reduce((a, b) => a + b + 1, 0))));

      for (const session of recentSessions) {
        const row = [
          (session.sessionId || 'N/A').slice(0, widths[0] - 1).padEnd(widths[0]),
          session.model.slice(0, widths[1] - 1).padEnd(widths[1]),
          formatDuration(session.getDuration()).padEnd(widths[2]),
          formatNumber(session.getTotalTokens()).slice(0, widths[3] - 1).padEnd(widths[3]),
          formatCost(session.calculateCost()).padEnd(widths[4])
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
 * Show daily report
 */
async function showDaily(options = {}) {
  const c = await getChalk();

  console.log(c.bold('\nCodex Daily Report\n'));

  try {
    const loader = getCodexLoader({
      configDir: options.configDir
    });

    await loader.loadAll();
    const dailyStats = loader.getDailyStats();

    if (dailyStats.length === 0) {
      console.log(c.yellow('No daily data available.\n'));
      return;
    }

    // Show last N days
    const days = options.days ? parseInt(options.days, 10) : 14;
    const recentDays = dailyStats.slice(-days);

    const headers = ['Date', 'Sessions', 'Input', 'Output', 'Cached', 'Cost'];
    const widths = [12, 10, 12, 12, 12, 10];

    console.log(c.dim(headers.map((h, i) => h.padEnd(widths[i])).join(' ')));
    console.log(c.dim('-'.repeat(widths.reduce((a, b) => a + b + 1, 0))));

    let totalCost = 0;
    for (const day of recentDays) {
      const row = [
        day.date.padEnd(widths[0]),
        day.sessions.toString().padEnd(widths[1]),
        formatNumber(day.inputTokens).slice(0, widths[2] - 1).padEnd(widths[2]),
        formatNumber(day.outputTokens).slice(0, widths[3] - 1).padEnd(widths[3]),
        formatNumber(day.cachedTokens).slice(0, widths[4] - 1).padEnd(widths[4]),
        formatCost(day.cost).padEnd(widths[5])
      ];
      console.log(row.join(' '));
      totalCost += day.cost;
    }

    console.log(c.dim('-'.repeat(widths.reduce((a, b) => a + b + 1, 0))));
    console.log(`${'Total'.padEnd(widths[0] + widths[1] + widths[2] + widths[3] + widths[4] + 4)}${c.green(formatCost(totalCost))}`);
    console.log();

  } catch (error) {
    console.log(c.red(`Error: ${error.message}\n`));
  }
}

/**
 * Show session details
 */
async function showSession(sessionId, options = {}) {
  const c = await getChalk();

  if (!sessionId) {
    console.log(c.red('\nError: Session ID is required.\n'));
    return;
  }

  try {
    const loader = getCodexLoader({
      configDir: options.configDir
    });

    await loader.loadAll();
    const session = loader.getSession(sessionId);

    if (!session) {
      console.log(c.red(`\nSession not found: ${sessionId}\n`));
      return;
    }

    console.log(c.bold(`\nCodex Session: ${sessionId}\n`));

    console.log(`  Model:            ${session.model}`);
    console.log(`  Start:            ${new Date(session.startTime).toLocaleString()}`);
    if (session.endTime) {
      console.log(`  End:              ${new Date(session.endTime).toLocaleString()}`);
    }
    console.log(`  Duration:         ${formatDuration(session.getDuration())}`);
    console.log();

    console.log(c.bold('Token Usage\n'));
    console.log(`  Input:      ${formatNumber(session.inputTokens)}`);
    console.log(`  Output:     ${formatNumber(session.outputTokens)}`);
    console.log(`  Cached:     ${formatNumber(session.cachedTokens)}`);
    console.log(`  Reasoning:  ${formatNumber(session.reasoningTokens)}`);
    console.log(`  Total:      ${formatNumber(session.getTotalTokens())}`);
    console.log();

    console.log(c.bold('Cost\n'));
    console.log(`  Total: ${c.green(formatCost(session.calculateCost()))}`);
    console.log();

    console.log(c.bold('Activity\n'));
    console.log(`  Messages:   ${session.messages.length}`);
    console.log(`  Tool Uses:  ${session.toolUses.length}`);
    console.log(`  Errors:     ${session.errors.length}`);
    console.log();

    // Show messages if verbose
    if (options.verbose && session.messages.length > 0) {
      console.log(c.bold('Messages\n'));
      for (const msg of session.messages.slice(-10)) {
        const roleColor = msg.role === 'assistant' ? c.cyan : c.yellow;
        const content = typeof msg.content === 'string' ?
          msg.content.slice(0, 100) :
          JSON.stringify(msg.content).slice(0, 100);
        console.log(`  ${roleColor(msg.role)}: ${c.dim(content)}${content.length >= 100 ? '...' : ''}`);
      }
      console.log();
    }

    // Show tool uses if verbose
    if (options.verbose && session.toolUses.length > 0) {
      console.log(c.bold('Tool Uses\n'));
      for (const tool of session.toolUses.slice(-5)) {
        console.log(`  ${c.cyan(tool.name)} ${c.dim(`(${formatDuration(tool.duration)})`)}`);
      }
      console.log();
    }

    // JSON output
    if (options.json) {
      console.log(JSON.stringify(session.toJSON(), null, 2));
    }

  } catch (error) {
    console.log(c.red(`Error: ${error.message}\n`));
  }
}

/**
 * Show pricing information
 */
async function showPricing() {
  const c = await getChalk();

  console.log(c.bold('\nCodex/GPT-5 Pricing (per 1M tokens)\n'));

  const headers = ['Model', 'Input', 'Output', 'Cached'];
  const widths = [15, 12, 12, 12];

  console.log(c.dim(headers.map((h, i) => h.padEnd(widths[i])).join(' ')));
  console.log(c.dim('-'.repeat(widths.reduce((a, b) => a + b + 1, 0))));

  const sortedModels = Object.entries(CODEX_PRICING)
    .sort((a, b) => b[1].output - a[1].output);

  for (const [model, pricing] of sortedModels) {
    const row = [
      model.padEnd(widths[0]),
      `$${pricing.input.toFixed(2)}`.padEnd(widths[1]),
      `$${pricing.output.toFixed(2)}`.padEnd(widths[2]),
      `$${pricing.cached.toFixed(3)}`.padEnd(widths[3])
    ];
    console.log(row.join(' '));
  }
  console.log();
}

/**
 * List all sessions
 */
async function listSessions(options = {}) {
  const c = await getChalk();

  console.log(c.bold('\nCodex Sessions\n'));

  try {
    const loader = getCodexLoader({
      configDir: options.configDir
    });

    await loader.loadAll();
    let sessions = loader.getAllSessions();

    if (sessions.length === 0) {
      console.log(c.yellow('No sessions found.\n'));
      return;
    }

    // Filter by model if specified
    if (options.model) {
      sessions = sessions.filter(s => s.model === options.model);
    }

    // Sort by start time (newest first)
    sessions.sort((a, b) => b.startTime - a.startTime);

    // Limit output
    const limit = options.limit ? parseInt(options.limit, 10) : 20;
    sessions = sessions.slice(0, limit);

    console.log(c.dim(`Showing ${sessions.length} of ${loader.sessions.size} sessions\n`));

    const headers = ['Session ID', 'Model', 'Date', 'Duration', 'Tokens', 'Cost'];
    const widths = [20, 12, 12, 10, 10, 10];

    console.log(c.dim(headers.map((h, i) => h.padEnd(widths[i])).join(' ')));
    console.log(c.dim('-'.repeat(widths.reduce((a, b) => a + b + 1, 0))));

    for (const session of sessions) {
      const date = new Date(session.startTime).toLocaleDateString();
      const row = [
        (session.sessionId || 'N/A').slice(0, widths[0] - 1).padEnd(widths[0]),
        session.model.slice(0, widths[1] - 1).padEnd(widths[1]),
        date.padEnd(widths[2]),
        formatDuration(session.getDuration()).slice(0, widths[3] - 1).padEnd(widths[3]),
        formatNumber(session.getTotalTokens()).slice(0, widths[4] - 1).padEnd(widths[4]),
        formatCost(session.calculateCost()).padEnd(widths[5])
      ];
      console.log(row.join(' '));
    }
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

  console.log(c.bold('\nCodex Commands\n'));

  console.log(c.cyan('  codex'));
  console.log('    Show Codex/GPT-5 usage overview');
  console.log(c.dim('    Options: --config-dir, --verbose'));
  console.log();

  console.log(c.cyan('  codex daily'));
  console.log('    Show daily usage report');
  console.log(c.dim('    Options: --days <n>'));
  console.log();

  console.log(c.cyan('  codex sessions'));
  console.log('    List all sessions');
  console.log(c.dim('    Options: --limit <n>, --model <name>'));
  console.log();

  console.log(c.cyan('  codex session <id>'));
  console.log('    Show session details');
  console.log(c.dim('    Options: --verbose, --json'));
  console.log();

  console.log(c.cyan('  codex pricing'));
  console.log('    Show GPT-5/Codex pricing');
  console.log();

  console.log(c.bold('Environment Variables:\n'));
  console.log(c.dim('  CODEX_CONFIG_DIR   Path to Codex config directory'));
  console.log();

  console.log(c.bold('Examples:\n'));
  console.log(c.dim('  dragon-ui-claude-cli codex'));
  console.log(c.dim('  dragon-ui-claude-cli codex daily --days 30'));
  console.log(c.dim('  dragon-ui-claude-cli codex sessions --model gpt-5 --limit 50'));
  console.log(c.dim('  dragon-ui-claude-cli codex session abc123 --verbose'));
  console.log();
}

/**
 * Register codex commands
 * @param {Command} program
 */
function registerCommands(program) {
  const codex = program
    .command('codex')
    .description('Codex/GPT-5 usage reports')
    .option('-d, --config-dir <path>', 'Codex config directory')
    .option('-v, --verbose', 'Show detailed information')
    .action(showOverview);

  codex
    .command('daily')
    .description('Show daily usage report')
    .option('-n, --days <n>', 'Number of days to show', '14')
    .option('-d, --config-dir <path>', 'Codex config directory')
    .action(showDaily);

  codex
    .command('sessions')
    .description('List all sessions')
    .option('-l, --limit <n>', 'Maximum sessions to show', '20')
    .option('-m, --model <name>', 'Filter by model')
    .option('-d, --config-dir <path>', 'Codex config directory')
    .action(listSessions);

  codex
    .command('session <id>')
    .description('Show session details')
    .option('-v, --verbose', 'Show messages and tool uses')
    .option('-j, --json', 'Output as JSON')
    .option('-d, --config-dir <path>', 'Codex config directory')
    .action(showSession);

  codex
    .command('pricing')
    .description('Show GPT-5/Codex pricing')
    .action(showPricing);

  codex
    .command('help')
    .description('Show Codex help')
    .action(showHelp);

  return codex;
}

module.exports = {
  registerCommands,
  showOverview,
  showDaily,
  showSession,
  listSessions,
  showPricing,
  showHelp
};
