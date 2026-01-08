/**
 * Install CLI Commands for Dragon-UI
 * Manage Claude Code statusLine installation
 *
 * @module cli/commands/install
 */

'use strict';

const { getClaudeSettings, getPackageRunner } = require('../../services/claude-settings.cjs');

let chalk;
async function getChalk() {
  if (!chalk) {
    chalk = (await import('chalk')).default;
  }
  return chalk;
}

/**
 * Install statusLine
 */
async function installStatusLine(options = {}) {
  const c = await getChalk();

  console.log(c.bold('\nInstalling Dragon-UI StatusLine\n'));

  try {
    const settings = getClaudeSettings();
    const info = settings.getInfo();

    console.log(c.dim(`Config directory: ${info.configDir || 'not found'}`));
    console.log(c.dim(`Settings file:    ${info.settingsPath || 'not found'}`));
    console.log();

    if (!info.configDir) {
      console.log(c.red('Error: Claude config directory not found.'));
      console.log(c.dim('Set CLAUDE_CONFIG_DIR environment variable or create ~/.claude directory.\n'));
      return;
    }

    // Check if already installed
    if (info.isInstalled && !options.force) {
      console.log(c.yellow('StatusLine is already installed.'));
      console.log(c.dim(`Current: ${info.statusLine}`));
      console.log(c.dim('Use --force to reinstall.\n'));
      return;
    }

    // Determine runner
    const runner = options.runner || info.recommendedRunner;
    console.log(c.dim(`Using package runner: ${runner}`));

    // Install
    const result = settings.installStatusLine({
      runner,
      style: options.style,
      elements: options.elements,
      compact: options.compact
    });

    if (result.success) {
      console.log(c.green('\n✓ StatusLine installed successfully!\n'));
      console.log(`  Command: ${c.cyan(result.command)}`);
      console.log(`  Settings: ${result.settingsPath}`);

      if (result.previous) {
        console.log(c.dim(`  Previous: ${result.previous}`));
      }

      console.log();
      console.log(c.dim('Restart Claude Code for changes to take effect.\n'));
    } else {
      console.log(c.red('\nFailed to install statusLine.\n'));
    }

  } catch (error) {
    console.log(c.red(`Error: ${error.message}\n`));
  }
}

/**
 * Uninstall statusLine
 */
async function uninstallStatusLine(options = {}) {
  const c = await getChalk();

  console.log(c.bold('\nUninstalling Dragon-UI StatusLine\n'));

  try {
    const settings = getClaudeSettings();
    const info = settings.getInfo();

    if (!info.isInstalled) {
      console.log(c.yellow('StatusLine is not installed.\n'));
      return;
    }

    // Confirm
    if (!options.force) {
      console.log(c.yellow(`Current statusLine: ${info.statusLine}`));
      console.log(c.dim('Use --force to skip confirmation.\n'));

      const readline = require('readline');
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });

      const answer = await new Promise(resolve => {
        rl.question('Type "uninstall" to confirm: ', answer => {
          rl.close();
          resolve(answer);
        });
      });

      if (answer.toLowerCase() !== 'uninstall') {
        console.log(c.dim('\nCancelled.\n'));
        return;
      }
    }

    const result = settings.uninstallStatusLine();

    if (result.success) {
      console.log(c.green('\n✓ StatusLine uninstalled.\n'));
      if (result.previous) {
        console.log(c.dim(`Removed: ${result.previous}\n`));
      }
    } else {
      console.log(c.red('\nFailed to uninstall statusLine.\n'));
    }

  } catch (error) {
    console.log(c.red(`Error: ${error.message}\n`));
  }
}

/**
 * Show installation status
 */
async function showStatus(options = {}) {
  const c = await getChalk();

  console.log(c.bold('\nDragon-UI Installation Status\n'));

  try {
    const settings = getClaudeSettings();
    const info = settings.getInfo();
    const validation = settings.validate();

    // Config info
    console.log(c.bold('Configuration\n'));
    console.log(`  Config Dir:    ${info.configDir || c.red('Not found')}`);
    console.log(`  Settings File: ${info.settingsPath || c.red('Not found')}`);
    console.log(`  File Exists:   ${info.settingsExist ? c.green('Yes') : c.yellow('No')}`);
    console.log();

    // StatusLine info
    console.log(c.bold('StatusLine\n'));
    if (info.isInstalled) {
      console.log(`  Status:  ${c.green('● Installed')}`);
      console.log(`  Command: ${info.statusLine}`);
    } else if (info.statusLine) {
      console.log(`  Status:  ${c.yellow('● Custom (not Dragon-UI)')}`);
      console.log(`  Command: ${info.statusLine}`);
    } else {
      console.log(`  Status:  ${c.gray('○ Not installed')}`);
    }
    console.log();

    // Package runners
    console.log(c.bold('Package Runners\n'));
    console.log(`  bunx:        ${info.bunxAvailable ? c.green('Available') : c.gray('Not found')}`);
    console.log(`  npx:         ${info.npxAvailable ? c.green('Available') : c.gray('Not found')}`);
    console.log(`  Recommended: ${info.recommendedRunner}`);
    console.log();

    // Validation
    if (!validation.valid || validation.warnings.length > 0) {
      console.log(c.bold('Validation\n'));

      for (const error of validation.errors) {
        console.log(`  ${c.red('✕')} ${error}`);
      }
      for (const warning of validation.warnings) {
        console.log(`  ${c.yellow('!')} ${warning}`);
      }
      console.log();
    }

    // Show all settings if verbose
    if (options.verbose) {
      const allSettings = settings.getAllSettings();
      console.log(c.bold('All Settings\n'));
      console.log(JSON.stringify(allSettings, null, 2));
      console.log();
    }

  } catch (error) {
    console.log(c.red(`Error: ${error.message}\n`));
  }
}

/**
 * Update statusLine configuration
 */
async function updateConfig(options = {}) {
  const c = await getChalk();

  console.log(c.bold('\nUpdating StatusLine Configuration\n'));

  try {
    const settings = getClaudeSettings();

    if (!settings.isInstalled()) {
      console.log(c.yellow('StatusLine is not installed.'));
      console.log(c.dim('Use "install" command first.\n'));
      return;
    }

    const result = settings.updateStatusLine({
      style: options.style,
      elements: options.elements,
      compact: options.compact,
      lines: options.lines
    });

    if (result.success) {
      console.log(c.green('✓ Configuration updated.\n'));
      console.log(`  Command: ${result.command}\n`);
    } else {
      console.log(c.red('Failed to update configuration.\n'));
    }

  } catch (error) {
    console.log(c.red(`Error: ${error.message}\n`));
  }
}

/**
 * Show settings file
 */
async function showSettings() {
  const c = await getChalk();

  try {
    const settings = getClaudeSettings();
    const allSettings = settings.getAllSettings();

    console.log(c.bold('\nClaude Settings\n'));
    console.log(JSON.stringify(allSettings, null, 2));
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

  console.log(c.bold('\nInstall Commands\n'));

  console.log(c.cyan('  install'));
  console.log('    Install Dragon-UI statusLine into Claude Code');
  console.log(c.dim('    Options: --style, --elements, --compact, --runner, --force'));
  console.log();

  console.log(c.cyan('  uninstall'));
  console.log('    Remove Dragon-UI statusLine from Claude Code');
  console.log(c.dim('    Options: --force'));
  console.log();

  console.log(c.cyan('  status'));
  console.log('    Show installation status');
  console.log(c.dim('    Options: --verbose'));
  console.log();

  console.log(c.cyan('  update'));
  console.log('    Update statusLine configuration');
  console.log(c.dim('    Options: --style, --elements, --compact, --lines'));
  console.log();

  console.log(c.cyan('  settings'));
  console.log('    Show all Claude Code settings');
  console.log();

  console.log(c.bold('Styles:\n'));
  console.log(c.dim('  modern, classic, minimal, dragon'));
  console.log();

  console.log(c.bold('Examples:\n'));
  console.log(c.dim('  dragon-ui-claude-cli install'));
  console.log(c.dim('  dragon-ui-claude-cli install --style dragon --compact'));
  console.log(c.dim('  dragon-ui-claude-cli uninstall --force'));
  console.log(c.dim('  dragon-ui-claude-cli status --verbose'));
  console.log();
}

/**
 * Register install commands
 * @param {Command} program
 */
function registerCommands(program) {
  program
    .command('install')
    .description('Install Dragon-UI statusLine into Claude Code')
    .option('-s, --style <style>', 'Statusline style (modern|classic|minimal|dragon)')
    .option('-e, --elements <elements>', 'Comma-separated elements to show')
    .option('-c, --compact', 'Use compact display')
    .option('-r, --runner <runner>', 'Package runner (bunx|npx|node)')
    .option('-f, --force', 'Force reinstall')
    .action(installStatusLine);

  program
    .command('uninstall')
    .description('Uninstall Dragon-UI statusLine')
    .option('-f, --force', 'Skip confirmation')
    .action(uninstallStatusLine);

  // Group under 'setup' parent command as well
  const setup = program
    .command('setup')
    .description('Setup and configuration commands');

  setup
    .command('status')
    .description('Show installation status')
    .option('-v, --verbose', 'Show all settings')
    .action(showStatus);

  setup
    .command('update')
    .description('Update statusLine configuration')
    .option('-s, --style <style>', 'Statusline style')
    .option('-e, --elements <elements>', 'Elements to show')
    .option('-c, --compact', 'Compact display')
    .option('-l, --lines <n>', 'Number of lines')
    .action(updateConfig);

  setup
    .command('settings')
    .description('Show Claude Code settings')
    .action(showSettings);

  setup
    .command('help')
    .description('Show setup help')
    .action(showHelp);

  return setup;
}

module.exports = {
  registerCommands,
  installStatusLine,
  uninstallStatusLine,
  showStatus,
  updateConfig,
  showSettings,
  showHelp
};
