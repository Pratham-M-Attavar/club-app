import { View, Text, StyleSheet } from 'react-native'
import { colors, radius } from '../../lib/theme'

// tone: 'neutral' | 'success' | 'warning' | 'danger' | 'laterite'
export default function Badge({ label, tone = 'neutral' }) {
  const t = tones[tone] || tones.neutral
  return (
    <View style={[styles.base, { backgroundColor: t.bg }]}>
      <Text style={[styles.text, { color: t.fg }]}>{label}</Text>
    </View>
  )
}

const tones = {
  neutral: { bg: colors.paperDim, fg: colors.textMuted },
  success: { bg: colors.arecaSoft, fg: colors.areca },
  warning: { bg: '#F3E6CB', fg: colors.warning },
  danger: { bg: colors.lateriteSoft, fg: colors.danger },
  laterite: { bg: colors.lateriteSoft, fg: colors.lateriteDark },
  cove: { bg: colors.lateriteSoft, fg: colors.lateriteDark },
}

const styles = StyleSheet.create({
  base: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: radius.pill,
    alignSelf: 'flex-start',
  },
  text: { fontSize: 10.5, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
})
