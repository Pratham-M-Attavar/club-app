import { useEffect, useState } from 'react'
import { View, Text, TouchableOpacity, TextInput, StyleSheet, ScrollView, ActivityIndicator, Alert, Modal, Image } from 'react-native'
import * as FileSystem from 'expo-file-system/legacy'
import * as Sharing from 'expo-sharing'
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
  const [viewingProofFor, setViewingProofFor] = useState(null) // due id currently fetching a signed url
  const [proofModalUrl, setProofModalUrl] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all') // 'all' | 'paid' | 'pending' | 'not_generated'
  const [exporting, setExporting] = useState(false)

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

  async function markPaid(due) {
    await supabase
      .from('dues')
      .update({ status: 'paid', paid_at: new Date().toISOString(), proof_url: null })
      .eq('id', due.id)

    if (due.proof_url) {
      const { error } = await supabase.storage.from('payment-proofs').remove([due.proof_url])
      if (error) console.log('Could not delete proof file:', error.message)
    }
    loadData()
  }

  async function viewProof(due) {
    if (!due.proof_url) return
    setViewingProofFor(due.id)
    // Bucket is private, so we need a signed URL rather than a public one.
    const { data, error } = await supabase.storage
      .from('payment-proofs')
      .createSignedUrl(due.proof_url, 120)
    setViewingProofFor(null)

    if (error) {
      Alert.alert('Could not open proof', error.message)
      return
    }
    setProofModalUrl(data.signedUrl)
  }

  async function exportCSV() {
    setExporting(true)
    try {
      const header = 'Flat,Resident,Status,Amount\n'
      const lines = rows
        .map(r => {
          const status = r.due ? r.due.status : 'not_generated'
          const amount = r.due ? r.due.total : ''
          // Quote the name in case it contains a comma.
          return `${r.flat_number},"${(r.full_name || '').replace(/"/g, '""')}",${status},${amount}`
        })
        .join('\n')
      const csv = header + lines

      const fileUri = FileSystem.cacheDirectory + `collections_${currentMonthStr()}.csv`
      await FileSystem.writeAsStringAsync(fileUri, csv, { encoding: FileSystem.EncodingType.UTF8 })
      await Sharing.shareAsync(fileUri, { mimeType: 'text/csv', dialogTitle: 'Export collections CSV' })
    } catch (err) {
      Alert.alert('Could not export CSV', err.message)
    }
    setExporting(false)
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

  const filteredRows = rows.filter(r => {
    if (searchQuery.trim() && !r.flat_number.toLowerCase().includes(searchQuery.trim().toLowerCase())) {
      return false
    }
    if (statusFilter === 'all') return true
    if (statusFilter === 'not_generated') return !r.due
    if (statusFilter === 'paid') return r.due?.status === 'paid'
    if (statusFilter === 'pending') return r.due && r.due.status !== 'paid'
    return true
  })

  const FILTERS = [
    { key: 'all', label: 'All' },
    { key: 'paid', label: 'Paid' },
    { key: 'pending', label: 'Pending' },
    { key: 'not_generated', label: 'Not generated' },
  ]

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

      <TouchableOpacity style={styles.exportBtn} onPress={exportCSV} disabled={exporting}>
        <Text style={styles.exportBtnText}>{exporting ? 'Preparing CSV…' : '⬇ Export CSV for treasurer'}</Text>
      </TouchableOpacity>

      <TextInput
        style={styles.searchInput}
        placeholder="Search by flat number…"
        placeholderTextColor="#a39c8e"
        value={searchQuery}
        onChangeText={setSearchQuery}
      />

      <View style={styles.filterRow}>
        {FILTERS.map(f => (
          <TouchableOpacity
            key={f.key}
            style={statusFilter === f.key ? styles.filterChipActive : styles.filterChip}
            onPress={() => setStatusFilter(f.key)}
          >
            <Text style={statusFilter === f.key ? styles.filterChipTextActive : styles.filterChipText}>{f.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {filteredRows.length === 0 && (
        <Text style={styles.muted}>No flats match this search/filter.</Text>
      )}

      {filteredRows.map(r => {
        const status = r.due?.status
        const statusStyle = status === 'paid' ? styles.statusPaid : status === 'submitted' ? styles.statusSubmitted : styles.statusPending
        const statusTextStyle = status === 'paid' ? styles.statusTextPaid : status === 'submitted' ? styles.statusTextSubmitted : styles.statusTextPending

        return (
          <View key={r.id} style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.flatNumber}>{r.flat_number} — {r.full_name}</Text>
              <Text style={styles.amount}>{r.due ? `₹${r.due.total}` : 'Not generated'}</Text>
            </View>

            {r.due && (
              <View style={{ alignItems: 'flex-end' }}>
                <View style={[styles.statusChip, statusStyle]}>
                  <Text style={[styles.statusText, statusTextStyle]}>{status}</Text>
                </View>

                {status === 'submitted' && r.due.proof_url && (
                  <TouchableOpacity
                    style={styles.viewProofBtn}
                    onPress={() => viewProof(r.due)}
                    disabled={viewingProofFor === r.due.id}
                  >
                    <Text style={styles.viewProofBtnText}>
                      {viewingProofFor === r.due.id ? 'Opening…' : 'View proof'}
                    </Text>
                  </TouchableOpacity>
                )}

                {status !== 'paid' && (
                  <TouchableOpacity style={styles.markPaidBtn} onPress={() => markPaid(r.due)}>
                    <Text style={styles.markPaidBtnText}>
                      {status === 'submitted' ? 'Confirm payment' : 'Mark paid'}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>
        )
      })}

      <Modal
        visible={!!proofModalUrl}
        transparent
        animationType="fade"
        onRequestClose={() => setProofModalUrl(null)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalCloseArea} onPress={() => setProofModalUrl(null)} />
          {proofModalUrl && (
            <Image
              source={{ uri: proofModalUrl }}
              style={styles.modalImage}
              resizeMode="contain"
              onError={(e) => {
                Alert.alert(
                  'Image failed to load',
                  e.nativeEvent?.error || 'Unknown error. Tap OK, then check the URL below in a browser.',
                  [
                    { text: 'Copy URL info', onPress: () => Alert.alert('Signed URL', proofModalUrl) },
                    { text: 'OK' },
                  ]
                )
              }}
            />
          )}
          <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setProofModalUrl(null)}>
            <Text style={styles.modalCloseBtnText}>Close</Text>
          </TouchableOpacity>
        </View>
      </Modal>
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

  exportBtn: { borderWidth: 1, borderColor: '#245A73', padding: 11, borderRadius: 9, alignItems: 'center', marginBottom: 14 },
  exportBtnText: { color: '#245A73', fontWeight: '700', fontSize: 13 },

  searchInput: {
    backgroundColor: '#fff', borderWidth: 1, borderColor: '#e4ddd0', borderRadius: 9,
    padding: 11, fontSize: 13.5, color: '#1d2b2a', marginBottom: 10,
  },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  filterChip: { borderWidth: 1, borderColor: '#e4ddd0', borderRadius: 20, paddingVertical: 6, paddingHorizontal: 12, backgroundColor: '#fff' },
  filterChipActive: { backgroundColor: '#245A73', borderRadius: 20, paddingVertical: 6, paddingHorizontal: 12 },
  filterChipText: { fontSize: 12, color: '#1d2b2a', fontWeight: '600' },
  filterChipTextActive: { fontSize: 12, color: '#fff', fontWeight: '600' },

  row: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff',
    borderWidth: 1, borderColor: '#e4ddd0', borderRadius: 12, padding: 14, marginBottom: 10,
  },
  flatNumber: { fontWeight: '700', fontSize: 13.5, color: '#1d2b2a' },
  amount: { fontSize: 12.5, color: '#6b7674', marginTop: 2 },

  statusChip: { paddingVertical: 3, paddingHorizontal: 10, borderRadius: 20 },
  statusPaid: { backgroundColor: '#dfe9e6' },
  statusPending: { backgroundColor: '#f3ddd5' },
  statusSubmitted: { backgroundColor: '#DCE7EA' },
  statusText: { fontSize: 11, fontWeight: '700' },
  statusTextPaid: { color: '#3a6b63' },
  statusTextPending: { color: '#b5533c' },
  statusTextSubmitted: { color: '#245A73' },

  viewProofBtn: { marginTop: 6, borderWidth: 1, borderColor: '#245A73', paddingVertical: 5, paddingHorizontal: 12, borderRadius: 6 },
  viewProofBtnText: { color: '#245A73', fontSize: 11.5, fontWeight: '700' },

  markPaidBtn: { marginTop: 6, backgroundColor: '#e8d9b8', paddingVertical: 5, paddingHorizontal: 12, borderRadius: 6 },
  markPaidBtnText: { color: '#8a641e', fontSize: 11.5, fontWeight: '700' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', alignItems: 'center', justifyContent: 'center' },
  modalCloseArea: { ...StyleSheet.absoluteFillObject },
  modalImage: { width: '92%', height: '75%' },
  modalCloseBtn: { marginTop: 20, backgroundColor: 'rgba(255,255,255,0.15)', paddingVertical: 10, paddingHorizontal: 24, borderRadius: 8 },
  modalCloseBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
})