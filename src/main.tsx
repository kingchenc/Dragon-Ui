import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'

// Error Boundary to catch and display React errors
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[ErrorBoundary] Caught error:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: '40px',
          backgroundColor: '#1a1a1a',
          color: '#fff',
          minHeight: '100vh',
          fontFamily: 'monospace'
        }}>
          <h1 style={{ color: '#ff6b6b' }}>Dragon UI Error</h1>
          <p>Something went wrong. Check the console for details.</p>
          <pre style={{
            backgroundColor: '#2a2a2a',
            padding: '20px',
            borderRadius: '8px',
            overflow: 'auto',
            whiteSpace: 'pre-wrap'
          }}>
            {this.state.error?.message}
            {'\n\n'}
            {this.state.error?.stack}
          </pre>
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: '20px',
              padding: '10px 20px',
              backgroundColor: '#4ade80',
              color: '#000',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Reload App
          </button>
        </div>
      )
    }

    return this.props.children
  }
}

// Remove StrictMode to prevent double initialization in development
ReactDOM.createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
)