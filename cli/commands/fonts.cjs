/**
 * Fonts CLI Commands for Dragon-UI
 * Manage Powerline/Nerd Font detection and installation
 *
 * @module cli/commands/fonts
 */

'use strict';

const { getFontManager, POWERLINE_SYMBOLS } = require('../utils/font-manager.cjs');

let chalk;
async function getChalk() {
  if (!chalk) {
    chalk = (await import('chalk')).default;
  }
  return chalk;
}

/**
 * Show font status
 */
async function showStatus(options = {}) {
  const c = await getChalk();

  console.log(c.bold('\nFont Status\n'));

  try {
    const manager = getFontManager();
    const status = manager.getStatus();

    console.log(c.bold('System\n'));
    console.log(`  Platform:     ${status.platform}`);
    console.log(`  Font Dir:     ${status.userFontDir}`);
    console.log(`  Total Fonts:  ${status.totalFonts}`);
    console.log(`  fc-list:      ${status.fcListAvailable ? c.green('Available') : c.gray('Not found')}`);
    console.log();

    console.log(c.bold('Powerline Status\n'));
    if (status.hasPowerlineFont) {
      console.log(`  ${c.green('✓')} Powerline fonts detected`);
      console.log(`  Found ${status.powerlineFonts} compatible font(s)`);
    } else {
      console.log(`  ${c.yellow('!')} No Powerline fonts detected`);
      console.log(c.dim('  Install a Nerd Font for best experience'));
    }
    console.log();

    console.log(c.bold('Recommended Fonts\n'));
    for (const [name, installed] of Object.entries(status.recommended)) {
      const icon = installed ? c.green('●') : c.gray('○');
      const status = installed ? c.green('Installed') : c.gray('Not installed');
      console.log(`  ${icon} ${name.padEnd(20)} ${status}`);
    }
    console.log();

    // Show detected fonts if verbose
    if (options.verbose && status.detectedPowerlineFonts.length > 0) {
      console.log(c.bold('Detected Powerline Fonts\n'));
      for (const font of status.detectedPowerlineFonts) {
        console.log(`  ${font.name}`);
        console.log(c.dim(`    ${font.path}`));
      }
      console.log();
    }

    // Test Powerline symbols
    if (options.test) {
      console.log(c.bold('Powerline Symbol Test\n'));
      console.log(c.dim('  If you see boxes or ? below, install a Nerd Font:'));
      console.log();

      const symbols = manager.getSymbols();
      console.log(`  Branch:      ${symbols.branch}  (should show branch icon)`);
      console.log(`  Right Arrow: ${symbols.rightArrow}  (should show arrow)`);
      console.log(`  Left Arrow:  ${symbols.leftArrow}  (should show arrow)`);
      console.log(`  Line:        ${symbols.line}  (should show line)`);
      console.log();
    }

  } catch (error) {
    console.log(c.red(`Error: ${error.message}\n`));
  }
}

/**
 * List available fonts for download
 */
async function listAvailable() {
  const c = await getChalk();

  console.log(c.bold('\nAvailable Fonts for Installation\n'));

  try {
    const manager = getFontManager();
    const fonts = manager.getAvailableFonts();
    const status = manager.getStatus();

    const headers = ['Font', 'Status', 'Description'];
    const widths = [20, 12, 45];

    console.log(c.dim(headers.map((h, i) => h.padEnd(widths[i])).join(' ')));
    console.log(c.dim('-'.repeat(widths.reduce((a, b) => a + b + 1, 0))));

    for (const font of fonts) {
      const isInstalled = status.recommended[font.name] ||
                         status.recommended[font.name.replace('NerdFont', '')] ||
                         false;

      const statusText = isInstalled ? c.green('Installed') : c.gray('Available');

      const row = [
        font.name.slice(0, widths[0] - 1).padEnd(widths[0]),
        statusText.padEnd(widths[1] + 10), // Extra for ANSI codes
        font.description.slice(0, widths[2] - 1).padEnd(widths[2])
      ];

      console.log(row.join(' '));
    }
    console.log();

    console.log(c.dim('Use "fonts install <name>" to install a font.'));
    console.log(c.dim('Recommended: MesloNerdFont or FiraCodeNerdFont for Powerline support.\n'));

  } catch (error) {
    console.log(c.red(`Error: ${error.message}\n`));
  }
}

/**
 * Install a font
 */
async function installFont(fontName, options = {}) {
  const c = await getChalk();

  if (!fontName) {
    console.log(c.red('\nError: Font name is required.\n'));
    await listAvailable();
    return;
  }

  console.log(c.bold(`\nInstalling ${fontName}\n`));

  try {
    const manager = getFontManager();

    // Check if font exists
    const fonts = manager.getAvailableFonts();
    const font = fonts.find(f => f.name.toLowerCase() === fontName.toLowerCase());

    if (!font) {
      console.log(c.red(`Font not found: ${fontName}`));
      console.log(c.dim('Available fonts:'));
      for (const f of fonts) {
        console.log(c.dim(`  - ${f.name}`));
      }
      console.log();
      return;
    }

    // Progress callback
    let lastMessage = '';
    const progress = (message) => {
      if (message !== lastMessage) {
        console.log(c.dim(`  ${message}`));
        lastMessage = message;
      }
    };

    const result = await manager.installFont(font.name, progress);

    if (result.success) {
      console.log(c.green(`\n✓ ${font.name} installed successfully!\n`));
      console.log(`  Installed ${result.installedCount} font files`);
      console.log(`  Location: ${result.installDir}`);
      console.log();

      if (process.platform !== 'darwin') {
        console.log(c.dim('Note: You may need to restart your terminal for fonts to appear.'));
      }
      console.log(c.dim('Configure your terminal to use the new font.\n'));
    } else {
      console.log(c.red(`\nInstallation failed: ${result.error}\n`));
    }

  } catch (error) {
    console.log(c.red(`Error: ${error.message}\n`));
  }
}

/**
 * Test Powerline symbols
 */
async function testSymbols() {
  const c = await getChalk();

  console.log(c.bold('\nPowerline Symbol Test\n'));

  const manager = getFontManager();
  const symbols = manager.getSymbols();

  console.log('If symbols render correctly, you have Powerline font support.\n');

  // Demo status line
  console.log(c.bold('Demo Status Line:\n'));

  const demo = [
    c.bgBlue.white(` main ${symbols.branch} `),
    c.blue.bgGreen(symbols.rightArrow),
    c.bgGreen.black(' +3 -1 '),
    c.green.bgYellow(symbols.rightArrow),
    c.bgYellow.black(' 1,234 tokens '),
    c.yellow.bgMagenta(symbols.rightArrow),
    c.bgMagenta.white(' $0.05 '),
    c.magenta(symbols.rightArrow)
  ].join('');

  console.log(`  ${demo}\n`);

  // Individual symbols
  console.log(c.bold('Individual Symbols:\n'));

  const testCases = [
    { name: 'Branch', symbol: symbols.branch, unicode: 'E0A0' },
    { name: 'Line Number', symbol: symbols.line, unicode: 'E0A1' },
    { name: 'Lock', symbol: symbols.lock, unicode: 'E0A2' },
    { name: 'Right Arrow', symbol: symbols.rightArrow, unicode: 'E0B0' },
    { name: 'Right Thin', symbol: symbols.rightThin, unicode: 'E0B1' },
    { name: 'Left Arrow', symbol: symbols.leftArrow, unicode: 'E0B2' },
    { name: 'Left Thin', symbol: symbols.leftThin, unicode: 'E0B3' }
  ];

  for (const test of testCases) {
    console.log(`  ${test.symbol}  ${test.name.padEnd(15)} (U+${test.unicode})`);
  }
  console.log();

  console.log(c.dim('If you see boxes or question marks, install a Nerd Font:'));
  console.log(c.dim('  dragon-ui-claude-cli fonts install MesloNerdFont\n'));
}

/**
 * Show font directories
 */
async function showDirectories() {
  const c = await getChalk();

  console.log(c.bold('\nFont Directories\n'));

  const manager = getFontManager();

  console.log(c.bold('User Font Directory:\n'));
  console.log(`  ${manager.getUserFontDir()}\n`);

  console.log(c.bold('System Font Directories:\n'));
  for (const dir of manager.fontDirs) {
    const exists = require('fs').existsSync(dir);
    const status = exists ? c.green('✓') : c.gray('○');
    console.log(`  ${status} ${dir}`);
  }
  console.log();
}

/**
 * Show help
 */
async function showHelp() {
  const c = await getChalk();

  console.log(c.bold('\nFont Commands\n'));

  console.log(c.cyan('  fonts'));
  console.log('    Show font status');
  console.log(c.dim('    Options: --verbose, --test'));
  console.log();

  console.log(c.cyan('  fonts list'));
  console.log('    List available fonts for download');
  console.log();

  console.log(c.cyan('  fonts install <name>'));
  console.log('    Download and install a font');
  console.log();

  console.log(c.cyan('  fonts test'));
  console.log('    Test Powerline symbol rendering');
  console.log();

  console.log(c.cyan('  fonts dirs'));
  console.log('    Show font directories');
  console.log();

  console.log(c.bold('Available Fonts:\n'));
  console.log(c.dim('  FiraCode          Monospaced with ligatures'));
  console.log(c.dim('  JetBrainsMono     Developer font with ligatures'));
  console.log(c.dim('  CascadiaCode      Microsoft Windows Terminal font'));
  console.log(c.dim('  Hack              Readable source code font'));
  console.log(c.dim('  MesloNerdFont     Meslo with Nerd Font icons (recommended)'));
  console.log(c.dim('  FiraCodeNerdFont  Fira Code with Nerd Font icons'));
  console.log();

  console.log(c.bold('Examples:\n'));
  console.log(c.dim('  dragon-ui-claude-cli fonts'));
  console.log(c.dim('  dragon-ui-claude-cli fonts --test'));
  console.log(c.dim('  dragon-ui-claude-cli fonts install MesloNerdFont'));
  console.log();
}

/**
 * Register font commands
 * @param {Command} program
 */
function registerCommands(program) {
  const fonts = program
    .command('fonts')
    .description('Manage Powerline/Nerd Fonts')
    .option('-v, --verbose', 'Show detailed information')
    .option('-t, --test', 'Test Powerline symbol rendering')
    .action(showStatus);

  fonts
    .command('list')
    .description('List available fonts for download')
    .action(listAvailable);

  fonts
    .command('install <name>')
    .description('Download and install a font')
    .action(installFont);

  fonts
    .command('test')
    .description('Test Powerline symbol rendering')
    .action(testSymbols);

  fonts
    .command('dirs')
    .description('Show font directories')
    .action(showDirectories);

  fonts
    .command('help')
    .description('Show font help')
    .action(showHelp);

  return fonts;
}

module.exports = {
  registerCommands,
  showStatus,
  listAvailable,
  installFont,
  testSymbols,
  showDirectories,
  showHelp
};
