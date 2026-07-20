import { useEffect, useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator } from 'react-native'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'

const STATUS_OPTIONS = ['pending', 'assigned', 'in_progress', 'done']

const STATUS_COLORS = {
  pending: { bg: '#f3ddd5', text: '#b5533c' },
  assigned: { bg: '#e8d9b8', text: '#8a641e' },
  in_progress: { bg: '#e8d9b8', text: '#8a641e' },
  done: { bg: '#dfe9e6', text: '#3a6b63' },
}

export default function TicketsScreen() {
  const { profile } = useAuth()
  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('open')

  async function loadTickets() {
    setLoading(true)
    const { data } = await supabase
      .from('tickets')
      .select('*')
      .eq('building_id', profile.building_id)
      .order('created_at', { ascending: false })
    setTickets(data || [])
    setLoading(false)
  }

  useEffect(() => {
    if (profile) loadTickets()
  }, [profile])

  async function updateStatus(ticket, newStatus) {
    await supabase
      .from('tickets')
      .update({ status: newStatus, resolved_at: newStatus === 'done' ? new Date().toISOString() : null })
      .eq('id', ticket.id)
    loadTickets()
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator />
        <Text style={styles.muted}>Loading tickets…</Text>
      </View>
    )
  }

  const visible = filter === 'open' ? tickets.filter(t => t.status !== 'done') : tickets

  return (
    <ScrollView style={styles.page} contentContainerStyle={{ padding: 20 }}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Tickets</Text>
        <View style={styles.filterRow}>
          <TouchableOpacity
            style={filter === 'open' ? styles.filterBtnActive : styles.filterBtn}
            onPress={() => setFilter('open')}
          >
            <Text style={filter === 'open' ? styles.filterBtnTextActive : styles.filterBtnText}>Open</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={filter === 'all' ? styles.filterBtnActive : styles.filterBtn}
            onPress={() => setFilter('all')}
          >
            <Text style={filter === 'all' ? styles.filterBtnTextActive : styles.filterBtnText}>All</Text>
          </TouchableOpacity>
        </View>
      </View>

      {visible.length === 0 && <Text style={styles.muted}>Nothing here — nice and quiet.</Text>}

      {visible.map(t => {
        const colors = STATUS_COLORS[t.status] || STATUS_COLORS.pending
        return (
          <View key={t.id} style={styles.card}>
            <Text style={styles.cardTitle}>
              {t.category.charAt(0).toUpperCase() + t.category.slice(1)} — Flat {t.flat_number}
            </Text>
            {t.description ? <Text style={styles.cardDesc}>{t.description}</Text> : null}
            <Text style={styles.cardMeta}>
              Raised {new Date(t.created_at).toLocaleDateString()}
              {t.resolved_at ? ` · Resolved ${new Date(t.resolved_at).toLocaleDateString()}` : ''}
            </Text>

            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 }}>
              <View style={[styles.statusChip, { backgroundColor: colors.bg }]}>
                <Text style={[styles.statusText, { color: colors.text }]}>{t.status.replace('_', ' ')}</Text>
              </View>

              <View style={styles.statusOptionsRow}>
                {STATUS_OPTIONS.map(s => (
                  <TouchableOpacity
                    key={s}
                    style={t.status === s ? styles.statusOptionActive : styles.statusOption}
                    onPress={() => updateStatus(t, s)}
                  >
                    <Text style={t.status === s ? styles.statusOptionTextActive : styles.statusOptionText}>
                      {s.replace('_', ' ')}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
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

  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  title: { fontSize: 20, fontWeight: '700', color: '#14262a' },
  filterRow: { flexDirection: 'row', gap: 6 },
  filterBtn: { borderWidth: 1, borderColor: '#e4ddd0', borderRadius: 8, paddingVertical: 6, paddingHorizontal: 12 },
  filterBtnActive: { backgroundColor: '#14262a', borderRadius: 8, paddingVertical: 6, paddingHorizontal: 12 },
  filterBtnText: { fontSize: 12, color: '#1d2b2a', fontWeight: '600' },
  filterBtnTextActive: { fontSize: 12, color: '#fff', fontWeight: '600' },

  card: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e4ddd0', borderRadius: 12, padding: 14, marginBottom: 10 },
  cardTitle: { fontWeight: '700', fontSize: 13.5, color: '#1d2b2a' },
  cardDesc: { fontSize: 12.5, color: '#4a5654', marginTop: 4 },
  cardMeta: { fontSize: 11, color: '#6b7674', marginTop: 6 },

  statusChip: { paddingVertical: 3, paddingHorizontal: 10, borderRadius: 20 },
  statusText: { fontSize: 11, fontWeight: '700' },

  statusOptionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, flex: 1, justifyContent: 'flex-end' },
  statusOption: { borderWidth: 1, borderColor: '#e4ddd0', borderRadius: 6, paddingVertical: 4, paddingHorizontal: 8 },
  statusOptionActive: { backgroundColor: '#14262a', borderRadius: 6, paddingVertical: 4, paddingHorizontal: 8 },
  statusOptionText: { fontSize: 10.5, color: '#1d2b2a' },
  statusOptionTextActive: { fontSize: 10.5, color: '#fff' },
})
