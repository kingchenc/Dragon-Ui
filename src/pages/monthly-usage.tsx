import { DragonCard, CardContent } from '@/components/ui/card'
import { DragonBadge } from '@/components/ui/badge'
import { DragonLoading } from '@/components/ui/loading'
import { useMonthlyData } from '@/lib/store'
import { useTranslation } from '@/i18n'
import { Calendar, TrendingUp, BarChart3, Target } from 'lucide-react'
import { formatCurrency, formatNumber } from '@/lib/utils'
import { useTimeFormatting } from '@/lib/hooks'

export default function MonthlyUsagePage() {
  // Simple store read - no calculations needed!
  const { data: monthlyData, isLoading } = useMonthlyData()
  const { formatDate } = useTimeFormatting()
  const { t } = useTranslation()

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <DragonLoading size="lg" text={t('pages.monthlyUsage.loadingMonthlyData')} />
      </div>
    )
  }

  if (!monthlyData || !monthlyData.monthlyData || monthlyData.monthlyData.length === 0) {
    return (
      <div className="text-center py-12">
        <Calendar className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
        <p className="text-muted-foreground">{t('pages.monthlyUsage.noMonthlyData')}</p>
        <p className="text-xs text-muted-foreground mt-2">
          {t('pages.monthlyUsage.monthlyDataWillAppear')}
        </p>
      </div>
    )
  }

  // All data comes pre-calculated from store.ts!
  const { 
    monthlyData: months, 
    currency,
    totalMonths,
    totalCost,
    averageMonthlySpend,
    highestSpendingMonth,
    mostActiveMonth,
    monthlyGrowth,
    projectedYearlySpend,
    quarterlyProjection,
    currentRunRate
  } = monthlyData

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">{t('pages.monthlyUsage.title')}</h2>
          <p className="text-muted-foreground">
            {t('pages.monthlyUsage.description')} ({currency})
          </p>
        </div>
        <div className="flex items-center space-x-4 text-sm text-muted-foreground">
          <div className="flex items-center space-x-1">
            <Calendar className="h-4 w-4" />
            <span>{totalMonths} {t('pages.monthlyUsage.stats.monthsTracked')}</span>
          </div>
          <div className="flex items-center space-x-1">
            <TrendingUp className="h-4 w-4" />
            <span className="text-muted-foreground">
              {t('pages.monthlyUsage.stats.budgetTracking')}
            </span>
          </div>
        </div>
      </div>

      {/* Summary Stats - Direct from store! */}
      <div className="grid gap-4 md:grid-cols-4">
        <DragonCard 
          variant="gradient"
          className="transition-all duration-300 hover:scale-110 hover:shadow-lg hover:shadow-red-500/20 dragon-flame-border relative z-10 hover:z-20"
        >
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <Calendar className="h-5 w-5 text-dragon-primary" />
              <div>
                <p className="text-sm text-muted-foreground">{t('pages.monthlyUsage.stats.currentMonth')}</p>
                <div className="flex items-baseline space-x-2">
                  <p className="text-2xl font-bold">{formatCurrency(monthlyData.currentMonthCost || 0, currency)}</p>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {t('pages.monthlyUsage.stats.thisMonth')}
                </p>
              </div>
            </div>
          </CardContent>
        </DragonCard>

        <DragonCard 
          variant="scales"
          className="transition-all duration-300 hover:scale-110 hover:shadow-lg hover:shadow-red-500/20 dragon-flame-border relative z-10 hover:z-20"
        >
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <TrendingUp className="h-5 w-5 text-dragon-secondary" />
              <div>
                <p className="text-sm text-muted-foreground">{t('pages.monthlyUsage.stats.monthlyAverage')}</p>
                <p className="text-2xl font-bold">
                  {formatCurrency(averageMonthlySpend || 0, currency)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">{t('pages.monthlyUsage.stats.perMonth')}</p>
              </div>
            </div>
          </CardContent>
        </DragonCard>

        <DragonCard 
          variant="flame"
          className="transition-all duration-300 hover:scale-110 hover:shadow-lg hover:shadow-red-500/20 dragon-flame-border relative z-10 hover:z-20"
        >
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <BarChart3 className="h-5 w-5 text-white" />
              <div>
                <p className="text-sm text-white/80">{t('pages.monthlyUsage.stats.totalCost')}</p>
                <p className="text-2xl font-bold text-white">
                  {formatCurrency(totalCost || 0, currency)}
                </p>
                <p className="text-xs text-white/80 mt-1">{t('pages.monthlyUsage.stats.allMonths')}</p>
              </div>
            </div>
          </CardContent>
        </DragonCard>

        <DragonCard 
          variant="default"
          className="transition-all duration-300 hover:scale-110 hover:shadow-lg hover:shadow-red-500/20 dragon-flame-border relative z-10 hover:z-20"
        >
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <Target className="h-5 w-5 text-dragon-accent" />
              <div>
                <p className="text-sm text-muted-foreground">{t('pages.monthlyUsage.stats.projectedYearly')}</p>
                <p className="text-2xl font-bold">{formatCurrency(projectedYearlySpend || 0, currency)}</p>
                <p className="text-xs text-muted-foreground mt-1">{t('pages.monthlyUsage.stats.basedOnAverage')}</p>
              </div>
            </div>
          </CardContent>
        </DragonCard>
      </div>

      {/* Monthly Breakdown */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">{t('pages.monthlyUsage.breakdown.title')}</h3>
        
        <div className="space-y-3">
          {months?.map((month: any) => {
            // Use billing period label if available, otherwise fallback to date formatting
            const monthName = month.billing_period_label || 
                             formatDate(month.date + '-01', { month: 'long', year: 'numeric', day: undefined })
            const isCurrentMonth = month.isCurrentMonth || month.isCurrent
            
            return (
              <DragonCard
                key={month.date || month.month || month.billing_period_key}
                variant={isCurrentMonth ? 'scales' : 'default'}
                className="transition-all duration-300 hover:scale-110 hover:shadow-lg hover:shadow-red-500/20 dragon-flame-border relative z-10 hover:z-20"
              >
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center space-x-3">
                      <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-dragon-primary to-dragon-secondary flex items-center justify-center">
                        <Calendar className="h-6 w-6 text-white" />
                      </div>
                      <div>
                        <div className="flex items-center space-x-2">
                          <h4 className="font-semibold text-lg">{monthName}</h4>
                          {isCurrentMonth && (
                            <DragonBadge variant="emerald" className="text-xs">
                              {t('pages.monthlyUsage.breakdown.current')}
                            </DragonBadge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {month.totalDays || month.active_days || 0} {t('pages.monthlyUsage.breakdown.days')} • {month.totalSessions || month.session_count || 0} {t('pages.monthlyUsage.breakdown.sessions')}
                        </p>
                      </div>
                    </div>
                    
                    <div className="text-right">
                      <p className="font-bold text-xl text-dragon-accent">
                        {formatCurrency(month.totalCost || month.total_cost || 0, currency)}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {formatCurrency(month.dailyAverage || month.avgCostPerDay || 0, currency)}/{t('pages.monthlyUsage.breakdown.dayAvg')}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground mb-1">{t('pages.monthlyUsage.breakdown.totalTokens')}</p>
                      <p className="font-semibold">
                        {formatNumber(month.totalTokens || month.total_tokens || 0)}
                      </p>
                    </div>
                    
                    <div>
                      <p className="text-muted-foreground mb-1">{t('pages.monthlyUsage.breakdown.activeDays')}</p>
                      <p className="font-semibold">
                        {month.activeDays || month.active_days || 0} / {month.totalDays || month.active_days || 0}
                      </p>
                    </div>
                    
                    <div>
                      <p className="text-muted-foreground mb-1">{t('pages.monthlyUsage.breakdown.avgSessionCost')}</p>
                      <p className="font-semibold">
                        {formatCurrency(month.avgSessionCost || month.avgCostPerSession || 0, currency)}
                      </p>
                    </div>
                    
                    <div>
                      <p className="text-muted-foreground mb-1">{t('pages.monthlyUsage.breakdown.tokensPerSession')}</p>
                      <p className="font-semibold">
                        {formatNumber(month.tokensPerSession || 
                          ((month.totalTokens || month.total_tokens || 0) / (month.totalSessions || month.session_count || 1)) || 0)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 pt-4 border-t border-border/50">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>
                        {t('pages.monthlyUsage.breakdown.costPer1MTokens')}: {
                          month.costPer1MTokens 
                            ? formatCurrency(month.costPer1MTokens, currency)
                            : 'N/A'
                        }
                      </span>
                      <span>
                        {t('pages.monthlyUsage.breakdown.vsAvg')}: {
                          month.isFirstMonth 
                            ? t('pages.monthlyUsage.breakdown.firstMonth')
                            : month.vsAveragePercent !== undefined && month.vsAveragePercent !== null && month.vsAveragePercent !== 0
                              ? `${month.vsAveragePercent > 0 ? '+' : ''}${month.vsAveragePercent.toFixed(1)}%`
                              : t('pages.monthlyUsage.breakdown.sameAsAvg')
                        }
                      </span>
                    </div>
                  </div>
                </CardContent>
              </DragonCard>
            )
          })}
        </div>
      </div>

      {/* Spending Trends - Direct from store! */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">{t('pages.monthlyUsage.trends.title')}</h3>
        
        <div className="grid gap-4 md:grid-cols-3">
          {/* Highest Spending Month */}
          <DragonCard 
            variant="flame"
            className="transition-all duration-300 hover:scale-110 hover:shadow-lg hover:shadow-red-500/20 dragon-flame-border relative z-10 hover:z-20"
          >
            <CardContent className="p-4">
              <div className="space-y-2">
                <h4 className="font-semibold text-sm text-white/80">{t('pages.monthlyUsage.trends.highestSpending')}</h4>
                <h3 className="text-xl font-bold text-white">
                  {formatCurrency(highestSpendingMonth?.totalCost || 0, currency)}
                </h3>
                <div className="flex items-center space-x-3 text-sm text-white/70">
                  <span>{highestSpendingMonth?.monthName || t('pages.monthlyUsage.trends.noData')}</span>
                </div>
              </div>
            </CardContent>
          </DragonCard>

          {/* Most Active Month */}
          <DragonCard 
            variant="scales"
            className="transition-all duration-300 hover:scale-110 hover:shadow-lg hover:shadow-red-500/20 dragon-flame-border relative z-10 hover:z-20"
          >
            <CardContent className="p-4">
              <div className="space-y-2">
                <h4 className="font-semibold text-sm text-dragon-primary">{t('pages.monthlyUsage.trends.mostActive')}</h4>
                <h3 className="text-xl font-bold">
                  {mostActiveMonth?.totalSessions || 0} {t('pages.monthlyUsage.trends.sessions')}
                </h3>
                <div className="flex items-center space-x-3 text-sm text-muted-foreground">
                  <span>{mostActiveMonth?.monthName || t('pages.monthlyUsage.trends.noData')}</span>
                </div>
              </div>
            </CardContent>
          </DragonCard>

          {/* Growth Trend */}
          <DragonCard 
            variant="gradient"
            className="transition-all duration-300 hover:scale-110 hover:shadow-lg hover:shadow-red-500/20 dragon-flame-border relative z-10 hover:z-20"
          >
            <CardContent className="p-4">
              <div className="space-y-2">
                <h4 className="font-semibold text-sm text-dragon-secondary">{t('pages.monthlyUsage.trends.growthTrend')}</h4>
                <div className="flex items-baseline space-x-2">
                  {monthlyGrowth !== null && monthlyGrowth !== undefined && totalMonths > 1 ? (
                    <h3 className={`text-xl font-bold ${
                      monthlyGrowth >= 0 ? 'text-green-500' : 'text-red-500'
                    }`}>
                      {monthlyGrowth >= 0 ? '+' : ''}{monthlyGrowth.toFixed(1)}%
                    </h3>
                  ) : (
                    <h3 className="text-xl font-bold text-muted-foreground">
                      {t('pages.monthlyUsage.trends.firstMonth')}
                    </h3>
                  )}
                  <span className="text-sm text-muted-foreground">{t('pages.monthlyUsage.trends.mom')}</span>
                </div>
                <div className="flex items-center space-x-3 text-sm text-muted-foreground">
                  <span>
                    {monthlyGrowth !== null && monthlyGrowth !== undefined && totalMonths > 1 ? 
                      `${monthlyGrowth > 0 ? t('pages.monthlyUsage.trends.increasing') : monthlyGrowth < 0 ? t('pages.monthlyUsage.trends.decreasing') : t('pages.monthlyUsage.trends.stable')} ${t('pages.monthlyUsage.trends.usage')}` :
                      t('pages.monthlyUsage.trends.noPreviousData')
                    }
                  </span>
                </div>
              </div>
            </CardContent>
          </DragonCard>
        </div>
      </div>

      {/* Budget Planning - Direct from store! */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">{t('pages.monthlyUsage.budget.title')}</h3>
        
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {/* Monthly Average */}
          <DragonCard 
            variant="scales"
            className="transition-all duration-300 hover:scale-110 hover:shadow-lg hover:shadow-red-500/20 dragon-flame-border relative z-10 hover:z-20"
          >
            <CardContent className="p-4">
              <div className="space-y-2">
                <h4 className="font-semibold text-sm text-dragon-primary">{t('pages.monthlyUsage.budget.monthlyAverage')}</h4>
                <h3 className="text-xl font-bold">
                  {formatCurrency(averageMonthlySpend || 0, currency)}
                </h3>
                <div className="flex items-center space-x-3 text-sm text-muted-foreground">
                  <span>{t('pages.monthlyUsage.budget.perMonth')}</span>
                </div>
              </div>
            </CardContent>
          </DragonCard>

          {/* Quarterly Projection */}
          <DragonCard 
            variant="gradient"
            className="transition-all duration-300 hover:scale-110 hover:shadow-lg hover:shadow-red-500/20 dragon-flame-border relative z-10 hover:z-20"
          >
            <CardContent className="p-4">
              <div className="space-y-2">
                <h4 className="font-semibold text-sm text-dragon-secondary">{t('pages.monthlyUsage.budget.quarterly')}</h4>
                <h3 className="text-xl font-bold">
                  {formatCurrency(quarterlyProjection || 0, currency)}
                </h3>
                <div className="flex items-center space-x-3 text-sm text-muted-foreground">
                  <span>{t('pages.monthlyUsage.budget.next3Months')}</span>
                </div>
              </div>
            </CardContent>
          </DragonCard>

          {/* Yearly Projection */}
          <DragonCard 
            variant="flame"
            className="transition-all duration-300 hover:scale-110 hover:shadow-lg hover:shadow-red-500/20 dragon-flame-border relative z-10 hover:z-20"
          >
            <CardContent className="p-4">
              <div className="space-y-2">
                <h4 className="font-semibold text-sm text-white/80">{t('pages.monthlyUsage.budget.yearly')}</h4>
                <h3 className="text-xl font-bold text-white">
                  {formatCurrency(projectedYearlySpend || 0, currency)}
                </h3>
                <div className="flex items-center space-x-3 text-sm text-white/70">
                  <span>{t('pages.monthlyUsage.budget.twelveMonths')}</span>
                </div>
              </div>
            </CardContent>
          </DragonCard>

          {/* Current Run Rate */}
          <DragonCard 
            variant="default"
            className="transition-all duration-300 hover:scale-110 hover:shadow-lg hover:shadow-red-500/20 dragon-flame-border relative z-10 hover:z-20"
          >
            <CardContent className="p-4">
              <div className="space-y-2">
                <h4 className="font-semibold text-sm text-muted-foreground">{t('pages.monthlyUsage.budget.runRate')}</h4>
                <h3 className="text-xl font-bold">
                  {formatCurrency(currentRunRate || 0, currency)}
                </h3>
                <div className="flex items-center space-x-3 text-sm text-muted-foreground">
                  <span>{t('pages.monthlyUsage.budget.perYear')}</span>
                </div>
              </div>
            </CardContent>
          </DragonCard>
        </div>
      </div>
    </div>
  )
}