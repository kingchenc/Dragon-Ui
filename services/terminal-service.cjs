/**
 * Terminal Service
 * Manages terminal sessions using child_process with proper Windows support
 */

const { spawn } = require('child_process');
const path = require('path');
const os = require('os');
const fs = require('fs');
const EventEmitter = require('events');

class TerminalSession extends EventEmitter {
  constructor(id, shell, cwd, env = {}) {
    super();
    this.id = id;
    this.shell = shell;
    this.cwd = cwd;
    this.env = env;
    this.process = null;
    this.buffer = '';
    this.isAlive = false;
    this.cols = 80;
    this.rows = 24;
  }

  start() {
    const shellConfig = this.getShellConfig();

    const spawnOptions = {
      cwd: this.cwd,
      env: {
        ...process.env,
        ...this.env,
        TERM: 'xterm-256color',
        COLORTERM: 'truecolor',
        FORCE_COLOR: '1',
        // Windows specific
        PROMPT: '$P$G',
      },
      shell: true, // Use shell mode for better compatibility
      windowsHide: false,
      stdio: ['pipe', 'pipe', 'pipe']
    };

    try {
      console.log(`[TERM] Starting shell: ${shellConfig.command} ${shellConfig.args.join(' ')}`);
      console.log(`[TERM] Working directory: ${this.cwd}`);

      this.process = spawn(shellConfig.command, shellConfig.args, spawnOptions);
      this.isAlive = true;

      // Handle stdout
      this.process.stdout.setEncoding('utf8');
      this.process.stdout.on('data', (data) => {
        this.buffer += data;
        this.emit('data', data);
      });

      // Handle stderr
      this.process.stderr.setEncoding('utf8');
      this.process.stderr.on('data', (data) => {
        this.buffer += data;
        this.emit('data', data);
      });

      // Handle exit
      this.process.on('exit', (code, signal) => {
        console.log(`[TERM] Shell exited with code ${code}`);
        this.isAlive = false;
        this.emit('exit', { code, signal });
      });

      // Handle error
      this.process.on('error', (err) => {
        console.error(`[TERM] Shell error:`, err.message);
        this.isAlive = false;
        this.emit('error', err);
      });

      // Send initial newline to trigger prompt
      setTimeout(() => {
        if (this.isAlive && this.process) {
          // For PowerShell, we might need to trigger a prompt
          if (this.shell === 'powershell' || this.shell === 'pwsh') {
            // Don't send anything, PowerShell should output prompt automatically
          }
        }
      }, 100);

      return true;
    } catch (err) {
      console.error(`[TERM] Failed to start shell:`, err.message);
      this.emit('error', err);
      return false;
    }
  }

  getShellConfig() {
    const platform = os.platform();

    switch (this.shell) {
      case 'powershell':
        return {
          command: 'powershell.exe',
          args: ['-NoExit', '-Command', '-']
        };

      case 'pwsh':
        return {
          command: 'pwsh.exe',
          args: ['-NoExit', '-Command', '-']
        };

      case 'cmd':
        return {
          command: 'cmd.exe',
          args: []
        };

      case 'gitbash':
        const gitBashPaths = [
          'C:\\Program Files\\Git\\bin\\bash.exe',
          'C:\\Program Files (x86)\\Git\\bin\\bash.exe',
          process.env.GIT_BASH || ''
        ];

        for (const bashPath of gitBashPaths) {
          if (bashPath && fs.existsSync(bashPath)) {
            return {
              command: bashPath,
              args: ['--login', '-i']
            };
          }
        }

        return {
          command: 'bash.exe',
          args: ['--login', '-i']
        };

      case 'wsl':
        return {
          command: 'wsl.exe',
          args: []
        };

      case 'bash':
        if (platform === 'win32') {
          return {
            command: 'bash.exe',
            args: ['--login', '-i']
          };
        }
        return {
          command: '/bin/bash',
          args: ['-l', '-i']
        };

      case 'zsh':
        return {
          command: '/bin/zsh',
          args: ['-l', '-i']
        };

      default:
        if (platform === 'win32') {
          return {
            command: 'cmd.exe',
            args: []
          };
        }
        return {
          command: process.env.SHELL || '/bin/bash',
          args: ['-l', '-i']
        };
    }
  }

  write(data) {
    if (this.process && this.isAlive && this.process.stdin.writable) {
      try {
        this.process.stdin.write(data);
        return true;
      } catch (err) {
        console.error(`[TERM] Write error:`, err.message);
        return false;
      }
    }
    return false;
  }

  resize(cols, rows) {
    this.cols = cols;
    this.rows = rows;
    // Note: Without node-pty, resize signals don't work with child_process
    // This is a limitation of the fallback implementation
    this.emit('resize', { cols, rows });
  }

  kill() {
    if (this.process && this.isAlive) {
      this.isAlive = false;

      try {
        if (os.platform() === 'win32') {
          // Windows: use taskkill to kill the process tree
          spawn('taskkill', ['/pid', this.process.pid.toString(), '/T', '/F'], {
            shell: true,
            windowsHide: true
          });
        } else {
          this.process.kill('SIGTERM');
        }
      } catch (err) {
        console.error(`[TERM] Kill error:`, err.message);
      }

      return true;
    }
    return false;
  }

  getInfo() {
    return {
      id: this.id,
      shell: this.shell,
      cwd: this.cwd,
      isAlive: this.isAlive,
      cols: this.cols,
      rows: this.rows,
      pid: this.process?.pid
    };
  }
}

class TerminalService {
  constructor() {
    this.sessions = new Map();
    this.nextId = 1;
    this.defaultCwd = os.homedir();
    this.maxSessions = 10;
  }

  getAvailableShells() {
    const platform = os.platform();
    const shells = [];

    if (platform === 'win32') {
      // Always add CMD as it's always available
      shells.push({ id: 'cmd', name: 'Command Prompt', icon: 'terminal-square' });

      // Add PowerShell (always available on modern Windows)
      shells.push({ id: 'powershell', name: 'PowerShell', icon: 'terminal' });

      // Check for PowerShell Core
      try {
        require('child_process').execSync('where pwsh', { stdio: 'ignore' });
        shells.push({ id: 'pwsh', name: 'PowerShell Core', icon: 'terminal' });
      } catch {}

      // Check for Git Bash
      const gitBashPaths = [
        'C:\\Program Files\\Git\\bin\\bash.exe',
        'C:\\Program Files (x86)\\Git\\bin\\bash.exe'
      ];

      for (const bashPath of gitBashPaths) {
        if (fs.existsSync(bashPath)) {
          shells.push({ id: 'gitbash', name: 'Git Bash', icon: 'git-branch' });
          break;
        }
      }

      // Check for WSL
      try {
        require('child_process').execSync('where wsl', { stdio: 'ignore' });
        shells.push({ id: 'wsl', name: 'WSL', icon: 'linux' });
      } catch {}

    } else {
      // Unix-like systems
      shells.push(
        { id: 'bash', name: 'Bash', icon: 'terminal' },
        { id: 'zsh', name: 'Zsh', icon: 'terminal' }
      );
    }

    return shells;
  }

  createSession(options = {}) {
    if (this.sessions.size >= this.maxSessions) {
      throw new Error(`Maximum number of terminal sessions (${this.maxSessions}) reached`);
    }

    const id = `term-${this.nextId++}`;
    // Default to CMD on Windows for better compatibility without node-pty
    const defaultShell = os.platform() === 'win32' ? 'cmd' : 'bash';
    const shell = options.shell || defaultShell;
    const cwd = options.cwd || this.defaultCwd;
    const env = options.env || {};

    console.log(`[TERM] Creating session ${id} with shell: ${shell}`);

    const session = new TerminalSession(id, shell, cwd, env);
    this.sessions.set(id, session);

    return session;
  }

  getSession(id) {
    return this.sessions.get(id);
  }

  getAllSessions() {
    return Array.from(this.sessions.values()).map(session => session.getInfo());
  }

  destroySession(id) {
    const session = this.sessions.get(id);
    if (session) {
      session.kill();
      this.sessions.delete(id);
      return true;
    }
    return false;
  }

  destroyAllSessions() {
    for (const session of this.sessions.values()) {
      session.kill();
    }
    this.sessions.clear();
  }

  setDefaultCwd(cwd) {
    this.defaultCwd = cwd;
  }
}

// Singleton instance
const terminalService = new TerminalService();

module.exports = { TerminalService, TerminalSession, terminalService };
