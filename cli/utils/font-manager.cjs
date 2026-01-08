/**
 * Font Manager for Dragon-UI
 * Detect and install Powerline/Nerd Fonts
 *
 * @module cli/utils/font-manager
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync, spawn } = require('child_process');

/**
 * Platform-specific font directories
 */
const FONT_DIRECTORIES = {
  win32: [
    path.join(process.env.LOCALAPPDATA || '', 'Microsoft', 'Windows', 'Fonts'),
    path.join(process.env.WINDIR || 'C:\\Windows', 'Fonts')
  ],
  darwin: [
    path.join(os.homedir(), 'Library', 'Fonts'),
    '/Library/Fonts',
    '/System/Library/Fonts'
  ],
  linux: [
    path.join(os.homedir(), '.local', 'share', 'fonts'),
    path.join(os.homedir(), '.fonts'),
    '/usr/local/share/fonts',
    '/usr/share/fonts'
  ]
};

/**
 * Powerline font patterns
 */
const POWERLINE_PATTERNS = [
  /powerline/i,
  /nerd.*font/i,
  /fira.*code/i,
  /source.*code.*pro/i,
  /jetbrains.*mono/i,
  /cascadia.*code/i,
  /hack/i,
  /inconsolata/i,
  /meslo/i,
  /deja.*vu.*sans.*mono/i,
  /ubuntu.*mono/i,
  /roboto.*mono/i
];

/**
 * Powerline symbol test characters
 */
const POWERLINE_SYMBOLS = {
  branch: '\ue0a0',      //
  line: '\ue0a1',        //
  lock: '\ue0a2',        //
  rightArrow: '\ue0b0',  //
  rightThin: '\ue0b1',   //
  leftArrow: '\ue0b2',   //
  leftThin: '\ue0b3'     //
};

/**
 * Popular font download URLs
 */
const FONT_SOURCES = {
  'FiraCode': 'https://github.com/tonsky/FiraCode/releases/download/6.2/Fira_Code_v6.2.zip',
  'JetBrainsMono': 'https://github.com/JetBrains/JetBrainsMono/releases/download/v2.304/JetBrainsMono-2.304.zip',
  'CascadiaCode': 'https://github.com/microsoft/cascadia-code/releases/download/v2111.01/CascadiaCode-2111.01.zip',
  'Hack': 'https://github.com/source-foundry/Hack/releases/download/v3.003/Hack-v3.003-ttf.zip',
  'MesloNerdFont': 'https://github.com/ryanoasis/nerd-fonts/releases/download/v3.1.1/Meslo.zip',
  'FiraCodeNerdFont': 'https://github.com/ryanoasis/nerd-fonts/releases/download/v3.1.1/FiraCode.zip'
};

/**
 * Font file extensions
 */
const FONT_EXTENSIONS = ['.ttf', '.otf', '.woff', '.woff2'];

/**
 * Font Manager class
 */
class FontManager {
  constructor() {
    this.platform = process.platform;
    this.fontDirs = FONT_DIRECTORIES[this.platform] || FONT_DIRECTORIES.linux;
    this.detectedFonts = new Map();
    this.powerlineFonts = [];
  }

  /**
   * Get user font directory
   * @returns {string}
   */
  getUserFontDir() {
    switch (this.platform) {
      case 'win32':
        return path.join(process.env.LOCALAPPDATA || os.homedir(), 'Microsoft', 'Windows', 'Fonts');
      case 'darwin':
        return path.join(os.homedir(), 'Library', 'Fonts');
      default:
        return path.join(os.homedir(), '.local', 'share', 'fonts');
    }
  }

  /**
   * Ensure user font directory exists
   */
  ensureUserFontDir() {
    const dir = this.getUserFontDir();
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    return dir;
  }

  /**
   * Scan font directory for font files
   * @param {string} dir
   * @returns {string[]}
   */
  scanFontDirectory(dir) {
    const fonts = [];

    if (!fs.existsSync(dir)) {
      return fonts;
    }

    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          fonts.push(...this.scanFontDirectory(fullPath));
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase();
          if (FONT_EXTENSIONS.includes(ext)) {
            fonts.push(fullPath);
          }
        }
      }
    } catch {
      // Skip directories we can't read
    }

    return fonts;
  }

  /**
   * Detect all installed fonts
   * @returns {Map<string, string>}
   */
  detectFonts() {
    this.detectedFonts.clear();

    for (const dir of this.fontDirs) {
      const fonts = this.scanFontDirectory(dir);
      for (const fontPath of fonts) {
        const fontName = path.basename(fontPath, path.extname(fontPath));
        this.detectedFonts.set(fontName.toLowerCase(), fontPath);
      }
    }

    return this.detectedFonts;
  }

  /**
   * Detect Powerline-compatible fonts
   * @returns {Object[]}
   */
  detectPowerlineFonts() {
    this.detectFonts();
    this.powerlineFonts = [];

    for (const [name, fontPath] of this.detectedFonts) {
      for (const pattern of POWERLINE_PATTERNS) {
        if (pattern.test(name)) {
          this.powerlineFonts.push({
            name: path.basename(fontPath, path.extname(fontPath)),
            path: fontPath,
            pattern: pattern.source
          });
          break;
        }
      }
    }

    return this.powerlineFonts;
  }

  /**
   * Use fc-list on Linux/macOS for font detection
   * @returns {string[]}
   */
  detectWithFcList() {
    if (this.platform === 'win32') {
      return [];
    }

    try {
      const output = execSync('fc-list : family', {
        encoding: 'utf8',
        timeout: 10000
      });

      const families = output.split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0);

      return [...new Set(families)];
    } catch {
      return [];
    }
  }

  /**
   * Check if Powerline symbols render correctly
   * @returns {boolean}
   */
  testPowerlineSymbols() {
    // This is a best-effort check - terminal support varies
    const testChars = Object.values(POWERLINE_SYMBOLS);

    // Check if terminal reports width correctly for special chars
    try {
      // On most terminals, Powerline symbols should be single-width
      for (const char of testChars) {
        if (char.length !== 1) {
          return false;
        }
      }
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get font installation status
   * @returns {Object}
   */
  getStatus() {
    const powerlineFonts = this.detectPowerlineFonts();
    const fcListFonts = this.detectWithFcList();

    // Check for recommended fonts
    const recommended = {
      'FiraCode': false,
      'JetBrainsMono': false,
      'CascadiaCode': false,
      'Hack': false,
      'MesloNerdFont': false
    };

    for (const font of powerlineFonts) {
      const name = font.name.toLowerCase();
      if (name.includes('fira') && name.includes('code')) {
        recommended['FiraCode'] = true;
      }
      if (name.includes('jetbrains')) {
        recommended['JetBrainsMono'] = true;
      }
      if (name.includes('cascadia')) {
        recommended['CascadiaCode'] = true;
      }
      if (name.includes('hack')) {
        recommended['Hack'] = true;
      }
      if (name.includes('meslo') && name.includes('nerd')) {
        recommended['MesloNerdFont'] = true;
      }
    }

    // Check fc-list fonts too
    for (const family of fcListFonts) {
      const name = family.toLowerCase();
      if (name.includes('fira') && name.includes('code')) {
        recommended['FiraCode'] = true;
      }
      if (name.includes('jetbrains')) {
        recommended['JetBrainsMono'] = true;
      }
      if (name.includes('cascadia')) {
        recommended['CascadiaCode'] = true;
      }
      if (name.includes('hack')) {
        recommended['Hack'] = true;
      }
      if (name.includes('meslo') && name.includes('nerd')) {
        recommended['MesloNerdFont'] = true;
      }
    }

    const hasPowerlineFont = powerlineFonts.length > 0 ||
                            Object.values(recommended).some(v => v);

    return {
      platform: this.platform,
      userFontDir: this.getUserFontDir(),
      totalFonts: this.detectedFonts.size,
      powerlineFonts: powerlineFonts.length,
      hasPowerlineFont,
      recommended,
      detectedPowerlineFonts: powerlineFonts.slice(0, 10),
      fcListAvailable: fcListFonts.length > 0
    };
  }

  /**
   * Download and install a font
   * @param {string} fontName
   * @param {Function} progressCallback
   * @returns {Promise<Object>}
   */
  async installFont(fontName, progressCallback = null) {
    const url = FONT_SOURCES[fontName];
    if (!url) {
      return {
        success: false,
        error: `Unknown font: ${fontName}. Available: ${Object.keys(FONT_SOURCES).join(', ')}`
      };
    }

    const userFontDir = this.ensureUserFontDir();
    const tempDir = path.join(os.tmpdir(), `dragon-ui-font-${Date.now()}`);
    const zipPath = path.join(tempDir, `${fontName}.zip`);

    try {
      // Create temp directory
      fs.mkdirSync(tempDir, { recursive: true });

      if (progressCallback) progressCallback('Downloading...');

      // Download using curl or wget or native fetch
      await this.downloadFile(url, zipPath, progressCallback);

      if (progressCallback) progressCallback('Extracting...');

      // Extract zip
      await this.extractZip(zipPath, tempDir);

      if (progressCallback) progressCallback('Installing...');

      // Find and copy font files
      const fontFiles = this.scanFontDirectory(tempDir)
        .filter(f => !f.endsWith('.zip'));

      let installedCount = 0;
      for (const fontFile of fontFiles) {
        const destPath = path.join(userFontDir, path.basename(fontFile));
        fs.copyFileSync(fontFile, destPath);
        installedCount++;
      }

      // Cleanup temp
      fs.rmSync(tempDir, { recursive: true, force: true });

      // Refresh font cache on Linux
      if (this.platform === 'linux') {
        if (progressCallback) progressCallback('Refreshing font cache...');
        try {
          execSync('fc-cache -f', { timeout: 30000 });
        } catch {
          // fc-cache might not be available
        }
      }

      return {
        success: true,
        fontName,
        installedCount,
        installDir: userFontDir
      };

    } catch (error) {
      // Cleanup on error
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch {}

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Download a file
   * @param {string} url
   * @param {string} destPath
   * @param {Function} progressCallback
   * @returns {Promise<void>}
   */
  async downloadFile(url, destPath, progressCallback) {
    return new Promise((resolve, reject) => {
      const https = require('https');
      const http = require('http');

      const protocol = url.startsWith('https') ? https : http;

      const request = (currentUrl, redirectCount = 0) => {
        if (redirectCount > 5) {
          reject(new Error('Too many redirects'));
          return;
        }

        protocol.get(currentUrl, (response) => {
          // Handle redirects
          if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
            request(response.headers.location, redirectCount + 1);
            return;
          }

          if (response.statusCode !== 200) {
            reject(new Error(`Download failed: ${response.statusCode}`));
            return;
          }

          const file = fs.createWriteStream(destPath);
          const totalSize = parseInt(response.headers['content-length'], 10) || 0;
          let downloaded = 0;

          response.on('data', (chunk) => {
            downloaded += chunk.length;
            if (progressCallback && totalSize > 0) {
              const percent = Math.round((downloaded / totalSize) * 100);
              progressCallback(`Downloading... ${percent}%`);
            }
          });

          response.pipe(file);

          file.on('finish', () => {
            file.close();
            resolve();
          });

          file.on('error', (err) => {
            fs.unlink(destPath, () => {});
            reject(err);
          });
        }).on('error', reject);
      };

      request(url);
    });
  }

  /**
   * Extract a zip file
   * @param {string} zipPath
   * @param {string} destDir
   * @returns {Promise<void>}
   */
  async extractZip(zipPath, destDir) {
    return new Promise((resolve, reject) => {
      if (this.platform === 'win32') {
        // Use PowerShell on Windows
        try {
          execSync(
            `powershell -command "Expand-Archive -Path '${zipPath}' -DestinationPath '${destDir}' -Force"`,
            { timeout: 60000 }
          );
          resolve();
        } catch (error) {
          reject(error);
        }
      } else {
        // Use unzip on Unix
        try {
          execSync(`unzip -o "${zipPath}" -d "${destDir}"`, {
            timeout: 60000,
            stdio: 'ignore'
          });
          resolve();
        } catch (error) {
          reject(error);
        }
      }
    });
  }

  /**
   * Get available fonts for download
   * @returns {Object[]}
   */
  getAvailableFonts() {
    return Object.entries(FONT_SOURCES).map(([name, url]) => ({
      name,
      url,
      description: this.getFontDescription(name)
    }));
  }

  /**
   * Get font description
   * @param {string} name
   * @returns {string}
   */
  getFontDescription(name) {
    const descriptions = {
      'FiraCode': 'Monospaced font with programming ligatures',
      'JetBrainsMono': 'Developer font by JetBrains with ligatures',
      'CascadiaCode': 'Microsoft\'s monospaced font for Windows Terminal',
      'Hack': 'Source code font designed for reading',
      'MesloNerdFont': 'Meslo with Nerd Font icons (recommended for Powerline)',
      'FiraCodeNerdFont': 'Fira Code with Nerd Font icons (recommended for Powerline)'
    };
    return descriptions[name] || 'Monospaced programming font';
  }

  /**
   * Get Powerline symbols
   * @returns {Object}
   */
  getSymbols() {
    return { ...POWERLINE_SYMBOLS };
  }
}

// Singleton instance
let instance = null;

/**
 * Get Font Manager instance
 * @returns {FontManager}
 */
function getFontManager() {
  if (!instance) {
    instance = new FontManager();
  }
  return instance;
}

module.exports = {
  FontManager,
  getFontManager,
  FONT_DIRECTORIES,
  POWERLINE_PATTERNS,
  POWERLINE_SYMBOLS,
  FONT_SOURCES,
  FONT_EXTENSIONS
};
