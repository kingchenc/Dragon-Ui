import React, { useEffect, useRef } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ThemeToggle } from '@/components/ui/theme-toggle'
import { LoadingOverlay, DragonLoading } from '@/components/ui/loading'
import { Button } from '@/components/ui/button'
import { DragonCard } from '@/components/ui/card'
import { DragonBadge } from '@/components/ui/badge'
import { useAppStore } from '@/lib/store'
import { useTimeFormatting } from '@/lib/hooks'
import { useTranslation, initializeLanguage, changeLanguage } from '@/i18n'
import { getAppVersion } from '@/lib/utils'
import { 
  BarChart3, 
  Zap, 
  FolderOpen, 
  Clock, 
  Calendar, 
  Activity, 
  Settings,
  RefreshCw,
  AlertCircle
} from 'lucide-react'

// Import page components (we'll create these next)
import OverviewPage from '@/pages/overview'
import ProjectsPage from '@/pages/projects' 
import SessionsPage from '@/pages/sessions'
import MonthlyUsagePage from '@/pages/monthly-usage'
import DailyUsagePage from '@/pages/daily-usage'
import ActiveSessionPage from '@/pages/active-session'
import SettingsPage from '@/pages/settings'

function App() {
  const { 
    activeTab, 
    setActiveTab, 
    theme,
    isLoading,
    loadingProgress,
    error,
    setError,
    initializeStore,
    refreshCoreData,
    settings,
    lastRefresh,
    isInitialized,
    isInitializing,
    currentAppVersion,
    latestVersion,
    isVersionOutdated
  } = useAppStore()
  
  const { t } = useTranslation()
  const { formatTime } = useTimeFormatting()
  const appRef = useRef<HTMLDivElement>(null)

  // Screenshot functionality with hotkey L (DISABLED)
  const handleScreenshot = async () => {
    console.log('[SCREENSHOT] Screenshot functionality is temporarily disabled')
    // try {
    //   const result = await window.electronAPI.takeFullPageScreenshot()
    //   if (result.success) {
    //     console.log('[SCREENSHOT] Full-page screenshot saved:', result.filePath)
    //   } else {
    //     console.error('[SCREENSHOT] Failed:', result.error)
    //   }
    // } catch (error) {
    //   console.error('[SCREENSHOT] Error:', error)
    // }
  }

  // Listen for hotkey L screenshot trigger (DISABLED)
  useEffect(() => {
    // DISABLED: Screenshot functionality temporarily disabled
    // const handleHotkeyScreenshot = () => {
    //   console.log('[HOTKEY] Screenshot hotkey L triggered')
    //   handleScreenshot()
    // }
    // window.electronAPI.onHotkeyScreenshot(handleHotkeyScreenshot)
    return () => {
      // Cleanup if needed
    }
  }, [])

  // Apply compact scale to CSS custom property (only when compactMode is enabled)
  useEffect(() => {
    if (appRef.current) {
      // If compactMode is disabled, always use 100% scale
      const scaleValue = settings.compactMode 
        ? Math.max(0.5, Math.min(1.0, settings.compactScale / 100))
        : 1.0;
      appRef.current.style.setProperty('--compact-scale', scaleValue.toString());
    }
  }, [settings.compactScale, settings.compactMode]);

  // Initialize language on settings change
  useEffect(() => {
    if (settings.language) {
      console.log('[APP] Settings language changed to:', settings.language);
      changeLanguage(settings.language);
    }
  }, [settings.language]);

  useEffect(() => {
    // Initialize store first (this loads persisted settings including language)
    if (!isInitialized && !isInitializing) {
      const timer = setTimeout(async () => {
        console.log('[INIT] Initializing Dragon UI store...');
        await initializeStore();
        
        // Language will be initialized by the settings.language useEffect above
      }, 100);

      return () => clearTimeout(timer);
    }
  }, [initializeStore, isInitialized, isInitializing])

  const handleRefresh = async () => {
    await refreshCoreData()
  }

  const handleErrorDismiss = () => {
    setError(null)
  }

  const tabs = [
    { id: 'overview', label: t('app.navigation.overview'), icon: BarChart3, color: 'text-dragon-primary' },
    { id: 'projects', label: t('app.navigation.projects'), icon: FolderOpen, color: 'text-blue-500' },
    { id: 'sessions', label: t('app.navigation.sessions'), icon: Zap, color: 'text-dragon-accent' },
    { id: 'monthly', label: t('app.navigation.monthly'), icon: Calendar, color: 'text-green-500' },
    { id: 'daily', label: t('app.navigation.daily'), icon: Clock, color: 'text-purple-500' },
    { id: 'active', label: t('app.navigation.active'), icon: Activity, color: 'text-dragon-secondary' },
    { id: 'settings', label: t('app.navigation.settings'), icon: Settings, color: 'text-gray-500' },
  ]

  const formatLastUpdate = () => {
    if (!lastRefresh) return ''
    const now = new Date()
    const updateTime = new Date(lastRefresh)
    const diffMinutes = Math.floor((now.getTime() - updateTime.getTime()) / 60000)
    
    if (diffMinutes < 1) return t('app.lastUpdate.justNow')
    if (diffMinutes < 60) return `${diffMinutes}${t('app.lastUpdate.minutesAgo')}`
    return formatTime(updateTime)
  }

  return (
    <div 
      ref={appRef}
      className={`min-h-screen bg-background ${settings.showAnimations ? 'transition-colors duration-300' : 'no-animations'} ${theme} ${settings.compactMode ? 'compact-mode' : ''} ${settings.dragonEffects ? 'dragon-effects' : 'no-dragon-effects'} compact-scale`}
    >
      <LoadingOverlay 
        visible={isLoading} 
        text={loadingProgress ? `${loadingProgress.message} (${loadingProgress.progress.toFixed(1)}%)` : t('app.loading')} 
      />
      
      {/* Header */}
      <header className="sticky top-0 z-40 w-full border-b bg-background/80 backdrop-blur glass-effect">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-gradient-to-br from-dragon-primary to-dragon-secondary rounded-lg flex items-center justify-center">
                  <img src="Dragon-Ui (1).svg" alt="Dragon UI" className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <h1 className="text-2xl font-bold bg-gradient-to-r from-dragon-primary to-dragon-secondary bg-clip-text text-transparent">
                      Dragon UI
                    </h1>
                    <DragonBadge 
                      variant={isVersionOutdated ? "destructive" : "dragon"} 
                      className={`text-xs ${isVersionOutdated ? 'animate-pulse' : ''}`}
                    >
                      v{currentAppVersion || getAppVersion()}
                    </DragonBadge>
                    {isVersionOutdated && latestVersion && (
                      <a
                        href="https://www.npmjs.com/package/dragon-ui-claude"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-red-500 hover:text-red-400 font-medium cursor-pointer underline"
                      >
                        v{latestVersion} - Update Now
                      </a>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t('app.subtitle')}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              {lastRefresh && (
                <span className="text-xs text-muted-foreground">
                  {t('app.updated')} {formatLastUpdate()}
                </span>
              )}
              
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={isLoading}
                className="flex items-center space-x-2"
              >
                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                <span>{t('app.refresh')}</span>
              </Button>

              <ThemeToggle variant="dragon" />
            </div>
          </div>
        </div>
      </header>

      {/* Error Banner */}
      {error && (
        <div className="bg-destructive/10 border-b border-destructive/20">
          <div className="container mx-auto px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <AlertCircle className="h-4 w-4 text-destructive" />
                <span className="text-sm text-destructive">{error}</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleErrorDismiss}
                className="text-destructive hover:text-destructive/80"
              >
                {t('app.dismiss')}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          {/* Tab Navigation */}
          <TabsList className="grid w-full grid-cols-7 lg:w-auto lg:inline-flex dragon-scales glass-effect">
            {tabs.map((tab) => {
              const Icon = tab.icon
              const isActive = activeTab === tab.id
              return (
                <TabsTrigger
                  key={tab.id}
                  value={tab.id}
                  className={`flex items-center space-x-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-dragon-primary data-[state=active]:to-dragon-secondary data-[state=active]:text-white ${settings.showAnimations ? 'transition-all duration-300' : ''}`}
                >
                  <Icon className={`h-4 w-4 ${isActive ? 'text-white' : tab.color}`} />
                  <span className="hidden sm:inline">{tab.label}</span>
                </TabsTrigger>
              )
            })}
          </TabsList>

          {/* Tab Content */}
          <div className="min-h-[600px]">
            <TabsContent value="overview" className="space-y-6">
              <OverviewPage />
            </TabsContent>

            <TabsContent value="projects" className="space-y-6">
              <ProjectsPage />
            </TabsContent>

            <TabsContent value="sessions" className="space-y-6">
              <SessionsPage />
            </TabsContent>

            <TabsContent value="monthly" className="space-y-6">
              <MonthlyUsagePage />
            </TabsContent>

            <TabsContent value="daily" className="space-y-6">
              <DailyUsagePage />
            </TabsContent>

            <TabsContent value="active" className="space-y-6">
              <ActiveSessionPage />
            </TabsContent>

            <TabsContent value="settings" className="space-y-6">
              <SettingsPage />
            </TabsContent>
          </div>
        </Tabs>
      </main>

      {/* Footer */}
      <footer className="border-t bg-background/50">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <div className="flex items-center space-x-2">
              <span><img src="Dragon-Ui (1).svg" alt="Dragon UI" className="w-4 h-4 inline mr-1" />Dragon UI v{getAppVersion()}</span>
              <span>•</span>
              <span>{t('app.footer.builtWith')} <img src="Dragon-Ui (1).svg" alt="Dragon UI" className="w-4 h-4 inline mx-1" /> {t('app.footer.and')} ❤️ {t('app.footer.by')} KingchenC</span>
            </div>
            <div className="flex items-center space-x-4">
              <span>{t('app.footer.features')}</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default App