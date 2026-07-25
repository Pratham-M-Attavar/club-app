// Static design tokens + theme palettes (light / dark)

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
  { key: 'plumbing', label: 'Plumber', icon: 'water-outline' },
  { key: 'electrical', label: 'Electrician', icon: 'flash-outline' },
  { key: 'ac_repair', label: 'AC Repair', icon: 'snow-outline' },
  { key: 'pest_control', label: 'Pest Control', icon: 'bug-outline' },
  { key: 'cleaning', label: 'Cleaning', icon: 'sparkles-outline' },
  { key: 'carpentry', label: 'Carpenter', icon: 'hammer-outline' },
  { key: 'painting', label: 'Painting', icon: 'color-palette-outline' },
  { key: 'packers_movers', label: 'Packers & Movers', icon: 'cube-outline' },
  { key: 'water_tanker', label: 'Water Tanker', icon: 'car-outline' },
  { key: 'other', label: 'Other', icon: 'ellipsis-horizontal-outline' },
]

export const NOTICE_CATEGORY_TONES = {
  general: 'neutral',
  maintenance: 'accent',
  event: 'success',
  security: 'danger',
}

const lightColors = {
  bg: '#F7F7F7',
  surface: '#FFFFFF',
  surfaceElevated: '#FFFFFF',
  surfaceMuted: '#F0F0F0',
  text: '#222222',
  textSecondary: '#717171',
  textTertiary: '#B0B0B0',
  border: '#EBEBEB',
  borderStrong: '#DDDDDD',
  accent: '#FF385C',
  accentSoft: '#FFF0F3',
  accentPressed: '#E0315A',
  success: '#008A05',
  successBg: '#E8F5E9',
  warning: '#C27803',
  warningBg: '#FFF8E6',
  danger: '#C13515',
  dangerBg: '#FFF0ED',
  tabBar: '#FFFFFF',
  tabBarBorder: '#EBEBEB',
  tabActive: '#222222',
  tabInactive: '#717171',
  inputBg: '#FFFFFF',
  placeholder: '#B0B0B0',
  overlay: 'rgba(0,0,0,0.45)',
  hero: '#222222',
  heroText: '#FFFFFF',
  heroMuted: 'rgba(255,255,255,0.72)',
  chip: '#F7F7F7',
  chipActive: '#222222',
  chipText: '#222222',
  chipTextActive: '#FFFFFF',
  skeleton: '#EBEBEB',
  skeletonHighlight: '#F5F5F5',
  // legacy aliases used across screens
  ink: '#222222',
  inkSoft: '#484848',
  inkFaint: '#717171',
  paper: '#F7F7F7',
  paperDim: '#F0F0F0',
  white: '#FFFFFF',
  cove: '#222222',
  coveDark: '#000000',
  coveSoft: '#F0F0F0',
  laterite: '#FF385C',
  lateriteDark: '#E0315A',
  lateriteSoft: '#FFF0F3',
  areca: '#008A05',
  arecaSoft: '#E8F5E9',
  textMuted: '#717171',
  textFaint: '#B0B0B0',
  borderLegacy: '#EBEBEB',
}

const darkColors = {
  bg: '#0F0F0F',
  surface: '#1A1A1A',
  surfaceElevated: '#242424',
  surfaceMuted: '#2A2A2A',
  text: '#F5F5F5',
  textSecondary: '#A3A3A3',
  textTertiary: '#6B6B6B',
  border: '#2E2E2E',
  borderStrong: '#3A3A3A',
  accent: '#FF385C',
  accentSoft: '#3D1A24',
  accentPressed: '#FF5A75',
  success: '#4ADE80',
  successBg: '#1A2E1F',
  warning: '#FBBF24',
  warningBg: '#2E2618',
  danger: '#F87171',
  dangerBg: '#2E1A18',
  tabBar: '#1A1A1A',
  tabBarBorder: '#2E2E2E',
  tabActive: '#F5F5F5',
  tabInactive: '#6B6B6B',
  inputBg: '#242424',
  placeholder: '#6B6B6B',
  overlay: 'rgba(0,0,0,0.7)',
  hero: '#242424',
  heroText: '#F5F5F5',
  heroMuted: 'rgba(255,255,255,0.65)',
  chip: '#2A2A2A',
  chipActive: '#F5F5F5',
  chipText: '#F5F5F5',
  chipTextActive: '#0F0F0F',
  skeleton: '#2E2E2E',
  skeletonHighlight: '#3A3A3A',
  ink: '#F5F5F5',
  inkSoft: '#D4D4D4',
  inkFaint: '#A3A3A3',
  paper: '#0F0F0F',
  paperDim: '#1A1A1A',
  white: '#1A1A1A',
  cove: '#F5F5F5',
  coveDark: '#FFFFFF',
  coveSoft: '#2A2A2A',
  laterite: '#FF385C',
  lateriteDark: '#FF5A75',
  lateriteSoft: '#3D1A24',
  areca: '#4ADE80',
  arecaSoft: '#1A2E1F',
  textMuted: '#A3A3A3',
  textFaint: '#6B6B6B',
  borderLegacy: '#2E2E2E',
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

function buildShadow(isDark) {
  return {
    card: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: isDark ? 4 : 2 },
      shadowOpacity: isDark ? 0.35 : 0.08,
      shadowRadius: isDark ? 12 : 16,
      elevation: isDark ? 4 : 3,
    },
    sm: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: isDark ? 0.2 : 0.06,
      shadowRadius: 4,
      elevation: 2,
    },
  }
}

export function buildTheme(isDark) {
  const colors = isDark ? darkColors : lightColors
  return {
    isDark,
    colors,
    spacing,
    radius,
    type: buildType(colors),
    shadow: buildShadow(isDark),
  }
}

export const lightTheme = buildTheme(false)
export const darkTheme = buildTheme(true)

// Default export for files not yet migrated — light mode
export const colors = lightColors
export const type = lightTheme.type
export const shadow = lightTheme.shadow
export const typography = type
