import { View, StyleSheet } from 'react-native'
import { colors, spacing, radius, shadow } from '../../lib/theme'

// Signature detail: a thin laterite-colored cap along the top edge, echoing
// the ridge line of a tiled roof. Used sparingly — only on "featured" cards
// (dues, the one thing on Home that matters most) so it doesn't become wallpaper.
export default function Card({ children, style, featured = false, dark = false }) {
  return (
    <View style={[styles.base, dark ? styles.dark : styles.light, style]}>
      {featured && <View style={styles.accentCap} />}
      <View style={dark ? styles.innerDark : styles.innerLight}>{children}</View>
    </View>
  )
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.lg,
    marginBottom: spacing.lg,
    overflow: 'hidden',
    ...shadow.card,
  },
  light: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border },
  dark: { backgroundColor: colors.ink },
  accentCap: { height: 4, backgroundColor: colors.laterite },
  innerLight: { padding: spacing.lg },
  innerDark: { padding: spacing.xl },
})
