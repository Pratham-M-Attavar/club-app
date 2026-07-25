import { View, Text, StyleSheet } from 'react-native'

import Button from './Button'
import {
    colors,
    spacing,
    radius,
    type,
    shadow
} from '../../lib/theme'
export default function EmptyState({ title, subtitle, actionLabel, onAction }) {
  

  return (
    <View style={styles.wrap}>
      <Text style={[type.body, { fontWeight: '600' }]}>{title}</Text>
      {subtitle ? <Text style={[type.bodyMuted, { marginTop: 4 }]}>{subtitle}</Text> : null}
      {actionLabel ? (
        <Button label={actionLabel} onPress={onAction} variant="outline" style={{ marginTop: spacing.md }} />
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { paddingVertical: spacing.lg, alignItems: 'flex-start' },
})
