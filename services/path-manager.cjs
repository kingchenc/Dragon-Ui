const fs = require('fs');
const path = require('path');
const os = require('os');

/**
 * Path Manager Service
 * Handles Claude project path detection and management
 */
class PathManagerService {
  constructor() {
    this.standardPaths = [];
    this.customPaths = [];
    this.detectStandardPaths();
  }

  /**
   * Detect standard Claude project paths
   */
  detectStandardPaths() {
    this.standardPaths = [];
    console.log('[SCAN] PathManager: Starting Claude path detection...');
    
    const platform = os.platform();
    console.log(`[SYS] PathManager: Platform detected: ${platform}`);
    
    if (platform === 'win32') {
      this.detectWindowsPaths();
    } else {
      this.detectUnixPaths();
    }
    
    console.log(`[SCAN] PathManager: Detected ${this.standardPaths.length} standard Claude paths`);
    return this.standardPaths;
  }

  /**
   * Detect Windows paths
   */
  detectWindowsPaths() {
    const homeDir = os.homedir();
    
    // New standard (Claude Code v1.0.30+)
    const newConfigPath = path.join(homeDir, '.config', 'claude', 'projects');
    if (this.directoryExists(newConfigPath)) {
      this.standardPaths.push(newConfigPath);
      console.log('[OK] PathManager: Found Windows Claude config path:', newConfigPath);
    }
    
    // Legacy path (before v1.0.30)
    const legacyPath = path.join(homeDir, '.claude', 'projects');
    if (this.directoryExists(legacyPath)) {
      this.standardPaths.push(legacyPath);
      console.log('[OK] PathManager: Found Windows legacy Claude path:', legacyPath);
    }
    
    // WSL detection
    if (this.standardPaths.length === 0) {
      console.log('[INFO] PathManager: No Windows paths found, searching WSL...');
      try {
        const wslPaths = this.detectWSLPaths();
        this.standardPaths.push(...wslPaths);
      } catch (error) {
        console.log('[ERR] PathManager: WSL detection failed:', error.message);
      }
    }
  }

  /**
   * Detect Unix (Linux/Mac) paths
   */
  detectUnixPaths() {
    const homeDir = os.homedir();
    
    const newConfigPath = path.join(homeDir, '.config', 'claude', 'projects');
    if (this.directoryExists(newConfigPath)) {
      this.standardPaths.push(newConfigPath);
      console.log('[OK] PathManager: Found Unix Claude config path:', newConfigPath);
    }
    
    const legacyPath = path.join(homeDir, '.claude', 'projects');
    if (this.directoryExists(legacyPath)) {
      this.standardPaths.push(legacyPath);
      console.log('[OK] PathManager: Found Unix legacy Claude path:', legacyPath);
    }
  }

  /**
   * Detect WSL paths
   */
  detectWSLPaths() {
    const wslPaths = [];
    
    // Common WSL distributions
    const wslDistributions = ['Ubuntu', 'Debian', 'Alpine', 'openSUSE-Leap', 'kali-linux'];
    
    for (const distro of wslDistributions) {
      // Try common user paths
      const userPaths = [
        `\\\\wsl$\\${distro}\\root\\.claude\\projects`,
        `\\\\wsl$\\${distro}\\root\\.config\\claude\\projects`,
        `\\\\wsl$\\${distro}\\home\\*\\.claude\\projects`,
        `\\\\wsl$\\${distro}\\home\\*\\.config\\claude\\projects`
      ];
      
      for (const testPath of userPaths) {
        if (testPath.includes('*')) {
          // Handle wildcard paths
          const basePath = testPath.substring(0, testPath.indexOf('*'));
          try {
            const homeEntries = fs.readdirSync(basePath);
            for (const homeEntry of homeEntries) {
              const expandedPath = testPath.replace('*', homeEntry);
              if (this.directoryExists(expandedPath)) {
                wslPaths.push(expandedPath);
                console.log('[OK] PathManager: Found WSL Claude path:', expandedPath);
              }
            }
          } catch (error) {
            continue;
          }
        } else {
          if (this.directoryExists(testPath)) {
            wslPaths.push(testPath);
            console.log('[OK] PathManager: Found WSL Claude path:', testPath);
          }
        }
      }
    }
    
    return wslPaths;
  }

  /**
   * Check if directory exists
   */
  directoryExists(dirPath) {
    try {
      const stat = fs.statSync(dirPath);
      return stat.isDirectory();
    } catch (error) {
      return false;
    }
  }

  /**
   * Get all paths (standard + custom + active)
   */
  getAllPaths() {
    const activePaths = [...this.standardPaths, ...this.customPaths]
      .filter(p => this.directoryExists(p));
    
    return {
      standard: this.standardPaths,
      custom: this.customPaths,
      active: activePaths
    };
  }

  /**
   * Add custom path
   */
  addCustomPath(customPath) {
    if (!this.customPaths.includes(customPath) && this.directoryExists(customPath)) {
      this.customPaths.push(customPath);
      console.log('[OK] PathManager: Added custom path:', customPath);
      return true;
    }
    console.log('[WARN] PathManager: Failed to add custom path:', customPath);
    return false;
  }

  /**
   * Remove custom path
   */
  removeCustomPath(customPath) {
    const index = this.customPaths.indexOf(customPath);
    if (index > -1) {
      this.customPaths.splice(index, 1);
      console.log('[OK] PathManager: Removed custom path:', customPath);
      return true;
    }
    console.log('[WARN] PathManager: Custom path not found:', customPath);
    return false;
  }

  /**
   * Force refresh path detection
   */
  forceRefreshPaths() {
    console.log('[REFRESH] PathManager: Force refreshing paths...');
    this.detectStandardPaths();
    return this.getAllPaths();
  }

  /**
   * Get path statistics
   */
  getPathStats() {
    const allPaths = this.getAllPaths();
    const stats = {
      standardCount: allPaths.standard.length,
      customCount: allPaths.custom.length,
      activeCount: allPaths.active.length,
      inactiveCount: (allPaths.standard.length + allPaths.custom.length) - allPaths.active.length
    };
    
    console.log('[DATA] PathManager Stats:', stats);
    return stats;
  }
}

module.exports = PathManagerService;