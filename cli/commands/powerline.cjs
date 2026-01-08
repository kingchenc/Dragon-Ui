/**
 * Powerline CLI Commands
 * Commands for managing powerline mode and themes
 */

const { PowerlineRenderer, SEPARATORS } = require('../powerline/powerline-renderer.cjs');
const { themeManager, BUILTIN_THEMES } = require('../powerline/theme-manager.cjs');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Settings file path
const SETTINGS_FILE = path.join(os.homedir(), '.dragon-ui-powerline.json');

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
 * Load powerline settings
 */
function loadSettings() {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      return JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'));
    }
  } catch {
    // Return defaults on error
  }

  return {
    enabled: false,
    theme: 'dragon',
    separatorType: 'arrows',
    useThinSeparators: false,
    showStartCap: true,
    showEndCap: true
  };
}

/**
 * Save powerline settings
 */
function saveSettings(settings) {
  try {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2));
    return true;
  } catch {
    return false;
  }
}

/**
 * Enable powerline mode
 */
async function enablePowerline(themeName = 'dragon') {
  const chalk = await getChalk();
  const settings = loadSettings();

  settings.enabled = true;
  settings.theme = themeName;

  if (saveSettings(settings)) {
    console.log(chalk.green('\nPowerline mode enabled!'));
    console.log(`Theme: ${chalk.cyan(themeName)}`);
    console.log(`\nNote: Powerline requires a patched font (e.g., Nerd Fonts)`);
    await showPreview(themeName);
  } else {
    console.log(chalk.red('Failed to save settings'));
  }
}

/**
 * Disable powerline mode
 */
async function disablePowerline() {
  const chalk = await getChalk();
  const settings = loadSettings();

  settings.enabled = false;

  if (saveSettings(settings)) {
    console.log(chalk.yellow('\nPowerline mode disabled'));
    console.log('Statusline will use classic style');
  } else {
    console.log(chalk.red('Failed to save settings'));
  }
}

/**
 * Set powerline theme
 */
async function setTheme(themeName) {
  const chalk = await getChalk();

  if (!themeManager.themes.has(themeName)) {
    console.log(chalk.red(`\nTheme not found: ${themeName}`));
    console.log(`Available themes: ${themeManager.getThemeIds().join(', ')}`);
    return;
  }

  const settings = loadSettings();
  settings.theme = themeName;

  if (saveSettings(settings)) {
    console.log(chalk.green(`\nTheme set to: ${themeName}`));
    await showPreview(themeName);
  } else {
    console.log(chalk.red('Failed to save settings'));
  }
}

/**
 * Set separator type
 */
async function setSeparator(separatorType) {
  const chalk = await getChalk();

  if (!SEPARATORS[separatorType]) {
    console.log(chalk.red(`\nSeparator type not found: ${separatorType}`));
    console.log(`Available types: ${Object.keys(SEPARATORS).join(', ')}`);
    return;
  }

  const settings = loadSettings();
  settings.separatorType = separatorType;

  if (saveSettings(settings)) {
    console.log(chalk.green(`\nSeparator type set to: ${separatorType}`));
    await showPreview(settings.theme);
  } else {
    console.log(chalk.red('Failed to save settings'));
  }
}

/**
 * Show preview of a theme
 */
async function showPreview(themeName = null) {
  const chalk = await getChalk();
  const settings = loadSettings();
  const themeId = themeName || settings.theme;
  const theme = themeManager.getTheme(themeId);

  console.log(chalk.bold(`\n=== Theme Preview: ${theme.name} ===\n`));

  // Sample segments
  const sampleData = [
    { content: 'claude-sonnet-4.5', fg: 'white' },
    { content: 'main', fg: 'white' },
    { content: '45k / 200k', fg: 'white' },
    { content: '$2.45', fg: 'white' }
  ];

  // Apply theme colors
  const coloredData = sampleData.map((segment, i) => ({
    ...segment,
    bg: theme.colors ? theme.colors[i % theme.colors.length] : '#333333'
  }));

  // Render with different separator types
  const separatorTypes = ['arrows', 'blocks', 'triangles', 'slant'];

  for (const sepType of separatorTypes) {
    const renderer = new PowerlineRenderer({ separatorType: sepType });
    const line = renderer.renderLine(coloredData);
    console.log(`  ${sepType.padEnd(12)} ${line}`);
  }

  console.log();
}

/**
 * List all available themes
 */
async function listThemes() {
  const chalk = await getChalk();
  const themes = themeManager.getAllThemes();
  const settings = loadSettings();

  console.log(chalk.bold('\n=== Available Themes ===\n'));

  for (const theme of themes) {
    const isCurrent = theme.id === settings.theme;
    const marker = isCurrent ? chalk.green(' (current)') : '';
    const customBadge = theme.custom ? chalk.gray(' [custom]') : '';

    console.log(`  ${chalk.cyan(theme.id.padEnd(15))} ${theme.name}${marker}${customBadge}`);
    console.log(`  ${' '.repeat(15)} ${chalk.gray(theme.description)}`);
  }

  console.log(`\nTotal: ${themes.length} themes`);
  console.log(`\nUse: dragon-ui-claude-cli powerline theme <name>`);
}

/**
 * List all separator types
 */
async function listSeparators() {
  const chalk = await getChalk();
  const settings = loadSettings();

  console.log(chalk.bold('\n=== Separator Types ===\n'));

  for (const type of Object.keys(SEPARATORS)) {
    const sep = SEPARATORS[type];
    const isCurrent = type === settings.separatorType;
    const marker = isCurrent ? chalk.green(' (current)') : '';

    console.log(`  ${chalk.cyan(type.padEnd(12))} ${sep.right} ${sep.rightThin}${marker}`);
  }

  console.log(`\nUse: dragon-ui-claude-cli powerline separator <type>`);
}

/**
 * Show powerline status
 */
async function showStatus() {
  const chalk = await getChalk();
  const settings = loadSettings();

  console.log(chalk.bold('\n=== Powerline Status ===\n'));

  console.log(`  Enabled:    ${settings.enabled ? chalk.green('Yes') : chalk.red('No')}`);
  console.log(`  Theme:      ${chalk.cyan(settings.theme)}`);
  console.log(`  Separator:  ${chalk.cyan(settings.separatorType)}`);
  console.log(`  Thin:       ${settings.useThinSeparators ? 'Yes' : 'No'}`);
  console.log(`  Start Cap:  ${settings.showStartCap ? 'Yes' : 'No'}`);
  console.log(`  End Cap:    ${settings.showEndCap ? 'Yes' : 'No'}`);

  if (settings.enabled) {
    console.log('\n' + chalk.gray('Preview:'));
    await showPreview(settings.theme);
  }
}

/**
 * Preview all themes
 */
async function previewAllThemes() {
  const chalk = await getChalk();
  const themes = themeManager.getAllThemes();

  console.log(chalk.bold('\n=== All Themes Preview ===\n'));

  const sampleData = [
    { content: 'Model' },
    { content: 'Branch' },
    { content: 'Tokens' },
    { content: 'Cost' }
  ];

  const renderer = new PowerlineRenderer({ separatorType: 'arrows' });

  for (const themeMeta of themes) {
    const theme = themeManager.getTheme(themeMeta.id);

    const coloredData = sampleData.map((segment, i) => ({
      ...segment,
      fg: 'white',
      bg: theme.colors ? theme.colors[i % theme.colors.length] : '#333333'
    }));

    const line = renderer.renderLine(coloredData);
    console.log(`  ${chalk.cyan(themeMeta.id.padEnd(15))} ${line}`);
  }

  console.log(`\nUse: dragon-ui-claude-cli powerline theme <name>`);
}

/**
 * Show help for powerline commands
 */
async function showHelp() {
  const chalk = await getChalk();

  console.log(chalk.bold('\n=== Powerline Commands ===\n'));

  console.log('  dragon-ui-claude-cli powerline enable [theme]');
  console.log(chalk.gray('    Enable powerline mode with optional theme\n'));

  console.log('  dragon-ui-claude-cli powerline disable');
  console.log(chalk.gray('    Disable powerline mode\n'));

  console.log('  dragon-ui-claude-cli powerline theme <name>');
  console.log(chalk.gray('    Set powerline theme\n'));

  console.log('  dragon-ui-claude-cli powerline themes');
  console.log(chalk.gray('    List all available themes\n'));

  console.log('  dragon-ui-claude-cli powerline separator <type>');
  console.log(chalk.gray('    Set separator type (arrows, blocks, triangles, slant)\n'));

  console.log('  dragon-ui-claude-cli powerline separators');
  console.log(chalk.gray('    List all separator types\n'));

  console.log('  dragon-ui-claude-cli powerline preview');
  console.log(chalk.gray('    Preview current theme\n'));

  console.log('  dragon-ui-claude-cli powerline preview-all');
  console.log(chalk.gray('    Preview all themes\n'));

  console.log('  dragon-ui-claude-cli powerline status');
  console.log(chalk.gray('    Show current powerline status\n'));

  console.log(chalk.yellow('\nNote: Powerline requires a patched font (e.g., Nerd Fonts, Powerline Fonts)'));
}

/**
 * Check if powerline is enabled
 */
function isPowerlineEnabled() {
  const settings = loadSettings();
  return settings.enabled;
}

/**
 * Get powerline configuration
 */
function getPowerlineConfig() {
  return loadSettings();
}

module.exports = {
  enablePowerline,
  disablePowerline,
  setTheme,
  setSeparator,
  showPreview,
  listThemes,
  listSeparators,
  showStatus,
  previewAllThemes,
  showHelp,
  isPowerlineEnabled,
  getPowerlineConfig,
  loadSettings,
  saveSettings
};
