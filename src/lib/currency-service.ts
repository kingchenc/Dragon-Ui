// Currency Exchange Rate Service
// Fetches real-time exchange rates and stores them in RAM cache

// Simplified currency service without ramCache dependency
export interface CurrencyRate {
  code: string;
  rate: number;
  lastUpdated: Date;
}

export interface ExchangeRateResponse {
  rates: Record<string, number>
  base: string
  date: string
}

export interface SupportedCurrency {
  code: string
  name: string
  symbol: string
  flag: string
}

export const SUPPORTED_CURRENCIES: SupportedCurrency[] = [
  { code: 'USD', name: 'US Dollar', symbol: '$', flag: '🇺🇸' },
  { code: 'EUR', name: 'Euro', symbol: '€', flag: '🇪🇺' },
  { code: 'GBP', name: 'British Pound', symbol: '£', flag: '🇬🇧' },
  { code: 'JPY', name: 'Japanese Yen', symbol: '¥', flag: '🇯🇵' },
  { code: 'CHF', name: 'Swiss Franc', symbol: 'CHF', flag: '🇨🇭' },
  { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$', flag: '🇨🇦' },
  { code: 'AUD', name: 'Australian Dollar', symbol: 'A$', flag: '🇦🇺' },
  { code: 'CNY', name: 'Chinese Yuan', symbol: '¥', flag: '🇨🇳' },
  { code: 'KRW', name: 'South Korean Won', symbol: '₩', flag: '🇰🇷' },
  { code: 'INR', name: 'Indian Rupee', symbol: '₹', flag: '🇮🇳' },
  { code: 'BRL', name: 'Brazilian Real', symbol: 'R$', flag: '🇧🇷' },
  { code: 'MXN', name: 'Mexican Peso', symbol: '$', flag: '🇲🇽' },
]

export class CurrencyService {
  private static instance: CurrencyService
  private apiKey: string | null = null
  private currencyRates: Record<string, CurrencyRate> = {}
  private selectedCurrency: string = 'USD'
  private storeUpdater: ((rates: Record<string, CurrencyRate>, currency: string) => void) | null = null
  private fallbackRates: Record<string, number> = {
    'USD': 1.0,
    'EUR': 0.9234,   // Updated fallback rates (Dec 2024)
    'GBP': 0.7892,
    'JPY': 149.67,
    'CHF': 0.8834,
    'CAD': 1.3562,
    'AUD': 1.4823,
    'CNY': 7.1234,
    'KRW': 1387.50,
    'INR': 83.42,
    'BRL': 5.8934,
    'MXN': 20.124,
  }

  private constructor() {
    console.log('[MONEY] Initializing Currency Service...')
  }
  
  // Set store updater function for direct communication with store.ts
  setStoreUpdater(updater: (rates: Record<string, CurrencyRate>, currency: string) => void) {
    this.storeUpdater = updater
    console.log('[MONEY] Currency service connected to store.ts')
  }

  static getInstance(): CurrencyService {
    if (!CurrencyService.instance) {
      CurrencyService.instance = new CurrencyService()
    }
    return CurrencyService.instance
  }

  // Set API key for premium exchange rate services (optional)
  setApiKey(key: string): void {
    this.apiKey = key
    console.log('[CURRENCY] Currency service API key configured')
  }

  // Fetch exchange rates from multiple sources with fallbacks
  async fetchExchangeRates(): Promise<Record<string, CurrencyRate>> {
    console.log('[MONEY] Fetching exchange rates...')
    
    try {
      // Try multiple free APIs in order of preference
      const rates = await this.tryMultipleSources()
      
      // Convert to CurrencyRate format
      const currencyRates: Record<string, CurrencyRate> = {}
      const now = new Date()
      
      Object.entries(rates).forEach(([code, rate]) => {
        currencyRates[code] = {
          code,
          rate,
          lastUpdated: now
        }
      })
      
      // Cache the rates internally
      this.currencyRates = currencyRates
      console.log(`[MONEY] Successfully fetched ${Object.keys(rates).length} exchange rates`)
      
      // Update store.ts directly if connected
      if (this.storeUpdater) {
        this.storeUpdater(currencyRates, this.selectedCurrency)
        console.log('[CURRENCY] Exchange rates sent to store.ts')
      }
      
      // Only log sample rates once to prevent spam
      if (Math.random() < 0.2) { // 20% chance to log sample rates
        console.log('[CURRENCY] Sample rates:', { EUR: rates.EUR, GBP: rates.GBP, JPY: rates.JPY })
      }
      
      return currencyRates
    } catch (error) {
      console.error('[ERR] All APIs failed, using fallback rates:', error)
      return this.getFallbackRates()
    }
  }

  // Try multiple free exchange rate APIs (CSP-compliant)
  private async tryMultipleSources(): Promise<Record<string, number>> {
    const sources = [
      () => this.fetchFromExchangeRateHost(), // CSP-friendly
      () => this.fetchFromFrankfurter(),      // CSP-friendly  
      () => this.fetchFromExchangeRateApi(),   // Original fallback
      () => this.fetchFromFreeForexApi(),      // Original fallback
      () => this.fetchFromCurrencyApi(),       // Original fallback
      () => this.scrapeFromXE(),               // Web scraping fallback
      () => this.scrapeFromYahooFinance(),     // Web scraping fallback
    ]

    for (const source of sources) {
      try {
        const rates = await source()
        if (rates && Object.keys(rates).length > 0) {
          return rates
        }
      } catch (error) {
        console.warn('[CURRENCY] Exchange rate source failed, trying next...', error)
        continue
      }
    }

    throw new Error('All exchange rate sources failed')
  }

  // Source 1: exchangerate.host (CSP-friendly, completely free)
  private async fetchFromExchangeRateHost(): Promise<Record<string, number>> {
    const url = 'https://api.exchangerate.host/latest?base=USD'
    
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }
    
    const data = await response.json()
    return data.rates
  }

  // Source 2: frankfurter.app (CSP-friendly, open source)
  private async fetchFromFrankfurter(): Promise<Record<string, number>> {
    const url = 'https://api.frankfurter.app/latest?from=USD'
    
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }
    
    const data = await response.json()
    // Add USD rate (frankfurter doesn't include base currency)
    const rates = { USD: 1.0, ...data.rates }
    return rates
  }

  // Source 3: exchangerate-api.com (free tier)
  private async fetchFromExchangeRateApi(): Promise<Record<string, number>> {
    const url = 'https://api.exchangerate-api.com/v4/latest/USD'
    
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }
    
    const data: ExchangeRateResponse = await response.json()
    return data.rates
  }

  // Source 2: freeforexapi.com (backup)
  private async fetchFromFreeForexApi(): Promise<Record<string, number>> {
    const currencies = SUPPORTED_CURRENCIES.map(c => c.code).filter(c => c !== 'USD').join(',')
    const url = `https://api.freeforexapi.com/api/live?pairs=USD${currencies}`
    
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }
    
    const data = await response.json()
    const rates: Record<string, number> = { USD: 1.0 }
    
    Object.entries(data.rates).forEach(([pair, info]: [string, any]) => {
      const currency = pair.replace('USD', '')
      rates[currency] = info.rate
    })
    
    return rates
  }

  // Source 3: currencyapi.com (another backup)
  private async fetchFromCurrencyApi(): Promise<Record<string, number>> {
    const url = 'https://api.currencyapi.com/v3/latest?apikey=free&base_currency=USD'
    
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }
    
    const data = await response.json()
    const rates: Record<string, number> = {}
    
    Object.entries(data.data).forEach(([code, info]: [string, any]) => {
      rates[code] = info.value
    })
    
    return rates
  }

  // Fallback rates when all APIs fail
  private getFallbackRates(): Record<string, CurrencyRate> {
    console.log('[CURRENCY] Using fallback exchange rates (may be outdated)')
    
    const currencyRates: Record<string, CurrencyRate> = {}
    const now = new Date()
    
    Object.entries(this.fallbackRates).forEach(([code, rate]) => {
      currencyRates[code] = {
        code,
        rate,
        lastUpdated: now
      }
    })
    
    this.currencyRates = currencyRates
    
    // Update store.ts directly if connected
    if (this.storeUpdater) {
      this.storeUpdater(currencyRates, this.selectedCurrency)
      console.log('[CURRENCY] Fallback rates sent to store.ts')
    }
    
    return currencyRates
  }

  // Convert amount from USD to target currency
  convertFromUSD(amount: number, targetCurrency: string): number {
    if (targetCurrency === 'USD') return amount
    
    const rate = this.getCurrencyRate(targetCurrency)
    return amount * rate
  }

  // Convert amount from any currency to USD
  convertToUSD(amount: number, fromCurrency: string): number {
    if (fromCurrency === 'USD') return amount
    
    const rate = this.getCurrencyRate(fromCurrency)
    return amount / rate
  }

  // Get currency rate
  getCurrencyRate(currency: string): number {
    if (currency === 'USD') return 1.0
    
    const currencyRate = this.currencyRates[currency]
    if (currencyRate) {
      return currencyRate.rate
    }
    
    // Fallback to hardcoded rates
    return this.fallbackRates[currency] || 1.0
  }

  // Convert between any two currencies
  convertCurrency(amount: number, fromCurrency: string, toCurrency: string): number {
    if (fromCurrency === toCurrency) return amount
    
    // Convert to USD first, then to target currency
    const usdAmount = this.convertToUSD(amount, fromCurrency)
    return this.convertFromUSD(usdAmount, toCurrency)
  }

  // Format currency with proper symbol and locale
  formatCurrency(amount: number, currency: string, locale: string = 'en-US'): string {
    const currencyInfo = SUPPORTED_CURRENCIES.find(c => c.code === currency)
    
    try {
      return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: currency,
        minimumFractionDigits: currency === 'JPY' || currency === 'KRW' ? 0 : 2,
        maximumFractionDigits: currency === 'JPY' || currency === 'KRW' ? 0 : 2,
      }).format(amount)
    } catch (error) {
      // Fallback formatting if Intl fails
      const symbol = currencyInfo?.symbol || currency
      const decimals = currency === 'JPY' || currency === 'KRW' ? 0 : 2
      return `${symbol}${amount.toFixed(decimals)}`
    }
  }

  // Get currency symbol
  getCurrencySymbol(currency: string): string {
    const currencyInfo = SUPPORTED_CURRENCIES.find(c => c.code === currency)
    return currencyInfo?.symbol || currency
  }

  // Get currency info
  getCurrencyInfo(currency: string): SupportedCurrency | null {
    return SUPPORTED_CURRENCIES.find(c => c.code === currency) || null
  }

  // Get selected currency
  getSelectedCurrency(): string {
    return this.selectedCurrency
  }

  // Set selected currency
  setSelectedCurrency(currency: string): void {
    this.selectedCurrency = currency
    
    // Update store.ts directly if connected
    if (this.storeUpdater) {
      this.storeUpdater(this.currencyRates, this.selectedCurrency)
      console.log(`[CURRENCY] Currency changed to ${currency} - store.ts updated`)
    }
  }

  // Check if rates are fresh (uses settings for threshold, fallback 1 hour)
  areRatesFresh(): boolean {
    const currencies = Object.values(this.currencyRates)
    if (currencies.length === 0) return false
    
    // Get freshness threshold from settings (or fallback to 1 hour)
    let freshnessThreshold = 60 * 60 * 1000 // 1 hour default
    try {
      const { useAppStore } = require('./store')
      const settings = useAppStore.getState().settings
      // Currency rates should be fresher than regular data, use 10x refresh interval
      freshnessThreshold = Math.max(settings.refreshInterval * 1000 * 10, 60 * 60 * 1000)
    } catch {
      // Fallback if store not available
    }
    
    const thresholdTime = new Date(Date.now() - freshnessThreshold)
    return currencies.every(rate => rate.lastUpdated > thresholdTime)
  }

  // Force refresh rates
  async refreshRates(): Promise<void> {
    console.log('[CURRENCY] Force refreshing exchange rates...')
    await this.fetchExchangeRates()
  }

  // Get status of currency service
  getStatus(): {
    isConfigured: boolean
    ratesCount: number
    lastUpdate: Date | null
    freshness: boolean
    selectedCurrency: string
  } {
    const currencies = Object.values(this.currencyRates)
    
    return {
      isConfigured: Object.keys(this.currencyRates).length > 0,
      ratesCount: currencies.length,
      lastUpdate: currencies.length > 0 ? currencies[0].lastUpdated : null,
      freshness: this.areRatesFresh(),
      selectedCurrency: this.getSelectedCurrency()
    }
  }

  // Debug helper
  logStatus(): void {
    const status = this.getStatus()
    console.log('[CURRENCY] Currency Service Status:', {
      'Configured': status.isConfigured,
      'Rates Count': status.ratesCount,
      'Last Update': status.lastUpdate?.toLocaleString(),
      'Fresh': status.freshness,
      'Selected Currency': status.selectedCurrency
    })
  }

  // Web scraping fallback: XE.com (placeholder for future implementation)
  private async scrapeFromXE(): Promise<Record<string, number>> {
    console.log('[CURRENCY] XE.com scraping fallback (not implemented - requires CORS proxy)')
    
    // Note: Web scraping requires server-side implementation or CORS proxy
    // This is a placeholder that throws to move to next fallback
    throw new Error('XE scraping requires server-side implementation')
  }

  // Web scraping fallback: Yahoo Finance (placeholder for future implementation)
  private async scrapeFromYahooFinance(): Promise<Record<string, number>> {
    console.log('[CURRENCY] Yahoo Finance scraping fallback (not implemented - requires CORS proxy)')
    
    // Note: Web scraping requires server-side implementation or CORS proxy
    // This is a placeholder that throws to move to next fallback
    throw new Error('Yahoo Finance scraping requires server-side implementation')
  }
}

// Export singleton instance
export const currencyService = CurrencyService.getInstance()

// Helper function to format currency with current selection
export function formatCurrencyWithSelection(usdAmount: number): string {
  const service = CurrencyService.getInstance()
  const selectedCurrency = service.getSelectedCurrency()
  const convertedAmount = service.convertFromUSD(usdAmount, selectedCurrency)
  return service.formatCurrency(convertedAmount, selectedCurrency)
}

// Helper to get currency symbol for current selection
export function getCurrentCurrencySymbol(): string {
  const service = CurrencyService.getInstance()
  const selectedCurrency = service.getSelectedCurrency()
  return service.getCurrencySymbol(selectedCurrency)
}