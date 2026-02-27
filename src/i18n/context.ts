import { createContext } from 'react'
import type { Locale, TranslationKey } from './translations'

export interface LanguageContextValue {
  locale: Locale
  setLocale: (locale: Locale) => void
  t: (key: TranslationKey, params?: Record<string, string | number>) => string
}

export const LanguageContext = createContext<LanguageContextValue | null>(null)
