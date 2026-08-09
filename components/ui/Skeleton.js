import { useEffect, useRef } from 'react'
import { View, Animated, StyleSheet } from 'react-native'
import { useTheme, spacing, radius } from '../../lib/theme'

export function SkeletonBlock({ width = '100%', height = 14, style, dark = false }) {
  const { colors: c } = useTheme()
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
  }, [opacity])

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius: radius.sm,
          backgroundColor: dark ? c.heroMuted : c.skeleton,
          opacity,
        },
        style,
      ]}
    />
  )
}

export function DuesCardSkeleton() {
  const { colors: c } = useTheme()

  return (
    <View style={[styles.duesSkeleton, { backgroundColor: c.hero, borderRadius: radius.lg }]}>
      <SkeletonBlock width={110} height={10} dark style={{ marginBottom: 10 }} />
      <SkeletonBlock width={140} height={28} dark style={{ marginBottom: 14 }} />
      <SkeletonBlock width={100} height={36} dark style={{ borderRadius: radius.md }} />
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
  duesSkeleton: { padding: spacing.lg, marginBottom: spacing.lg },
})