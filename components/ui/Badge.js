import { View, Text, StyleSheet } from 'react-native'
import { useTheme } from '../../lib/ThemeContext'
import { radius } from '../../lib/theme'

export default function Badge({ label, tone = 'neutral' }) {
  const { theme } = useTheme()
  const c = theme.colors

  const tones = {
    neutral: { bg: c.surfaceMuted, fg: c.textSecondary },
    success: { bg: c.successBg, fg: c.success },
    warning: { bg: c.warningBg, fg: c.warning },
    danger: { bg: c.dangerBg, fg: c.danger },
    accent: { bg: c.accentSoft, fg: c.accent },
    cove: { bg: c.accentSoft, fg: c.accent },
    laterite: { bg: c.accentSoft, fg: c.accent },
  }
  const t = tones[tone] || tones.neutral

  return (
    <View style={[styles.base, { backgroundColor: t.bg }]}>
      <Text style={[styles.text, { color: t.fg }]}>{label}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  base: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: radius.pill,
    alignSelf: 'flex-start',
  },
  text: { fontSize: 11, fontWeight: '600', textTransform: 'capitalize', letterSpacing: 0.2 },
})
