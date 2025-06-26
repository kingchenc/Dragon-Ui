import * as React from "react"
import { cn } from "@/lib/utils"

interface LoadingSpinnerProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: 'sm' | 'md' | 'lg' | 'xl'
  variant?: 'default' | 'dragon' | 'flame'
}

const LoadingSpinner = React.forwardRef<HTMLDivElement, LoadingSpinnerProps>(
  ({ className, size = 'md', variant = 'default', ...props }, ref) => {
    const sizeClasses = {
      sm: 'w-4 h-4',
      md: 'w-6 h-6',
      lg: 'w-8 h-8',
      xl: 'w-12 h-12'
    }

    const variantClasses = {
      default: 'border-primary',
      dragon: 'border-dragon-primary',
      flame: 'border-dragon-flame'
    }

    return (
      <div
        ref={ref}
        className={cn(
          "animate-spin rounded-full border-2 border-solid border-current border-r-transparent",
          sizeClasses[size],
          variantClasses[variant],
          className
        )}
        {...props}
      />
    )
  }
)
LoadingSpinner.displayName = "LoadingSpinner"

interface DragonLoadingProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: 'sm' | 'md' | 'lg' | 'xl'
  text?: string
}

const DragonLoading = React.forwardRef<HTMLDivElement, DragonLoadingProps>(
  ({ className, size = 'md', text, ...props }, ref) => {
    const sizeClasses = {
      sm: 'w-6 h-6',
      md: 'w-8 h-8',
      lg: 'w-12 h-12',
      xl: 'w-16 h-16'
    }

    return (
      <div
        ref={ref}
        className={cn("flex flex-col items-center justify-center space-y-2", className)}
        {...props}
      >
        <div className="relative">
          <div
            className={cn(
              "animate-spin rounded-full border-4 border-dragon-primary/20",
              sizeClasses[size]
            )}
          />
          <div
            className={cn(
              "absolute inset-0 animate-spin rounded-full border-4 border-transparent border-t-dragon-primary border-r-dragon-secondary",
              sizeClasses[size]
            )}
            style={{ animationDuration: '1s' }}
          />
          <div
            className={cn(
              "absolute inset-2 animate-pulse rounded-full bg-gradient-to-br from-dragon-primary/20 to-dragon-secondary/20"
            )}
          />
        </div>
        {text && (
          <p className="text-sm text-muted-foreground animate-pulse">
            {text}
          </p>
        )}
      </div>
    )
  }
)
DragonLoading.displayName = "DragonLoading"

interface LoadingDotsProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: 'sm' | 'md' | 'lg'
  variant?: 'default' | 'dragon'
}

const LoadingDots = React.forwardRef<HTMLDivElement, LoadingDotsProps>(
  ({ className, size = 'md', variant = 'default', ...props }, ref) => {
    const sizeClasses = {
      sm: 'w-1 h-1',
      md: 'w-2 h-2',
      lg: 'w-3 h-3'
    }

    const variantClasses = {
      default: 'bg-primary',
      dragon: 'bg-dragon-primary'
    }

    return (
      <div
        ref={ref}
        className={cn("flex space-x-1", className)}
        {...props}
      >
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className={cn(
              "rounded-full animate-pulse",
              sizeClasses[size],
              variantClasses[variant]
            )}
            style={{
              animationDelay: `${i * 0.2}s`,
              animationDuration: '1s'
            }}
          />
        ))}
      </div>
    )
  }
)
LoadingDots.displayName = "LoadingDots"

const LoadingOverlay = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { 
    visible: boolean
    text?: string
  }
>(({ className, visible, text = "Loading...", ...props }, ref) => {
  if (!visible) return null

  return (
    <div
      ref={ref}
      className={cn(
        "fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm",
        className
      )}
      {...props}
    >
      <DragonLoading size="lg" text={text} />
    </div>
  )
})
LoadingOverlay.displayName = "LoadingOverlay"

export { 
  LoadingSpinner, 
  DragonLoading, 
  LoadingDots, 
  LoadingOverlay 
}