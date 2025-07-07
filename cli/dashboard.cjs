/**
 * CLI Dashboard - Main Menu with Live Updates (CommonJS)
 * Interactive command selection and dashboard data display
 */

const { createInterface } = require('readline');
const figlet = require('figlet');
const CLIDataAdapter = require('./data-adapter.cjs');
const { loadSettings, saveSettings, toggleSetting } = require('./settings.cjs');
const { colors, setColorMode, initChalk } = require('./components/colors.cjs');
const { createStatsTable } = require('./components/table.cjs');
const { 
  showNavigationMenu, 
  showPageHeader, 
  parseCommand, 
  getPageName, 
  clearScreen, 
  showLoading, 
  showError, 
  showSuccess, 
  showHelp,
  waitForInput
} = require('./utils/navigation.cjs');
const { createBox, createTimestampHeader } = require('./utils/screen.cjs');

// Import page modules
const showOverviewPage = require('./pages/overview.cjs');
const showProjectsPage = require('./pages/projects.cjs');
const showSessionsPage = require('./pages/sessions.cjs');
const showMonthlyPage = require('./pages/monthly.cjs');
const showDailyPage = require('./pages/daily.cjs');
const showActivePage = require('./pages/active.cjs');

class CLIDashboard {
  constructor(settings) {
    this.settings = settings;
    this.dataAdapter = new CLIDataAdapter(settings);
    this.currentPage = 0; // 0 = main menu
    this.isRunning = false;
    this.refreshInterval = null;
    this.rl = null;
    this.lastUpdateTime = 0;
    
    // Apply color settings
    setColorMode(settings.useColors);
  }

  /**
   * Start the CLI dashboard
   */
  async start() {
    // Clear screen immediately
    clearScreen();
    
    this.isRunning = true;
    
    // Initialize chalk first
    await initChalk();
    
    // Initialize data adapter
    const loadingStop = showLoading('Initializing database...');
    const initialized = await this.dataAdapter.init();
    loadingStop();
    
    if (!initialized) {
      showError('Failed to initialize database. Please check your setup.');
      process.exit(1);
    }

    // Clear screen before showing welcome
    clearScreen();
    
    // Show welcome screen
    await this.showWelcomeScreen();
    
    // Start main loop
    await this.mainLoop();
  }

  /**
   * Show welcome screen with ASCII art
   */
  async showWelcomeScreen() {
    clearScreen();
    
    try {
      const asciiArt = figlet.textSync('DRAGON UI', {
        font: 'Small',
        horizontalLayout: 'fitted'
      });
      
      console.log(colors.primary(asciiArt));
      console.log(colors.subtitle('🐲 Claude Code Max Usage Dashboard - CLI Version'));
      console.log(colors.subtitle('─'.repeat(60)));
      console.log('');
      console.log(colors.info('✓ Database connected'));
      console.log(colors.info('✓ Settings loaded'));
      console.log(colors.info('✓ Live updates enabled'));
      console.log('');
    } catch (error) {
      console.log(colors.primary('🐲 DRAGON UI CLI'));
      console.log(colors.subtitle('Claude Code Max Usage Dashboard'));
      console.log('');
    }
  }

  /**
   * Main application loop
   */
  async mainLoop() {
    while (this.isRunning) {
      try {
        await this.displayCurrentPage();
        await this.handleUserInput();
      } catch (error) {
        showError('An error occurred: ' + error.message);
        await waitForInput();
      }
    }
  }

  /**
   * Display current page content
   */
  async displayCurrentPage() {
    clearScreen();
    
    const timestamp = createTimestampHeader(
      `🐲 Dragon UI CLI - ${getPageName(this.currentPage)}`,
      80
    );
    
    console.log(timestamp);
    console.log('');

    switch (this.currentPage) {
      case 0:
        await this.showMainMenu();
        break;
      case 1:
        await showOverviewPage(this.dataAdapter, this.settings);
        break;
      case 2:
        await showProjectsPage(this.dataAdapter, this.settings);
        break;
      case 3:
        await showSessionsPage(this.dataAdapter, this.settings);
        break;
      case 4:
        await showMonthlyPage(this.dataAdapter, this.settings);
        break;
      case 5:
        await showDailyPage(this.dataAdapter, this.settings);
        break;
      case 6:
        await showActivePage(this.dataAdapter, this.settings);
        break;
      default:
        await this.showMainMenu();
    }
  }

  /**
   * Show main menu with dashboard summary
   */
  async showMainMenu() {
    console.log(showNavigationMenu());
    
    // Show dashboard summary
    try {
      const loadingStop = showLoading('Loading dashboard data...');
      const data = await this.dataAdapter.getOverviewData();
      loadingStop();
      
      console.log(colors.primary('Dashboard Summary:'));
      console.log('─'.repeat(50));
      console.log('');
      
      // Quick stats
      const table = createStatsTable({
        totalCost: data.totalCost,
        totalSessions: data.totalSessions,
        totalProjects: data.totalProjects,
        totalTokens: data.totalTokens,
        activeDays: data.activeDays,
        lastActivity: data.lastActivity,
        currency: data.currency
      }, {
        style: this.settings.tableStyle,
        compact: this.settings.compactMode
      });
      
      console.log(table);
      console.log('');
      
      // Current month highlight
      if (data.currentMonth && data.currentMonth.total_cost > 0) {
        console.log(colors.highlight('This Month: ') + 
          colors.currency(`$${data.currentMonth.total_cost.toFixed(6)} ${data.currency}`) + 
          ' (' + colors.number(data.currentMonth.session_count.toString()) + ' sessions)');
        console.log('');
      }
      
      // Settings info
      console.log(colors.subtitle(`Settings: ${this.settings.useColors ? 'Color' : 'Monochrome'} • ${this.settings.tableStyle} tables • ${this.settings.refreshInterval/1000}s refresh`));
      console.log('');
      
    } catch (error) {
      showError('Failed to load dashboard data: ' + error.message);
      console.log('');
    }
  }

  /**
   * Handle user input
   */
  async handleUserInput() {
    return new Promise((resolve) => {
      if (this.rl) {
        this.rl.close();
      }
      
      this.rl = createInterface({
        input: process.stdin,
        output: process.stdout
      });
      
      this.rl.question(colors.primary('Enter command (0=Menu, 1-6=Pages, q=Quit, r=Refresh, s=Settings, h=Help): '), async (input) => {
        const command = parseCommand(input);
        
        switch (command.type) {
          case 'page':
            await this.handlePageCommand(command.value);
            break;
          case 'quit':
            await this.handleQuit();
            break;
          case 'refresh':
            await this.handleRefresh();
            break;
          case 'settings':
            await this.handleSettings();
            break;
          case 'help':
            await this.handleHelp();
            break;
          case 'clear':
            clearScreen();
            break;
          case 'invalid':
            showError(`Invalid command: ${command.value}`);
            await waitForInput();
            break;
        }
        
        resolve();
      });
    });
  }

  /**
   * Handle page navigation
   */
  async handlePageCommand(pageNumber) {
    if (pageNumber >= 0 && pageNumber <= 6) {
      this.currentPage = pageNumber;
      
      // If going to a specific page, refresh data
      if (pageNumber > 0) {
        this.dataAdapter.clearCache();
      }
    } else {
      showError('Invalid page number. Use 0-6.');
      await waitForInput();
    }
  }

  /**
   * Handle quit command
   */
  async handleQuit() {
    console.log('');
    console.log(colors.primary('🐲 Thanks for using Dragon UI CLI!'));
    console.log(colors.subtitle('May your code be bug-free and your dragons happy.'));
    console.log('');
    
    this.isRunning = false;
    
    if (this.rl) {
      this.rl.close();
    }
    
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }
    
    process.exit(0);
  }

  /**
   * Handle refresh command
   */
  async handleRefresh() {
    const loadingStop = showLoading('Refreshing data...');
    
    try {
      await this.dataAdapter.refreshAll();
      loadingStop();
      showSuccess('Data refreshed successfully!');
    } catch (error) {
      loadingStop();
      showError('Failed to refresh data: ' + error.message);
    }
    
    await waitForInput();
  }

  /**
   * Handle settings menu
   */
  async handleSettings() {
    clearScreen();
    
    console.log(colors.header('🐲 Dragon UI CLI - Settings'));
    console.log('─'.repeat(50));
    console.log('');
    
    console.log('Current Settings:');
    console.log(`  Colors: ${this.settings.useColors ? colors.success('Enabled') : colors.inactive('Disabled')}`);
    console.log(`  Table Style: ${colors.highlight(this.settings.tableStyle)}`);
    console.log(`  Refresh Interval: ${colors.number(this.settings.refreshInterval/1000)}s`);
    console.log(`  Compact Mode: ${this.settings.compactMode ? colors.success('Enabled') : colors.inactive('Disabled')}`);
    console.log('');
    
    console.log('Commands:');
    console.log('  1 - Toggle colors');
    console.log('  2 - Toggle table style');
    console.log('  3 - Toggle compact mode');
    console.log('  4 - Set refresh interval');
    console.log('  0 - Back to main menu');
    console.log('');
    
    const settingsRl = createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    return new Promise((resolve) => {
      settingsRl.question(colors.primary('Enter setting command: '), async (input) => {
        const command = input.trim();
        
        switch (command) {
          case '1':
            this.settings = await toggleSetting('colors');
            setColorMode(this.settings.useColors);
            showSuccess(this.settings.useColors ? 'Colors enabled' : 'Colors disabled');
            break;
          case '2':
            this.settings = await toggleSetting('tables');
            showSuccess(`Table style: ${this.settings.tableStyle}`);
            break;
          case '3':
            this.settings = await toggleSetting('compact');
            showSuccess(this.settings.compactMode ? 'Compact mode enabled' : 'Compact mode disabled');
            break;
          case '4':
            settingsRl.question('Enter refresh interval (1-60 seconds): ', async (seconds) => {
              const interval = parseInt(seconds);
              if (interval >= 1 && interval <= 60) {
                this.settings.refreshInterval = interval * 1000;
                await saveSettings(this.settings);
                showSuccess(`Refresh interval set to ${interval} seconds`);
              } else {
                showError('Invalid interval. Use 1-60 seconds.');
              }
              settingsRl.close();
              await waitForInput();
              resolve();
            });
            return;
          case '0':
            break;
          default:
            showError('Invalid command');
        }
        
        settingsRl.close();
        await waitForInput();
        resolve();
      });
    });
  }

  /**
   * Handle help command
   */
  async handleHelp() {
    clearScreen();
    console.log(showHelp());
    await waitForInput();
  }
}

/**
 * Start CLI dashboard
 */
async function startCLI(settings) {
  const dashboard = new CLIDashboard(settings);
  await dashboard.start();
}

module.exports = { startCLI, CLIDashboard };