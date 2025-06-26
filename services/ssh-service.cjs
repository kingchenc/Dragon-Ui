const { Client } = require('ssh2');
const fs = require('fs').promises;
const path = require('path');

/**
 * SSH Service for Dragon UI
 * Handles SSH connections, testing, and remote file operations
 */
class SshService {
  constructor() {
    this.activeConnections = new Map();
    this.connectionConfig = null;
  }

  /**
   * Set SSH configuration
   * @param {Object} config - SSH configuration
   * @param {string} config.host - SSH server host address
   * @param {number} config.port - SSH server port (default: 22)
   * @param {string} config.username - SSH username
   * @param {string} config.password - SSH password
   * @param {boolean} config.enabled - Whether SSH is enabled
   */
  setConfig(config) {
    console.log('[SSH] Setting SSH configuration:', { 
      host: config.host, 
      port: config.port, 
      username: config.username,
      enabled: config.enabled 
    });
    
    this.connectionConfig = {
      host: config.host,
      port: config.port || 22,
      username: config.username,
      password: config.password,
      enabled: config.enabled,
      // SSH connection options
      readyTimeout: 20000, // 20 seconds
      keepaliveInterval: 10000, // 10 seconds
      keepaliveCountMax: 3
    };
  }

  /**
   * Test SSH connection
   * @returns {Promise<{success: boolean, message: string}>}
   */
  async testConnection() {
    if (!this.connectionConfig || !this.connectionConfig.enabled) {
      return {
        success: false,
        message: 'SSH is not enabled or configured'
      };
    }

    return new Promise((resolve) => {
      const conn = new Client();
      let resolved = false;

      const cleanup = () => {
        if (!resolved) {
          resolved = true;
          conn.end();
        }
      };

      // Set timeout
      const timeout = setTimeout(() => {
        cleanup();
        resolve({
          success: false,
          message: 'Connection timeout (20 seconds)'
        });
      }, 20000);

      conn.on('ready', () => {
        clearTimeout(timeout);
        cleanup();
        resolve({
          success: true,
          message: `Successfully connected to ${this.connectionConfig.host}:${this.connectionConfig.port}`
        });
      });

      conn.on('error', (err) => {
        clearTimeout(timeout);
        cleanup();
        console.error('[SSH] Connection test failed:', err.message);
        resolve({
          success: false,
          message: `Connection failed: ${err.message}`
        });
      });

      try {
        console.log(`[SSH] Testing connection to ${this.connectionConfig.host}:${this.connectionConfig.port}...`);
        conn.connect(this.connectionConfig);
      } catch (error) {
        clearTimeout(timeout);
        cleanup();
        resolve({
          success: false,
          message: `Connection error: ${error.message}`
        });
      }
    });
  }

  /**
   * Create a new SSH connection
   * @param {string} connectionId - Unique identifier for this connection
   * @returns {Promise<{success: boolean, message: string, connectionId?: string}>}
   */
  async createConnection(connectionId = 'default') {
    if (!this.connectionConfig || !this.connectionConfig.enabled) {
      return {
        success: false,
        message: 'SSH is not enabled or configured'
      };
    }

    if (this.activeConnections.has(connectionId)) {
      return {
        success: true,
        message: 'Connection already active',
        connectionId
      };
    }

    return new Promise((resolve) => {
      const conn = new Client();
      let resolved = false;

      const cleanup = (success = false) => {
        if (!resolved) {
          resolved = true;
          if (!success) {
            conn.end();
          }
        }
      };

      // Set timeout
      const timeout = setTimeout(() => {
        cleanup();
        resolve({
          success: false,
          message: 'Connection timeout (20 seconds)'
        });
      }, 20000);

      conn.on('ready', () => {
        clearTimeout(timeout);
        this.activeConnections.set(connectionId, {
          connection: conn,
          connected: true,
          createdAt: new Date().toISOString()
        });
        
        cleanup(true);
        console.log(`[SSH] Connection '${connectionId}' established successfully`);
        resolve({
          success: true,
          message: `Connection '${connectionId}' established`,
          connectionId
        });
      });

      conn.on('error', (err) => {
        clearTimeout(timeout);
        cleanup();
        console.error(`[SSH] Connection '${connectionId}' failed:`, err.message);
        resolve({
          success: false,
          message: `Connection failed: ${err.message}`
        });
      });

      conn.on('end', () => {
        console.log(`[SSH] Connection '${connectionId}' ended`);
        this.activeConnections.delete(connectionId);
      });

      conn.on('close', () => {
        console.log(`[SSH] Connection '${connectionId}' closed`);
        this.activeConnections.delete(connectionId);
      });

      try {
        console.log(`[SSH] Creating connection '${connectionId}' to ${this.connectionConfig.host}:${this.connectionConfig.port}...`);
        conn.connect(this.connectionConfig);
      } catch (error) {
        clearTimeout(timeout);
        cleanup();
        resolve({
          success: false,
          message: `Connection error: ${error.message}`
        });
      }
    });
  }

  /**
   * Execute a command on SSH server
   * @param {string} command - Command to execute
   * @param {string} connectionId - Connection ID to use
   * @returns {Promise<{success: boolean, output?: string, error?: string}>}
   */
  async executeCommand(command, connectionId = 'default') {
    const connectionInfo = this.activeConnections.get(connectionId);
    
    if (!connectionInfo || !connectionInfo.connected) {
      return {
        success: false,
        error: `No active connection found for '${connectionId}'`
      };
    }

    return new Promise((resolve) => {
      const conn = connectionInfo.connection;
      
      conn.exec(command, (err, stream) => {
        if (err) {
          resolve({
            success: false,
            error: `Command execution failed: ${err.message}`
          });
          return;
        }

        let output = '';
        let errorOutput = '';

        stream.on('close', (code, signal) => {
          console.log(`[SSH] Command executed with code ${code}, signal ${signal}`);
          resolve({
            success: code === 0,
            output: output.trim(),
            error: errorOutput.trim() || (code !== 0 ? `Command exited with code ${code}` : undefined)
          });
        });

        stream.on('data', (data) => {
          output += data.toString();
        });

        stream.stderr.on('data', (data) => {
          errorOutput += data.toString();
        });
      });
    });
  }

  /**
   * Download a JSONL file from remote SSH server
   * @param {string} remotePath - Path to the JSONL file on remote server
   * @param {string} localPath - Local path to save the file
   * @param {string} connectionId - Connection ID to use
   * @returns {Promise<{success: boolean, message: string, localPath?: string, fileSize?: number}>}
   */
  async downloadJsonl(remotePath, localPath, connectionId = 'default') {
    const connectionInfo = this.activeConnections.get(connectionId);
    
    if (!connectionInfo || !connectionInfo.connected) {
      return {
        success: false,
        message: `No active connection found for '${connectionId}'`
      };
    }

    return new Promise((resolve) => {
      const conn = connectionInfo.connection;
      
      // Ensure local directory exists
      const localDir = path.dirname(localPath);
      fs.mkdir(localDir, { recursive: true }).then(() => {
        
        conn.sftp((err, sftp) => {
          if (err) {
            resolve({
              success: false,
              message: `SFTP connection failed: ${err.message}`
            });
            return;
          }

          console.log(`[SSH] Downloading ${remotePath} to ${localPath}...`);
          
          const readStream = sftp.createReadStream(remotePath);
          const writeStream = require('fs').createWriteStream(localPath);
          
          let downloadedBytes = 0;
          let lastProgress = 0;

          readStream.on('data', (chunk) => {
            downloadedBytes += chunk.length;
            const progressMB = Math.floor(downloadedBytes / (1024 * 1024));
            
            // Log progress every MB
            if (progressMB > lastProgress) {
              console.log(`[SSH] Downloaded ${progressMB} MB...`);
              lastProgress = progressMB;
            }
          });

          readStream.on('error', (err) => {
            console.error('[SSH] Download failed:', err.message);
            writeStream.destroy();
            resolve({
              success: false,
              message: `Download failed: ${err.message}`
            });
          });

          writeStream.on('error', (err) => {
            console.error('[SSH] Write failed:', err.message);
            readStream.destroy();
            resolve({
              success: false,
              message: `Write failed: ${err.message}`
            });
          });

          writeStream.on('finish', () => {
            console.log(`[SSH] Download completed: ${localPath} (${downloadedBytes} bytes)`);
            resolve({
              success: true,
              message: `Successfully downloaded ${path.basename(remotePath)}`,
              localPath,
              fileSize: downloadedBytes
            });
          });

          readStream.pipe(writeStream);
        });
        
      }).catch((err) => {
        resolve({
          success: false,
          message: `Failed to create local directory: ${err.message}`
        });
      });
    });
  }

  /**
   * List files in remote directory
   * @param {string} remotePath - Remote directory path
   * @param {string} connectionId - Connection ID to use
   * @returns {Promise<{success: boolean, files?: Array, message?: string}>}
   */
  async listRemoteFiles(remotePath, connectionId = 'default') {
    const connectionInfo = this.activeConnections.get(connectionId);
    
    if (!connectionInfo || !connectionInfo.connected) {
      return {
        success: false,
        message: `No active connection found for '${connectionId}'`
      };
    }

    return new Promise((resolve) => {
      const conn = connectionInfo.connection;
      
      conn.sftp((err, sftp) => {
        if (err) {
          resolve({
            success: false,
            message: `SFTP connection failed: ${err.message}`
          });
          return;
        }

        sftp.readdir(remotePath, (err, list) => {
          if (err) {
            resolve({
              success: false,
              message: `Failed to list directory: ${err.message}`
            });
            return;
          }

          const files = list.map(item => ({
            name: item.filename,
            size: item.attrs.size,
            isDirectory: item.attrs.isDirectory(),
            isFile: item.attrs.isFile(),
            modified: new Date(item.attrs.mtime * 1000).toISOString(),
            permissions: item.attrs.mode
          }));

          resolve({
            success: true,
            files: files.filter(f => f.isFile && f.name.endsWith('.jsonl')), // Only JSONL files
            message: `Found ${files.length} files in ${remotePath}`
          });
        });
      });
    });
  }

  /**
   * Close a specific SSH connection
   * @param {string} connectionId - Connection ID to close
   * @returns {boolean} - Whether the connection was closed
   */
  closeConnection(connectionId = 'default') {
    const connectionInfo = this.activeConnections.get(connectionId);
    
    if (connectionInfo) {
      console.log(`[SSH] Closing connection '${connectionId}'`);
      connectionInfo.connection.end();
      this.activeConnections.delete(connectionId);
      return true;
    }
    
    return false;
  }

  /**
   * Close all SSH connections
   */
  closeAllConnections() {
    console.log(`[SSH] Closing all connections (${this.activeConnections.size} active)`);
    
    for (const [connectionId, connectionInfo] of this.activeConnections) {
      connectionInfo.connection.end();
    }
    
    this.activeConnections.clear();
  }

  /**
   * Get information about active connections
   * @returns {Array} Array of connection info
   */
  getActiveConnections() {
    const connections = [];
    
    for (const [connectionId, connectionInfo] of this.activeConnections) {
      connections.push({
        id: connectionId,
        connected: connectionInfo.connected,
        createdAt: connectionInfo.createdAt,
        host: this.connectionConfig?.host,
        port: this.connectionConfig?.port
      });
    }
    
    return connections;
  }

  /**
   * Check if SSH is configured and enabled
   * @returns {boolean}
   */
  isEnabled() {
    return this.connectionConfig && this.connectionConfig.enabled;
  }

  /**
   * Get current SSH configuration (without password)
   * @returns {Object} Configuration object
   */
  getConfig() {
    if (!this.connectionConfig) {
      return null;
    }

    return {
      host: this.connectionConfig.host,
      port: this.connectionConfig.port,
      username: this.connectionConfig.username,
      enabled: this.connectionConfig.enabled
    };
  }
}

// Create singleton instance
const sshService = new SshService();

module.exports = {
  SshService,
  sshService
};
