/**
 * Statusline Hook
 * Manages statusline state and data
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useEffect, useCallback } from 'react';
import { StatuslineConfig, StatuslineData, DEFAULT_STATUSLINE_CONFIG } from '../types';
import { useAppStore } from '@/lib/store';

interface StatuslineStore {
  config: StatuslineConfig;
  data: StatuslineData;
  isVisible: boolean;
  isEditing: boolean;

  // Actions
  updateConfig: (config: Partial<StatuslineConfig>) => void;
  updateData: (data: Partial<StatuslineData>) => void;
  toggleElement: (elementId: string) => void;
  setElementColor: (elementId: string, color: string) => void;
  setElementEmoji: (elementId: string, emoji: string) => void;
  reorderElements: (fromIndex: number, toIndex: number) => void;
  resetConfig: () => void;
  toggleVisibility: () => void;
  toggleEditing: () => void;

  // Presets
  applyPreset: (preset: 'modern' | 'classic' | 'minimal' | 'dragon') => void;

  // CLI Sync
  exportToCLI: () => Promise<boolean>;
  importFromCLI: () => Promise<boolean>;
}

export const useStatusline = create<StatuslineStore>()(
  persist(
    (set) => ({
      config: DEFAULT_STATUSLINE_CONFIG,
      // Initialize with empty values - will be populated by updateData() from real database
      data: {
        model: undefined,
        branch: undefined,
        version: undefined,
        cwd: undefined,
        tokensIn: 0,
        tokensOut: 0,
        tokensCached: 0,
        tokensTotal: 0,
        contextCurrent: 0,
        contextMax: 200000,
        contextUsed: 0,
        sessionTime: undefined,
        blockTime: undefined,
        cost: 0,
        activeProjects: 0,
        totalSessions: 0,
        dailyUsage: 0,
        lastUpdate: undefined
      },
      isVisible: true,
      isEditing: false,

      updateConfig: (newConfig) =>
        set((state) => ({
          config: { ...state.config, ...newConfig }
        })),

      updateData: (newData) =>
        set((state) => ({
          data: { ...state.data, ...newData }
        })),

      toggleElement: (elementId) =>
        set((state) => ({
          config: {
            ...state.config,
            elements: state.config.elements.map((el) =>
              el.id === elementId ? { ...el, visible: !el.visible } : el
            )
          }
        })),

      setElementColor: (elementId, color) =>
        set((state) => ({
          config: {
            ...state.config,
            elements: state.config.elements.map((el) =>
              el.id === elementId ? { ...el, color } : el
            )
          }
        })),

      setElementEmoji: (elementId, emoji) =>
        set((state) => ({
          config: {
            ...state.config,
            elements: state.config.elements.map((el) =>
              el.id === elementId ? { ...el, emoji } : el
            )
          }
        })),

      reorderElements: (fromIndex, toIndex) =>
        set((state) => {
          const elements = [...state.config.elements];
          const [moved] = elements.splice(fromIndex, 1);
          elements.splice(toIndex, 0, moved);

          // Update order property
          const reorderedElements = elements.map((el, index) => ({
            ...el,
            order: index + 1
          }));

          return {
            config: {
              ...state.config,
              elements: reorderedElements
            }
          };
        }),

      resetConfig: () =>
        set({
          config: DEFAULT_STATUSLINE_CONFIG
        }),

      toggleVisibility: () =>
        set((state) => ({
          isVisible: !state.isVisible
        })),

      toggleEditing: () =>
        set((state) => ({
          isEditing: !state.isEditing
        })),

      applyPreset: (preset) =>
        set((state) => {
          const presetConfigs = {
            modern: {
              style: 'modern' as const,
              lines: 1 as const,
              compactMode: false,
              useEmojis: false,
              useColors: true,
              fontFamily: 'system-ui',
              fontSize: 12
            },
            classic: {
              style: 'classic' as const,
              lines: 1 as const,
              compactMode: true,
              useEmojis: false,
              useColors: false,
              fontFamily: 'monospace',
              fontSize: 11
            },
            minimal: {
              style: 'minimal' as const,
              lines: 1 as const,
              compactMode: true,
              useEmojis: false,
              useColors: true,
              fontFamily: 'SF Mono',
              fontSize: 10
            },
            dragon: {
              style: 'dragon' as const,
              lines: 2 as const,
              compactMode: false,
              useEmojis: true,
              useColors: true,
              fontFamily: 'JetBrains Mono',
              fontSize: 12
            }
          };

          return {
            config: {
              ...state.config,
              ...presetConfigs[preset]
            }
          };
        }),

      // Export GUI statusline config to CLI settings file
      exportToCLI: async () => {
        try {
          const state = useStatusline.getState();
          const cliConfig = {
            style: state.config.style,
            lines: state.config.lines,
            useColors: state.config.useColors,
            useEmojis: state.config.useEmojis,
            compact: state.config.compactMode,
            showElements: state.config.elements
              .filter(el => el.visible)
              .map(el => el.id),
            fontFamily: state.config.fontFamily,
            fontSize: state.config.fontSize
          };

          // Use Electron IPC to save to CLI settings file
          if (typeof window !== 'undefined' && (window as any).electronAPI?.invoke) {
            const result = await (window as any).electronAPI.invoke('statusline-export-to-cli', cliConfig);
            return result?.success || false;
          }
          return false;
        } catch (error) {
          console.error('Failed to export statusline config to CLI:', error);
          return false;
        }
      },

      // Import CLI statusline config to GUI
      importFromCLI: async () => {
        try {
          // Use Electron IPC to read from CLI settings file
          if (typeof window !== 'undefined' && (window as any).electronAPI?.invoke) {
            const result = await (window as any).electronAPI.invoke('statusline-import-from-cli');
            if (result?.success && result.config) {
              const cliConfig = result.config;
              set((state) => ({
                config: {
                  ...state.config,
                  style: cliConfig.style || state.config.style,
                  lines: cliConfig.lines || state.config.lines,
                  useColors: cliConfig.useColors ?? state.config.useColors,
                  useEmojis: cliConfig.useEmojis ?? state.config.useEmojis,
                  compactMode: cliConfig.compact ?? state.config.compactMode,
                  fontFamily: cliConfig.fontFamily || state.config.fontFamily,
                  fontSize: cliConfig.fontSize || state.config.fontSize,
                  elements: state.config.elements.map(el => ({
                    ...el,
                    visible: cliConfig.showElements?.includes(el.id) ?? el.visible
                  }))
                }
              }));
              return true;
            }
          }
          return false;
        } catch (error) {
          console.error('Failed to import statusline config from CLI:', error);
          return false;
        }
      }
    }),
    {
      name: 'dragon-ui-statusline-config'
    }
  )
);

// Helper hook for getting formatted data
export const useStatuslineData = () => {
  const { data } = useStatusline();

  const formatTokens = (tokens: number) => {
    if (tokens >= 1000000) return `${(tokens / 1000000).toFixed(1)}M`;
    if (tokens >= 1000) return `${(tokens / 1000).toFixed(1)}k`;
    return tokens.toString();
  };

  const formatCost = (cost: number) => `$${cost.toFixed(2)}`;

  const formatContext = (current: number, max: number, used: number) => {
    const currentK = (current / 1000).toFixed(1);
    const maxK = (max / 1000).toFixed(0);
    return `${currentK}k/${maxK}k | ${used.toFixed(1)}%`;
  };

  return {
    ...data,
    formattedTokens: {
      in: data.tokensIn ? formatTokens(data.tokensIn) : '0',
      out: data.tokensOut ? formatTokens(data.tokensOut) : '0',
      cached: data.tokensCached ? formatTokens(data.tokensCached) : '0',
      total: data.tokensTotal ? formatTokens(data.tokensTotal) : '0'
    },
    formattedCost: data.cost ? formatCost(data.cost) : '$0.00',
    formattedContext: data.contextCurrent && data.contextMax && data.contextUsed
      ? formatContext(data.contextCurrent, data.contextMax, data.contextUsed)
      : '0/0',
    lastUpdateFormatted: data.lastUpdate
      ? (data.lastUpdate instanceof Date
          ? data.lastUpdate.toLocaleTimeString()
          : new Date(data.lastUpdate).toLocaleTimeString())
      : ''
  };
};

/**
 * Data Provider Hook
 * Syncs real data from main AppStore to statusline store
 * Call this in the main App or StatuslineRenderer to keep data in sync
 */
export const useStatuslineDataProvider = () => {
  const { updateData, config } = useStatusline();

  // Get data from main app store
  const overviewData = useAppStore(state => state.overviewData);
  const activeData = useAppStore(state => state.activeData);
  const coreData = useAppStore(state => state.coreData);

  // Get app version from package.json via store
  const getAppVersion = useCallback(() => {
    try {
      // Access version from window if available (set in electron preload)
      if (typeof window !== 'undefined' && (window as any).appVersion) {
        return (window as any).appVersion;
      }
      return '1.2.1'; // Fallback to current version
    } catch {
      return '1.2.1';
    }
  }, []);

  // Get current git branch
  const getGitBranch = useCallback(() => {
    try {
      // Git branch is typically set via IPC from main process
      if (typeof window !== 'undefined' && (window as any).gitBranch) {
        return (window as any).gitBranch;
      }
      return 'main';
    } catch {
      return 'main';
    }
  }, []);

  // Get current working directory
  const getCwd = useCallback(() => {
    try {
      if (typeof window !== 'undefined' && (window as any).cwd) {
        // Get just the folder name from full path
        const fullPath = (window as any).cwd;
        return fullPath.split(/[\\/]/).pop() || fullPath;
      }
      return 'Dragon-Ui';
    } catch {
      return 'Dragon-Ui';
    }
  }, []);

  // Calculate session time from start time
  const calculateSessionTime = useCallback((started: string | null): string => {
    if (!started) return '0m';

    try {
      const startTime = new Date(started);
      const now = new Date();
      const diffMs = now.getTime() - startTime.getTime();
      const diffMins = Math.floor(diffMs / 60000);

      if (diffMins >= 60) {
        const hours = Math.floor(diffMins / 60);
        const mins = diffMins % 60;
        return `${hours}h ${mins}m`;
      }
      return `${diffMins}m`;
    } catch {
      return '0m';
    }
  }, []);

  // Sync data from AppStore to statusline store
  useEffect(() => {
    if (!overviewData && !activeData && !coreData) return;

    const statuslineData: Partial<StatuslineData> = {
      // Model - get from overview or active session
      model: overviewData?.models?.[0] || coreData?.models?.[0] || 'claude-sonnet-4',

      // Git info
      branch: getGitBranch(),
      version: getAppVersion(),
      cwd: getCwd(),

      // Token data from core data
      tokensIn: coreData?.tokensUsed || coreData?.currentTokens || 0,
      tokensOut: Math.floor((coreData?.tokensUsed || 0) * 0.07), // Estimate output tokens
      tokensCached: 0, // Cache data not tracked separately
      tokensTotal: coreData?.totalTokens || overviewData?.totalTokens || 0,

      // Context info - estimate based on current tokens
      contextCurrent: coreData?.currentTokens || 0,
      contextMax: 200000, // Claude's max context
      contextUsed: coreData?.currentTokens ? (coreData.currentTokens / 200000) * 100 : 0,

      // Session timing
      sessionTime: calculateSessionTime(activeData?.started || coreData?.started),
      blockTime: coreData?.duration ? `${Math.floor(coreData.duration / 60)}m` : '0m',

      // Cost data
      cost: activeData?.currentCost || coreData?.currentCost || 0,

      // Dragon UI specific
      activeProjects: coreData?.totalProjects || overviewData?.totalProjects || 0,
      totalSessions: coreData?.totalSessions || overviewData?.totalSessions || 0,
      dailyUsage: 0, // Could calculate from daily data

      // Update timestamp
      lastUpdate: new Date()
    };

    updateData(statuslineData);
  }, [
    overviewData,
    activeData,
    coreData,
    updateData,
    getAppVersion,
    getGitBranch,
    getCwd,
    calculateSessionTime,
    config.refreshInterval
  ]);

  // Set up refresh interval
  useEffect(() => {
    const interval = setInterval(() => {
      // Data is automatically synced via the effect above
      // This just ensures lastUpdate is refreshed
      updateData({ lastUpdate: new Date() });
    }, config.refreshInterval);

    return () => clearInterval(interval);
  }, [config.refreshInterval, updateData]);
};