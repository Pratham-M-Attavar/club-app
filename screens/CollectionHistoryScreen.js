import { useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { SafeAreaView } from 'react-native-safe-area-context'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { useTheme, radius, spacing } from '../lib/theme'

function monthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`
}

function previousMonths(count = 12) {
  const today = new Date()
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(today.getFullYear(), today.getMonth() - index, 1)
    return monthKey(date)
  })
}

function monthLabel(month, short = false) {
  return new Intl.DateTimeFormat('en-IN', short
    ? { month: 'short', year: '2-digit' }
    : { month: 'long', year: 'numeric' }
  ).format(new Date(`${month}T00:00:00`))
}

function money(amount) {
  return `₹${Number(amount || 0).toLocaleString('en-IN')}`
}

function getStatusMeta(colors) {
  return {
    paid: { label: 'Paid', color: colors.success, bg: colors.successBg, icon: 'checkmark-circle-outline' },
    submitted: { label: 'Submitted', color: '#3B82F6', bg: 'rgba(59, 130, 246, 0.16)', icon: 'time-outline' },
    pending: { label: 'Pending', color: colors.warning, bg: colors.warningBg, icon: 'alert-circle-outline' },
  }
}

function CollectionRing({ percentage, size = 104 }) {
  const { colors } = useTheme()
  const styles = useMemo(() => getStyles(colors), [colors])
  const dotCount = 60
  const totalArc = 270
  const startAngle = 135
  const filledCount = Math.round(Math.max(0, Math.min(1, percentage)) * dotCount)
  const ringRadius = size / 2 - 10
  const center = size / 2

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      {Array.from({ length: dotCount }, (_, index) => {
        const angle = startAngle + (index / (dotCount - 1)) * totalArc
        const radians = (angle * Math.PI) / 180
        const isFilled = index < filledCount

        return (
          <View
            key={index}
            style={{
              position: 'absolute',
              width: 7,
              height: 7,
              borderRadius: 3.5,
              backgroundColor: isFilled ? colors.success : colors.skeleton,
              left: center + ringRadius * Math.cos(radians) - 3.5,
              top: center + ringRadius * Math.sin(radians) - 3.5,
            }}
          />
        )
      })}
      <View style={{ alignItems: 'center', justifyContent: 'center' }}>
        <Text style={styles.progressValue}>{Math.round(percentage * 100)}%</Text>
        <Text style={styles.progressCaption}>Collected</Text>
      </View>
    </View>
  )
}

export default function CollectionHistoryScreen() {
  const { profile } = useAuth()
  const { colors } = useTheme()
  const styles = useMemo(() => getStyles(colors), [colors])
  const STATUS = useMemo(() => getStatusMeta(colors), [colors])
  const months = useMemo(() => previousMonths(), [])
  const [selectedMonth, setSelectedMonth] = useState(months[0])
  const [flats, setFlats] = useState([])
  const [dues, setDues] = useState([])
  const [residentsByFlat, setResidentsByFlat] = useState(new Map())
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    async function loadHistory() {
      if (!profile?.building_id) {
        setFlats([])
        setDues([])
        setLoading(false)
        return
      }
      setLoading(true)
      const [flatsResult, duesResult] = await Promise.all([
        supabase.from('flats').select('id, flat_number').eq('building_id', profile.building_id).order('flat_number'),
        supabase.from('dues').select('id, flat_number, month, maintenance, total, status, paid_at').eq('building_id', profile.building_id).in('month', months),
      ])
      const flatRows = flatsResult.data || []
      const flatIds = flatRows.map(flat => flat.id)
      const residentsResult = flatIds.length
        ? await supabase.from('profiles').select('flat_id, full_name').in('flat_id', flatIds)
        : { data: [] }
      const names = new Map()
        ; (residentsResult.data || []).forEach(resident => {
          if (!names.has(resident.flat_id) && resident.full_name) names.set(resident.flat_id, resident.full_name)
        })
      setFlats(flatRows)
      setDues(duesResult.data || [])
      setResidentsByFlat(names)
      setLoading(false)
    }
    loadHistory()
  }, [profile?.building_id, months])

  const selectedDues = useMemo(() => dues.filter(due => due.month === selectedMonth), [dues, selectedMonth])
  const dueByFlat = useMemo(() => new Map(selectedDues.map(due => [due.flat_number, due])), [selectedDues])
  const historyRows = useMemo(() => flats.map(flat => ({ ...flat, due: dueByFlat.get(flat.flat_number) || null, resident: residentsByFlat.get(flat.id) || 'Resident' })).filter(row => row.due), [flats, dueByFlat, residentsByFlat])
  const summary = useMemo(() => {
    const total = historyRows.reduce((sum, row) => sum + Number(row.due.total ?? row.due.maintenance ?? 0), 0)
    const paidRows = historyRows.filter(row => row.due.status === 'paid')
    const paid = paidRows.reduce((sum, row) => sum + Number(row.due.total ?? row.due.maintenance ?? 0), 0)
    const pending = historyRows.filter(row => row.due.status === 'pending').length
    const submitted = historyRows.filter(row => row.due.status === 'submitted').length
    return { total, paid, outstanding: total - paid, paidCount: paidRows.length, pending, submitted, rate: total ? Math.round((paid / total) * 100) : 0 }
  }, [historyRows])
  const visibleRows = useMemo(() => historyRows.filter(row => {
    const value = `${row.flat_number} ${row.resident}`.toLowerCase()
    return (!query.trim() || value.includes(query.trim().toLowerCase())) && (filter === 'all' || row.due.status === filter)
  }), [historyRows, query, filter])
  const monthlyRates = useMemo(() => months.slice().reverse().map(month => {
    const monthDues = dues.filter(due => due.month === month)
    const expected = monthDues.reduce((sum, due) => sum + Number(due.total ?? due.maintenance ?? 0), 0)
    const collected = monthDues.filter(due => due.status === 'paid').reduce((sum, due) => sum + Number(due.total ?? due.maintenance ?? 0), 0)
    return { month, rate: expected ? Math.round((collected / expected) * 100) : 0 }
  }), [dues, months])

  if (loading) return <SafeAreaView style={styles.center}><ActivityIndicator color={colors.success} /></SafeAreaView>

  return (
    <SafeAreaView style={styles.page} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.kicker}>MAINTENANCE HISTORY</Text>
        <Text style={styles.subtitle}>Previous 12 months</Text>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.monthScroller}>
          {months.map(month => {
            const selected = month === selectedMonth
            return <TouchableOpacity key={month} style={[styles.monthChip, selected && styles.monthChipActive]} onPress={() => setSelectedMonth(month)}><Text style={[styles.monthChipText, selected && styles.monthChipTextActive]}>{monthLabel(month, true)}</Text></TouchableOpacity>
          })}
        </ScrollView>

        <View style={styles.summaryHeader}><Text style={styles.sectionLabel}>SUMMARY · {monthLabel(selectedMonth).toUpperCase()}</Text><Text style={styles.rateText}>{summary.rate}% collected</Text></View>
        <View style={styles.statsGrid}>
          <Stat label="Expected" value={money(summary.total)} sub={`${historyRows.length} records`} />
          <Stat label="Collected" value={money(summary.paid)} sub={`${summary.paidCount} paid`} color={colors.success} />
          <Stat label="Outstanding" value={money(summary.outstanding)} sub={`${summary.pending} pending`} color={colors.warning} />
          <Stat label="Submitted" value={String(summary.submitted)} sub="Awaiting approval" color="#3B82F6" />
        </View>

        <View style={styles.progressCard}>
          <CollectionRing percentage={summary.rate / 100} />
          <View style={styles.progressDetails}>
            <ProgressLine label="Paid flats" count={summary.paidCount} total={historyRows.length} color={colors.success} />
            <ProgressLine label="Pending" count={summary.pending} total={historyRows.length} color={colors.warning} />
            <ProgressLine label="Submitted" count={summary.submitted} total={historyRows.length} color="#3B82F6" />
          </View>
        </View>

        <Text style={styles.sectionLabel}>12-MONTH COLLECTION RATE</Text>
        <View style={styles.chartCard}>{monthlyRates.map(item => <View key={item.month} style={styles.barWrap}><View style={styles.barTrack}><View style={[styles.bar, { height: `${Math.max(item.rate, 3)}%` }]} /></View><Text style={styles.barLabel}>{monthLabel(item.month, true).split(' ')[0]}</Text></View>)}</View>

        <Text style={styles.sectionLabel}>DUE RECORDS</Text>
        <TextInput style={styles.searchInput} placeholder="Search flat or resident" placeholderTextColor={colors.textTertiary} value={query} onChangeText={setQuery} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          {[['all', 'All'], ['paid', 'Paid'], ['pending', 'Pending'], ['submitted', 'Submitted']].map(([key, label]) => <TouchableOpacity key={key} style={[styles.filterChip, filter === key && styles.filterChipActive]} onPress={() => setFilter(key)}><Text style={[styles.filterChipText, filter === key && styles.filterChipTextActive]}>{label}</Text></TouchableOpacity>)}
        </ScrollView>

        {visibleRows.length ? visibleRows.map(row => {
          const status = STATUS[row.due.status] || STATUS.pending
          const amount = row.due.total ?? row.due.maintenance
          return <View key={row.due.id} style={styles.recordCard}>
            <View style={[styles.flatBadge, { backgroundColor: status.bg }]}><Text style={[styles.flatBadgeText, { color: status.color }]}>{row.flat_number}</Text></View>
            <View style={styles.recordInfo}><Text style={styles.resident} numberOfLines={1}>{row.resident}</Text><Text style={styles.recordMeta}>{row.due.paid_at ? `Paid ${new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short' }).format(new Date(row.due.paid_at))}` : 'No payment yet'}</Text></View>
            <View style={styles.recordRight}><Text style={styles.recordAmount}>{money(amount)}</Text><View style={[styles.statusBadge, { backgroundColor: status.bg }]}><Ionicons name={status.icon} size={12} color={status.color} /><Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text></View></View>
          </View>
        }) : <Text style={styles.empty}>No due records match this view.</Text>}
      </ScrollView>
    </SafeAreaView>
  )
}

function Stat({ label, value, sub, color }) {
  const { colors } = useTheme()
  const styles = useMemo(() => getStyles(colors), [colors])
  return <View style={styles.statCard}><Text style={styles.statLabel}>{label.toUpperCase()}</Text><Text style={[styles.statValue, { color: color || colors.text }]}>{value}</Text><Text style={styles.statSub}>{sub}</Text></View>
}

function ProgressLine({ label, count, total, color }) {
  const { colors } = useTheme()
  const styles = useMemo(() => getStyles(colors), [colors])
  const width = total ? `${Math.round((count / total) * 100)}%` : '0%'
  return <View style={styles.progressLine}><View style={styles.progressLineHeader}><Text style={styles.progressLineLabel}>{label}</Text><Text style={[styles.progressLineValue, { color }]}>{count}</Text></View><View style={styles.progressTrack}><View style={[styles.progressFill, { backgroundColor: color, width }]} /></View></View>
}

function getStyles(colors) {
  return StyleSheet.create({
    page: { flex: 1, backgroundColor: colors.bg }, center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }, content: { padding: spacing.xl, paddingBottom: 40 },
    kicker: { color: colors.text, fontSize: 24, fontWeight: '800', letterSpacing: -0.5 }, subtitle: { color: colors.textSecondary, fontSize: 13, marginTop: 3, marginBottom: 18 },
    monthScroller: { gap: 8, paddingRight: 20, marginBottom: 22 }, monthChip: { paddingHorizontal: 13, paddingVertical: 9, borderRadius: radius.pill, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }, monthChipActive: { backgroundColor: colors.successBg, borderColor: colors.success }, monthChipText: { color: colors.textSecondary, fontSize: 12, fontWeight: '700' }, monthChipTextActive: { color: colors.success },
    summaryHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }, sectionLabel: { color: colors.textTertiary, fontSize: 10.5, fontWeight: '800', letterSpacing: 0.9, marginTop: 4, marginBottom: 10 }, rateText: { color: colors.success, fontSize: 12, fontWeight: '800', marginBottom: 10 },
    statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 }, statCard: { width: '48.5%', backgroundColor: colors.surface, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: colors.border }, statLabel: { color: colors.textTertiary, fontSize: 9.5, fontWeight: '800', letterSpacing: 0.6 }, statValue: { fontSize: 20, fontWeight: '800', marginTop: 7, letterSpacing: -0.4 }, statSub: { color: colors.textSecondary, fontSize: 11, marginTop: 5 },
    progressCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 20, padding: 16, marginBottom: 20 }, progressValue: { color: colors.text, fontSize: 22, fontWeight: '800' }, progressCaption: { color: colors.textTertiary, fontSize: 10, marginTop: 1 }, progressDetails: { flex: 1, marginLeft: 18, gap: 13 }, progressLine: {}, progressLineHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 }, progressLineLabel: { color: colors.textSecondary, fontSize: 12 }, progressLineValue: { fontSize: 13, fontWeight: '800' }, progressTrack: { height: 4, borderRadius: 3, backgroundColor: colors.border, overflow: 'hidden' }, progressFill: { height: '100%', borderRadius: 3 },
    chartCard: { height: 146, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 5, padding: 14, paddingBottom: 10, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 18, marginBottom: 20 }, barWrap: { flex: 1, alignItems: 'center', height: '100%' }, barTrack: { flex: 1, width: 8, justifyContent: 'flex-end', backgroundColor: colors.surfaceMuted, borderRadius: 5, overflow: 'hidden' }, bar: { width: '100%', backgroundColor: colors.success, borderRadius: 5 }, barLabel: { color: colors.textTertiary, fontSize: 9, marginTop: 7 },
    searchInput: { color: colors.text, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 13, paddingVertical: 12, fontSize: 13.5, marginBottom: 10 }, filterRow: { gap: 8, marginBottom: 14 }, filterChip: { paddingVertical: 7, paddingHorizontal: 12, borderRadius: radius.pill, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }, filterChipActive: { backgroundColor: colors.accent, borderColor: colors.accent }, filterChipText: { color: colors.textSecondary, fontSize: 12, fontWeight: '700' }, filterChipTextActive: { color: colors.text },
    recordCard: { minHeight: 72, flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: radius.lg, marginBottom: 9, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }, flatBadge: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }, flatBadgeText: { fontSize: 11, fontWeight: '800' }, recordInfo: { flex: 1, marginLeft: 11 }, resident: { color: colors.text, fontSize: 14, fontWeight: '700' }, recordMeta: { color: colors.textTertiary, fontSize: 11, marginTop: 3 }, recordRight: { alignItems: 'flex-end', marginLeft: 8 }, recordAmount: { color: colors.text, fontSize: 14, fontWeight: '800' }, statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 5, paddingVertical: 3, paddingHorizontal: 7, borderRadius: 7 }, statusText: { fontSize: 10, fontWeight: '800' }, empty: { color: colors.textSecondary, textAlign: 'center', paddingVertical: 30 },
  })
}