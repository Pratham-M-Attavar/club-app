import { TouchableOpacity, Text, StyleSheet, ActivityIndicator } from 'react-native'
import { colors, spacing, radius, type } from '../../lib/theme'

// variant: 'primary' | 'secondary' | 'outline' | 'ghost'
export default function Button({ label, onPress, variant = 'primary', disabled, loading, style, textStyle }) {
  const variantStyle = styles[variant] || styles.primary
  const variantTextStyle = textStyles[variant] || textStyles.primary

  return (
    <TouchableOpacity
      style={[styles.base, variantStyle, disabled && styles.disabled, style]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.75}
    >
      {loading ? (
        <ActivityIndicator size="small" color={variant === 'primary' ? colors.white : colors.ink} />
      ) : (
        <Text style={[textStyles.base, variantTextStyle, textStyle]}>{label}</Text>
      )}
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  base: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    alignSelf: 'flex-start',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  primary: { backgroundColor: colors.laterite },
  secondary: { backgroundColor: colors.inkSoft },
  outline: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: colors.border },
  ghost: { backgroundColor: 'transparent', paddingHorizontal: spacing.sm },
  disabled: { opacity: 0.5 },
})

const textStyles = StyleSheet.create({
  base: { fontSize: 13.5, fontWeight: '700' },
  primary: { color: colors.white },
  secondary: { color: colors.white },
  outline: { color: colors.ink },
  ghost: { color: colors.laterite },
})
