import { useMemo } from 'react'
import { StyleSheet } from 'react-native'
import { colors, spacing, radius, type, shadow } from '../lib/theme'

export function useThemedStyles(factory) {
  const theme = { colors, spacing, radius, type, shadow }
  return useMemo(() => StyleSheet.create(factory(theme)), [factory])
}
