import * as React from "react"
import { LucideIcon } from "lucide-react"
import { DragonCard } from "@/components/ui/card"
import { DragonBadge } from "@/components/ui/badge"
import { DragonProgress } from "@/components/ui/progress"
import { cn, formatCurrency, formatNumber, calculatePercentageChange, getColorForPercentage } from "@/lib/utils"

interface StatsCardProps {
  title: string
  value: string | number
  previousValue?: string | number
  icon?: LucideIcon
  iconColor?: string
  variant?: 'default' | 'gradient' | 'scales' | 'flame'
  trend?: 'up' | 'down' | 'neutral'
  trendPercentage?: number
  subtitle?: string
  progress?: number
  maxValue?: number
  currency?: boolean
  className?: string
}

export const StatsCard = React.forwardRef<HTMLDivElement, StatsCardProps>(
  ({ 
    title, 
    value, 
    previousValue,
    icon: Icon,
    iconColor,
    variant = 'default',
    trend,
    trendPercentage,
    subtitle,
    progress,
    maxValue,
    currency = false,
    className,
    ...props 
  }, ref) => {
    
    const formatValue = (val: string | number) => {
      if (typeof val === 'string') return val
      return currency ? formatCurrency(val) : formatNumber(val)
    }

    const calculatedTrendPercentage = React.useMemo(() => {
      if (trendPercentage !== undefined) return trendPercentage
      if (previousValue !== undefined && typeof value === 'number' && typeof previousValue === 'number') {
        return calculatePercentageChange(value, previousValue)
      }
      return undefined
    }, [value, previousValue, trendPercentage])

    const determineTrend = React.useMemo(() => {
      if (trend) return trend
      if (calculatedTrendPercentage !== undefined) {
        if (calculatedTrendPercentage > 0) return 'up'
        if (calculatedTrendPercentage < 0) return 'down'
        return 'neutral'
      }
      return 'neutral'
    }, [trend, calculatedTrendPercentage])

    const progressPercentage = React.useMemo(() => {
      if (progress !== undefined) return progress
      if (maxValue && typeof value === 'number') {
        return Math.min((value / maxValue) * 100, 100)
      }
      return undefined
    }, [progress, value, maxValue])
    
    const getIconColor = React.useMemo(() => {
      // Use custom iconColor if provided
      if (iconColor) return iconColor;
      
      // Fallback to variant-based colors
      switch (variant) {
        case 'gradient':
          return 'text-dragon-primary group-hover:text-dragon-secondary'
        case 'scales':
          return 'text-dragon-secondary group-hover:text-dragon-primary'
        case 'flame':
          return 'text-dragon-accent group-hover:text-dragon-primary'
        default:
          return 'text-dragon-primary group-hover:text-dragon-secondary'
      }
    }, [variant, iconColor])

    return (
      <DragonCard
        ref={ref}
        variant={variant}
        className={cn(
          "p-6 transition-all duration-300 hover:scale-110 hover:shadow-lg hover:shadow-red-500/20 dragon-flame-border group relative z-10 hover:z-20",
          className
        )}
        {...props}
      >
        <div className="flex items-start justify-between">
          <div className="space-y-2 flex-1">
            <div className="flex items-center space-x-2">
              {Icon && (
                <Icon className={cn("h-5 w-5 transition-colors", getIconColor)} />
              )}
              <p className="text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors">
                {title}
              </p>
            </div>
            
            <div className="space-y-1">
              <p className="text-2xl font-bold tracking-tight">
                {formatValue(value)}
              </p>
              
              {subtitle && (
                <p className="text-sm text-muted-foreground">
                  {subtitle}
                </p>
              )}
            </div>

            {calculatedTrendPercentage !== undefined && (
              <div className="flex items-center space-x-2">
                <DragonBadge
                  variant={determineTrend === 'up' ? 'emerald' : determineTrend === 'down' ? 'flame' : 'scale'}
                  className="text-xs"
                >
                  {calculatedTrendPercentage > 0 ? '+' : ''}{calculatedTrendPercentage.toFixed(1)}%
                </DragonBadge>
                <span className="text-xs text-muted-foreground">
                  vs previous period
                </span>
              </div>
            )}

            {progressPercentage !== undefined && (
              <div className="space-y-2">
                <DragonProgress
                  value={progressPercentage}
                  variant={
                    variant === 'flame' ? 'flame' : 
                    variant === 'scales' ? 'emerald' : 
                    'default'
                  }
                  animated={true}
                  className="h-2"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{formatValue(value)}</span>
                  {maxValue && <span>{formatValue(maxValue)}</span>}
                </div>
              </div>
            )}
          </div>
        </div>
      </DragonCard>
    )
  }
)

StatsCard.displayName = "StatsCard"

interface StatsGridProps {
  children: React.ReactNode
  columns?: 1 | 2 | 3 | 4
  className?: string
}

export const StatsGrid = React.forwardRef<HTMLDivElement, StatsGridProps>(
  ({ children, columns = 4, className, ...props }, ref) => {
    const gridClasses = {
      1: "grid-cols-1",
      2: "grid-cols-1 md:grid-cols-2",
      3: "grid-cols-1 md:grid-cols-2 lg:grid-cols-3",
      4: "grid-cols-1 md:grid-cols-2 lg:grid-cols-4"
    }

    return (
      <div
        ref={ref}
        className={cn(
          "grid gap-4",
          gridClasses[columns],
          className
        )}
        {...props}
      >
        {children}
      </div>
    )
  }
)

StatsGrid.displayName = "StatsGrid"