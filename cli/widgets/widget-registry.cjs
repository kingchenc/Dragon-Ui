/**
 * Widget Registry
 * Manages registration, creation, and configuration of statusline widgets
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

class WidgetRegistry {
  constructor() {
    this.widgets = new Map(); // WidgetClass by id
    this.instances = new Map(); // Widget instances by id
    this.configFile = path.join(os.homedir(), '.dragon-ui-widgets.json');
    this.config = this.loadConfig();
  }

  /**
   * Register a widget class
   * @param {Class} WidgetClass - Widget class extending Widget
   */
  register(WidgetClass) {
    const instance = new WidgetClass();
    this.widgets.set(instance.id, WidgetClass);
    console.log(`[Widget] Registered: ${instance.id} - ${instance.name}`);
  }

  /**
   * Create a widget instance with optional configuration
   * @param {string} id - Widget ID
   * @param {Object} config - Optional configuration overrides
   * @returns {Widget|null}
   */
  create(id, config = {}) {
    const WidgetClass = this.widgets.get(id);
    if (!WidgetClass) {
      console.warn(`[Widget] Not found: ${id}`);
      return null;
    }

    // Merge saved config with provided config
    const savedConfig = this.config.widgets?.[id] || {};
    const mergedConfig = { ...savedConfig, ...config };

    const instance = new WidgetClass(mergedConfig);
    this.instances.set(id, instance);
    return instance;
  }

  /**
   * Get an existing widget instance
   * @param {string} id - Widget ID
   * @returns {Widget|null}
   */
  get(id) {
    return this.instances.get(id) || this.create(id);
  }

  /**
   * Get all registered widget IDs
   * @returns {string[]}
   */
  list() {
    return Array.from(this.widgets.keys());
  }

  /**
   * Get all registered widget info
   * @returns {Object[]}
   */
  listAll() {
    const result = [];
    for (const [id, WidgetClass] of this.widgets) {
      const instance = new WidgetClass();
      result.push(instance.getInfo());
    }
    return result;
  }

  /**
   * Check if a widget is registered
   * @param {string} id - Widget ID
   * @returns {boolean}
   */
  has(id) {
    return this.widgets.has(id);
  }

  /**
   * Remove a widget from the registry
   * @param {string} id - Widget ID
   * @returns {boolean}
   */
  unregister(id) {
    this.instances.delete(id);
    return this.widgets.delete(id);
  }

  /**
   * Load widget configuration from file
   * @returns {Object}
   */
  loadConfig() {
    try {
      if (fs.existsSync(this.configFile)) {
        return JSON.parse(fs.readFileSync(this.configFile, 'utf8'));
      }
    } catch (error) {
      console.warn(`[Widget] Error loading config: ${error.message}`);
    }
    return { widgets: {}, lines: [[]], enabled: true };
  }

  /**
   * Save widget configuration to file
   * @returns {boolean}
   */
  saveConfig() {
    try {
      fs.writeFileSync(this.configFile, JSON.stringify(this.config, null, 2));
      return true;
    } catch (error) {
      console.error(`[Widget] Error saving config: ${error.message}`);
      return false;
    }
  }

  /**
   * Update widget configuration
   * @param {string} id - Widget ID
   * @param {Object} config - New configuration
   * @returns {boolean}
   */
  updateWidgetConfig(id, config) {
    if (!this.config.widgets) this.config.widgets = {};
    this.config.widgets[id] = { ...this.config.widgets[id], ...config };

    // Update instance if it exists
    const instance = this.instances.get(id);
    if (instance) {
      instance.updateConfig(config);
    }

    return this.saveConfig();
  }

  /**
   * Get statusline configuration
   * @returns {Object}
   */
  getStatuslineConfig() {
    return {
      lines: this.config.lines || [[]],
      enabled: this.config.enabled !== false,
      separator: this.config.separator || ' │ ',
      style: this.config.style || 'dragon'
    };
  }

  /**
   * Set statusline configuration
   * @param {Object} config - Statusline config
   */
  setStatuslineConfig(config) {
    if (config.lines) this.config.lines = config.lines;
    if (config.enabled !== undefined) this.config.enabled = config.enabled;
    if (config.separator) this.config.separator = config.separator;
    if (config.style) this.config.style = config.style;
    this.saveConfig();
  }

  /**
   * Add a widget to a statusline line
   * @param {string} widgetId - Widget ID
   * @param {number} lineIndex - Line index (0-based)
   * @param {number} position - Position in line (-1 for end)
   * @returns {boolean}
   */
  addToLine(widgetId, lineIndex = 0, position = -1) {
    if (!this.has(widgetId)) {
      console.warn(`[Widget] Cannot add unknown widget: ${widgetId}`);
      return false;
    }

    // Ensure line array exists
    while (this.config.lines.length <= lineIndex) {
      this.config.lines.push([]);
    }

    const line = this.config.lines[lineIndex];

    // Check if already in line
    if (line.includes(widgetId)) {
      console.warn(`[Widget] Widget ${widgetId} already in line ${lineIndex}`);
      return false;
    }

    if (position < 0 || position >= line.length) {
      line.push(widgetId);
    } else {
      line.splice(position, 0, widgetId);
    }

    return this.saveConfig();
  }

  /**
   * Remove a widget from a statusline line
   * @param {string} widgetId - Widget ID
   * @param {number} lineIndex - Line index (-1 for all lines)
   * @returns {boolean}
   */
  removeFromLine(widgetId, lineIndex = -1) {
    if (lineIndex < 0) {
      // Remove from all lines
      for (const line of this.config.lines) {
        const idx = line.indexOf(widgetId);
        if (idx !== -1) {
          line.splice(idx, 1);
        }
      }
    } else if (this.config.lines[lineIndex]) {
      const idx = this.config.lines[lineIndex].indexOf(widgetId);
      if (idx !== -1) {
        this.config.lines[lineIndex].splice(idx, 1);
      }
    }

    return this.saveConfig();
  }

  /**
   * Reorder a widget within a line
   * @param {string} widgetId - Widget ID
   * @param {number} lineIndex - Line index
   * @param {number} newPosition - New position
   * @returns {boolean}
   */
  reorderInLine(widgetId, lineIndex, newPosition) {
    if (!this.config.lines[lineIndex]) return false;

    const line = this.config.lines[lineIndex];
    const currentIdx = line.indexOf(widgetId);
    if (currentIdx === -1) return false;

    line.splice(currentIdx, 1);
    line.splice(Math.min(newPosition, line.length), 0, widgetId);

    return this.saveConfig();
  }

  /**
   * Render a statusline
   * @param {Object} data - Data context for widgets
   * @param {number} lineIndex - Which line to render (-1 for all)
   * @returns {Promise<string[]>} - Rendered lines
   */
  async renderStatusline(data, lineIndex = -1) {
    const config = this.getStatuslineConfig();
    if (!config.enabled) return [];

    const linesToRender = lineIndex < 0
      ? config.lines
      : [config.lines[lineIndex]].filter(Boolean);

    const renderedLines = [];

    for (const line of linesToRender) {
      const parts = [];

      for (const widgetId of line) {
        const widget = this.get(widgetId);
        if (!widget || !widget.enabled) continue;

        try {
          const value = await widget.getCachedValue(data);
          if (value) {
            const formatted = widget.format(value);
            parts.push({
              value: formatted,
              merge: widget.merge,
              character: widget.character
            });
          }
        } catch (error) {
          console.error(`[Widget] Error rendering ${widgetId}: ${error.message}`);
        }
      }

      // Join parts with separators, respecting merge settings
      let rendered = '';
      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        const nextPart = parts[i + 1];

        rendered += part.value;

        // Add separator unless merged
        if (nextPart) {
          const shouldMerge = part.merge === 'right' || part.merge === 'both' ||
                             nextPart.merge === 'left' || nextPart.merge === 'both';
          if (!shouldMerge) {
            rendered += part.character || config.separator;
          }
        }
      }

      renderedLines.push(rendered);
    }

    return renderedLines;
  }

  /**
   * Clear all widget caches
   */
  clearAllCaches() {
    for (const instance of this.instances.values()) {
      instance.clearCache();
    }
  }

  /**
   * Get widget count
   * @returns {number}
   */
  get size() {
    return this.widgets.size;
  }
}

// Export singleton instance
const widgetRegistry = new WidgetRegistry();

module.exports = {
  WidgetRegistry,
  widgetRegistry
};
