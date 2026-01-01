/**
 * CLI Settings Management (CommonJS)
 * Handles user preferences for colors, tables, refresh rates
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const SETTINGS_FILE = path.resolve(os.homedir(), '.dragon-ui-cli-settings.json');

const DEFAULT_SETTINGS = {
  useColors: true,
  tableStyle: 'ascii', // 'ascii' or 'minimal'
  refreshInterval: 30000, // milliseconds
  showHeader: true,
  compactMode: false,
  currency: 'USD',
  dateFormat: 'relative', // 'relative' or 'absolute'
  // Statusline configuration (synced with GUI when possible)
  statusline: {
    style: 'dragon', // 'modern' | 'classic' | 'minimal' | 'dragon'
    lines: 1,
    useColors: true,
    useEmojis: true,
    compact: false,
    showElements: ['model', 'branch', 'cwd', 'tokens', 'cost'],
    fontFamily: 'monospace',
    fontSize: 12
  }
};

/**
 * Load CLI settings from file or return defaults
 */
function loadSettings() {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      const data = fs.readFileSync(SETTINGS_FILE, 'utf8');
      const userSettings = JSON.parse(data);
      return { ...DEFAULT_SETTINGS, ...userSettings };
    }
  } catch (error) {
    console.warn('Warning: Could not load CLI settings, using defaults');
  }
  
  return { ...DEFAULT_SETTINGS };
}

/**
 * Save CLI settings to file
 */
function saveSettings(settings) {
  try {
    const data = JSON.stringify(settings, null, 2);
    fs.writeFileSync(SETTINGS_FILE, data, 'utf8');
    return true;
  } catch (error) {
    console.error('Error saving CLI settings:', error.message);
    return false;
  }
}

/**
 * Toggle setting value
 */
function toggleSetting(key) {
  const settings = loadSettings();
  
  switch (key) {
    case 'colors':
      settings.useColors = !settings.useColors;
      break;
    case 'tables':
      settings.tableStyle = settings.tableStyle === 'ascii' ? 'minimal' : 'ascii';
      break;
    case 'compact':
      settings.compactMode = !settings.compactMode;
      break;
    case 'header':
      settings.showHeader = !settings.showHeader;
      break;
    default:
      return false;
  }
  
  saveSettings(settings);
  return settings;
}

/**
 * Update refresh interval
 */
function setRefreshInterval(seconds) {
  const settings = loadSettings();
  settings.refreshInterval = Math.max(1, Math.min(60, seconds)) * 1000;
  saveSettings(settings);
  return settings;
}

/**
 * Reset settings to defaults
 */
function resetSettings() {
  const settings = { ...DEFAULT_SETTINGS };
  saveSettings(settings);
  return settings;
}

/**
 * Get statusline configuration
 */
function getStatuslineSettings() {
  const settings = loadSettings();
  return settings.statusline || DEFAULT_SETTINGS.statusline;
}

/**
 * Update statusline configuration
 */
function updateStatuslineSettings(statuslineConfig) {
  const settings = loadSettings();
  settings.statusline = { ...settings.statusline, ...statuslineConfig };
  saveSettings(settings);
  return settings.statusline;
}

/**
 * Apply a statusline preset (modern, classic, minimal, dragon)
 */
function applyStatuslinePreset(preset) {
  const presets = {
    modern: {
      style: 'modern',
      lines: 1,
      useColors: true,
      useEmojis: false,
      compact: false,
      showElements: ['model', 'branch', 'cwd', 'tokens']
    },
    classic: {
      style: 'classic',
      lines: 1,
      useColors: false,
      useEmojis: false,
      compact: true,
      showElements: ['model', 'branch', 'cwd', 'tokens']
    },
    minimal: {
      style: 'minimal',
      lines: 1,
      useColors: true,
      useEmojis: false,
      compact: true,
      showElements: ['model', 'branch', 'cost']
    },
    dragon: {
      style: 'dragon',
      lines: 2,
      useColors: true,
      useEmojis: true,
      compact: false,
      showElements: ['model', 'branch', 'cwd', 'tokens', 'cost', 'context', 'session']
    }
  };

  const presetConfig = presets[preset];
  if (!presetConfig) {
    console.error(`Unknown preset: ${preset}. Available: modern, classic, minimal, dragon`);
    return null;
  }

  return updateStatuslineSettings(presetConfig);
}

module.exports = {
  loadSettings,
  saveSettings,
  toggleSetting,
  setRefreshInterval,
  resetSettings,
  getStatuslineSettings,
  updateStatuslineSettings,
  applyStatuslinePreset
};