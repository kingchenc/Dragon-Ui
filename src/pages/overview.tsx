import React from 'react'
import { StatsCard, StatsGrid } from '@/components/dashboard/stats-card'
import { DragonCard, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { DragonLoading } from '@/components/ui/loading'
import { useOverviewData, useActiveData } from '@/lib/store'
import { useTranslation } from '@/i18n'
import { 
  DollarSign, 
  Zap, 
  TrendingUp, 
  Clock,
  Target,
  BarChart3,
  Activity
} from 'lucide-react'
import { formatCurrency, formatNumber, getRelativeTime, formatTime, formatDate } from '@/lib/utils'
import { useTimeFormatting } from '@/lib/hooks'
import { ActivityChart } from '@/components/charts/activity-chart'

export default function OverviewPage() {
  // Simple store reads - no calculations needed!
  const { data: overviewData, isLoading: isLoadingOverview, refresh: refreshOverview } = useOverviewData()
  const { data: activeData, isLoading: isLoadingActive } = useActiveData()
  
  const { t } = useTranslation()
    
  if (isLoadingOverview) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <DragonLoading size="lg" text={t('pages.overview.loadingOverview')} />
      </div>
    )
  }

  if (!overviewData) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">{t('pages.overview.loadingUsageData')}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">{t('pages.overview.title')}</h2>
          <p className="text-muted-foreground">
            {t('pages.overview.description')}
          </p>
        </div>
        <div className="flex items-center space-x-2 text-sm text-muted-foreground">
          <Activity className="h-4 w-4" />
          <span>{t('pages.overview.realTimeMonitoring')}</span>
        </div>
      </div>

      {/* Main Stats Grid - Direct from store.ts! */}
      <StatsGrid columns={4}>
        <StatsCard
          title={t('pages.overview.stats.totalCost')}
          value={overviewData.totalCost}
          icon={DollarSign}
          variant="gradient"
          currency={true}
          subtitle={`in ${overviewData.currency}`}
        />

        <StatsCard
          title={t('pages.overview.stats.totalSessions')}
          value={`${overviewData.totalSessions} / 50`}
          icon={Zap}
          variant="scales"
          subtitle={t('pages.overview.stats.fiveHourWindows')}
        />

        <StatsCard
          title={t('pages.overview.stats.averageCostPerSession')}
          value={overviewData.averageCostPerSession}
          icon={TrendingUp}
          variant="flame"
          currency={true}
        />

        <StatsCard
          title={t('pages.overview.stats.totalTokens')}
          value={overviewData.totalTokens}
          icon={Target}
          iconColor="text-amber-500 group-hover:text-amber-400"
          variant="default"
          subtitle={`${formatNumber(overviewData.totalTokens)} ${t('pages.overview.stats.tokens')}`}
        />
      </StatsGrid>

      {/* Active Session & Quick Stats */}
      <StatsGrid columns={3}>
        <StatsCard
          title={t('pages.overview.stats.status')}
          value={overviewData.status}
          icon={Activity}
          iconColor="text-emerald-500 group-hover:text-emerald-400"
          subtitle={overviewData.lastActivity ? `${t('pages.overview.lastActivity')}: ${getRelativeTime(overviewData.lastActivity)}` : t('pages.overview.noActivity')}
        />

        <StatsCard
          title={t('pages.overview.stats.activeDays')}
          value={`${overviewData.activeDays} / ${new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate()}`}
          icon={Clock}
          iconColor="text-blue-500 group-hover:text-blue-400"
          subtitle={t('pages.overview.stats.daysWithUsage')}
        />

        <StatsCard
          title={t('pages.overview.stats.modelsUsed')}
          value={overviewData.models.length}
          icon={BarChart3}
          iconColor="text-purple-500 group-hover:text-purple-400"
          subtitle={overviewData.models.join(', ') || 'None'}
        />
      </StatsGrid>

      {/* Detailed Cards */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Current Session Details */}
        <DragonCard 
          variant="scales"
          className="transition-all duration-300 hover:scale-110 hover:shadow-lg hover:shadow-red-500/20 dragon-flame-border relative z-10 hover:z-20"
        >
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Zap className="h-5 w-5 text-dragon-primary" />
              <span>{t('pages.overview.currentSession.title')}</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoadingActive ? (
              <DragonLoading size="sm" text={t('pages.overview.loadingSession')} />
            ) : activeData?.sessionActive ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">{t('pages.overview.currentSession.started')}</p>
                    <p className="font-bold text-xl">
                      {activeData.lastActivity ? getRelativeTime(activeData.lastActivity) : t('pages.overview.currentSession.unknown')}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">{t('pages.overview.currentSession.duration')}</p>
                    <p className="font-bold text-xl">
                      {activeData.duration ? `${Math.floor(activeData.duration / 60)}h ${activeData.duration % 60}m` : '0m'}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">{t('pages.overview.currentSession.cost')}</p>
                    <p className="font-bold text-xl text-dragon-accent">
                      {formatCurrency(activeData.currentCost, activeData.currency)}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">{t('pages.overview.currentSession.timeLeft')}</p>
                    <p className="font-bold text-xl">
                      {activeData.timeLeft ? `${Math.floor(activeData.timeLeft / 60)}h ${activeData.timeLeft % 60}m` : 'N/A'}
                    </p>
                  </div>
                </div>
                {activeData.sessionId && (
                  <div>
                    <p className="text-muted-foreground text-sm">{t('pages.overview.currentSession.sessionId')}</p>
                    <p className="font-mono font-bold text-xl">{activeData.sessionId}</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-6 text-muted-foreground">
                <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>{t('pages.overview.currentSession.noActiveSession')}</p>
                <p className="text-xs">{t('pages.overview.currentSession.startUsingClaude')}</p>
              </div>
            )}
          </CardContent>
        </DragonCard>

        {/* Quick Stats */}
        <DragonCard 
          variant="gradient"
          className="transition-all duration-300 hover:scale-110 hover:shadow-lg hover:shadow-red-500/20 dragon-flame-border relative z-10 hover:z-20"
        >
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <BarChart3 className="h-5 w-5 text-dragon-secondary" />
              <span>{t('pages.overview.quickStats.title')}</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">{t('pages.overview.quickStats.totalCost')}</span>
                <span className="font-bold text-xl">
                  {formatCurrency(overviewData.totalCost, overviewData.currency)}
                </span>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">{t('pages.overview.quickStats.totalTokens')}</span>
                <span className="font-bold text-xl">
                  {formatNumber(overviewData.totalTokens)}
                </span>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">{t('pages.overview.quickStats.sessions')}</span>
                <span className="font-bold text-xl">
                  {overviewData.totalSessions} / 50
                </span>
              </div>

              <div className="pt-2 border-t border-white/10">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">{t('pages.overview.quickStats.avgTokensPerSession')}</span>
                  <span className="font-bold text-xl">
                    {formatNumber(overviewData.avgTokensPerSession)}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </DragonCard>
      </div>

      {/* Activity Chart - Last 7 Days */}
      <DragonCard 
        variant="scales"
        className="transition-all duration-300 hover:scale-110 hover:shadow-lg hover:shadow-red-500/20 dragon-flame-border relative z-10 hover:z-20"
      >
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Activity className="h-5 w-5 text-dragon-primary" />
            <span>{t('pages.overview.activity.title')}</span>
            {overviewData.last7DaysTotal > 0 && (
              <span className="text-sm text-muted-foreground ml-auto">
                {t('pages.overview.activity.total')}: {formatCurrency(overviewData.last7DaysTotal, overviewData.currency)}
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ActivityChart 
            data={overviewData.activityData ? [...overviewData.activityData].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()) : []} 
            currency={overviewData.currency}
          />
        </CardContent>
      </DragonCard>
    </div>
  )
}