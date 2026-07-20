import { useEffect, useState } from 'react'
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'

const STATUS_COLORS = {
  requested: { bg: '#f3ddd5', text: '#b5533c' },
  confirmed: { bg: '#e8d9b8', text: '#8a641e' },
  in_progress: { bg: '#e8d9b8', text: '#8a641e' },
  completed: { bg: '#dfe9e6', text: '#3a6b63' },
  cancelled: { bg: '#e4ddd0', text: '#6b7674' },
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
        <ActivityIndicator />
        <Text style={styles.muted}>Loading bookings…</Text>
      </View>
    )
  }

  return (
    <ScrollView style={styles.page} contentContainerStyle={{ padding: 20 }}>
      <Text style={styles.title}>Vendor bookings</Text>
      <Text style={styles.sub}>Read-only — tracking status, updated by the vendor coordinator.</Text>

      {bookings.length === 0 && <Text style={styles.muted}>No bookings yet.</Text>}

      {bookings.map(b => {
        const colors = STATUS_COLORS[b.status] || STATUS_COLORS.requested
        return (
          <View key={b.id} style={styles.card}>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>{b.vendors?.name} — Flat {b.flat_number}</Text>
              <Text style={styles.cardMeta}>
                {b.vendors?.category?.replace('_', ' ')} · Requested {new Date(b.created_at).toLocaleDateString()}
              </Text>
            </View>
            <View style={[styles.statusChip, { backgroundColor: colors.bg }]}>
              <Text style={[styles.statusText, { color: colors.text }]}>{b.status.replace('_', ' ')}</Text>
            </View>
          </View>
        )
      })}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#f4f1ea' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f4f1ea' },
  muted: { fontSize: 12, color: '#6b7674', marginTop: 8 },
  title: { fontSize: 20, fontWeight: '700', color: '#14262a' },
  sub: { fontSize: 12.5, color: '#6b7674', marginTop: 4, marginBottom: 16 },

  card: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#fff', borderWidth: 1, borderColor: '#e4ddd0', borderRadius: 12, padding: 14, marginBottom: 10,
  },
  cardTitle: { fontWeight: '700', fontSize: 13.5, color: '#1d2b2a' },
  cardMeta: { fontSize: 11.5, color: '#6b7674', marginTop: 2 },

  statusChip: { paddingVertical: 3, paddingHorizontal: 10, borderRadius: 20, marginLeft: 8 },
  statusText: { fontSize: 11, fontWeight: '700' },
})
