'use strict';
const fs = require('fs');
const path = require('path');
const { EventEmitter } = require('events');

const CURRENT_VERSION = 3;
const SETTINGS_FILE = 'dragon-ui-settings.json';
const BACKUP_EXT = '.bak';

const DEFAULT_SETTINGS = {
  version: CURRENT_VERSION,
  widgets: [],
  colors: { primary: '#4a90d9', secondary: '#6b7280', success: '#22c55e', warning: '#f59e0b', error: '#ef4444', info: '#3b82f6' },
  powerline: { enabled: false, theme: 'nord', separator: 'arrow', showCaps: true, bold: false },
  statusline: { installed: false, command: 'npx dragon-ui statusline' },
  preferences: { theme: 'system', language: 'en', currency: 'USD', timezone: 'auto', compactMode: false },
  cache: { enabled: true, ttl: 300000, maxSize: 100 }
};

function generateGUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

const MIGRATIONS = {
  '1_to_2': s => ({ ...s, version: 2, colors: s.colors || DEFAULT_SETTINGS.colors }),
  '2_to_3': s => ({ ...s, version: 3, powerline: s.powerline || DEFAULT_SETTINGS.powerline, preferences: s.preferences || DEFAULT_SETTINGS.preferences, cache: s.cache || DEFAULT_SETTINGS.cache })
};

class SettingsMigrationService extends EventEmitter {
  constructor(opts = {}) {
    super();
    this.settingsDir = opts.settingsDir || this._getDefaultDir();
    this.settingsFile = path.join(this.settingsDir, SETTINGS_FILE);
    this.backupDir = opts.backupDir || path.join(this.settingsDir, 'backups');
    this.maxBackups = opts.maxBackups || 10;
  }
  _getDefaultDir() {
    const h = process.env.HOME || process.env.USERPROFILE || '';
    return process.platform === 'win32' ? path.join(process.env.APPDATA || h, 'dragon-ui') : path.join(process.env.XDG_CONFIG_HOME || path.join(h, '.config'), 'dragon-ui');
  }
  _ensureDirs() {
    if (!fs.existsSync(this.settingsDir)) fs.mkdirSync(this.settingsDir, { recursive: true });
    if (!fs.existsSync(this.backupDir)) fs.mkdirSync(this.backupDir, { recursive: true });
  }
  loadSettings() {
    this._ensureDirs();
    if (!fs.existsSync(this.settingsFile)) return this._createDefaults();
    try { return this.migrate(JSON.parse(fs.readFileSync(this.settingsFile, 'utf8'))); }
    catch { return this._createDefaults(); }
  }
  saveSettings(s) {
    this._ensureDirs();
    s.version = CURRENT_VERSION;
    s._lastSaved = new Date().toISOString();
    fs.writeFileSync(this.settingsFile, JSON.stringify(s, null, 2), 'utf8');
    this.emit('saved', { settings: s });
  }
  _createDefaults() { const s = { ...DEFAULT_SETTINGS, _created: new Date().toISOString() }; this.saveSettings(s); return s; }
  detectVersion(s) { return (s.version && typeof s.version === 'number') ? s.version : 1; }
  migrate(s) {
    let v = this.detectVersion(s);
    if (v >= CURRENT_VERSION) return s;
    let m = { ...s };
    for (; v < CURRENT_VERSION; v++) { const fn = MIGRATIONS[v + '_to_' + (v + 1)]; if (fn) m = fn(m); }
    this.saveSettings(m);
    return m;
  }
  createBackup() {
    if (!fs.existsSync(this.settingsFile)) return null;
    this._ensureDirs();
    const f = path.join(this.backupDir, 'settings_' + new Date().toISOString().replace(/[:.]/g, '-') + BACKUP_EXT);
    fs.copyFileSync(this.settingsFile, f);
    return f;
  }
  listBackups() {
    if (!fs.existsSync(this.backupDir)) return [];
    return fs.readdirSync(this.backupDir).filter(f => f.endsWith(BACKUP_EXT)).map(f => {
      const p = path.join(this.backupDir, f), s = fs.statSync(p);
      return { name: f, path: p, size: s.size, modified: s.mtime };
    });
  }
  restoreBackup(n) {
    const p = path.join(this.backupDir, n);
    if (!fs.existsSync(p)) return null;
    try { return this.migrate(JSON.parse(fs.readFileSync(p, 'utf8'))); }
    catch { return null; }
  }
  factoryReset() {
    if (fs.existsSync(this.settingsFile)) {
      this._ensureDirs();
      fs.copyFileSync(this.settingsFile, path.join(this.backupDir, 'pre_reset_' + new Date().toISOString().replace(/[:.]/g, '-') + BACKUP_EXT));
    }
    return this._createDefaults();
  }
  validate(s) {
    const e = [];
    if (typeof s.version !== 'number') e.push('Missing version');
    if (!s.colors) e.push('Missing colors');
    return { valid: e.length === 0, errors: e };
  }
  export(s) { return JSON.stringify(s, null, 2); }
  import(j) { return this.migrate(JSON.parse(j)); }
  getCurrentVersion() { return CURRENT_VERSION; }
  getDefaults() { return { ...DEFAULT_SETTINGS }; }
}

let _inst = null;
function getSettingsMigrationService(o = {}) { return _inst || (_inst = new SettingsMigrationService(o)); }

module.exports = { CURRENT_VERSION, DEFAULT_SETTINGS, MIGRATIONS, generateGUID, SettingsMigrationService, getSettingsMigrationService };
