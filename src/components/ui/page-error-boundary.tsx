import React, { Component, ErrorInfo, ReactNode } from 'react'
import { AlertCircle, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

interface PageErrorBoundaryProps {
  children: ReactNode
  pageName?: string
  onRetry?: () => void
}

interface PageErrorBoundaryState {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
}

export class PageErrorBoundary extends Component<PageErrorBoundaryProps, PageErrorBoundaryState> {
  constructor(props: PageErrorBoundaryProps) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    }
  }

  static getDerivedStateFromError(error: Error): Partial<PageErrorBoundaryState> {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({ errorInfo })

    // Log error for debugging (in production, send to error reporting service)
    if (process.env.NODE_ENV === 'development') {
      console.error(`[PageErrorBoundary] Error in ${this.props.pageName || 'page'}:`, error)
      console.error('[PageErrorBoundary] Component stack:', errorInfo.componentStack)
    }
  }

  handleRetry = (): void => {
    this.setState({ hasError: false, error: null, errorInfo: null })
    this.props.onRetry?.()
  }

  render(): ReactNode {
    if (this.state.hasError) {
      const { error } = this.state
      const { pageName } = this.props

      return (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardHeader>
            <div className="flex items-center space-x-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              <CardTitle className="text-destructive">
                {pageName ? `Error loading ${pageName}` : 'Something went wrong'}
              </CardTitle>
            </div>
            <CardDescription>
              An unexpected error occurred while rendering this page.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {process.env.NODE_ENV === 'development' && error && (
              <div className="p-3 bg-muted rounded-md">
                <p className="text-sm font-mono text-destructive break-all">
                  {error.message}
                </p>
              </div>
            )}

            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={this.handleRetry}
                className="flex items-center space-x-2"
              >
                <RefreshCw className="h-4 w-4" />
                <span>Try Again</span>
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => window.location.reload()}
              >
                Reload App
              </Button>
            </div>
          </CardContent>
        </Card>
      )
    }

    return this.props.children
  }
}

export default PageErrorBoundary
