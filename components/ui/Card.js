import { View, StyleSheet } from 'react-native'
import { useTheme, spacing, radius } from '../../lib/theme'

export default function Card({ children, style, featured = false, dark = false, padded = true }) {
  const { colors: c, shadow } = useTheme()

  return (
    <View
      style={[
        styles.base,
        shadow.card,
        {
          backgroundColor: dark ? c.hero : c.surface,
          borderColor: dark ? 'transparent' : c.border,
          borderWidth: dark ? 0 : StyleSheet.hairlineWidth,
        },
        style,
      ]}
    >
      {featured && !dark && <View style={[styles.accentCap, { backgroundColor: c.accent }]} />}
      <View style={padded ? styles.inner : undefined}>{children}</View>
    </View>
  )
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.lg,
    marginBottom: spacing.lg,
    overflow: 'hidden',
  },
  accentCap: { height: 3 },
  inner: { padding: spacing.lg },
})