import { useEffect, useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator } from 'react-native'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'

const DEFAULT_MAINTENANCE = 2800
const DEFAULT_SINKING_FUND = 300
const DEFAULT_FESTIVAL_FUND = 150

function currentMonthStr() {
  const d = new Date()
  d.setDate(1)
  return d.toISOString().slice(0, 10)
}

export default function CollectionsScreen() {
  const { profile } = useAuth()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')

  async function loadData() {
    setLoading(true)
    const month = currentMonthStr()

    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, flat_number')
      .eq('building_id', profile.building_id)
      .order('flat_number')

    const { data: dues } = await supabase
      .from('dues')
      .select('*')
      .eq('month', month)
      .eq('building_id', profile.building_id)

    const merged = (profiles || []).map(p => ({
      ...p,
      due: (dues || []).find(d => d.flat_number === p.flat_number) || null,
    }))
    setRows(merged)
    setLoading(false)
  }

  useEffect(() => {
    if (profile) loadData()
  }, [profile])

  async function generateDuesForAll() {
    setGenerating(true)
    setError('')
    const month = currentMonthStr()
    const flatNumbers = [...new Set(rows.map(r => r.flat_number))]

    const { error } = await supabase.from('dues').upsert(
      flatNumbers.map(flat_number => ({
        flat_number,
        month,
        maintenance: DEFAULT_MAINTENANCE,
        sinking_fund: DEFAULT_SINKING_FUND,
        festival_fund: DEFAULT_FESTIVAL_FUND,
        status: 'pending',
        building_id: profile.building_id,
      })),
      { onConflict: 'flat_number,month', ignoreDuplicates: true }
    )

    if (error) setError(error.message)
    await loadData()
    setGenerating(false)
  }

  async function markPaid(dueId) {
    await supabase.from('dues').update({ status: 'paid', paid_at: new Date().toISOString() }).eq('id', dueId)
    loadData()
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator />
        <Text style={styles.muted}>Loading collections…</Text>
      </View>
    )
  }

  const totalCollected = rows.filter(r => r.due?.status === 'paid').reduce((s, r) => s + Number(r.due.total), 0)
  const totalPending = rows.filter(r => r.due && r.due.status !== 'paid').reduce((s, r) => s + Number(r.due.total), 0)

  return (
    <ScrollView style={styles.page} contentContainerStyle={{ padding: 20 }}>
      <Text style={styles.title}>Collections — this month</Text>
      <Text style={styles.sub}>Collected ₹{totalCollected} · Pending ₹{totalPending}</Text>

      <TouchableOpacity style={styles.generateBtn} onPress={generateDuesForAll} disabled={generating}>
        <Text style={styles.generateBtnText}>
          {generating ? 'Generating…' : "Generate this month's dues for all flats"}
        </Text>
      </TouchableOpacity>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      {rows.map(r => (
        <View key={r.id} style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.flatNumber}>{r.flat_number} — {r.full_name}</Text>
            <Text style={styles.amount}>{r.due ? `₹${r.due.total}` : 'Not generated'}</Text>
          </View>

          {r.due && (
            <View style={{ alignItems: 'flex-end' }}>
              <View style={[styles.statusChip, r.due.status === 'paid' ? styles.statusPaid : styles.statusPending]}>
                <Text style={[styles.statusText, r.due.status === 'paid' ? styles.statusTextPaid : styles.statusTextPending]}>
                  {r.due.status}
                </Text>
              </View>
              {r.due.status !== 'paid' && (
                <TouchableOpacity style={styles.markPaidBtn} onPress={() => markPaid(r.due.id)}>
                  <Text style={styles.markPaidBtnText}>Mark paid</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      ))}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#f4f1ea' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f4f1ea' },
  title: { fontSize: 20, fontWeight: '700', color: '#14262a' },
  sub: { fontSize: 13, color: '#6b7674', marginTop: 4, marginBottom: 16 },
  muted: { fontSize: 12, color: '#6b7674', marginTop: 8 },
  error: { color: '#b5533c', fontSize: 12.5, marginBottom: 12 },

  generateBtn: { backgroundColor: '#14262a', padding: 13, borderRadius: 9, alignItems: 'center', marginBottom: 20 },
  generateBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },

  row: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff',
    borderWidth: 1, borderColor: '#e4ddd0', borderRadius: 12, padding: 14, marginBottom: 10,
  },
  flatNumber: { fontWeight: '700', fontSize: 13.5, color: '#1d2b2a' },
  amount: { fontSize: 12.5, color: '#6b7674', marginTop: 2 },

  statusChip: { paddingVertical: 3, paddingHorizontal: 10, borderRadius: 20 },
  statusPaid: { backgroundColor: '#dfe9e6' },
  statusPending: { backgroundColor: '#f3ddd5' },
  statusText: { fontSize: 11, fontWeight: '700' },
  statusTextPaid: { color: '#3a6b63' },
  statusTextPending: { color: '#b5533c' },

  markPaidBtn: { marginTop: 6, backgroundColor: '#e8d9b8', paddingVertical: 5, paddingHorizontal: 12, borderRadius: 6 },
  markPaidBtnText: { color: '#8a641e', fontSize: 11.5, fontWeight: '700' },
})

