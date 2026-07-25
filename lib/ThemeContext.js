import { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { buildTheme } from './theme'

const STORAGE_KEY = '@club_theme_mode'

const ThemeContext = createContext(null)

export function ThemeProvider({ children }) {
  const [isDark, setIsDark] = useState(false)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then(value => {
        if (value === 'dark') setIsDark(true)
      })
      .finally(() => setReady(true))
  }, [])

  const toggleTheme = useCallback(() => {
    setIsDark(prev => {
      const next = !prev
      AsyncStorage.setItem(STORAGE_KEY, next ? 'dark' : 'light')
      return next
    })
  }, [])

  const setDarkMode = useCallback(enabled => {
    setIsDark(enabled)
    AsyncStorage.setItem(STORAGE_KEY, enabled ? 'dark' : 'light')
  }, [])

  const theme = useMemo(() => buildTheme(isDark), [isDark])

  const value = useMemo(
    () => ({ theme, isDark, toggleTheme, setDarkMode, ready }),
    [theme, isDark, toggleTheme, setDarkMode, ready]
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}
