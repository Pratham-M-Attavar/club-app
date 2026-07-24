import { View, Text, StyleSheet } from 'react-native'
import { colors, spacing, type } from '../../lib/theme'
import Button from './Button'

export default function EmptyState({ title, subtitle, actionLabel, onAction }) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      {actionLabel ? (
        <Button label={actionLabel} onPress={onAction} variant="outline" style={{ marginTop: spacing.md }} />
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { paddingVertical: spacing.lg, alignItems: 'flex-start' },
  title: { ...type.body, fontWeight: '600', color: colors.ink },
  subtitle: { ...type.bodyMuted, marginTop: 4 },
})
