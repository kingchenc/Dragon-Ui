import { DragonCard, CardContent } from '@/components/ui/card'
import { DragonBadge } from '@/components/ui/badge'
import { DragonLoading } from '@/components/ui/loading'
import { useDailyData, useAppStore, useActiveData } from '@/lib/store'
import { useTranslation } from '@/i18n'
import { Clock, Sun, Moon, Zap } from 'lucide-react'
import { formatCurrency, formatNumber, getRelativeTime } from '@/lib/utils'
import { useTimeFormatting } from '@/lib/hooks'

export default function DailyUsagePage() {
  // Simple store read - no calculations needed!
  const { data: dailyData, isLoading } = useDailyData()
  const { currency: storeCurrency } = useAppStore()
  const { data: activeData } = useActiveData()
  const { formatDate } = useTimeFormatting()
  const { t } = useTranslation()

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <DragonLoading size="lg" text={t('pages.dailyUsage.loadingDailyData')} />
      </div>
    )
  }

  // Show data even if no daily usage yet - display the structure with zero values
  if (!dailyData) {
    return (
      <div className="text-center py-12">
        <Clock className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
        <p className="text-muted-foreground">{t('pages.dailyUsage.noDailyData')}</p>
        <p className="text-xs text-muted-foreground mt-2">
          {t('pages.dailyUsage.dailyDataWillAppear')}
        </p>
      </div>
    )
  }

  // All data comes pre-calculated from store.ts!
  const { 
    dailyData: days, 
    currency, 
    todayData, 
    yesterdayData, 
    totalDays,
    activeDays,
    totalCost,
    averageDailyCost,
    totalSessions,
    lastSessionData
  } = dailyData || {
    dailyData: [],
    currency: storeCurrency, // Use current currency from store instead of hardcoded 'USD'
    todayData: null,
    yesterdayData: null,
    totalDays: 0,
    activeDays: 0,
    totalCost: 0,
    averageDailyCost: 0,
    totalSessions: 0,
    lastSessionData: null
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">{t('pages.dailyUsage.title')}</h2>
          <p className="text-muted-foreground">
            {t('pages.dailyUsage.description')} ({currency})
          </p>
        </div>
        <div className="flex items-center space-x-4 text-sm text-muted-foreground">
          <div className="flex items-center space-x-1">
            <Clock className="h-4 w-4" />
            <span>{totalDays} {t('pages.dailyUsage.stats.daysTracked')}</span>
          </div>
          <div className="flex items-center space-x-1">
            <Zap className="h-4 w-4" />
            <span>{activeDays} {t('pages.dailyUsage.stats.activeDays')}</span>
          </div>
        </div>
      </div>

      {/* Today vs Yesterday - Compact */}
      <div className="grid gap-4 md:grid-cols-2">
        <DragonCard 
          variant="gradient"
          className="transition-all duration-300 hover:scale-110 hover:shadow-lg hover:shadow-red-500/20 dragon-flame-border relative z-10 hover:z-20"
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-2">
                <Sun className="h-4 w-4 text-dragon-accent" />
                <span className="font-semibold">{t('pages.dailyUsage.today.title')}</span>
                <DragonBadge variant="emerald" className="text-xs">{t('pages.dailyUsage.today.live')}</DragonBadge>
              </div>
              <span className="text-xl font-bold text-dragon-accent">
                {formatCurrency(todayData?.totalCost || 0, currency)}
              </span>
            </div>
            {todayData ? (
              <div className="grid grid-cols-3 gap-3 text-center text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">{t('pages.dailyUsage.today.tokens')}</p>
                  <p className="font-semibold">{formatNumber(todayData.totalTokens || 0)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{t('pages.dailyUsage.today.sessions')}</p>
                  <p className="font-semibold">{todayData.sessionCount || 0}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{t('pages.dailyUsage.today.models')}</p>
                  <p className="font-semibold">{todayData.modelCount || todayData.models?.length || 0}</p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center">{t('pages.dailyUsage.today.noUsageYet')}</p>
            )}
          </CardContent>
        </DragonCard>

        <DragonCard 
          variant="scales"
          className="transition-all duration-300 hover:scale-110 hover:shadow-lg hover:shadow-red-500/20 dragon-flame-border relative z-10 hover:z-20"
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-2">
                <Moon className="h-4 w-4 text-dragon-primary" />
                <span className="font-semibold">{yesterdayData ? t('pages.dailyUsage.yesterday.title') : t('pages.dailyUsage.yesterday.lastActive')}</span>
              </div>
              <span className="text-xl font-bold">
                {formatCurrency((yesterdayData || lastSessionData)?.totalCost || 0, currency)}
              </span>
            </div>
            {(yesterdayData || lastSessionData) ? (
              <div className="grid grid-cols-3 gap-3 text-center text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">{t('pages.dailyUsage.yesterday.tokens')}</p>
                  <p className="font-semibold">{formatNumber((yesterdayData || lastSessionData).totalTokens || 0)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{t('pages.dailyUsage.yesterday.sessions')}</p>
                  <p className="font-semibold">
                    {yesterdayData ? yesterdayData.sessionCount : (lastSessionData ? 1 : 0)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{t('pages.dailyUsage.yesterday.models')}</p>
                  <p className="font-semibold">
                    {yesterdayData 
                      ? (yesterdayData.modelCount || yesterdayData.models?.length || 0)
                      : (lastSessionData?.modelCount || lastSessionData?.models?.length || 0)
                    }
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center">{t('pages.dailyUsage.yesterday.noPreviousData')}</p>
            )}
          </CardContent>
        </DragonCard>
      </div>

      {/* Usage Summary - Direct from store! */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">{t('pages.dailyUsage.summary.title')}</h3>
        
        <div className="grid gap-4 md:grid-cols-3">
          {/* Total Cost */}
          <DragonCard 
            variant="flame"
            className="transition-all duration-300 hover:scale-110 hover:shadow-lg hover:shadow-red-500/20 dragon-flame-border relative z-10 hover:z-20"
          >
            <CardContent className="p-4">
              <div className="space-y-2">
                <h4 className="font-semibold text-sm text-white/80">{t('pages.dailyUsage.summary.totalCost')}</h4>
                <h3 className="text-xl font-bold text-white">
                  {formatCurrency(totalCost || 0, currency)}
                </h3>
                <div className="flex items-center space-x-3 text-sm text-white/70">
                  <span>{totalSessions || 0} {t('pages.dailyUsage.summary.sessions')}</span>
                  <span>•</span>
                  <span>{t('pages.dailyUsage.summary.last7Days')}</span>
                </div>
              </div>
            </CardContent>
          </DragonCard>

          {/* Daily Average */}
          <DragonCard 
            variant="scales"
            className="transition-all duration-300 hover:scale-110 hover:shadow-lg hover:shadow-red-500/20 dragon-flame-border relative z-10 hover:z-20"
          >
            <CardContent className="p-4">
              <div className="space-y-2">
                <h4 className="font-semibold text-sm text-dragon-primary">{t('pages.dailyUsage.summary.dailyAverage')}</h4>
                <h3 className="text-xl font-bold">
                  {formatCurrency(averageDailyCost || 0, currency)}
                </h3>
                <div className="flex items-center space-x-3 text-sm text-muted-foreground">
                  <span>{t('pages.dailyUsage.summary.perActiveDay')}</span>
                  <span>•</span>
                  <span>{activeDays || 0} {t('pages.dailyUsage.summary.active')}</span>
                </div>
              </div>
            </CardContent>
          </DragonCard>

          {/* Activity Rate */}
          <DragonCard 
            variant="gradient"
            className="transition-all duration-300 hover:scale-110 hover:shadow-lg hover:shadow-red-500/20 dragon-flame-border relative z-10 hover:z-20"
          >
            <CardContent className="p-4">
              <div className="space-y-2">
                <h4 className="font-semibold text-sm text-dragon-secondary">{t('pages.dailyUsage.summary.activityRate')}</h4>
                <div className="flex items-baseline space-x-2">
                  <h3 className="text-xl font-bold">
                    {totalDays > 0 ? Math.round((activeDays / totalDays) * 100) : 0}%
                  </h3>
                  <span className="text-sm text-muted-foreground">{t('pages.dailyUsage.summary.active')}</span>
                </div>
                <div className="flex items-center space-x-3 text-sm text-muted-foreground">
                  <span>{activeDays} / {totalDays} {t('pages.dailyUsage.summary.days')}</span>
                </div>
              </div>
            </CardContent>
          </DragonCard>
        </div>
      </div>

      {/* Daily Breakdown - Direct from store! */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">{t('pages.dailyUsage.history.title')}</h3>
          <DragonBadge variant="dragon">
            {t('pages.dailyUsage.history.last')} {Math.min(30, days?.length || 0)} {t('pages.dailyUsage.history.days')}
          </DragonBadge>
        </div>
        
        <div className="space-y-2">
          {days?.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())?.map((day: any) => {
            const hasUsage = (day.totalCost || 0) > 0
            const isToday = day.isToday
            const isYesterday = day.isYesterday
            const isRecent = day.isRecent
            
            return (
              <DragonCard
                key={day.date}
                variant={isToday ? 'flame' : isRecent ? 'scales' : 'default'}
                className={`transition-all duration-300 hover:scale-110 hover:shadow-lg hover:shadow-red-500/20 dragon-flame-border relative z-10 hover:z-20 ${
                  !hasUsage ? 'opacity-60' : ''
                }`}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-dragon-primary to-dragon-secondary flex items-center justify-center">
                        {isToday ? (
                          <Sun className="h-4 w-4 text-white" />
                        ) : (
                          <Clock className="h-4 w-4 text-white" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center space-x-2">
                          <h4 className="font-semibold">
                            {formatDate(day.date)}
                          </h4>
                          {isToday && (
                            <DragonBadge variant="emerald" className="text-xs">{t('pages.dailyUsage.history.today')}</DragonBadge>
                          )}
                          {isYesterday && (
                            <DragonBadge variant="scale" className="text-xs">{t('pages.dailyUsage.history.yesterday')}</DragonBadge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {isToday && activeData?.sessionActive ? t('pages.dailyUsage.history.activeNow') : getRelativeTime(day.date)}
                        </p>
                      </div>
                    </div>
                    
                    <div className="text-right">
                      <p className={`font-bold text-lg ${hasUsage ? 'text-dragon-accent' : 'text-muted-foreground'}`}>
                        {formatCurrency(day.totalCost || 0, currency)}
                      </p>
                      {hasUsage && (
                        <p className="text-sm text-muted-foreground">
                          {formatNumber(day.totalTokens || 0)} {t('pages.dailyUsage.history.tokens')}
                        </p>
                      )}
                    </div>
                  </div>

                  {hasUsage && (
                    <div className="mt-3 pt-3 border-t border-border/50">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{day.sessionCount || day.sessions || 0} {t('pages.dailyUsage.history.sessions')}</span>
                        <span className="mx-4">
                          {day.models && day.models.length > 0 ? (
                            <span>{day.models.length} {t('pages.dailyUsage.history.models')} ({day.models.join(', ')})</span>
                          ) : (
                            <span>{t('pages.dailyUsage.history.noModels')}</span>
                          )}
                        </span>
                        <span>
                          {day.costPer1KTokens !== null && day.costPer1KTokens !== undefined ? `$${day.costPer1KTokens.toFixed(6)}/1K` : 'N/A'}
                        </span>
                      </div>
                    </div>
                  )}
                </CardContent>
              </DragonCard>
            )
          })}
        </div>
      </div>
    </div>
  )
}