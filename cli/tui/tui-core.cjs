/**
 * Interactive TUI Core for Dragon-UI
 * React + Ink-based terminal user interface
 *
 * @module cli/tui/tui-core
 */

'use strict';

const { EventEmitter } = require('events');
const readline = require('readline');

/**
 * Screen identifiers
 */
const SCREENS = {
  MAIN_MENU: 'main_menu',
  WIDGET_EDITOR: 'widget_editor',
  COLOR_CONFIG: 'color_config',
  POWERLINE_SETUP: 'powerline_setup',
  INSTALL_MENU: 'install_menu'
};

/**
 * Key mappings for navigation
 */
const KEY_BINDINGS = {
  UP: ['up', 'k', 'w'],
  DOWN: ['down', 'j', 's'],
  LEFT: ['left', 'h', 'a'],
  RIGHT: ['right', 'l', 'd'],
  SELECT: ['return', 'space', 'enter'],
  BACK: ['escape', 'backspace', 'q'],
  HELP: ['?', 'f1'],
  QUIT: ['ctrl+c', 'ctrl+q']
};

/**
 * ANSI escape codes for terminal control
 */
const ANSI = {
  CLEAR: '\x1b[2J\x1b[H',
  HIDE_CURSOR: '\x1b[?25l',
  SHOW_CURSOR: '\x1b[?25h',
  BOLD: '\x1b[1m',
  RESET: '\x1b[0m',
  DIM: '\x1b[2m',
  UNDERLINE: '\x1b[4m',
  BLINK: '\x1b[5m',
  REVERSE: '\x1b[7m',

  // Colors
  FG_BLACK: '\x1b[30m',
  FG_RED: '\x1b[31m',
  FG_GREEN: '\x1b[32m',
  FG_YELLOW: '\x1b[33m',
  FG_BLUE: '\x1b[34m',
  FG_MAGENTA: '\x1b[35m',
  FG_CYAN: '\x1b[36m',
  FG_WHITE: '\x1b[37m',

  BG_BLACK: '\x1b[40m',
  BG_RED: '\x1b[41m',
  BG_GREEN: '\x1b[42m',
  BG_YELLOW: '\x1b[43m',
  BG_BLUE: '\x1b[44m',
  BG_MAGENTA: '\x1b[45m',
  BG_CYAN: '\x1b[46m',
  BG_WHITE: '\x1b[47m',

  // Cursor movement
  cursorTo: (x, y) => `\x1b[${y + 1};${x + 1}H`,
  cursorUp: (n = 1) => `\x1b[${n}A`,
  cursorDown: (n = 1) => `\x1b[${n}B`,
  cursorForward: (n = 1) => `\x1b[${n}C`,
  cursorBack: (n = 1) => `\x1b[${n}D`,

  // Erase
  eraseLine: '\x1b[2K',
  eraseToEnd: '\x1b[0K',
  eraseToStart: '\x1b[1K'
};

/**
 * Box drawing characters
 */
const BOX = {
  TOP_LEFT: '┌',
  TOP_RIGHT: '┐',
  BOTTOM_LEFT: '└',
  BOTTOM_RIGHT: '┘',
  HORIZONTAL: '─',
  VERTICAL: '│',
  T_DOWN: '┬',
  T_UP: '┴',
  T_RIGHT: '├',
  T_LEFT: '┤',
  CROSS: '┼',

  // Double line
  D_TOP_LEFT: '╔',
  D_TOP_RIGHT: '╗',
  D_BOTTOM_LEFT: '╚',
  D_BOTTOM_RIGHT: '╝',
  D_HORIZONTAL: '═',
  D_VERTICAL: '║',

  // Rounded corners
  R_TOP_LEFT: '╭',
  R_TOP_RIGHT: '╮',
  R_BOTTOM_LEFT: '╰',
  R_BOTTOM_RIGHT: '╯'
};

/**
 * TUI State Manager
 */
class StateManager extends EventEmitter {
  constructor(initialState = {}) {
    super();
    this._state = {
      currentScreen: SCREENS.MAIN_MENU,
      selectedIndex: 0,
      menuStack: [],
      widgets: [],
      colors: {},
      powerlineConfig: {},
      previewData: null,
      isEditing: false,
      editValue: '',
      message: null,
      messageTimeout: null,
      ...initialState
    };
  }

  get state() {
    return { ...this._state };
  }

  setState(updates) {
    const oldState = this._state;
    this._state = { ...this._state, ...updates };
    this.emit('stateChange', this._state, oldState);
    return this._state;
  }

  navigate(screen) {
    this._state.menuStack.push(this._state.currentScreen);
    this.setState({
      currentScreen: screen,
      selectedIndex: 0
    });
  }

  goBack() {
    if (this._state.menuStack.length > 0) {
      const previousScreen = this._state.menuStack.pop();
      this.setState({
        currentScreen: previousScreen,
        selectedIndex: 0
      });
      return true;
    }
    return false;
  }

  showMessage(text, duration = 3000) {
    if (this._state.messageTimeout) {
      clearTimeout(this._state.messageTimeout);
    }

    const timeout = setTimeout(() => {
      this.setState({ message: null, messageTimeout: null });
    }, duration);

    this.setState({
      message: text,
      messageTimeout: timeout
    });
  }
}

/**
 * Input Handler for keyboard events
 */
class InputHandler extends EventEmitter {
  constructor() {
    super();
    this.rl = null;
    this.isListening = false;
  }

  start() {
    if (this.isListening) return;

    readline.emitKeypressEvents(process.stdin);

    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
    }

    process.stdin.resume();
    process.stdin.on('keypress', this._handleKeypress.bind(this));
    this.isListening = true;
  }

  stop() {
    if (!this.isListening) return;

    process.stdin.removeAllListeners('keypress');

    if (process.stdin.isTTY) {
      process.stdin.setRawMode(false);
    }

    process.stdin.pause();
    this.isListening = false;
  }

  _handleKeypress(str, key) {
    if (!key) {
      this.emit('input', str, { name: str });
      return;
    }

    const keyName = this._normalizeKeyName(key);

    // Check for quit
    if (key.ctrl && (key.name === 'c' || key.name === 'q')) {
      this.emit('quit');
      return;
    }

    this.emit('keypress', keyName, key);
    this.emit('input', str, key);
  }

  _normalizeKeyName(key) {
    let name = key.name || '';

    if (key.ctrl) name = `ctrl+${name}`;
    if (key.meta) name = `meta+${name}`;
    if (key.shift && name.length === 1) name = name.toUpperCase();

    return name;
  }
}

/**
 * Renderer for terminal output
 */
class Renderer {
  constructor(options = {}) {
    this.width = options.width || process.stdout.columns || 80;
    this.height = options.height || process.stdout.rows || 24;
    this.buffer = [];
    this.lastRender = null;

    // Listen for resize
    process.stdout.on('resize', () => {
      this.width = process.stdout.columns || 80;
      this.height = process.stdout.rows || 24;
    });
  }

  clear() {
    process.stdout.write(ANSI.CLEAR);
    this.buffer = [];
  }

  hideCursor() {
    process.stdout.write(ANSI.HIDE_CURSOR);
  }

  showCursor() {
    process.stdout.write(ANSI.SHOW_CURSOR);
  }

  write(text, x, y) {
    if (y !== undefined && x !== undefined) {
      process.stdout.write(ANSI.cursorTo(x, y) + text);
    } else {
      process.stdout.write(text);
    }
  }

  /**
   * Draw a box
   */
  drawBox(x, y, width, height, options = {}) {
    const { title, style = 'single', padding = 0 } = options;
    const box = style === 'double'
      ? { tl: BOX.D_TOP_LEFT, tr: BOX.D_TOP_RIGHT, bl: BOX.D_BOTTOM_LEFT, br: BOX.D_BOTTOM_RIGHT, h: BOX.D_HORIZONTAL, v: BOX.D_VERTICAL }
      : style === 'rounded'
      ? { tl: BOX.R_TOP_LEFT, tr: BOX.R_TOP_RIGHT, bl: BOX.R_BOTTOM_LEFT, br: BOX.R_BOTTOM_RIGHT, h: BOX.HORIZONTAL, v: BOX.VERTICAL }
      : { tl: BOX.TOP_LEFT, tr: BOX.TOP_RIGHT, bl: BOX.BOTTOM_LEFT, br: BOX.BOTTOM_RIGHT, h: BOX.HORIZONTAL, v: BOX.VERTICAL };

    // Top border
    let topLine = box.tl + box.h.repeat(width - 2) + box.tr;
    if (title) {
      const titleText = ` ${title} `;
      const titleStart = Math.floor((width - titleText.length) / 2);
      topLine = box.tl + box.h.repeat(titleStart - 1) + titleText + box.h.repeat(width - titleStart - titleText.length - 1) + box.tr;
    }
    this.write(topLine, x, y);

    // Sides
    for (let i = 1; i < height - 1; i++) {
      this.write(box.v + ' '.repeat(width - 2) + box.v, x, y + i);
    }

    // Bottom border
    this.write(box.bl + box.h.repeat(width - 2) + box.br, x, y + height - 1);
  }

  /**
   * Draw a menu
   */
  drawMenu(items, selectedIndex, x, y, options = {}) {
    const { width = 40, showIndicator = true, colors = {} } = options;

    items.forEach((item, index) => {
      const isSelected = index === selectedIndex;
      const indicator = showIndicator ? (isSelected ? '> ' : '  ') : '';
      let line = indicator + (item.label || item);

      // Truncate if necessary
      if (line.length > width) {
        line = line.substring(0, width - 3) + '...';
      }

      // Pad to width
      line = line.padEnd(width);

      // Apply colors
      if (isSelected) {
        line = ANSI.REVERSE + line + ANSI.RESET;
      }

      if (item.disabled) {
        line = ANSI.DIM + line + ANSI.RESET;
      }

      this.write(line, x, y + index);
    });
  }

  /**
   * Draw a text input field
   */
  drawInput(value, x, y, options = {}) {
    const { width = 30, placeholder = '', focused = false } = options;

    let display = value || placeholder;
    if (display.length > width - 2) {
      display = display.substring(display.length - width + 5) + '...';
    }
    display = display.padEnd(width - 2);

    const style = focused ? ANSI.UNDERLINE : '';
    const box = `[${style}${display}${ANSI.RESET}]`;

    this.write(box, x, y);
  }

  /**
   * Draw a progress bar
   */
  drawProgressBar(value, max, x, y, options = {}) {
    const { width = 20, showPercent = true, filled = '█', empty = '░' } = options;

    const percent = Math.min(100, Math.max(0, (value / max) * 100));
    const barWidth = showPercent ? width - 5 : width;
    const filledCount = Math.round((percent / 100) * barWidth);

    let bar = filled.repeat(filledCount) + empty.repeat(barWidth - filledCount);
    if (showPercent) {
      bar += ` ${Math.round(percent)}%`;
    }

    this.write(bar, x, y);
  }

  /**
   * Center text
   */
  centerText(text, width = this.width) {
    const padding = Math.max(0, Math.floor((width - text.length) / 2));
    return ' '.repeat(padding) + text;
  }

  /**
   * Draw a horizontal separator
   */
  drawSeparator(y, options = {}) {
    const { char = '─', width = this.width } = options;
    this.write(char.repeat(width), 0, y);
  }
}

/**
 * Component base class
 */
class Component {
  constructor(props = {}) {
    this.props = props;
    this.state = {};
    this.children = [];
  }

  setState(updates) {
    this.state = { ...this.state, ...updates };
    this.onUpdate();
  }

  onMount() {}
  onUnmount() {}
  onUpdate() {}

  render(renderer) {
    // Override in subclass
  }

  handleInput(key, rawKey) {
    // Override in subclass
    return false; // Return true if handled
  }
}

/**
 * Main Menu Component
 */
class MainMenuComponent extends Component {
  constructor(props) {
    super(props);
    this.menuItems = [
      { id: 'widgets', label: '  Widget Editor', description: 'Configure statusline widgets' },
      { id: 'colors', label: '  Color Configuration', description: 'Customize colors and themes' },
      { id: 'powerline', label: '  Powerline Setup', description: 'Configure powerline mode' },
      { id: 'install', label: '  Install/Uninstall', description: 'Manage installations' },
      { id: 'preview', label: '  Live Preview', description: 'Preview your statusline' },
      { id: 'export', label: '  Export Config', description: 'Export configuration' },
      { id: 'import', label: '  Import Config', description: 'Import configuration' },
      { id: 'quit', label: '  Quit', description: 'Exit the application' }
    ];
  }

  render(renderer, state) {
    const { selectedIndex = 0 } = state;

    // Title
    renderer.write(ANSI.BOLD + renderer.centerText('Dragon-UI Configuration') + ANSI.RESET, 0, 1);
    renderer.write(renderer.centerText('Interactive Terminal User Interface'), 0, 2);

    // Separator
    renderer.drawSeparator(4);

    // Menu box
    const boxWidth = 50;
    const boxX = Math.floor((renderer.width - boxWidth) / 2);
    renderer.drawBox(boxX, 6, boxWidth, this.menuItems.length + 4, {
      title: 'Main Menu',
      style: 'rounded'
    });

    // Menu items
    renderer.drawMenu(
      this.menuItems.map(item => item.label),
      selectedIndex,
      boxX + 2,
      8,
      { width: boxWidth - 4 }
    );

    // Description
    const currentItem = this.menuItems[selectedIndex];
    if (currentItem && currentItem.description) {
      renderer.write(
        renderer.centerText(ANSI.DIM + currentItem.description + ANSI.RESET),
        0,
        6 + this.menuItems.length + 5
      );
    }

    // Help footer
    renderer.write(
      renderer.centerText('↑/↓: Navigate  Enter: Select  q: Quit  ?: Help'),
      0,
      renderer.height - 2
    );
  }

  handleInput(key, state, stateManager) {
    const { selectedIndex = 0 } = state;

    if (KEY_BINDINGS.UP.includes(key)) {
      stateManager.setState({
        selectedIndex: (selectedIndex - 1 + this.menuItems.length) % this.menuItems.length
      });
      return true;
    }

    if (KEY_BINDINGS.DOWN.includes(key)) {
      stateManager.setState({
        selectedIndex: (selectedIndex + 1) % this.menuItems.length
      });
      return true;
    }

    if (KEY_BINDINGS.SELECT.includes(key)) {
      const item = this.menuItems[selectedIndex];
      return this.handleSelection(item.id, stateManager);
    }

    return false;
  }

  handleSelection(id, stateManager) {
    switch (id) {
      case 'widgets':
        stateManager.navigate(SCREENS.WIDGET_EDITOR);
        return true;
      case 'colors':
        stateManager.navigate(SCREENS.COLOR_CONFIG);
        return true;
      case 'powerline':
        stateManager.navigate(SCREENS.POWERLINE_SETUP);
        return true;
      case 'install':
        stateManager.navigate(SCREENS.INSTALL_MENU);
        return true;
      case 'quit':
        return 'quit';
      default:
        stateManager.showMessage(`${id} not implemented yet`);
        return true;
    }
  }
}

/**
 * Widget Editor Component
 */
class WidgetEditorComponent extends Component {
  constructor(props) {
    super(props);
    this.availableWidgets = [
      { id: 'model', label: 'Model Name', enabled: true },
      { id: 'tokens-input', label: 'Input Tokens', enabled: true },
      { id: 'tokens-output', label: 'Output Tokens', enabled: true },
      { id: 'tokens-cached', label: 'Cached Tokens', enabled: false },
      { id: 'cost', label: 'Session Cost', enabled: true },
      { id: 'context-percent', label: 'Context %', enabled: true },
      { id: 'session-clock', label: 'Session Clock', enabled: true },
      { id: 'git-branch', label: 'Git Branch', enabled: false },
      { id: 'git-changes', label: 'Git Changes', enabled: false },
      { id: 'version', label: 'Version', enabled: false },
      { id: 'custom-text', label: 'Custom Text', enabled: false },
      { id: 'custom-command', label: 'Custom Command', enabled: false }
    ];
  }

  render(renderer, state) {
    const { selectedIndex = 0 } = state;

    // Title
    renderer.write(ANSI.BOLD + renderer.centerText('Widget Editor') + ANSI.RESET, 0, 1);

    // Instructions
    renderer.write(renderer.centerText('Space: Toggle  ↑↓: Navigate  Enter: Configure  Esc: Back'), 0, 3);

    // Separator
    renderer.drawSeparator(5);

    // Widget list
    const boxWidth = 60;
    const boxX = Math.floor((renderer.width - boxWidth) / 2);
    renderer.drawBox(boxX, 7, boxWidth, this.availableWidgets.length + 4, {
      title: 'Available Widgets',
      style: 'rounded'
    });

    this.availableWidgets.forEach((widget, index) => {
      const isSelected = index === selectedIndex;
      const checkbox = widget.enabled ? '[✓]' : '[ ]';
      let line = `  ${checkbox} ${widget.label}`;

      line = line.padEnd(boxWidth - 4);

      if (isSelected) {
        line = ANSI.REVERSE + line + ANSI.RESET;
      }

      renderer.write(line, boxX + 2, 9 + index);
    });

    // Preview section
    const previewY = 7 + this.availableWidgets.length + 5;
    renderer.drawBox(boxX, previewY, boxWidth, 5, {
      title: 'Live Preview',
      style: 'single'
    });

    // Generate preview
    const enabledWidgets = this.availableWidgets.filter(w => w.enabled);
    const preview = enabledWidgets.map(w => `[${w.label}]`).join(' ');
    renderer.write(
      preview.length > boxWidth - 4 ? preview.substring(0, boxWidth - 7) + '...' : preview,
      boxX + 2,
      previewY + 2
    );
  }

  handleInput(key, state, stateManager) {
    const { selectedIndex = 0 } = state;

    if (KEY_BINDINGS.UP.includes(key)) {
      stateManager.setState({
        selectedIndex: (selectedIndex - 1 + this.availableWidgets.length) % this.availableWidgets.length
      });
      return true;
    }

    if (KEY_BINDINGS.DOWN.includes(key)) {
      stateManager.setState({
        selectedIndex: (selectedIndex + 1) % this.availableWidgets.length
      });
      return true;
    }

    if (key === 'space' || key === ' ') {
      this.availableWidgets[selectedIndex].enabled = !this.availableWidgets[selectedIndex].enabled;
      stateManager.emit('stateChange', stateManager.state, stateManager.state);
      return true;
    }

    if (KEY_BINDINGS.BACK.includes(key)) {
      stateManager.goBack();
      return true;
    }

    return false;
  }
}

/**
 * Color Configuration Component
 */
class ColorConfigComponent extends Component {
  constructor(props) {
    super(props);
    this.colorOptions = [
      { id: 'fg_primary', label: 'Primary Foreground', value: 'white' },
      { id: 'fg_secondary', label: 'Secondary Foreground', value: 'gray' },
      { id: 'bg_primary', label: 'Primary Background', value: 'black' },
      { id: 'bg_accent', label: 'Accent Background', value: 'blue' },
      { id: 'success', label: 'Success Color', value: 'green' },
      { id: 'warning', label: 'Warning Color', value: 'yellow' },
      { id: 'error', label: 'Error Color', value: 'red' },
      { id: 'info', label: 'Info Color', value: 'cyan' }
    ];

    this.presetThemes = [
      { id: 'default', label: 'Default' },
      { id: 'nord', label: 'Nord' },
      { id: 'dracula', label: 'Dracula' },
      { id: 'monokai', label: 'Monokai' }
    ];
  }

  render(renderer, state) {
    const { selectedIndex = 0 } = state;

    // Title
    renderer.write(ANSI.BOLD + renderer.centerText('Color Configuration') + ANSI.RESET, 0, 1);
    renderer.write(renderer.centerText('Customize colors for your statusline'), 0, 2);

    // Separator
    renderer.drawSeparator(4);

    // Theme presets
    const presetWidth = 30;
    const presetX = 5;
    renderer.drawBox(presetX, 6, presetWidth, this.presetThemes.length + 4, {
      title: 'Presets',
      style: 'rounded'
    });

    this.presetThemes.forEach((theme, index) => {
      let line = `  ${theme.label}`;
      line = line.padEnd(presetWidth - 4);
      renderer.write(line, presetX + 2, 8 + index);
    });

    // Color options
    const colorWidth = 45;
    const colorX = presetX + presetWidth + 5;
    renderer.drawBox(colorX, 6, colorWidth, this.colorOptions.length + 4, {
      title: 'Colors',
      style: 'rounded'
    });

    this.colorOptions.forEach((option, index) => {
      const isSelected = index === selectedIndex;
      let line = `  ${option.label}: ${option.value}`;
      line = line.padEnd(colorWidth - 4);

      if (isSelected) {
        line = ANSI.REVERSE + line + ANSI.RESET;
      }

      renderer.write(line, colorX + 2, 8 + index);
    });

    // Instructions
    renderer.write(
      renderer.centerText('↑↓: Select  Enter: Edit  Tab: Switch Panel  Esc: Back'),
      0,
      renderer.height - 2
    );
  }

  handleInput(key, state, stateManager) {
    const { selectedIndex = 0 } = state;

    if (KEY_BINDINGS.UP.includes(key)) {
      stateManager.setState({
        selectedIndex: (selectedIndex - 1 + this.colorOptions.length) % this.colorOptions.length
      });
      return true;
    }

    if (KEY_BINDINGS.DOWN.includes(key)) {
      stateManager.setState({
        selectedIndex: (selectedIndex + 1) % this.colorOptions.length
      });
      return true;
    }

    if (KEY_BINDINGS.BACK.includes(key)) {
      stateManager.goBack();
      return true;
    }

    return false;
  }
}

/**
 * Powerline Setup Component
 */
class PowerlineSetupComponent extends Component {
  constructor(props) {
    super(props);
    this.options = [
      { id: 'enabled', label: 'Enable Powerline', type: 'toggle', value: false },
      { id: 'theme', label: 'Theme', type: 'select', value: 'nord', options: ['custom', 'nord', 'monokai', 'dracula', 'solarized'] },
      { id: 'separator', label: 'Separator Style', type: 'select', value: 'arrow', options: ['arrow', 'round', 'slant', 'fire'] },
      { id: 'caps', label: 'Show End Caps', type: 'toggle', value: true },
      { id: 'bold', label: 'Bold Text', type: 'toggle', value: false }
    ];

    this.separatorExamples = {
      arrow: '  ',
      round: '  ',
      slant: '  ',
      fire: '  '
    };
  }

  render(renderer, state) {
    const { selectedIndex = 0 } = state;

    // Title
    renderer.write(ANSI.BOLD + renderer.centerText('Powerline Setup') + ANSI.RESET, 0, 1);

    // Separator
    renderer.drawSeparator(3);

    // Options
    const boxWidth = 50;
    const boxX = Math.floor((renderer.width - boxWidth) / 2);
    renderer.drawBox(boxX, 5, boxWidth, this.options.length + 4, {
      title: 'Powerline Options',
      style: 'rounded'
    });

    this.options.forEach((option, index) => {
      const isSelected = index === selectedIndex;
      let valueDisplay;

      if (option.type === 'toggle') {
        valueDisplay = option.value ? '[ON]' : '[OFF]';
      } else if (option.type === 'select') {
        valueDisplay = `<${option.value}>`;
      } else {
        valueDisplay = option.value;
      }

      let line = `  ${option.label}: ${valueDisplay}`;
      line = line.padEnd(boxWidth - 4);

      if (isSelected) {
        line = ANSI.REVERSE + line + ANSI.RESET;
      }

      renderer.write(line, boxX + 2, 7 + index);
    });

    // Preview
    const previewY = 5 + this.options.length + 5;
    renderer.drawBox(boxX, previewY, boxWidth, 5, {
      title: 'Preview',
      style: 'single'
    });

    const currentTheme = this.options.find(o => o.id === 'theme').value;
    const currentSep = this.options.find(o => o.id === 'separator').value;
    const sepChars = this.separatorExamples[currentSep] || '  ';
    const preview = `${ANSI.BG_BLUE}${ANSI.FG_WHITE} Model ${sepChars[0]}${ANSI.RESET}${ANSI.BG_GREEN}${ANSI.FG_WHITE} Tokens ${sepChars[0]}${ANSI.RESET}${ANSI.BG_MAGENTA}${ANSI.FG_WHITE} Cost ${ANSI.RESET}`;
    renderer.write(preview, boxX + 2, previewY + 2);

    // Instructions
    renderer.write(
      renderer.centerText('Space/Enter: Toggle/Select  ←→: Change Value  Esc: Back'),
      0,
      renderer.height - 2
    );
  }

  handleInput(key, state, stateManager) {
    const { selectedIndex = 0 } = state;
    const option = this.options[selectedIndex];

    if (KEY_BINDINGS.UP.includes(key)) {
      stateManager.setState({
        selectedIndex: (selectedIndex - 1 + this.options.length) % this.options.length
      });
      return true;
    }

    if (KEY_BINDINGS.DOWN.includes(key)) {
      stateManager.setState({
        selectedIndex: (selectedIndex + 1) % this.options.length
      });
      return true;
    }

    if (KEY_BINDINGS.SELECT.includes(key) || key === 'space' || key === ' ') {
      if (option.type === 'toggle') {
        option.value = !option.value;
        stateManager.emit('stateChange', stateManager.state, stateManager.state);
      }
      return true;
    }

    if (KEY_BINDINGS.LEFT.includes(key) || KEY_BINDINGS.RIGHT.includes(key)) {
      if (option.type === 'select') {
        const currentIdx = option.options.indexOf(option.value);
        const direction = KEY_BINDINGS.RIGHT.includes(key) ? 1 : -1;
        const newIdx = (currentIdx + direction + option.options.length) % option.options.length;
        option.value = option.options[newIdx];
        stateManager.emit('stateChange', stateManager.state, stateManager.state);
      }
      return true;
    }

    if (KEY_BINDINGS.BACK.includes(key)) {
      stateManager.goBack();
      return true;
    }

    return false;
  }
}

/**
 * Install Menu Component
 */
class InstallMenuComponent extends Component {
  constructor(props) {
    super(props);
    this.menuItems = [
      { id: 'install_statusline', label: 'Install Statusline', description: 'Add statusline to Claude settings' },
      { id: 'uninstall_statusline', label: 'Uninstall Statusline', description: 'Remove statusline from Claude settings' },
      { id: 'check_status', label: 'Check Status', description: 'Check installation status' },
      { id: 'install_fonts', label: 'Install Fonts', description: 'Install Powerline/Nerd fonts' },
      { id: 'back', label: 'Back to Main Menu', description: 'Return to main menu' }
    ];
  }

  render(renderer, state) {
    const { selectedIndex = 0 } = state;

    // Title
    renderer.write(ANSI.BOLD + renderer.centerText('Install / Uninstall') + ANSI.RESET, 0, 1);

    // Separator
    renderer.drawSeparator(3);

    // Menu
    const boxWidth = 50;
    const boxX = Math.floor((renderer.width - boxWidth) / 2);
    renderer.drawBox(boxX, 5, boxWidth, this.menuItems.length + 4, {
      title: 'Options',
      style: 'rounded'
    });

    renderer.drawMenu(
      this.menuItems.map(item => item.label),
      selectedIndex,
      boxX + 2,
      7,
      { width: boxWidth - 4 }
    );

    // Description
    const currentItem = this.menuItems[selectedIndex];
    if (currentItem && currentItem.description) {
      renderer.write(
        renderer.centerText(ANSI.DIM + currentItem.description + ANSI.RESET),
        0,
        5 + this.menuItems.length + 5
      );
    }

    // Instructions
    renderer.write(
      renderer.centerText('↑↓: Navigate  Enter: Select  Esc: Back'),
      0,
      renderer.height - 2
    );
  }

  handleInput(key, state, stateManager) {
    const { selectedIndex = 0 } = state;

    if (KEY_BINDINGS.UP.includes(key)) {
      stateManager.setState({
        selectedIndex: (selectedIndex - 1 + this.menuItems.length) % this.menuItems.length
      });
      return true;
    }

    if (KEY_BINDINGS.DOWN.includes(key)) {
      stateManager.setState({
        selectedIndex: (selectedIndex + 1) % this.menuItems.length
      });
      return true;
    }

    if (KEY_BINDINGS.SELECT.includes(key)) {
      const item = this.menuItems[selectedIndex];
      if (item.id === 'back') {
        stateManager.goBack();
      } else {
        stateManager.showMessage(`${item.label}: Feature activated`);
      }
      return true;
    }

    if (KEY_BINDINGS.BACK.includes(key)) {
      stateManager.goBack();
      return true;
    }

    return false;
  }
}

/**
 * TUI Application
 */
class TUIApplication {
  constructor(options = {}) {
    this.renderer = new Renderer(options);
    this.stateManager = new StateManager();
    this.inputHandler = new InputHandler();
    this.isRunning = false;

    // Components for each screen
    this.components = {
      [SCREENS.MAIN_MENU]: new MainMenuComponent(),
      [SCREENS.WIDGET_EDITOR]: new WidgetEditorComponent(),
      [SCREENS.COLOR_CONFIG]: new ColorConfigComponent(),
      [SCREENS.POWERLINE_SETUP]: new PowerlineSetupComponent(),
      [SCREENS.INSTALL_MENU]: new InstallMenuComponent()
    };

    // Set up event handlers
    this.stateManager.on('stateChange', () => this.render());

    this.inputHandler.on('keypress', (key, rawKey) => {
      this.handleInput(key, rawKey);
    });

    this.inputHandler.on('quit', () => {
      this.stop();
    });
  }

  start() {
    if (this.isRunning) return;

    this.isRunning = true;
    this.renderer.hideCursor();
    this.inputHandler.start();
    this.render();
  }

  stop() {
    if (!this.isRunning) return;

    this.isRunning = false;
    this.inputHandler.stop();
    this.renderer.showCursor();
    this.renderer.clear();
    process.exit(0);
  }

  render() {
    if (!this.isRunning) return;

    this.renderer.clear();

    const currentScreen = this.stateManager.state.currentScreen;
    const component = this.components[currentScreen];

    if (component) {
      component.render(this.renderer, this.stateManager.state);
    }

    // Show message if any
    if (this.stateManager.state.message) {
      const msgY = this.renderer.height - 4;
      const msg = ` ${this.stateManager.state.message} `;
      const msgX = Math.floor((this.renderer.width - msg.length) / 2);
      this.renderer.write(ANSI.BG_BLUE + ANSI.FG_WHITE + msg + ANSI.RESET, msgX, msgY);
    }
  }

  handleInput(key, rawKey) {
    const currentScreen = this.stateManager.state.currentScreen;
    const component = this.components[currentScreen];

    if (component) {
      const result = component.handleInput(key, this.stateManager.state, this.stateManager);
      if (result === 'quit') {
        this.stop();
      }
    }
  }
}

/**
 * Create and run the TUI application
 */
function runTUI(options = {}) {
  const app = new TUIApplication(options);

  // Handle process termination
  process.on('SIGINT', () => app.stop());
  process.on('SIGTERM', () => app.stop());

  app.start();

  return app;
}

module.exports = {
  SCREENS,
  KEY_BINDINGS,
  ANSI,
  BOX,
  StateManager,
  InputHandler,
  Renderer,
  Component,
  MainMenuComponent,
  WidgetEditorComponent,
  ColorConfigComponent,
  PowerlineSetupComponent,
  InstallMenuComponent,
  TUIApplication,
  runTUI
};
