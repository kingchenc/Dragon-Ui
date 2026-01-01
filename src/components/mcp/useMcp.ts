/**
 * MCP Store
 * Zustand store for managing MCP servers and tools
 */

import { create } from 'zustand';
import {
  MCPServer,
  MCPServerConfig,
  MCPTool,
  MCPResource,
  MCPPrompt,
  MCPLogEntry,
  MCPToolResult,
  MCPResourceResult,
  MCPPromptResult,
  MCPServerStatus
} from './types';

// ElectronAPI type declaration
declare global {
  interface Window {
    electronAPI?: {
      mcpGetServers: () => Promise<{ success: boolean; servers?: MCPServer[]; error?: string }>;
      mcpAddServer: (config: Partial<MCPServerConfig>) => Promise<{ success: boolean; server?: MCPServer; error?: string }>;
      mcpUpdateServer: (id: string, updates: Partial<MCPServerConfig>) => Promise<{ success: boolean; server?: MCPServer; error?: string }>;
      mcpRemoveServer: (id: string) => Promise<{ success: boolean; error?: string }>;
      mcpConnect: (id: string) => Promise<{ success: boolean; error?: string }>;
      mcpDisconnect: (id: string) => Promise<{ success: boolean; error?: string }>;
      mcpSetAutoConnect: (id: string, enabled: boolean) => Promise<{ success: boolean; error?: string }>;
      mcpGetServerInfo: (id: string) => Promise<{ success: boolean; server?: MCPServer; error?: string }>;
      mcpExecuteTool: (serverId: string, toolName: string, args: Record<string, unknown>) => Promise<{ success: boolean; result?: MCPToolResult; error?: string }>;
      mcpReadResource: (serverId: string, uri: string) => Promise<{ success: boolean; result?: MCPResourceResult; error?: string }>;
      mcpGetPrompt: (serverId: string, promptName: string, args: Record<string, unknown>) => Promise<{ success: boolean; result?: MCPPromptResult; error?: string }>;
      mcpGetAllTools: () => Promise<{ success: boolean; tools?: MCPTool[]; error?: string }>;
      mcpGetAllResources: () => Promise<{ success: boolean; resources?: MCPResource[]; error?: string }>;
      mcpGetAllPrompts: () => Promise<{ success: boolean; prompts?: MCPPrompt[]; error?: string }>;
      onMcpServerStatus: (callback: (data: { serverId: string; status: MCPServerStatus }) => void) => void;
      onMcpServerCapabilities: (callback: (data: { serverId: string; tools: MCPTool[]; resources: MCPResource[]; prompts: MCPPrompt[] }) => void) => void;
      onMcpServerLog: (callback: (data: { serverId: string; level: string; message: string }) => void) => void;
      onMcpServerError: (callback: (data: { serverId: string; error: string }) => void) => void;
      removeMcpListeners: () => void;
    };
  }
}

interface MCPStore {
  // State
  servers: MCPServer[];
  allTools: MCPTool[];
  allResources: MCPResource[];
  allPrompts: MCPPrompt[];
  logs: MCPLogEntry[];
  isLoading: boolean;
  error: string | null;
  selectedServerId: string | null;

  // Actions
  loadServers: () => Promise<void>;
  addServer: (config: Partial<MCPServerConfig>) => Promise<MCPServer | null>;
  updateServer: (id: string, updates: Partial<MCPServerConfig>) => Promise<boolean>;
  removeServer: (id: string) => Promise<boolean>;
  connectServer: (id: string) => Promise<boolean>;
  disconnectServer: (id: string) => Promise<boolean>;
  setAutoConnect: (id: string, enabled: boolean) => Promise<boolean>;
  refreshServerInfo: (id: string) => Promise<void>;
  refreshAllCapabilities: () => Promise<void>;

  // Tool execution
  executeTool: (serverId: string, toolName: string, args: Record<string, unknown>) => Promise<MCPToolResult | null>;
  readResource: (serverId: string, uri: string) => Promise<MCPResourceResult | null>;
  getPrompt: (serverId: string, promptName: string, args: Record<string, unknown>) => Promise<MCPPromptResult | null>;

  // UI state
  setSelectedServer: (id: string | null) => void;
  addLog: (entry: MCPLogEntry) => void;
  clearLogs: (serverId?: string) => void;
  clearError: () => void;

  // Event handlers
  handleServerStatus: (data: { serverId: string; status: MCPServerStatus }) => void;
  handleServerCapabilities: (data: { serverId: string; tools: MCPTool[]; resources: MCPResource[]; prompts: MCPPrompt[] }) => void;
  handleServerLog: (data: { serverId: string; level: string; message: string }) => void;
  handleServerError: (data: { serverId: string; error: string }) => void;

  // Initialize event listeners
  initializeListeners: () => void;
  cleanupListeners: () => void;
}

export const useMcpStore = create<MCPStore>()((set, get) => ({
  servers: [],
  allTools: [],
  allResources: [],
  allPrompts: [],
  logs: [],
  isLoading: false,
  error: null,
  selectedServerId: null,

  loadServers: async () => {
    if (!window.electronAPI) {
      set({ error: 'Electron API not available' });
      return;
    }

    set({ isLoading: true, error: null });

    try {
      const result = await window.electronAPI.mcpGetServers();
      if (result.success && result.servers) {
        set({ servers: result.servers, isLoading: false });
        // Also refresh all capabilities
        await get().refreshAllCapabilities();
      } else {
        set({ error: result.error || 'Failed to load servers', isLoading: false });
      }
    } catch (error) {
      set({ error: String(error), isLoading: false });
    }
  },

  addServer: async (config) => {
    if (!window.electronAPI) {
      set({ error: 'Electron API not available' });
      return null;
    }

    set({ isLoading: true, error: null });

    try {
      const result = await window.electronAPI.mcpAddServer(config);
      if (result.success && result.server) {
        set(state => ({
          servers: [...state.servers, result.server!],
          isLoading: false
        }));
        return result.server;
      } else {
        set({ error: result.error || 'Failed to add server', isLoading: false });
        return null;
      }
    } catch (error) {
      set({ error: String(error), isLoading: false });
      return null;
    }
  },

  updateServer: async (id, updates) => {
    if (!window.electronAPI) {
      set({ error: 'Electron API not available' });
      return false;
    }

    try {
      const result = await window.electronAPI.mcpUpdateServer(id, updates);
      if (result.success && result.server) {
        set(state => ({
          servers: state.servers.map(s => s.id === id ? result.server! : s)
        }));
        return true;
      }
      set({ error: result.error || 'Failed to update server' });
      return false;
    } catch (error) {
      set({ error: String(error) });
      return false;
    }
  },

  removeServer: async (id) => {
    if (!window.electronAPI) {
      set({ error: 'Electron API not available' });
      return false;
    }

    try {
      const result = await window.electronAPI.mcpRemoveServer(id);
      if (result.success) {
        set(state => ({
          servers: state.servers.filter(s => s.id !== id),
          logs: state.logs.filter(l => l.serverId !== id),
          selectedServerId: state.selectedServerId === id ? null : state.selectedServerId
        }));
        return true;
      }
      set({ error: result.error || 'Failed to remove server' });
      return false;
    } catch (error) {
      set({ error: String(error) });
      return false;
    }
  },

  connectServer: async (id) => {
    if (!window.electronAPI) {
      set({ error: 'Electron API not available' });
      return false;
    }

    // Update status to connecting
    set(state => ({
      servers: state.servers.map(s =>
        s.id === id ? { ...s, status: 'connecting' as MCPServerStatus } : s
      )
    }));

    try {
      const result = await window.electronAPI.mcpConnect(id);
      if (!result.success) {
        set(state => ({
          servers: state.servers.map(s =>
            s.id === id ? { ...s, status: 'error' as MCPServerStatus, error: result.error || 'Connection failed' } : s
          ),
          error: result.error || 'Failed to connect'
        }));
        return false;
      }
      return true;
    } catch (error) {
      set(state => ({
        servers: state.servers.map(s =>
          s.id === id ? { ...s, status: 'error' as MCPServerStatus, error: String(error) } : s
        ),
        error: String(error)
      }));
      return false;
    }
  },

  disconnectServer: async (id) => {
    if (!window.electronAPI) {
      set({ error: 'Electron API not available' });
      return false;
    }

    try {
      const result = await window.electronAPI.mcpDisconnect(id);
      if (result.success) {
        set(state => ({
          servers: state.servers.map(s =>
            s.id === id ? { ...s, status: 'disconnected' as MCPServerStatus, tools: [], resources: [], prompts: [] } : s
          )
        }));
        await get().refreshAllCapabilities();
        return true;
      }
      set({ error: result.error || 'Failed to disconnect' });
      return false;
    } catch (error) {
      set({ error: String(error) });
      return false;
    }
  },

  setAutoConnect: async (id, enabled) => {
    if (!window.electronAPI) return false;

    try {
      const result = await window.electronAPI.mcpSetAutoConnect(id, enabled);
      if (result.success) {
        set(state => ({
          servers: state.servers.map(s =>
            s.id === id ? { ...s, autoConnect: enabled } : s
          )
        }));
        return true;
      }
      return false;
    } catch {
      return false;
    }
  },

  refreshServerInfo: async (id) => {
    if (!window.electronAPI) return;

    try {
      const result = await window.electronAPI.mcpGetServerInfo(id);
      if (result.success && result.server) {
        set(state => ({
          servers: state.servers.map(s => s.id === id ? result.server! : s)
        }));
      }
    } catch (error) {
      console.error('[MCP] Failed to refresh server info:', error);
    }
  },

  refreshAllCapabilities: async () => {
    if (!window.electronAPI) return;

    try {
      const [toolsResult, resourcesResult, promptsResult] = await Promise.all([
        window.electronAPI.mcpGetAllTools(),
        window.electronAPI.mcpGetAllResources(),
        window.electronAPI.mcpGetAllPrompts()
      ]);

      set({
        allTools: toolsResult.success ? toolsResult.tools || [] : [],
        allResources: resourcesResult.success ? resourcesResult.resources || [] : [],
        allPrompts: promptsResult.success ? promptsResult.prompts || [] : []
      });
    } catch (error) {
      console.error('[MCP] Failed to refresh capabilities:', error);
    }
  },

  executeTool: async (serverId, toolName, args) => {
    if (!window.electronAPI) {
      set({ error: 'Electron API not available' });
      return null;
    }

    try {
      const result = await window.electronAPI.mcpExecuteTool(serverId, toolName, args);
      if (result.success && result.result) {
        return result.result;
      }
      set({ error: result.error || 'Failed to execute tool' });
      return null;
    } catch (error) {
      set({ error: String(error) });
      return null;
    }
  },

  readResource: async (serverId, uri) => {
    if (!window.electronAPI) {
      set({ error: 'Electron API not available' });
      return null;
    }

    try {
      const result = await window.electronAPI.mcpReadResource(serverId, uri);
      if (result.success && result.result) {
        return result.result;
      }
      set({ error: result.error || 'Failed to read resource' });
      return null;
    } catch (error) {
      set({ error: String(error) });
      return null;
    }
  },

  getPrompt: async (serverId, promptName, args) => {
    if (!window.electronAPI) {
      set({ error: 'Electron API not available' });
      return null;
    }

    try {
      const result = await window.electronAPI.mcpGetPrompt(serverId, promptName, args);
      if (result.success && result.result) {
        return result.result;
      }
      set({ error: result.error || 'Failed to get prompt' });
      return null;
    } catch (error) {
      set({ error: String(error) });
      return null;
    }
  },

  setSelectedServer: (id) => {
    set({ selectedServerId: id });
  },

  addLog: (entry) => {
    set(state => ({
      logs: [...state.logs.slice(-999), entry] // Keep last 1000 logs
    }));
  },

  clearLogs: (serverId) => {
    if (serverId) {
      set(state => ({
        logs: state.logs.filter(l => l.serverId !== serverId)
      }));
    } else {
      set({ logs: [] });
    }
  },

  clearError: () => {
    set({ error: null });
  },

  handleServerStatus: (data) => {
    set(state => ({
      servers: state.servers.map(s =>
        s.id === data.serverId ? { ...s, status: data.status } : s
      )
    }));

    // Refresh capabilities when a server connects
    if (data.status === 'connected') {
      get().refreshAllCapabilities();
    }
  },

  handleServerCapabilities: (data) => {
    set(state => ({
      servers: state.servers.map(s =>
        s.id === data.serverId ? { ...s, tools: data.tools, resources: data.resources, prompts: data.prompts } : s
      )
    }));

    get().refreshAllCapabilities();
  },

  handleServerLog: (data) => {
    get().addLog({
      serverId: data.serverId,
      level: data.level as 'info' | 'error' | 'warn' | 'debug',
      message: data.message,
      timestamp: new Date()
    });
  },

  handleServerError: (data) => {
    set(state => ({
      servers: state.servers.map(s =>
        s.id === data.serverId ? { ...s, error: data.error } : s
      )
    }));

    get().addLog({
      serverId: data.serverId,
      level: 'error',
      message: data.error,
      timestamp: new Date()
    });
  },

  initializeListeners: () => {
    if (!window.electronAPI) return;

    window.electronAPI.onMcpServerStatus(get().handleServerStatus);
    window.electronAPI.onMcpServerCapabilities(get().handleServerCapabilities);
    window.electronAPI.onMcpServerLog(get().handleServerLog);
    window.electronAPI.onMcpServerError(get().handleServerError);
  },

  cleanupListeners: () => {
    if (!window.electronAPI) return;
    window.electronAPI.removeMcpListeners();
  }
}));
