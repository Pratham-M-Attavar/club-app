// Design tokens + light/dark theme system
// Light is now the default. The old dark blurple palette lives under `dark`.

import React, { createContext, useContext, useState, useMemo, useEffect } from 'react'
import { useColorScheme } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'

const THEME_STORAGE_KEY = 'club-app:theme-mode'

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
  xxxl: 36,
}

export const radius = {
  sm: 10,
  md: 14,
  lg: 18,
  xl: 24,
  pill: 999,
}

export const VENDOR_CATEGORIES = [
  { key: 'cleaning', label: 'Cleaning', icon: 'sparkles-outline' },
  { key: 'electrical', label: 'Electrical', icon: 'flash-outline' },
  { key: 'plumbing', label: 'Plumbing', icon: 'water-outline' },
  { key: 'parking', label: 'Parking', icon: 'car-outline' },
  { key: 'courier', label: 'Courier', icon: 'cube-outline' },
  { key: 'internet', label: 'Internet', icon: 'wifi-outline' },
  { key: 'security', label: 'Security', icon: 'shield-checkmark-outline' },
  { key: 'housekeeping', label: 'Housekeeping', icon: 'home-outline' },
  { key: 'moving', label: 'Moving', icon: 'navigate-outline' },
  { key: 'other', label: 'Other', icon: 'ellipsis-horizontal-outline' },
]

export const NOTICE_CATEGORY_TONES = {
  general: 'neutral',
  maintenance: 'accent',
  event: 'success',
  security: 'danger',
}

// ---------- LIGHT (default) ----------
const lightColors = {
  bg: '#FFFFFF',
  surface: '#F7F7FA',
  surfaceElevated: '#FFFFFF',
  surfaceMuted: '#F2F2F6',

  text: '#0B0C10',
  textSecondary: '#5B6072',
  textTertiary: '#8A8F9E',

  border: '#E5E6EC',
  borderStrong: '#D3D5E0',

  accent: '#6366F1',
  accentSoft: 'rgba(99, 102, 241, 0.10)',
  accentPressed: '#4F46E5',

  success: '#10B981',
  successBg: 'rgba(16, 185, 129, 0.10)',

  warning: '#F59E0B',
  warningBg: 'rgba(245, 158, 11, 0.10)',

  danger: '#EF4444',
  dangerBg: 'rgba(239, 68, 68, 0.10)',

  tabBar: '#FFFFFF',
  tabBarBorder: '#E5E6EC',
  tabActive: '#6366F1',
  tabInactive: '#9CA0AE',

  inputBg: '#F2F2F6',
  placeholder: '#9CA0AE',

  overlay: 'rgba(0,0,0,0.45)',

  hero: '#6366F1',
  heroText: '#FFFFFF',
  heroMuted: 'rgba(255,255,255,0.78)',

  chip: '#F2F2F6',
  chipActive: '#6366F1',
  chipText: '#5B6072',
  chipTextActive: '#FFFFFF',

  skeleton: '#EDEEF3',
  skeletonHighlight: '#F7F7FA',

  // Legacy aliases for backward compatibility
  ink: '#0B0C10',
  inkSoft: '#2A2E3A',
  inkFaint: '#5B6072',

  paper: '#FFFFFF',
  paperDim: '#F7F7FA',

  white: '#FFFFFF',

  cove: '#0B0C10',
  coveDark: '#0B0C10',
  coveSoft: '#F2F2F6',

  laterite: '#6366F1',
  lateriteDark: '#4F46E5',
  lateriteSoft: 'rgba(99, 102, 241, 0.10)',

  areca: '#10B981',
  arecaSoft: 'rgba(16, 185, 129, 0.10)',

  textMuted: '#5B6072',
  textFaint: '#8A8F9E',

  borderLegacy: '#E5E6EC',
}

// ---------- DARK (previous default, unchanged) ----------
const darkColors = {
  bg: '#0B0C10',
  surface: '#161822',
  surfaceElevated: '#1F2230',
  surfaceMuted: '#12141D',

  text: '#FFFFFF',
  textSecondary: '#9CA3AF',
  textTertiary: '#6B7280',

  border: '#222536',
  borderStrong: '#2E3248',

  accent: '#6366F1',
  accentSoft: 'rgba(99, 102, 241, 0.15)',
  accentPressed: '#4F46E5',

  success: '#10B981',
  successBg: 'rgba(16, 185, 129, 0.15)',

  warning: '#F59E0B',
  warningBg: 'rgba(245, 158, 11, 0.15)',

  danger: '#EF4444',
  dangerBg: 'rgba(239, 68, 68, 0.15)',

  tabBar: '#0B0C10',
  tabBarBorder: '#1F222E',
  tabActive: '#6366F1',
  tabInactive: '#6B7280',

  inputBg: '#161822',
  placeholder: '#6B7280',

  overlay: 'rgba(0,0,0,0.75)',

  hero: '#6366F1',
  heroText: '#FFFFFF',
  heroMuted: 'rgba(255,255,255,0.72)',

  chip: '#161822',
  chipActive: '#6366F1',
  chipText: '#9CA3AF',
  chipTextActive: '#FFFFFF',

  skeleton: '#1F2230',
  skeletonHighlight: '#2E3248',

  ink: '#FFFFFF',
  inkSoft: '#E2E8F0',
  inkFaint: '#9CA3AF',

  paper: '#0B0C10',
  paperDim: '#161822',

  white: '#161822',

  cove: '#FFFFFF',
  coveDark: '#FFFFFF',
  coveSoft: '#1F2230',

  laterite: '#6366F1',
  lateriteDark: '#818CF8',
  lateriteSoft: 'rgba(99, 102, 241, 0.15)',

  areca: '#10B981',
  arecaSoft: 'rgba(16, 185, 129, 0.15)',

  textMuted: '#9CA3AF',
  textFaint: '#6B7280',

  borderLegacy: '#222536',
}

function buildType(colors) {
  return {
    display: { fontSize: 28, fontWeight: '700', color: colors.text, letterSpacing: -0.6 },
    h1: { fontSize: 22, fontWeight: '700', color: colors.text, letterSpacing: -0.3 },
    h2: { fontSize: 17, fontWeight: '600', color: colors.text, letterSpacing: -0.2 },
    eyebrow: { fontSize: 11, fontWeight: '600', color: colors.textSecondary, letterSpacing: 0.6, textTransform: 'uppercase' },
    body: { fontSize: 15, fontWeight: '400', color: colors.text, lineHeight: 22 },
    bodyMuted: { fontSize: 14, fontWeight: '400', color: colors.textSecondary, lineHeight: 20 },
    caption: { fontSize: 12, fontWeight: '500', color: colors.textTertiary },
  }
}

function buildShadow(mode) {
  const opacity = mode === 'dark' ? 0.35 : 0.08
  const smOpacity = mode === 'dark' ? 0.2 : 0.06
  return {
    card: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: opacity,
      shadowRadius: 12,
      elevation: mode === 'dark' ? 4 : 2,
    },
    sm: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: smOpacity,
      shadowRadius: 4,
      elevation: 1,
    },
  }
}

// ---------- Static exports (backward compatible — LIGHT by default) ----------
export const colors = lightColors
export const type = buildType(lightColors)
export const typography = type
export const shadow = buildShadow('light')

// ---------- Dynamic theme system ----------
const themes = {
  light: { mode: 'light', colors: lightColors, type: buildType(lightColors), shadow: buildShadow('light') },
  dark: { mode: 'dark', colors: darkColors, type: buildType(darkColors), shadow: buildShadow('dark') },
}
themes.light.typography = themes.light.type
themes.dark.typography = themes.dark.type

const ThemeContext = createContext(themes.light)

// Wrap your app root: <ThemeProvider><App /></ThemeProvider>
// Pass initialMode to force a theme before storage loads; defaults to 'light'.
export function ThemeProvider({ children, initialMode = 'light' }) {
  const [mode, setModeState] = useState(initialMode)
  const [loaded, setLoaded] = useState(false)

  // Load saved preference once on mount
  useEffect(() => {
    AsyncStorage.getItem(THEME_STORAGE_KEY)
      .then(saved => {
        if (saved === 'light' || saved === 'dark') setModeState(saved)
      })
      .catch(() => {})
      .finally(() => setLoaded(true))
  }, [])

  const setMode = (next) => {
    setModeState(next)
    AsyncStorage.setItem(THEME_STORAGE_KEY, next).catch(() => {})
  }

  const value = useMemo(() => ({
    ...themes[mode],
    loaded,
    setMode,
    toggleMode: () => setMode(mode === 'light' ? 'dark' : 'light'),
  }), [mode, loaded])

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

// In components: const { colors, type, mode, toggleMode } = useTheme()
export function useTheme() {
  return useContext(ThemeContext)
}

// If you ever want to default to the device's system setting instead of
// always starting light, swap initialMode above for:
//   const scheme = useColorScheme(); const [mode, setMode] = useState(scheme ?? 'light')