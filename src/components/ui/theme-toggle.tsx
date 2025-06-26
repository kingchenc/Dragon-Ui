import * as React from "react"
import { Moon, Sun } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useAppStore } from "@/lib/store"
import { useTranslation } from "@/i18n"
import { cn } from "@/lib/utils"

interface ThemeToggleProps extends React.HTMLAttributes<HTMLButtonElement> {
  variant?: 'button' | 'icon' | 'dragon'
}

const ThemeToggle = React.forwardRef<HTMLButtonElement, ThemeToggleProps>(
  ({ className, variant = 'button', ...props }, ref) => {
    const { theme, toggleTheme } = useAppStore()
    const { t } = useTranslation()

    const handleToggle = () => {
      toggleTheme()
    }

    if (variant === 'icon') {
      return (
        <Button
          ref={ref}
          variant="ghost"
          size="icon"
          onClick={handleToggle}
          className={cn(
            "relative overflow-hidden transition-all duration-300",
            className
          )}
          {...props}
        >
          <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          <span className="sr-only">{t('app.theme.toggle')}</span>
        </Button>
      )
    }

    if (variant === 'dragon') {
      return (
        <Button
          ref={ref}
          variant="dragon"
          size="sm"
          onClick={handleToggle}
          className={cn(
            "relative overflow-hidden group transition-all duration-300",
            className
          )}
          {...props}
        >
          <div className="flex items-center space-x-2">
            <div className="relative">
              <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
              <Moon className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            </div>
            <span className="text-sm font-medium">
              {theme === 'light' ? t('app.theme.dark') : t('app.theme.light')}
            </span>
          </div>
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-0 group-hover:opacity-100 transform -skew-x-12 -translate-x-full group-hover:translate-x-full transition-all duration-700" />
        </Button>
      )
    }

    return (
      <Button
        ref={ref}
        variant="outline"
        size="sm"
        onClick={handleToggle}
        className={cn(
          "relative overflow-hidden transition-all duration-300",
          className
        )}
        {...props}
      >
        <div className="flex items-center space-x-2">
          <div className="relative">
            <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          </div>
          <span className="text-sm">
            {theme === 'light' ? t('app.theme.darkMode') : t('app.theme.lightMode')}
          </span>
        </div>
      </Button>
    )
  }
)
ThemeToggle.displayName = "ThemeToggle"

export { ThemeToggle }