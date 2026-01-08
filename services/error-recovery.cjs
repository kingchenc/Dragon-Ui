'use strict';

var fs = require('fs');
var path = require('path');
var { EventEmitter } = require('events');

var DEFAULT_SNAPSHOT_DIR = 'snapshots';
var MAX_SNAPSHOTS = 10;

function ErrorRecoveryService(options) {
  EventEmitter.call(this);
  options = options || {};
  this.baseDir = options.baseDir || this._getDefaultDir();
  this.snapshotDir = path.join(this.baseDir, DEFAULT_SNAPSHOT_DIR);
  this.maxSnapshots = options.maxSnapshots || MAX_SNAPSHOTS;
  this.journalPath = path.join(this.baseDir, 'recovery-journal.json');
  this._ensureDirs();
}

ErrorRecoveryService.prototype = Object.create(EventEmitter.prototype);
ErrorRecoveryService.prototype.constructor = ErrorRecoveryService;

ErrorRecoveryService.prototype._getDefaultDir = function() {
  var homeDir = process.env.HOME || process.env.USERPROFILE || '';
  if (process.platform === 'win32') {
    return path.join(process.env.APPDATA || homeDir, 'dragon-ui', 'recovery');
  }
  return path.join(process.env.XDG_CONFIG_HOME || path.join(homeDir, '.config'), 'dragon-ui', 'recovery');
};

ErrorRecoveryService.prototype._ensureDirs = function() {
  if (!fs.existsSync(this.baseDir)) {
    fs.mkdirSync(this.baseDir, { recursive: true });
  }
  if (!fs.existsSync(this.snapshotDir)) {
    fs.mkdirSync(this.snapshotDir, { recursive: true });
  }
};

ErrorRecoveryService.prototype.createSnapshot = function(name, data) {
  var timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  var snapshotName = (name || 'snapshot') + '_' + timestamp + '.json';
  var snapshotPath = path.join(this.snapshotDir, snapshotName);

  var snapshot = {
    name: name || 'snapshot',
    timestamp: new Date().toISOString(),
    data: data
  };

  fs.writeFileSync(snapshotPath, JSON.stringify(snapshot, null, 2), 'utf8');
  this._rotateSnapshots();
  this._logJournal('snapshot_created', { name: snapshotName });
  this.emit('snapshotCreated', { name: snapshotName, path: snapshotPath });

  return snapshotPath;
};

ErrorRecoveryService.prototype.listSnapshots = function() {
  var self = this;
  if (!fs.existsSync(this.snapshotDir)) return [];

  return fs.readdirSync(this.snapshotDir)
    .filter(function(f) { return f.endsWith('.json'); })
    .map(function(f) {
      var fullPath = path.join(self.snapshotDir, f);
      var stat = fs.statSync(fullPath);
      try {
        var content = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
        return {
          file: f,
          path: fullPath,
          name: content.name,
          timestamp: content.timestamp,
          size: stat.size
        };
      } catch (e) {
        return { file: f, path: fullPath, error: true, size: stat.size };
      }
    })
    .sort(function(a, b) {
      return new Date(b.timestamp || 0) - new Date(a.timestamp || 0);
    });
};

ErrorRecoveryService.prototype.restoreSnapshot = function(snapshotFile) {
  var snapshotPath = path.join(this.snapshotDir, snapshotFile);

  if (!fs.existsSync(snapshotPath)) {
    throw new Error('Snapshot not found: ' + snapshotFile);
  }

  try {
    var content = JSON.parse(fs.readFileSync(snapshotPath, 'utf8'));
    this._logJournal('snapshot_restored', { name: snapshotFile });
    this.emit('snapshotRestored', { name: snapshotFile, data: content.data });
    return content.data;
  } catch (error) {
    throw new Error('Failed to restore snapshot: ' + error.message);
  }
};

ErrorRecoveryService.prototype._rotateSnapshots = function() {
  var snapshots = this.listSnapshots();
  var self = this;

  if (snapshots.length > this.maxSnapshots) {
    var toDelete = snapshots.slice(this.maxSnapshots);
    toDelete.forEach(function(snapshot) {
      try {
        fs.unlinkSync(snapshot.path);
      } catch (e) {}
    });
  }
};

ErrorRecoveryService.prototype.backupDatabase = function(dbPath) {
  if (!fs.existsSync(dbPath)) {
    throw new Error('Database file not found: ' + dbPath);
  }

  var timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  var backupName = 'db_backup_' + timestamp + '.sqlite';
  var backupPath = path.join(this.snapshotDir, backupName);

  fs.copyFileSync(dbPath, backupPath);
  this._logJournal('database_backup', { source: dbPath, backup: backupPath });
  this.emit('databaseBackup', { source: dbPath, backup: backupPath });

  return backupPath;
};

ErrorRecoveryService.prototype.restoreDatabase = function(backupPath, targetPath) {
  if (!fs.existsSync(backupPath)) {
    throw new Error('Backup file not found: ' + backupPath);
  }

  if (fs.existsSync(targetPath)) {
    var preRestoreBackup = this.backupDatabase(targetPath);
    this.emit('preRestoreBackup', { path: preRestoreBackup });
  }

  fs.copyFileSync(backupPath, targetPath);
  this._logJournal('database_restore', { source: backupPath, target: targetPath });
  this.emit('databaseRestored', { source: backupPath, target: targetPath });

  return targetPath;
};

ErrorRecoveryService.prototype.factoryReset = function(settings, database) {
  this.createSnapshot('pre_factory_reset', {
    settings: settings,
    databasePath: database
  });

  if (database && fs.existsSync(database)) {
    this.backupDatabase(database);
  }

  this._logJournal('factory_reset', { timestamp: new Date().toISOString() });
  this.emit('factoryReset');

  return true;
};

ErrorRecoveryService.prototype._logJournal = function(action, details) {
  var journal = [];

  if (fs.existsSync(this.journalPath)) {
    try {
      journal = JSON.parse(fs.readFileSync(this.journalPath, 'utf8'));
    } catch (e) {
      journal = [];
    }
  }

  journal.push({
    action: action,
    timestamp: new Date().toISOString(),
    details: details
  });

  while (journal.length > 100) {
    journal.shift();
  }

  fs.writeFileSync(this.journalPath, JSON.stringify(journal, null, 2), 'utf8');
};

ErrorRecoveryService.prototype.getJournal = function() {
  if (!fs.existsSync(this.journalPath)) {
    return [];
  }

  try {
    return JSON.parse(fs.readFileSync(this.journalPath, 'utf8'));
  } catch (e) {
    return [];
  }
};

ErrorRecoveryService.prototype.getStatus = function() {
  return {
    baseDir: this.baseDir,
    snapshotDir: this.snapshotDir,
    snapshots: this.listSnapshots().length,
    journalEntries: this.getJournal().length
  };
};

var _instance = null;
function getErrorRecoveryService(opts) {
  if (!_instance) _instance = new ErrorRecoveryService(opts || {});
  return _instance;
}

module.exports = {
  ErrorRecoveryService: ErrorRecoveryService,
  getErrorRecoveryService: getErrorRecoveryService,
  MAX_SNAPSHOTS: MAX_SNAPSHOTS
};
