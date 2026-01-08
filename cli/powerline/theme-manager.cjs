/**
 * Powerline Theme Manager
 * Manages loading and applying themes to powerline statuslines
 */

const path = require('path');
const fs = require('fs');

// Built-in themes
const BUILTIN_THEMES = {
  custom: {
    name: 'Custom',
    description: 'Uses widget-specific colors',
    colors: null, // No predefined colors
    foreground: '#FFFFFF',
    separator: 'arrows'
  },

  nord: {
    name: 'Nord',
    description: 'Arctic blue palette',
    colors: ['#3B4252', '#434C5E', '#4C566A', '#5E81AC', '#81A1C1', '#88C0D0'],
    foreground: '#ECEFF4',
    accent: '#88C0D0',
    separator: 'arrows'
  },

  monokai: {
    name: 'Monokai',
    description: 'Dark vibrant colors',
    colors: ['#272822', '#383830', '#49483E', '#75715E', '#F92672', '#FD971F'],
    foreground: '#F8F8F2',
    accent: '#A6E22E',
    separator: 'arrows'
  },

  solarized: {
    name: 'Solarized',
    description: 'Precision colors for machines and people',
    colors: ['#073642', '#586E75', '#657B83', '#268BD2', '#2AA198', '#859900'],
    foreground: '#FDF6E3',
    accent: '#B58900',
    separator: 'arrows'
  },

  minimal: {
    name: 'Minimal',
    description: 'Clean monochrome',
    colors: ['#333333', '#444444', '#555555', '#666666', '#777777', '#888888'],
    foreground: '#FFFFFF',
    accent: '#AAAAAA',
    separator: 'arrows'
  },

  dracula: {
    name: 'Dracula',
    description: 'Dark purple theme',
    colors: ['#282A36', '#44475A', '#6272A4', '#BD93F9', '#FF79C6', '#8BE9FD'],
    foreground: '#F8F8F2',
    accent: '#50FA7B',
    separator: 'arrows'
  },

  catppuccin: {
    name: 'Catppuccin',
    description: 'Soothing pastel theme',
    colors: ['#1E1E2E', '#313244', '#45475A', '#585B70', '#CBA6F7', '#89B4FA'],
    foreground: '#CDD6F4',
    accent: '#94E2D5',
    separator: 'arrows'
  },

  gruvbox: {
    name: 'Gruvbox',
    description: 'Retro groove colors',
    colors: ['#282828', '#3C3836', '#504945', '#665C54', '#FB4934', '#FABD2F'],
    foreground: '#EBDBB2',
    accent: '#B8BB26',
    separator: 'arrows'
  },

  onedark: {
    name: 'One Dark',
    description: 'Atom editor inspired',
    colors: ['#282C34', '#353B45', '#3E4451', '#545862', '#61AFEF', '#C678DD'],
    foreground: '#ABB2BF',
    accent: '#98C379',
    separator: 'arrows'
  },

  tokyonight: {
    name: 'Tokyo Night',
    description: 'Tokyo nightlife colors',
    colors: ['#1A1B26', '#24283B', '#414868', '#565F89', '#7AA2F7', '#BB9AF7'],
    foreground: '#C0CAF5',
    accent: '#9ECE6A',
    separator: 'arrows'
  },

  dragon: {
    name: 'Dragon',
    description: 'Dragon UI signature theme',
    colors: ['#1a1a2e', '#16213e', '#0f3460', '#e94560', '#ff6b6b', '#ffa502'],
    foreground: '#FFFFFF',
    accent: '#e94560',
    separator: 'arrows'
  },

  github: {
    name: 'GitHub',
    description: 'GitHub dark theme',
    colors: ['#0d1117', '#161b22', '#21262d', '#30363d', '#238636', '#1f6feb'],
    foreground: '#C9D1D9',
    accent: '#58A6FF',
    separator: 'arrows'
  },

  material: {
    name: 'Material',
    description: 'Material design colors',
    colors: ['#263238', '#37474f', '#455a64', '#546e7a', '#00bcd4', '#03a9f4'],
    foreground: '#ECEFF1',
    accent: '#00E676',
    separator: 'arrows'
  }
};

/**
 * Theme Manager Class
 */
class ThemeManager {
  constructor() {
    this.themes = new Map();
    this.currentTheme = 'dragon';
    this.customThemesDir = null;
    this.loadBuiltInThemes();
  }

  /**
   * Load all built-in themes
   */
  loadBuiltInThemes() {
    for (const [id, theme] of Object.entries(BUILTIN_THEMES)) {
      this.themes.set(id, { id, ...theme });
    }
  }

  /**
   * Load custom themes from directory
   */
  loadCustomThemes(directory) {
    this.customThemesDir = directory;

    try {
      if (!fs.existsSync(directory)) return;

      const files = fs.readdirSync(directory);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const themePath = path.join(directory, file);
          const themeData = JSON.parse(fs.readFileSync(themePath, 'utf8'));
          const id = path.basename(file, '.json');

          if (this.validateTheme(themeData)) {
            this.themes.set(id, { id, ...themeData, custom: true });
          }
        }
      }
    } catch (error) {
      // Silent fail for custom themes
    }
  }

  /**
   * Validate theme structure
   */
  validateTheme(theme) {
    if (!theme.name) return false;
    if (theme.colors && !Array.isArray(theme.colors)) return false;
    return true;
  }

  /**
   * Get theme by ID
   */
  getTheme(id) {
    return this.themes.get(id) || this.themes.get('dragon');
  }

  /**
   * Get current theme
   */
  getCurrentTheme() {
    return this.getTheme(this.currentTheme);
  }

  /**
   * Set current theme
   */
  setCurrentTheme(id) {
    if (this.themes.has(id)) {
      this.currentTheme = id;
      return true;
    }
    return false;
  }

  /**
   * Get all available theme IDs
   */
  getThemeIds() {
    return Array.from(this.themes.keys());
  }

  /**
   * Get all themes with metadata
   */
  getAllThemes() {
    const result = [];
    for (const [id, theme] of this.themes.entries()) {
      result.push({
        id,
        name: theme.name,
        description: theme.description,
        colorCount: theme.colors ? theme.colors.length : 0,
        custom: theme.custom || false
      });
    }
    return result;
  }

  /**
   * Apply theme colors to widgets
   */
  applyTheme(widgets, themeId = null) {
    const theme = themeId ? this.getTheme(themeId) : this.getCurrentTheme();

    if (!theme.colors) {
      // Custom theme - use widget's own colors
      return widgets;
    }

    return widgets.map((widget, index) => {
      const colorIndex = index % theme.colors.length;
      return {
        ...widget,
        color: {
          ...widget.color,
          bg: theme.colors[colorIndex],
          fg: theme.foreground || '#FFFFFF'
        }
      };
    });
  }

  /**
   * Get color for widget at position
   */
  getColorForPosition(position, themeId = null) {
    const theme = themeId ? this.getTheme(themeId) : this.getCurrentTheme();

    if (!theme.colors) return null;

    const colorIndex = position % theme.colors.length;
    return {
      bg: theme.colors[colorIndex],
      fg: theme.foreground || '#FFFFFF'
    };
  }

  /**
   * Create a new custom theme
   */
  createTheme(id, config) {
    const theme = {
      id,
      name: config.name || id,
      description: config.description || 'Custom theme',
      colors: config.colors || [],
      foreground: config.foreground || '#FFFFFF',
      accent: config.accent || config.colors?.[0] || '#FFFFFF',
      separator: config.separator || 'arrows',
      custom: true
    };

    this.themes.set(id, theme);
    return theme;
  }

  /**
   * Export theme to JSON
   */
  exportTheme(id) {
    const theme = this.getTheme(id);
    if (!theme) return null;

    const { custom, ...exportData } = theme;
    return JSON.stringify(exportData, null, 2);
  }

  /**
   * Generate preview data for a theme
   */
  getThemePreview(id) {
    const theme = this.getTheme(id);
    if (!theme) return null;

    return {
      ...theme,
      sample: theme.colors ? theme.colors.slice(0, 6) : []
    };
  }
}

// Export singleton instance
const themeManager = new ThemeManager();

module.exports = {
  ThemeManager,
  themeManager,
  BUILTIN_THEMES
};
