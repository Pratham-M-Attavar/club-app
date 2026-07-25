// Static design tokens + permanent dark palette

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



export const colors = {
  bg: '#0F172A',
  surface: '#1E293B',
  surfaceElevated: '#334155',
  surfaceMuted: '#273449',

  text: '#F8FAFC',
  textSecondary: '#CBD5E1',
  textTertiary: '#94A3B8',

  border: '#334155',
  borderStrong: '#475569',

  accent: '#5B7CFA',
  accentSoft: '#233B63',
  accentPressed: '#7C9DFF',

  success: '#4ADE80',
  successBg: '#14532D',

  warning: '#FBBF24',
  warningBg: '#78350F',

  danger: '#F87171',
  dangerBg: '#7F1D1D',

  tabBar: '#1E293B',
  tabBarBorder: '#334155',
  tabActive: '#7C9DFF',
  tabInactive: '#94A3B8',

  inputBg: '#273449',
  placeholder: '#64748B',

  overlay: 'rgba(0,0,0,0.70)',

  hero: '#4B63C4',
  heroText: '#FFFFFF',
  heroMuted: 'rgba(255,255,255,0.72)',

  chip: '#273449',
  chipActive: '#3B82F6',
  chipText: '#F8FAFC',
  chipTextActive: '#FFFFFF',

  skeleton: '#334155',
  skeletonHighlight: '#475569',

  // Legacy aliases
  ink: '#F8FAFC',
  inkSoft: '#E2E8F0',
  inkFaint: '#CBD5E1',

  paper: '#0F172A',
  paperDim: '#1E293B',

  white: '#1E293B',

  cove: '#F8FAFC',
  coveDark: '#FFFFFF',
  coveSoft: '#334155',

  laterite: '#3B82F6',
  lateriteDark: '#60A5FA',
  lateriteSoft: '#1E3A8A',

  areca: '#4ADE80',
  arecaSoft: '#14532D',

  textMuted: '#CBD5E1',
  textFaint: '#94A3B8',

  borderLegacy: '#334155',
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
