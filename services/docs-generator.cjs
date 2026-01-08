/**
 * Documentation Generator Service
 * Generates comprehensive documentation for Dragon UI
 * Supports multiple output formats: terminal, markdown, HTML
 */

const fs = require('fs');
const path = require('path');

/**
 * Documentation sections
 */
const SECTIONS = {
  overview: 'overview',
  installation: 'installation',
  commands: 'commands',
  configuration: 'configuration',
  api: 'api',
  examples: 'examples',
  changelog: 'changelog',
  contributing: 'contributing'
};

/**
 * Command documentation definitions
 */
const COMMANDS = {
  statusline: {
    name: 'statusline',
    description: 'Display and configure the terminal statusline',
    usage: 'dragon-ui-claude-cli statusline [options]',
    options: [
      { flag: '-s, --style <style>', description: 'Statusline style (modern|classic|minimal|dragon)' },
      { flag: '-l, --lines <number>', description: 'Number of lines (1-3)' },
      { flag: '--no-color', description: 'Disable colors' },
      { flag: '--no-emoji', description: 'Disable emojis' },
      { flag: '--compact', description: 'Use compact display' },
      { flag: '--elements <elements>', description: 'Comma-separated elements to show' },
      { flag: '--preset <preset>', description: 'Apply preset and save' },
      { flag: '--help-config', description: 'Show configuration help' }
    ],
    examples: [
      { cmd: 'dragon-ui-claude-cli statusline', desc: 'Show statusline with defaults' },
      { cmd: 'dragon-ui-claude-cli statusline --style dragon', desc: 'Use dragon style' },
      { cmd: 'dragon-ui-claude-cli statusline --preset minimal', desc: 'Apply minimal preset' }
    ]
  },

  config: {
    name: 'config',
    description: 'Manage Dragon UI configuration',
    usage: 'dragon-ui-claude-cli config <action>',
    subcommands: [
      { name: 'init', description: 'Create configuration file' },
      { name: 'show', description: 'Display current configuration' },
      { name: 'path', description: 'Show configuration file path' },
      { name: 'help', description: 'Show configuration help' }
    ],
    options: [
      { flag: '-c, --config <path>', description: 'Path to config file' }
    ],
    examples: [
      { cmd: 'dragon-ui-claude-cli config init', desc: 'Create new config file' },
      { cmd: 'dragon-ui-claude-cli config show', desc: 'Show current settings' }
    ]
  },

  pricing: {
    name: 'pricing',
    description: 'Manage model pricing information',
    usage: 'dragon-ui-claude-cli pricing <action>',
    subcommands: [
      { name: 'list', description: 'List all model prices' },
      { name: 'refresh', description: 'Refresh pricing data' },
      { name: 'detect', description: 'Detect model from name' },
      { name: 'calculate', description: 'Calculate cost for usage' },
      { name: 'stats', description: 'Show cache statistics' }
    ],
    options: [
      { flag: '-m, --model <model>', description: 'Model name' },
      { flag: '-i, --input <tokens>', description: 'Input tokens' },
      { flag: '-o, --output <tokens>', description: 'Output tokens' },
      { flag: '--cached <tokens>', description: 'Cached tokens' },
      { flag: '-v, --verbose', description: 'Show detailed output' }
    ],
    examples: [
      { cmd: 'dragon-ui-claude-cli pricing list', desc: 'Show all model prices' },
      { cmd: 'dragon-ui-claude-cli pricing calculate -m claude-sonnet-4 -i 1000 -o 500', desc: 'Calculate cost' }
    ]
  },

  powerline: {
    name: 'powerline',
    description: 'Manage powerline mode and themes',
    usage: 'dragon-ui-claude-cli powerline <action>',
    subcommands: [
      { name: 'enable', description: 'Enable powerline mode' },
      { name: 'disable', description: 'Disable powerline mode' },
      { name: 'theme', description: 'Set powerline theme' },
      { name: 'themes', description: 'List available themes' },
      { name: 'separator', description: 'Set separator type' },
      { name: 'separators', description: 'List separator types' },
      { name: 'preview', description: 'Preview theme' },
      { name: 'preview-all', description: 'Preview all themes' },
      { name: 'status', description: 'Show current status' }
    ],
    examples: [
      { cmd: 'dragon-ui-claude-cli powerline enable dragon', desc: 'Enable with dragon theme' },
      { cmd: 'dragon-ui-claude-cli powerline themes', desc: 'List all themes' }
    ]
  },

  live: {
    name: 'live',
    description: 'Start live monitoring dashboard',
    usage: 'dragon-ui-claude-cli live [options]',
    options: [
      { flag: '-i, --interval <ms>', description: 'Refresh interval in milliseconds' },
      { flag: '--compact', description: 'Use compact display mode' },
      { flag: '--help-live', description: 'Show live dashboard help' }
    ],
    examples: [
      { cmd: 'dragon-ui-claude-cli live', desc: 'Start live dashboard' },
      { cmd: 'dragon-ui-claude-cli live -i 5000', desc: 'With 5s refresh interval' }
    ]
  },

  'custom-commands': {
    name: 'custom-commands',
    description: 'Manage custom command widgets',
    usage: 'dragon-ui-claude-cli custom-commands <action>',
    subcommands: [
      { name: 'list', description: 'List registered commands' },
      { name: 'templates', description: 'List available templates' },
      { name: 'transformers', description: 'List output transformers' },
      { name: 'add', description: 'Add a new command' },
      { name: 'remove', description: 'Remove a command' },
      { name: 'test', description: 'Test a command' },
      { name: 'preview', description: 'Preview command output' },
      { name: 'export', description: 'Export commands to file' },
      { name: 'import', description: 'Import commands from file' }
    ],
    options: [
      { flag: '--id <id>', description: 'Command ID' },
      { flag: '--name <name>', description: 'Display name' },
      { flag: '--command <cmd>', description: 'Shell command' },
      { flag: '--template <name>', description: 'Use predefined template' },
      { flag: '--transform <type>', description: 'Output transformer' },
      { flag: '--timeout <ms>', description: 'Execution timeout' },
      { flag: '--cache <ms>', description: 'Cache timeout' }
    ],
    examples: [
      { cmd: 'dragon-ui-claude-cli custom-commands list', desc: 'Show all commands' },
      { cmd: 'dragon-ui-claude-cli custom-commands add --template git-branch', desc: 'Add git branch widget' }
    ]
  },

  providers: {
    name: 'providers',
    description: 'Manage AI model providers',
    usage: 'dragon-ui-claude-cli providers <action>',
    subcommands: [
      { name: 'list', description: 'List all providers' },
      { name: 'show', description: 'Show provider details' },
      { name: 'set', description: 'Set active provider' },
      { name: 'enable', description: 'Enable a provider' },
      { name: 'disable', description: 'Disable a provider' },
      { name: 'health', description: 'Check provider health' },
      { name: 'detect', description: 'Detect provider from model' },
      { name: 'stats', description: 'Show usage statistics' }
    ],
    options: [
      { flag: '-v, --verbose', description: 'Show detailed output' }
    ],
    examples: [
      { cmd: 'dragon-ui-claude-cli providers list', desc: 'List all providers' },
      { cmd: 'dragon-ui-claude-cli providers detect claude-sonnet-4', desc: 'Detect Anthropic' }
    ]
  },

  agents: {
    name: 'agents',
    description: 'Detect and analyze agent/tool usage',
    usage: 'dragon-ui-claude-cli agents <action>',
    subcommands: [
      { name: 'detect', description: 'Detect agent type from input' },
      { name: 'analyze', description: 'Analyze file for agent usage' },
      { name: 'stats', description: 'Show detection statistics' },
      { name: 'session', description: 'Show session agent stats' },
      { name: 'types', description: 'List agent types' },
      { name: 'categories', description: 'List tool categories' },
      { name: 'clear-cache', description: 'Clear detection cache' },
      { name: 'reset', description: 'Reset all statistics' }
    ],
    options: [
      { flag: '-v, --verbose', description: 'Show detailed output' }
    ],
    examples: [
      { cmd: 'dragon-ui-claude-cli agents types', desc: 'List all agent types' },
      { cmd: 'dragon-ui-claude-cli agents detect "Read file.txt"', desc: 'Detect file operation' }
    ]
  },

  migrate: {
    name: 'migrate',
    description: 'Manage settings migration, backup, and restore',
    usage: 'dragon-ui-claude-cli migrate <action>',
    subcommands: [
      { name: 'status', description: 'Check migration status' },
      { name: 'run', description: 'Run pending migrations' },
      { name: 'backups', description: 'List available backups' },
      { name: 'backup', description: 'Create a new backup' },
      { name: 'restore', description: 'Restore from backup' },
      { name: 'delete', description: 'Delete a backup' },
      { name: 'export', description: 'Export settings to file' },
      { name: 'import', description: 'Import settings from file' },
      { name: 'reset', description: 'Reset settings to defaults' },
      { name: 'files', description: 'Show settings files info' }
    ],
    options: [
      { flag: '--dry-run', description: 'Preview without applying' },
      { flag: '--force', description: 'Force operation' },
      { flag: '--no-backup', description: 'Skip backup creation' }
    ],
    examples: [
      { cmd: 'dragon-ui-claude-cli migrate status', desc: 'Check if migration needed' },
      { cmd: 'dragon-ui-claude-cli migrate backup "before-upgrade"', desc: 'Create labeled backup' }
    ]
  },

  tui: {
    name: 'tui',
    description: 'Start interactive TUI dashboard',
    usage: 'dragon-ui-claude-cli tui <action>',
    subcommands: [
      { name: 'start', description: 'Start the dashboard' },
      { name: 'themes', description: 'List available themes' },
      { name: 'preview', description: 'Preview a theme' }
    ],
    options: [
      { flag: '-t, --theme <name>', description: 'Set theme (dragon, ocean, forest, minimal)' },
      { flag: '-i, --interval <ms>', description: 'Refresh interval' },
      { flag: '--title <text>', description: 'Dashboard title' }
    ],
    examples: [
      { cmd: 'dragon-ui-claude-cli tui', desc: 'Start TUI dashboard' },
      { cmd: 'dragon-ui-claude-cli tui --theme ocean', desc: 'Use ocean theme' }
    ]
  }
};

/**
 * Configuration documentation
 */
const CONFIGURATION = {
  files: [
    { name: '.dragon-ui-settings.json', description: 'Main settings file' },
    { name: '.dragon-ui-statusline.json', description: 'Statusline configuration' },
    { name: '.dragon-ui-powerline.json', description: 'Powerline settings' },
    { name: '.dragon-ui-widgets.json', description: 'Widget configuration' },
    { name: '.dragon-ui-providers.json', description: 'Provider settings' },
    { name: '.dragon-ui-custom-commands.json', description: 'Custom command definitions' },
    { name: '.dragon-ui-model-prices.json', description: 'Model pricing cache' },
    { name: '.dragon-ui-agent-stats.json', description: 'Agent detection statistics' }
  ],
  environment: [
    { name: 'ANTHROPIC_API_KEY', description: 'Anthropic API key' },
    { name: 'OPENAI_API_KEY', description: 'OpenAI API key' },
    { name: 'GOOGLE_API_KEY', description: 'Google AI API key' },
    { name: 'AZURE_OPENAI_API_KEY', description: 'Azure OpenAI API key' },
    { name: 'DRAGON_UI_CONFIG', description: 'Custom config file path' },
    { name: 'DRAGON_UI_THEME', description: 'Default theme' },
    { name: 'DRAGON_UI_NO_COLOR', description: 'Disable colors' }
  ]
};

/**
 * API documentation
 */
const API = {
  services: [
    {
      name: 'CoreDataService',
      description: 'Main data aggregation service',
      methods: ['init()', 'getOverviewData()', 'getRecentSessions()', 'getHourlyData()', 'getModelStats()']
    },
    {
      name: 'ProviderManager',
      description: 'Multi-provider management',
      methods: ['getAllProviders()', 'detectProvider()', 'setActiveProvider()', 'checkHealth()']
    },
    {
      name: 'AgentDetector',
      description: 'Agent/tool detection service',
      methods: ['detect()', 'analyzeContent()', 'getSessionStats()', 'getGlobalStats()']
    },
    {
      name: 'SettingsMigrationManager',
      description: 'Settings migration and backup',
      methods: ['migrateAll()', 'createBackup()', 'restoreBackup()', 'exportSettings()']
    },
    {
      name: 'TUIDashboard',
      description: 'Interactive TUI dashboard',
      methods: ['start()', 'stop()', 'addComponent()', 'updateComponent()', 'setTheme()']
    },
    {
      name: 'AsyncDbWriter',
      description: 'Non-blocking database writes',
      methods: ['insert()', 'update()', 'delete()', 'batchInsert()', 'flush()']
    }
  ]
};

/**
 * Documentation Generator Class
 */
class DocsGenerator {
  constructor(options = {}) {
    this.options = {
      outputDir: options.outputDir || './docs',
      format: options.format || 'terminal',
      theme: options.theme || 'dragon',
      ...options
    };
  }

  /**
   * Generate documentation for a section
   */
  generateSection(section) {
    switch (section) {
      case SECTIONS.overview:
        return this.generateOverview();
      case SECTIONS.installation:
        return this.generateInstallation();
      case SECTIONS.commands:
        return this.generateCommands();
      case SECTIONS.configuration:
        return this.generateConfiguration();
      case SECTIONS.api:
        return this.generateAPI();
      case SECTIONS.examples:
        return this.generateExamples();
      default:
        return `Section not found: ${section}`;
    }
  }

  /**
   * Generate overview section
   */
  generateOverview() {
    return `
# Dragon UI - Claude Code Max Usage Dashboard

Dragon UI is a comprehensive CLI and GUI dashboard for tracking Claude Code Max usage,
including tokens, costs, sessions, and advanced analytics.

## Features

- **Real-time Monitoring**: Live dashboard with auto-refresh
- **Multi-Provider Support**: 11 AI providers (Anthropic, OpenAI, Google, etc.)
- **Agent Detection**: Automatic tool/agent usage detection
- **Powerline Mode**: Beautiful terminal statusline with themes
- **Settings Migration**: Version-aware settings with backup/restore
- **Interactive TUI**: Full-screen terminal dashboard
- **Comprehensive Analytics**: Hourly, daily, and model-based statistics

## Quick Start

\`\`\`bash
# Install globally
npm install -g dragon-ui-claude

# Run CLI dashboard
dragon-ui-claude-cli

# Show statusline
dragon-ui-claude-cli statusline

# Start live monitoring
dragon-ui-claude-cli live
\`\`\`

## Components

- **CLI**: Command-line interface with 10+ commands
- **TUI**: Interactive terminal dashboard
- **Electron**: Desktop application (optional)
- **MCP Server**: Claude Desktop integration
`;
  }

  /**
   * Generate installation section
   */
  generateInstallation() {
    return `
# Installation

## Requirements

- Node.js 18+
- npm 8+
- SQLite3 (for database operations)

## Global Installation

\`\`\`bash
npm install -g dragon-ui-claude
\`\`\`

## CLI-Only Installation

\`\`\`bash
npm install -g dragon-ui-claude --ignore-scripts
\`\`\`

## Local Installation

\`\`\`bash
git clone https://github.com/kingchenc/dragon-ui.git
cd dragon-ui
npm install
npm run cli
\`\`\`

## Verify Installation

\`\`\`bash
dragon-ui-claude-cli --version
dragon-ui-claude-cli --help
\`\`\`
`;
  }

  /**
   * Generate commands section
   */
  generateCommands() {
    let output = '# CLI Commands\n\n';

    for (const [key, cmd] of Object.entries(COMMANDS)) {
      output += `## ${cmd.name}\n\n`;
      output += `${cmd.description}\n\n`;
      output += `**Usage:** \`${cmd.usage}\`\n\n`;

      if (cmd.subcommands) {
        output += '### Subcommands\n\n';
        output += '| Command | Description |\n';
        output += '|---------|-------------|\n';
        for (const sub of cmd.subcommands) {
          output += `| ${sub.name} | ${sub.description} |\n`;
        }
        output += '\n';
      }

      if (cmd.options) {
        output += '### Options\n\n';
        output += '| Option | Description |\n';
        output += '|--------|-------------|\n';
        for (const opt of cmd.options) {
          output += `| \`${opt.flag}\` | ${opt.description} |\n`;
        }
        output += '\n';
      }

      if (cmd.examples) {
        output += '### Examples\n\n';
        for (const ex of cmd.examples) {
          output += `\`\`\`bash\n${ex.cmd}\n\`\`\`\n${ex.desc}\n\n`;
        }
      }

      output += '---\n\n';
    }

    return output;
  }

  /**
   * Generate configuration section
   */
  generateConfiguration() {
    let output = '# Configuration\n\n';

    output += '## Settings Files\n\n';
    output += 'Dragon UI stores settings in your home directory:\n\n';
    output += '| File | Description |\n';
    output += '|------|-------------|\n';
    for (const file of CONFIGURATION.files) {
      output += `| \`${file.name}\` | ${file.description} |\n`;
    }
    output += '\n';

    output += '## Environment Variables\n\n';
    output += '| Variable | Description |\n';
    output += '|----------|-------------|\n';
    for (const env of CONFIGURATION.environment) {
      output += `| \`${env.name}\` | ${env.description} |\n`;
    }
    output += '\n';

    output += '## Config File Format\n\n';
    output += `\`\`\`json
{
  "cli": {
    "useColors": true,
    "tableStyle": "default",
    "refreshInterval": 30000
  },
  "statusline": {
    "style": "dragon",
    "lines": 1,
    "useColors": true,
    "useEmojis": true
  },
  "powerline": {
    "enabled": false,
    "theme": "dragon",
    "separatorType": "arrows"
  }
}
\`\`\`
`;

    return output;
  }

  /**
   * Generate API section
   */
  generateAPI() {
    let output = '# API Reference\n\n';

    for (const service of API.services) {
      output += `## ${service.name}\n\n`;
      output += `${service.description}\n\n`;
      output += '### Methods\n\n';
      for (const method of service.methods) {
        output += `- \`${method}\`\n`;
      }
      output += '\n';
    }

    return output;
  }

  /**
   * Generate examples section
   */
  generateExamples() {
    return `
# Examples

## Basic Usage

### Check Usage Statistics

\`\`\`bash
# Start the CLI dashboard
dragon-ui-claude-cli

# Show statusline
dragon-ui-claude-cli statusline

# Start live monitoring
dragon-ui-claude-cli live
\`\`\`

### Configure Appearance

\`\`\`bash
# Set dragon theme
dragon-ui-claude-cli powerline enable dragon

# Use ocean theme
dragon-ui-claude-cli tui --theme ocean

# Create minimal statusline
dragon-ui-claude-cli statusline --preset minimal
\`\`\`

### Manage Settings

\`\`\`bash
# Check migration status
dragon-ui-claude-cli migrate status

# Create backup before changes
dragon-ui-claude-cli migrate backup "my-backup"

# Export all settings
dragon-ui-claude-cli migrate export settings.json

# Reset to defaults
dragon-ui-claude-cli migrate reset --force
\`\`\`

### Provider Management

\`\`\`bash
# List all providers
dragon-ui-claude-cli providers list

# Check provider health
dragon-ui-claude-cli providers health anthropic

# Detect provider from model name
dragon-ui-claude-cli providers detect gpt-4o
\`\`\`

### Agent Detection

\`\`\`bash
# List agent types
dragon-ui-claude-cli agents types

# Detect tool usage
dragon-ui-claude-cli agents detect "Read config.json"

# Show detection statistics
dragon-ui-claude-cli agents stats
\`\`\`

### Custom Commands

\`\`\`bash
# List available templates
dragon-ui-claude-cli custom-commands templates

# Add git branch widget
dragon-ui-claude-cli custom-commands add --template git-branch

# Test a command
dragon-ui-claude-cli custom-commands test --command "echo Hello"
\`\`\`
`;
  }

  /**
   * Generate all documentation
   */
  generateAll() {
    const sections = [
      { name: 'overview', title: 'Overview' },
      { name: 'installation', title: 'Installation' },
      { name: 'commands', title: 'Commands' },
      { name: 'configuration', title: 'Configuration' },
      { name: 'api', title: 'API Reference' },
      { name: 'examples', title: 'Examples' }
    ];

    const docs = {};
    for (const section of sections) {
      docs[section.name] = this.generateSection(section.name);
    }
    return docs;
  }

  /**
   * Write documentation to files
   */
  writeToFiles(outputDir = this.options.outputDir) {
    const docs = this.generateAll();

    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    for (const [name, content] of Object.entries(docs)) {
      const filePath = path.join(outputDir, `${name}.md`);
      fs.writeFileSync(filePath, content);
    }

    // Create index
    const indexContent = `# Dragon UI Documentation

${Object.keys(docs).map(name => `- [${name.charAt(0).toUpperCase() + name.slice(1)}](./${name}.md)`).join('\n')}
`;
    fs.writeFileSync(path.join(outputDir, 'README.md'), indexContent);

    return Object.keys(docs).length + 1;
  }

  /**
   * Get command documentation
   */
  getCommand(name) {
    return COMMANDS[name] || null;
  }

  /**
   * List all commands
   */
  listCommands() {
    return Object.keys(COMMANDS);
  }

  /**
   * Search documentation
   */
  search(query) {
    const results = [];
    const lowerQuery = query.toLowerCase();

    for (const [name, cmd] of Object.entries(COMMANDS)) {
      if (name.includes(lowerQuery) || cmd.description.toLowerCase().includes(lowerQuery)) {
        results.push({ type: 'command', name, description: cmd.description });
      }

      if (cmd.subcommands) {
        for (const sub of cmd.subcommands) {
          if (sub.name.includes(lowerQuery) || sub.description.toLowerCase().includes(lowerQuery)) {
            results.push({ type: 'subcommand', name: `${name} ${sub.name}`, description: sub.description });
          }
        }
      }
    }

    return results;
  }
}

// Export singleton instance
const docsGenerator = new DocsGenerator();

module.exports = {
  DocsGenerator,
  docsGenerator,
  SECTIONS,
  COMMANDS,
  CONFIGURATION,
  API
};
