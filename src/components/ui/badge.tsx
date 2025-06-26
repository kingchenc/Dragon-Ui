import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80",
        outline: "text-foreground",
        dragon: "border-transparent bg-gradient-to-r from-dragon-primary to-dragon-secondary text-white hover:shadow-lg transition-all duration-300",
        flame: "border-transparent bg-dragon-flame text-white hover:shadow-lg hover:shadow-dragon-flame/25",
        emerald: "border-transparent bg-dragon-emerald text-white",
        scale: "border-dragon-primary/20 bg-dragon-scale text-white",
        gold: "border-transparent bg-dragon-accent text-black font-bold",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

const DragonBadge = React.forwardRef<
  HTMLDivElement,
  BadgeProps & {
    pulse?: boolean
    glow?: boolean
  }
>(({ className, variant = "dragon", pulse = false, glow = false, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      badgeVariants({ variant }),
      pulse && "animate-pulse",
      glow && "shadow-lg shadow-current/25",
      className
    )}
    {...props}
  />
))
DragonBadge.displayName = "DragonBadge"

export { Badge, badgeVariants, DragonBadge }