/**
 * Terminal Store
 * Zustand store for managing terminal state
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  TerminalTab,
  TerminalConfig,
  ShellInfo,
  TerminalSessionInfo,
  DEFAULT_TERMINAL_CONFIG
} from './types';

interface TerminalStore {
  // State
  tabs: TerminalTab[];
  activeTabId: string | null;
  config: TerminalConfig;
  availableShells: ShellInfo[];
  isLoading: boolean;
  isVisible: boolean;
  panelHeight: number;

  // Actions
  addTab: (shell?: string) => Promise<TerminalTab | null>;
  removeTab: (id: string) => void;
  setActiveTab: (id: string) => void;
  updateTabTitle: (id: string, title: string) => void;
  markTabClosed: (id: string) => void;

  // Config
  updateConfig: (config: Partial<TerminalConfig>) => void;

  // Shell management
  loadAvailableShells: () => Promise<void>;

  // Panel
  toggleVisibility: () => void;
  setVisibility: (visible: boolean) => void;
  setPanelHeight: (height: number) => void;
}

// ElectronAPI type declaration
declare global {
  interface Window {
    electronAPI?: {
      terminalGetShells: () => Promise<{ success: boolean; shells?: ShellInfo[] }>;
      terminalCreate: (options: { shell: string; cwd?: string }) => Promise<{
        success: boolean;
        session?: TerminalSessionInfo;
        error?: string;
      }>;
      terminalWrite: (id: string, data: string) => Promise<{ success: boolean }>;
      terminalResize: (id: string, cols: number, rows: number) => Promise<{ success: boolean }>;
      terminalDestroy: (id: string) => Promise<{ success: boolean }>;
      terminalList: () => Promise<{ success: boolean; sessions?: TerminalSessionInfo[] }>;
      terminalGetInfo: (id: string) => Promise<{
        success: boolean;
        session?: TerminalSessionInfo;
      }>;
      onTerminalData: (callback: (data: { id: string; data: string }) => void) => void;
      onTerminalExit: (callback: (data: { id: string; code?: number; signal?: string }) => void) => void;
      removeTerminalListeners: () => void;
    };
  }
}

export const useTerminalStore = create<TerminalStore>()(
  persist(
    (set, get) => ({
      tabs: [],
      activeTabId: null,
      config: DEFAULT_TERMINAL_CONFIG,
      availableShells: [],
      isLoading: false,
      isVisible: false,
      panelHeight: 300,

      addTab: async (shell?: string) => {
        const { config, tabs, availableShells } = get();
        const shellToUse = shell || config.defaultShell;

        if (!window.electronAPI) {
          console.error('[TERM] Electron API not available');
          return null;
        }

        set({ isLoading: true });

        try {
          const result = await window.electronAPI.terminalCreate({
            shell: shellToUse
          });

          if (result.success && result.session) {
            const shellInfo = availableShells.find(s => s.id === shellToUse);
            const newTab: TerminalTab = {
              id: result.session.id,
              title: shellInfo?.name || shellToUse,
              shell: shellToUse,
              isActive: true,
              isClosed: false
            };

            // Deactivate other tabs
            const updatedTabs = tabs.map(t => ({ ...t, isActive: false }));

            set({
              tabs: [...updatedTabs, newTab],
              activeTabId: newTab.id,
              isLoading: false,
              isVisible: true
            });

            return newTab;
          } else {
            console.error('[TERM] Failed to create terminal:', result.error);
            set({ isLoading: false });
            return null;
          }
        } catch (error) {
          console.error('[TERM] Error creating terminal:', error);
          set({ isLoading: false });
          return null;
        }
      },

      removeTab: async (id: string) => {
        const { tabs } = get();

        // Destroy the terminal session
        if (window.electronAPI) {
          await window.electronAPI.terminalDestroy(id);
        }

        const remainingTabs = tabs.filter(t => t.id !== id);
        const newActiveId = remainingTabs.length > 0
          ? remainingTabs[remainingTabs.length - 1].id
          : null;

        // Activate the new tab if needed
        const updatedTabs = remainingTabs.map(t => ({
          ...t,
          isActive: t.id === newActiveId
        }));

        set({
          tabs: updatedTabs,
          activeTabId: newActiveId,
          isVisible: updatedTabs.length > 0
        });
      },

      setActiveTab: (id: string) => {
        const { tabs } = get();
        const updatedTabs = tabs.map(t => ({
          ...t,
          isActive: t.id === id
        }));

        set({
          tabs: updatedTabs,
          activeTabId: id
        });
      },

      updateTabTitle: (id: string, title: string) => {
        const { tabs } = get();
        const updatedTabs = tabs.map(t =>
          t.id === id ? { ...t, title } : t
        );

        set({ tabs: updatedTabs });
      },

      markTabClosed: (id: string) => {
        const { tabs } = get();
        const updatedTabs = tabs.map(t =>
          t.id === id ? { ...t, isClosed: true } : t
        );

        set({ tabs: updatedTabs });
      },

      updateConfig: (newConfig: Partial<TerminalConfig>) => {
        set(state => ({
          config: { ...state.config, ...newConfig }
        }));
      },

      loadAvailableShells: async () => {
        if (!window.electronAPI) {
          console.error('[TERM] Electron API not available');
          return;
        }

        try {
          const result = await window.electronAPI.terminalGetShells();
          if (result.success && result.shells) {
            set({ availableShells: result.shells });
          }
        } catch (error) {
          console.error('[TERM] Error loading shells:', error);
        }
      },

      toggleVisibility: () => {
        set(state => ({ isVisible: !state.isVisible }));
      },

      setVisibility: (visible: boolean) => {
        set({ isVisible: visible });
      },

      setPanelHeight: (height: number) => {
        set({ panelHeight: Math.max(150, Math.min(height, 600)) });
      }
    }),
    {
      name: 'dragon-ui-terminal-config',
      partialize: (state) => ({
        config: state.config,
        panelHeight: state.panelHeight
      })
    }
  )
);

// Hook for terminal data events
export const useTerminalEvents = () => {
  const { markTabClosed } = useTerminalStore();

  const setupListeners = (
    onData: (id: string, data: string) => void,
    onExit: (id: string) => void
  ) => {
    if (!window.electronAPI) return;

    window.electronAPI.onTerminalData((event) => {
      onData(event.id, event.data);
    });

    window.electronAPI.onTerminalExit((event) => {
      markTabClosed(event.id);
      onExit(event.id);
    });
  };

  const cleanupListeners = () => {
    if (!window.electronAPI) return;
    window.electronAPI.removeTerminalListeners();
  };

  return { setupListeners, cleanupListeners };
};
