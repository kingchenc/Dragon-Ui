/**
 * Interactive TUI Dashboard
 * Full-screen terminal user interface for Dragon UI
 * Uses blessed-contrib for rich terminal widgets
 */

const { EventEmitter } = require('events');

/**
 * TUI Dashboard component types
 */
const COMPONENT_TYPES = {
  BOX: 'box',
  LIST: 'list',
  TABLE: 'table',
  LOG: 'log',
  GAUGE: 'gauge',
  SPARKLINE: 'sparkline',
  BAR: 'bar',
  TREE: 'tree',
  MARKDOWN: 'markdown',
  DONUT: 'donut',
  LCD: 'lcd',
  MAP: 'map',
  PICTURE: 'picture'
};

/**
 * Default layout grid
 */
const DEFAULT_GRID = {
  rows: 12,
  cols: 12
};

/**
 * TUI Theme definitions
 */
const THEMES = {
  dragon: {
    name: 'Dragon',
    colors: {
      primary: 'red',
      secondary: 'yellow',
      accent: 'white',
      background: 'black',
      border: 'red',
      text: 'white',
      muted: 'gray',
      success: 'green',
      warning: 'yellow',
      error: 'red'
    },
    borderType: 'line',
    focusStyle: { border: { fg: 'yellow' } }
  },
  ocean: {
    name: 'Ocean',
    colors: {
      primary: 'cyan',
      secondary: 'blue',
      accent: 'white',
      background: 'black',
      border: 'cyan',
      text: 'white',
      muted: 'gray',
      success: 'green',
      warning: 'yellow',
      error: 'red'
    },
    borderType: 'line',
    focusStyle: { border: { fg: 'white' } }
  },
  forest: {
    name: 'Forest',
    colors: {
      primary: 'green',
      secondary: 'yellow',
      accent: 'white',
      background: 'black',
      border: 'green',
      text: 'white',
      muted: 'gray',
      success: 'green',
      warning: 'yellow',
      error: 'red'
    },
    borderType: 'line',
    focusStyle: { border: { fg: 'yellow' } }
  },
  minimal: {
    name: 'Minimal',
    colors: {
      primary: 'white',
      secondary: 'gray',
      accent: 'cyan',
      background: 'black',
      border: 'gray',
      text: 'white',
      muted: 'gray',
      success: 'green',
      warning: 'yellow',
      error: 'red'
    },
    borderType: 'line',
    focusStyle: { border: { fg: 'white' } }
  }
};

/**
 * Key bindings
 */
const KEY_BINDINGS = {
  quit: ['escape', 'q', 'C-c'],
  refresh: ['r', 'R'],
  help: ['h', 'H', '?'],
  nextTab: ['tab', 'right'],
  prevTab: ['S-tab', 'left'],
  focusNext: ['down', 'j'],
  focusPrev: ['up', 'k'],
  select: ['enter', 'space'],
  scrollUp: ['pageup'],
  scrollDown: ['pagedown'],
  home: ['home'],
  end: ['end']
};

/**
 * TUI Dashboard Class
 * Creates a full-screen interactive terminal interface
 */
class TUIDashboard extends EventEmitter {
  constructor(options = {}) {
    super();

    this.options = {
      title: options.title || 'Dragon UI Dashboard',
      theme: options.theme || 'dragon',
      refreshInterval: options.refreshInterval || 5000,
      smartCSR: options.smartCSR !== false,
      ...options
    };

    this.theme = THEMES[this.options.theme] || THEMES.dragon;
    this.blessed = null;
    this.contrib = null;
    this.screen = null;
    this.grid = null;
    this.components = new Map();
    this.focusIndex = 0;
    this.focusableComponents = [];
    this.tabs = [];
    this.activeTab = 0;
    this.refreshTimer = null;
    this.isRunning = false;
    this.dataProvider = options.dataProvider || null;
  }

  /**
   * Load blessed and blessed-contrib dynamically
   */
  async loadLibraries() {
    try {
      // Try to load blessed
      this.blessed = require('blessed');
    } catch (error) {
      // Create minimal blessed implementation if not available
      this.blessed = this.createMinimalBlessed();
    }

    try {
      // Try to load blessed-contrib
      this.contrib = require('blessed-contrib');
    } catch (error) {
      // Create minimal contrib implementation if not available
      this.contrib = this.createMinimalContrib();
    }
  }

  /**
   * Create minimal blessed implementation for fallback
   */
  createMinimalBlessed() {
    const EventEmitter = require('events');

    class MinimalScreen extends EventEmitter {
      constructor(options = {}) {
        super();
        this.title = options.title || '';
        this.children = [];
        this.focused = null;
        this.program = {
          write: (data) => process.stdout.write(data),
          clear: () => process.stdout.write('\x1B[2J\x1B[H'),
          hideCursor: () => process.stdout.write('\x1B[?25l'),
          showCursor: () => process.stdout.write('\x1B[?25h')
        };
        this.width = process.stdout.columns || 80;
        this.height = process.stdout.rows || 24;

        // Handle terminal resize
        process.stdout.on('resize', () => {
          this.width = process.stdout.columns || 80;
          this.height = process.stdout.rows || 24;
          this.emit('resize');
        });
      }

      append(element) {
        this.children.push(element);
        element.screen = this;
      }

      remove(element) {
        const index = this.children.indexOf(element);
        if (index > -1) {
          this.children.splice(index, 1);
        }
      }

      render() {
        this.program.clear();
        this.emit('prerender');
        for (const child of this.children) {
          if (child.render) child.render();
        }
        this.emit('render');
      }

      key(keys, callback) {
        const stdin = process.stdin;
        stdin.setRawMode(true);
        stdin.resume();
        stdin.setEncoding('utf8');

        stdin.on('data', (key) => {
          // Handle common key mappings
          if (key === '\u0003') { // Ctrl+C
            if (keys.includes('C-c')) callback();
          } else if (key === '\u001b') { // Escape
            if (keys.includes('escape')) callback();
          } else if (keys.includes(key.toLowerCase())) {
            callback();
          }
        });
      }

      destroy() {
        this.program.showCursor();
        this.program.clear();
        this.removeAllListeners();
        process.stdin.setRawMode(false);
        process.stdin.pause();
      }

      focus(element) {
        this.focused = element;
        if (element && element.focus) element.focus();
      }
    }

    class MinimalBox extends EventEmitter {
      constructor(options = {}) {
        super();
        this.options = options;
        this.content = options.content || '';
        this.hidden = options.hidden || false;
        this.screen = null;
        this.children = [];
      }

      setContent(content) {
        this.content = content;
        if (this.screen) this.screen.render();
      }

      append(child) {
        this.children.push(child);
      }

      hide() {
        this.hidden = true;
      }

      show() {
        this.hidden = false;
      }

      focus() {
        this.emit('focus');
      }

      render() {
        if (this.hidden) return;
        // Minimal render - just output content
      }

      destroy() {
        this.removeAllListeners();
      }
    }

    class MinimalList extends MinimalBox {
      constructor(options = {}) {
        super(options);
        this.items = options.items || [];
        this.selected = 0;
      }

      setItems(items) {
        this.items = items;
        if (this.screen) this.screen.render();
      }

      select(index) {
        this.selected = Math.min(Math.max(0, index), this.items.length - 1);
        this.emit('select', { index: this.selected, item: this.items[this.selected] });
      }
    }

    return {
      screen: (options) => new MinimalScreen(options),
      box: (options) => new MinimalBox(options),
      list: (options) => new MinimalList(options),
      text: (options) => new MinimalBox(options),
      table: (options) => new MinimalBox(options),
      log: (options) => new MinimalBox(options)
    };
  }

  /**
   * Create minimal blessed-contrib implementation for fallback
   */
  createMinimalContrib() {
    const MinimalWidget = class extends require('events') {
      constructor(options = {}) {
        super();
        this.options = options;
        this.data = null;
      }

      setData(data) {
        this.data = data;
      }

      render() {
        // Minimal render
      }
    };

    return {
      grid: class {
        constructor(options = {}) {
          this.screen = options.screen;
          this.rows = options.rows || 12;
          this.cols = options.cols || 12;
        }
        set(row, col, rowSpan, colSpan, constructor, options) {
          return new MinimalWidget(options);
        }
      },
      gauge: (options) => new MinimalWidget(options),
      sparkline: (options) => new MinimalWidget(options),
      bar: (options) => new MinimalWidget(options),
      table: (options) => new MinimalWidget(options),
      tree: (options) => new MinimalWidget(options),
      markdown: (options) => new MinimalWidget(options),
      donut: (options) => new MinimalWidget(options),
      lcd: (options) => new MinimalWidget(options),
      log: (options) => new MinimalWidget(options),
      line: (options) => new MinimalWidget(options)
    };
  }

  /**
   * Initialize the dashboard
   */
  async init() {
    await this.loadLibraries();

    // Create screen
    this.screen = this.blessed.screen({
      smartCSR: this.options.smartCSR,
      title: this.options.title,
      cursor: {
        artificial: true,
        shape: 'line',
        blink: true
      }
    });

    // Create grid
    this.grid = new this.contrib.grid({
      rows: DEFAULT_GRID.rows,
      cols: DEFAULT_GRID.cols,
      screen: this.screen
    });

    // Setup key bindings
    this.setupKeyBindings();

    // Emit init event
    this.emit('init');
  }

  /**
   * Setup key bindings
   */
  setupKeyBindings() {
    // Quit
    this.screen.key(KEY_BINDINGS.quit, () => {
      this.emit('quit');
      this.stop();
    });

    // Refresh
    this.screen.key(KEY_BINDINGS.refresh, () => {
      this.refresh();
    });

    // Help
    this.screen.key(KEY_BINDINGS.help, () => {
      this.showHelp();
    });

    // Tab navigation
    this.screen.key(KEY_BINDINGS.nextTab, () => {
      this.nextTab();
    });

    this.screen.key(KEY_BINDINGS.prevTab, () => {
      this.prevTab();
    });

    // Focus navigation
    this.screen.key(KEY_BINDINGS.focusNext, () => {
      this.focusNext();
    });

    this.screen.key(KEY_BINDINGS.focusPrev, () => {
      this.focusPrev();
    });
  }

  /**
   * Add a component to the dashboard
   */
  addComponent(id, type, position, options = {}) {
    const { row, col, rowSpan, colSpan } = position;

    let component;
    const componentOptions = {
      ...options,
      style: this.applyTheme(options.style || {})
    };

    switch (type) {
      case COMPONENT_TYPES.BOX:
        component = this.blessed.box(componentOptions);
        this.screen.append(component);
        break;

      case COMPONENT_TYPES.TABLE:
        component = this.grid.set(row, col, rowSpan, colSpan, this.contrib.table, componentOptions);
        break;

      case COMPONENT_TYPES.LOG:
        component = this.grid.set(row, col, rowSpan, colSpan, this.contrib.log, componentOptions);
        break;

      case COMPONENT_TYPES.GAUGE:
        component = this.grid.set(row, col, rowSpan, colSpan, this.contrib.gauge, componentOptions);
        break;

      case COMPONENT_TYPES.SPARKLINE:
        component = this.grid.set(row, col, rowSpan, colSpan, this.contrib.sparkline, componentOptions);
        break;

      case COMPONENT_TYPES.BAR:
        component = this.grid.set(row, col, rowSpan, colSpan, this.contrib.bar, componentOptions);
        break;

      case COMPONENT_TYPES.DONUT:
        component = this.grid.set(row, col, rowSpan, colSpan, this.contrib.donut, componentOptions);
        break;

      case COMPONENT_TYPES.LCD:
        component = this.grid.set(row, col, rowSpan, colSpan, this.contrib.lcd, componentOptions);
        break;

      case COMPONENT_TYPES.LINE:
        component = this.grid.set(row, col, rowSpan, colSpan, this.contrib.line, componentOptions);
        break;

      default:
        component = this.grid.set(row, col, rowSpan, colSpan, this.contrib.table, componentOptions);
    }

    this.components.set(id, { component, type, position, options });

    if (options.focusable !== false) {
      this.focusableComponents.push(id);
    }

    return component;
  }

  /**
   * Remove a component
   */
  removeComponent(id) {
    const item = this.components.get(id);
    if (item && item.component) {
      if (item.component.destroy) {
        item.component.destroy();
      }
      this.components.delete(id);

      const focusIndex = this.focusableComponents.indexOf(id);
      if (focusIndex > -1) {
        this.focusableComponents.splice(focusIndex, 1);
      }
    }
  }

  /**
   * Get a component by ID
   */
  getComponent(id) {
    const item = this.components.get(id);
    return item ? item.component : null;
  }

  /**
   * Apply theme to component style
   */
  applyTheme(style) {
    return {
      fg: this.theme.colors.text,
      bg: this.theme.colors.background,
      border: {
        type: this.theme.borderType,
        fg: this.theme.colors.border
      },
      label: {
        fg: this.theme.colors.primary
      },
      focus: this.theme.focusStyle,
      ...style
    };
  }

  /**
   * Create the default layout
   */
  createDefaultLayout() {
    // Header
    this.addComponent('header', COMPONENT_TYPES.BOX,
      { row: 0, col: 0, rowSpan: 1, colSpan: 12 },
      {
        content: `{center}{bold}${this.options.title}{/bold}{/center}`,
        tags: true,
        label: ' Dragon UI '
      }
    );

    // Main stats table
    this.addComponent('stats', COMPONENT_TYPES.TABLE,
      { row: 1, col: 0, rowSpan: 4, colSpan: 6 },
      {
        label: ' Usage Statistics ',
        columnWidth: [20, 15, 15],
        columnSpacing: 2,
        interactive: true
      }
    );

    // Tokens gauge
    this.addComponent('tokensGauge', COMPONENT_TYPES.GAUGE,
      { row: 1, col: 6, rowSpan: 2, colSpan: 3 },
      {
        label: ' Token Usage ',
        stroke: this.theme.colors.primary,
        fill: this.theme.colors.secondary
      }
    );

    // Cost gauge
    this.addComponent('costGauge', COMPONENT_TYPES.GAUGE,
      { row: 1, col: 9, rowSpan: 2, colSpan: 3 },
      {
        label: ' Daily Cost ',
        stroke: this.theme.colors.success,
        fill: this.theme.colors.warning
      }
    );

    // Token trend sparkline
    this.addComponent('tokenTrend', COMPONENT_TYPES.SPARKLINE,
      { row: 3, col: 6, rowSpan: 2, colSpan: 6 },
      {
        label: ' Token Trend (24h) ',
        style: {
          fg: this.theme.colors.primary,
          titleFg: this.theme.colors.accent
        }
      }
    );

    // Sessions table
    this.addComponent('sessions', COMPONENT_TYPES.TABLE,
      { row: 5, col: 0, rowSpan: 4, colSpan: 8 },
      {
        label: ' Recent Sessions ',
        columnWidth: [25, 15, 12, 12, 10],
        columnSpacing: 2,
        interactive: true
      }
    );

    // Model distribution donut
    this.addComponent('modelDist', COMPONENT_TYPES.DONUT,
      { row: 5, col: 8, rowSpan: 4, colSpan: 4 },
      {
        label: ' Model Distribution ',
        radius: 10
      }
    );

    // Activity log
    this.addComponent('log', COMPONENT_TYPES.LOG,
      { row: 9, col: 0, rowSpan: 2, colSpan: 12 },
      {
        label: ' Activity Log ',
        bufferLength: 50
      }
    );

    // Status bar
    this.addComponent('statusBar', COMPONENT_TYPES.BOX,
      { row: 11, col: 0, rowSpan: 1, colSpan: 12 },
      {
        content: ' [Q]uit | [R]efresh | [H]elp | [Tab] Navigate ',
        tags: true
      }
    );
  }

  /**
   * Update component data
   */
  updateComponent(id, data) {
    const item = this.components.get(id);
    if (!item || !item.component) return;

    const { component, type } = item;

    switch (type) {
      case COMPONENT_TYPES.TABLE:
        if (component.setData) {
          component.setData(data);
        }
        break;

      case COMPONENT_TYPES.LOG:
        if (data.message && component.log) {
          component.log(data.message);
        }
        break;

      case COMPONENT_TYPES.GAUGE:
        if (component.setData) {
          component.setData(data);
        } else if (component.setPercent) {
          component.setPercent(data.percent || 0);
        }
        break;

      case COMPONENT_TYPES.SPARKLINE:
        if (component.setData) {
          component.setData(data.titles || [''], data.data || [[]]);
        }
        break;

      case COMPONENT_TYPES.BAR:
        if (component.setData) {
          component.setData(data);
        }
        break;

      case COMPONENT_TYPES.DONUT:
        if (component.setData) {
          component.setData(data);
        }
        break;

      case COMPONENT_TYPES.LCD:
        if (component.setDisplay) {
          component.setDisplay(data.display || '');
        }
        break;

      case COMPONENT_TYPES.BOX:
        if (component.setContent) {
          component.setContent(data.content || '');
        }
        break;
    }

    this.screen.render();
  }

  /**
   * Refresh all data
   */
  async refresh() {
    if (!this.dataProvider) return;

    try {
      const data = await this.dataProvider.getData();

      // Update stats
      if (data.stats) {
        this.updateComponent('stats', {
          headers: ['Metric', 'Today', 'All Time'],
          data: [
            ['Tokens', data.stats.todayTokens || '0', data.stats.totalTokens || '0'],
            ['Cost', data.stats.todayCost || '$0.00', data.stats.totalCost || '$0.00'],
            ['Sessions', data.stats.todaySessions || '0', data.stats.totalSessions || '0'],
            ['Requests', data.stats.todayRequests || '0', data.stats.totalRequests || '0']
          ]
        });
      }

      // Update gauges
      if (data.usage) {
        this.updateComponent('tokensGauge', { percent: data.usage.tokenPercent || 0 });
        this.updateComponent('costGauge', { percent: data.usage.costPercent || 0 });
      }

      // Update sparkline
      if (data.trend) {
        this.updateComponent('tokenTrend', {
          titles: ['Tokens'],
          data: [data.trend.tokens || []]
        });
      }

      // Update sessions
      if (data.sessions) {
        this.updateComponent('sessions', {
          headers: ['Project', 'Model', 'Tokens', 'Cost', 'Time'],
          data: data.sessions.map(s => [
            s.project || 'Unknown',
            s.model || 'Unknown',
            String(s.tokens || 0),
            s.cost || '$0.00',
            s.duration || '0m'
          ])
        });
      }

      // Update model distribution
      if (data.models) {
        this.updateComponent('modelDist', data.models.map(m => ({
          label: m.name,
          percent: m.percent,
          color: this.getModelColor(m.name)
        })));
      }

      // Log refresh
      this.updateComponent('log', { message: `Refreshed at ${new Date().toLocaleTimeString()}` });

      this.emit('refresh', data);
    } catch (error) {
      this.updateComponent('log', { message: `Error: ${error.message}` });
      this.emit('error', error);
    }
  }

  /**
   * Get color for model name
   */
  getModelColor(modelName) {
    const colors = ['red', 'green', 'yellow', 'blue', 'magenta', 'cyan'];
    const hash = modelName.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[hash % colors.length];
  }

  /**
   * Show help dialog
   */
  showHelp() {
    const helpBox = this.blessed.box({
      parent: this.screen,
      top: 'center',
      left: 'center',
      width: '60%',
      height: '60%',
      content: `
{bold}Dragon UI Dashboard Help{/bold}

{underline}Navigation:{/underline}
  Tab / Arrow Keys    Navigate between components
  Enter / Space       Select item
  Page Up/Down        Scroll content

{underline}Actions:{/underline}
  R                   Refresh data
  H / ?               Show this help
  Q / Escape          Quit dashboard

{underline}Themes:{/underline}
  Current: ${this.theme.name}
  Available: ${Object.keys(THEMES).join(', ')}

Press any key to close...
      `,
      tags: true,
      border: { type: 'line' },
      style: this.applyTheme({
        label: { fg: this.theme.colors.primary }
      }),
      label: ' Help '
    });

    helpBox.key(['escape', 'enter', 'space', 'q', 'h'], () => {
      helpBox.destroy();
      this.screen.render();
    });

    helpBox.focus();
    this.screen.render();
  }

  /**
   * Focus next component
   */
  focusNext() {
    if (this.focusableComponents.length === 0) return;

    this.focusIndex = (this.focusIndex + 1) % this.focusableComponents.length;
    const id = this.focusableComponents[this.focusIndex];
    const component = this.getComponent(id);

    if (component && component.focus) {
      component.focus();
      this.screen.render();
    }
  }

  /**
   * Focus previous component
   */
  focusPrev() {
    if (this.focusableComponents.length === 0) return;

    this.focusIndex = (this.focusIndex - 1 + this.focusableComponents.length) % this.focusableComponents.length;
    const id = this.focusableComponents[this.focusIndex];
    const component = this.getComponent(id);

    if (component && component.focus) {
      component.focus();
      this.screen.render();
    }
  }

  /**
   * Add a tab
   */
  addTab(id, label, createFn) {
    this.tabs.push({ id, label, createFn });
  }

  /**
   * Switch to next tab
   */
  nextTab() {
    if (this.tabs.length <= 1) return;
    this.activeTab = (this.activeTab + 1) % this.tabs.length;
    this.renderTab();
  }

  /**
   * Switch to previous tab
   */
  prevTab() {
    if (this.tabs.length <= 1) return;
    this.activeTab = (this.activeTab - 1 + this.tabs.length) % this.tabs.length;
    this.renderTab();
  }

  /**
   * Render current tab
   */
  renderTab() {
    if (this.tabs.length === 0) return;

    // Clear existing components
    for (const id of this.components.keys()) {
      this.removeComponent(id);
    }

    // Create tab content
    const tab = this.tabs[this.activeTab];
    if (tab && tab.createFn) {
      tab.createFn(this);
    }

    this.screen.render();
  }

  /**
   * Set data provider
   */
  setDataProvider(provider) {
    this.dataProvider = provider;
  }

  /**
   * Set theme
   */
  setTheme(themeName) {
    if (THEMES[themeName]) {
      this.theme = THEMES[themeName];
      this.emit('themeChange', this.theme);
    }
  }

  /**
   * Start the dashboard
   */
  async start() {
    if (this.isRunning) return;

    await this.init();
    this.createDefaultLayout();

    // Initial refresh
    await this.refresh();

    // Start refresh timer
    this.refreshTimer = setInterval(() => {
      this.refresh();
    }, this.options.refreshInterval);

    this.isRunning = true;
    this.screen.render();
    this.emit('start');
  }

  /**
   * Stop the dashboard
   */
  stop() {
    if (!this.isRunning) return;

    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }

    if (this.screen) {
      this.screen.destroy();
      this.screen = null;
    }

    this.isRunning = false;
    this.emit('stop');
  }

  /**
   * Render the screen
   */
  render() {
    if (this.screen) {
      this.screen.render();
    }
  }

  /**
   * Get available themes
   */
  static getThemes() {
    return Object.keys(THEMES);
  }

  /**
   * Get component types
   */
  static getComponentTypes() {
    return { ...COMPONENT_TYPES };
  }
}

/**
 * Data Provider Interface
 * Implementations should provide data for the dashboard
 */
class TUIDataProvider {
  constructor(options = {}) {
    this.options = options;
  }

  /**
   * Get dashboard data
   * @returns {Promise<Object>} Dashboard data
   */
  async getData() {
    return {
      stats: {
        todayTokens: '0',
        totalTokens: '0',
        todayCost: '$0.00',
        totalCost: '$0.00',
        todaySessions: '0',
        totalSessions: '0',
        todayRequests: '0',
        totalRequests: '0'
      },
      usage: {
        tokenPercent: 0,
        costPercent: 0
      },
      trend: {
        tokens: []
      },
      sessions: [],
      models: []
    };
  }
}

/**
 * Create a Dragon UI TUI data provider
 */
function createDragonDataProvider(coreData) {
  return {
    coreData,

    async getData() {
      try {
        const overview = coreData.getOverviewData ? await coreData.getOverviewData() : {};
        const sessions = coreData.getRecentSessions ? await coreData.getRecentSessions(5) : [];
        const hourlyData = coreData.getHourlyData ? await coreData.getHourlyData(24) : [];
        const modelStats = coreData.getModelStats ? await coreData.getModelStats() : [];

        // Calculate today's stats
        const today = new Date().toISOString().split('T')[0];
        const todayData = hourlyData.filter(h => h.hour && h.hour.startsWith(today));
        const todayTokens = todayData.reduce((sum, h) => sum + (h.tokens || 0), 0);
        const todayCost = todayData.reduce((sum, h) => sum + (h.cost || 0), 0);

        // Calculate percentages (assuming daily limits)
        const dailyTokenLimit = 1000000; // 1M tokens
        const dailyCostLimit = 10; // $10

        return {
          stats: {
            todayTokens: this.formatNumber(todayTokens),
            totalTokens: this.formatNumber(overview.totalTokens || 0),
            todayCost: this.formatCost(todayCost),
            totalCost: this.formatCost(overview.totalCost || 0),
            todaySessions: String(todayData.length),
            totalSessions: String(overview.totalSessions || 0),
            todayRequests: String(todayData.reduce((sum, h) => sum + (h.requests || 0), 0)),
            totalRequests: String(overview.totalRequests || 0)
          },
          usage: {
            tokenPercent: Math.min(100, (todayTokens / dailyTokenLimit) * 100),
            costPercent: Math.min(100, (todayCost / dailyCostLimit) * 100)
          },
          trend: {
            tokens: hourlyData.slice(-24).map(h => h.tokens || 0)
          },
          sessions: sessions.map(s => ({
            project: s.projectPath ? require('path').basename(s.projectPath) : 'Unknown',
            model: s.model || 'Unknown',
            tokens: s.totalTokens || 0,
            cost: this.formatCost(s.totalCost || 0),
            duration: this.formatDuration(s.startTime, s.endTime)
          })),
          models: modelStats.map(m => ({
            name: m.model || 'Unknown',
            percent: m.percentage || 0
          }))
        };
      } catch (error) {
        console.error('Error getting TUI data:', error);
        return new TUIDataProvider().getData();
      }
    },

    formatNumber(num) {
      if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
      if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
      return String(num);
    },

    formatCost(cost) {
      return `$${(cost || 0).toFixed(2)}`;
    },

    formatDuration(start, end) {
      if (!start) return '0m';
      const startDate = new Date(start);
      const endDate = end ? new Date(end) : new Date();
      const diffMs = endDate - startDate;
      const diffMins = Math.floor(diffMs / 60000);
      if (diffMins >= 60) {
        return `${Math.floor(diffMins / 60)}h ${diffMins % 60}m`;
      }
      return `${diffMins}m`;
    }
  };
}

module.exports = {
  TUIDashboard,
  TUIDataProvider,
  createDragonDataProvider,
  COMPONENT_TYPES,
  THEMES,
  KEY_BINDINGS
};
