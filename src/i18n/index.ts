import { useState, useEffect } from 'react'
import { LanguageCode, DEFAULT_LANGUAGE } from './languages'

// Translation type for type safety
export type TranslationKeys = {
  [key: string]: string | TranslationKeys
}

// Translation cache
const translationCache: Record<LanguageCode, TranslationKeys> = {}

// Load translation file
const loadTranslation = async (language: LanguageCode): Promise<TranslationKeys> => {
  if (translationCache[language]) {
    return translationCache[language]
  }

  try {
    const translation = await import(`./locales/${language}.json`)
    translationCache[language] = translation.default || translation
    return translationCache[language]
  } catch (error) {
    console.warn(`Failed to load translation for ${language}, falling back to English`)
    if (language !== DEFAULT_LANGUAGE) {
      return loadTranslation(DEFAULT_LANGUAGE)
    }
    return {}
  }
}

// Get nested translation value
const getNestedValue = (obj: TranslationKeys, path: string): string => {
  const keys = path.split('.')
  let current: any = obj
  
  for (const key of keys) {
    if (current && typeof current === 'object' && key in current) {
      current = current[key]
    } else {
      return path // Return key if not found
    }
  }
  
  return typeof current === 'string' ? current : path
}

// Global language state
let currentLanguage: LanguageCode = DEFAULT_LANGUAGE
let currentTranslations: TranslationKeys = {}
const subscribers: Set<() => void> = new Set()
let isInitialized = false
let initializationPromise: Promise<void> | null = null

// Initialize with default language immediately to avoid missing translation warnings
const initializeDefault = async () => {
  if (!isInitialized && !initializationPromise) {
    console.log('[i18n] Initializing with default language:', DEFAULT_LANGUAGE)
    initializationPromise = loadTranslation(DEFAULT_LANGUAGE).then(translations => {
      currentTranslations = translations
      isInitialized = true
      notify() // Notify components that translations are ready
    })
    await initializationPromise
  }
}

// Initialize immediately
initializeDefault()

// Subscribe to language changes
const subscribe = (callback: () => void) => {
  subscribers.add(callback)
  return () => subscribers.delete(callback)
}

// Notify subscribers
const notify = () => {
  console.log('[i18n] Notifying', subscribers.size, 'subscribers')
  subscribers.forEach(callback => callback())
}

// Change language globally
export const changeLanguage = async (language: LanguageCode) => {
  console.log('[i18n] changeLanguage called with:', language, 'current:', currentLanguage)
  
  if (language === currentLanguage) {
    console.log('[i18n] Language already set, skipping')
    return
  }
  
  console.log('[i18n] Loading translations for:', language)
  currentLanguage = language
  currentTranslations = await loadTranslation(language)
  
  // Save to localStorage
  localStorage.setItem('dragon-ui-language', language)
  
  console.log('[i18n] Notifying subscribers of language change')
  notify()
}

// Initialize language from current store state
export const initializeLanguage = async (storeLanguage?: LanguageCode) => {
  let language = DEFAULT_LANGUAGE
  
  // Use provided store language first
  if (storeLanguage) {
    language = storeLanguage
    console.log('[i18n] Using language from store:', language)
  } else {
    // Try to get language from localStorage (Zustand persist)
    try {
      const zustandStorage = localStorage.getItem('dragon-ui-storage')
      if (zustandStorage) {
        const parsed = JSON.parse(zustandStorage)
        const savedLanguage = parsed?.state?.settings?.language
        if (savedLanguage) {
          language = savedLanguage
          console.log('[i18n] Found language in zustand storage:', language)
        }
      }
    } catch (error) {
      console.warn('[i18n] Could not read language from store:', error)
    }
  }
  
  console.log('[i18n] Initializing language:', language)
  currentLanguage = language
  currentTranslations = await loadTranslation(language)
  
  console.log('[i18n] Language initialized, translations loaded:', Object.keys(currentTranslations))
  notify()
}

// Translation hook
export const useTranslation = () => {
  const [currentState, setCurrentState] = useState({
    language: currentLanguage,
    translations: currentTranslations,
    isReady: isInitialized
  })
  
  useEffect(() => {
    // Ensure initialization happens
    if (!isInitialized) {
      initializeDefault().then(() => {
        setCurrentState({
          language: currentLanguage,
          translations: currentTranslations,
          isReady: true
        })
      })
    }
    
    const unsubscribe = subscribe(() => {
      setCurrentState({
        language: currentLanguage,
        translations: currentTranslations,
        isReady: isInitialized
      })
    })
    return unsubscribe
  }, [])
  
  const t = (key: string, fallback?: string): string => {
    // If translations aren't ready, return a loading placeholder or the key
    if (!currentState.isReady || !currentState.translations || Object.keys(currentState.translations).length === 0) {
      return fallback || key
    }
    
    const value = getNestedValue(currentState.translations, key)
    if (value === key) {
      console.warn('[i18n] Missing translation for key:', key, 'in language:', currentState.language)
      return fallback || key
    }
    return value
  }
  
  return {
    t,
    language: currentState.language,
    changeLanguage
  }
}

// Get current language
export const getCurrentLanguage = () => currentLanguage

// Export for external use
export { DEFAULT_LANGUAGE, type LanguageCode }