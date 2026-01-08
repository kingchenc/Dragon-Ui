/**
 * Workspace Detection Service for Dragon-UI
 * Automatic workspace registration, CLAUDE.md reference extraction, multi-workspace support
 *
 * @module services/workspace-detection
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

/**
 * Workspace markers to search for
 */
const WORKSPACE_MARKERS = [
  'CLAUDE.md',
  '.claude',
  'package.json',
  '.git',
  'Cargo.toml',
  'go.mod',
  'pom.xml',
  'pyproject.toml',
  'requirements.txt',
  'setup.py',
  'Makefile',
  'CMakeLists.txt',
  '.vscode',
  '.idea'
];

/**
 * Project type detection patterns
 */
const PROJECT_TYPES = {
  node: ['package.json'],
  rust: ['Cargo.toml'],
  go: ['go.mod'],
  java: ['pom.xml', 'build.gradle'],
  python: ['pyproject.toml', 'setup.py', 'requirements.txt'],
  cpp: ['CMakeLists.txt'],
  dotnet: ['*.csproj', '*.sln'],
  claude: ['CLAUDE.md', '.claude']
};

/**
 * Workspace metadata
 */
class WorkspaceMetadata {
  constructor(data = {}) {
    this.id = data.id || this.generateId(data.path);
    this.path = data.path;
    this.name = data.name || path.basename(data.path);
    this.type = data.type || 'unknown';
    this.claudeConfig = data.claudeConfig || null;
    this.references = data.references || [];
    this.agents = data.agents || [];
    this.createdAt = data.createdAt || Date.now();
    this.lastAccessed = data.lastAccessed || Date.now();
    this.accessCount = data.accessCount || 0;
    this.settings = data.settings || {};
  }

  /**
   * Generate workspace ID from path
   * @param {string} workspacePath
   * @returns {string}
   */
  generateId(workspacePath) {
    const normalized = path.normalize(workspacePath).toLowerCase();
    return crypto.createHash('md5').update(normalized).digest('hex').slice(0, 12);
  }

  /**
   * Update last accessed timestamp
   */
  touch() {
    this.lastAccessed = Date.now();
    this.accessCount++;
  }

  /**
   * Convert to JSON
   * @returns {Object}
   */
  toJSON() {
    return {
      id: this.id,
      path: this.path,
      name: this.name,
      type: this.type,
      claudeConfig: this.claudeConfig,
      references: this.references,
      agents: this.agents,
      createdAt: this.createdAt,
      lastAccessed: this.lastAccessed,
      accessCount: this.accessCount,
      settings: this.settings
    };
  }

  /**
   * Create from JSON
   * @param {Object} json
   * @returns {WorkspaceMetadata}
   */
  static fromJSON(json) {
    return new WorkspaceMetadata(json);
  }
}

/**
 * CLAUDE.md parser
 */
class ClaudeConfigParser {
  /**
   * Parse CLAUDE.md content
   * @param {string} content
   * @returns {Object}
   */
  static parse(content) {
    const result = {
      title: null,
      description: null,
      references: [],
      rules: [],
      context: [],
      metadata: {}
    };

    // Extract title (first H1)
    const titleMatch = content.match(/^#\s+(.+)$/m);
    if (titleMatch) {
      result.title = titleMatch[1].trim();
    }

    // Extract description (first paragraph after title)
    const descMatch = content.match(/^#\s+.+\n\n(.+?)(?:\n\n|$)/s);
    if (descMatch) {
      result.description = descMatch[1].trim();
    }

    // Extract file references
    const fileRefPattern = /`([^`]+\.[a-zA-Z0-9]+)`/g;
    let match;
    while ((match = fileRefPattern.exec(content)) !== null) {
      const ref = match[1];
      if (!result.references.includes(ref)) {
        result.references.push(ref);
      }
    }

    // Extract path references
    const pathRefPattern = /(?:^|\s)([./][^\s]+(?:\/[^\s]+)+)/gm;
    while ((match = pathRefPattern.exec(content)) !== null) {
      const ref = match[1].trim();
      if (!result.references.includes(ref)) {
        result.references.push(ref);
      }
    }

    // Extract rules from lists
    const rulePattern = /^[-*]\s+(.+)$/gm;
    while ((match = rulePattern.exec(content)) !== null) {
      result.rules.push(match[1].trim());
    }

    // Extract code blocks as context
    const codeBlockPattern = /```(?:\w+)?\n([\s\S]*?)```/g;
    while ((match = codeBlockPattern.exec(content)) !== null) {
      result.context.push(match[1].trim());
    }

    // Extract YAML frontmatter if present
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (frontmatterMatch) {
      result.metadata = this.parseSimpleYaml(frontmatterMatch[1]);
    }

    return result;
  }

  /**
   * Simple YAML parser for frontmatter
   * @param {string} yaml
   * @returns {Object}
   */
  static parseSimpleYaml(yaml) {
    const result = {};
    const lines = yaml.split('\n');

    for (const line of lines) {
      const match = line.match(/^(\w+):\s*(.*)$/);
      if (match) {
        let value = match[2].trim().replace(/^["']|["']$/g, '');
        if (value === 'true') value = true;
        else if (value === 'false') value = false;
        else if (/^\d+$/.test(value)) value = parseInt(value, 10);
        result[match[1]] = value;
      }
    }

    return result;
  }

  /**
   * Extract references from CLAUDE.md
   * @param {string} workspacePath
   * @returns {string[]}
   */
  static extractReferences(workspacePath) {
    const claudePath = path.join(workspacePath, 'CLAUDE.md');

    if (!fs.existsSync(claudePath)) {
      return [];
    }

    try {
      const content = fs.readFileSync(claudePath, 'utf8');
      const parsed = this.parse(content);
      return parsed.references;
    } catch (error) {
      return [];
    }
  }
}

/**
 * Workspace Detection Service
 */
class WorkspaceDetectionService {
  constructor(options = {}) {
    this.storagePath = options.storagePath || path.join(os.homedir(), '.dragon-ui', 'workspaces.json');
    this.maxDepth = options.maxDepth || 10;
    this.cacheTTL = options.cacheTTL || 5 * 60 * 1000; // 5 minutes

    this.workspaces = new Map();
    this.currentWorkspace = null;
    this.cacheExpiry = 0;

    this.loadStorage();
  }

  /**
   * Load workspaces from storage
   */
  loadStorage() {
    if (!fs.existsSync(this.storagePath)) {
      return;
    }

    try {
      const content = fs.readFileSync(this.storagePath, 'utf8');
      const data = JSON.parse(content);

      if (data.workspaces) {
        for (const ws of data.workspaces) {
          const metadata = WorkspaceMetadata.fromJSON(ws);
          this.workspaces.set(metadata.id, metadata);
        }
      }

      if (data.currentWorkspace) {
        this.currentWorkspace = data.currentWorkspace;
      }
    } catch (error) {
      console.error('[WorkspaceDetection] Error loading storage:', error.message);
    }
  }

  /**
   * Save workspaces to storage
   */
  saveStorage() {
    const dir = path.dirname(this.storagePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const data = {
      version: '1.0.0',
      savedAt: new Date().toISOString(),
      currentWorkspace: this.currentWorkspace,
      workspaces: Array.from(this.workspaces.values()).map(ws => ws.toJSON())
    };

    fs.writeFileSync(this.storagePath, JSON.stringify(data, null, 2));
  }

  /**
   * Detect workspace from path
   * @param {string} searchPath
   * @returns {WorkspaceMetadata|null}
   */
  detect(searchPath = process.cwd()) {
    const normalizedPath = path.resolve(searchPath);

    // Walk up directory tree
    let current = normalizedPath;

    for (let i = 0; i < this.maxDepth; i++) {
      const workspaceRoot = this.findWorkspaceRoot(current);

      if (workspaceRoot) {
        return this.registerWorkspace(workspaceRoot);
      }

      const parent = path.dirname(current);
      if (parent === current) break;
      current = parent;
    }

    // No workspace found, register current directory as workspace
    return this.registerWorkspace(normalizedPath);
  }

  /**
   * Find workspace root in directory
   * @param {string} dir
   * @returns {string|null}
   */
  findWorkspaceRoot(dir) {
    for (const marker of WORKSPACE_MARKERS) {
      const markerPath = path.join(dir, marker);
      if (fs.existsSync(markerPath)) {
        return dir;
      }
    }
    return null;
  }

  /**
   * Register a workspace
   * @param {string} workspacePath
   * @returns {WorkspaceMetadata}
   */
  registerWorkspace(workspacePath) {
    const normalizedPath = path.resolve(workspacePath);
    const tempMetadata = new WorkspaceMetadata({ path: normalizedPath });
    const id = tempMetadata.id;

    // Check if already registered
    if (this.workspaces.has(id)) {
      const existing = this.workspaces.get(id);
      existing.touch();
      this.saveStorage();
      return existing;
    }

    // Create new workspace metadata
    const metadata = new WorkspaceMetadata({
      path: normalizedPath,
      type: this.detectProjectType(normalizedPath),
      claudeConfig: this.loadClaudeConfig(normalizedPath),
      references: ClaudeConfigParser.extractReferences(normalizedPath),
      agents: this.findWorkspaceAgents(normalizedPath)
    });

    this.workspaces.set(id, metadata);
    this.saveStorage();

    return metadata;
  }

  /**
   * Detect project type
   * @param {string} workspacePath
   * @returns {string}
   */
  detectProjectType(workspacePath) {
    for (const [type, markers] of Object.entries(PROJECT_TYPES)) {
      for (const marker of markers) {
        if (marker.includes('*')) {
          // Glob pattern
          const ext = marker.replace('*', '');
          try {
            const files = fs.readdirSync(workspacePath);
            if (files.some(f => f.endsWith(ext))) {
              return type;
            }
          } catch (error) {
            // Ignore
          }
        } else {
          if (fs.existsSync(path.join(workspacePath, marker))) {
            return type;
          }
        }
      }
    }
    return 'unknown';
  }

  /**
   * Load CLAUDE.md configuration
   * @param {string} workspacePath
   * @returns {Object|null}
   */
  loadClaudeConfig(workspacePath) {
    const claudePath = path.join(workspacePath, 'CLAUDE.md');

    if (!fs.existsSync(claudePath)) {
      return null;
    }

    try {
      const content = fs.readFileSync(claudePath, 'utf8');
      return ClaudeConfigParser.parse(content);
    } catch (error) {
      return null;
    }
  }

  /**
   * Find agents in workspace
   * @param {string} workspacePath
   * @returns {string[]}
   */
  findWorkspaceAgents(workspacePath) {
    const agentDirs = [
      path.join(workspacePath, '.claude', 'agents'),
      path.join(workspacePath, '.agents'),
      path.join(workspacePath, 'agents')
    ];

    const agents = [];

    for (const dir of agentDirs) {
      if (!fs.existsSync(dir)) {
        continue;
      }

      try {
        const files = fs.readdirSync(dir);
        for (const file of files) {
          if (['.md', '.yaml', '.yml', '.json'].includes(path.extname(file))) {
            agents.push(path.join(dir, file));
          }
        }
      } catch (error) {
        // Ignore
      }
    }

    return agents;
  }

  /**
   * Get workspace by ID
   * @param {string} id
   * @returns {WorkspaceMetadata|null}
   */
  getWorkspace(id) {
    return this.workspaces.get(id) || null;
  }

  /**
   * Get workspace by path
   * @param {string} workspacePath
   * @returns {WorkspaceMetadata|null}
   */
  getWorkspaceByPath(workspacePath) {
    const normalizedPath = path.resolve(workspacePath);
    const tempMetadata = new WorkspaceMetadata({ path: normalizedPath });

    return this.workspaces.get(tempMetadata.id) || null;
  }

  /**
   * Get all workspaces
   * @returns {WorkspaceMetadata[]}
   */
  getAllWorkspaces() {
    return Array.from(this.workspaces.values())
      .sort((a, b) => b.lastAccessed - a.lastAccessed);
  }

  /**
   * Get recent workspaces
   * @param {number} limit
   * @returns {WorkspaceMetadata[]}
   */
  getRecentWorkspaces(limit = 10) {
    return this.getAllWorkspaces().slice(0, limit);
  }

  /**
   * Set current workspace
   * @param {string} workspacePath
   * @returns {WorkspaceMetadata}
   */
  setCurrentWorkspace(workspacePath) {
    const metadata = this.detect(workspacePath);
    this.currentWorkspace = metadata.id;
    this.saveStorage();
    return metadata;
  }

  /**
   * Get current workspace
   * @returns {WorkspaceMetadata|null}
   */
  getCurrentWorkspace() {
    if (!this.currentWorkspace) {
      return null;
    }
    return this.workspaces.get(this.currentWorkspace) || null;
  }

  /**
   * Remove workspace
   * @param {string} id
   * @returns {boolean}
   */
  removeWorkspace(id) {
    const result = this.workspaces.delete(id);

    if (this.currentWorkspace === id) {
      this.currentWorkspace = null;
    }

    if (result) {
      this.saveStorage();
    }

    return result;
  }

  /**
   * Update workspace settings
   * @param {string} id
   * @param {Object} settings
   * @returns {WorkspaceMetadata|null}
   */
  updateSettings(id, settings) {
    const workspace = this.workspaces.get(id);

    if (!workspace) {
      return null;
    }

    workspace.settings = { ...workspace.settings, ...settings };
    this.saveStorage();

    return workspace;
  }

  /**
   * Refresh workspace metadata
   * @param {string} id
   * @returns {WorkspaceMetadata|null}
   */
  refresh(id) {
    const workspace = this.workspaces.get(id);

    if (!workspace) {
      return null;
    }

    // Re-detect workspace info
    workspace.type = this.detectProjectType(workspace.path);
    workspace.claudeConfig = this.loadClaudeConfig(workspace.path);
    workspace.references = ClaudeConfigParser.extractReferences(workspace.path);
    workspace.agents = this.findWorkspaceAgents(workspace.path);

    this.saveStorage();

    return workspace;
  }

  /**
   * Search workspaces
   * @param {string} query
   * @returns {WorkspaceMetadata[]}
   */
  search(query) {
    const lowerQuery = query.toLowerCase();

    return this.getAllWorkspaces().filter(ws => {
      return (
        ws.name.toLowerCase().includes(lowerQuery) ||
        ws.path.toLowerCase().includes(lowerQuery) ||
        ws.type.toLowerCase().includes(lowerQuery)
      );
    });
  }

  /**
   * Get workspace statistics
   * @returns {Object}
   */
  getStats() {
    const allWorkspaces = this.getAllWorkspaces();
    const typeCounts = {};

    for (const ws of allWorkspaces) {
      typeCounts[ws.type] = (typeCounts[ws.type] || 0) + 1;
    }

    return {
      totalWorkspaces: allWorkspaces.length,
      currentWorkspace: this.currentWorkspace,
      typeCounts,
      recentCount: allWorkspaces.filter(ws =>
        Date.now() - ws.lastAccessed < 7 * 24 * 60 * 60 * 1000
      ).length
    };
  }

  /**
   * Cleanup stale workspaces
   * @param {number} maxAge - Max age in milliseconds
   * @returns {number}
   */
  cleanup(maxAge = 30 * 24 * 60 * 60 * 1000) {
    const now = Date.now();
    let removed = 0;

    for (const [id, workspace] of this.workspaces) {
      // Check if workspace path still exists
      if (!fs.existsSync(workspace.path)) {
        this.workspaces.delete(id);
        removed++;
        continue;
      }

      // Check if workspace is stale
      if (now - workspace.lastAccessed > maxAge) {
        this.workspaces.delete(id);
        removed++;
      }
    }

    if (removed > 0) {
      this.saveStorage();
    }

    return removed;
  }

  /**
   * Export workspaces data
   * @returns {Object}
   */
  exportData() {
    return {
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      currentWorkspace: this.currentWorkspace,
      workspaces: Array.from(this.workspaces.values()).map(ws => ws.toJSON())
    };
  }

  /**
   * Import workspaces data
   * @param {Object} data
   */
  importData(data) {
    if (data.workspaces) {
      for (const wsData of data.workspaces) {
        const metadata = WorkspaceMetadata.fromJSON(wsData);

        // Only import if path exists
        if (fs.existsSync(metadata.path)) {
          this.workspaces.set(metadata.id, metadata);
        }
      }
    }

    if (data.currentWorkspace && this.workspaces.has(data.currentWorkspace)) {
      this.currentWorkspace = data.currentWorkspace;
    }

    this.saveStorage();
  }

  /**
   * Clear all workspaces
   */
  clear() {
    this.workspaces.clear();
    this.currentWorkspace = null;
    this.saveStorage();
  }
}

// Singleton instance
let instance = null;

/**
 * Get WorkspaceDetectionService instance
 * @param {Object} options
 * @returns {WorkspaceDetectionService}
 */
function getWorkspaceDetection(options) {
  if (!instance) {
    instance = new WorkspaceDetectionService(options);
  }
  return instance;
}

/**
 * Reset singleton instance
 */
function resetWorkspaceDetection() {
  instance = null;
}

module.exports = {
  WorkspaceMetadata,
  ClaudeConfigParser,
  WorkspaceDetectionService,
  getWorkspaceDetection,
  resetWorkspaceDetection,
  WORKSPACE_MARKERS,
  PROJECT_TYPES
};
