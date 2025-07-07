/**
 * CLI Navigation System (CommonJS)
 * Handles page navigation and user input
 */

const { createInterface } = require('readline');
const { colors } = require('../components/colors.cjs');

/**
 * Create readline interface for user input
 */
function createInputInterface() {
  return createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: colors.primary('Enter command (0-6): ')
  });
}

/**
 * Display navigation menu
 */
function showNavigationMenu(currentPage = null) {
  const menu = [
    '',
    colors.header('┌─────────────────────────────────────────────────────┐'),
    colors.header('│  🐲 DRAGON UI CLI - Usage Tracker                   │'),
    colors.header('│  Commands: [0] Return [1-6] Pages [s] Settings      │'),
    colors.header('├─────────────────────────────────────────────────────┤'),
    colors.header('│  1. Overview    4. Monthly     [q] Quit             │'),
    colors.header('│  2. Projects    5. Daily       [r] Refresh          │'),
    colors.header('│  3. Sessions    6. Active      [h] Help             │'),
    colors.header('└─────────────────────────────────────────────────────┘'),
    ''
  ];
  
  if (currentPage) {
    menu.push(colors.subtitle(`Current page: ${currentPage}`));
    menu.push('');
  }
  
  return menu.join('\n');
}

/**
 * Show page header
 */
function showPageHeader(title, subtitle = '') {
  const header = [
    '',
    colors.header('┌─────────────────────────────────────────────────────┐'),
    colors.header(`│  🐲 ${title.padEnd(44)} │`),
    colors.header('│  [0] Return to Menu                                 │'),
    colors.header('└─────────────────────────────────────────────────────┘'),
    ''
  ];
  
  if (subtitle) {
    header.push(colors.subtitle(subtitle));
    header.push('');
  }
  
  return header.join('\n');
}

/**
 * Parse user input command
 */
function parseCommand(input) {
  const command = input.toString().trim().toLowerCase();
  
  // Number commands (pages)
  if (/^[0-6]$/.test(command)) {
    return { type: 'page', value: parseInt(command) };
  }
  
  // Letter commands
  switch (command) {
    case 'q':
    case 'quit':
    case 'exit':
      return { type: 'quit' };
    
    case 'r':
    case 'refresh':
      return { type: 'refresh' };
    
    case 's':
    case 'settings':
      return { type: 'settings' };
    
    case 'h':
    case 'help':
      return { type: 'help' };
    
    case 'c':
    case 'clear':
      return { type: 'clear' };
    
    default:
      return { type: 'invalid', value: command };
  }
}

/**
 * Get page name from number
 */
function getPageName(pageNumber) {
  const pages = {
    0: 'Main Menu',
    1: 'Overview',
    2: 'Projects',
    3: 'Sessions',
    4: 'Monthly',
    5: 'Daily',
    6: 'Active'
  };
  
  return pages[pageNumber] || 'Unknown';
}

/**
 * Clear screen
 */
function clearScreen() {
  console.clear();
}

/**
 * Show loading indicator
 */
function showLoading(message = 'Loading...') {
  const spinner = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  let i = 0;
  
  const interval = setInterval(() => {
    process.stdout.write(`\r${colors.primary(spinner[i % spinner.length])} ${message}`);
    i++;
  }, 100);
  
  return () => {
    clearInterval(interval);
    process.stdout.write('\r' + ' '.repeat(message.length + 2) + '\r');
  };
}

/**
 * Show error message
 */
function showError(message) {
  console.log(colors.error('✗ Error: ' + message));
}

/**
 * Show success message
 */
function showSuccess(message) {
  console.log(colors.success('✓ ' + message));
}

/**
 * Show warning message
 */
function showWarning(message) {
  console.log(colors.warning('⚠ ' + message));
}

/**
 * Show info message
 */
function showInfo(message) {
  console.log(colors.info('ℹ ' + message));
}

/**
 * Confirm action
 */
function confirmAction(message) {
  return new Promise((resolve) => {
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    rl.question(colors.warning(`${message} (y/N): `), (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
    });
  });
}

/**
 * Wait for user input
 */
function waitForInput(prompt = 'Press Enter to continue...') {
  return new Promise((resolve) => {
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    rl.question(colors.subtitle(prompt), () => {
      rl.close();
      resolve();
    });
  });
}

/**
 * Show help text
 */
function showHelp() {
  const help = [
    '',
    colors.header('🐲 Dragon UI CLI - Help'),
    colors.header('─'.repeat(50)),
    '',
    colors.title('Navigation Commands:'),
    colors.subtitle('  0 - Return to main menu'),
    colors.subtitle('  1 - Overview (dashboard data)'),
    colors.subtitle('  2 - Projects (project statistics)'),
    colors.subtitle('  3 - Sessions (session history)'),
    colors.subtitle('  4 - Monthly (monthly statistics)'),
    colors.subtitle('  5 - Daily (daily usage)'),
    colors.subtitle('  6 - Active (current session)'),
    '',
    colors.title('Control Commands:'),
    colors.subtitle('  q - Quit application'),
    colors.subtitle('  r - Refresh current page'),
    colors.subtitle('  s - Settings menu'),
    colors.subtitle('  h - Show this help'),
    colors.subtitle('  c - Clear screen'),
    '',
    colors.title('Settings:'),
    colors.subtitle('  Toggle colors: on/off'),
    colors.subtitle('  Table style: ascii/minimal'),
    colors.subtitle('  Refresh interval: 1-60 seconds'),
    colors.subtitle('  Compact mode: on/off'),
    '',
    colors.title('Features:'),
    colors.subtitle('  • Live data updates'),
    colors.subtitle('  • Same database as Electron app'),
    colors.subtitle('  • Multi-currency support'),
    colors.subtitle('  • Customizable display'),
    '',
    colors.primary('Press any key to continue...'),
    ''
  ];
  
  return help.join('\n');
}

module.exports = {
  createInputInterface,
  showNavigationMenu,
  showPageHeader,
  parseCommand,
  getPageName,
  clearScreen,
  showLoading,
  showError,
  showSuccess,
  showWarning,
  showInfo,
  confirmAction,
  waitForInput,
  showHelp
};