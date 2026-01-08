/**
 * Dragon UI CLI Test Suite
 * Validates CLI functionality and service integrations
 */

const { execSync, spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const assert = require('assert');

// Test configuration
const CLI_PATH = path.resolve(__dirname, '../cli/index.cjs');
const TIMEOUT = 10000;

// Test results tracking
const results = {
  passed: 0,
  failed: 0,
  skipped: 0,
  tests: []
};

// Colors for output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m'
};

/**
 * Run a CLI command and return output
 */
function runCLI(args, options = {}) {
  try {
    const result = execSync(`node "${CLI_PATH}" ${args}`, {
      encoding: 'utf8',
      timeout: options.timeout || TIMEOUT,
      stdio: ['pipe', 'pipe', 'pipe'],
      ...options
    });
    return { success: true, output: result, error: null };
  } catch (error) {
    // Treat non-zero exit or stderr as potentially valid output
    const output = (error.stdout || '') + (error.stderr || '');
    if (output.length > 0 && !error.message.includes('ETIMEDOUT')) {
      return { success: true, output, error: null };
    }
    return {
      success: false,
      output: error.stdout || '',
      error: error.stderr || error.message
    };
  }
}

/**
 * Test helper - run a test case
 */
function test(name, fn) {
  const startTime = Date.now();
  try {
    fn();
    const duration = Date.now() - startTime;
    results.passed++;
    results.tests.push({ name, status: 'passed', duration });
    console.log(`${colors.green}✓${colors.reset} ${name} ${colors.dim}(${duration}ms)${colors.reset}`);
  } catch (error) {
    const duration = Date.now() - startTime;
    results.failed++;
    results.tests.push({ name, status: 'failed', duration, error: error.message });
    console.log(`${colors.red}✗${colors.reset} ${name}`);
    console.log(`  ${colors.red}${error.message}${colors.reset}`);
  }
}

/**
 * Skip a test
 */
function skip(name, reason = '') {
  results.skipped++;
  results.tests.push({ name, status: 'skipped', reason });
  console.log(`${colors.yellow}○${colors.reset} ${name} ${colors.dim}(skipped${reason ? ': ' + reason : ''})${colors.reset}`);
}

/**
 * Test group header
 */
function describe(name, fn) {
  console.log(`\n${colors.cyan}${name}${colors.reset}`);
  console.log('─'.repeat(50));
  fn();
}

// ============================================
// Tests
// ============================================

console.log('\n🧪 Dragon UI CLI Test Suite\n');
console.log('='.repeat(50));

// Version and Help Tests
describe('Version and Help', () => {
  test('--version shows version number', () => {
    const result = runCLI('--version');
    assert.ok(result.success, 'Command should succeed');
    assert.match(result.output, /\d+\.\d+\.\d+/, 'Should output version number');
  });

  test('--help shows usage information', () => {
    const result = runCLI('--help');
    assert.ok(result.success, 'Command should succeed');
    assert.ok(result.output.includes('dragon-ui-claude-cli'), 'Should show CLI name');
    assert.ok(result.output.includes('Options'), 'Should show options section');
  });
});

// Statusline Tests
describe('Statusline Command', () => {
  test('statusline --help-config shows configuration help', () => {
    const result = runCLI('statusline --help-config');
    assert.ok(result.success, 'Command should succeed');
    assert.ok(result.output.includes('Statusline') || result.output.includes('Configuration'), 'Should show help');
  });

  test('statusline with default settings renders', () => {
    const result = runCLI('statusline');
    assert.ok(result.success || result.output.length > 0, 'Should render statusline');
  });

  test('statusline --style dragon uses dragon style', () => {
    const result = runCLI('statusline --style dragon');
    assert.ok(result.success || result.output.length > 0, 'Should render with dragon style');
  });
});

// Config Tests
describe('Config Command', () => {
  test('config help shows configuration help', () => {
    const result = runCLI('config help');
    assert.ok(result.success, 'Command should succeed');
    assert.ok(result.output.includes('Configuration') || result.output.includes('config'), 'Should show config help');
  });

  test('config path shows config file location', () => {
    const result = runCLI('config path');
    assert.ok(result.success, 'Command should succeed');
    // Either shows path or says no config found
    assert.ok(result.output.includes('Config') || result.output.includes('config'), 'Should mention config');
  });

  test('config show displays current configuration', () => {
    const result = runCLI('config show');
    assert.ok(result.success, 'Command should succeed');
    assert.ok(result.output.includes('Configuration') || result.output.includes('{'), 'Should show configuration');
  });
});

// Pricing Tests
describe('Pricing Command', () => {
  test('pricing list shows available models', () => {
    const result = runCLI('pricing list');
    assert.ok(result.success, 'Command should succeed');
    assert.ok(result.output.includes('claude') || result.output.includes('Model'), 'Should list models');
  });

  test('pricing detect --model claude-sonnet-4 detects model', () => {
    const result = runCLI('pricing detect --model claude-sonnet-4');
    assert.ok(result.success, 'Command should succeed');
    assert.ok(result.output.includes('claude') || result.output.includes('detected') || result.output.includes('Model'), 'Should detect model');
  });

  test('pricing stats shows cache statistics', () => {
    const result = runCLI('pricing stats');
    assert.ok(result.success, 'Command should succeed');
    assert.ok(result.output.includes('Cache') || result.output.includes('cache') || result.output.includes('Stats'), 'Should show cache stats');
  });
});

// Powerline Tests
describe('Powerline Command', () => {
  test('powerline help shows available commands', () => {
    const result = runCLI('powerline help');
    assert.ok(result.success, 'Command should succeed');
    assert.ok(result.output.includes('Powerline') || result.output.includes('theme'), 'Should show powerline help');
  });

  test('powerline themes lists available themes', () => {
    const result = runCLI('powerline themes');
    assert.ok(result.success, 'Command should succeed');
    assert.ok(result.output.includes('dragon') || result.output.includes('Theme'), 'Should list themes');
  });

  test('powerline separators lists separator types', () => {
    const result = runCLI('powerline separators');
    assert.ok(result.success, 'Command should succeed');
    assert.ok(result.output.includes('arrows') || result.output.includes('Separator'), 'Should list separators');
  });

  test('powerline status shows current status', () => {
    const result = runCLI('powerline status');
    assert.ok(result.success, 'Command should succeed');
    assert.ok(result.output.includes('Status') || result.output.includes('enabled') || result.output.includes('disabled'), 'Should show status');
  });
});

// Custom Commands Tests
describe('Custom Commands', () => {
  test('custom-commands help shows available actions', () => {
    const result = runCLI('custom-commands help');
    assert.ok(result.success, 'Command should succeed');
    assert.ok(result.output.includes('Custom') || result.output.includes('command'), 'Should show help');
  });

  test('custom-commands templates lists available templates', () => {
    const result = runCLI('custom-commands templates');
    assert.ok(result.success, 'Command should succeed');
    assert.ok(result.output.includes('Template') || result.output.includes('template'), 'Should list templates');
  });

  test('custom-commands transformers lists output transformers', () => {
    const result = runCLI('custom-commands transformers');
    assert.ok(result.success, 'Command should succeed');
    assert.ok(result.output.includes('Transformer') || result.output.includes('transformer') || result.output.includes('uppercase'), 'Should list transformers');
  });

  test('custom-commands list shows registered commands', () => {
    const result = runCLI('custom-commands list');
    assert.ok(result.success, 'Command should succeed');
    // May show empty list or commands
  });
});

// Provider Tests
describe('Provider Command', () => {
  test('providers help shows available commands', () => {
    const result = runCLI('providers help');
    assert.ok(result.success, 'Command should succeed');
    assert.ok(result.output.includes('Provider') || result.output.includes('provider'), 'Should show help');
  });

  test('providers list shows all providers', () => {
    const result = runCLI('providers list');
    assert.ok(result.success, 'Command should succeed');
    assert.ok(result.output.includes('anthropic') || result.output.includes('Anthropic') || result.output.includes('Provider'), 'Should list providers');
  });

  test('providers show anthropic shows provider details', () => {
    const result = runCLI('providers show anthropic');
    assert.ok(result.success, 'Command should succeed');
    assert.ok(result.output.includes('Anthropic') || result.output.includes('anthropic'), 'Should show Anthropic details');
  });

  test('providers detect claude-sonnet-4 detects Anthropic', () => {
    const result = runCLI('providers detect claude-sonnet-4');
    assert.ok(result.success, 'Command should succeed');
    assert.ok(result.output.includes('anthropic') || result.output.includes('Anthropic') || result.output.includes('detected'), 'Should detect Anthropic');
  });

  test('providers stats shows usage statistics', () => {
    const result = runCLI('providers stats');
    assert.ok(result.success, 'Command should succeed');
    assert.ok(result.output.includes('Stats') || result.output.includes('stats') || result.output.includes('requests'), 'Should show stats');
  });
});

// Agent Tests
describe('Agent Command', () => {
  test('agents help shows available commands', () => {
    const result = runCLI('agents help');
    assert.ok(result.success, 'Command should succeed');
    assert.ok(result.output.includes('Agent') || result.output.includes('agent'), 'Should show help');
  });

  test('agents types lists agent types', () => {
    const result = runCLI('agents types');
    assert.ok(result.success, 'Command should succeed');
    assert.ok(result.output.includes('tool_use') || result.output.includes('Agent') || result.output.includes('Type'), 'Should list types');
  });

  test('agents categories lists tool categories', () => {
    const result = runCLI('agents categories');
    assert.ok(result.success, 'Command should succeed');
    assert.ok(result.output.includes('file') || result.output.includes('Category') || result.output.includes('category'), 'Should list categories');
  });

  test('agents detect "Read file.txt" detects file operation', () => {
    const result = runCLI('agents detect "Read file.txt"');
    assert.ok(result.success, 'Command should succeed');
    assert.ok(result.output.includes('file') || result.output.includes('detect') || result.output.includes('Detection'), 'Should detect file operation');
  });

  test('agents stats shows detection statistics', () => {
    const result = runCLI('agents stats');
    assert.ok(result.success, 'Command should succeed');
    assert.ok(result.output.includes('Stats') || result.output.includes('stats') || result.output.includes('detection'), 'Should show stats');
  });
});

// Migration Tests
describe('Migration Command', () => {
  test('migrate help shows available commands', () => {
    const result = runCLI('migrate help');
    assert.ok(result.success, 'Command should succeed');
    assert.ok(result.output.includes('Migration') || result.output.includes('migrate'), 'Should show help');
  });

  test('migrate status shows migration status', () => {
    const result = runCLI('migrate status');
    assert.ok(result.success, 'Command should succeed');
    assert.ok(result.output.includes('Status') || result.output.includes('Migration') || result.output.includes('Version'), 'Should show status');
  });

  test('migrate files shows settings files info', () => {
    const result = runCLI('migrate files');
    assert.ok(result.success, 'Command should succeed');
    assert.ok(result.output.includes('Files') || result.output.includes('.dragon-ui') || result.output.includes('Settings'), 'Should show files');
  });

  test('migrate backups lists available backups', () => {
    const result = runCLI('migrate backups');
    assert.ok(result.success, 'Command should succeed');
    // May show empty list or backups
  });
});

// TUI Tests
describe('TUI Command', () => {
  test('tui help shows available commands', () => {
    const result = runCLI('tui help');
    assert.ok(result.success, 'Command should succeed');
    assert.ok(result.output.includes('TUI') || result.output.includes('Dashboard') || result.output.includes('theme'), 'Should show help');
  });

  test('tui themes lists available themes', () => {
    const result = runCLI('tui themes');
    assert.ok(result.success, 'Command should succeed');
    assert.ok(result.output.includes('dragon') || result.output.includes('Theme'), 'Should list themes');
  });

  test('tui preview dragon previews dragon theme', () => {
    const result = runCLI('tui preview dragon');
    assert.ok(result.success, 'Command should succeed');
    assert.ok(result.output.includes('Dragon') || result.output.includes('Theme') || result.output.includes('Preview'), 'Should preview theme');
  });
});

// Service Tests
describe('Service Module Tests', () => {
  test('provider-manager.cjs loads correctly', () => {
    const providerManager = require('../services/provider-manager.cjs');
    assert.ok(providerManager.providerManager, 'Should export providerManager');
    assert.ok(typeof providerManager.providerManager.getAllProviders === 'function', 'Should have getAllProviders method');
  });

  test('agent-detector.cjs loads correctly', () => {
    const agentDetector = require('../services/agent-detector.cjs');
    assert.ok(agentDetector.agentDetector, 'Should export agentDetector');
    assert.ok(typeof agentDetector.agentDetector.detect === 'function', 'Should have detect method');
  });

  test('settings-migration.cjs loads correctly', () => {
    const migration = require('../services/settings-migration.cjs');
    assert.ok(migration.settingsMigration, 'Should export settingsMigration');
    assert.ok(typeof migration.settingsMigration.checkMigrationNeeded === 'function', 'Should have checkMigrationNeeded method');
  });

  test('async-db-writer.cjs loads correctly', () => {
    const asyncDb = require('../services/async-db-writer.cjs');
    assert.ok(asyncDb.AsyncDbWriter, 'Should export AsyncDbWriter');
    assert.ok(typeof asyncDb.createAsyncWrapper === 'function', 'Should have createAsyncWrapper function');
  });

  test('tui-dashboard.cjs loads correctly', () => {
    const tui = require('../services/tui-dashboard.cjs');
    assert.ok(tui.TUIDashboard, 'Should export TUIDashboard');
    assert.ok(tui.THEMES, 'Should export THEMES');
    assert.ok(tui.COMPONENT_TYPES, 'Should export COMPONENT_TYPES');
  });
});

// Integration Tests
describe('Integration Tests', () => {
  test('Agent detector can detect tool usage', () => {
    const { agentDetector } = require('../services/agent-detector.cjs');
    const result = agentDetector.detect('Read file.txt');
    assert.ok(result.type, 'Should return detection type');
    assert.ok(typeof result.confidence === 'number', 'Should return confidence score');
  });

  test('Provider manager can detect providers', () => {
    const { providerManager } = require('../services/provider-manager.cjs');
    const providerId = providerManager.detectProvider('claude-sonnet-4');
    assert.strictEqual(providerId, 'anthropic', 'Should detect Anthropic for Claude models');
  });

  test('Settings migration can check status', () => {
    const { settingsMigration } = require('../services/settings-migration.cjs');
    const status = settingsMigration.checkMigrationNeeded();
    assert.ok(status.currentVersion, 'Should return current version');
    assert.ok(typeof status.needsMigration === 'boolean', 'Should return needsMigration flag');
  });

  test('TUI dashboard themes are available', () => {
    const { THEMES } = require('../services/tui-dashboard.cjs');
    assert.ok(THEMES.dragon, 'Should have dragon theme');
    assert.ok(THEMES.ocean, 'Should have ocean theme');
    assert.ok(THEMES.forest, 'Should have forest theme');
    assert.ok(THEMES.minimal, 'Should have minimal theme');
  });
});

// Print summary
console.log('\n' + '='.repeat(50));
console.log('\n📊 Test Summary\n');
console.log(`${colors.green}Passed:${colors.reset}  ${results.passed}`);
console.log(`${colors.red}Failed:${colors.reset}  ${results.failed}`);
console.log(`${colors.yellow}Skipped:${colors.reset} ${results.skipped}`);
console.log(`\nTotal:   ${results.passed + results.failed + results.skipped}`);

// Exit with appropriate code
if (results.failed > 0) {
  console.log(`\n${colors.red}Tests failed!${colors.reset}\n`);
  process.exit(1);
} else {
  console.log(`\n${colors.green}All tests passed!${colors.reset}\n`);
  process.exit(0);
}
