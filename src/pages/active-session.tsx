import React from 'react'
import { DragonCard, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { DragonBadge } from '@/components/ui/badge'
import { DragonProgress } from '@/components/ui/progress'
import { DragonLoading } from '@/components/ui/loading'
import { Button } from '@/components/ui/button'
import { useActiveData } from '@/lib/store'
import { useTranslation } from '@/i18n'
import { 
  Activity, 
  Clock, 
  DollarSign, 
  Zap, 
  MessageSquare, 
  RefreshCw,
  Play,
  Pause,
  Target,
  TrendingUp
} from 'lucide-react'
import { formatCurrency, formatNumber, getRelativeTime } from '@/lib/utils'

export default function ActiveSessionPage() {
  // Simple store read - no calculations needed!
  const { data: activeData, isLoading, refresh } = useActiveData()
  const { t } = useTranslation()

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <DragonLoading size="lg" text={t('pages.activeSession.loadingActiveSession')} />
      </div>
    )
  }

  if (!activeData) {
    return (
      <div className="text-center py-12">
        <Activity className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
        <p className="text-muted-foreground">{t('pages.activeSession.noActiveSessionData')}</p>
        <p className="text-xs text-muted-foreground mt-2">
          {t('pages.activeSession.sessionDataWillAppear')}
        </p>
      </div>
    )
  }

  // All data comes pre-calculated from store.ts!
  const { 
    sessionActive, 
    currentCost, 
    timeLeft, 
    duration, 
    sessionId, 
    status, 
    lastActivity,
    currency 
  } = activeData

  // Calculate additional metrics similar to CLI
  const sessionProgress = duration && timeLeft ? (duration / (duration + timeLeft)) * 100 : 0
  const totalSessionTime = 300 // 5 hours = 300 minutes (fixed total)
  const tokenBurnRate = duration > 0 ? Math.round((activeData.currentTokens || 0) / duration) : 0
  const projectedTokens = tokenBurnRate > 0 ? Math.round(tokenBurnRate * totalSessionTime) : 0
  
  // Calculate cost per token from current session
  const costPerToken = (activeData.currentTokens || 0) > 0 ? (currentCost || 0) / (activeData.currentTokens || 0) : 0
  const projectedCost = costPerToken > 0 ? projectedTokens * costPerToken : 0
  
  // Calculate usage progress (token burn rate intensity)
  const highActivityThreshold = 150000 // tokens/min for high activity
  const usageProgress = Math.min(100, (tokenBurnRate / highActivityThreshold) * 100)
  
  // Calculate projection progress (current vs projected end-of-session)
  const projectionProgress = Math.min(100, projectedTokens > 0 ? ((activeData.currentTokens || 0) / projectedTokens) * 100 : 0)
  
  console.log(`[DEBUG] Progress Values: Session=${sessionProgress.toFixed(1)}%, Usage=${usageProgress.toFixed(1)}%, Projection=${projectionProgress.toFixed(1)}%`)
  console.log(`[DEBUG] Projection Debug: Current=${formatNumber(activeData.currentTokens || 0)} tokens, Cost=${formatCurrency(currentCost || 0, currency)}, Rate=${costPerToken.toFixed(6)}/token, Projected=${formatNumber(projectedTokens)} tokens, Cost=${formatCurrency(projectedCost, currency)}`)

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">{t('pages.activeSession.title')}</h2>
          <p className="text-muted-foreground">
            {t('pages.activeSession.description')} ({currency})
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={refresh}
            className="flex items-center space-x-2"
          >
            <RefreshCw className="h-4 w-4" />
            <span>{t('pages.activeSession.refresh')}</span>
          </Button>
          <DragonBadge 
            variant={sessionActive ? "dragon" : "default"}
            className="flex items-center space-x-1"
          >
            {sessionActive ? <Play className="h-3 w-3" /> : <Pause className="h-3 w-3" />}
            <span>{sessionActive ? t('pages.activeSession.status.active') : t('pages.activeSession.status.idle')}</span>
          </DragonBadge>
        </div>
      </div>

      {/* CLI-Style Session Progress */}
      {sessionActive && (
        <DragonCard 
          variant="flame" 
          className="mb-6 transition-all duration-300 hover:scale-110 hover:shadow-lg hover:shadow-red-500/20 dragon-flame-border relative z-10 hover:z-20"
        >
          <CardContent className="p-6">
            <div className="space-y-4">
              {/* Session Progress Bar */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <h3 className="text-lg font-bold text-white flex items-center space-x-2">
                    <Clock className="h-5 w-5" />
                    <span>{t('pages.activeSession.progress.session')}</span>
                  </h3>
                  <span className="text-white/80 font-mono">{sessionProgress.toFixed(1)}%</span>
                </div>
                <DragonProgress value={sessionProgress} className="h-3 mb-2" />
                <div className="flex justify-between text-sm text-white/80">
                  <span>{t('pages.activeSession.progress.started')}: {lastActivity ? new Date(lastActivity).toLocaleTimeString() : t('pages.activeSession.progress.unknown')}</span>
                  <span>{t('pages.activeSession.progress.remaining')}: {timeLeft ? `${Math.floor(timeLeft / 60)}h ${timeLeft % 60}m` : 'N/A'}</span>
                </div>
              </div>

              {/* Token Usage Bar */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <h3 className="text-lg font-bold text-white flex items-center space-x-2">
                    <Zap className="h-5 w-5" />
                    <span>{t('pages.activeSession.progress.usage')}</span>
                  </h3>
                  <span className="text-white/80">({formatNumber(activeData.currentTokens || 0)} tokens)</span>
                </div>
                <DragonProgress value={usageProgress} className="h-3 mb-2" />
                <div className="flex justify-between text-sm text-white/80">
                  <span>{t('pages.activeSession.progress.tokens')}: {formatNumber(activeData.currentTokens || 0)} ({t('pages.activeSession.progress.burnRate')}: {tokenBurnRate} {t('pages.activeSession.progress.tokenPerMin')} {tokenBurnRate > 100 ? `[${t('pages.activeSession.progress.high')}]` : `[${t('pages.activeSession.progress.normal')}]`})</span>
                  <span>{t('pages.activeSession.progress.cost')}: {formatCurrency(currentCost || 0, currency)}</span>
                </div>
              </div>

              {/* Projection Bar */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <h3 className="text-lg font-bold text-white flex items-center space-x-2">
                    <TrendingUp className="h-5 w-5" />
                    <span>{t('pages.activeSession.progress.projection')}</span>
                  </h3>
                  <span className="text-white/80">({formatNumber(projectedTokens)} tokens)</span>
                </div>
                <DragonProgress value={projectionProgress} className="h-3 mb-2" />
                <div className="flex justify-between text-sm text-white/80">
                  <span>{t('pages.activeSession.progress.status')}: {tokenBurnRate > 100 ? `[${t('pages.activeSession.progress.highBurn')}]` : `[${t('pages.activeSession.progress.onTrack')}]`}</span>
                  <span>{t('pages.activeSession.progress.tokens')}: {formatNumber(projectedTokens)} / {t('pages.activeSession.progress.cost')}: {formatCurrency(projectedCost, currency)}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </DragonCard>
      )}

      {/* Unified Session Overview */}
      {sessionActive ? (
        <div className="grid gap-6 md:grid-cols-2">
          {/* Session Status & Info */}
          <DragonCard 
            variant="scales"
            className="transition-all duration-300 hover:scale-110 hover:shadow-lg hover:shadow-red-500/20 dragon-flame-border relative z-10 hover:z-20"
          >
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Activity className="h-5 w-5 text-dragon-primary" />
                <span>{t('pages.activeSession.overview.title')}</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Key Metrics Grid */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-3 rounded-lg bg-dragon-primary/10">
                    <DollarSign className="h-5 w-5 mx-auto mb-1 text-dragon-primary" />
                    <p className="text-lg font-bold">{formatCurrency(currentCost || 0, currency)}</p>
                    <p className="text-xs text-muted-foreground">{t('pages.activeSession.overview.sessionCost')}</p>
                  </div>
                  
                  <div className="text-center p-3 rounded-lg bg-dragon-secondary/10">
                    <Zap className="h-5 w-5 mx-auto mb-1 text-dragon-secondary" />
                    <p className="text-lg font-bold">{formatNumber(activeData.currentTokens || 0)}</p>
                    <p className="text-xs text-muted-foreground">{t('pages.activeSession.overview.tokensUsed')}</p>
                  </div>
                </div>

                {/* Session Progress */}
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span>{t('pages.activeSession.overview.sessionProgress')}</span>
                    <span>{sessionProgress.toFixed(1)}%</span>
                  </div>
                  <DragonProgress value={sessionProgress} className="h-2 mb-2" />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{duration ? `${Math.floor(duration / 60)}h ${duration % 60}m` : '0m'} {t('pages.activeSession.overview.used')}</span>
                    <span>{timeLeft ? `${Math.floor(timeLeft / 60)}h ${timeLeft % 60}m` : 'N/A'} {t('pages.activeSession.overview.left')}</span>
                  </div>
                </div>

                {/* Session Details */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">{t('pages.activeSession.overview.status')}</span>
                    <DragonBadge variant="dragon" className="text-xs">
                      <Activity className="h-3 w-3 mr-1" />
                      {status}
                    </DragonBadge>
                  </div>
                  
                  {sessionId && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">{t('pages.activeSession.overview.sessionId')}</span>
                      <span className="font-mono text-xs">{sessionId.substring(0, 8)}...</span>
                    </div>
                  )}

                  {lastActivity && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">{t('pages.activeSession.overview.lastActivity')}</span>
                      <span className="text-sm">{getRelativeTime(lastActivity)}</span>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </DragonCard>

          {/* Performance & Projections */}
          <DragonCard 
            variant="gradient"
            className="transition-all duration-300 hover:scale-110 hover:shadow-lg hover:shadow-red-500/20 dragon-flame-border relative z-10 hover:z-20"
          >
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <TrendingUp className="h-5 w-5 text-dragon-secondary" />
                <span>{t('pages.activeSession.performance.title')}</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Burn Rate Status */}
                <div className="p-3 rounded-lg bg-muted/20">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium">{t('pages.activeSession.performance.tokenBurnRate')}</span>
                    <span className={`text-sm font-bold ${tokenBurnRate > 100 ? 'text-red-500' : 'text-green-500'}`}>
                      {tokenBurnRate > 100 ? `[${t('pages.activeSession.performance.high')}]` : `[${t('pages.activeSession.performance.normal')}]`}
                    </span>
                  </div>
                  <p className="text-lg font-bold font-mono">{formatNumber(tokenBurnRate)} {t('pages.activeSession.performance.tokensPerMin')}</p>
                </div>

                {/* Full Session Projections */}
                <div className="space-y-3">
                  <h4 className="font-semibold text-sm">{t('pages.activeSession.performance.fullSessionProjection')}:</h4>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">{t('pages.activeSession.performance.projectedTokens')}</span>
                      <span className="font-medium font-mono">{formatNumber(projectedTokens)}</span>
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">{t('pages.activeSession.performance.projectedCost')}</span>
                      <span className="font-medium text-dragon-accent">{formatCurrency(projectedCost, currency)}</span>
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">{t('pages.activeSession.performance.costVsCurrent')}</span>
                      <span className="font-medium">
                        +{formatCurrency(projectedCost - (currentCost || 0), currency)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Performance Indicator */}
                <div className="pt-3 border-t border-border/50">
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground mb-1">{t('pages.activeSession.performance.sessionPerformance')}</p>
                    <DragonBadge 
                      variant={tokenBurnRate > 100 ? "destructive" : "dragon"}
                      className="text-xs"
                    >
                      {tokenBurnRate > 100 ? t('pages.activeSession.performance.highIntensity') : t('pages.activeSession.performance.normalUsage')}
                    </DragonBadge>
                  </div>
                </div>
              </div>
            </CardContent>
          </DragonCard>
        </div>
      ) : (
        /* No Active Session */
        <DragonCard 
          variant="default"
          className="transition-all duration-300 hover:scale-110 hover:shadow-lg hover:shadow-red-500/20 dragon-flame-border relative z-10 hover:z-20"
        >
          <CardContent className="text-center py-12">
            <Pause className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <p className="font-medium text-muted-foreground">{t('pages.activeSession.noSession.title')}</p>
            <p className="text-sm text-muted-foreground mt-2">{t('pages.activeSession.noSession.description')}</p>
          </CardContent>
        </DragonCard>
      )}

      {/* Real-time Updates Notice */}
      <DragonCard 
        variant="gradient"
        className="transition-all duration-300 hover:scale-110 hover:shadow-lg hover:shadow-red-500/20 dragon-flame-border relative z-10 hover:z-20"
      >
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-sm">
              <Activity className="h-4 w-4 text-dragon-primary" />
              <span>{t('pages.activeSession.realTime.updates')}</span>
            </div>
            <div className="text-xs text-muted-foreground">
              {t('pages.activeSession.realTime.lastUpdated')}: {lastActivity ? getRelativeTime(lastActivity) : t('pages.activeSession.realTime.never')}
            </div>
          </div>
        </CardContent>
      </DragonCard>
    </div>
  )
}