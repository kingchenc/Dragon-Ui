import { DragonCard, CardContent } from '@/components/ui/card'
import { DragonBadge } from '@/components/ui/badge'
import { DragonLoading } from '@/components/ui/loading'
import { useProjectsData } from '@/lib/store'
import { useTranslation } from '@/i18n'
import { FolderOpen, DollarSign, Zap } from 'lucide-react'
import { formatCurrency, formatNumber, getRelativeTime } from '@/lib/utils'

export default function ProjectsPage() {
  // Simple store read - no calculations needed!
  const { data: projectsData, isLoading } = useProjectsData()
  const { t } = useTranslation()

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <DragonLoading size="lg" text={t('pages.projects.loadingProjects')} />
      </div>
    )
  }

  if (!projectsData || !projectsData.projectsData || projectsData.projectsData.length === 0) {
    return (
      <div className="text-center py-12">
        <FolderOpen className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
        <p className="text-muted-foreground">{t('pages.projects.noProjectData')}</p>
        <p className="text-xs text-muted-foreground mt-2">
          {t('pages.projects.projectDataWillAppear')}
        </p>
      </div>
    )
  }

  // All data comes pre-calculated from store.ts!
  const { projectsData: projects, totalProjects, mostActiveProject, currency } = projectsData

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">{t('pages.projects.title')}</h2>
          <p className="text-muted-foreground">
            {t('pages.projects.description')} ({currency})
          </p>
        </div>
        <div className="flex items-center space-x-4 text-sm text-muted-foreground">
          <div className="flex items-center space-x-1">
            <FolderOpen className="h-4 w-4" />
            <span>{totalProjects} {t('pages.projects.projects')}</span>
          </div>
          <div className="flex items-center space-x-1">
            <DollarSign className="h-4 w-4" />
            <span>{currency}</span>
          </div>
        </div>
      </div>

      {/* Summary Stats - Direct from store! */}
      <div className="grid gap-4 md:grid-cols-3">
        <DragonCard variant="gradient">
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <FolderOpen className="h-5 w-5 text-dragon-primary" />
              <div>
                <p className="text-sm text-muted-foreground">{t('pages.projects.stats.totalProjects')}</p>
                <p className="text-2xl font-bold">{totalProjects}</p>
              </div>
            </div>
          </CardContent>
        </DragonCard>

        <DragonCard variant="scales">
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <DollarSign className="h-5 w-5 text-dragon-accent" />
              <div>
                <p className="text-sm text-muted-foreground">{t('pages.projects.stats.totalCost')}</p>
                <p className="text-2xl font-bold">
                  {formatCurrency(projects.reduce((sum: number, p: any) => sum + (p.totalCost || 0), 0), currency)}
                </p>
              </div>
            </div>
          </CardContent>
        </DragonCard>

        <DragonCard variant="flame">
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <Zap className="h-5 w-5 text-white" />
              <div>
                <p className="text-sm text-white/80">{t('pages.projects.stats.mostActive')}</p>
                <p className="text-lg font-bold text-white">
                  {mostActiveProject || 'N/A'}
                </p>
              </div>
            </div>
          </CardContent>
        </DragonCard>
      </div>

      {/* Project Insights - Direct from store! */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">{t('pages.projects.insights.title')}</h3>
        
        <div className="grid gap-4 md:grid-cols-2">
          {/* Most Active Project */}
          <DragonCard variant="gradient">
            <CardContent className="p-4">
              <div className="space-y-2">
                <h4 className="font-semibold text-sm text-dragon-primary">{t('pages.projects.insights.mostActiveProject')}</h4>
                <h3 className="text-xl font-bold">
                  {mostActiveProject || 'N/A'}
                </h3>
                <div className="flex items-center space-x-3 text-sm text-muted-foreground">
                  <span>{projects?.[0]?.sessions || 0} {t('pages.projects.stats.sessions')}</span>
                  <span>•</span>
                  <span>{formatCurrency(projects?.[0]?.totalCost || 0, currency)}</span>
                </div>
              </div>
            </CardContent>
          </DragonCard>

          {/* Portfolio Summary */}
          <DragonCard variant="scales">
            <CardContent className="p-4">
              <div className="space-y-2">
                <h4 className="font-semibold text-sm text-blue-500">{t('pages.projects.insights.portfolio')}</h4>
                <div className="flex items-baseline space-x-2">
                  <h3 className="text-xl font-bold">{totalProjects}</h3>
                  <span className="text-sm text-muted-foreground">{t('pages.projects.insights.projectsTracked')}</span>
                </div>
                <div className="space-y-1 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">{t('pages.projects.stats.totalCost')}</span>
                    <span className="font-medium">
                      {formatCurrency(projects.reduce((sum: number, p: any) => sum + (p.totalCost || 0), 0), currency)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">{t('pages.projects.insights.avgPerProject')}</span>
                    <span className="font-medium">
                      {formatCurrency(
                        totalProjects > 0 
                          ? projects.reduce((sum: number, p: any) => sum + (p.totalCost || 0), 0) / totalProjects 
                          : 0, 
                        currency
                      )}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </DragonCard>
        </div>
      </div>

      {/* Projects List - Direct from store! */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">{t('pages.projects.breakdown.title')}</h3>
        
        <div className="grid gap-4">
          {projects?.map((project: any, index: number) => {
            const isTopProject = index < 3
            
            return (
              <DragonCard
                key={project.project || project.name || index}
                variant={isTopProject ? 'scales' : 'default'}
                className="transition-all duration-300 hover:scale-[1.02]"
              >
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-dragon-primary to-dragon-secondary flex items-center justify-center">
                        <FolderOpen className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-lg">
                          {project.project || project.name || `Project ${index + 1}`}
                        </h4>
                        <p className="text-sm text-muted-foreground">
                          {project.lastActivity 
                            ? `${t('pages.projects.breakdown.lastActivity')} ${getRelativeTime(project.lastActivity)}`
                            : t('pages.projects.breakdown.noRecentActivity')}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      {isTopProject && (
                        <DragonBadge variant="gold">
                          {t('pages.projects.breakdown.top')} {index + 1}
                        </DragonBadge>
                      )}
                      <DragonBadge variant="dragon">
                        {((project.totalCost || 0) / Math.max(1, projects.reduce((sum: number, p: any) => sum + (p.totalCost || 0), 0)) * 100).toFixed(1)}% {t('pages.projects.breakdown.ofTotal')}
                      </DragonBadge>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground mb-1">{t('pages.projects.stats.totalCost')}</p>
                      <p className="font-bold text-lg text-dragon-accent">
                        {formatCurrency(project.totalCost || 0, currency)}
                      </p>
                    </div>
                    
                    <div>
                      <p className="text-muted-foreground mb-1">{t('pages.projects.stats.tokensUsed')}</p>
                      <p className="font-semibold">
                        {formatNumber(project.totalTokens || 0)}
                      </p>
                    </div>
                    
                    <div>
                      <p className="text-muted-foreground mb-1">{t('pages.projects.stats.sessions')}</p>
                      <p className="font-semibold flex items-center space-x-1">
                        <Zap className="h-3 w-3" />
                        <span>{project.sessions || 0}</span>
                      </p>
                    </div>
                    
                    <div>
                      <p className="text-muted-foreground mb-1">{t('pages.projects.stats.avgCostPerSession')}</p>
                      <p className="font-semibold">
                        {formatCurrency(project.avgCostPerSession || 0, currency)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 pt-4 border-t border-border/50">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>
                        {t('pages.projects.breakdown.costPer1MTokens')}: {formatCurrency(
                          (project.totalTokens || 0) > 0 
                            ? ((project.totalCost || 0) / (project.totalTokens || 1)) * 1000000 
                            : 0, 
                          currency
                        )}
                      </span>
                      <span className="mx-4">
                        {project.models && project.models.length > 0 && (
                          <span>{project.models.length} {t('pages.projects.breakdown.models')} ({project.models.join(', ')})</span>
                        )}
                      </span>
                      <span>
                        {t('pages.projects.breakdown.tokensPerSession')}: {formatNumber(
                          (project.sessions || 0) > 0 
                            ? (project.totalTokens || 0) / (project.sessions || 1) 
                            : 0
                        )}
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