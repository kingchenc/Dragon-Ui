/**
 * Widget System Index
 * Exports all widgets and provides a pre-configured registry
 */

const { Widget } = require('./widget-base.cjs');
const { WidgetRegistry } = require('./widget-registry.cjs');
const ModelWidget = require('./model-widget.cjs');
const {
  GitBranchWidget,
  GitChangesWidget,
  GitWorktreeWidget,
  GitStatusWidget,
  GitCommitWidget,
  GitAheadBehindWidget,
  GitStashWidget
} = require('./git-branch-widget.cjs');
const { TokensInputWidget, TokensOutputWidget, TokensTotalWidget, TokensCachedWidget } = require('./tokens-widget.cjs');
const { CostWidget, DailyCostWidget, MonthlyCostWidget } = require('./cost-widget.cjs');
const { ContextLengthWidget, ContextPercentWidget, ContextUsableWidget, ContextRemainingWidget } = require('./context-widget.cjs');
const { SessionClockWidget, SessionIdWidget, SessionStatusWidget, BlockTimerWidget } = require('./session-widget.cjs');
const { CustomCommandWidget, CustomCommandWidgetFactory } = require('./custom-command-widget.cjs');
const {
  OutputStyleWidget,
  CurrentWorkingDirWidget,
  TerminalWidthWidget,
  VersionWidget,
  CustomTextWidget,
  HostnameWidget,
  UsernameWidget,
  PlatformWidget,
  NodeVersionWidget,
  MemoryUsageWidget,
  UptimeWidget
} = require('./system-widget.cjs');

// Create default registry with all widgets registered
function createDefaultRegistry() {
  const registry = new WidgetRegistry();

  // Register all widgets
  registry.register(ModelWidget);

  // Git widgets
  registry.register(GitBranchWidget);
  registry.register(GitChangesWidget);
  registry.register(GitWorktreeWidget);
  registry.register(GitStatusWidget);
  registry.register(GitCommitWidget);
  registry.register(GitAheadBehindWidget);
  registry.register(GitStashWidget);

  // Token widgets
  registry.register(TokensInputWidget);
  registry.register(TokensOutputWidget);
  registry.register(TokensTotalWidget);
  registry.register(TokensCachedWidget);

  // Cost widgets
  registry.register(CostWidget);
  registry.register(DailyCostWidget);
  registry.register(MonthlyCostWidget);

  // Context widgets
  registry.register(ContextLengthWidget);
  registry.register(ContextPercentWidget);
  registry.register(ContextUsableWidget);
  registry.register(ContextRemainingWidget);

  // Session widgets
  registry.register(SessionClockWidget);
  registry.register(SessionIdWidget);
  registry.register(SessionStatusWidget);
  registry.register(BlockTimerWidget);

  // System widgets
  registry.register(OutputStyleWidget);
  registry.register(CurrentWorkingDirWidget);
  registry.register(TerminalWidthWidget);
  registry.register(VersionWidget);
  registry.register(CustomTextWidget);
  registry.register(HostnameWidget);
  registry.register(UsernameWidget);
  registry.register(PlatformWidget);
  registry.register(NodeVersionWidget);
  registry.register(MemoryUsageWidget);
  registry.register(UptimeWidget);

  // Custom command widget (factory creates instances)
  registry.register(CustomCommandWidget);

  return registry;
}

// Pre-configured default registry instance
const defaultRegistry = createDefaultRegistry();

// Get list of all available widget IDs
function getAvailableWidgets() {
  return [
    // Core widgets
    { id: 'model', name: 'Model', description: 'Displays the current Claude model', category: 'core' },
    { id: 'output-style', name: 'Output Style', description: 'Displays output format (MD/TXT/JSON)', category: 'core' },

    // Git widgets
    { id: 'git-branch', name: 'Git Branch', description: 'Displays the current git branch name', category: 'git' },
    { id: 'git-changes', name: 'Git Changes', description: 'Displays git changes (+X, -Y)', category: 'git' },
    { id: 'git-worktree', name: 'Git Worktree', description: 'Displays current git worktree', category: 'git' },
    { id: 'git-status', name: 'Git Status', description: 'Displays git status indicators', category: 'git' },
    { id: 'git-commit', name: 'Git Commit', description: 'Displays current commit hash', category: 'git' },
    { id: 'git-ahead-behind', name: 'Git Ahead/Behind', description: 'Displays commits ahead/behind remote', category: 'git' },
    { id: 'git-stash', name: 'Git Stash', description: 'Displays stash count', category: 'git' },

    // Token widgets
    { id: 'tokens-input', name: 'Input Tokens', description: 'Displays input token count', category: 'tokens' },
    { id: 'tokens-output', name: 'Output Tokens', description: 'Displays output token count', category: 'tokens' },
    { id: 'tokens-total', name: 'Total Tokens', description: 'Displays total token count', category: 'tokens' },
    { id: 'tokens-cached', name: 'Cached Tokens', description: 'Displays cached token count', category: 'tokens' },

    // Cost widgets
    { id: 'cost', name: 'Cost', description: 'Displays session or total cost', category: 'cost' },
    { id: 'daily-cost', name: 'Daily Cost', description: 'Displays today\'s total cost', category: 'cost' },
    { id: 'monthly-cost', name: 'Monthly Cost', description: 'Displays current month\'s total cost', category: 'cost' },

    // Context widgets
    { id: 'context-length', name: 'Context Length', description: 'Displays context window usage (e.g., 45k / 200k)', category: 'context' },
    { id: 'context-percent', name: 'Context Percentage', description: 'Displays context usage as percentage', category: 'context' },
    { id: 'context-usable', name: 'Context Usable', description: 'Displays usage as percentage of usable context', category: 'context' },
    { id: 'context-remaining', name: 'Context Remaining', description: 'Displays remaining context tokens', category: 'context' },

    // Session widgets
    { id: 'session-clock', name: 'Session Clock', description: 'Displays session duration', category: 'session' },
    { id: 'session-id', name: 'Session ID', description: 'Displays the current session ID', category: 'session' },
    { id: 'session-status', name: 'Session Status', description: 'Displays session active/inactive status', category: 'session' },
    { id: 'block-timer', name: 'Block Timer', description: 'Displays time remaining in current 5-hour block', category: 'session' },

    // System widgets
    { id: 'current-working-dir', name: 'Current Directory', description: 'Displays current working directory', category: 'system' },
    { id: 'terminal-width', name: 'Terminal Width', description: 'Displays terminal width in columns', category: 'system' },
    { id: 'version', name: 'Version', description: 'Displays Claude Code or Dragon-UI version', category: 'system' },
    { id: 'hostname', name: 'Hostname', description: 'Displays system hostname', category: 'system' },
    { id: 'username', name: 'Username', description: 'Displays current username', category: 'system' },
    { id: 'platform', name: 'Platform', description: 'Displays operating system', category: 'system' },
    { id: 'node-version', name: 'Node Version', description: 'Displays Node.js version', category: 'system' },
    { id: 'memory-usage', name: 'Memory Usage', description: 'Displays system memory usage', category: 'system' },
    { id: 'uptime', name: 'Uptime', description: 'Displays system uptime', category: 'system' },

    // Custom widgets
    { id: 'custom-text', name: 'Custom Text', description: 'Displays user-defined static text', category: 'custom' },
    { id: 'custom-command', name: 'Custom Command', description: 'Executes shell command and displays output', category: 'custom' }
  ];
}

// Create a statusline from config
function createStatuslineFromConfig(config) {
  const registry = createDefaultRegistry();

  if (!config || !config.statusline) {
    return registry;
  }

  const statuslineConfig = config.statusline;

  // Apply global settings
  if (statuslineConfig.separator) {
    registry.separator = statuslineConfig.separator;
  }

  // Configure lines
  if (statuslineConfig.lines && Array.isArray(statuslineConfig.lines)) {
    statuslineConfig.lines.forEach((lineConfig, lineIndex) => {
      if (lineConfig.widgets && Array.isArray(lineConfig.widgets)) {
        lineConfig.widgets.forEach((widgetConfig, position) => {
          const widgetId = typeof widgetConfig === 'string' ? widgetConfig : widgetConfig.id;
          const widgetOptions = typeof widgetConfig === 'object' ? widgetConfig : {};

          // Create widget with options
          const widget = registry.create(widgetId, widgetOptions);
          if (widget) {
            registry.addToLine(widgetId, lineIndex, position);
          }
        });
      }
    });
  }

  return registry;
}

// Render a simple statusline with common widgets
async function renderSimpleStatusline(data, options = {}) {
  const registry = createDefaultRegistry();

  // Default layout: model | branch | context | cost
  const widgets = options.widgets || ['model', 'git-branch', 'context-length', 'cost'];

  widgets.forEach((widgetId, position) => {
    registry.addToLine(widgetId, 0, position);
  });

  return registry.renderStatusline(data, 0);
}

module.exports = {
  // Base classes
  Widget,
  WidgetRegistry,

  // Core widgets
  ModelWidget,

  // Git widgets
  GitBranchWidget,
  GitChangesWidget,
  GitWorktreeWidget,
  GitStatusWidget,
  GitCommitWidget,
  GitAheadBehindWidget,
  GitStashWidget,

  // Token widgets
  TokensInputWidget,
  TokensOutputWidget,
  TokensTotalWidget,
  TokensCachedWidget,

  // Cost widgets
  CostWidget,
  DailyCostWidget,
  MonthlyCostWidget,

  // Context widgets
  ContextLengthWidget,
  ContextPercentWidget,
  ContextUsableWidget,
  ContextRemainingWidget,

  // Session widgets
  SessionClockWidget,
  SessionIdWidget,
  SessionStatusWidget,
  BlockTimerWidget,

  // System widgets
  OutputStyleWidget,
  CurrentWorkingDirWidget,
  TerminalWidthWidget,
  VersionWidget,
  CustomTextWidget,
  HostnameWidget,
  UsernameWidget,
  PlatformWidget,
  NodeVersionWidget,
  MemoryUsageWidget,
  UptimeWidget,

  // Custom widgets
  CustomCommandWidget,
  CustomCommandWidgetFactory,

  // Registry utilities
  createDefaultRegistry,
  defaultRegistry,
  getAvailableWidgets,
  createStatuslineFromConfig,
  renderSimpleStatusline
};
