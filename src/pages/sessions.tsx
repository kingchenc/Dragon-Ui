import React from 'react'
import { DragonCard, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { DragonBadge } from '@/components/ui/badge'
import { DragonLoading } from '@/components/ui/loading'
import { useSessionsData } from '@/lib/store'
import { useTranslation } from '@/i18n'
import { Zap, Clock, DollarSign, MessageSquare, Calendar } from 'lucide-react'
import { formatCurrency, formatNumber, formatDateTime, getRelativeTime } from '@/lib/utils'
import { useTimeFormatting } from '@/lib/hooks'

export default function SessionsPage() {
  // Simple store read - no calculations needed!
  const { data: sessionsData, isLoading, refresh } = useSessionsData()
  const { formatDateTime: formatDateTimeHook } = useTimeFormatting()
  const { t } = useTranslation()

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <DragonLoading size="lg" text={t('pages.sessions.loadingSessions')} />
      </div>
    )
  }

  if (!sessionsData || !sessionsData.sessionsData || sessionsData.sessionsData.length === 0) {
    return (
      <div className="text-center py-12">
        <Zap className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
        <p className="text-muted-foreground">{t('pages.sessions.noSessionData')}</p>
        <p className="text-xs text-muted-foreground mt-2">
          {t('pages.sessions.sessionDataWillAppear')}
        </p>
      </div>
    )
  }

  // All data comes pre-calculated from store.ts!
  const { sessionsData: sessions, totalSessions, validSessions, currency } = sessionsData

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">{t('pages.sessions.title')}</h2>
          <p className="text-muted-foreground">
            {t('pages.sessions.description')} ({currency})
          </p>
        </div>
        <div className="flex items-center space-x-4 text-sm text-muted-foreground">
          <div className="flex items-center space-x-1">
            <Zap className="h-4 w-4" />
            <span>{totalSessions} / 50 {t('pages.sessions.stats.total')}</span>
          </div>
          <div className="flex items-center space-x-1">
            <Clock className="h-4 w-4" />
            <span>{validSessions} / 50 {t('pages.sessions.stats.valid')}</span>
          </div>
        </div>
      </div>

      {/* Summary Stats - Direct from store! */}
      <div className="grid gap-4 md:grid-cols-3">
        <DragonCard variant="gradient">
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <Zap className="h-5 w-5 text-dragon-primary" />
              <div>
                <p className="text-sm text-muted-foreground">{t('pages.sessions.stats.totalSessions')}</p>
                <p className="text-2xl font-bold">{totalSessions} / 50</p>
              </div>
            </div>
          </CardContent>
        </DragonCard>

        <DragonCard variant="scales">
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <Clock className="h-5 w-5 text-dragon-accent" />
              <div>
                <p className="text-sm text-muted-foreground">{t('pages.sessions.stats.validSessions')}</p>
                <p className="text-2xl font-bold">{validSessions} / 50</p>
              </div>
            </div>
          </CardContent>
        </DragonCard>

        <DragonCard variant="flame">
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <DollarSign className="h-5 w-5 text-white" />
              <div>
                <p className="text-sm text-white/80">{t('pages.sessions.stats.totalCost')}</p>
                <p className="text-2xl font-bold text-white">
                  {formatCurrency(sessions.reduce((sum: number, s: any) => sum + (s.totalCost || 0), 0), currency)}
                </p>
              </div>
            </div>
          </CardContent>
        </DragonCard>
      </div>

      {/* Session Insights - From store data! */}
      <DragonCard variant="gradient">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Calendar className="h-5 w-5" />
            <span>{t('pages.sessions.insights.title')}</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <h4 className="font-semibold mb-2">{t('pages.sessions.insights.avgSessionCost')}</h4>
              <p className="text-lg font-bold text-dragon-accent">
                {formatCurrency(
                  totalSessions > 0 
                    ? sessions.reduce((sum: number, s: any) => sum + (s.totalCost || 0), 0) / totalSessions
                    : 0, 
                  currency
                )}
              </p>
            </div>
            
            <div>
              <h4 className="font-semibold mb-2">{t('pages.sessions.insights.avgTokens')}</h4>
              <p className="text-lg font-bold">
                {formatNumber(
                  totalSessions > 0 
                    ? sessions.reduce((sum: number, s: any) => sum + (s.totalTokens || 0), 0) / totalSessions
                    : 0
                )}
              </p>
            </div>
            
            <div>
              <h4 className="font-semibold mb-2">{t('pages.sessions.insights.mostRecentSession')}</h4>
              <p className="text-sm text-muted-foreground">
                {sessions?.[0]?.startTime 
                  ? getRelativeTime(sessions[0].startTime)
                  : t('pages.sessions.insights.noSessionsYet')}
              </p>
            </div>
          </div>
        </CardContent>
      </DragonCard>

      {/* Sessions List - Direct from store! */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">{t('pages.sessions.history.title')}</h3>
        
        <div className="grid gap-4">
          {sessions?.map((session: any, index: number) => {
            const isRecentSession = index < 5
            
            return (
              <DragonCard
                key={session.sessionId || session.id || index}
                variant={isRecentSession ? 'scales' : 'default'}
                className="transition-all duration-300 hover:scale-[1.02]"
              >
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-dragon-primary to-dragon-secondary flex items-center justify-center">
                        <Zap className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-lg">
                          {t('pages.sessions.history.session')} {session.sessionId || session.id || `#${index + 1}`}
                        </h4>
                        <p className="text-sm text-muted-foreground">
                          {session.startTime 
                            ? `${t('pages.sessions.history.started')} ${getRelativeTime(session.startTime)}`
                            : t('pages.sessions.history.unknownStartTime')}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      {isRecentSession && (
                        <DragonBadge variant="gold">
                          {t('pages.sessions.history.recent')}
                        </DragonBadge>
                      )}
                      {session.isActive && (
                        <DragonBadge variant="dragon">
                          {t('pages.sessions.history.active')}
                        </DragonBadge>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground mb-1">{t('pages.sessions.stats.cost')}</p>
                      <p className="font-bold text-lg text-dragon-accent">
                        {formatCurrency(session.totalCost || 0, currency)}
                      </p>
                    </div>
                    
                    <div>
                      <p className="text-muted-foreground mb-1">{t('pages.sessions.stats.tokens')}</p>
                      <p className="font-semibold">
                        {formatNumber(session.totalTokens || 0)}
                      </p>
                    </div>
                    
                    <div>
                      <p className="text-muted-foreground mb-1">{t('pages.sessions.stats.duration')}</p>
                      <p className="font-semibold flex items-center space-x-1">
                        <Clock className="h-3 w-3" />
                        <span>
                          {session.duration 
                            ? `${Math.floor(session.duration / 60)}h ${session.duration % 60}m${session.duration >= 300 ? ` (${t('pages.sessions.stats.fiveHourMax')})` : ''}`
                            : 'N/A'}
                        </span>
                      </p>
                    </div>
                    
                    <div>
                      <p className="text-muted-foreground mb-1">{t('pages.sessions.stats.conversations')}</p>
                      <p className="font-semibold flex items-center space-x-1">
                        <MessageSquare className="h-3 w-3" />
                        <span>{session.conversations || 0}</span>
                      </p>
                    </div>
                  </div>

                  {/* Session Details - Always show */}
                  <div className="mt-4 pt-4 border-t border-border/50">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>
                        {t('pages.sessions.history.started')}: {session.startTime ? formatDateTime(session.startTime) : t('pages.sessions.history.unknown')}
                      </span>
                      <span className="mx-4">
                        {session.models && session.models.length > 0 && (
                          <span>{session.models.length} {t('pages.sessions.history.models')} ({session.models.join(', ')})</span>
                        )}
                      </span>
                      <span>
                        {session.endTime 
                          ? `${t('pages.sessions.history.ended')}: ${formatDateTime(session.endTime)}`
                          : session.isActive 
                            ? t('pages.sessions.history.activeNow')
                            : t('pages.sessions.history.noEndTime')
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
    </div>
  )
}