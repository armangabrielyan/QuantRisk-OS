import React, { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { en } from './en'
import { ru } from './ru'
import type { Translations } from './en'

export type Lang = 'en' | 'ru'

const TRANSLATIONS: Record<Lang, Translations> = { en, ru }
const STORAGE_KEY = 'quantrisk_lang'

interface I18nContextType {
  lang: Lang
  t: Translations
  setLang: (lang: Lang) => void
  toggleLang: () => void
}

const I18nContext = createContext<I18nContextType>({
  lang: 'en',
  t: en,
  setLang: () => {},
  toggleLang: () => {},
})

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored === 'en' || stored === 'ru') return stored
    } catch {}
    return 'en'
  })

  const setLang = useCallback((newLang: Lang) => {
    setLangState(newLang)
    try { localStorage.setItem(STORAGE_KEY, newLang) } catch {}
  }, [])

  const toggleLang = useCallback(() => {
    setLang(lang === 'en' ? 'ru' : 'en')
  }, [lang, setLang])

  const t = TRANSLATIONS[lang]

  return (
    <I18nContext.Provider value={{ lang, t, setLang, toggleLang }}>
      {children}
    </I18nContext.Provider>
  )
}

export function useI18n() {
  return useContext(I18nContext)
}

// Convenience export for direct import
export { en, ru }
export type { Translations }
