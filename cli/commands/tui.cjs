/**
 * TUI Command for Dragon-UI
 * Launch the interactive terminal user interface
 *
 * @module cli/commands/tui
 */

'use strict';

const { Command } = require('commander');
const chalk = require('chalk');
const { runTUI } = require('../tui/tui-core.cjs');

/**
 * Create the TUI command
 * @returns {Command}
 */
function createTUICommand() {
  const command = new Command('tui')
    .description('Launch interactive terminal user interface')
    .option('--no-color', 'Disable colors')
    .option('--debug', 'Enable debug mode')
    .action(async (options) => {
      try {
        // Check if running in a TTY
        if (!process.stdin.isTTY || !process.stdout.isTTY) {
          console.error(chalk.red('Error: TUI requires an interactive terminal (TTY)'));
          console.error(chalk.dim('Try running in a standard terminal instead of piped input.'));
          process.exit(1);
        }

        // Check terminal size
        const cols = process.stdout.columns || 80;
        const rows = process.stdout.rows || 24;

        if (cols < 60 || rows < 15) {
          console.error(chalk.yellow('Warning: Terminal size is small'));
          console.error(chalk.dim('Current: ' + cols + 'x' + rows + ', Recommended: 80x24 or larger'));
        }

        if (options.debug) {
          console.log(chalk.dim('Starting TUI in debug mode...'));
          console.log(chalk.dim('Terminal size: ' + cols + 'x' + rows));
        }

        // Run the TUI
        runTUI({
          width: cols,
          height: rows,
          debug: options.debug,
          color: options.color !== false
        });

      } catch (error) {
        console.error(chalk.red('Failed to start TUI:'), error.message);
        if (options.debug) {
          console.error(error.stack);
        }
        process.exit(1);
      }
    });

  // Add subcommands
  command
    .command('widgets')
    .description('Open widget editor directly')
    .action(() => {
      const { TUIApplication, SCREENS } = require('../tui/tui-core.cjs');
      const app = new TUIApplication();
      app.stateManager.setState({ currentScreen: SCREENS.WIDGET_EDITOR });
      app.start();
    });

  command
    .command('colors')
    .description('Open color configuration directly')
    .action(() => {
      const { TUIApplication, SCREENS } = require('../tui/tui-core.cjs');
      const app = new TUIApplication();
      app.stateManager.setState({ currentScreen: SCREENS.COLOR_CONFIG });
      app.start();
    });

  command
    .command('powerline')
    .description('Open powerline setup directly')
    .action(() => {
      const { TUIApplication, SCREENS } = require('../tui/tui-core.cjs');
      const app = new TUIApplication();
      app.stateManager.setState({ currentScreen: SCREENS.POWERLINE_SETUP });
      app.start();
    });

  return command;
}

module.exports = { createTUICommand };
