import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Get app version from Vite build-time constant
export function getAppVersion(): string {
  // @ts-ignore - Vite build-time constant
  return typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '1.0.0';
}

export function formatCurrency(amount: number, currency: string = 'USD'): string {
  // Safety check for null/undefined/NaN
  if (!amount || typeof amount !== 'number' || isNaN(amount) || !isFinite(amount)) {
    amount = 0
  }
  
  // Simple formatter - amount should already be converted by store.ts
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: currency === 'JPY' || currency === 'KRW' ? 0 : 2,
      maximumFractionDigits: currency === 'JPY' || currency === 'KRW' ? 0 : 2,
    }).format(amount)
  } catch (error) {
    // Fallback to USD formatting
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount)
  }
}

export function formatNumber(num: number): string {
  // Safety check for null/undefined/NaN
  if (!num || typeof num !== 'number' || isNaN(num) || !isFinite(num)) {
    return '0'
  }
  
  if (num >= 1e9) {
    return (num / 1e9).toFixed(1) + 'B'
  }
  if (num >= 1e6) {
    return (num / 1e6).toFixed(1) + 'M'
  }
  if (num >= 1e3) {
    return (num / 1e3).toFixed(1) + 'K'
  }
  return num.toLocaleString()
}

export function formatDate(
  date: string | Date, 
  timezone: string = 'auto',
  options?: Intl.DateTimeFormatOptions
): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date
  const timeZone = timezone === 'auto' ? undefined : timezone
  
  return dateObj.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: timeZone,
    ...options,
  })
}

export function formatTime(date: string | Date): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date
  
  return dateObj.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  })
}

export function formatDateTime(date: string | Date): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date
  
  return dateObj.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  })
}

export function formatDuration(startTime: string | Date, endTime: string | Date): string {
  const start = typeof startTime === 'string' ? new Date(startTime) : startTime
  const end = typeof endTime === 'string' ? new Date(endTime) : endTime
  const diffMs = end.getTime() - start.getTime()
  
  const diffMinutes = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMinutes / 60)
  const diffDays = Math.floor(diffHours / 24)
  
  if (diffDays > 0) {
    return `${diffDays}d ${diffHours % 24}h`
  }
  if (diffHours > 0) {
    return `${diffHours}h ${diffMinutes % 60}m`
  }
  return `${diffMinutes}m`
}

export function getRelativeTime(date: string | Date): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date
  const now = new Date()
  const diffMs = now.getTime() - dateObj.getTime()
  
  const diffMinutes = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMinutes / 60)
  const diffDays = Math.floor(diffHours / 24)
  
  if (diffMinutes < 1) {
    return 'Just now'
  }
  if (diffMinutes < 60) {
    return `${diffMinutes}m ago`
  }
  if (diffHours < 24) {
    return `${diffHours}h ago`
  }
  if (diffDays < 7) {
    return `${diffDays}d ago`
  }
  
  return formatDate(dateObj)
}

export function calculatePercentageChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0
  return ((current - previous) / previous) * 100
}

export function getColorForPercentage(percentage: number): string {
  if (percentage > 0) return 'text-green-500'
  if (percentage < 0) return 'text-red-500'
  return 'text-gray-500'
}

export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength) + '...'
}

export function generateId(): string {
  return Math.random().toString(36).substr(2, 9)
}

export function debounce<T extends (...args: any[]) => void>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null
  
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout)
    timeout = setTimeout(() => func(...args), wait)
  }
}

export function throttle<T extends (...args: any[]) => void>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean
  
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args)
      inThrottle = true
      setTimeout(() => (inThrottle = false), limit)
    }
  }
}

export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

export function isValidUrl(url: string): boolean {
  try {
    new URL(url)
    return true
  } catch {
    return false
  }
}

export function copyToClipboard(text: string): Promise<void> {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    return navigator.clipboard.writeText(text)
  } else {
    // Fallback for older browsers
    const textArea = document.createElement('textarea')
    textArea.value = text
    document.body.appendChild(textArea)
    textArea.focus()
    textArea.select()
    
    try {
      document.execCommand('copy')
      return Promise.resolve()
    } catch (err) {
      return Promise.reject(err)
    } finally {
      document.body.removeChild(textArea)
    }
  }
}

export function downloadData(data: any, filename: string, type: string = 'application/json'): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export function exportToCsv(data: any[], filename: string): void {
  if (data.length === 0) return
  
  const headers = Object.keys(data[0])
  const csvContent = [
    headers.join(','),
    ...data.map(row => 
      headers.map(header => 
        JSON.stringify(row[header] || '')
      ).join(',')
    )
  ].join('\n')
  
  const blob = new Blob([csvContent], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export function getModelColor(model: string): string {
  const colors: Record<string, string> = {
    'claude-3-opus': '#7C3AED',
    'claude-3-sonnet': '#3B82F6',
    'claude-3-haiku': '#10B981',
    'claude-2': '#F59E0B',
    'claude-instant': '#EF4444',
  }
  
  return colors[model.toLowerCase()] || '#6B7280'
}

export function getDragonThemeColors() {
  return {
    primary: '#7C3AED',     // Deep purple
    secondary: '#3B82F6',   // Electric blue
    accent: '#F59E0B',      // Gold
    flame: '#EF4444',       // Flame red
    scale: '#1F2937',       // Dark scale
    emerald: '#10B981',     // Dragon emerald
    shadow: '#111827',      // Deep shadow
  }
}

export function generateDragonGradient(direction: string = '135deg'): string {
  const colors = getDragonThemeColors()
  return `linear-gradient(${direction}, ${colors.primary}20, ${colors.secondary}20, ${colors.accent}20)`
}