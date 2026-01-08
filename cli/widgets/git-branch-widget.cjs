/**
 * Git Widgets
 * Widgets for git repository information
 */

'use strict';

const { Widget } = require('./widget-base.cjs');
const { execSync } = require('child_process');
const path = require('path');

/**
 * Execute a git command safely
 * @param {string} command - Git command to execute
 * @param {string} [cwd] - Working directory
 * @returns {string|null}
 */
function execGit(command, cwd) {
  try {
    return execSync(command, {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 3000,
      cwd: cwd || process.cwd()
    }).trim();
  } catch {
    return null;
  }
}

/**
 * Git Branch Widget
 * Displays the current git branch name
 */
class GitBranchWidget extends Widget {
  constructor(config = {}) {
    super({
      id: 'git-branch',
      name: 'Git Branch',
      description: 'Displays the current git branch name',
      color: { fg: 'green', bg: null },
      cacheTimeout: 5000, // Cache for 5 seconds
      ...config
    });
  }

  async getValue(data) {
    // Use provided branch if available
    if (data?.branch && data.branch !== 'N/A') {
      return this.formatBranch(data.branch);
    }

    const cwd = data?.cwd || process.cwd();
    const branch = execGit('git rev-parse --abbrev-ref HEAD', cwd);

    if (branch) {
      return this.formatBranch(branch);
    }

    return this.metadata.showNA ? 'N/A' : '';
  }

  formatBranch(branch) {
    if (!branch) return '';

    // Add icon if configured
    const icon = this.metadata.showIcon ? ' ' : '';

    // Truncate if too long
    const maxLength = this.metadata.maxLength || 20;
    if (branch.length > maxLength) {
      return `${icon}${branch.substring(0, maxLength - 2)}..`;
    }

    return `${icon}${branch}`;
  }
}

/**
 * Git Changes Widget
 * Displays git changes (+X, -Y format)
 */
class GitChangesWidget extends Widget {
  constructor(config = {}) {
    super({
      id: 'git-changes',
      name: 'Git Changes',
      description: 'Displays git changes in +X, -Y format',
      color: { fg: 'yellow', bg: null },
      cacheTimeout: 5000,
      ...config
    });
  }

  async getValue(data) {
    const cwd = data?.cwd || process.cwd();

    // Get diff stats
    const diffStat = execGit('git diff --shortstat', cwd);

    if (!diffStat) {
      // Check for staged changes
      const stagedStat = execGit('git diff --cached --shortstat', cwd);
      if (!stagedStat) {
        return this.metadata.showEmpty ? '0, 0' : null;
      }
      return this.formatStats(stagedStat);
    }

    return this.formatStats(diffStat);
  }

  formatStats(stat) {
    // Parse: "2 files changed, 10 insertions(+), 5 deletions(-)"
    const insertions = stat.match(/(\d+) insertion/);
    const deletions = stat.match(/(\d+) deletion/);

    const add = insertions ? parseInt(insertions[1], 10) : 0;
    const del = deletions ? parseInt(deletions[1], 10) : 0;

    if (add === 0 && del === 0) {
      return this.metadata.showEmpty ? '+0, -0' : null;
    }

    return `+${add}, -${del}`;
  }
}

/**
 * Git Worktree Widget
 * Displays current git worktree name
 */
class GitWorktreeWidget extends Widget {
  constructor(config = {}) {
    super({
      id: 'git-worktree',
      name: 'Git Worktree',
      description: 'Displays the current git worktree',
      color: { fg: 'magenta', bg: null },
      cacheTimeout: 10000,
      ...config
    });
  }

  async getValue(data) {
    const cwd = data?.cwd || process.cwd();

    // Get the git directory
    const gitDir = execGit('git rev-parse --git-dir', cwd);
    if (!gitDir) return null;

    // Check if this is a worktree
    if (gitDir.includes('.git/worktrees/')) {
      // Extract worktree name from path
      const match = gitDir.match(/\.git\/worktrees\/([^/]+)/);
      if (match) {
        return this.formatWorktree(match[1]);
      }
    }

    // Get toplevel and use directory name
    const toplevel = execGit('git rev-parse --show-toplevel', cwd);
    if (toplevel) {
      return this.formatWorktree(path.basename(toplevel));
    }

    return null;
  }

  formatWorktree(name) {
    const icon = this.metadata.showIcon ? ' ' : '';
    const maxLength = this.metadata.maxLength || 15;

    if (name.length > maxLength) {
      return `${icon}${name.substring(0, maxLength - 2)}..`;
    }

    return `${icon}${name}`;
  }
}

/**
 * Git Status Widget
 * Displays git status indicators
 */
class GitStatusWidget extends Widget {
  constructor(config = {}) {
    super({
      id: 'git-status',
      name: 'Git Status',
      description: 'Displays git status indicators',
      color: { fg: 'cyan', bg: null },
      cacheTimeout: 5000,
      ...config
    });
  }

  async getValue(data) {
    const cwd = data?.cwd || process.cwd();

    // Get porcelain status
    const status = execGit('git status --porcelain', cwd);
    if (status === null) return null;

    const lines = status.split('\n').filter(l => l.trim());
    if (lines.length === 0) {
      return this.metadata.showClean ? '✓' : null;
    }

    // Count different statuses
    let modified = 0;
    let added = 0;
    let deleted = 0;
    let untracked = 0;

    for (const line of lines) {
      const statusCode = line.substring(0, 2);
      if (statusCode.includes('M')) modified++;
      else if (statusCode.includes('A')) added++;
      else if (statusCode.includes('D')) deleted++;
      else if (statusCode.includes('?')) untracked++;
    }

    const parts = [];
    if (modified > 0) parts.push(`~${modified}`);
    if (added > 0) parts.push(`+${added}`);
    if (deleted > 0) parts.push(`-${deleted}`);
    if (untracked > 0) parts.push(`?${untracked}`);

    return parts.join(' ') || null;
  }
}

/**
 * Git Commit Widget
 * Displays current commit hash
 */
class GitCommitWidget extends Widget {
  constructor(config = {}) {
    super({
      id: 'git-commit',
      name: 'Git Commit',
      description: 'Displays the current commit hash',
      color: { fg: 'gray', bg: null },
      cacheTimeout: 10000,
      ...config
    });

    this.hashLength = config.hashLength || 7;
  }

  async getValue(data) {
    const cwd = data?.cwd || process.cwd();
    const commit = execGit(`git rev-parse --short=${this.hashLength} HEAD`, cwd);

    if (!commit) return null;

    const icon = this.metadata.showIcon ? '@' : '';
    return `${icon}${commit}`;
  }
}

/**
 * Git Ahead/Behind Widget
 * Displays commits ahead/behind remote
 */
class GitAheadBehindWidget extends Widget {
  constructor(config = {}) {
    super({
      id: 'git-ahead-behind',
      name: 'Git Ahead/Behind',
      description: 'Displays commits ahead/behind remote',
      color: { fg: 'blue', bg: null },
      cacheTimeout: 30000, // Check less frequently
      ...config
    });
  }

  async getValue(data) {
    const cwd = data?.cwd || process.cwd();

    // Get upstream tracking branch
    const upstream = execGit('git rev-parse --abbrev-ref @{upstream}', cwd);
    if (!upstream) return null;

    // Get ahead/behind counts
    const revList = execGit(`git rev-list --left-right --count HEAD...@{upstream}`, cwd);
    if (!revList) return null;

    const [ahead, behind] = revList.split('\t').map(n => parseInt(n, 10));

    if (ahead === 0 && behind === 0) {
      return this.metadata.showSync ? '=' : null;
    }

    const parts = [];
    if (ahead > 0) parts.push(`↑${ahead}`);
    if (behind > 0) parts.push(`↓${behind}`);

    return parts.join(' ');
  }
}

/**
 * Git Stash Widget
 * Displays stash count
 */
class GitStashWidget extends Widget {
  constructor(config = {}) {
    super({
      id: 'git-stash',
      name: 'Git Stash',
      description: 'Displays stash count',
      color: { fg: 'yellow', bg: null },
      cacheTimeout: 10000,
      ...config
    });
  }

  async getValue(data) {
    const cwd = data?.cwd || process.cwd();
    const stashList = execGit('git stash list', cwd);

    if (!stashList) return null;

    const count = stashList.split('\n').filter(l => l.trim()).length;
    if (count === 0) return null;

    const icon = this.metadata.showIcon ? '📦 ' : '';
    return `${icon}${count} stash${count > 1 ? 'es' : ''}`;
  }
}

module.exports = {
  GitBranchWidget,
  GitChangesWidget,
  GitWorktreeWidget,
  GitStatusWidget,
  GitCommitWidget,
  GitAheadBehindWidget,
  GitStashWidget
};
