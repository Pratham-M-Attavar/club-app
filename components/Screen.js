import { View, ScrollView, RefreshControl } from 'react-native'
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
  const c = colors

  const padding = {
    paddingTop: edges.includes('top') ? insets.top + spacing.sm : 0,
    paddingBottom: edges.includes('bottom') ? insets.bottom + spacing.lg : spacing.lg,
    paddingHorizontal: spacing.xl,
  }

  if (!scroll) {
    return (
      <View style={[{ flex: 1, backgroundColor: c.bg }, padding, style]}>
        {children}
      </View>
    )
  }

  return (
    <ScrollView
      style={[{ flex: 1, backgroundColor: c.bg }, style]}
      contentContainerStyle={[padding, contentStyle]}
      refreshControl={
        onRefresh ? (
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.accent} />
        ) : undefined
      }
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  )
}
