import { View, ScrollView, RefreshControl, StyleSheet } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { colors, spacing } from '../lib/theme'

export default function Screen({
  children,
  scroll = true,
  refreshing = false,
  onRefresh,
  style,
  contentStyle,
  edges = ['top'],
}) {
  const insets = useSafeAreaInsets()

  const padding = {
    paddingTop: edges.includes('top') ? insets.top + spacing.xxl : 0,
    paddingBottom: edges.includes('bottom') ? insets.bottom + spacing.lg : spacing.lg,
    paddingHorizontal: spacing.xl,
  }

  if (!scroll) {
    return (
      <View style={[styles.root, padding, style]}>
        {children}
      </View>
    )
  }

  return (
    <ScrollView
      style={[styles.root, style]}
      contentContainerStyle={[padding, contentStyle]}
      refreshControl={
        onRefresh ? (
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        ) : undefined
      }
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
})
