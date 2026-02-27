import { useState, useCallback, useMemo } from 'react'
import type { ReactNode } from 'react'
import type { Locale, TranslationKey } from './translations'
import { translations } from './translations'
import { LanguageContext } from './context'

function detectLocale(): Locale {
  const saved = localStorage.getItem('localpdf-lang')
  if (saved === 'fr' || saved === 'en' || saved === 'es') return saved

  const browserLang = navigator.language.slice(0, 2)
  if (browserLang === 'fr') return 'fr'
  if (browserLang === 'es') return 'es'
  return 'en'
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(detectLocale)

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l)
    localStorage.setItem('localpdf-lang', l)
  }, [])

  const t = useCallback(
    (key: TranslationKey, params?: Record<string, string | number>): string => {
      let text = translations[locale][key] ?? translations.en[key] ?? key
      if (params) {
        for (const [k, v] of Object.entries(params)) {
          text = text.replace(`{${k}}`, String(v))
        }
      }
      return text
    },
    [locale],
  )

  const value = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t])

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}
