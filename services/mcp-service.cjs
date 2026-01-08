/**
 * MCP (Model Context Protocol) Service
 * Manages MCP server connections and tool execution
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');
const EventEmitter = require('events');

// MCP Server status constants
const ServerStatus = {
  DISCONNECTED: 'disconnected',
  CONNECTING: 'connecting',
  CONNECTED: 'connected',
  ERROR: 'error'
};

// Built-in MCP server templates
const BUILTIN_SERVERS = {
  filesystem: {
    id: 'builtin-filesystem',
    name: 'Filesystem',
    description: 'Access local files and directories',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-filesystem'],
    icon: 'folder',
    builtin: true
  },
  git: {
    id: 'builtin-git',
    name: 'Git',
    description: 'Git repository operations',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-git'],
    icon: 'git-branch',
    builtin: true
  },
  memory: {
    id: 'builtin-memory',
    name: 'Memory',
    description: 'Persistent key-value storage',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-memory'],
    icon: 'database',
    builtin: true
  },
  fetch: {
    id: 'builtin-fetch',
    name: 'Fetch',
    description: 'HTTP fetch capabilities',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-fetch'],
    icon: 'globe',
    builtin: true
  }
};

/**
 * MCP Server Connection
 * Manages a single MCP server connection via stdio
 */
class MCPConnection extends EventEmitter {
  constructor(config) {
    super();
    this.id = config.id;
    this.name = config.name;
    this.description = config.description || '';
    this.command = config.command;
    this.args = config.args || [];
    this.env = config.env || {};
    this.cwd = config.cwd || process.cwd();
    this.icon = config.icon || 'server';
    this.builtin = config.builtin || false;

    this.status = ServerStatus.DISCONNECTED;
    this.process = null;
    this.tools = [];
    this.resources = [];
    this.prompts = [];
    this.error = null;
    this.messageId = 0;
    this.pendingRequests = new Map();
    this.buffer = '';
  }

  /**
   * Connect to the MCP server
   */
  async connect() {
    if (this.status === ServerStatus.CONNECTED || this.status === ServerStatus.CONNECTING) {
      return { success: false, error: 'Already connected or connecting' };
    }

    this.status = ServerStatus.CONNECTING;
    this.error = null;
    this.emit('status', this.status);

    try {
      // Spawn the MCP server process
      const env = {
        ...process.env,
        ...this.env
      };

      this.process = spawn(this.command, this.args, {
        cwd: this.cwd,
        env,
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: process.platform === 'win32'
      });

      // Handle stdout (JSON-RPC messages)
      this.process.stdout.on('data', (data) => {
        this.handleData(data.toString());
      });

      // Handle stderr (logs)
      this.process.stderr.on('data', (data) => {
        const log = data.toString().trim();
        if (log) {
          this.emit('log', { level: 'error', message: log });
        }
      });

      // Handle process exit
      this.process.on('exit', (code, signal) => {
        console.log(`[MCP] Server ${this.name} exited with code ${code}`);
        this.status = ServerStatus.DISCONNECTED;
        this.emit('status', this.status);
        this.emit('exit', { code, signal });
      });

      // Handle process error
      this.process.on('error', (err) => {
        console.error(`[MCP] Server ${this.name} error:`, err.message);
        this.error = err.message;
        this.status = ServerStatus.ERROR;
        this.emit('status', this.status);
        this.emit('error', err);
      });

      // Initialize MCP connection
      await this.initialize();

      this.status = ServerStatus.CONNECTED;
      this.emit('status', this.status);

      // Discover capabilities
      await this.discoverCapabilities();

      return { success: true };
    } catch (err) {
      console.error(`[MCP] Failed to connect to ${this.name}:`, err.message);
      this.error = err.message;
      this.status = ServerStatus.ERROR;
      this.emit('status', this.status);
      return { success: false, error: err.message };
    }
  }

  /**
   * Initialize MCP protocol handshake
   */
  async initialize() {
    const response = await this.sendRequest('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {
        roots: { listChanged: true },
        sampling: {}
      },
      clientInfo: {
        name: 'Dragon UI',
        version: '1.2.1'
      }
    });

    if (response.error) {
      throw new Error(response.error.message || 'Initialize failed');
    }

    // Send initialized notification
    await this.sendNotification('notifications/initialized');

    return response.result;
  }

  /**
   * Discover server capabilities (tools, resources, prompts)
   */
  async discoverCapabilities() {
    try {
      // List tools
      const toolsResponse = await this.sendRequest('tools/list', {});
      if (toolsResponse.result?.tools) {
        this.tools = toolsResponse.result.tools;
      }

      // List resources
      const resourcesResponse = await this.sendRequest('resources/list', {});
      if (resourcesResponse.result?.resources) {
        this.resources = resourcesResponse.result.resources;
      }

      // List prompts
      const promptsResponse = await this.sendRequest('prompts/list', {});
      if (promptsResponse.result?.prompts) {
        this.prompts = promptsResponse.result.prompts;
      }

      this.emit('capabilities', {
        tools: this.tools,
        resources: this.resources,
        prompts: this.prompts
      });
    } catch (err) {
      console.warn(`[MCP] Could not discover capabilities for ${this.name}:`, err.message);
    }
  }

  /**
   * Handle incoming data from the server
   */
  handleData(data) {
    this.buffer += data;

    // Process complete JSON-RPC messages
    const lines = this.buffer.split('\n');
    this.buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.trim()) continue;

      try {
        const message = JSON.parse(line);

        if (message.id !== undefined && this.pendingRequests.has(message.id)) {
          // Response to a request - clear timeout and resolve
          const { resolve, timeoutId } = this.pendingRequests.get(message.id);
          if (timeoutId) {
            clearTimeout(timeoutId);
          }
          this.pendingRequests.delete(message.id);
          resolve(message);
        } else if (message.method) {
          // Notification or request from server
          this.handleServerMessage(message);
        }
      } catch (err) {
        console.warn(`[MCP] Failed to parse message from ${this.name}:`, line);
      }
    }
  }

  /**
   * Handle messages from the server
   */
  handleServerMessage(message) {
    switch (message.method) {
      case 'notifications/resources/list_changed':
        this.discoverCapabilities();
        break;
      case 'notifications/tools/list_changed':
        this.discoverCapabilities();
        break;
      case 'notifications/prompts/list_changed':
        this.discoverCapabilities();
        break;
      default:
        this.emit('message', message);
    }
  }

  /**
   * Send a JSON-RPC request
   */
  sendRequest(method, params) {
    return new Promise((resolve, reject) => {
      if (!this.process || this.status !== ServerStatus.CONNECTED && this.status !== ServerStatus.CONNECTING) {
        reject(new Error('Not connected'));
        return;
      }

      const id = ++this.messageId;
      const message = {
        jsonrpc: '2.0',
        id,
        method,
        params
      };

      // Store timeout ID with the request so we can clear it
      const timeoutId = setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error('Request timeout'));
        }
      }, 30000);

      // Store resolve, reject, and timeoutId together
      this.pendingRequests.set(id, { resolve, reject, timeoutId });

      try {
        this.process.stdin.write(JSON.stringify(message) + '\n');
      } catch (err) {
        // Clear timeout and remove request on error
        clearTimeout(timeoutId);
        this.pendingRequests.delete(id);
        reject(err);
      }
    });
  }

  /**
   * Send a JSON-RPC notification (no response expected)
   */
  sendNotification(method, params = {}) {
    if (!this.process) return;

    const message = {
      jsonrpc: '2.0',
      method,
      params
    };

    try {
      this.process.stdin.write(JSON.stringify(message) + '\n');
    } catch (err) {
      console.error(`[MCP] Failed to send notification:`, err.message);
    }
  }

  /**
   * Execute a tool
   */
  async executeTool(toolName, args) {
    if (this.status !== ServerStatus.CONNECTED) {
      return { success: false, error: 'Not connected' };
    }

    try {
      const response = await this.sendRequest('tools/call', {
        name: toolName,
        arguments: args
      });

      if (response.error) {
        return { success: false, error: response.error.message };
      }

      return { success: true, result: response.result };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Read a resource
   */
  async readResource(uri) {
    if (this.status !== ServerStatus.CONNECTED) {
      return { success: false, error: 'Not connected' };
    }

    try {
      const response = await this.sendRequest('resources/read', { uri });

      if (response.error) {
        return { success: false, error: response.error.message };
      }

      return { success: true, result: response.result };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Get a prompt
   */
  async getPrompt(promptName, args) {
    if (this.status !== ServerStatus.CONNECTED) {
      return { success: false, error: 'Not connected' };
    }

    try {
      const response = await this.sendRequest('prompts/get', {
        name: promptName,
        arguments: args
      });

      if (response.error) {
        return { success: false, error: response.error.message };
      }

      return { success: true, result: response.result };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Disconnect from the server
   */
  disconnect() {
    if (this.process) {
      try {
        this.process.kill();
      } catch (err) {
        console.warn(`[MCP] Error killing process for ${this.name}:`, err.message);
      }
      this.process = null;
    }

    this.status = ServerStatus.DISCONNECTED;
    this.tools = [];
    this.resources = [];
    this.prompts = [];
    this.pendingRequests.clear();
    this.emit('status', this.status);
  }

  /**
   * Get server info
   */
  getInfo() {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      command: this.command,
      args: this.args,
      icon: this.icon,
      builtin: this.builtin,
      status: this.status,
      error: this.error,
      tools: this.tools,
      resources: this.resources,
      prompts: this.prompts
    };
  }
}

/**
 * MCP Service
 * Manages multiple MCP server connections
 */
class MCPService extends EventEmitter {
  constructor() {
    super();
    this.connections = new Map();
    this.configPath = path.join(os.homedir(), '.dragon-ui-mcp.json');
    this.config = {
      servers: [],
      autoConnect: []
    };
  }

  /**
   * Initialize the service
   */
  async initialize() {
    await this.loadConfig();

    // Auto-connect to configured servers
    for (const serverId of this.config.autoConnect) {
      const serverConfig = this.config.servers.find(s => s.id === serverId);
      if (serverConfig) {
        this.connect(serverId);
      }
    }

    return { success: true };
  }

  /**
   * Load configuration from file
   */
  async loadConfig() {
    try {
      if (fs.existsSync(this.configPath)) {
        const data = fs.readFileSync(this.configPath, 'utf8');
        this.config = JSON.parse(data);
      }
    } catch (err) {
      console.warn('[MCP] Failed to load config:', err.message);
      this.config = { servers: [], autoConnect: [] };
    }
  }

  /**
   * Save configuration to file
   */
  async saveConfig() {
    try {
      fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2));
      return { success: true };
    } catch (err) {
      console.error('[MCP] Failed to save config:', err.message);
      return { success: false, error: err.message };
    }
  }

  /**
   * Get all available servers (built-in + custom)
   */
  getAllServers() {
    const servers = [];

    // Add built-in servers
    for (const [key, server] of Object.entries(BUILTIN_SERVERS)) {
      const connection = this.connections.get(server.id);
      servers.push({
        ...server,
        status: connection?.status || ServerStatus.DISCONNECTED,
        error: connection?.error || null,
        tools: connection?.tools || [],
        resources: connection?.resources || [],
        prompts: connection?.prompts || []
      });
    }

    // Add custom servers
    for (const serverConfig of this.config.servers) {
      const connection = this.connections.get(serverConfig.id);
      servers.push({
        ...serverConfig,
        builtin: false,
        status: connection?.status || ServerStatus.DISCONNECTED,
        error: connection?.error || null,
        tools: connection?.tools || [],
        resources: connection?.resources || [],
        prompts: connection?.prompts || []
      });
    }

    return servers;
  }

  /**
   * Add a custom server configuration
   */
  addServer(serverConfig) {
    const id = `custom-${Date.now()}`;
    const server = {
      id,
      name: serverConfig.name,
      description: serverConfig.description || '',
      command: serverConfig.command,
      args: serverConfig.args || [],
      env: serverConfig.env || {},
      cwd: serverConfig.cwd || '',
      icon: serverConfig.icon || 'server',
      builtin: false
    };

    this.config.servers.push(server);
    this.saveConfig();

    return { success: true, server };
  }

  /**
   * Update a custom server configuration
   */
  updateServer(serverId, updates) {
    const index = this.config.servers.findIndex(s => s.id === serverId);
    if (index === -1) {
      return { success: false, error: 'Server not found' };
    }

    this.config.servers[index] = {
      ...this.config.servers[index],
      ...updates,
      id: serverId // Preserve ID
    };

    this.saveConfig();

    return { success: true, server: this.config.servers[index] };
  }

  /**
   * Remove a custom server configuration
   */
  removeServer(serverId) {
    // Disconnect first
    this.disconnect(serverId);

    const index = this.config.servers.findIndex(s => s.id === serverId);
    if (index === -1) {
      return { success: false, error: 'Server not found' };
    }

    this.config.servers.splice(index, 1);
    this.config.autoConnect = this.config.autoConnect.filter(id => id !== serverId);
    this.saveConfig();

    return { success: true };
  }

  /**
   * Connect to an MCP server
   */
  async connect(serverId) {
    // Get server config
    let serverConfig = Object.values(BUILTIN_SERVERS).find(s => s.id === serverId);
    if (!serverConfig) {
      serverConfig = this.config.servers.find(s => s.id === serverId);
    }

    if (!serverConfig) {
      return { success: false, error: 'Server not found' };
    }

    // Create connection if it doesn't exist
    let connection = this.connections.get(serverId);
    if (!connection) {
      connection = new MCPConnection(serverConfig);

      // Forward events
      connection.on('status', (status) => {
        this.emit('server-status', { serverId, status });
      });
      connection.on('capabilities', (caps) => {
        this.emit('server-capabilities', { serverId, ...caps });
      });
      connection.on('log', (log) => {
        this.emit('server-log', { serverId, ...log });
      });
      connection.on('error', (err) => {
        this.emit('server-error', { serverId, error: err.message });
      });

      this.connections.set(serverId, connection);
    }

    return await connection.connect();
  }

  /**
   * Disconnect from an MCP server
   */
  disconnect(serverId) {
    const connection = this.connections.get(serverId);
    if (connection) {
      connection.disconnect();
      return { success: true };
    }
    return { success: false, error: 'Server not connected' };
  }

  /**
   * Set auto-connect for a server
   */
  setAutoConnect(serverId, enabled) {
    if (enabled) {
      if (!this.config.autoConnect.includes(serverId)) {
        this.config.autoConnect.push(serverId);
      }
    } else {
      this.config.autoConnect = this.config.autoConnect.filter(id => id !== serverId);
    }
    this.saveConfig();
    return { success: true };
  }

  /**
   * Get server info
   */
  getServerInfo(serverId) {
    const connection = this.connections.get(serverId);
    if (connection) {
      return connection.getInfo();
    }

    // Return config info for disconnected servers
    let serverConfig = Object.values(BUILTIN_SERVERS).find(s => s.id === serverId);
    if (!serverConfig) {
      serverConfig = this.config.servers.find(s => s.id === serverId);
    }

    if (serverConfig) {
      return {
        ...serverConfig,
        status: ServerStatus.DISCONNECTED,
        tools: [],
        resources: [],
        prompts: []
      };
    }

    return null;
  }

  /**
   * Execute a tool on a connected server
   */
  async executeTool(serverId, toolName, args) {
    const connection = this.connections.get(serverId);
    if (!connection) {
      return { success: false, error: 'Server not connected' };
    }
    return await connection.executeTool(toolName, args);
  }

  /**
   * Read a resource from a connected server
   */
  async readResource(serverId, uri) {
    const connection = this.connections.get(serverId);
    if (!connection) {
      return { success: false, error: 'Server not connected' };
    }
    return await connection.readResource(uri);
  }

  /**
   * Get a prompt from a connected server
   */
  async getPrompt(serverId, promptName, args) {
    const connection = this.connections.get(serverId);
    if (!connection) {
      return { success: false, error: 'Server not connected' };
    }
    return await connection.getPrompt(promptName, args);
  }

  /**
   * Get all available tools from all connected servers
   */
  getAllTools() {
    const tools = [];
    for (const [serverId, connection] of this.connections) {
      if (connection.status === ServerStatus.CONNECTED) {
        for (const tool of connection.tools) {
          tools.push({
            ...tool,
            serverId,
            serverName: connection.name
          });
        }
      }
    }
    return tools;
  }

  /**
   * Get all available resources from all connected servers
   */
  getAllResources() {
    const resources = [];
    for (const [serverId, connection] of this.connections) {
      if (connection.status === ServerStatus.CONNECTED) {
        for (const resource of connection.resources) {
          resources.push({
            ...resource,
            serverId,
            serverName: connection.name
          });
        }
      }
    }
    return resources;
  }

  /**
   * Get all available prompts from all connected servers
   */
  getAllPrompts() {
    const prompts = [];
    for (const [serverId, connection] of this.connections) {
      if (connection.status === ServerStatus.CONNECTED) {
        for (const prompt of connection.prompts) {
          prompts.push({
            ...prompt,
            serverId,
            serverName: connection.name
          });
        }
      }
    }
    return prompts;
  }

  /**
   * Shutdown all connections
   */
  shutdown() {
    for (const [serverId, connection] of this.connections) {
      connection.disconnect();
    }
    this.connections.clear();
  }
}

// Export service
module.exports = {
  MCPService,
  MCPConnection,
  ServerStatus,
  BUILTIN_SERVERS
};
