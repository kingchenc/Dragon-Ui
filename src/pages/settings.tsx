import { useState, useEffect } from 'react'
import { DragonCard, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { DragonBadge } from '@/components/ui/badge'
import { ThemeToggle } from '@/components/ui/theme-toggle'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { useAppStore } from '@/lib/store'
import { useTranslation } from '@/i18n'
import { getAppVersion } from '@/lib/utils'
import { 
  Settings as SettingsIcon, 
  Palette, 
  RefreshCw, 
  Clock, 
  Download, 
  Database,
  Zap,
  Shield,
  Info,
  Globe,
  DollarSign,
  FolderOpen,
  Plus,
  Calendar,
  Trash2,
  Search,
  AlertTriangle,
  Server,
  Key,
  User,
  Network
} from 'lucide-react'
import { downloadData } from '@/lib/utils'
import { SUPPORTED_CURRENCIES, currencyService } from '@/lib/currency-service'
import { SUPPORTED_LANGUAGES } from '@/i18n/languages'

// Helper function to get current billing period display
const getCurrentBillingPeriod = (billingDay: number) => {
  const now = new Date()
  const currentDay = now.getDate()
  
  // Calculate current billing period start
  let periodStart = new Date(now.getFullYear(), now.getMonth(), billingDay)
  
  // If we haven't reached this month's billing day yet, use last month's billing day
  if (currentDay < billingDay) {
    periodStart = new Date(now.getFullYear(), now.getMonth() - 1, billingDay)
  }
  
  // Calculate next billing period start
  let periodEnd = new Date(periodStart.getFullYear(), periodStart.getMonth() + 1, billingDay)
  
  // Handle months with fewer days (e.g., February 30th -> February 28th)
  if (periodEnd.getDate() !== billingDay) {
    periodEnd = new Date(periodEnd.getFullYear(), periodEnd.getMonth() + 1, 0) // Last day of month
  }
  
  const formatDate = (date: Date) => date.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric',
    year: 'numeric'
  })
  
  return `${formatDate(periodStart)} - ${formatDate(new Date(periodEnd.getTime() - 1))}`
}

export default function SettingsPage() {
  const { 
    settings, 
    updateSettings, 
    refreshCoreData,
    refreshDatabase,
    cleanupDatabase,
    isLoadingDatabase,
    databaseProgress,
    lastRefresh,
    currency,
    changeCurrency,
    exportData,
    updateSshConfig
  } = useAppStore()
  const { t } = useTranslation()
  
  // Claude paths management
  const [newCustomPath, setNewCustomPath] = useState('')
  const [pathsStatus, setPathsStatus] = useState<{
    standard: string[]
    custom: string[]
    active: string[]
  }>({ 
    standard: [], 
    custom: [], 
    active: [] 
  })
  
  // Live timezone display
  const [currentTime, setCurrentTime] = useState(new Date())
  
  // Live currency rate display
  const [currentRate, setCurrentRate] = useState<number | null>(null)
  
  // Dialog states
  const [cleanupDialogOpen, setCleanupDialogOpen] = useState(false)
  const [refreshDialogOpen, setRefreshDialogOpen] = useState(false)
  
  
  // Update current time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)
    
    return () => clearInterval(timer)
  }, [])
  
  // Update currency rate when currency changes
  useEffect(() => {
    const rate = currencyService.getCurrencyRate(currency)
    setCurrentRate(rate)
  }, [currency])
  
  // Load current paths status
  useEffect(() => {
    const loadPaths = async () => {
      try {
        const paths = await window.claudeMaxAPI.getClaudePaths()
        console.log('[PATHS] Loaded Claude paths:', paths)
        // Ensure all arrays exist with fallback to empty arrays
        setPathsStatus({
          standard: paths?.standard || [],
          custom: paths?.custom || [],
          active: paths?.active || []
        })
      } catch (error) {
        console.error('Failed to load Claude paths:', error)
        // Fallback to empty arrays on error
        setPathsStatus({
          standard: [],
          custom: [],
          active: []
        })
      }
    }
    
    loadPaths()
  }, [settings.claudePaths])

  const handleExportData = async (format: 'csv' | 'json') => {
    try {
      if (format === 'csv') {
        // Export daily usage as CSV using new store method
        const csvData = await exportData('daily', 'csv')
        const blob = new Blob([csvData], { type: 'text/csv' })
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = `dragon-ui-daily-usage-${new Date().toISOString().split('T')[0]}.csv`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        URL.revokeObjectURL(url)
      } else {
        // Export all data as JSON using new store method
        const jsonData = await exportData('all', 'json')
        downloadData(JSON.parse(jsonData), `dragon-ui-export-${new Date().toISOString().split('T')[0]}.json`)
      }
    } catch (error) {
      console.error('Export failed:', error)
      alert(t('pages.settings.dataExport.exportFailed'))
    }
  }

  const handleClearCache = async () => {
    await refreshCoreData()
  }

  const toggleAutoRefresh = () => {
    updateSettings({ autoRefresh: !settings.autoRefresh })
  }

  const updateRefreshInterval = (interval: number) => {
    updateSettings({ refreshInterval: interval })
  }

  const toggleCompactMode = () => {
    updateSettings({ compactMode: !settings.compactMode })
  }

  const toggleAnimations = () => {
    updateSettings({ showAnimations: !settings.showAnimations })
  }

  const toggleDragonEffects = () => {
    updateSettings({ dragonEffects: !settings.dragonEffects })
  }

  const toggleDevTools = async () => {
    const newValue = !settings.devToolsEnabled
    updateSettings({ devToolsEnabled: newValue })
    
    // Apply immediately
    if (window.electronAPI) {
      if (newValue) {
        await window.electronAPI.openDevTools()
      } else {
        await window.electronAPI.closeDevTools()
      }
    }
  }

  const toggleAutoUpdateNotifications = () => {
    updateSettings({ autoUpdateNotifications: !settings.autoUpdateNotifications })
  }

  const updateTimeFormat = (format: '12h' | '24h') => {
    updateSettings({ timeFormat: format })
  }

  const updateTimezone = (timezone: string) => {
    updateSettings({ timezone })
  }

  const updateCurrency = async (newCurrency: string) => {
    try {
      // Use the store's changeCurrency method which handles everything
      await changeCurrency(newCurrency)
      console.log('[CURRENCY] Currency changed successfully to:', newCurrency);
    } catch (error) {
      console.warn('[CURRENCY] Failed to change currency:', error);
      alert(t('pages.settings.advanced.currency.changeFailed'))
    }
  }
  
  // Claude paths management functions
  const handleAddCustomPath = async () => {
    if (!newCustomPath.trim()) return
    
    try {
      const success = await window.claudeMaxAPI.addCustomPath(newCustomPath.trim())
      if (success) {
        setNewCustomPath('')
        // Update settings with new paths
        const paths = await window.claudeMaxAPI.getClaudePaths()
        updateSettings({
          claudePaths: {
            standardPaths: paths.standard,
            customPaths: paths.custom,
            activePaths: paths.active
          }
        })
        setPathsStatus(paths)
      } else {
        alert(t('pages.settings.claudeProjects.customPaths.failedToAdd'))
      }
    } catch (error) {
      console.error('Error adding custom path:', error)
      alert('Failed to add path. Please check if the directory exists.')
    }
  }
  
  const handleRemoveCustomPath = async (pathToRemove: string) => {
    try {
      const success = await window.claudeMaxAPI.removeCustomPath(pathToRemove)
      if (success) {
        // Update settings with new paths
        const paths = await window.claudeMaxAPI.getClaudePaths()
        updateSettings({
          claudePaths: {
            standardPaths: paths.standard,
            customPaths: paths.custom,
            activePaths: paths.active
          }
        })
        setPathsStatus(paths)
      }
    } catch (error) {
      console.error('Error removing custom path:', error)
    }
  }
  
  const handleRefreshPaths = async () => {
    try {
      const paths = await window.claudeMaxAPI.refreshPaths()
      updateSettings({
        claudePaths: {
          standardPaths: paths.standard,
          customPaths: paths.custom,
          activePaths: paths.active
        }
      })
      setPathsStatus(paths)
      console.log('[REFRESH] Paths refreshed:', paths)
    } catch (error) {
      console.error('Error refreshing paths:', error)
    }
  }


  // SSH Configuration handlers
  const updateSshSettings = (updates: Partial<NonNullable<typeof settings.sshConfig>>) => {
    updateSshConfig(updates)
  }

  const testSshConnection = async () => {
    try {
      if (!settings.sshConfig) {
        alert('SSH configuration not available')
        return
      }
      
      console.log('Testing SSH connection:', settings.sshConfig)
      
      // Use window API for SSH connection test
      if (window.electronAPI?.invoke) {
        const result = await window.electronAPI.invoke('ssh-test-connection', settings.sshConfig)
        
        if (result.success) {
          alert(`SSH connection test successful!\n${result.message}`)
        } else {
          alert(`SSH connection test failed!\n${result.message}`)
        }
      } else {
        // Fallback for mock testing
        alert('SSH connection test successful! (Mock response - Electron API not available)')
      }
    } catch (error) {
      console.error('SSH connection test failed:', error)
      alert('SSH connection test failed!')
    }
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">{t('pages.settings.title')}</h2>
          <p className="text-muted-foreground">
            {t('pages.settings.description')}
          </p>
        </div>
      </div>

      {/* Appearance Settings */}
      <DragonCard 
        variant="gradient"
        className="transition-all duration-300 hover:scale-110 hover:shadow-lg hover:shadow-red-500/20 dragon-flame-border relative z-10 hover:z-20"
      >
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Palette className="h-5 w-5 text-dragon-primary" />
            <span>{t('pages.settings.appearance.title')}</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-semibold">{t('pages.settings.appearance.theme.title')}</h4>
              <p className="text-sm text-muted-foreground">
                {t('pages.settings.appearance.theme.description')}
              </p>
            </div>
            <ThemeToggle variant="dragon" />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-semibold">{t('pages.settings.appearance.compactMode.title')}</h4>
              <p className="text-sm text-muted-foreground">
                {t('pages.settings.appearance.compactMode.description')}
              </p>
            </div>
            <Button
              variant={settings.compactMode ? "dragon" : "outline"}
              size="sm"
              onClick={toggleCompactMode}
            >
              {settings.compactMode ? t('pages.settings.appearance.compactMode.enabled') : t('pages.settings.appearance.compactMode.disabled')}
            </Button>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <h4 className={`font-semibold ${!settings.compactMode ? 'text-muted-foreground' : ''}`}>{t('pages.settings.appearance.compactScale.title')}</h4>
              <p className="text-sm text-muted-foreground">
                {t('pages.settings.appearance.compactScale.description')}
                {!settings.compactMode && ` ${t('pages.settings.appearance.compactScale.requiresCompactMode')}`}
              </p>
            </div>
            <div className="flex items-center space-x-3">
              <div className={`relative ${!settings.compactMode ? 'opacity-50 pointer-events-none' : ''}`}>
                <input
                  type="range"
                  min="50"
                  max="100"
                  value={settings.compactScale}
                  onChange={(e) => updateSettings({ compactScale: parseInt(e.target.value) })}
                  disabled={!settings.compactMode}
                  className="w-24 h-2 rounded-lg appearance-none cursor-pointer compact-slider"
                  style={{
                    background: settings.compactMode 
                      ? `linear-gradient(to right, hsl(var(--dragon-primary)) 0%, hsl(var(--dragon-primary)) ${((settings.compactScale - 50) / 50) * 100}%, hsl(var(--muted)) ${((settings.compactScale - 50) / 50) * 100}%, hsl(var(--muted)) 100%)`
                      : 'hsl(var(--muted))'
                  }}
                />
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <span className={`text-xs font-mono px-1 rounded backdrop-blur-sm ${
                    settings.compactMode 
                      ? 'text-white bg-dragon-primary/80' 
                      : 'text-muted-foreground bg-muted/80'
                  }`}>
                    {settings.compactScale}%
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-semibold">{t('pages.settings.appearance.animations.title')}</h4>
              <p className="text-sm text-muted-foreground">
                {t('pages.settings.appearance.animations.description')}
              </p>
            </div>
            <Button
              variant={settings.showAnimations ? "dragon" : "outline"}
              size="sm"
              onClick={toggleAnimations}
            >
              {settings.showAnimations ? t('pages.settings.appearance.animations.enabled') : t('pages.settings.appearance.animations.disabled')}
            </Button>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-semibold">{t('pages.settings.appearance.dragonEffects.title')}</h4>
              <p className="text-sm text-muted-foreground">
                {t('pages.settings.appearance.dragonEffects.description')}
              </p>
            </div>
            <Button
              variant={settings.dragonEffects ? "dragon" : "outline"}
              size="sm"
              onClick={toggleDragonEffects}
            >
              {settings.dragonEffects ? t('pages.settings.appearance.dragonEffects.enabled') : t('pages.settings.appearance.dragonEffects.disabled')}
            </Button>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-semibold">Developer Tools</h4>
              <p className="text-sm text-muted-foreground">
                Enable automatic opening of developer tools (F12 always works)
              </p>
            </div>
            <Button
              variant={settings.devToolsEnabled ? "dragon" : "outline"}
              size="sm"
              onClick={toggleDevTools}
            >
              {settings.devToolsEnabled ? 'Enabled' : 'Disabled'}
            </Button>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-semibold">Auto-Update Notifications</h4>
              <p className="text-sm text-muted-foreground">
                Show popup when new Dragon UI version is available
              </p>
            </div>
            <Button
              variant={settings.autoUpdateNotifications ? "dragon" : "outline"}
              size="sm"
              onClick={toggleAutoUpdateNotifications}
            >
              {settings.autoUpdateNotifications ? 'Enabled' : 'Disabled'}
            </Button>
          </div>
        </CardContent>
      </DragonCard>

      {/* Billing Cycle Settings */}
      <DragonCard 
        variant="gradient"
        className="transition-all duration-300 hover:scale-110 hover:shadow-lg hover:shadow-red-500/20 dragon-flame-border relative z-10 hover:z-20"
      >
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Calendar className="h-5 w-5 text-dragon-accent" />
            <span>{t('pages.settings.billingCycle.title')}</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-semibold">{t('pages.settings.billingCycle.billingCycleStartDay.title')}</h4>
              <p className="text-sm text-muted-foreground">
                {t('pages.settings.billingCycle.billingCycleStartDay.description')}
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <select 
                className="bg-background border border-border rounded px-3 py-2 text-sm"
                value={settings.billingCycleDay || 1}
                onChange={(e) => updateSettings({ billingCycleDay: parseInt(e.target.value) })}
              >
                {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
                  <option key={day} value={day}>
                    {day === 1 ? t('pages.settings.billingCycle.options.firstOfMonth') : 
                     day === 2 ? t('pages.settings.billingCycle.options.secondOfMonth') :
                     day === 3 ? t('pages.settings.billingCycle.options.thirdOfMonth') :
                     `${day}${t('pages.settings.billingCycle.options.nthOfMonth')}`}
                  </option>
                ))}
              </select>
            </div>
          </div>
          
          <div className="bg-muted/50 p-4 rounded-lg">
            <p className="text-sm text-muted-foreground">
              <strong>{t('pages.settings.billingCycle.currentBillingPeriod')}:</strong> {getCurrentBillingPeriod(settings.billingCycleDay || 1)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {t('pages.settings.billingCycle.billingPeriodNote')}
            </p>
          </div>
        </CardContent>
      </DragonCard>

      {/* Data & Refresh Settings */}
      <DragonCard 
        variant="scales"
        className="transition-all duration-300 hover:scale-110 hover:shadow-lg hover:shadow-red-500/20 dragon-flame-border relative z-10 hover:z-20"
      >
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <RefreshCw className="h-5 w-5 text-dragon-secondary" />
            <span>{t('pages.settings.dataRefresh.title')}</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-semibold">{t('pages.settings.dataRefresh.autoRefresh.title')}</h4>
              <p className="text-sm text-muted-foreground">
                {t('pages.settings.dataRefresh.autoRefresh.description')}
              </p>
            </div>
            <Button
              variant={settings.autoRefresh ? "dragon" : "outline"}
              size="sm"
              onClick={toggleAutoRefresh}
            >
              {settings.autoRefresh ? t('pages.settings.dataRefresh.autoRefresh.on') : t('pages.settings.dataRefresh.autoRefresh.off')}
            </Button>
          </div>

          {settings.autoRefresh && (
            <div>
              <h4 className="font-semibold mb-3">{t('pages.settings.dataRefresh.refreshInterval.title')}</h4>
              <div className="grid grid-cols-4 gap-2">
                {[30, 60, 120, 300, 600, 900, 1800, 3600].map((interval) => (
                  <Button
                    key={interval}
                    variant={settings.refreshInterval === interval ? "dragon" : "outline"}
                    size="sm"
                    onClick={() => updateRefreshInterval(interval)}
                    className="text-xs"
                  >
                    {interval < 60 ? `${interval}s` : 
                     interval < 3600 ? `${interval / 60}m` : 
                     `${interval / 3600}h`}
                  </Button>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-semibold">{t('pages.settings.dataRefresh.manualRefresh.title')}</h4>
              <p className="text-sm text-muted-foreground">
                {t('pages.settings.dataRefresh.manualRefresh.description')}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleClearCache}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              {t('pages.settings.dataRefresh.manualRefresh.refreshNow')}
            </Button>
          </div>

          {lastRefresh && (
            <div className="text-xs text-muted-foreground pt-2 border-t border-border/50">
              {t('pages.settings.dataRefresh.lastUpdated')}: {new Date(lastRefresh).toLocaleString('en-US', {
                timeZone: settings.timezone === 'auto' ? undefined : settings.timezone,
                hour12: settings.timeFormat === '12h'
              })}
            </div>
          )}
        </CardContent>
      </DragonCard>




      {/* Advanced Settings */}
      <DragonCard 
        variant="default"
        className="transition-all duration-300 hover:scale-110 hover:shadow-lg hover:shadow-red-500/20 dragon-flame-border relative z-10 hover:z-20"
      >
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <SettingsIcon className="h-5 w-5 text-dragon-accent" />
            <span>{t('pages.settings.advanced.title')}</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-semibold">{t('pages.settings.advanced.timeFormat.title')}</h4>
              <p className="text-sm text-muted-foreground">
                {t('pages.settings.advanced.timeFormat.description')}
              </p>
            </div>
            <div className="flex space-x-2">
              <Button
                variant={settings.timeFormat === '12h' ? "dragon" : "outline"}
                size="sm"
                onClick={() => updateTimeFormat('12h')}
              >
                {t('pages.settings.advanced.timeFormat.12hour')}
              </Button>
              <Button
                variant={settings.timeFormat === '24h' ? "dragon" : "outline"}
                size="sm"
                onClick={() => updateTimeFormat('24h')}
              >
                {t('pages.settings.advanced.timeFormat.24hour')}
              </Button>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-semibold">{t('pages.settings.advanced.timezone.title')}</h4>
                <p className="text-sm text-muted-foreground">
                  {t('pages.settings.advanced.timezone.description')}
                </p>
              </div>
              <div className="flex items-center space-x-2 text-sm">
                <Globe className="h-4 w-4 text-dragon-primary" />
                <div className="text-right">
                  <div className="font-mono">
                    {currentTime.toLocaleString('en-US', {
                      timeZone: settings.timezone === 'auto' ? Intl.DateTimeFormat().resolvedOptions().timeZone : settings.timezone,
                      hour12: settings.timeFormat === '12h',
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                      hourCycle: settings.timeFormat === '12h' ? 'h12' : 'h23'
                    })}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {settings.timezone === 'auto' ? Intl.DateTimeFormat().resolvedOptions().timeZone : settings.timezone}
                  </div>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {[
                { value: 'auto', label: t('pages.settings.advanced.timezone.auto') },
                { value: 'UTC', label: 'UTC' },
                { value: 'America/New_York', label: 'EST' },
                { value: 'America/Los_Angeles', label: 'PST' },
                { value: 'Europe/London', label: 'GMT' },
                { value: 'Europe/Berlin', label: 'CET' },
                { value: 'Asia/Tokyo', label: 'JST' },
                { value: 'Australia/Sydney', label: 'AEST' }
              ].map((tz) => (
                <Button
                  key={tz.value}
                  variant={settings.timezone === tz.value ? "dragon" : "outline"}
                  size="sm"
                  onClick={() => updateTimezone(tz.value)}
                  className="text-xs"
                >
                  {tz.label}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-semibold">{t('pages.settings.advanced.language.title')}</h4>
                <p className="text-sm text-muted-foreground">
                  {t('pages.settings.advanced.language.description')}
                </p>
              </div>
              <div className="flex items-center space-x-2 text-sm">
                <Globe className="h-4 w-4 text-dragon-primary" />
                <div className="text-right">
                  <div className="font-mono">
                    {SUPPORTED_LANGUAGES.find(lang => lang.code === (settings.language || 'en'))?.name || 'English'}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {t('pages.settings.advanced.language.interfaceLanguage')}
                  </div>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {SUPPORTED_LANGUAGES.map((lang) => (
                <Button
                  key={lang.code}
                  variant={(settings.language || 'en') === lang.code ? "dragon" : "outline"}
                  size="sm"
                  onClick={() => updateSettings({ language: lang.code })}
                  className="text-xs flex items-center space-x-1"
                >
                  <span>{lang.flag}</span>
                  <span>{lang.code.toUpperCase()}</span>
                  <span className="hidden md:inline">{lang.name}</span>
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-semibold">{t('pages.settings.advanced.currency.title')}</h4>
                <p className="text-sm text-muted-foreground">
                  {t('pages.settings.advanced.currency.description')}
                </p>
              </div>
              <div className="flex items-center space-x-2 text-sm">
                <DollarSign className="h-4 w-4 text-dragon-accent" />
                <div className="text-right">
                  <div className="font-mono">
                    1 USD = {currentRate ? currentRate.toFixed(4) : '1.0000'} {currency}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {currencyService.getCurrencyInfo(currency)?.name || currency}
                  </div>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {SUPPORTED_CURRENCIES.map((currencyOption) => (
                <Button
                  key={currencyOption.code}
                  variant={currency === currencyOption.code ? "dragon" : "outline"}
                  size="sm"
                  onClick={() => updateCurrency(currencyOption.code)}
                  className="text-xs flex items-center space-x-1"
                >
                  <span>{currencyOption.flag}</span>
                  <span>{currencyOption.code}</span>
                  <span className="hidden md:inline">({currencyOption.symbol})</span>
                </Button>
              ))}
            </div>
          </div>

        </CardContent>
      </DragonCard>

      {/* Claude Projects Settings */}
      <DragonCard 
        variant="gradient"
        className="transition-all duration-300 hover:scale-110 hover:shadow-lg hover:shadow-red-500/20 dragon-flame-border relative z-10 hover:z-20"
      >
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <FolderOpen className="h-5 w-5 text-dragon-primary" />
            <span>{t('pages.settings.claudeProjects.title')}</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-semibold">{t('pages.settings.claudeProjects.projectPaths.title')}</h4>
              <p className="text-sm text-muted-foreground">
                {t('pages.settings.claudeProjects.projectPaths.description')}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefreshPaths}
            >
              <Search className="h-4 w-4 mr-2" />
              {t('pages.settings.claudeProjects.projectPaths.refresh')}
            </Button>
          </div>

          {/* Standard Paths */}
          <div className="space-y-3">
            <h5 className="font-medium text-sm text-dragon-primary">{t('pages.settings.claudeProjects.standardPaths.title')}</h5>
            {pathsStatus.standard.length > 0 ? (
              <div className="space-y-2">
                {pathsStatus.standard.map((path, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <FolderOpen className="h-4 w-4 text-dragon-primary" />
                      <div>
                        <p className="font-mono text-sm">{path}</p>
                        <p className="text-xs text-muted-foreground">
                          {path.includes('.config') ? t('pages.settings.claudeProjects.standardPaths.newFormat') : t('pages.settings.claudeProjects.standardPaths.legacyFormat')}
                        </p>
                      </div>
                    </div>
                    <DragonBadge variant="dragon" className="text-xs">
                      {t('pages.settings.claudeProjects.standardPaths.active')}
                    </DragonBadge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-4 text-center text-muted-foreground bg-muted/30 rounded-lg">
                <p className="text-sm">{t('pages.settings.claudeProjects.standardPaths.noStandardPaths')}</p>
                <p className="text-xs mt-1">
                  {t('pages.settings.claudeProjects.standardPaths.expectedPaths')}
                </p>
              </div>
            )}
          </div>

          {/* Custom Paths */}
          <div className="space-y-3">
            <h5 className="font-medium text-sm text-dragon-accent">{t('pages.settings.claudeProjects.customPaths.title')}</h5>
            
            {/* Add Custom Path */}
            <div className="flex space-x-2">
              <input
                type="text"
                value={newCustomPath}
                onChange={(e) => setNewCustomPath(e.target.value)}
                placeholder={t('pages.settings.claudeProjects.customPaths.placeholder')}
                className="flex-1 px-3 py-2 bg-background border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-dragon-primary"
                onKeyDown={(e) => e.key === 'Enter' && handleAddCustomPath()}
              />
              <Button
                variant="dragon"
                size="sm"
                onClick={handleAddCustomPath}
                disabled={!newCustomPath.trim()}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            {/* Existing Custom Paths */}
            {pathsStatus.custom.length > 0 ? (
              <div className="space-y-2">
                {pathsStatus.custom.map((path, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <FolderOpen className="h-4 w-4 text-dragon-accent" />
                      <div>
                        <p className="font-mono text-sm">{path}</p>
                        <p className="text-xs text-muted-foreground">{t('pages.settings.claudeProjects.customPaths.customPath')}</p>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRemoveCustomPath(path)}
                      className="text-red-500 hover:text-red-600 hover:border-red-500"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-3 text-center text-muted-foreground bg-muted/20 rounded-lg">
                <p className="text-sm">{t('pages.settings.claudeProjects.customPaths.noCustomPaths')}</p>
              </div>
            )}
          </div>

          {/* Active Paths Summary */}
          <div className="pt-4 border-t border-border/50">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {t('pages.settings.claudeProjects.activePathsSummary.totalActivePaths')}: {pathsStatus.active.length}
              </span>
              <DragonBadge variant="outline" className="text-xs">
                {pathsStatus.active.length > 0 ? t('pages.settings.claudeProjects.activePathsSummary.monitoring') : t('pages.settings.claudeProjects.activePathsSummary.noPaths')}
              </DragonBadge>
            </div>
          </div>
        </CardContent>
      </DragonCard>

      {/* SSH Support */}
      <DragonCard 
        variant="flame"
        className="transition-all duration-300 hover:scale-110 hover:shadow-lg hover:shadow-red-500/20 dragon-flame-border relative z-10 hover:z-20"
      >
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Server className="h-5 w-5 text-white" />
            <span>{t('pages.settings.sshSupport.title')}</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-semibold text-white">{t('pages.settings.sshSupport.enable.title')}</h4>
              <p className="text-sm text-white/80">
                {t('pages.settings.sshSupport.enable.description')}
              </p>
            </div>
            <Button
              variant={settings.sshConfig?.enabled ? "dragon" : "outline"}
              size="sm"
              onClick={() => updateSshSettings({ enabled: !settings.sshConfig?.enabled })}
            >
              {settings.sshConfig?.enabled ? t('pages.settings.sshSupport.enable.enabled') : t('pages.settings.sshSupport.enable.disabled')}
            </Button>
          </div>

          {settings.sshConfig?.enabled && (
            <div className="space-y-4 pt-4 border-t border-white/20">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-white mb-2">
                    <Network className="h-4 w-4 inline mr-1" />
                    {t('pages.settings.sshSupport.config.host')}
                  </label>
                  <input
                    type="text"
                    value={settings.sshConfig?.host || ''}
                    onChange={(e) => updateSshSettings({ host: e.target.value })}
                    placeholder={t('pages.settings.sshSupport.config.hostPlaceholder')}
                    className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-md text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-white/30"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-white mb-2">
                    <Server className="h-4 w-4 inline mr-1" />
                    {t('pages.settings.sshSupport.config.port')}
                  </label>
                  <input
                    type="number"
                    value={settings.sshConfig?.port || 22}
                    onChange={(e) => updateSshSettings({ port: parseInt(e.target.value) || 22 })}
                    placeholder="22"
                    className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-md text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-white/30"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-white mb-2">
                    <User className="h-4 w-4 inline mr-1" />
                    {t('pages.settings.sshSupport.config.username')}
                  </label>
                  <input
                    type="text"
                    value={settings.sshConfig?.username || ''}
                    onChange={(e) => updateSshSettings({ username: e.target.value })}
                    placeholder={t('pages.settings.sshSupport.config.usernamePlaceholder')}
                    className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-md text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-white/30"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-white mb-2">
                    <Key className="h-4 w-4 inline mr-1" />
                    {t('pages.settings.sshSupport.config.password')}
                  </label>
                  <input
                    type="password"
                    value={settings.sshConfig?.password || ''}
                    onChange={(e) => updateSshSettings({ password: e.target.value })}
                    placeholder="••••••••"
                    className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-md text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-white/30"
                  />
                </div>
              </div>
              
              <div className="flex space-x-3 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={testSshConnection}
                  className="bg-blue-500/20 border-blue-500/30 text-white hover:bg-blue-500/30"
                >
                  <Network className="h-4 w-4 mr-2" />
                  {t('pages.settings.sshSupport.actions.testConnection')}
                </Button>
              </div>
              
              <div className="mt-4 p-3 bg-white/5 border border-white/10 rounded-md">
                <p className="text-xs text-white/60">
                  {t('pages.settings.sshSupport.note')}
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </DragonCard>


      {/* Database Management */}
      <DragonCard 
        variant="flame"
        className="transition-all duration-300 hover:scale-110 hover:shadow-lg hover:shadow-orange-500/20 dragon-flame-border relative z-10 hover:z-20"
      >
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Database className="h-5 w-5 text-dragon-flame" />
            <span>{t('pages.settings.database.title', 'Database Management')}</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Database Status */}
          <div className="p-4 bg-muted/30 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-semibold">{t('pages.settings.database.status.title', 'Database Status')}</h4>
                <p className="text-sm text-muted-foreground">
                  {isLoadingDatabase ? 
                    t('pages.settings.database.status.processing', 'Processing...') : 
                    t('pages.settings.database.status.ready', 'Ready')
                  }
                </p>
              </div>
              <DragonBadge variant={isLoadingDatabase ? "outline" : "dragon"}>
                {isLoadingDatabase ? t('pages.settings.database.status.busy', 'Busy') : t('pages.settings.database.status.online', 'Online')}
              </DragonBadge>
            </div>
            
            {/* Progress Indicator */}
            {isLoadingDatabase && databaseProgress && (
              <div className="mt-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span>{databaseProgress.step}</span>
                  <span>{databaseProgress.progress}%</span>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div 
                    className="bg-dragon-flame h-2 rounded-full transition-all duration-300"
                    style={{ width: `${databaseProgress.progress}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{databaseProgress.message}</span>
                  {databaseProgress.timeRemaining && (
                    <span>
                      {t('pages.overview.database.timeRemaining', 'Time remaining')}: {Math.ceil(databaseProgress.timeRemaining / 1000)}s
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Database Actions */}
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <h4 className="font-semibold mb-2">{t('pages.settings.database.cleanup.title', 'Data Cleanup')}</h4>
              <p className="text-sm text-muted-foreground mb-3">
                {t('pages.settings.database.cleanup.description', 'Remove corrupted timestamps and phantom entries')}
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCleanupDialogOpen(true)}
                disabled={isLoadingDatabase}
                className="w-full"
              >
                {isLoadingDatabase ? (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4 mr-2" />
                )}
                {t('pages.settings.database.cleanup.action', 'Clean Database')}
              </Button>
            </div>
            
            <div>
              <h4 className="font-semibold mb-2">{t('pages.settings.database.refresh.title', 'Full Refresh')}</h4>
              <p className="text-sm text-muted-foreground mb-3">
                {t('pages.settings.database.refresh.description', 'Clear and reload all data from files')}
              </p>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setRefreshDialogOpen(true)}
                disabled={isLoadingDatabase}
                className="w-full"
              >
                {isLoadingDatabase ? (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                {t('pages.settings.database.refresh.action', 'Refresh Database')}
              </Button>
            </div>
          </div>

          {/* Warning */}
          <div className="flex items-start space-x-3 p-3 bg-orange-500/10 border border-orange-500/20 rounded-lg">
            <AlertTriangle className="h-5 w-5 text-orange-500 flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-orange-800 dark:text-orange-200">
                {t('pages.settings.database.warning.title', 'Warning')}
              </p>
              <p className="text-orange-700 dark:text-orange-300">
                {t('pages.settings.database.warning.message', 'Database operations may take time and will temporarily interrupt data collection.')}
              </p>
            </div>
          </div>
        </CardContent>
      </DragonCard>

      {/* Data Export */}
      <DragonCard 
        variant="scales"
        className="transition-all duration-300 hover:scale-110 hover:shadow-lg hover:shadow-red-500/20 dragon-flame-border relative z-10 hover:z-20"
      >
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Download className="h-5 w-5 text-dragon-secondary" />
            <span>{t('pages.settings.dataExport.title')}</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h4 className="font-semibold mb-2">{t('pages.settings.dataExport.exportUsageData.title')}</h4>
            <p className="text-sm text-muted-foreground mb-4">
              {t('pages.settings.dataExport.exportUsageData.description')}
            </p>
            <div className="flex space-x-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleExportData('csv')}
              >
                <Download className="h-4 w-4 mr-2" />
                {t('pages.settings.dataExport.exportUsageData.exportCsv')}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleExportData('json')}
              >
                <Download className="h-4 w-4 mr-2" />
                {t('pages.settings.dataExport.exportUsageData.exportJson')}
              </Button>
            </div>
          </div>
        </CardContent>
      </DragonCard>

      {/* About */}
      <DragonCard 
        variant="gradient"
        className="transition-all duration-300 hover:scale-110 hover:shadow-lg hover:shadow-red-500/20 dragon-flame-border relative z-10 hover:z-20"
      >
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Info className="h-5 w-5 text-dragon-primary" />
            <span>{t('pages.settings.about.title')}</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <h4 className="font-semibold mb-2">{t('pages.settings.about.features.title')}</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li className="flex items-center space-x-2">
                  <Zap className="h-3 w-3" />
                  <span>{t('pages.settings.about.features.realTimeMonitoring')}</span>
                </li>
                <li className="flex items-center space-x-2">
                  <Database className="h-3 w-3" />
                  <span>{t('pages.settings.about.features.backgroundServices')}</span>
                </li>
                <li className="flex items-center space-x-2">
                  <Shield className="h-3 w-3" />
                  <span>{t('pages.settings.about.features.multiCurrencySupport')}</span>
                </li>
                <li className="flex items-center space-x-2">
                  <Clock className="h-3 w-3" />
                  <span>{t('pages.settings.about.features.ramCaching')}</span>
                </li>
                <li className="flex items-center space-x-2">
                  <Globe className="h-3 w-3" />
                  <span>{t('pages.settings.about.features.multiLanguageSupport')}</span>
                </li>
                <li className="flex items-center space-x-2">
                  <Database className="h-3 w-3" />
                  <span>{t('pages.settings.about.features.databaseManagement')}</span>
                </li>
                <li className="flex items-center space-x-2">
                  <Download className="h-3 w-3" />
                  <span>{t('pages.settings.about.features.dataExport')}</span>
                </li>
                <li className="flex items-center space-x-2">
                  <RefreshCw className="h-3 w-3" />
                  <span>{t('pages.settings.about.features.liveLanguageSwitching')}</span>
                </li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold mb-2">{t('pages.settings.about.technology.title')}</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• {t('pages.settings.about.technology.electronReact')}</li>
                <li>• {t('pages.settings.about.technology.typescript')}</li>
                <li>• {t('pages.settings.about.technology.backgroundCollector')}</li>
                <li>• {t('pages.settings.about.technology.dragonDesign')}</li>
                <li>• {t('pages.settings.about.technology.crossPlatform')}</li>
                <li>• {t('pages.settings.about.technology.i18nSystem')}</li>
                <li>• {t('pages.settings.about.technology.zustandStore')}</li>
                <li>• {t('pages.settings.about.technology.tailwindCSS')}</li>
              </ul>
            </div>
          </div>

          <div className="pt-4 border-t border-white/10">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Dragon UI v{getAppVersion()}</span>
              <span className="text-muted-foreground">{t('pages.settings.about.builtWith')} <img src="Dragon-Ui (1).svg" alt="Dragon UI" className="w-4 h-4 inline mx-1" /> {t('pages.settings.about.and')} ❤️ {t('pages.settings.about.by')} KingchenC</span>
            </div>
          </div>
        </CardContent>
      </DragonCard>

      {/* SSH Support */}

      {/* Cleanup Database Dialog */}
      <Dialog open={cleanupDialogOpen} onOpenChange={setCleanupDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <Trash2 className="h-5 w-5 text-orange-500" />
              <span>{t('pages.settings.database.cleanup.confirmTitle', 'Clean Database')}</span>
            </DialogTitle>
            <DialogDescription>
              {t('pages.settings.database.cleanup.confirmMessage', 'This will remove corrupted timestamps and phantom entries from the database. This action cannot be undone.')}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-6">
            <Button
              variant="outline"
              onClick={() => setCleanupDialogOpen(false)}
              className="mr-2"
            >
              {t('pages.settings.database.cleanup.cancel', 'Cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                cleanupDatabase()
                setCleanupDialogOpen(false)
              }}
              className="bg-orange-500 hover:bg-orange-600"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              {t('pages.settings.database.cleanup.confirm', 'Clean Database')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Refresh Database Dialog */}
      <Dialog open={refreshDialogOpen} onOpenChange={setRefreshDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <RefreshCw className="h-5 w-5 text-red-500" />
              <span>{t('pages.settings.database.refresh.confirmTitle', 'Refresh Database')}</span>
            </DialogTitle>
            <DialogDescription>
              {t('pages.settings.database.refresh.confirmMessage', 'This will clear ALL data from the database and reload it from files. This process may take several minutes and cannot be undone.')}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-6">
            <Button
              variant="outline"
              onClick={() => setRefreshDialogOpen(false)}
              className="mr-2"
            >
              {t('pages.settings.database.refresh.cancel', 'Cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                refreshDatabase()
                setRefreshDialogOpen(false)
              }}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              {t('pages.settings.database.refresh.confirm', 'Refresh Database')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  )
}