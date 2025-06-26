import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'

// Remove StrictMode to prevent double initialization in development
ReactDOM.createRoot(document.getElementById('root')!).render(
  <App />
)