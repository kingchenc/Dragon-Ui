/**
 * Data Retention CLI Commands for Dragon-UI
 * Manage data retention policies and cleanup
 *
 * @module cli/commands/retention
 */

'use strict';

const chalk = require('chalk');
const { Command } = require('commander');

/**
 * Format bytes
 * @param {number} bytes
 * @returns {string}
 */
function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Print header
 * @param {string} title
 */
function printHeader(title) {
  console.log();
  console.log(chalk.bold.cyan('═'.repeat(60)));
  console.log(chalk.bold.cyan(`  ${title}`));
  console.log(chalk.bold.cyan('═'.repeat(60)));
}

/**
 * Register retention commands
 * @param {Command} program
 */
function registerCommands(program) {
  const retention = program
    .command('retention')
    .description('Manage data retention policies')
    .action(() => {
      showHelp();
    });

  retention
    .command('status')
    .description('Show retention status and configuration')
    .option('--json', 'Output as JSON')
    .action(async (options) => {
      await showStatus(options);
    });

  retention
    .command('config')
    .description('View or update retention configuration')
    .option('--payload-days <days>', 'Payload retention days')
    .option('--metadata-days <days>', 'Metadata retention days')
    .option('--log-days <days>', 'Log retention days')
    .option('--archive-days <days>', 'Archive retention days')
    .option('--compress-after <days>', 'Compress files after days')
    .option('--archive-enabled <bool>', 'Enable archiving')
    .option('--json', 'Output as JSON')
    .action(async (options) => {
      await manageConfig(options);
    });

  retention
    .command('cleanup')
    .description('Run manual cleanup')
    .option('--dry-run', 'Show what would be cleaned without deleting')
    .option('--force', 'Skip confirmation')
    .option('--json', 'Output as JSON')
    .action(async (options) => {
      await runCleanup(options);
    });

  retention
    .command('archives')
    .description('List archived files')
    .option('-t, --type <type>', 'Archive type: payloads, metadata, logs')
    .option('-l, --limit <limit>', 'Number of archives to show', '20')
    .option('--json', 'Output as JSON')
    .action(async (options) => {
      await listArchives(options);
    });

  retention
    .command('restore <archive>')
    .description('Restore from archive')
    .option('-d, --destination <dir>', 'Destination directory')
    .action(async (archive, options) => {
      await restoreArchive(archive, options);
    });

  retention
    .command('scheduler')
    .description('Manage cleanup scheduler')
    .option('--start', 'Start the scheduler')
    .option('--stop', 'Stop the scheduler')
    .option('--status', 'Show scheduler status')
    .action(async (options) => {
      await manageScheduler(options);
    });

  retention
    .command('export')
    .description('Export retention policy')
    .argument('<file>', 'Output file path')
    .action(async (file) => {
      await exportPolicy(file);
    });

  retention
    .command('import')
    .description('Import retention policy')
    .argument('<file>', 'Policy file path')
    .action(async (file) => {
      await importPolicy(file);
    });
}

/**
 * Show help
 */
function showHelp() {
  printHeader('Data Retention Management');

  console.log();
  console.log(chalk.bold('  Available Commands:'));
  console.log(chalk.dim('  ───────────────────────────────────────────'));
  console.log(`  ${chalk.cyan('retention status')}     Show retention status`);
  console.log(`  ${chalk.cyan('retention config')}     View/update configuration`);
  console.log(`  ${chalk.cyan('retention cleanup')}    Run manual cleanup`);
  console.log(`  ${chalk.cyan('retention archives')}   List archived files`);
  console.log(`  ${chalk.cyan('retention restore')}    Restore from archive`);
  console.log(`  ${chalk.cyan('retention scheduler')} Manage cleanup scheduler`);
  console.log(`  ${chalk.cyan('retention export')}     Export policy`);
  console.log(`  ${chalk.cyan('retention import')}     Import policy`);

  console.log();
  console.log(chalk.bold('  Default Retention Periods:'));
  console.log(chalk.dim('  ───────────────────────────────────────────'));
  console.log(`  Payloads:    ${chalk.yellow('7 days')}`);
  console.log(`  Metadata:    ${chalk.yellow('365 days')}`);
  console.log(`  Logs:        ${chalk.yellow('30 days')}`);
  console.log(`  Archives:    ${chalk.yellow('730 days (2 years)')}`);
  console.log();
}

/**
 * Get retention manager instance
 * @returns {Object}
 */
function getRetentionManager() {
  const { getDataRetentionManager } = require('../../services/data-retention.cjs');
  return getDataRetentionManager();
}

/**
 * Show retention status
 * @param {Object} options
 */
async function showStatus(options) {
  try {
    const manager = getRetentionManager();
    const stats = manager.getStats();
    const info = manager.getRetentionInfo();

    if (options.json) {
      console.log(JSON.stringify({ stats, info }, null, 2));
      return;
    }

    printHeader('Data Retention Status');

    console.log();
    console.log(chalk.bold('  Retention Periods'));
    console.log(chalk.dim('  ───────────────────────────────────────────'));
    console.log(`  Payloads:     ${chalk.yellow(info.payloads)}`);
    console.log(`  Metadata:     ${chalk.yellow(info.metadata)}`);
    console.log(`  Logs:         ${chalk.yellow(info.logs)}`);
    console.log(`  Archives:     ${chalk.yellow(info.archives)}`);

    console.log();
    console.log(chalk.bold('  Compression'));
    console.log(chalk.dim('  ───────────────────────────────────────────'));
    console.log(`  Compress After: ${chalk.cyan(info.compression)}`);

    console.log();
    console.log(chalk.bold('  Archive Storage'));
    console.log(chalk.dim('  ───────────────────────────────────────────'));
    console.log(`  Current Size:  ${chalk.green(info.archiveSize)}`);
    console.log(`  Max Size:      ${chalk.yellow(info.maxArchiveSize)}`);

    console.log();
    console.log(chalk.bold('  Cleanup Statistics'));
    console.log(chalk.dim('  ───────────────────────────────────────────'));
    console.log(`  Last Cleanup:     ${stats.lastCleanup ? chalk.cyan(new Date(stats.lastCleanup).toLocaleString()) : chalk.dim('Never')}`);
    console.log(`  Total Cleaned:    ${chalk.blue(stats.totalCleaned)}`);
    console.log(`  Total Compressed: ${chalk.blue(stats.totalCompressed)}`);
    console.log(`  Total Archived:   ${chalk.blue(stats.totalArchived)}`);

    console.log();
    console.log(chalk.bold('  Scheduler'));
    console.log(chalk.dim('  ───────────────────────────────────────────'));
    const schedulerStatus = stats.schedulerRunning ? chalk.green('Running') : chalk.yellow('Stopped');
    console.log(`  Status:       ${schedulerStatus}`);

    if (stats.errors.length > 0) {
      console.log();
      console.log(chalk.bold.red('  Recent Errors'));
      console.log(chalk.dim('  ───────────────────────────────────────────'));
      for (const error of stats.errors.slice(-5)) {
        console.log(`  ${chalk.dim(new Date(error.timestamp).toLocaleString())} ${chalk.red(error.error)}`);
      }
    }

  } catch (error) {
    console.error(chalk.red('Error getting status:'), error.message);
    process.exit(1);
  }
}

/**
 * Manage configuration
 * @param {Object} options
 */
async function manageConfig(options) {
  try {
    const manager = getRetentionManager();
    const updates = {};

    // Check for updates
    if (options.payloadDays) {
      updates.payloadRetentionDays = parseInt(options.payloadDays, 10);
    }
    if (options.metadataDays) {
      updates.metadataRetentionDays = parseInt(options.metadataDays, 10);
    }
    if (options.logDays) {
      updates.logRetentionDays = parseInt(options.logDays, 10);
    }
    if (options.archiveDays) {
      updates.archiveRetentionDays = parseInt(options.archiveDays, 10);
    }
    if (options.compressAfter) {
      updates.compressAfterDays = parseInt(options.compressAfter, 10);
    }
    if (options.archiveEnabled !== undefined) {
      updates.archiveEnabled = options.archiveEnabled === 'true';
    }

    // Apply updates
    if (Object.keys(updates).length > 0) {
      manager.updateConfig(updates);
      console.log(chalk.green('Configuration updated:'));
      for (const [key, value] of Object.entries(updates)) {
        console.log(`  ${chalk.cyan(key)}: ${chalk.yellow(value)}`);
      }
    }

    // Show current config
    const config = manager.getConfig();

    if (options.json) {
      console.log(JSON.stringify(config, null, 2));
      return;
    }

    if (Object.keys(updates).length === 0) {
      printHeader('Retention Configuration');

      console.log();
      console.log(chalk.dim('  ' + 'Option'.padEnd(30) + 'Value'));
      console.log(chalk.dim('  ' + '─'.repeat(50)));

      const configItems = [
        ['payloadRetentionDays', `${config.payloadRetentionDays} days`],
        ['metadataRetentionDays', `${config.metadataRetentionDays} days`],
        ['logRetentionDays', `${config.logRetentionDays} days`],
        ['archiveRetentionDays', `${config.archiveRetentionDays} days`],
        ['compressAfterDays', `${config.compressAfterDays} days`],
        ['archiveEnabled', config.archiveEnabled ? 'Yes' : 'No'],
        ['maxPayloadSize', formatBytes(config.maxPayloadSize)],
        ['maxArchiveSize', formatBytes(config.maxArchiveSize)],
        ['cleanupInterval', `${config.cleanupIntervalMs / 1000}s`]
      ];

      for (const [key, value] of configItems) {
        console.log(`  ${chalk.cyan(key.padEnd(30))} ${chalk.yellow(value)}`);
      }
    }

  } catch (error) {
    console.error(chalk.red('Error managing config:'), error.message);
    process.exit(1);
  }
}

/**
 * Run cleanup
 * @param {Object} options
 */
async function runCleanup(options) {
  try {
    const manager = getRetentionManager();

    if (options.dryRun) {
      console.log(chalk.yellow('Dry run mode - no files will be deleted'));
    }

    if (!options.force && !options.dryRun) {
      console.log(chalk.yellow('This will clean up old data according to retention policy.'));
      console.log(chalk.yellow('Use --force to skip confirmation or --dry-run to preview.'));
      return;
    }

    console.log(chalk.cyan('Running cleanup...'));
    const results = await manager.runCleanup();

    if (options.json) {
      console.log(JSON.stringify(results, null, 2));
      return;
    }

    printHeader('Cleanup Results');

    console.log();
    console.log(chalk.bold('  Payloads'));
    console.log(chalk.dim('  ───────────────────────────────────────────'));
    console.log(`  Cleaned:    ${chalk.blue(results.payloads.cleaned)}`);
    console.log(`  Compressed: ${chalk.blue(results.payloads.compressed)}`);
    console.log(`  Archived:   ${chalk.blue(results.payloads.archived)}`);

    console.log();
    console.log(chalk.bold('  Metadata'));
    console.log(chalk.dim('  ───────────────────────────────────────────'));
    console.log(`  Cleaned:    ${chalk.blue(results.metadata.cleaned)}`);
    console.log(`  Compressed: ${chalk.blue(results.metadata.compressed)}`);
    console.log(`  Archived:   ${chalk.blue(results.metadata.archived)}`);

    console.log();
    console.log(chalk.bold('  Logs'));
    console.log(chalk.dim('  ───────────────────────────────────────────'));
    console.log(`  Cleaned:    ${chalk.blue(results.logs.cleaned)}`);
    console.log(`  Compressed: ${chalk.blue(results.logs.compressed)}`);
    console.log(`  Archived:   ${chalk.blue(results.logs.archived)}`);

    console.log();
    console.log(chalk.bold('  Archives'));
    console.log(chalk.dim('  ───────────────────────────────────────────'));
    console.log(`  Cleaned:    ${chalk.blue(results.archives.cleaned)}`);

    console.log();
    console.log(chalk.dim(`  Duration: ${results.duration}ms`));

    if (results.errors.length > 0) {
      console.log();
      console.log(chalk.bold.red('  Errors'));
      for (const error of results.errors) {
        console.log(`  ${chalk.red(error)}`);
      }
    }

  } catch (error) {
    console.error(chalk.red('Error running cleanup:'), error.message);
    process.exit(1);
  }
}

/**
 * List archives
 * @param {Object} options
 */
async function listArchives(options) {
  try {
    const manager = getRetentionManager();
    const archives = manager.listArchives(options.type);
    const limit = parseInt(options.limit, 10);

    if (options.json) {
      console.log(JSON.stringify(archives.slice(0, limit), null, 2));
      return;
    }

    printHeader(`Archives${options.type ? ` (${options.type})` : ''}`);

    if (archives.length === 0) {
      console.log();
      console.log(chalk.yellow('  No archives found'));
      return;
    }

    console.log();
    console.log(chalk.dim('  ' +
      'Type'.padEnd(12) +
      'Name'.padEnd(35) +
      'Size'.padStart(10) +
      'Modified'.padStart(20)
    ));
    console.log(chalk.dim('  ' + '─'.repeat(77)));

    const displayArchives = archives.slice(0, limit);

    for (const archive of displayArchives) {
      const type = archive.type.padEnd(12);
      const name = archive.name.substring(0, 34).padEnd(35);
      const size = formatBytes(archive.size).padStart(10);
      const modified = new Date(archive.modified).toLocaleDateString().padStart(20);

      console.log(`  ${chalk.cyan(type)}${chalk.white(name)}${chalk.green(size)}${chalk.dim(modified)}`);
    }

    if (archives.length > limit) {
      console.log();
      console.log(chalk.dim(`  ... and ${archives.length - limit} more archives`));
    }

    console.log();
    const totalSize = archives.reduce((sum, a) => sum + a.size, 0);
    console.log(chalk.dim(`  Total: ${archives.length} archives, ${formatBytes(totalSize)}`));

  } catch (error) {
    console.error(chalk.red('Error listing archives:'), error.message);
    process.exit(1);
  }
}

/**
 * Restore from archive
 * @param {string} archive
 * @param {Object} options
 */
async function restoreArchive(archive, options) {
  try {
    const manager = getRetentionManager();
    const destination = options.destination || process.cwd();

    console.log(chalk.cyan(`Restoring ${archive}...`));
    const restored = await manager.restoreFromArchive(archive, destination);

    console.log(chalk.green(`Restored to: ${restored}`));

  } catch (error) {
    console.error(chalk.red('Error restoring archive:'), error.message);
    process.exit(1);
  }
}

/**
 * Manage scheduler
 * @param {Object} options
 */
async function manageScheduler(options) {
  try {
    const manager = getRetentionManager();

    if (options.start) {
      manager.startScheduler();
      console.log(chalk.green('Cleanup scheduler started'));
      return;
    }

    if (options.stop) {
      manager.stopScheduler();
      console.log(chalk.yellow('Cleanup scheduler stopped'));
      return;
    }

    // Show status by default
    const stats = manager.getStats();
    const status = stats.schedulerRunning ? chalk.green('Running') : chalk.yellow('Stopped');
    console.log(`Scheduler status: ${status}`);

    if (stats.lastCleanup) {
      console.log(`Last cleanup: ${new Date(stats.lastCleanup).toLocaleString()}`);
    }

  } catch (error) {
    console.error(chalk.red('Error managing scheduler:'), error.message);
    process.exit(1);
  }
}

/**
 * Export policy
 * @param {string} file
 */
async function exportPolicy(file) {
  try {
    const fs = require('fs');
    const manager = getRetentionManager();
    const policy = manager.exportPolicy();

    fs.writeFileSync(file, JSON.stringify(policy, null, 2));
    console.log(chalk.green(`Policy exported to: ${file}`));

  } catch (error) {
    console.error(chalk.red('Error exporting policy:'), error.message);
    process.exit(1);
  }
}

/**
 * Import policy
 * @param {string} file
 */
async function importPolicy(file) {
  try {
    const fs = require('fs');
    const manager = getRetentionManager();

    const content = fs.readFileSync(file, 'utf8');
    const policy = JSON.parse(content);

    manager.importPolicy(policy);
    console.log(chalk.green(`Policy imported from: ${file}`));

  } catch (error) {
    console.error(chalk.red('Error importing policy:'), error.message);
    process.exit(1);
  }
}

module.exports = {
  registerCommands
};
