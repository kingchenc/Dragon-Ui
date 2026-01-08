/**
 * Settings Migration CLI Commands
 * Manage settings migration, backup, and restore
 */

const { settingsMigration, SETTINGS_FILES } = require('../../services/settings-migration.cjs');

// Dynamic chalk import for ESM compatibility
let chalk = null;
async function initChalk() {
  if (!chalk) {
    const chalkModule = await import('chalk');
    chalk = chalkModule.default;
  }
  return chalk;
}

/**
 * Check migration status
 */
async function checkStatus() {
  await initChalk();

  console.log(chalk.bold('\n📋 Settings Migration Status\n'));

  const status = settingsMigration.checkMigrationNeeded();

  console.log(`Current Version: ${chalk.cyan(status.currentVersion)}`);
  console.log(`Migration Needed: ${status.needsMigration ? chalk.yellow('Yes') : chalk.green('No')}\n`);

  console.log(chalk.bold('Settings Files:'));
  console.log('─'.repeat(60));

  for (const [key, info] of Object.entries(status.details)) {
    const statusIcon = !info.exists
      ? chalk.gray('○')
      : info.needsMigration
        ? chalk.yellow('●')
        : chalk.green('●');

    const versionInfo = info.exists
      ? `${chalk.dim(info.currentVersion)} → ${chalk.cyan(info.targetVersion)}`
      : chalk.gray('Not created');

    const migrationStatus = !info.exists
      ? ''
      : info.needsMigration
        ? chalk.yellow(' (needs migration)')
        : chalk.green(' (up to date)');

    console.log(`${statusIcon} ${chalk.bold(key.padEnd(20))} ${versionInfo}${migrationStatus}`);
  }

  console.log('');
}

/**
 * Run migrations
 */
async function runMigration(options = {}) {
  await initChalk();

  console.log(chalk.bold('\n🔄 Running Settings Migration\n'));

  const status = settingsMigration.checkMigrationNeeded();

  if (!status.needsMigration && !options.force) {
    console.log(chalk.green('✓ All settings are up to date'));
    console.log(chalk.dim(`  Current version: ${status.currentVersion}`));
    return;
  }

  if (options.dryRun) {
    console.log(chalk.yellow('DRY RUN - No changes will be made\n'));
  }

  // Create backup first
  if (!options.dryRun && options.backup !== false) {
    console.log('Creating backup...');
    const backupResult = settingsMigration.createBackup('pre-migration');
    if (backupResult.success) {
      console.log(chalk.green(`✓ Backup created: ${backupResult.path}`));
    } else {
      console.log(chalk.red(`✗ Backup failed: ${backupResult.error}`));
      if (!options.force) {
        console.log(chalk.yellow('Use --force to proceed without backup'));
        return;
      }
    }
  }

  console.log('');

  // Run migrations
  if (options.dryRun) {
    console.log(chalk.bold('Migrations that would be applied:'));
    for (const [key, info] of Object.entries(status.details)) {
      if (info.needsMigration) {
        console.log(`  ${chalk.cyan(key)}: ${info.currentVersion} → ${info.targetVersion}`);
      }
    }
  } else {
    const results = settingsMigration.migrateAll({ backup: false });

    console.log(chalk.bold('Migration Results:'));
    console.log('─'.repeat(50));

    for (const [key, result] of Object.entries(results.migrations)) {
      if (result.skipped) {
        console.log(`${chalk.gray('○')} ${key}: ${chalk.gray(result.reason)}`);
      } else if (result.success) {
        console.log(`${chalk.green('✓')} ${key}: ${result.fromVersion} → ${result.toVersion}`);
        if (result.appliedMigrations && result.appliedMigrations.length > 0) {
          for (const m of result.appliedMigrations) {
            console.log(`    ${chalk.dim(`- ${m.version}: ${m.description}`)}`);
          }
        }
      } else {
        console.log(`${chalk.red('✗')} ${key}: ${chalk.red(result.error)}`);
      }
    }

    console.log('');
    if (results.success) {
      console.log(chalk.green('✓ Migration completed successfully'));
    } else {
      console.log(chalk.red('✗ Migration completed with errors'));
    }
  }

  console.log('');
}

/**
 * List backups
 */
async function listBackups() {
  await initChalk();

  console.log(chalk.bold('\n📦 Settings Backups\n'));

  const backups = settingsMigration.listBackups();

  if (backups.length === 0) {
    console.log(chalk.gray('No backups found'));
    console.log(chalk.dim('\nCreate a backup with: dragon-ui-claude-cli migrate backup'));
    return;
  }

  console.log('─'.repeat(70));

  for (const backup of backups) {
    const date = backup.timestamp
      ? new Date(backup.timestamp).toLocaleString()
      : 'Unknown date';

    console.log(`${chalk.cyan(backup.name)}`);
    console.log(`  ${chalk.dim('Date:')} ${date}`);
    console.log(`  ${chalk.dim('Version:')} ${backup.version || 'Unknown'}`);
    console.log(`  ${chalk.dim('Files:')} ${backup.files ? backup.files.join(', ') : 'Unknown'}`);
    console.log('');
  }

  console.log(chalk.dim(`Total: ${backups.length} backup(s)`));
  console.log('');
}

/**
 * Create backup
 */
async function createBackup(label) {
  await initChalk();

  console.log(chalk.bold('\n📦 Creating Backup\n'));

  const result = settingsMigration.createBackup(label);

  if (result.success) {
    console.log(chalk.green('✓ Backup created successfully'));
    console.log(`  ${chalk.dim('Path:')} ${result.path}`);
    console.log(`  ${chalk.dim('Files:')} ${result.files.join(', ')}`);
  } else {
    console.log(chalk.red(`✗ Backup failed: ${result.error}`));
  }

  console.log('');
}

/**
 * Restore from backup
 */
async function restoreBackup(backupName) {
  await initChalk();

  if (!backupName) {
    console.log(chalk.red('\nError: Backup name required'));
    console.log(chalk.dim('Usage: dragon-ui-claude-cli migrate restore <backup-name>'));
    console.log(chalk.dim('List backups: dragon-ui-claude-cli migrate backups'));
    return;
  }

  console.log(chalk.bold('\n🔄 Restoring from Backup\n'));

  // Create backup of current state first
  console.log('Creating backup of current state...');
  const currentBackup = settingsMigration.createBackup('pre-restore');
  if (currentBackup.success) {
    console.log(chalk.green(`✓ Current state backed up to: ${currentBackup.path}`));
  }

  console.log(`\nRestoring from: ${chalk.cyan(backupName)}`);

  const result = settingsMigration.restoreBackup(backupName);

  if (result.success) {
    console.log(chalk.green('\n✓ Restore completed successfully'));
    console.log(`  ${chalk.dim('Version:')} ${result.version || 'Unknown'}`);
    console.log(`  ${chalk.dim('Files restored:')} ${result.restored.join(', ')}`);
  } else {
    console.log(chalk.red(`\n✗ Restore failed: ${result.error}`));
  }

  console.log('');
}

/**
 * Delete backup
 */
async function deleteBackup(backupName) {
  await initChalk();

  if (!backupName) {
    console.log(chalk.red('\nError: Backup name required'));
    console.log(chalk.dim('Usage: dragon-ui-claude-cli migrate delete <backup-name>'));
    return;
  }

  console.log(chalk.bold(`\n🗑️  Deleting Backup: ${backupName}\n`));

  const result = settingsMigration.deleteBackup(backupName);

  if (result.success) {
    console.log(chalk.green('✓ Backup deleted successfully'));
  } else {
    console.log(chalk.red(`✗ Delete failed: ${result.error}`));
  }

  console.log('');
}

/**
 * Export settings
 */
async function exportSettings(filePath) {
  await initChalk();

  const exportPath = filePath || `dragon-ui-settings-${Date.now()}.json`;

  console.log(chalk.bold('\n📤 Exporting Settings\n'));

  const result = settingsMigration.exportSettings(exportPath);

  if (result.success) {
    console.log(chalk.green('✓ Settings exported successfully'));
    console.log(`  ${chalk.dim('File:')} ${result.path}`);
  } else {
    console.log(chalk.red(`✗ Export failed: ${result.error}`));
  }

  console.log('');
}

/**
 * Import settings
 */
async function importSettings(filePath, options = {}) {
  await initChalk();

  if (!filePath) {
    console.log(chalk.red('\nError: File path required'));
    console.log(chalk.dim('Usage: dragon-ui-claude-cli migrate import <file-path>'));
    return;
  }

  console.log(chalk.bold('\n📥 Importing Settings\n'));

  const result = settingsMigration.importSettings(filePath, options);

  if (result.success) {
    console.log(chalk.green('✓ Settings imported successfully'));
    console.log(`  ${chalk.dim('Source version:')} ${result.sourceVersion || 'Unknown'}`);
    console.log(`  ${chalk.dim('Files imported:')} ${result.imported.join(', ')}`);
  } else {
    console.log(chalk.red(`✗ Import failed: ${result.error}`));
  }

  console.log('');
}

/**
 * Reset settings
 */
async function resetSettings(key, options = {}) {
  await initChalk();

  console.log(chalk.bold('\n⚠️  Reset Settings\n'));

  if (key) {
    // Reset specific key
    if (!SETTINGS_FILES[key]) {
      console.log(chalk.red(`Unknown settings key: ${key}`));
      console.log(chalk.dim(`Valid keys: ${Object.keys(SETTINGS_FILES).join(', ')}`));
      return;
    }

    if (!options.force) {
      console.log(chalk.yellow(`This will delete settings for: ${key}`));
      console.log(chalk.dim('Use --force to confirm'));
      return;
    }

    const result = settingsMigration.resetSettings(key);
    if (result.success) {
      console.log(chalk.green(`✓ ${key} settings reset`));
    } else {
      console.log(chalk.red(`✗ Reset failed: ${result.error}`));
    }
  } else {
    // Reset all
    if (!options.force) {
      console.log(chalk.yellow('This will delete ALL Dragon UI settings!'));
      console.log(chalk.dim('Use --force to confirm'));
      return;
    }

    // Backup first unless explicitly disabled
    if (options.backup !== false) {
      console.log('Creating backup before reset...');
      const backupResult = settingsMigration.createBackup('pre-reset');
      if (backupResult.success) {
        console.log(chalk.green(`✓ Backup created: ${backupResult.path}`));
      }
    }

    console.log('');

    const results = settingsMigration.resetAll({ backup: false });

    for (const [k, result] of Object.entries(results)) {
      if (result.success) {
        if (result.skipped) {
          console.log(`${chalk.gray('○')} ${k}: ${chalk.gray(result.reason)}`);
        } else {
          console.log(`${chalk.green('✓')} ${k}: reset`);
        }
      } else {
        console.log(`${chalk.red('✗')} ${k}: ${result.error}`);
      }
    }

    console.log(chalk.green('\n✓ All settings reset to defaults'));
  }

  console.log('');
}

/**
 * Show settings files info
 */
async function showFiles() {
  await initChalk();

  console.log(chalk.bold('\n📁 Settings Files\n'));

  const fs = require('fs');
  const path = require('path');
  const os = require('os');
  const homeDir = os.homedir();

  console.log(`Location: ${chalk.cyan(homeDir)}\n`);
  console.log('─'.repeat(60));

  for (const [key, filename] of Object.entries(SETTINGS_FILES)) {
    const filePath = path.join(homeDir, filename);
    const exists = fs.existsSync(filePath);

    let sizeInfo = '';
    let modifiedInfo = '';

    if (exists) {
      try {
        const stats = fs.statSync(filePath);
        sizeInfo = `${(stats.size / 1024).toFixed(1)} KB`;
        modifiedInfo = stats.mtime.toLocaleString();
      } catch {
        sizeInfo = 'Unknown';
      }
    }

    const icon = exists ? chalk.green('●') : chalk.gray('○');
    const status = exists
      ? `${chalk.dim(sizeInfo)} - ${chalk.dim(modifiedInfo)}`
      : chalk.gray('Not created');

    console.log(`${icon} ${chalk.bold(key.padEnd(18))} ${filename}`);
    console.log(`  ${status}`);
    console.log('');
  }
}

/**
 * Show help
 */
async function showHelp() {
  await initChalk();

  console.log(chalk.bold('\n🔄 Settings Migration Commands\n'));

  console.log(chalk.cyan('Usage:'));
  console.log('  dragon-ui-claude-cli migrate <action> [options]\n');

  console.log(chalk.cyan('Actions:'));
  console.log('  status              Check migration status');
  console.log('  run                 Run pending migrations');
  console.log('  backups             List available backups');
  console.log('  backup [label]      Create a new backup');
  console.log('  restore <name>      Restore from backup');
  console.log('  delete <name>       Delete a backup');
  console.log('  export [path]       Export settings to file');
  console.log('  import <path>       Import settings from file');
  console.log('  reset [key]         Reset settings to defaults');
  console.log('  files               Show settings files info');
  console.log('  help                Show this help\n');

  console.log(chalk.cyan('Options:'));
  console.log('  --dry-run           Preview migrations without applying');
  console.log('  --force             Force operation without confirmation');
  console.log('  --no-backup         Skip backup creation\n');

  console.log(chalk.cyan('Examples:'));
  console.log('  dragon-ui-claude-cli migrate status');
  console.log('  dragon-ui-claude-cli migrate run --dry-run');
  console.log('  dragon-ui-claude-cli migrate backup "before-upgrade"');
  console.log('  dragon-ui-claude-cli migrate restore backup-2024-01-15');
  console.log('  dragon-ui-claude-cli migrate export ~/my-settings.json');
  console.log('  dragon-ui-claude-cli migrate reset --force\n');
}

module.exports = {
  checkStatus,
  runMigration,
  listBackups,
  createBackup,
  restoreBackup,
  deleteBackup,
  exportSettings,
  importSettings,
  resetSettings,
  showFiles,
  showHelp
};
