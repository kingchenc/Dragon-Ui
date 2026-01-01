/**
 * Account Types
 * Type definitions for the account switcher system
 */

export type AccountProvider = 'anthropic' | 'openai' | 'zhipu' | 'google' | 'custom';

export interface Account {
  id: string;
  name: string;
  provider: AccountProvider;
  apiKeyId: string; // Reference to secure storage, not the actual key
  isActive: boolean;
  createdAt: Date;
  lastUsed?: Date;
  profile?: AccountProfile;
  settings?: AccountSettings;
}

export interface AccountProfile {
  type: 'personal' | 'work' | 'development' | 'testing' | 'custom';
  color?: string;
  icon?: string;
  description?: string;
}

export interface AccountSettings {
  defaultModel?: string;
  maxTokens?: number;
  temperature?: number;
  autoSwitch?: boolean;
  envVarName?: string; // Custom env var name for terminal injection
}

export interface AccountUsage {
  accountId: string;
  totalCost: number;
  totalTokens: number;
  totalSessions: number;
  lastSession?: Date;
  dailyUsage: Array<{
    date: string;
    cost: number;
    tokens: number;
    sessions: number;
  }>;
}

export const PROVIDER_INFO: Record<AccountProvider, {
  name: string;
  envVar: string;
  icon: string;
  color: string;
  models: string[];
}> = {
  anthropic: {
    name: 'Anthropic',
    envVar: 'ANTHROPIC_API_KEY',
    icon: 'anthropic',
    color: '#D4A27F',
    models: ['claude-opus-4.5', 'claude-sonnet-4.5', 'claude-haiku-4.5', 'claude-sonnet-4', 'claude-opus-4']
  },
  openai: {
    name: 'OpenAI',
    envVar: 'OPENAI_API_KEY',
    icon: 'openai',
    color: '#10A37F',
    models: ['gpt-5', 'gpt-5-codex', 'gpt-4.5-preview', 'gpt-4o', 'gpt-4o-mini']
  },
  zhipu: {
    name: 'Zhipu AI',
    envVar: 'ZHIPU_API_KEY',
    icon: 'zhipu',
    color: '#4A90D9',
    models: ['glm-4.7', 'glm-4.6v', 'glm-4.6', 'glm-4']
  },
  google: {
    name: 'Google AI',
    envVar: 'GOOGLE_API_KEY',
    icon: 'google',
    color: '#4285F4',
    models: ['gemini-2.0-flash', 'gemini-2.0-pro', 'gemini-1.5-pro']
  },
  custom: {
    name: 'Custom',
    envVar: 'CUSTOM_API_KEY',
    icon: 'settings',
    color: '#6B7280',
    models: []
  }
};

export const PROFILE_PRESETS: Record<string, AccountProfile> = {
  personal: {
    type: 'personal',
    color: '#10B981',
    icon: 'user',
    description: 'Personal use account'
  },
  work: {
    type: 'work',
    color: '#3B82F6',
    icon: 'briefcase',
    description: 'Work/business account'
  },
  development: {
    type: 'development',
    color: '#8B5CF6',
    icon: 'code',
    description: 'Development and testing'
  },
  testing: {
    type: 'testing',
    color: '#F59E0B',
    icon: 'flask',
    description: 'Testing and experiments'
  }
};

export interface AccountStoreState {
  accounts: Account[];
  activeAccountId: string | null;
  usage: Map<string, AccountUsage>;
  isLoading: boolean;
  error: string | null;
}

export interface AccountStoreActions {
  // Account CRUD
  addAccount: (account: Omit<Account, 'id' | 'createdAt' | 'apiKeyId'>, apiKey: string) => Promise<Account | null>;
  updateAccount: (id: string, updates: Partial<Account>) => Promise<boolean>;
  removeAccount: (id: string) => Promise<boolean>;

  // Active account
  setActiveAccount: (id: string) => Promise<boolean>;
  getActiveAccount: () => Account | null;

  // API key management
  getApiKey: (accountId: string) => Promise<string | null>;
  updateApiKey: (accountId: string, newKey: string) => Promise<boolean>;

  // Usage tracking
  recordUsage: (accountId: string, cost: number, tokens: number) => void;
  getAccountUsage: (accountId: string) => AccountUsage | null;

  // Import/Export
  exportAccounts: () => Promise<string>;
  importAccounts: (data: string) => Promise<boolean>;

  // Loading
  loadAccounts: () => Promise<void>;
}
