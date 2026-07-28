// Static design tokens + premium dark blurple palette matching PDF design system

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

export const colors = {
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

  // Legacy aliases for backward compatibility
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

function buildShadow() {
  return {
    card: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.35,
      shadowRadius: 12,
      elevation: 4,
    },
    sm: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.2,
      shadowRadius: 4,
      elevation: 2,
    },
  }
}

export const type = buildType(colors)
export const shadow = buildShadow()
export const typography = type
