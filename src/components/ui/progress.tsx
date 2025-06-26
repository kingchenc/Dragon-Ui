import * as React from "react"
import * as ProgressPrimitive from "@radix-ui/react-progress"
import { cn } from "@/lib/utils"

const Progress = React.forwardRef<
  React.ElementRef<typeof ProgressPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root>
>(({ className, value, ...props }, ref) => (
  <ProgressPrimitive.Root
    ref={ref}
    className={cn(
      "relative h-4 w-full overflow-hidden rounded-full bg-secondary",
      className
    )}
    {...props}
  >
    <ProgressPrimitive.Indicator
      className="h-full w-full flex-1 bg-primary transition-all"
      style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
    />
  </ProgressPrimitive.Root>
))
Progress.displayName = ProgressPrimitive.Root.displayName

const DragonProgress = React.forwardRef<
  React.ElementRef<typeof ProgressPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root> & {
    variant?: 'default' | 'flame' | 'emerald' | 'gold'
    animated?: boolean
  }
>(({ className, value, variant = 'default', animated = false, ...props }, ref) => {
  const variantClasses = {
    default: "bg-gradient-to-r from-dragon-primary to-dragon-secondary",
    flame: "bg-gradient-to-r from-dragon-flame to-orange-500",
    emerald: "bg-dragon-emerald",
    gold: "bg-gradient-to-r from-dragon-accent to-yellow-400"
  }

  return (
    <ProgressPrimitive.Root
      ref={ref}
      className={cn(
        "relative h-3 w-full overflow-hidden rounded-full bg-secondary/50 glass-effect",
        className
      )}
      {...props}
    >
      <ProgressPrimitive.Indicator
        className={cn(
          "h-full w-full flex-1 transition-all duration-500 ease-out relative",
          variantClasses[variant],
          animated && "animate-pulse"
        )}
        style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
      >
        {animated && (
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-scale-shimmer" />
        )}
      </ProgressPrimitive.Indicator>
    </ProgressPrimitive.Root>
  )
})
DragonProgress.displayName = "DragonProgress"

export { Progress, DragonProgress }