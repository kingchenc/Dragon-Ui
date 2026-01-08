/**
 * Custom Commands CLI
 * Commands for managing custom command widgets
 */

const {
  CustomCommandWidget,
  CustomCommandWidgetFactory,
  customCommandsManager,
  COMMAND_TEMPLATES,
  TRANSFORMERS
} = require('../widgets/custom-command-widget.cjs');

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
        magenta: identity, blue: identity, hex: () => identity
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

/**
 * List all templates
 */
async function listTemplates() {
  const chalk = await getChalk();
  const templates = CustomCommandWidgetFactory.listTemplates();

  console.log(chalk.bold('\n=== Available Command Templates ===\n'));

  for (const template of templates) {
    console.log(`  ${chalk.cyan(template.name.padEnd(20))} ${chalk.gray(template.description)}`);
    console.log(`  ${' '.repeat(20)} ${chalk.gray(`Cache: ${template.cacheTimeout}ms`)}`);
    console.log();
  }

  console.log(`Total: ${templates.length} templates`);
  console.log(`\nUsage: dragon-ui-claude-cli custom-commands add --template <name>`);
}

/**
 * List all transformers
 */
async function listTransformers() {
  const chalk = await getChalk();
  const transformers = CustomCommandWidgetFactory.listTransformers();

  console.log(chalk.bold('\n=== Available Transformers ===\n'));

  const descriptions = {
    trim: 'Remove leading/trailing whitespace',
    'first-line': 'Extract first line only',
    'last-line': 'Extract last line only',
    'json-field': 'Extract field from JSON output',
    'word-count': 'Count words in output',
    'line-count': 'Count lines in output',
    'char-count': 'Count characters in output',
    uppercase: 'Convert to uppercase',
    lowercase: 'Convert to lowercase',
    'base64-decode': 'Decode base64 string',
    'url-decode': 'Decode URL-encoded string'
  };

  for (const name of transformers) {
    console.log(`  ${chalk.cyan(name.padEnd(15))} ${chalk.gray(descriptions[name] || '')}`);
  }

  console.log(`\nUsage: dragon-ui-claude-cli custom-commands add --transform <name>`);
}

/**
 * List saved custom commands
 */
async function listCommands() {
  const chalk = await getChalk();
  const commands = customCommandsManager.list();

  console.log(chalk.bold('\n=== Saved Custom Commands ===\n'));

  if (commands.length === 0) {
    console.log(chalk.gray('  No custom commands saved'));
    console.log(`\n  Add one with: dragon-ui-claude-cli custom-commands add --command "echo hello"`);
    return;
  }

  for (const cmd of commands) {
    console.log(`  ${chalk.cyan(cmd.id.padEnd(20))} ${chalk.white(cmd.name || 'Unnamed')}`);
    console.log(`  ${' '.repeat(20)} ${chalk.gray(cmd.command)}`);
    if (cmd.prefix || cmd.suffix) {
      console.log(`  ${' '.repeat(20)} Format: ${chalk.yellow(`${cmd.prefix || ''}[output]${cmd.suffix || ''}`)}`);
    }
    console.log();
  }

  console.log(`Total: ${commands.length} commands`);
}

/**
 * Add a new custom command
 */
async function addCommand(options) {
  const chalk = await getChalk();

  if (!options.command && !options.template) {
    console.log(chalk.red('\nError: --command or --template is required'));
    console.log(`Usage: dragon-ui-claude-cli custom-commands add --command "echo hello"`);
    console.log(`   or: dragon-ui-claude-cli custom-commands add --template git-branch`);
    return;
  }

  let config = {};

  // Load from template if specified
  if (options.template) {
    const template = COMMAND_TEMPLATES[options.template];
    if (!template) {
      console.log(chalk.red(`\nError: Unknown template: ${options.template}`));
      console.log(`Use 'dragon-ui-claude-cli custom-commands templates' to list available templates`);
      return;
    }
    config = { ...template };
  }

  // Override with provided options
  if (options.command) config.command = options.command;
  if (options.name) config.name = options.name;
  if (options.prefix !== undefined) config.prefix = options.prefix;
  if (options.suffix !== undefined) config.suffix = options.suffix;
  if (options.transform) config.transform = options.transform;
  if (options.timeout) config.timeout = parseInt(options.timeout);
  if (options.cache) config.cacheTimeout = parseInt(options.cache);
  if (options.fallback !== undefined) config.fallback = options.fallback;
  if (options.maxLength) config.maxLength = parseInt(options.maxLength);

  // Generate ID if not provided
  const id = options.id || `cmd-${Date.now()}`;

  if (customCommandsManager.add(id, config)) {
    console.log(chalk.green(`\nCustom command added: ${id}`));
    console.log(`  Command: ${chalk.cyan(config.command)}`);
    if (config.name) console.log(`  Name: ${config.name}`);
    if (config.prefix || config.suffix) {
      console.log(`  Format: ${config.prefix || ''}[output]${config.suffix || ''}`);
    }
  } else {
    console.log(chalk.red('\nFailed to save custom command'));
  }
}

/**
 * Remove a custom command
 */
async function removeCommand(id) {
  const chalk = await getChalk();

  if (!id) {
    console.log(chalk.red('\nError: Command ID is required'));
    console.log(`Usage: dragon-ui-claude-cli custom-commands remove <id>`);
    return;
  }

  if (customCommandsManager.remove(id)) {
    console.log(chalk.green(`\nRemoved custom command: ${id}`));
  } else {
    console.log(chalk.red(`\nCommand not found: ${id}`));
  }
}

/**
 * Test a custom command or template
 */
async function testCommand(options) {
  const chalk = await getChalk();

  let widget;

  if (options.template) {
    try {
      widget = CustomCommandWidgetFactory.fromTemplate(options.template);
    } catch (err) {
      console.log(chalk.red(`\nError: ${err.message}`));
      return;
    }
  } else if (options.command) {
    widget = CustomCommandWidgetFactory.fromCommand(options.command, {
      prefix: options.prefix || '',
      suffix: options.suffix || '',
      transform: options.transform || 'trim',
      fallback: options.fallback || '',
      maxLength: options.maxLength ? parseInt(options.maxLength) : undefined
    });
  } else if (options.id) {
    const config = customCommandsManager.get(options.id);
    if (!config) {
      console.log(chalk.red(`\nCommand not found: ${options.id}`));
      return;
    }
    widget = new CustomCommandWidget({ id: options.id, ...config });
  } else {
    console.log(chalk.red('\nError: --command, --template, or --id is required'));
    return;
  }

  console.log(chalk.bold('\n=== Testing Command ===\n'));
  console.log(`  Command: ${chalk.cyan(widget.command)}`);
  console.log(`  Shell: ${chalk.gray(widget.shell)}`);
  console.log(`  Transform: ${chalk.gray(widget.transform)}`);

  console.log(chalk.bold('\n  Executing...'));

  try {
    const startTime = Date.now();
    const result = await widget.getValue({});
    const elapsed = Date.now() - startTime;

    console.log(chalk.bold('\n  Result:'));
    console.log(`    ${chalk.green(result)}`);
    console.log(`\n  Execution time: ${elapsed}ms`);

    if (widget._lastError) {
      console.log(chalk.yellow(`\n  Warning: ${widget._lastError.message}`));
    }
  } catch (error) {
    console.log(chalk.red(`\n  Error: ${error.message}`));
  }
}

/**
 * Export custom commands
 */
async function exportCommands(filePath) {
  const chalk = await getChalk();

  if (!filePath) {
    filePath = './dragon-ui-custom-commands-export.json';
  }

  if (customCommandsManager.export(filePath)) {
    console.log(chalk.green(`\nExported to: ${filePath}`));
  } else {
    console.log(chalk.red(`\nFailed to export to: ${filePath}`));
  }
}

/**
 * Import custom commands
 */
async function importCommands(filePath) {
  const chalk = await getChalk();

  if (!filePath) {
    console.log(chalk.red('\nError: File path is required'));
    return;
  }

  const count = customCommandsManager.import(filePath);
  if (count > 0) {
    console.log(chalk.green(`\nImported ${count} command(s) from: ${filePath}`));
  } else {
    console.log(chalk.red(`\nFailed to import from: ${filePath}`));
  }
}

/**
 * Preview a command in statusline format
 */
async function previewCommand(options) {
  const chalk = await getChalk();

  let widget;

  if (options.template) {
    try {
      widget = CustomCommandWidgetFactory.fromTemplate(options.template);
    } catch (err) {
      console.log(chalk.red(`\nError: ${err.message}`));
      return;
    }
  } else if (options.id) {
    const config = customCommandsManager.get(options.id);
    if (!config) {
      console.log(chalk.red(`\nCommand not found: ${options.id}`));
      return;
    }
    widget = new CustomCommandWidget({ id: options.id, ...config });
  } else {
    console.log(chalk.red('\nError: --template or --id is required'));
    return;
  }

  console.log(chalk.bold('\n=== Statusline Preview ===\n'));

  try {
    const value = await widget.getValue({});
    const formatted = widget.format(value);

    // Show in different styles
    console.log('  Plain:     ', value);
    console.log('  Formatted: ', formatted);
    console.log('  With box:  ', `│ ${value} │`);
    console.log('  Powerline: ', `\x1b[44m ${value} \x1b[0m\x1b[34m\uE0B0\x1b[0m`);
    console.log();
  } catch (error) {
    console.log(chalk.red(`\nError: ${error.message}`));
  }
}

/**
 * Show help
 */
async function showHelp() {
  const chalk = await getChalk();

  console.log(chalk.bold('\n=== Custom Commands Help ===\n'));

  console.log('  dragon-ui-claude-cli custom-commands list');
  console.log(chalk.gray('    List all saved custom commands\n'));

  console.log('  dragon-ui-claude-cli custom-commands templates');
  console.log(chalk.gray('    List available command templates\n'));

  console.log('  dragon-ui-claude-cli custom-commands transformers');
  console.log(chalk.gray('    List available output transformers\n'));

  console.log('  dragon-ui-claude-cli custom-commands add [options]');
  console.log(chalk.gray('    Add a new custom command'));
  console.log(chalk.gray('    --id <id>         Unique identifier'));
  console.log(chalk.gray('    --name <name>     Display name'));
  console.log(chalk.gray('    --command <cmd>   Shell command to execute'));
  console.log(chalk.gray('    --template <name> Use a predefined template'));
  console.log(chalk.gray('    --prefix <str>    Prefix for output'));
  console.log(chalk.gray('    --suffix <str>    Suffix for output'));
  console.log(chalk.gray('    --transform <t>   Output transformer'));
  console.log(chalk.gray('    --timeout <ms>    Execution timeout'));
  console.log(chalk.gray('    --cache <ms>      Cache timeout'));
  console.log(chalk.gray('    --fallback <str>  Fallback on error\n'));

  console.log('  dragon-ui-claude-cli custom-commands remove <id>');
  console.log(chalk.gray('    Remove a custom command\n'));

  console.log('  dragon-ui-claude-cli custom-commands test [options]');
  console.log(chalk.gray('    Test a command and show output'));
  console.log(chalk.gray('    --command <cmd>   Command to test'));
  console.log(chalk.gray('    --template <name> Template to test'));
  console.log(chalk.gray('    --id <id>         Saved command to test\n'));

  console.log('  dragon-ui-claude-cli custom-commands preview [options]');
  console.log(chalk.gray('    Preview command in statusline format'));
  console.log(chalk.gray('    --template <name> Template to preview'));
  console.log(chalk.gray('    --id <id>         Saved command to preview\n'));

  console.log('  dragon-ui-claude-cli custom-commands export [file]');
  console.log(chalk.gray('    Export saved commands to JSON file\n'));

  console.log('  dragon-ui-claude-cli custom-commands import <file>');
  console.log(chalk.gray('    Import commands from JSON file\n'));

  console.log(chalk.bold('Examples:\n'));
  console.log(chalk.gray('  # Add git branch widget'));
  console.log('  dragon-ui-claude-cli custom-commands add --template git-branch\n');
  console.log(chalk.gray('  # Add custom command'));
  console.log('  dragon-ui-claude-cli custom-commands add --command "uptime" --prefix "Up: "\n');
  console.log(chalk.gray('  # Test a template'));
  console.log('  dragon-ui-claude-cli custom-commands test --template node-version\n');
}

module.exports = {
  listTemplates,
  listTransformers,
  listCommands,
  addCommand,
  removeCommand,
  testCommand,
  exportCommands,
  importCommands,
  previewCommand,
  showHelp
};
