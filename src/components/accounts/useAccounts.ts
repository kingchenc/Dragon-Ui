/**
 * Account Store
 * Zustand store for managing API accounts
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  Account,
  AccountProvider,
  AccountProfile,
  AccountSettings,
  AccountUsage,
  PROVIDER_INFO
} from './types';

interface AccountStore {
  // State
  accounts: Account[];
  activeAccountId: string | null;
  usage: Record<string, AccountUsage>;
  isLoading: boolean;
  error: string | null;

  // Actions
  loadAccounts: () => Promise<void>;
  addAccount: (
    name: string,
    provider: AccountProvider,
    apiKey: string,
    profile?: AccountProfile,
    settings?: AccountSettings
  ) => Promise<Account | null>;
  updateAccount: (id: string, updates: Partial<Account>) => Promise<boolean>;
  removeAccount: (id: string) => Promise<boolean>;
  setActiveAccount: (id: string) => Promise<boolean>;
  getActiveAccount: () => Account | null;

  // API key management
  getApiKey: (accountId: string) => Promise<{ apiKey: string; masked: string } | null>;
  updateApiKey: (accountId: string, newKey: string) => Promise<boolean>;

  // Usage
  recordUsage: (accountId: string, cost: number, tokens: number) => void;

  // Import/Export
  exportAccounts: () => Promise<string | null>;
  importAccounts: (data: string, apiKeys: string[]) => Promise<boolean>;

  // Utility
  getProviderInfo: (provider: AccountProvider) => typeof PROVIDER_INFO[AccountProvider];
  clearError: () => void;
}

// ElectronAPI type declaration
declare global {
  interface Window {
    electronAPI?: {
      accountGetAll: () => Promise<{ success: boolean; accounts?: Account[]; error?: string }>;
      accountGetActive: () => Promise<{ success: boolean; account?: Account; error?: string }>;
      accountCreate: (accountData: any, apiKey: string) => Promise<{ success: boolean; account?: Account; error?: string }>;
      accountUpdate: (id: string, updates: Partial<Account>) => Promise<{ success: boolean; account?: Account; error?: string }>;
      accountDelete: (id: string) => Promise<{ success: boolean; error?: string }>;
      accountSetActive: (id: string) => Promise<{ success: boolean; account?: Account; error?: string }>;
      accountGetApiKey: (id: string) => Promise<{ success: boolean; apiKey?: string; masked?: string; error?: string }>;
      accountUpdateApiKey: (id: string, newApiKey: string) => Promise<{ success: boolean; error?: string }>;
      accountGetEnv: () => Promise<{ success: boolean; env?: Record<string, string>; error?: string }>;
      accountExport: () => Promise<{ success: boolean; data?: string; error?: string }>;
      accountImport: (data: string, apiKeys: string[]) => Promise<{ success: boolean; accounts?: Account[]; error?: string }>;
    };
  }
}

export const useAccountStore = create<AccountStore>()(
  persist(
    (set, get) => ({
      accounts: [],
      activeAccountId: null,
      usage: {},
      isLoading: false,
      error: null,

      loadAccounts: async () => {
        if (!window.electronAPI) {
          set({ error: 'Electron API not available' });
          return;
        }

        set({ isLoading: true, error: null });

        try {
          const result = await window.electronAPI.accountGetAll();
          if (result.success && result.accounts) {
            const activeAccount = result.accounts.find(a => a.isActive);
            set({
              accounts: result.accounts,
              activeAccountId: activeAccount?.id || null,
              isLoading: false
            });
          } else {
            set({ error: result.error || 'Failed to load accounts', isLoading: false });
          }
        } catch (error) {
          set({ error: String(error), isLoading: false });
        }
      },

      addAccount: async (name, provider, apiKey, profile, settings) => {
        if (!window.electronAPI) {
          set({ error: 'Electron API not available' });
          return null;
        }

        set({ isLoading: true, error: null });

        try {
          const result = await window.electronAPI.accountCreate(
            { name, provider, profile, settings },
            apiKey
          );

          if (result.success && result.account) {
            set(state => ({
              accounts: [...state.accounts, result.account!],
              isLoading: false
            }));
            return result.account;
          } else {
            set({ error: result.error || 'Failed to create account', isLoading: false });
            return null;
          }
        } catch (error) {
          set({ error: String(error), isLoading: false });
          return null;
        }
      },

      updateAccount: async (id, updates) => {
        if (!window.electronAPI) {
          set({ error: 'Electron API not available' });
          return false;
        }

        set({ isLoading: true, error: null });

        try {
          const result = await window.electronAPI.accountUpdate(id, updates);
          if (result.success && result.account) {
            set(state => ({
              accounts: state.accounts.map(a => a.id === id ? result.account! : a),
              isLoading: false
            }));
            return true;
          } else {
            set({ error: result.error || 'Failed to update account', isLoading: false });
            return false;
          }
        } catch (error) {
          set({ error: String(error), isLoading: false });
          return false;
        }
      },

      removeAccount: async (id) => {
        if (!window.electronAPI) {
          set({ error: 'Electron API not available' });
          return false;
        }

        set({ isLoading: true, error: null });

        try {
          const result = await window.electronAPI.accountDelete(id);
          if (result.success) {
            set(state => {
              const newAccounts = state.accounts.filter(a => a.id !== id);
              const newUsage = { ...state.usage };
              delete newUsage[id];

              return {
                accounts: newAccounts,
                activeAccountId: state.activeAccountId === id ? null : state.activeAccountId,
                usage: newUsage,
                isLoading: false
              };
            });
            return true;
          } else {
            set({ error: result.error || 'Failed to delete account', isLoading: false });
            return false;
          }
        } catch (error) {
          set({ error: String(error), isLoading: false });
          return false;
        }
      },

      setActiveAccount: async (id) => {
        if (!window.electronAPI) {
          set({ error: 'Electron API not available' });
          return false;
        }

        set({ isLoading: true, error: null });

        try {
          const result = await window.electronAPI.accountSetActive(id);
          if (result.success) {
            set(state => ({
              accounts: state.accounts.map(a => ({
                ...a,
                isActive: a.id === id
              })),
              activeAccountId: id,
              isLoading: false
            }));
            return true;
          } else {
            set({ error: result.error || 'Failed to set active account', isLoading: false });
            return false;
          }
        } catch (error) {
          set({ error: String(error), isLoading: false });
          return false;
        }
      },

      getActiveAccount: () => {
        const { accounts, activeAccountId } = get();
        return accounts.find(a => a.id === activeAccountId) || null;
      },

      getApiKey: async (accountId) => {
        if (!window.electronAPI) {
          return null;
        }

        try {
          const result = await window.electronAPI.accountGetApiKey(accountId);
          if (result.success && result.apiKey) {
            return {
              apiKey: result.apiKey,
              masked: result.masked || '***'
            };
          }
          return null;
        } catch {
          return null;
        }
      },

      updateApiKey: async (accountId, newKey) => {
        if (!window.electronAPI) {
          set({ error: 'Electron API not available' });
          return false;
        }

        try {
          const result = await window.electronAPI.accountUpdateApiKey(accountId, newKey);
          return result.success;
        } catch {
          return false;
        }
      },

      recordUsage: (accountId, cost, tokens) => {
        set(state => {
          const existing = state.usage[accountId] || {
            accountId,
            totalCost: 0,
            totalTokens: 0,
            totalSessions: 0,
            dailyUsage: []
          };

          const today = new Date().toISOString().split('T')[0];
          const todayUsage = existing.dailyUsage.find(d => d.date === today);

          let newDailyUsage;
          if (todayUsage) {
            newDailyUsage = existing.dailyUsage.map(d =>
              d.date === today
                ? { ...d, cost: d.cost + cost, tokens: d.tokens + tokens, sessions: d.sessions + 1 }
                : d
            );
          } else {
            newDailyUsage = [...existing.dailyUsage, { date: today, cost, tokens, sessions: 1 }];
          }

          return {
            usage: {
              ...state.usage,
              [accountId]: {
                ...existing,
                totalCost: existing.totalCost + cost,
                totalTokens: existing.totalTokens + tokens,
                totalSessions: existing.totalSessions + 1,
                lastSession: new Date(),
                dailyUsage: newDailyUsage
              }
            }
          };
        });
      },

      exportAccounts: async () => {
        if (!window.electronAPI) {
          return null;
        }

        try {
          const result = await window.electronAPI.accountExport();
          return result.success ? result.data || null : null;
        } catch {
          return null;
        }
      },

      importAccounts: async (data, apiKeys) => {
        if (!window.electronAPI) {
          set({ error: 'Electron API not available' });
          return false;
        }

        set({ isLoading: true, error: null });

        try {
          const result = await window.electronAPI.accountImport(data, apiKeys);
          if (result.success && result.accounts) {
            set(state => ({
              accounts: [...state.accounts, ...result.accounts!],
              isLoading: false
            }));
            return true;
          } else {
            set({ error: result.error || 'Failed to import accounts', isLoading: false });
            return false;
          }
        } catch (error) {
          set({ error: String(error), isLoading: false });
          return false;
        }
      },

      getProviderInfo: (provider) => {
        return PROVIDER_INFO[provider];
      },

      clearError: () => {
        set({ error: null });
      }
    }),
    {
      name: 'dragon-ui-account-usage',
      partialize: (state) => ({
        usage: state.usage
      })
    }
  )
);
