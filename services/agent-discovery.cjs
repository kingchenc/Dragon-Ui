/**
 * Agent Discovery Service for Dragon-UI
 * Scan directories for agent definitions, load markdown files with frontmatter
 *
 * @module services/agent-discovery
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

/**
 * Default agent search paths
 */
const DEFAULT_SEARCH_PATHS = [
  '.claude/agents',
  '.agents',
  'agents',
  '.dragon-ui/agents'
];

/**
 * Agent file patterns
 */
const AGENT_FILE_PATTERNS = [
  '*.md',
  '*.yaml',
  '*.yml',
  '*.json'
];

/**
 * Cache TTL in milliseconds (5 minutes)
 */
const CACHE_TTL = 5 * 60 * 1000;

/**
 * Parse YAML frontmatter from markdown
 * @param {string} content
 * @returns {{frontmatter: Object, content: string}}
 */
function parseFrontmatter(content) {
  const frontmatterRegex = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/;
  const match = content.match(frontmatterRegex);

  if (!match) {
    return { frontmatter: {}, content };
  }

  const frontmatterStr = match[1];
  const bodyContent = match[2];

  // Simple YAML parser for common cases
  const frontmatter = {};
  const lines = frontmatterStr.split('\n');

  let currentKey = null;
  let currentArray = null;

  for (const line of lines) {
    // Skip empty lines and comments
    if (!line.trim() || line.trim().startsWith('#')) {
      continue;
    }

    // Check for array item
    const arrayMatch = line.match(/^\s+-\s+(.*)$/);
    if (arrayMatch && currentArray) {
      currentArray.push(arrayMatch[1].trim().replace(/^["']|["']$/g, ''));
      continue;
    }

    // Check for key-value pair
    const keyValueMatch = line.match(/^(\w+):\s*(.*)$/);
    if (keyValueMatch) {
      const key = keyValueMatch[1];
      const value = keyValueMatch[2].trim();

      if (value === '' || value === '|' || value === '>') {
        // Start of array or multiline
        currentKey = key;
        currentArray = [];
        frontmatter[key] = currentArray;
      } else if (value.startsWith('[') && value.endsWith(']')) {
        // Inline array
        const items = value.slice(1, -1).split(',').map(s => s.trim().replace(/^["']|["']$/g, ''));
        frontmatter[key] = items;
        currentArray = null;
        currentKey = null;
      } else {
        // Regular value
        let parsedValue = value.replace(/^["']|["']$/g, '');

        // Parse booleans
        if (parsedValue === 'true') parsedValue = true;
        else if (parsedValue === 'false') parsedValue = false;
        // Parse numbers
        else if (/^\d+$/.test(parsedValue)) parsedValue = parseInt(parsedValue, 10);
        else if (/^\d+\.\d+$/.test(parsedValue)) parsedValue = parseFloat(parsedValue);

        frontmatter[key] = parsedValue;
        currentArray = null;
        currentKey = null;
      }
    }
  }

  return { frontmatter, content: bodyContent };
}

/**
 * Parse JSON agent file
 * @param {string} content
 * @returns {Object}
 */
function parseJsonAgent(content) {
  try {
    return JSON.parse(content);
  } catch (error) {
    throw new Error(`Invalid JSON: ${error.message}`);
  }
}

/**
 * Parse YAML agent file
 * @param {string} content
 * @returns {Object}
 */
function parseYamlAgent(content) {
  const result = {};
  const lines = content.split('\n');

  let currentKey = null;
  let currentArray = null;
  let currentIndent = 0;

  for (const line of lines) {
    if (!line.trim() || line.trim().startsWith('#')) {
      continue;
    }

    const indent = line.search(/\S/);
    const trimmedLine = line.trim();

    // Array item
    if (trimmedLine.startsWith('- ')) {
      if (currentArray) {
        currentArray.push(trimmedLine.slice(2).replace(/^["']|["']$/g, ''));
      }
      continue;
    }

    // Key-value pair
    const kvMatch = trimmedLine.match(/^(\w+):\s*(.*)$/);
    if (kvMatch) {
      const key = kvMatch[1];
      const value = kvMatch[2].trim();

      if (!value) {
        currentKey = key;
        currentArray = [];
        result[key] = currentArray;
        currentIndent = indent;
      } else {
        let parsedValue = value.replace(/^["']|["']$/g, '');
        if (parsedValue === 'true') parsedValue = true;
        else if (parsedValue === 'false') parsedValue = false;
        else if (/^\d+$/.test(parsedValue)) parsedValue = parseInt(parsedValue, 10);

        result[key] = parsedValue;
        currentArray = null;
      }
    }
  }

  return result;
}

/**
 * Agent definition structure
 */
class AgentDefinition {
  constructor(data = {}) {
    this.name = data.name || 'Unknown Agent';
    this.id = data.id || this.generateId(this.name);
    this.description = data.description || '';
    this.model = data.model || data.preferredModel || 'claude-3-5-sonnet-20241022';
    this.color = data.color || '#6366f1';
    this.icon = data.icon || data.emoji || '';
    this.systemPrompt = data.systemPrompt || data.system_prompt || '';
    this.workspace = data.workspace || null;
    this.filePath = data.filePath || null;
    this.tags = data.tags || [];
    this.capabilities = data.capabilities || [];
    this.version = data.version || '1.0.0';
    this.author = data.author || '';
    this.enabled = data.enabled !== false;
    this.priority = data.priority || 50;
    this.loadedAt = Date.now();
  }

  /**
   * Generate ID from name
   * @param {string} name
   * @returns {string}
   */
  generateId(name) {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }

  /**
   * Check if agent matches a system prompt
   * @param {string} systemPrompt
   * @returns {boolean}
   */
  matchesSystemPrompt(systemPrompt) {
    if (!this.systemPrompt || !systemPrompt) {
      return false;
    }

    // Exact match
    if (systemPrompt.includes(this.systemPrompt)) {
      return true;
    }

    // Check for key phrases
    const keyPhrases = this.extractKeyPhrases(this.systemPrompt);
    const matchCount = keyPhrases.filter(phrase =>
      systemPrompt.toLowerCase().includes(phrase.toLowerCase())
    ).length;

    return matchCount >= Math.min(3, keyPhrases.length);
  }

  /**
   * Extract key phrases from system prompt
   * @param {string} prompt
   * @returns {string[]}
   */
  extractKeyPhrases(prompt) {
    // Split into sentences and get unique phrases
    const sentences = prompt.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 10);
    return sentences.slice(0, 5);
  }

  /**
   * Convert to plain object
   * @returns {Object}
   */
  toJSON() {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      model: this.model,
      color: this.color,
      icon: this.icon,
      systemPrompt: this.systemPrompt,
      workspace: this.workspace,
      filePath: this.filePath,
      tags: this.tags,
      capabilities: this.capabilities,
      version: this.version,
      author: this.author,
      enabled: this.enabled,
      priority: this.priority,
      loadedAt: this.loadedAt
    };
  }
}

/**
 * Agent Discovery Service
 */
class AgentDiscoveryService {
  constructor(options = {}) {
    this.searchPaths = options.searchPaths || DEFAULT_SEARCH_PATHS;
    this.workspacePath = options.workspacePath || process.cwd();
    this.cacheTTL = options.cacheTTL || CACHE_TTL;
    this.agents = new Map();
    this.cacheExpiry = 0;
    this.watchers = new Map();
    this.onAgentDiscovered = options.onAgentDiscovered || null;
    this.onAgentRemoved = options.onAgentRemoved || null;
  }

  /**
   * Get all search directories
   * @returns {string[]}
   */
  getSearchDirectories() {
    const dirs = [];

    // Workspace-relative paths
    for (const searchPath of this.searchPaths) {
      const fullPath = path.join(this.workspacePath, searchPath);
      if (fs.existsSync(fullPath) && fs.statSync(fullPath).isDirectory()) {
        dirs.push(fullPath);
      }
    }

    // Home directory paths
    const homeDir = os.homedir();
    const homePaths = [
      path.join(homeDir, '.claude', 'agents'),
      path.join(homeDir, '.dragon-ui', 'agents'),
      path.join(homeDir, '.config', 'dragon-ui', 'agents')
    ];

    for (const homePath of homePaths) {
      if (fs.existsSync(homePath) && fs.statSync(homePath).isDirectory()) {
        dirs.push(homePath);
      }
    }

    return [...new Set(dirs)];
  }

  /**
   * Scan directory for agent files
   * @param {string} dir
   * @returns {string[]}
   */
  scanDirectory(dir) {
    const files = [];

    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase();
          if (['.md', '.yaml', '.yml', '.json'].includes(ext)) {
            files.push(fullPath);
          }
        } else if (entry.isDirectory() && !entry.name.startsWith('.')) {
          // Recursively scan subdirectories (1 level deep)
          try {
            const subEntries = fs.readdirSync(fullPath, { withFileTypes: true });
            for (const subEntry of subEntries) {
              if (subEntry.isFile()) {
                const ext = path.extname(subEntry.name).toLowerCase();
                if (['.md', '.yaml', '.yml', '.json'].includes(ext)) {
                  files.push(path.join(fullPath, subEntry.name));
                }
              }
            }
          } catch (error) {
            // Ignore permission errors
          }
        }
      }
    } catch (error) {
      // Ignore read errors
    }

    return files;
  }

  /**
   * Load agent from file
   * @param {string} filePath
   * @returns {AgentDefinition|null}
   */
  loadAgentFromFile(filePath) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const ext = path.extname(filePath).toLowerCase();

      let agentData;

      switch (ext) {
        case '.md':
          const { frontmatter, content: bodyContent } = parseFrontmatter(content);
          agentData = {
            ...frontmatter,
            systemPrompt: frontmatter.systemPrompt || bodyContent.trim()
          };
          break;

        case '.yaml':
        case '.yml':
          agentData = parseYamlAgent(content);
          break;

        case '.json':
          agentData = parseJsonAgent(content);
          break;

        default:
          return null;
      }

      // Add file metadata
      agentData.filePath = filePath;
      agentData.workspace = this.detectWorkspace(filePath);

      // Create agent definition
      const agent = new AgentDefinition(agentData);

      return agent;
    } catch (error) {
      console.error(`[AgentDiscovery] Error loading agent from ${filePath}:`, error.message);
      return null;
    }
  }

  /**
   * Detect workspace from file path
   * @param {string} filePath
   * @returns {string|null}
   */
  detectWorkspace(filePath) {
    const dir = path.dirname(filePath);

    // Walk up to find workspace markers
    let current = dir;
    const maxDepth = 5;

    for (let i = 0; i < maxDepth; i++) {
      // Check for workspace markers
      const markers = [
        'CLAUDE.md',
        '.claude',
        'package.json',
        '.git',
        'Cargo.toml',
        'go.mod',
        'pom.xml'
      ];

      for (const marker of markers) {
        if (fs.existsSync(path.join(current, marker))) {
          return current;
        }
      }

      const parent = path.dirname(current);
      if (parent === current) break;
      current = parent;
    }

    return null;
  }

  /**
   * Discover all agents
   * @param {boolean} force
   * @returns {AgentDefinition[]}
   */
  discover(force = false) {
    // Check cache
    if (!force && Date.now() < this.cacheExpiry && this.agents.size > 0) {
      return Array.from(this.agents.values());
    }

    // Clear existing agents
    this.agents.clear();

    // Scan all directories
    const searchDirs = this.getSearchDirectories();

    for (const dir of searchDirs) {
      const files = this.scanDirectory(dir);

      for (const file of files) {
        const agent = this.loadAgentFromFile(file);

        if (agent) {
          this.agents.set(agent.id, agent);

          if (this.onAgentDiscovered) {
            this.onAgentDiscovered(agent);
          }
        }
      }
    }

    // Update cache expiry
    this.cacheExpiry = Date.now() + this.cacheTTL;

    return Array.from(this.agents.values());
  }

  /**
   * Get agent by ID
   * @param {string} id
   * @returns {AgentDefinition|null}
   */
  getAgent(id) {
    if (Date.now() >= this.cacheExpiry) {
      this.discover();
    }

    return this.agents.get(id) || null;
  }

  /**
   * Get agent by name
   * @param {string} name
   * @returns {AgentDefinition|null}
   */
  getAgentByName(name) {
    if (Date.now() >= this.cacheExpiry) {
      this.discover();
    }

    for (const agent of this.agents.values()) {
      if (agent.name.toLowerCase() === name.toLowerCase()) {
        return agent;
      }
    }

    return null;
  }

  /**
   * Find agents by workspace
   * @param {string} workspace
   * @returns {AgentDefinition[]}
   */
  findByWorkspace(workspace) {
    if (Date.now() >= this.cacheExpiry) {
      this.discover();
    }

    return Array.from(this.agents.values()).filter(agent =>
      agent.workspace === workspace
    );
  }

  /**
   * Find agents by tag
   * @param {string} tag
   * @returns {AgentDefinition[]}
   */
  findByTag(tag) {
    if (Date.now() >= this.cacheExpiry) {
      this.discover();
    }

    return Array.from(this.agents.values()).filter(agent =>
      agent.tags.includes(tag)
    );
  }

  /**
   * Find agent matching system prompt
   * @param {string} systemPrompt
   * @returns {AgentDefinition|null}
   */
  findBySystemPrompt(systemPrompt) {
    if (Date.now() >= this.cacheExpiry) {
      this.discover();
    }

    for (const agent of this.agents.values()) {
      if (agent.matchesSystemPrompt(systemPrompt)) {
        return agent;
      }
    }

    return null;
  }

  /**
   * Get all agents
   * @returns {AgentDefinition[]}
   */
  getAll() {
    if (Date.now() >= this.cacheExpiry) {
      this.discover();
    }

    return Array.from(this.agents.values());
  }

  /**
   * Get enabled agents
   * @returns {AgentDefinition[]}
   */
  getEnabled() {
    return this.getAll().filter(agent => agent.enabled);
  }

  /**
   * Start watching for changes
   */
  startWatching() {
    const searchDirs = this.getSearchDirectories();

    for (const dir of searchDirs) {
      if (this.watchers.has(dir)) {
        continue;
      }

      try {
        const watcher = fs.watch(dir, { recursive: true }, (eventType, filename) => {
          if (!filename) return;

          const ext = path.extname(filename).toLowerCase();
          if (!['.md', '.yaml', '.yml', '.json'].includes(ext)) {
            return;
          }

          // Invalidate cache and rediscover
          this.cacheExpiry = 0;

          // Debounce rediscovery
          if (this._rediscoverTimeout) {
            clearTimeout(this._rediscoverTimeout);
          }

          this._rediscoverTimeout = setTimeout(() => {
            this.discover(true);
          }, 500);
        });

        this.watchers.set(dir, watcher);
      } catch (error) {
        // Ignore watch errors
      }
    }
  }

  /**
   * Stop watching for changes
   */
  stopWatching() {
    for (const [dir, watcher] of this.watchers) {
      watcher.close();
    }
    this.watchers.clear();
  }

  /**
   * Invalidate cache
   */
  invalidateCache() {
    this.cacheExpiry = 0;
  }

  /**
   * Get discovery statistics
   * @returns {Object}
   */
  getStats() {
    return {
      agentCount: this.agents.size,
      enabledCount: this.getEnabled().length,
      searchPaths: this.getSearchDirectories(),
      cacheValid: Date.now() < this.cacheExpiry,
      cacheExpiry: this.cacheExpiry,
      watchersActive: this.watchers.size
    };
  }

  /**
   * Create sample agent file
   * @param {string} name
   * @param {string} dir
   * @returns {string}
   */
  createSampleAgent(name, dir = null) {
    const targetDir = dir || path.join(this.workspacePath, '.claude', 'agents');

    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    const fileName = `${name.toLowerCase().replace(/\s+/g, '-')}.md`;
    const filePath = path.join(targetDir, fileName);

    const content = `---
name: ${name}
description: A custom agent for Dragon-UI
model: claude-3-5-sonnet-20241022
color: "#6366f1"
icon: ""
tags:
  - custom
  - assistant
capabilities:
  - code-review
  - documentation
version: "1.0.0"
enabled: true
priority: 50
---

You are a helpful assistant named ${name}.

Your role is to help users with their tasks efficiently and professionally.

## Guidelines

1. Be concise and helpful
2. Ask clarifying questions when needed
3. Provide examples when appropriate

## Capabilities

- Answer questions
- Help with code
- Provide documentation assistance
`;

    fs.writeFileSync(filePath, content);

    // Invalidate cache
    this.invalidateCache();

    return filePath;
  }
}

// Singleton instance
let instance = null;

/**
 * Get AgentDiscoveryService instance
 * @param {Object} options
 * @returns {AgentDiscoveryService}
 */
function getAgentDiscovery(options) {
  if (!instance) {
    instance = new AgentDiscoveryService(options);
  }
  return instance;
}

/**
 * Reset singleton instance
 */
function resetAgentDiscovery() {
  if (instance) {
    instance.stopWatching();
    instance = null;
  }
}

module.exports = {
  AgentDefinition,
  AgentDiscoveryService,
  getAgentDiscovery,
  resetAgentDiscovery,
  parseFrontmatter,
  DEFAULT_SEARCH_PATHS,
  AGENT_FILE_PATTERNS,
  CACHE_TTL
};
