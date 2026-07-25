import { View, Text, StyleSheet } from 'react-native'
import { useTheme } from '../../lib/ThemeContext'
import { spacing } from '../../lib/theme'
import Button from './Button'

export default function EmptyState({ title, subtitle, actionLabel, onAction }) {
  const { theme } = useTheme()

  return (
    <View style={styles.wrap}>
      <Text style={[theme.type.body, { fontWeight: '600' }]}>{title}</Text>
      {subtitle ? <Text style={[theme.type.bodyMuted, { marginTop: 4 }]}>{subtitle}</Text> : null}
      {actionLabel ? (
        <Button label={actionLabel} onPress={onAction} variant="outline" style={{ marginTop: spacing.md }} />
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { paddingVertical: spacing.lg, alignItems: 'flex-start' },
})
