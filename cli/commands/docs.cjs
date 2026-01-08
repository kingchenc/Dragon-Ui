/**
 * Documentation CLI Commands
 * View and generate Dragon UI documentation
 */

const path = require('path');
const fs = require('fs');
const { docsGenerator, SECTIONS, COMMANDS, CONFIGURATION, API } = require('../../services/docs-generator.cjs');

// Dynamic chalk import for ESM compatibility
let chalk = null;
async function initChalk() {
  if (!chalk) {
    const chalkModule = await import('chalk');
    chalk = chalkModule.default;
  }
  return chalk;
}

/**
 * Show overview documentation
 */
async function showOverview() {
  await initChalk();

  console.log(chalk.bold.cyan('\n🐲 Dragon UI - Claude Code Max Usage Dashboard\n'));

  console.log(chalk.white('Dragon UI is a comprehensive CLI and GUI dashboard for tracking'));
  console.log(chalk.white('Claude Code Max usage, including tokens, costs, sessions, and'));
  console.log(chalk.white('advanced analytics.\n'));

  console.log(chalk.bold('Features:'));
  console.log('  • Real-time Monitoring - Live dashboard with auto-refresh');
  console.log('  • Multi-Provider Support - 11 AI providers');
  console.log('  • Agent Detection - Automatic tool/agent usage detection');
  console.log('  • Powerline Mode - Beautiful terminal statusline');
  console.log('  • Settings Migration - Version-aware settings with backup');
  console.log('  • Interactive TUI - Full-screen terminal dashboard');
  console.log('');

  console.log(chalk.bold('Quick Start:'));
  console.log(chalk.dim('  # Run CLI dashboard'));
  console.log(chalk.cyan('  dragon-ui-claude-cli'));
  console.log('');
  console.log(chalk.dim('  # Show statusline'));
  console.log(chalk.cyan('  dragon-ui-claude-cli statusline'));
  console.log('');
  console.log(chalk.dim('  # Start live monitoring'));
  console.log(chalk.cyan('  dragon-ui-claude-cli live'));
  console.log('');
}

/**
 * Show command documentation
 */
async function showCommand(commandName) {
  await initChalk();

  const cmd = COMMANDS[commandName];

  if (!cmd) {
    console.log(chalk.red(`\nCommand not found: ${commandName}`));
    console.log(chalk.dim(`Available commands: ${Object.keys(COMMANDS).join(', ')}`));
    return;
  }

  console.log(chalk.bold.cyan(`\n📖 ${cmd.name}\n`));
  console.log(chalk.white(cmd.description));
  console.log('');

  console.log(chalk.bold('Usage:'));
  console.log(`  ${chalk.cyan(cmd.usage)}`);
  console.log('');

  if (cmd.subcommands && cmd.subcommands.length > 0) {
    console.log(chalk.bold('Subcommands:'));
    const maxLen = Math.max(...cmd.subcommands.map(s => s.name.length));
    for (const sub of cmd.subcommands) {
      console.log(`  ${chalk.yellow(sub.name.padEnd(maxLen + 2))} ${sub.description}`);
    }
    console.log('');
  }

  if (cmd.options && cmd.options.length > 0) {
    console.log(chalk.bold('Options:'));
    const maxLen = Math.max(...cmd.options.map(o => o.flag.length));
    for (const opt of cmd.options) {
      console.log(`  ${chalk.green(opt.flag.padEnd(maxLen + 2))} ${opt.description}`);
    }
    console.log('');
  }

  if (cmd.examples && cmd.examples.length > 0) {
    console.log(chalk.bold('Examples:'));
    for (const ex of cmd.examples) {
      console.log(`  ${chalk.cyan(ex.cmd)}`);
      console.log(`    ${chalk.dim(ex.desc)}`);
    }
    console.log('');
  }
}

/**
 * List all commands
 */
async function listCommands() {
  await initChalk();

  console.log(chalk.bold.cyan('\n📚 Available Commands\n'));

  const maxLen = Math.max(...Object.keys(COMMANDS).map(k => k.length));

  for (const [name, cmd] of Object.entries(COMMANDS)) {
    console.log(`  ${chalk.yellow(name.padEnd(maxLen + 2))} ${cmd.description}`);
  }

  console.log('');
  console.log(chalk.dim('Use "dragon-ui-claude-cli docs command <name>" for details'));
  console.log('');
}

/**
 * Show configuration documentation
 */
async function showConfiguration() {
  await initChalk();

  console.log(chalk.bold.cyan('\n⚙️  Configuration\n'));

  console.log(chalk.bold('Settings Files:'));
  console.log(chalk.dim('Location: ~/'));
  console.log('');

  for (const file of CONFIGURATION.files) {
    console.log(`  ${chalk.yellow(file.name.padEnd(35))} ${file.description}`);
  }
  console.log('');

  console.log(chalk.bold('Environment Variables:'));
  console.log('');

  for (const env of CONFIGURATION.environment) {
    console.log(`  ${chalk.green(env.name.padEnd(25))} ${env.description}`);
  }
  console.log('');
}

/**
 * Show API documentation
 */
async function showAPI() {
  await initChalk();

  console.log(chalk.bold.cyan('\n🔧 API Reference\n'));

  for (const service of API.services) {
    console.log(chalk.bold.yellow(`${service.name}`));
    console.log(`  ${chalk.dim(service.description)}`);
    console.log('');
    console.log(chalk.dim('  Methods:'));
    for (const method of service.methods) {
      console.log(`    ${chalk.cyan(method)}`);
    }
    console.log('');
  }
}

/**
 * Search documentation
 */
async function searchDocs(query) {
  await initChalk();

  if (!query) {
    console.log(chalk.red('\nSearch query required'));
    console.log(chalk.dim('Usage: dragon-ui-claude-cli docs search <query>'));
    return;
  }

  console.log(chalk.bold.cyan(`\n🔍 Search Results for "${query}"\n`));

  const results = docsGenerator.search(query);

  if (results.length === 0) {
    console.log(chalk.yellow('No results found'));
    return;
  }

  for (const result of results) {
    const typeIcon = result.type === 'command' ? '📌' : '📎';
    console.log(`${typeIcon} ${chalk.cyan(result.name)}`);
    console.log(`   ${result.description}`);
    console.log('');
  }
}

/**
 * Generate documentation files
 */
async function generateDocs(outputDir) {
  await initChalk();

  const dir = outputDir || './docs';

  console.log(chalk.bold.cyan(`\n📝 Generating Documentation\n`));
  console.log(`Output directory: ${chalk.yellow(path.resolve(dir))}`);
  console.log('');

  try {
    const count = docsGenerator.writeToFiles(dir);
    console.log(chalk.green(`✓ Generated ${count} documentation files`));
    console.log('');
    console.log(chalk.dim('Files:'));

    const files = fs.readdirSync(dir);
    for (const file of files) {
      console.log(`  ${chalk.cyan(file)}`);
    }
    console.log('');
  } catch (error) {
    console.log(chalk.red(`✗ Error generating docs: ${error.message}`));
  }
}

/**
 * Show examples
 */
async function showExamples() {
  await initChalk();

  console.log(chalk.bold.cyan('\n📋 Examples\n'));

  console.log(chalk.bold('Basic Usage:'));
  console.log('');

  const examples = [
    { title: 'Start CLI Dashboard', cmd: 'dragon-ui-claude-cli' },
    { title: 'Show Statusline', cmd: 'dragon-ui-claude-cli statusline' },
    { title: 'Live Monitoring', cmd: 'dragon-ui-claude-cli live' },
    { title: 'TUI Dashboard', cmd: 'dragon-ui-claude-cli tui' }
  ];

  for (const ex of examples) {
    console.log(`  ${chalk.dim(ex.title + ':')}`);
    console.log(`  ${chalk.cyan(ex.cmd)}`);
    console.log('');
  }

  console.log(chalk.bold('Provider Management:'));
  console.log('');
  console.log(`  ${chalk.cyan('dragon-ui-claude-cli providers list')}`);
  console.log(`  ${chalk.cyan('dragon-ui-claude-cli providers detect claude-sonnet-4')}`);
  console.log('');

  console.log(chalk.bold('Settings Management:'));
  console.log('');
  console.log(`  ${chalk.cyan('dragon-ui-claude-cli migrate status')}`);
  console.log(`  ${chalk.cyan('dragon-ui-claude-cli migrate backup "my-backup"')}`);
  console.log('');
}

/**
 * Show help
 */
async function showHelp() {
  await initChalk();

  console.log(chalk.bold('\n📖 Documentation Commands\n'));

  console.log(chalk.cyan('Usage:'));
  console.log('  dragon-ui-claude-cli docs <action> [options]\n');

  console.log(chalk.cyan('Actions:'));
  console.log('  overview              Show project overview');
  console.log('  commands              List all commands');
  console.log('  command <name>        Show command documentation');
  console.log('  config                Show configuration docs');
  console.log('  api                   Show API reference');
  console.log('  examples              Show usage examples');
  console.log('  search <query>        Search documentation');
  console.log('  generate [dir]        Generate markdown docs');
  console.log('  help                  Show this help\n');

  console.log(chalk.cyan('Examples:'));
  console.log('  dragon-ui-claude-cli docs');
  console.log('  dragon-ui-claude-cli docs command providers');
  console.log('  dragon-ui-claude-cli docs search "backup"');
  console.log('  dragon-ui-claude-cli docs generate ./my-docs\n');
}

module.exports = {
  showOverview,
  showCommand,
  listCommands,
  showConfiguration,
  showAPI,
  searchDocs,
  generateDocs,
  showExamples,
  showHelp
};
