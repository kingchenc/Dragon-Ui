import { create } from 'zustand'
import { subscribeWithSelector, persist } from 'zustand/middleware'
import { currencyService, CurrencyRate, SUPPORTED_CURRENCIES } from './currency-service'
import { LanguageCode, DEFAULT_LANGUAGE, changeLanguage as i18nChangeLanguage } from '@/i18n'
import React from 'react'

// Extend window interface for TypeScript in this file
declare global {
  interface Window {
    electronAPI: {
      invoke: (channel: string, ...args: any[]) => Promise<any>
      on: (channel: string, callback: (...args: any[]) => void) => void
      [key: string]: any
    }
  }
}

// Define types for our data structures
interface CoreData {
  // Basic Financial
  totalCost: number
  cost: number
  currentCost: number
  costAmount: number
  
  // Sessions & Projects
  totalSessions: number
  sessions: number
  sessionsCount: number
  validSessions: number
  recentSessions: number
  totalProjects: number
  projectsCount: number
  
  // Averages & Ratios
  averageCostPerSession: number
  avgCostPerSession: number
  avgCostPerProject: number
  avgDuration: number
  avgSessionCost: number
  avgTokensPerSession: number
  
  // Tokens
  totalTokens: number
  tokens: number
  tokensUsed: number
  tokensCount: number
  
  // Costs per Unit
  costPer1MTokens: number
  costPerToken: number
  costPer1KTokens: number
  costPerConversation: number
  costPerEntry: number
  
  // Time & Duration
  started: string | null
  duration: number
  timeLeft: number
  timeAgo: string | null
  lastActivity: string | null
  dateTime: string | null
  sessionTimeLeft: number
  
  // Active/Live Data
  activeSession: string | null
  sessionActive: boolean
  activeDays: number
  entries: number
  
  // Status & State
  status: string
  sessionStatus: string
  
  // Models & Technical
  models: string[]
  modelsCount: number
  modelsList: string[]
  sessionId: string | null
  block: string | null
  blocks: any[]
  blocksCount: number
  totalBlocks: number
  
  // Project Specific
  projectName: string | null
  project: string | null
  topRanking: number
  percentageOfTotal: number
  mostActiveProject: string | null
  mostRecentActivity: string | null
  
  // Session Analysis
  mostProductiveSession: string | null
  longestSession: string | null
  mostExpensiveSession: string | null
  sessionNumber: number
  recentCount: number
  conversations: number
  efficiency: number
  
  // Time Periods
  daysTracked: number
  timeSpan: string | null
  period: string | null
  
  // Monthly fields
  monthsTracked: number
  totalMonths: number
  currentMonth: string | null
  currentMonthCost: number
  currentPeriod: number
  monthlyAverage: number
  averageMonthlySpend: number
  projectedMonthly: number
  quarterlyProjection: number
  yearlyProjection: number
  projectedYearlySpend: number
  currentRunRate: number
  highestSpendingMonth: string | null
  mostActiveMonth: string | null
  growthTrend: number
  monthlyGrowth: number
  
  // Additional computed data
  sessionsData: any[]
  projectsData: any[]
  monthlyData: any[]
  dailyData: any[]
  currentTokens: number
  
  // Daily specific data
  todayData: any
  yesterdayData: any
  lastSessionData: any
  avgDailyCost: number
  
  // Activity chart data
  activityData: any[]
  dailyBreakdown: any[]
  last7DaysTotal: number
  
  // Live Monitor Data
  liveMetrics: any
  activityWindows: any[]
  peakActivity: number
  averageActivity: number
  
  // Gap Detection
  gaps: any[]
  gapStatistics: any
  productivityPatterns: any
  
  // Model Breakdown
  modelBreakdown: any[]
  modelStats: any
  modelEfficiency: any[]
}

interface AppState {
  // Theme management
  theme: 'light' | 'dark'
  toggleTheme: () => void
  
  // Active tab management
  activeTab: string
  setActiveTab: (tab: string) => void
  
  // Loading states
  isLoading: boolean
  isLoadingCurrency: boolean
  loadingProgress: {
    step: string
    progress: number
    message: string
  } | null
  
  // Core data - ALL 75+ values stored in RAM here!
  coreData: CoreData
  
  // Currency state - from currency-service
  currency: string
  exchangeRates: Record<string, CurrencyRate>
  supportedCurrencies: typeof SUPPORTED_CURRENCIES
  
  // Tab computed data (derived from coreData)
  overviewData: any
  projectsData: any
  sessionsData: any
  monthlyData: any
  dailyData: any
  activeData: any
  
  // Settings (for compatibility)
  settings: {
    autoRefresh: boolean
    refreshInterval: number
    currency: string
    language: LanguageCode
    timezone: string
    timeFormat: '12h' | '24h'
    compactMode: boolean
    showAnimations: boolean
    billingCycleDay: number
    claudePaths: {
      standardPaths: string[]
      customPaths: string[]
      activePaths: string[]
    }
  }
  updateSettings: (settings: Partial<AppState['settings']>) => void    // Error handling
    error: string | null
    lastRefresh: number
    lastCurrencyRefresh: number
    
    // Initialization guards
    isInitializing: boolean
    isInitialized: boolean
  
  // Actions
  initializeStore: () => Promise<void>
  refreshCoreData: () => Promise<void>
  refreshCurrency: () => Promise<void>
  changeCurrency: (newCurrency: string) => Promise<void>
  changeLanguage: (newLanguage: LanguageCode) => Promise<void>
  exportData: (dataType: string, format?: string, options?: any) => Promise<string>
  
  // Tab data getters (computed from coreData)
  getOverviewData: () => any
  getProjectsData: () => any
  getSessionsData: () => any
  getMonthlyData: () => any
  getDailyData: () => any
  getActiveData: () => any
  
  // Internal helper
  calculateTabViews: () => void
  
  setError: (error: string | null) => void
  clearError: () => void
}

// Create the centralized store - ALL data lives here!
export const useAppStore = create<AppState>()(
  persist(
    subscribeWithSelector((set, get) => ({
    // Theme management
    theme: 'dark',
    toggleTheme: () => {
      const newTheme = get().theme === 'light' ? 'dark' : 'light'
      set({ theme: newTheme })
      document.documentElement.classList.toggle('dark', newTheme === 'dark')
    },
    
    // Active tab management
    activeTab: 'overview',
    setActiveTab: (tab: string) => set({ activeTab: tab }),
    
    // Initial state
    isLoading: false,
    isLoadingCurrency: false,
    loadingProgress: null,
    
    // Core data - ALL 75+ values stored here in RAM
    coreData: {
      // Initialize with zeros/defaults
      totalCost: 0, cost: 0, currentCost: 0, costAmount: 0,
      totalSessions: 0, sessions: 0, sessionsCount: 0, validSessions: 0, recentSessions: 0,
      totalProjects: 0, projectsCount: 0,
      averageCostPerSession: 0, avgCostPerSession: 0, avgCostPerProject: 0, avgDuration: 0, avgSessionCost: 0, avgTokensPerSession: 0,
      totalTokens: 0, tokens: 0, tokensUsed: 0, tokensCount: 0,
      costPer1MTokens: 0, costPerToken: 0, costPer1KTokens: 0, costPerConversation: 0, costPerEntry: 0,
      started: null, duration: 0, timeLeft: 0, timeAgo: null, lastActivity: null, dateTime: null, sessionTimeLeft: 0,
      activeSession: null, sessionActive: false, activeDays: 0, entries: 0,
      status: 'idle', sessionStatus: 'idle',
      models: [], modelsCount: 0, modelsList: [], sessionId: null, block: null, blocks: [], blocksCount: 0, totalBlocks: 0,
      projectName: null, project: null, topRanking: 0, percentageOfTotal: 0, mostActiveProject: null, mostRecentActivity: null,
      mostProductiveSession: null, longestSession: null, mostExpensiveSession: null, sessionNumber: 0, recentCount: 0, conversations: 0, efficiency: 0,
      daysTracked: 0, timeSpan: null, period: null,
      monthsTracked: 0, totalMonths: 0, currentMonth: null, currentMonthCost: 0, currentPeriod: 0,
      monthlyAverage: 0, averageMonthlySpend: 0, projectedMonthly: 0, quarterlyProjection: 0, yearlyProjection: 0, projectedYearlySpend: 0,
      currentRunRate: 0, highestSpendingMonth: null, mostActiveMonth: null, growthTrend: 0, monthlyGrowth: 0,
      sessionsData: [], projectsData: [], monthlyData: [], dailyData: [], currentTokens: 0,
      todayData: null, yesterdayData: null, lastSessionData: null, avgDailyCost: 0,
      activityData: [], dailyBreakdown: [], last7DaysTotal: 0,
      liveMetrics: null, activityWindows: [], peakActivity: 0, averageActivity: 0,
      gaps: [], gapStatistics: null, productivityPatterns: null,
      modelBreakdown: [], modelStats: null, modelEfficiency: []
    },
    
    // Currency state - from currency-service
    currency: 'USD',
    exchangeRates: {},
    supportedCurrencies: SUPPORTED_CURRENCIES,
    
    // Tab computed data (derived from coreData)
    overviewData: null,
    projectsData: null,
    sessionsData: null,
    monthlyData: null,
    dailyData: null,
    activeData: null,
    
    // Settings (default values for compatibility)
    settings: {
      autoRefresh: true, // Smart incremental refresh enabled
      refreshInterval: 30, // 30 seconds for active session (smart refresh)
      currency: 'USD',
      language: DEFAULT_LANGUAGE,
      timezone: 'auto',
      timeFormat: '24h',
      compactMode: true,
      showAnimations: true,
      billingCycleDay: 1, // Default to 1st of each month
      claudePaths: {
        standardPaths: [],
        customPaths: [],
        activePaths: []
      }
    },
    
    error: null,
    lastRefresh: 0,
    lastCurrencyRefresh: 0,
    
    // Initialization guards
    isInitializing: false,
    isInitialized: false,
    
    // Initialize store - load currency and core data
    initializeStore: async () => {
      // Prevent multiple initializations
      const state = get()
      if (state.isInitializing || state.isInitialized) {
        console.log('[WARN] Store: Already initializing/initialized, skipping...')
        return
      }
      
      console.log('[INIT] Store: Initializing central data hub...')
      
      try {
        set({ isInitializing: true, isLoading: true, error: null })
        
        // Connect currency service to store for direct updates
        currencyService.setStoreUpdater((rates, currency) => {
          set({
            exchangeRates: rates,
            currency: currency,
            lastCurrencyRefresh: Date.now()
          })
          // Recalculate tab views with new currency data
          get().calculateTabViews()
        })
        
        // Load currency data
        await get().refreshCurrency()
        
        // Load core data from backend
        await get().refreshCoreData()
        
        set({ 
          isLoading: false, 
          isInitializing: false, 
          isInitialized: true 
        })
        console.log('[OK] Store: Central data hub initialized')
        
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        console.error('[ERR] Store: Initialization failed:', errorMessage)
        set({ 
          isLoading: false, 
          isInitializing: false, 
          isInitialized: false, 
          error: errorMessage 
        })
        throw error
      }
    },
    
    // Refresh core data from backend
    refreshCoreData: async () => {
      try {
        console.log('[LOAD] Store: Refreshing core data from backend...')
        
        // Get all data from core-data service via IPC with billing cycle
        const currentState = get()
        const result = await window.electronAPI.invoke('claude-projects-core-data', {
          billingCycleDay: currentState.settings.billingCycleDay || 1
        })
        
        if (result.success) {
          // Store ALL data in RAM - this is the single source of truth!
          set(state => ({
            coreData: {
              ...state.coreData,
              ...result.data
            },
            lastRefresh: Date.now()
          }))
          
          // Recalculate tab views
          get().calculateTabViews()
          
          console.log('[OK] Store: Core data refreshed - 75+ values loaded')
        } else {
          throw new Error(result.error || 'Failed to refresh core data')
        }
        
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        console.error('[ERR] Store: Core data refresh failed:', errorMessage)
        set({ error: errorMessage })
        throw error
      }
    },
    
    // Refresh currency data
    refreshCurrency: async () => {
      try {
        set({ isLoadingCurrency: true })
        console.log('[CURR] Store: Refreshing currency data...')
        
        // Get fresh exchange rates from currency service
        const rates = await currencyService.fetchExchangeRates()
        
        set({
          exchangeRates: rates,
          lastCurrencyRefresh: Date.now(),
          isLoadingCurrency: false
        })
        
        console.log('[OK] Store: Currency data refreshed')
        
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        console.error('[ERR] Store: Currency refresh failed:', errorMessage)
        set({ isLoadingCurrency: false, error: errorMessage })
      }
    },
    
    // Calculate tab-specific views from core data
    calculateTabViews: () => {
      const state = get()
      const { coreData, currency } = state
      
      // NO CONVERSION NEEDED - Data comes pre-converted from worker!
      // The worker already handles currency conversion
      const convertCost = (cost: number) => {
        return cost // Data is already in the correct currency from worker
      }
      
      // Overview data
      const overviewData = {
        totalCost: convertCost(coreData.totalCost),
        totalSessions: coreData.totalSessions,
        totalTokens: coreData.totalTokens,
        totalProjects: coreData.totalProjects,
        averageCostPerSession: convertCost(coreData.averageCostPerSession),
        avgTokensPerSession: coreData.avgTokensPerSession,
        currency: currency,
        status: coreData.status,
        lastActivity: coreData.lastActivity,
        models: coreData.models,
        activeDays: coreData.activeDays,
        // Activity chart data
        activityData: (coreData.activityData || []).map((day: any) => ({
          ...day,
          cost: convertCost(day.cost || 0)
        })),
        dailyBreakdown: (coreData.dailyBreakdown || []).map((day: any) => ({
          ...day,
          totalCost: convertCost(day.totalCost || 0)
        })),
        last7DaysTotal: convertCost(coreData.last7DaysTotal || 0)
      }
      
      // Projects data
      const projectsData = {
        projectsData: coreData.projectsData.map((p: any) => ({
          ...p,
          totalCost: convertCost(p.totalCost || 0),
          avgCostPerSession: convertCost(p.avgCostPerSession || 0)
        })),
        totalProjects: coreData.totalProjects,
        mostActiveProject: coreData.mostActiveProject,
        currency: currency
      }
      
      // Sessions data
      const sessionsData = {
        sessionsData: coreData.sessionsData.map((s: any) => ({
          ...s,
          totalCost: convertCost(s.totalCost || 0)
        })),
        totalSessions: coreData.totalSessions,
        validSessions: coreData.validSessions,
        currency: currency
      }
      
      // Monthly data
      const monthlyData = {
        monthlyData: coreData.monthlyData.map((m: any) => ({
          ...m,
          totalCost: convertCost(m.totalCost || 0),
          dailyAverage: convertCost(m.dailyAverage || 0),
          avgCostPerDay: convertCost(m.avgCostPerDay || 0),
          avgSessionCost: convertCost(m.avgSessionCost || 0),
          avgCostPerSession: convertCost(m.avgCostPerSession || 0)
        })),
        totalMonths: coreData.totalMonths || coreData.monthsTracked || 0,
        currentMonth: coreData.currentMonth || null,
        currentMonthCost: convertCost(coreData.currentMonthCost || 0),
        currentPeriod: convertCost(coreData.currentPeriod || 0),
        averageMonthlySpend: convertCost(coreData.averageMonthlySpend || coreData.monthlyAverage || 0),
        monthlyAverage: convertCost(coreData.monthlyAverage || 0),
        projectedMonthly: convertCost(coreData.projectedMonthly || 0),
        quarterlyProjection: convertCost(coreData.quarterlyProjection || 0),
        projectedYearlySpend: convertCost(coreData.projectedYearlySpend || coreData.yearlyProjection || 0),
        yearlyProjection: convertCost(coreData.yearlyProjection || 0),
        currentRunRate: convertCost(coreData.currentRunRate || 0),
        highestSpendingMonth: coreData.highestSpendingMonth || null,
        mostActiveMonth: coreData.mostActiveMonth || null,
        monthlyGrowth: coreData.monthlyGrowth || coreData.growthTrend || 0,
        growthTrend: coreData.growthTrend || 0,
        totalCost: convertCost(coreData.totalCost || 0), // Total cost across all months
        currency: currency
      }
      
      // Daily data
      const dailyData = {
        dailyData: coreData.dailyData.map((d: any) => ({
          ...d,
          totalCost: convertCost(d.totalCost || 0),
          costPer1KTokens: d.costPer1KTokens || 0
        })),
        todayData: coreData.todayData ? {
          ...coreData.todayData,
          totalCost: convertCost(coreData.todayData.totalCost || 0)
        } : null,
        yesterdayData: coreData.yesterdayData ? {
          ...coreData.yesterdayData,
          totalCost: convertCost(coreData.yesterdayData.totalCost || 0)
        } : null,
        lastSessionData: coreData.lastSessionData ? {
          ...coreData.lastSessionData,
          totalCost: convertCost(coreData.lastSessionData.totalCost || 0)
        } : null,
        totalDays: coreData.daysTracked || 0,
        activeDays: coreData.activeDays || 0,
        totalCost: convertCost(coreData.totalCost || 0),
        averageDailyCost: convertCost(coreData.avgDailyCost || 0),
        totalSessions: coreData.totalSessions || 0,
        currency: currency
      }
      
      // Active session data
      const activeData = {
        activeSession: coreData.activeSession,
        sessionActive: coreData.sessionActive,
        currentCost: convertCost(coreData.currentCost),
        sessionTimeLeft: coreData.sessionTimeLeft,
        sessionId: coreData.sessionId,
        status: coreData.sessionStatus,
        duration: coreData.duration,
        timeLeft: coreData.timeLeft,
        lastActivity: coreData.lastActivity,
        currentTokens: coreData.currentTokens || 0, // Current session tokens for burn rate calculation
        currency: currency
      }
      
      // Update all tab views
      set({
        overviewData,
        projectsData,
        sessionsData,
        monthlyData,
        dailyData,
        activeData
      })
      
      console.log('[BRAIN] Store: Tab views calculated from core data')
    },
    
    changeCurrency: async (newCurrency: string) => {
      console.log(`[CURR] Store: Changing currency to ${newCurrency}...`)
      
      try {
        set({ isLoadingCurrency: true, error: null })
        
        // Update currency service
        currencyService.setSelectedCurrency(newCurrency)
        
        // Refresh exchange rates if needed
        if (!currencyService.areRatesFresh()) {
          await get().refreshCurrency()
        }
        
        // Update store currency
        set({ currency: newCurrency })
        
        // Recalculate all tab views with new currency
        get().calculateTabViews()
        
        set({ isLoadingCurrency: false })
        console.log(`[OK] Store: Currency changed to ${newCurrency} and all views updated`)
        
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        console.error('[ERR] Store: Currency change failed:', errorMessage)
        set({ isLoadingCurrency: false, error: errorMessage })
        throw error
      }
    },
    
    changeLanguage: async (newLanguage: LanguageCode) => {
      console.log(`[LANGUAGE] Store: Changing language to ${newLanguage}...`)
      
      try {
        // Update store settings first
        set((state) => ({
          settings: {
            ...state.settings,
            language: newLanguage
          }
        }))
        
        // Change language in i18n system
        await i18nChangeLanguage(newLanguage)
        
        console.log(`[OK] Store: Language changed to ${newLanguage}`)
        
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        console.error('[ERR] Store: Language change failed:', errorMessage)
        set({ error: errorMessage })
        throw error
      }
    },
    
    exportData: async (dataType: string, format = 'json', options = {}) => {
      console.log(`[EXPORT] Store: Exporting ${dataType} as ${format}...`)
      
      try {
        const result = await window.electronAPI.invoke('claude-projects-export', format, dataType, options)
        
        if (result.success) {
          console.log(`[OK] Store: Export completed (${result.data.length} characters)`)
          return result.data
        } else {
          throw new Error(result.error || 'Export failed')
        }
        
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        console.error('[ERR] Store: Export error:', errorMessage)
        set({ error: errorMessage })
        throw error
      }
    },
    
    // Tab data getters - Tabs read from these instead of making IPC calls!
    getOverviewData: () => {
      const state = get()
      return state.overviewData
    },
    
    getProjectsData: () => {
      const state = get()
      return state.projectsData
    },
    
    getSessionsData: () => {
      const state = get()
      return state.sessionsData
    },
    
    getMonthlyData: () => {
      const state = get()
      return state.monthlyData
    },
    
    getDailyData: () => {
      const state = get()
      return state.dailyData
    },
    
    getActiveData: () => {
      const state = get()
      return state.activeData
    },
    
    setError: (error: string | null) => {
      set({ error })
    },
    
    clearError: () => {
      set({ error: null })
    },
    
    // Settings management (for compatibility)
    updateSettings: (newSettings: Partial<AppState['settings']>) => {
      set(state => ({
        settings: {
          ...state.settings,
          ...newSettings
        }
      }))
      
      // Update currency if changed
      if (newSettings.currency && newSettings.currency !== get().currency) {
        get().changeCurrency(newSettings.currency)
      }
      
      // Update billing cycle if changed - trigger recalculation
      if (newSettings.billingCycleDay && newSettings.billingCycleDay !== get().settings.billingCycleDay) {
        console.log(`[BILLING] Store: Billing cycle changed to day ${newSettings.billingCycleDay}, refreshing data...`)
        get().refreshCoreData().catch(console.error)
      }
      
      // Update language if changed
      if (newSettings.language && newSettings.language !== get().settings.language) {
        console.log('[STORE] Language change detected in updateSettings, calling changeLanguage:', newSettings.language)
        get().changeLanguage(newSettings.language).catch(console.error)
      }
    }
  })),
    {
      name: 'dragon-ui-storage',
      partialize: (state) => ({
        theme: state.theme,
        activeTab: state.activeTab,
        settings: state.settings,
        currency: state.currency
      }),
    }
  )
)

// Simple hooks for tabs - they just read from store, no IPC calls!
export const useOverviewData = () => {
  const { overviewData, isLoading, refreshCoreData } = useAppStore()
  
  React.useEffect(() => {
    if (!overviewData && !isLoading) {
      refreshCoreData().catch(console.error)
    }
  }, [overviewData, isLoading, refreshCoreData])
  
  return {
    data: overviewData,
    isLoading: isLoading,
    refresh: refreshCoreData
  }
}

export const useProjectsData = () => {
  const { projectsData, isLoading, refreshCoreData } = useAppStore()
  
  React.useEffect(() => {
    if (!projectsData && !isLoading) {
      refreshCoreData().catch(console.error)
    }
  }, [projectsData, isLoading, refreshCoreData])
  
  return {
    data: projectsData,
    isLoading: isLoading,
    refresh: refreshCoreData
  }
}

export const useSessionsData = () => {
  const { sessionsData, isLoading, refreshCoreData } = useAppStore()
  
  React.useEffect(() => {
    if (!sessionsData && !isLoading) {
      refreshCoreData().catch(console.error)
    }
  }, [sessionsData, isLoading, refreshCoreData])
  
  return {
    data: sessionsData,
    isLoading: isLoading,
    refresh: refreshCoreData
  }
}

export const useMonthlyData = () => {
  const { monthlyData, isLoading, refreshCoreData } = useAppStore()
  
  React.useEffect(() => {
    if (!monthlyData && !isLoading) {
      refreshCoreData().catch(console.error)
    }
  }, [monthlyData, isLoading, refreshCoreData])
  
  return {
    data: monthlyData,
    isLoading: isLoading,
    refresh: refreshCoreData
  }
}

export const useDailyData = () => {
  const { dailyData, isLoading, refreshCoreData } = useAppStore()
  
  React.useEffect(() => {
    if (!dailyData && !isLoading) {
      refreshCoreData().catch(console.error)
    }
  }, [dailyData, isLoading, refreshCoreData])
  
  return {
    data: dailyData,
    isLoading: isLoading,
    refresh: refreshCoreData
  }
}

export const useActiveData = () => {
  const { activeData, isLoading, refreshCoreData } = useAppStore()
  
  React.useEffect(() => {
    if (!activeData && !isLoading) {
      refreshCoreData().catch(console.error)
    }
  }, [activeData, isLoading, refreshCoreData])
  
  // Smart auto-refresh - only when window is active and not loading
  React.useEffect(() => {
    let interval: NodeJS.Timeout | null = null
    
    const startSmartRefresh = () => {
      // Only refresh if window is visible and not loading
      if (!document.hidden && !isLoading) {
        console.log('[REFRESH] Smart refresh: Incremental update check')
        refreshCoreData().catch(console.error)
      }
    }
    
    // Start with longer interval for active session (30 seconds)
    interval = setInterval(startSmartRefresh, 30000)
    
    // Pause refresh when window is hidden to save resources
    const handleVisibilityChange = () => {
      if (document.hidden) {
        if (interval) {
          clearInterval(interval)
          interval = null
          console.log('[PAUSE] Smart refresh: Paused (window hidden)')
        }
      } else {
        if (!interval) {
          interval = setInterval(startSmartRefresh, 30000)
          console.log('[RESUME] Smart refresh: Resumed (window visible)')
          // Immediate refresh when window becomes visible
          startSmartRefresh()
        }
      }
    }
    
    document.addEventListener('visibilitychange', handleVisibilityChange)
    
    return () => {
      if (interval) clearInterval(interval)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [isLoading, refreshCoreData])
  
  return {
    data: activeData,
    isLoading: isLoading,
    refresh: refreshCoreData
  }
}

// Legacy compatibility exports (for gradual migration)
export const useAppStoreCompat = () => {
  const store = useAppStore()
  
  return {
    // Legacy names mapped to store data
    usageStats: store.overviewData,
    currentSession: store.activeData,
    projectUsage: store.projectsData?.projectsData || [],
    blocksUsage: store.sessionsData?.sessionsData || [],
    dailyUsage: store.dailyData?.dailyData || [],
    monthlyUsage: store.monthlyData?.monthlyData || [],
    
    // Loading states
    isLoadingStats: store.isLoading,
    isLoadingCurrentSession: store.isLoading,
    isLoadingProjects: store.isLoading,
    isLoadingBlocks: store.isLoading,
    
    // Actions
    fetchUsageStats: store.refreshCoreData,
    
    // All store actions
    ...store
  }
}

// Initialize store on first import
if (typeof window !== 'undefined' && window.electronAPI) {
  // Initialize theme on app start
  const { theme } = useAppStore.getState()
  document.documentElement.classList.toggle('dark', theme === 'dark')
  
  // Listen for auto-pushed core data updates from backend
  window.electronAPI.on('core-data-updated', (coreData: any) => {
    console.log('[IPC] Store: Received auto-pushed core data from backend')
    const store = useAppStore.getState()
    
    // Check if this is a progress update
    if (coreData._loadingProgress) {
      useAppStore.setState({
        loadingProgress: coreData._loadingProgress
      })
      return
    }
    
    // Update core data directly
    store.setError(null)
    useAppStore.setState(state => ({
      coreData: {
        ...state.coreData,
        ...coreData
      },
      lastRefresh: Date.now(),
      loadingProgress: null // Clear progress when data is complete
    }))
    
    // Recalculate tab views
    store.calculateTabViews()
  })
  
  // Only initialize in electron renderer
  setTimeout(() => {
    useAppStore.getState().initializeStore().catch(console.error)
  }, 100)
}

export default useAppStore