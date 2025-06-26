/**
 * TypeScript interfaces for SSH Service
 * Used by Dragon UI frontend components
 */

export interface SshConfig {
  enabled: boolean;
  ip: string;
  port: number;
  username: string;
  password: string;
}

export interface SshConnectionResult {
  success: boolean;
  message: string;
  connectionId?: string;
}

export interface SshTestResult {
  success: boolean;
  message: string;
}

export interface SshCommandResult {
  success: boolean;
  output?: string;
  error?: string;
}

export interface SshDownloadResult {
  success: boolean;
  message: string;
  localPath?: string;
  fileSize?: number;
}

export interface RemoteFile {
  name: string;
  size: number;
  isDirectory: boolean;
  isFile: boolean;
  modified: string;
  permissions: number;
}

export interface SshListResult {
  success: boolean;
  files?: RemoteFile[];
  message?: string;
}

export interface ActiveConnection {
  id: string;
  connected: boolean;
  createdAt: string;
  host?: string;
  port?: number;
}

/**
 * SSH Service API interface for use in Electron main process
 */
export interface ISshService {
  setConfig(config: SshConfig): void;
  testConnection(): Promise<SshTestResult>;
  createConnection(connectionId?: string): Promise<SshConnectionResult>;
  executeCommand(command: string, connectionId?: string): Promise<SshCommandResult>;
  downloadJsonl(remotePath: string, localPath: string, connectionId?: string): Promise<SshDownloadResult>;
  listRemoteFiles(remotePath: string, connectionId?: string): Promise<SshListResult>;
  closeConnection(connectionId?: string): boolean;
  closeAllConnections(): void;
  getActiveConnections(): ActiveConnection[];
  isEnabled(): boolean;
  getConfig(): Omit<SshConfig, 'password'> | null;
}

/**
 * Common SSH operations for Dragon UI
 */
export interface DragonSshOperations {
  // Test connection with current config
  testConnection(): Promise<SshTestResult>;
  
  // Connect and download Claude conversation JSONL files
  downloadClaudeConversations(remotePath: string, localPath?: string): Promise<SshDownloadResult>;
  
  // List available JSONL files on remote server
  listAvailableConversations(remotePath?: string): Promise<SshListResult>;
  
  // Download and import JSONL data into Dragon UI
  importRemoteConversations(remotePath: string): Promise<{
    success: boolean;
    message: string;
    imported?: number;
    errors?: string[];
  }>;
  
  // Sync remote JSONL files to local Dragon UI database
  syncRemoteData(remotePath: string, options?: {
    autoImport?: boolean;
    backupExisting?: boolean;
    overwriteLocal?: boolean;
  }): Promise<{
    success: boolean;
    message: string;
    downloaded?: number;
    imported?: number;
    errors?: string[];
  }>;
}
