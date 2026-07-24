import { useEffect, useRef } from 'react'
import { View, Animated, StyleSheet } from 'react-native'
import { colors, radius } from '../../lib/theme'

// Single shimmering block. Compose a few of these to build skeleton screens
// (e.g. a tall one for the dues amount, a few short ones for list rows).
export function SkeletonBlock({ width = '100%', height = 14, style }) {
  const opacity = useRef(new Animated.Value(0.4)).current

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 650, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 650, useNativeDriver: true }),
      ])
    )
    loop.start()
    return () => loop.stop()
  }, [])

  return (
    <Animated.View
      style={[{ width, height, borderRadius: radius.sm, backgroundColor: colors.paperDim, opacity }, style]}
    />
  )
}

// Pre-built skeleton for the Home dues card, so loading looks like the real
// content is about to appear rather than a blank spinner.
export function DuesCardSkeleton() {
  return (
    <View style={styles.duesSkeleton}>
      <SkeletonBlock width={110} height={10} style={{ marginBottom: 10, backgroundColor: colors.inkFaint }} />
      <SkeletonBlock width={140} height={28} style={{ marginBottom: 14, backgroundColor: colors.inkFaint }} />
      <SkeletonBlock width={100} height={34} style={{ backgroundColor: colors.inkFaint, borderRadius: radius.md }} />
    </View>
  )
}

export function RowSkeleton() {
  return (
    <View style={{ paddingVertical: 10 }}>
      <SkeletonBlock width="70%" height={13} style={{ marginBottom: 6 }} />
      <SkeletonBlock width="40%" height={11} />
    </View>
  )
}

const styles = StyleSheet.create({
  duesSkeleton: { backgroundColor: colors.ink, borderRadius: radius.lg, padding: 18 },
})
