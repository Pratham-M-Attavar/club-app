import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native'
import { colors, radius, spacing, typography } from '../lib/theme'

export function Card({ children, style }) {
  return <View style={[styles.card, style]}>{children}</View>
}

export function SectionTitle({ children, action, onAction }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={typography.label}>{children}</Text>
      {action ? (
        <TouchableOpacity onPress={onAction}>
          <Text style={styles.sectionAction}>{action}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  )
}

export function Chip({ label, active, onPress, color }) {
  return (
    <TouchableOpacity
      style={[
        styles.chip,
        active && styles.chipActive,
        color && !active && { borderColor: color, backgroundColor: `${color}15` },
      ]}
      onPress={onPress}
      disabled={!onPress}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </TouchableOpacity>
  )
}

export function PrimaryButton({ title, onPress, disabled, loading, style }) {
  return (
    <TouchableOpacity
      style={[styles.primaryBtn, disabled && styles.btnDisabled, style]}
      onPress={onPress}
      disabled={disabled || loading}
    >
      {loading ? (
        <ActivityIndicator color="#fff" size="small" />
      ) : (
        <Text style={styles.primaryBtnText}>{title}</Text>
      )}
    </TouchableOpacity>
  )
}

export function OutlineButton({ title, onPress, style }) {
  return (
    <TouchableOpacity style={[styles.outlineBtn, style]} onPress={onPress}>
      <Text style={styles.outlineBtnText}>{title}</Text>
    </TouchableOpacity>
  )
}

export function EmptyState({ title, subtitle }) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyTitle}>{title}</Text>
      {subtitle ? <Text style={styles.emptySub}>{subtitle}</Text> : null}
    </View>
  )
}

export function StatusBadge({ label, variant = 'default' }) {
  const palette = {
    default: { bg: colors.border, text: colors.textMuted },
    success: { bg: colors.successBg, text: colors.success },
    warning: { bg: colors.warningBg, text: colors.warning },
    danger: { bg: colors.dangerBg, text: colors.danger },
  }[variant] || { bg: colors.border, text: colors.textMuted }

  return (
    <View style={[styles.badge, { backgroundColor: palette.bg }]}>
      <Text style={[styles.badgeText, { color: palette.text }]}>{label}</Text>
    </View>
  )
}

export function StarRating({ rating, size = 12 }) {
  const stars = Math.round(Number(rating) || 0)
  return (
    <Text style={{ fontSize: size, color: colors.accent }}>
      {'★'.repeat(Math.min(stars, 5))}{'☆'.repeat(Math.max(0, 5 - stars))}
    </Text>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  sectionAction: { fontSize: 12, fontWeight: '600', color: colors.accent },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: colors.surface,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 12, color: colors.text, fontWeight: '500' },
  chipTextActive: { color: '#fff' },
  primaryBtn: {
    backgroundColor: colors.primary,
    paddingVertical: 13,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.sm,
    alignItems: 'center',
  },
  primaryBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  btnDisabled: { opacity: 0.5 },
  outlineBtn: {
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: radius.sm,
    alignSelf: 'flex-start',
  },
  outlineBtnText: { fontSize: 13, fontWeight: '600', color: colors.text },
  empty: { paddingVertical: spacing.xxl, alignItems: 'center' },
  emptyTitle: { fontSize: 14, fontWeight: '600', color: colors.textMuted },
  emptySub: { fontSize: 12, color: colors.textMuted, marginTop: 4, textAlign: 'center' },
  badge: { paddingVertical: 3, paddingHorizontal: 10, borderRadius: radius.pill, alignSelf: 'flex-start' },
  badgeText: { fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },
})
