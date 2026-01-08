/**
 * Widget CLI Commands for Dragon-UI
 * Manage statusline widgets from the command line
 *
 * @module cli/commands/widgets
 */

'use strict';

const { widgetRegistry } = require('../widgets/widget-registry.cjs');
const {
  getAvailableWidgets,
  createDefaultRegistry
} = require('../widgets/index.cjs');

let chalk;
async function getChalk() {
  if (!chalk) {
    chalk = (await import('chalk')).default;
  }
  return chalk;
}

/**
 * List all available widgets
 */
async function listWidgets(options = {}) {
  const c = await getChalk();
  const widgets = getAvailableWidgets();

  console.log(c.bold('\nAvailable Widgets\n'));

  // Group by category
  const categories = {};
  for (const widget of widgets) {
    const cat = widget.category || 'other';
    if (!categories[cat]) {
      categories[cat] = [];
    }
    categories[cat].push(widget);
  }

  // Display by category
  const categoryOrder = ['core', 'git', 'tokens', 'cost', 'context', 'session', 'system', 'custom'];

  for (const cat of categoryOrder) {
    if (!categories[cat]) continue;

    const catName = cat.charAt(0).toUpperCase() + cat.slice(1);
    console.log(c.cyan.bold(`${catName} (${categories[cat].length})`));

    for (const widget of categories[cat]) {
      const enabled = widgetRegistry.has(widget.id);
      const status = enabled ? c.green('✓') : c.dim('○');
      console.log(`  ${status} ${c.bold(widget.id.padEnd(20))} ${c.dim(widget.description)}`);
    }
    console.log();
  }

  console.log(c.dim(`Total: ${widgets.length} widgets\n`));
}

/**
 * Show widget details
 */
async function showWidget(widgetId, options = {}) {
  const c = await getChalk();

  if (!widgetId) {
    console.log(c.red('Error: Widget ID is required'));
    console.log(c.dim('Usage: dragon-ui-claude-cli widgets show <widget-id>'));
    return;
  }

  const widgets = getAvailableWidgets();
  const widgetInfo = widgets.find(w => w.id === widgetId);

  if (!widgetInfo) {
    console.log(c.red(`Error: Widget "${widgetId}" not found`));
    console.log(c.dim('\nAvailable widgets:'));
    for (const w of widgets) {
      console.log(c.dim(`  - ${w.id}`));
    }
    return;
  }

  console.log(c.bold(`\nWidget: ${widgetInfo.name}\n`));

  console.log(`  ID:          ${widgetInfo.id}`);
  console.log(`  Category:    ${widgetInfo.category || 'other'}`);
  console.log(`  Description: ${widgetInfo.description}`);

  // Try to get instance for more details
  const registry = createDefaultRegistry();
  const widget = registry.get(widgetId);

  if (widget) {
    console.log(c.bold('\n  Configuration:'));
    console.log(`    Enabled:    ${widget.enabled ? c.green('Yes') : c.red('No')}`);
    console.log(`    Color:      ${widget.color.fg || 'default'}${widget.color.bg ? ` on ${widget.color.bg}` : ''}`);
    console.log(`    Bold:       ${widget.bold ? 'Yes' : 'No'}`);
    console.log(`    Raw:        ${widget.raw ? 'Yes' : 'No'}`);
    console.log(`    Merge:      ${widget.merge}`);
    if (widget.cacheTimeout) {
      console.log(`    Cache:      ${widget.cacheTimeout}ms`);
    }
  }

  console.log();
}

/**
 * Add widget to statusline
 */
async function addWidget(widgetId, options = {}) {
  const c = await getChalk();

  if (!widgetId) {
    console.log(c.red('Error: Widget ID is required'));
    return;
  }

  const widgets = getAvailableWidgets();
  if (!widgets.find(w => w.id === widgetId)) {
    console.log(c.red(`Error: Widget "${widgetId}" not found`));
    return;
  }

  const lineIndex = options.line ? parseInt(options.line, 10) : 0;
  const position = options.position ? parseInt(options.position, 10) : -1;

  const success = widgetRegistry.addToLine(widgetId, lineIndex, position);

  if (success) {
    console.log(c.green(`\nWidget "${widgetId}" added to line ${lineIndex + 1}\n`));
  } else {
    console.log(c.yellow(`\nWidget "${widgetId}" is already in the statusline\n`));
  }
}

/**
 * Remove widget from statusline
 */
async function removeWidget(widgetId, options = {}) {
  const c = await getChalk();

  if (!widgetId) {
    console.log(c.red('Error: Widget ID is required'));
    return;
  }

  const lineIndex = options.line ? parseInt(options.line, 10) : -1;
  const success = widgetRegistry.removeFromLine(widgetId, lineIndex);

  if (success) {
    console.log(c.green(`\nWidget "${widgetId}" removed from statusline\n`));
  } else {
    console.log(c.yellow(`\nWidget "${widgetId}" was not in the statusline\n`));
  }
}

/**
 * Configure a widget
 */
async function configureWidget(widgetId, options = {}) {
  const c = await getChalk();

  if (!widgetId) {
    console.log(c.red('Error: Widget ID is required'));
    return;
  }

  const config = {};

  if (options.fg) config.color = { ...config.color, fg: options.fg };
  if (options.bg) config.color = { ...config.color, bg: options.bg };
  if (options.bold !== undefined) config.bold = options.bold === 'true';
  if (options.raw !== undefined) config.raw = options.raw === 'true';
  if (options.enabled !== undefined) config.enabled = options.enabled !== 'false';
  if (options.merge) config.merge = options.merge;

  if (Object.keys(config).length === 0) {
    console.log(c.yellow('\nNo configuration options provided'));
    console.log(c.dim('Options: --fg, --bg, --bold, --raw, --enabled, --merge'));
    return;
  }

  const success = widgetRegistry.updateWidgetConfig(widgetId, config);

  if (success) {
    console.log(c.green(`\nWidget "${widgetId}" configuration updated\n`));
    for (const [key, value] of Object.entries(config)) {
      console.log(`  ${key}: ${JSON.stringify(value)}`);
    }
    console.log();
  } else {
    console.log(c.red(`\nFailed to update widget configuration\n`));
  }
}

/**
 * Reorder widget position
 */
async function reorderWidget(widgetId, position, options = {}) {
  const c = await getChalk();

  if (!widgetId || position === undefined) {
    console.log(c.red('Error: Widget ID and position are required'));
    console.log(c.dim('Usage: dragon-ui-claude-cli widgets reorder <widget-id> <position>'));
    return;
  }

  const lineIndex = options.line ? parseInt(options.line, 10) : 0;
  const newPosition = parseInt(position, 10);

  const success = widgetRegistry.reorderInLine(widgetId, lineIndex, newPosition);

  if (success) {
    console.log(c.green(`\nWidget "${widgetId}" moved to position ${newPosition + 1}\n`));
  } else {
    console.log(c.red(`\nFailed to reorder widget. Is it in line ${lineIndex + 1}?\n`));
  }
}

/**
 * Show current statusline layout
 */
async function showLayout(options = {}) {
  const c = await getChalk();
  const config = widgetRegistry.getStatuslineConfig();

  console.log(c.bold('\nStatusline Layout\n'));

  console.log(`  Enabled:   ${config.enabled ? c.green('Yes') : c.red('No')}`);
  console.log(`  Separator: "${config.separator}"`);
  console.log(`  Style:     ${config.style}`);
  console.log();

  if (config.lines.length === 0 || config.lines.every(l => l.length === 0)) {
    console.log(c.yellow('  No widgets configured\n'));
    console.log(c.dim('  Add widgets with: dragon-ui-claude-cli widgets add <widget-id>'));
    return;
  }

  for (let i = 0; i < config.lines.length; i++) {
    const line = config.lines[i];
    if (line.length === 0) continue;

    console.log(c.cyan(`  Line ${i + 1}:`));
    for (let j = 0; j < line.length; j++) {
      const widgetId = line[j];
      console.log(`    ${j + 1}. ${widgetId}`);
    }
    console.log();
  }
}

/**
 * Preview statusline with current data
 */
async function previewStatusline(options = {}) {
  const c = await getChalk();

  console.log(c.bold('\nStatusline Preview\n'));

  // Create mock data for preview
  const mockData = {
    model: 'claude-opus-4',
    branch: 'main',
    cwd: process.cwd(),
    session: {
      id: 'preview-session',
      startTime: new Date(Date.now() - 1800000), // 30 min ago
      cost: 0.15,
      inputTokens: 25000,
      outputTokens: 5000,
      cacheTokens: 15000,
      totalTokens: 45000
    },
    context: {
      used: 45000,
      max: 200000
    }
  };

  try {
    const registry = createDefaultRegistry();

    // Add some default widgets if none configured
    const config = registry.getStatuslineConfig();
    if (config.lines.length === 0 || config.lines.every(l => l.length === 0)) {
      ['model', 'git-branch', 'context-length', 'cost'].forEach((w, i) => {
        registry.addToLine(w, 0, i);
      });
    }

    const lines = await registry.renderStatusline(mockData);

    if (lines.length === 0) {
      console.log(c.yellow('  No widgets to display'));
    } else {
      for (const line of lines) {
        console.log(`  ${line}`);
      }
    }
  } catch (error) {
    console.log(c.red(`  Error: ${error.message}`));
  }

  console.log();
}

/**
 * Reset widget configuration
 */
async function resetWidgets(options = {}) {
  const c = await getChalk();

  if (!options.force) {
    console.log(c.yellow('\nWarning: This will reset all widget configuration'));
    console.log(c.dim('Use --force to confirm\n'));
    return;
  }

  // Clear all lines
  widgetRegistry.config.lines = [[]];
  widgetRegistry.config.widgets = {};
  widgetRegistry.saveConfig();

  console.log(c.green('\nWidget configuration reset to defaults\n'));
}

/**
 * Show widget categories
 */
async function showCategories() {
  const c = await getChalk();
  const widgets = getAvailableWidgets();

  console.log(c.bold('\nWidget Categories\n'));

  const categories = {};
  for (const widget of widgets) {
    const cat = widget.category || 'other';
    if (!categories[cat]) {
      categories[cat] = 0;
    }
    categories[cat]++;
  }

  for (const [cat, count] of Object.entries(categories)) {
    const catName = cat.charAt(0).toUpperCase() + cat.slice(1);
    console.log(`  ${catName.padEnd(15)} ${count} widget${count > 1 ? 's' : ''}`);
  }

  console.log(c.dim(`\nTotal: ${widgets.length} widgets\n`));
}

/**
 * Register widget commands
 * @param {Command} program - Commander program
 */
function registerCommands(program) {
  const widgets = program
    .command('widgets')
    .description('Manage statusline widgets')
    .addHelpText('after', `
Examples:
  dragon-ui-claude-cli widgets list
    List all available widgets

  dragon-ui-claude-cli widgets show model
    Show details for the model widget

  dragon-ui-claude-cli widgets add git-branch
    Add git-branch widget to statusline

  dragon-ui-claude-cli widgets add cost --line 1
    Add cost widget to line 2

  dragon-ui-claude-cli widgets remove model
    Remove model widget from statusline

  dragon-ui-claude-cli widgets configure model --fg cyan --bold true
    Configure the model widget

  dragon-ui-claude-cli widgets reorder cost 0
    Move cost widget to first position

  dragon-ui-claude-cli widgets layout
    Show current statusline layout

  dragon-ui-claude-cli widgets preview
    Preview the statusline
`);

  widgets
    .command('list')
    .alias('ls')
    .description('List all available widgets')
    .action(listWidgets);

  widgets
    .command('show <widget-id>')
    .description('Show widget details')
    .action(showWidget);

  widgets
    .command('add <widget-id>')
    .description('Add widget to statusline')
    .option('-l, --line <n>', 'Line number (0-based)', '0')
    .option('-p, --position <n>', 'Position in line (-1 for end)', '-1')
    .action(addWidget);

  widgets
    .command('remove <widget-id>')
    .description('Remove widget from statusline')
    .option('-l, --line <n>', 'Line number (-1 for all lines)', '-1')
    .action(removeWidget);

  widgets
    .command('configure <widget-id>')
    .description('Configure a widget')
    .option('--fg <color>', 'Foreground color')
    .option('--bg <color>', 'Background color')
    .option('--bold <bool>', 'Bold text')
    .option('--raw <bool>', 'Raw mode (no formatting)')
    .option('--enabled <bool>', 'Enable/disable widget')
    .option('--merge <mode>', 'Merge mode (left, right, both, none)')
    .action(configureWidget);

  widgets
    .command('reorder <widget-id> <position>')
    .description('Move widget to new position')
    .option('-l, --line <n>', 'Line number', '0')
    .action(reorderWidget);

  widgets
    .command('layout')
    .description('Show current statusline layout')
    .action(showLayout);

  widgets
    .command('preview')
    .description('Preview the statusline')
    .action(previewStatusline);

  widgets
    .command('categories')
    .description('Show widget categories')
    .action(showCategories);

  widgets
    .command('reset')
    .description('Reset widget configuration')
    .option('-f, --force', 'Confirm reset')
    .action(resetWidgets);

  return widgets;
}

module.exports = {
  registerCommands,
  listWidgets,
  showWidget,
  addWidget,
  removeWidget,
  configureWidget,
  reorderWidget,
  showLayout,
  previewStatusline,
  resetWidgets,
  showCategories
};
