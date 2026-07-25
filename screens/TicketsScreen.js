import { useEffect, useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator } from 'react-native'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { colors, spacing, radius } from '../lib/theme'

const STATUS_OPTIONS = ['pending', 'assigned', 'in_progress', 'done']

const STATUS_COLORS = {
  pending: { bg: '#7F1D1D', text: '#FECACA' },
  assigned: { bg: '#78350F', text: '#FDE68A' },
  in_progress: { bg: '#78350F', text: '#FDE68A' },
  done: { bg: '#14532D', text: '#BBF7D0' },
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
        <ActivityIndicator color={colors.accent} />
        <Text style={styles.muted}>Loading tickets…</Text>
      </View>
    )
  }

  const visible = filter === 'open' ? tickets.filter(t => t.status !== 'done') : tickets

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.contentContainer}>
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
        const chipColors = STATUS_COLORS[t.status] || STATUS_COLORS.pending
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
              <View style={[styles.statusChip, { backgroundColor: chipColors.bg }]}>
                <Text style={[styles.statusText, { color: chipColors.text }]}>{t.status.replace('_', ' ')}</Text>
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
  page: { flex: 1, backgroundColor: colors.bg },
  contentContainer: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: spacing.xxl },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  muted: { fontSize: 12, color: colors.textSecondary, marginTop: 8 },

  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.lg },
  title: { fontSize: 20, fontWeight: '700', color: colors.text },
  filterRow: { flexDirection: 'row', gap: 6 },
  filterBtn: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingVertical: 6, paddingHorizontal: 12 },
  filterBtnActive: { backgroundColor: colors.accent, borderRadius: radius.md, paddingVertical: 6, paddingHorizontal: 12 },
  filterBtnText: { fontSize: 12, color: colors.textSecondary, fontWeight: '600' },
  filterBtnTextActive: { fontSize: 12, color: colors.text, fontWeight: '600' },

  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: 14, marginBottom: 10 },
  cardTitle: { fontWeight: '700', fontSize: 13.5, color: colors.text },
  cardDesc: { fontSize: 12.5, color: colors.textSecondary, marginTop: 4 },
  cardMeta: { fontSize: 11, color: colors.textTertiary, marginTop: 6 },

  statusChip: { paddingVertical: 3, paddingHorizontal: 10, borderRadius: radius.pill },
  statusText: { fontSize: 11, fontWeight: '700' },

  statusOptionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, flex: 1, justifyContent: 'flex-end' },
  statusOption: { borderWidth: 1, borderColor: colors.border, borderRadius: 6, paddingVertical: 4, paddingHorizontal: 8 },
  statusOptionActive: { backgroundColor: colors.surfaceElevated, borderRadius: 6, paddingVertical: 4, paddingHorizontal: 8 },
  statusOptionText: { fontSize: 10.5, color: colors.textSecondary },
  statusOptionTextActive: { fontSize: 10.5, color: colors.text },
})
