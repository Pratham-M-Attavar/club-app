import { useCallback, useEffect, useMemo, useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import Screen from '../components/Screen'
import Card from '../components/ui/Card'
import EmptyState from '../components/ui/EmptyState'
import Badge from '../components/ui/Badge'
import { useTheme, spacing } from '../lib/theme'
import { bookingStatusVariant, formatCategory, formatDateTime } from '../lib/format'

export default function MyBookingsScreen({ navigation }) {
  const { profile } = useAuth()
  const { colors, type } = useTheme()
  const styles = useMemo(() => getStyles(colors, type), [colors, type])
  const [bookings, setBookings] = useState([])
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async () => {
    if (!profile) return
    const { data } = await supabase
      .from('vendor_bookings')
      .select('*, vendors(name, category, phone_number, phone)')
      .eq('booked_by_id', profile.id)
      .order('created_at', { ascending: false })
    setBookings(data || [])
  }, [profile])

  useEffect(() => { load() }, [load])

  async function onRefresh() {
    setRefreshing(true)
    await load()
    setRefreshing(false)
  }

  return (
    <Screen refreshing={refreshing} onRefresh={onRefresh}>
      <TouchableOpacity style={styles.back} onPress={() => navigation.goBack()}>
        <Ionicons name="arrow-back" size={20} color={colors.accent} />
        <Text style={styles.backText}>Back</Text>
      </TouchableOpacity>

      <Text style={styles.title}>My bookings</Text>
      <Text style={styles.sub}>Track your service requests</Text>

      {bookings.length === 0 ? (
        <EmptyState
          title="No bookings yet"
          subtitle="Book a vendor from the Services tab to get started."
        />
      ) : (
        bookings.map(b => (
          <Card key={b.id}>
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.vendorName}>{b.vendors?.name || 'Vendor'}</Text>
                <Text style={styles.meta}>
                  {formatCategory(b.vendors?.category)} · Flat {b.flat_no}
                </Text>
                <Text style={styles.meta}>Slot: {formatDateTime(b.slot_time)}</Text>
                <Text style={styles.meta}>Requested {formatDateTime(b.created_at)}</Text>
              </View>
              <Badge
                label={b.status?.replace('_', ' ')}
                tone={bookingStatusVariant(b.status) === 'success' ? 'success' : bookingStatusVariant(b.status) === 'warning' ? 'warning' : 'neutral'}
              />
            </View>
          </Card>
        ))
      )}
    </Screen>
  )
}

function getStyles(colors, type) {
  return StyleSheet.create({
  back: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: spacing.md },
  backText: { fontSize: 14, fontWeight: '600', color: colors.accent },
  title: { ...type.h1, color: colors.accent },
  sub: { ...type.caption, marginBottom: spacing.lg },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  vendorName: { fontSize: 15, fontWeight: '700', color: colors.text },
  meta: { fontSize: 12, color: colors.textMuted, marginTop: 3 },
  })
}