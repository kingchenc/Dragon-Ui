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
  dateFormat: 'relative' // 'relative' or 'absolute'
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

module.exports = {
  loadSettings,
  saveSettings,
  toggleSetting,
  setRefreshInterval,
  resetSettings
};