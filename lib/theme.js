// Club — design tokens
// Palette pulled from Mangalore itself: laterite roof tiles, areca palm groves,
// monsoon-washed paper. Not a generic "cream + clay" AI default — these are
// specific, slightly muted, and warmer/rustier than the usual terracotta accent.

export const colors = {
  // Ink — deep coastal green-black, used for dark surfaces + primary text
  ink: '#13231F',
  inkSoft: '#28403A',
  inkFaint: '#3E5A52',

  // Paper — warm, slightly aged rice-paper cream (background)
  paper: '#F7F2E8',
  paperDim: '#EFE7D6',

  // Laterite — the rust-red of Mangalore tiled roofs. Kept for badges/highlights,
  // no longer the primary CTA color.
  laterite: '#AE4A2C',
  lateriteDark: '#8A3A22',
  lateriteSoft: '#F1DCD3', // laterite tint for badges/chips

  // Cove — deep Arabian Sea blue, seen off the Panambur/Someshwar coastline.
  // Primary accent / CTA color.
  cove: '#245A73',
  coveDark: '#1B4457',
  coveSoft: '#DCE7EA', // cove tint for badges/chips

  // Areca — palm-grove green. Secondary accent, success states.
  areca: '#3F6E58',
  arecaSoft: '#DCE9E1',

  // Neutrals
  border: '#E3D9C2',
  textMuted: '#7A7267',
  textFaint: '#A39C8E',
  white: '#FFFFFF',

  // Status
  danger: '#A6402A',
  warning: '#B1802F',
  success: '#3F6E58',
}

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
  sm: 8,
  md: 12,
  lg: 16,
  xl: 22,
  pill: 999,
}

// Type scale — one weight-driven hierarchy, no font-family juggling required.
// (If you later add expo-font + a serif display face like Fraunces or Lora for
// the greeting/headline, that's the single highest-leverage upgrade beyond this.)
export const type = {
  display: { fontSize: 26, fontWeight: '700', color: colors.ink, letterSpacing: -0.3 },
  h1: { fontSize: 20, fontWeight: '700', color: colors.ink },
  h2: { fontSize: 15, fontWeight: '700', color: colors.ink },
  eyebrow: { fontSize: 11, fontWeight: '700', color: colors.textMuted, letterSpacing: 0.8, textTransform: 'uppercase' },
  body: { fontSize: 14, fontWeight: '400', color: colors.ink },
  bodyMuted: { fontSize: 13, fontWeight: '400', color: colors.textMuted },
  caption: { fontSize: 11.5, fontWeight: '500', color: colors.textFaint },
}

export const shadow = {
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
}

// Vendor categories for the Services screen. `icon` is an Ionicons name
// (from @expo/vector-icons, bundled with Expo — no install needed).
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

// Maps a notice's category to a Badge tone, so Maintenance/Event/Security
// each get a distinct, consistent color on Home.
export const NOTICE_CATEGORY_TONES = {
  general: 'neutral',
  maintenance: 'cove',
  event: 'success',
  security: 'danger',
}

