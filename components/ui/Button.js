import { TouchableOpacity, Text, StyleSheet, ActivityIndicator } from 'react-native'
import { useTheme, spacing, radius } from '../../lib/theme'

export default function Button({ label, title, onPress, variant = 'primary', disabled, loading, style, textStyle }) {
  const { colors: c } = useTheme()

  const variants = {
    primary: { bg: c.accent, text: '#FFFFFF', border: 'transparent' },
    secondary: { bg: c.text, text: c.surface, border: 'transparent' },
    outline: { bg: 'transparent', text: c.text, border: c.borderStrong },
    ghost: { bg: 'transparent', text: c.accent, border: 'transparent' },
  }
  const v = variants[variant] || variants.primary
  const displayText = label || title || ''

  return (
    <TouchableOpacity
      style={[
        styles.base,
        { backgroundColor: v.bg, borderColor: v.border, borderWidth: variant === 'outline' ? 1.5 : 0 },
        disabled && styles.disabled,
        style,
      ]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
    >
      {loading ? (
        <ActivityIndicator size="small" color={v.text} />
      ) : (
        <Text style={[styles.text, { color: v.text }, textStyle]}>{displayText}</Text>
      )}
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  base: {
    paddingVertical: 14,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    alignSelf: 'flex-start',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { fontSize: 15, fontWeight: '600', letterSpacing: -0.2 },
  disabled: { opacity: 0.45 },
})