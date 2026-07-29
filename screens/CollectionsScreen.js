import { useEffect, useMemo, useState } from 'react'
import { View, Text, TouchableOpacity, TextInput, StyleSheet, ScrollView, ActivityIndicator, Alert, Modal, Image } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import * as FileSystem from 'expo-file-system/legacy'
import * as Sharing from 'expo-sharing'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { colors, spacing, radius, shadow } from '../lib/theme'

function currentMonthStr() {
  const date = new Date()
  date.setDate(1)
  return date.toISOString().slice(0, 10)
}

function formatMoney(amount) {
  return `₹${Number(amount || 0).toLocaleString('en-IN')}`
}

function monthLabel(month) {
  return new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric' }).format(new Date(`${month}T00:00:00`))
}

function dueDateLabel(month) {
  const [year, monthNumber] = month.slice(0, 7).split('-').map(Number)
  return new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short' }).format(new Date(year, monthNumber, 0))
}

function CollectionRing({ percentage, paidUnits, totalUnits }) {
  const segmentCount = 28
  const filledSegments = Math.round(Math.max(0, Math.min(1, percentage)) * segmentCount)
  const ringRadius = 53

  return (
    <View style={styles.ring}>
      <View style={styles.ringTrack}>
        {Array.from({ length: segmentCount }, (_, index) => {
          const angle = 135 + (index * 270) / (segmentCount - 1)
          const radians = (angle * Math.PI) / 180
          return <View key={index} style={[styles.ringSegment, {
            backgroundColor: index < filledSegments ? colors.success : 'rgba(16,185,129,0.14)',
            left: 58 + ringRadius * Math.cos(radians) - 2,
            top: 58 + ringRadius * Math.sin(radians) - 5,
            transform: [{ rotate: `${angle + 90}deg` }],
          }]} />
        })}
        <View style={styles.ringLabel}>
        <Text style={styles.ringPercent}>{Math.round(percentage * 100)}%</Text>
        <Text style={styles.ringSub}>{paidUnits}/{totalUnits} flats</Text>
        </View>
      </View>
    </View>
  )
}

function CollectionTrend({ points }) {
  if (!points.length) return <Text style={styles.chartEmpty}>Payments will appear here as they are confirmed.</Text>

  const max = Math.max(...points.map(point => point.amount), 1)

  return (
    <View>
      <View style={styles.trendBars}>
        {points.map((point, index) => <View key={`${point.label}-${index}`} style={styles.trendBarSlot}><View style={[styles.trendBar, { height: `${Math.max((point.amount / max) * 100, 8)}%` }]} /></View>)}
      </View>
      <View style={styles.chartLabels}>
        <Text style={styles.chartLabel}>{points[0].label}</Text>
        <Text style={styles.chartLabel}>{points[points.length - 1].label}</Text>
      </View>
    </View>
  )
}

export default function CollectionsScreen() {
  const { profile } = useAuth()
  const [rows, setRows] = useState([])
  const [buildingName, setBuildingName] = useState('Your building')
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')
  const [viewingProofFor, setViewingProofFor] = useState(null)
  const [proofModalUrl, setProofModalUrl] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [exporting, setExporting] = useState(false)
  const month = currentMonthStr()

  async function loadData() {
    if (!profile?.building_id) return
    setLoading(true)
    const [flatsResult, duesResult, buildingResult] = await Promise.all([
      supabase.from('flats').select('id, flat_number, maintenance_amount, maintenance_payer').eq('building_id', profile.building_id).order('flat_number'),
      supabase.from('dues').select('*').eq('month', month).eq('building_id', profile.building_id),
      supabase.from('buildings').select('name').eq('id', profile.building_id).maybeSingle(),
    ])
    const flatIds = (flatsResult.data || []).map(flat => flat.id)
    const residentsResult = flatIds.length
      ? await supabase.from('profiles').select('flat_id, full_name, ownership').in('flat_id', flatIds)
      : { data: [] }
    const duesByFlat = new Map((duesResult.data || []).map(due => [due.flat_number, due]))
    const residentsByFlat = new Map()
    ;(residentsResult.data || []).forEach(resident => {
      const residents = residentsByFlat.get(resident.flat_id) || []
      residents.push(resident)
      residentsByFlat.set(resident.flat_id, residents)
    })
    setRows((flatsResult.data || []).map(flat => ({ ...flat, residents: residentsByFlat.get(flat.id) || [], due: duesByFlat.get(flat.flat_number) || null })))
    setBuildingName(buildingResult.data?.name || 'Your building')
    setLoading(false)
  }

  useEffect(() => { loadData() }, [profile?.building_id])

  async function generateDuesForAll() {
    const missingAmounts = rows.filter(row => Number(row.maintenance_amount) <= 0)
    if (missingAmounts.length) {
      setError('Set a maintenance amount for every flat before generating dues.')
      return
    }
    setGenerating(true)
    setError('')
    const { error: upsertError } = await supabase.from('dues').upsert(
      rows.map(row => ({ flat_number: row.flat_number, month, maintenance: Number(row.maintenance_amount), status: 'pending', building_id: profile.building_id })),
      { onConflict: 'flat_number,month', ignoreDuplicates: true }
    )
    if (upsertError) setError(upsertError.message)
    await loadData()
    setGenerating(false)
  }

  async function markPaid(due) {
    await supabase.from('dues').update({ status: 'paid', paid_at: new Date().toISOString(), proof_url: null }).eq('id', due.id)
    if (due.proof_url) {
      const { error: storageError } = await supabase.storage.from('payment-proofs').remove([due.proof_url])
      if (storageError) console.log('Could not delete proof file:', storageError.message)
    }
    loadData()
  }

  async function viewProof(due) {
    if (!due.proof_url) return
    setViewingProofFor(due.id)
    const { data, error: urlError } = await supabase.storage.from('payment-proofs').createSignedUrl(due.proof_url, 120)
    setViewingProofFor(null)
    if (urlError) return Alert.alert('Could not open proof', urlError.message)
    setProofModalUrl(data.signedUrl)
  }

  async function exportCSV() {
    setExporting(true)
    try {
      const lines = rows.map(row => `${row.flat_number},"${(row.full_name || '').replace(/"/g, '""')}",${row.due?.status || 'not_generated'},${row.due?.total || ''}`).join('\n')
      const fileUri = FileSystem.cacheDirectory + `collections_${month}.csv`
      await FileSystem.writeAsStringAsync(fileUri, `Flat,Resident,Status,Amount\n${lines}`, { encoding: FileSystem.EncodingType.UTF8 })
      await Sharing.shareAsync(fileUri, { mimeType: 'text/csv', dialogTitle: 'Export collections CSV' })
    } catch (exportError) { Alert.alert('Could not export CSV', exportError.message) }
    setExporting(false)
  }

  const metrics = useMemo(() => {
    const paid = rows.filter(row => row.due?.status === 'paid')
    const amountFor = row => Number(row.due?.total ?? row.due?.maintenance ?? row.maintenance_amount ?? 0)
    const collected = paid.reduce((sum, row) => sum + amountFor(row), 0)
    const expected = rows.reduce((sum, row) => sum + amountFor(row), 0)
    const datedPayments = paid.filter(row => row.due.paid_at).sort((a, b) => new Date(a.due.paid_at) - new Date(b.due.paid_at))
    let runningTotal = 0
    const trend = datedPayments.map(row => {
      runningTotal += amountFor(row)
      return { amount: runningTotal, label: new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short' }).format(new Date(row.due.paid_at)) }
    })
    return { totalUnits: rows.length, paid: paid.length, pending: rows.length - paid.length, collected, expected, trend }
  }, [rows])

  const filteredRows = rows.filter(row => {
    const query = searchQuery.trim().toLowerCase()
    if (query && !`${row.flat_number} ${row.full_name || ''}`.toLowerCase().includes(query)) return false
    if (statusFilter === 'not_generated') return !row.due
    if (statusFilter === 'paid') return row.due?.status === 'paid'
    if (statusFilter === 'pending') return row.due && row.due.status !== 'paid'
    return true
  })
  const filters = [{ key: 'all', label: 'All' }, { key: 'paid', label: 'Paid' }, { key: 'pending', label: 'Pending' }, { key: 'not_generated', label: 'Not generated' }]

  if (loading) return <View style={styles.centered}><ActivityIndicator color={colors.success} /><Text style={styles.loadingText}>Loading collections…</Text></View>

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.header}><View><Text style={styles.title}>Collection</Text><Text style={styles.subtitle}>{buildingName} · {monthLabel(month)}</Text></View><View style={styles.headerIcon}><Ionicons name="trending-up" size={18} color={colors.success} /></View></View>

      <View style={[styles.card, styles.summaryCard]}>
        <CollectionRing percentage={metrics.totalUnits ? metrics.paid / metrics.totalUnits : 0} paidUnits={metrics.paid} totalUnits={metrics.totalUnits} />
        <View style={styles.summaryInfo}><Text style={styles.eyebrow}>Collected</Text><Text style={styles.bigAmount}>{formatMoney(metrics.collected)}</Text><Text style={styles.expected}>of {formatMoney(metrics.expected)} expected</Text><View style={styles.statusLine}><View style={[styles.dot, { backgroundColor: colors.success }]} /><Text style={styles.statusText}>{metrics.paid} paid</Text></View><View style={styles.statusLine}><View style={[styles.dot, { backgroundColor: colors.warning }]} /><Text style={styles.statusText}>{metrics.pending} pending</Text></View><Text style={styles.dueText}>Due {dueDateLabel(month)}</Text></View>
      </View>

      <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>Collection trend</Text><Text style={styles.sectionValue}>{formatMoney(metrics.collected)} collected</Text></View>
      <View style={[styles.card, styles.chartCard]}><Text style={styles.eyebrow}>Cumulative · {monthLabel(month)}</Text><Text style={styles.chartAmount}>{formatMoney(metrics.collected)}</Text><CollectionTrend points={metrics.trend} /></View>

      <View style={styles.actionRow}><TouchableOpacity style={styles.generateButton} onPress={generateDuesForAll} disabled={generating}><Ionicons name="add-circle-outline" size={17} color={colors.text} /><Text style={styles.generateText}>{generating ? 'Generating…' : 'Generate monthly dues'}</Text></TouchableOpacity><TouchableOpacity style={styles.exportButton} onPress={exportCSV} disabled={exporting}><Ionicons name="download-outline" size={18} color={colors.text} /></TouchableOpacity></View>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <TextInput style={styles.searchInput} placeholder="Search flat or resident…" placeholderTextColor={colors.textFaint} value={searchQuery} onChangeText={setSearchQuery} />
      <View style={styles.filterRow}>{filters.map(filter => <TouchableOpacity key={filter.key} style={statusFilter === filter.key ? styles.filterActive : styles.filter} onPress={() => setStatusFilter(filter.key)}><Text style={statusFilter === filter.key ? styles.filterTextActive : styles.filterText}>{filter.label}</Text></TouchableOpacity>)}</View>

      <Text style={styles.sectionTitle}>Unit payment status</Text>
      {filteredRows.map(row => {
        const paid = row.due?.status === 'paid'
        const submitted = row.due?.status === 'submitted'
        const statusLabel = !row.due ? 'Due not generated' : paid ? 'Paid' : submitted ? 'Awaiting committee approval' : 'Awaiting payment'
        const statusColor = paid ? colors.success : submitted ? colors.warning : colors.danger
        const statusBackground = paid ? colors.successBg : submitted ? colors.warningBg : colors.dangerBg
        const statusIcon = paid ? 'checkmark-circle' : submitted ? 'time' : 'alert-circle'
        const residentNames = row.residents.map(resident => `${resident.full_name || 'Resident'} (${resident.ownership || 'resident'})`).join(' · ')
        return <View key={row.id} style={[styles.unitCard, { borderColor: statusColor + '55' }]}><View style={[styles.flatBadge, { backgroundColor: statusBackground }]}><Text style={[styles.flatBadgeText, { color: statusColor }]}>{row.flat_number}</Text></View><View style={styles.unitInfo}><Text style={styles.residentName} numberOfLines={1}>{residentNames || 'Resident not assigned'}</Text><View style={styles.statusMeta}><Ionicons name={statusIcon} size={12} color={statusColor} /><Text style={[styles.unitMeta, { color: statusColor }]}>{statusLabel}</Text></View><Text style={styles.amountMeta}>{formatMoney(row.due?.total ?? row.due?.maintenance ?? row.maintenance_amount)}</Text></View>{row.due && <View style={styles.unitActions}>{paid ? <Ionicons name="checkmark-circle" size={23} color={colors.success} /> : <TouchableOpacity style={[styles.markButton, { backgroundColor: statusBackground }]} onPress={() => markPaid(row.due)}><Text style={[styles.markButtonText, { color: statusColor }]}>{submitted ? 'Approve' : 'Mark paid'}</Text></TouchableOpacity>}{submitted && row.due.proof_url ? <TouchableOpacity onPress={() => viewProof(row.due)} disabled={viewingProofFor === row.due.id}><Text style={styles.proofText}>{viewingProofFor === row.due.id ? 'Opening…' : 'Proof'}</Text></TouchableOpacity> : null}</View>}</View>
      })}
      {!filteredRows.length && <Text style={styles.empty}>No flats match this search or filter.</Text>}

      <Modal visible={!!proofModalUrl} transparent animationType="fade" onRequestClose={() => setProofModalUrl(null)}><View style={styles.modalOverlay}><TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setProofModalUrl(null)} />{proofModalUrl && <Image source={{ uri: proofModalUrl }} style={styles.modalImage} resizeMode="contain" />}<TouchableOpacity style={styles.closeButton} onPress={() => setProofModalUrl(null)}><Text style={styles.closeButtonText}>Close</Text></TouchableOpacity></View></Modal>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.bg }, content: { padding: spacing.xl, paddingBottom: spacing.xxxl }, centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }, loadingText: { color: colors.textSecondary, marginTop: 10 }, header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.sm, marginBottom: spacing.xl }, title: { color: colors.text, fontSize: 28, fontWeight: '800', letterSpacing: -0.7 }, subtitle: { color: colors.textSecondary, marginTop: 4, fontSize: 13 }, headerIcon: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.successBg, borderWidth: 1, borderColor: 'rgba(16,185,129,0.28)' }, card: { backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, ...shadow.card }, summaryCard: { flexDirection: 'row', alignItems: 'center', padding: 14, marginBottom: spacing.xl }, ring: { width: 144, height: 144, alignItems: 'center', justifyContent: 'center' }, ringTrack: { width: 116, height: 116, position: 'relative', alignItems: 'center', justifyContent: 'center' }, ringSegment: { position: 'absolute', width: 4, height: 10, borderRadius: 3 }, ringLabel: { alignItems: 'center' }, ringPercent: { fontSize: 27, lineHeight: 31, fontWeight: '800', color: colors.text }, ringSub: { fontSize: 11, color: colors.textTertiary, marginTop: 2 }, summaryInfo: { flex: 1, marginLeft: 3 }, eyebrow: { color: colors.textTertiary, fontSize: 10.5, fontWeight: '700', letterSpacing: 0.7, textTransform: 'uppercase' }, bigAmount: { color: colors.text, fontSize: 23, fontWeight: '800', letterSpacing: -0.5, marginTop: 3 }, expected: { color: colors.textTertiary, fontSize: 11, marginTop: 2, marginBottom: 10 }, statusLine: { flexDirection: 'row', alignItems: 'center', marginTop: 5 }, dot: { width: 6, height: 6, borderRadius: 3, marginRight: 8 }, statusText: { color: colors.textSecondary, fontSize: 12, fontWeight: '600' }, dueText: { color: colors.textTertiary, fontSize: 11, marginTop: 7 }, sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }, sectionTitle: { color: colors.text, fontSize: 15, fontWeight: '700', marginBottom: 10 }, sectionValue: { color: colors.success, fontSize: 11, fontWeight: '700', marginBottom: 10 }, chartCard: { padding: spacing.lg, marginBottom: spacing.xl }, chartAmount: { color: colors.text, fontSize: 27, fontWeight: '800', marginTop: 3, marginBottom: 4, letterSpacing: -0.5 }, trendBars: { height: 112, flexDirection: 'row', alignItems: 'flex-end', gap: 5, paddingHorizontal: 2, paddingTop: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.border }, trendBarSlot: { flex: 1, height: '100%', justifyContent: 'flex-end' }, trendBar: { width: '100%', minWidth: 4, alignSelf: 'center', borderRadius: 4, backgroundColor: colors.success }, chartLabels: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 5, paddingTop: 6 }, chartLabel: { color: colors.textFaint, fontSize: 10 }, chartEmpty: { color: colors.textTertiary, fontSize: 12, paddingVertical: 32, textAlign: 'center' }, actionRow: { flexDirection: 'row', gap: 10, marginBottom: 10 }, generateButton: { flex: 1, minHeight: 46, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, backgroundColor: colors.accent, borderRadius: radius.md }, generateText: { color: colors.text, fontWeight: '700', fontSize: 13 }, exportButton: { width: 46, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.borderStrong }, error: { color: colors.danger, fontSize: 12, marginBottom: 10 }, searchInput: { color: colors.text, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 13, paddingVertical: 12, fontSize: 13.5, marginTop: 4, marginBottom: 10 }, filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: spacing.xl }, filter: { paddingVertical: 7, paddingHorizontal: 12, borderRadius: radius.pill, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }, filterActive: { paddingVertical: 7, paddingHorizontal: 12, borderRadius: radius.pill, backgroundColor: colors.accent }, filterText: { color: colors.textSecondary, fontSize: 12, fontWeight: '600' }, filterTextActive: { color: colors.text, fontSize: 12, fontWeight: '700' }, unitCard: { minHeight: 74, flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: radius.lg, marginBottom: 9, backgroundColor: colors.surface, borderWidth: 1 }, flatBadge: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }, flatBadgeText: { fontSize: 11, fontWeight: '800' }, unitInfo: { flex: 1, marginLeft: 11 }, residentName: { color: colors.text, fontSize: 13, fontWeight: '700' }, statusMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 }, unitMeta: { fontSize: 11, fontWeight: '600' }, amountMeta: { color: colors.textTertiary, fontSize: 11, marginTop: 2 }, unitActions: { alignItems: 'flex-end', gap: 4 }, markButton: { paddingVertical: 6, paddingHorizontal: 9, borderRadius: 8 }, markButtonText: { fontSize: 11, fontWeight: '700' }, proofText: { color: colors.accent, fontSize: 11, fontWeight: '700' }, empty: { color: colors.textSecondary, textAlign: 'center', paddingVertical: 24 }, modalOverlay: { flex: 1, backgroundColor: colors.overlay, alignItems: 'center', justifyContent: 'center' }, modalImage: { width: '92%', height: '75%' }, closeButton: { marginTop: 20, backgroundColor: 'rgba(255,255,255,0.15)', paddingVertical: 10, paddingHorizontal: 24, borderRadius: 8 }, closeButtonText: { color: '#fff', fontWeight: '700', fontSize: 14 },
})
