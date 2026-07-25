import { useEffect, useState } from 'react'
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { colors, spacing, radius } from '../lib/theme'

const STATUS_COLORS = {
  requested: { bg: '#7F1D1D', text: '#FECACA' },
  confirmed: { bg: '#78350F', text: '#FDE68A' },
  in_progress: { bg: '#78350F', text: '#FDE68A' },
  completed: { bg: '#14532D', text: '#BBF7D0' },
  cancelled: { bg: '#334155', text: '#CBD5E1' },
}

export default function VendorBookingsScreen() {
  const { profile } = useAuth()
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!profile) return
    supabase
      .from('vendor_bookings')
      .select('*, vendors(name, category)')
      .eq('building_id', profile.building_id)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setBookings(data || [])
        setLoading(false)
      })
  }, [profile])

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.accent} />
        <Text style={styles.muted}>Loading bookings…</Text>
      </View>
    )
  }

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.contentContainer}>
      <Text style={styles.title}>Vendor bookings</Text>
      <Text style={styles.sub}>Read-only — tracking status, updated by the vendor coordinator.</Text>

      {bookings.length === 0 && <Text style={styles.muted}>No bookings yet.</Text>}

      {bookings.map(b => {
        const chipColors = STATUS_COLORS[b.status] || STATUS_COLORS.requested
        return (
          <View key={b.id} style={styles.card}>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>{b.vendors?.name} — Flat {b.flat_number}</Text>
              <Text style={styles.cardMeta}>
                {b.vendors?.category?.replace('_', ' ')} · Requested {new Date(b.created_at).toLocaleDateString()}
              </Text>
            </View>
            <View style={[styles.statusChip, { backgroundColor: chipColors.bg }]}>
              <Text style={[styles.statusText, { color: chipColors.text }]}>{b.status.replace('_', ' ')}</Text>
            </View>
          </View>
        )
      })}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.bg },
  contentContainer: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: spacing.xxl },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  muted: { fontSize: 12, color: colors.textSecondary, marginTop: 8 },
  title: { fontSize: 20, fontWeight: '700', color: colors.text },
  sub: { fontSize: 12.5, color: colors.textSecondary, marginTop: 4, marginBottom: 16 },

  card: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: 14, marginBottom: 10,
  },
  cardTitle: { fontWeight: '700', fontSize: 13.5, color: colors.text },
  cardMeta: { fontSize: 11.5, color: colors.textTertiary, marginTop: 2 },

  statusChip: { paddingVertical: 3, paddingHorizontal: 10, borderRadius: radius.pill, marginLeft: 8 },
  statusText: { fontSize: 11, fontWeight: '700' },
})
