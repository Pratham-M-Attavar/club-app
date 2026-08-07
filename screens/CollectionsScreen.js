import { useEffect, useMemo, useState } from 'react'
import { View, Text, TouchableOpacity, TextInput, StyleSheet, ScrollView, ActivityIndicator, Alert, Modal, Image } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import * as FileSystem from 'expo-file-system/legacy'
import * as Sharing from 'expo-sharing'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { colors, spacing, radius, shadow } from '../lib/theme'
import { dueDateForMonth, getCurrentMonthStr } from '../lib/format'
import { useNavigation } from '@react-navigation/native'
function currentMonthStr() {
  return getCurrentMonthStr()
}

function formatMoney(amount) {
  return `₹${Number(amount || 0).toLocaleString('en-IN')}`
}

function monthLabel(month) {
  return new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric' }).format(new Date(`${month}T00:00:00`))
}

function dueDateLabel(month, dueDay) {
  const [year, monthNumber] = month.slice(0, 7).split('-').map(Number)
  const lastDay = new Date(year, monthNumber, 0).getDate()
  return new Intl.DateTimeFormat('en-IN', { month: 'short', day: 'numeric' }).format(new Date(year, monthNumber - 1, Math.min(Number(dueDay) || lastDay, lastDay)))
}

function CollectionRing({ percentage, paidUnits, totalUnits }) {
  const dotCount = 80
  const totalArc = 270
  const startAngle = 135
  const filledCount = Math.round(Math.max(0, Math.min(1, percentage)) * dotCount)
  const ringRadius = 54
  const center = 66

  return (
    <View style={styles.ringContainer}>
      <View style={styles.ringWrap}>
        {Array.from({ length: dotCount }, (_, index) => {
          const angle = startAngle + (index / (dotCount - 1)) * totalArc
          const radians = (angle * Math.PI) / 180
          const isFilled = index < filledCount

          return (
            <View
              key={index}
              style={{
                position: 'absolute',
                width: 9,
                height: 9,
                borderRadius: 4.5,
                backgroundColor: isFilled ? colors.success : 'rgba(255,255,255,0.08)',
                left: center + ringRadius * Math.cos(radians) - 4.5,
                top: center + ringRadius * Math.sin(radians) - 4.5,
              }}
            />
          )
        })}
        <View style={styles.ringLabelInner}>
          <Text style={styles.ringPercentText}>{Math.round(percentage * 100)}%</Text>
          <Text style={styles.ringSubUnitsText}>{paidUnits}/{totalUnits} units</Text>
        </View>
      </View>
    </View>
  )
}

function LineSegment({ x1, y1, x2, y2, color = colors.success, strokeWidth = 2.5 }) {
  const dx = x2 - x1
  const dy = y2 - y1
  const length = Math.sqrt(dx * dx + dy * dy)
  const angle = (Math.atan2(dy, dx) * 180) / Math.PI

  return (
    <View
      style={{
        position: 'absolute',
        left: x1,
        top: y1 - strokeWidth / 2,
        width: length,
        height: strokeWidth,
        backgroundColor: color,
        borderRadius: strokeWidth / 2,
        transform: [
          { translateX: length / 2 },
          { rotate: `${angle}deg` },
          { translateX: -length / 2 },
        ],
      }}
    />
  )
}

function getCatmullRomPoints(points, containerWidth, chartHeight, numSamples = 90) {
  if (!containerWidth) return []

  const maxVal = Math.max(...points.map(p => p.amount), 1)
  const paddingX = 4
  const usableWidth = containerWidth - paddingX * 2

  let controlPts = []
  if (!points || points.length === 0) {
    controlPts = [
      { x: paddingX, y: chartHeight - 6 },
      { x: paddingX + usableWidth * 0.5, y: chartHeight - 6 },
      { x: paddingX + usableWidth, y: chartHeight - 6 },
    ]
  } else if (points.length === 1) {
    const yVal = chartHeight - (points[0].amount / maxVal) * (chartHeight - 18) - 6
    controlPts = [
      { x: paddingX, y: chartHeight - 6 },
      { x: paddingX + usableWidth * 0.5, y: yVal },
      { x: paddingX + usableWidth, y: yVal },
    ]
  } else {
    controlPts = points.map((pt, i) => {
      const x = paddingX + (i / (points.length - 1)) * usableWidth
      const y = chartHeight - (pt.amount / maxVal) * (chartHeight - 18) - 6
      return { x, y }
    })
  }

  const p = [controlPts[0], ...controlPts, controlPts[controlPts.length - 1]]
  const result = []

  const totalSegments = p.length - 3
  const samplesPerSegment = Math.max(2, Math.floor(numSamples / totalSegments))

  for (let i = 0; i < totalSegments; i++) {
    const p0 = p[i]
    const p1 = p[i + 1]
    const p2 = p[i + 2]
    const p3 = p[i + 3]

    for (let s = 0; s < samplesPerSegment; s++) {
      const t = s / samplesPerSegment
      const t2 = t * t
      const t3 = t2 * t

      const x = 0.5 * (
        (2 * p1.x) +
        (-p0.x + p2.x) * t +
        (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
        (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3
      )

      const y = 0.5 * (
        (2 * p1.y) +
        (-p0.y + p2.y) * t +
        (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
        (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3
      )

      result.push({ x, y: Math.max(4, Math.min(chartHeight, y)) })
    }
  }

  result.push(controlPts[controlPts.length - 1])
  return result
}

function CollectionTrend({ points }) {
  const [containerWidth, setContainerWidth] = useState(0)
  const chartHeight = 70
  const dateLabels = [1, 3, 5, 8, 11, 14, 17, 20, 23, 26, 29]

  const smoothCoords = useMemo(() => {
    return getCatmullRomPoints(points, containerWidth, chartHeight, 90)
  }, [containerWidth, points])

  const lastPt = smoothCoords.length ? smoothCoords[smoothCoords.length - 1] : null

  return (
    <View style={{ paddingTop: 10 }}>
      <View
        style={{ height: chartHeight + 10, width: '100%', position: 'relative', overflow: 'hidden' }}
        onLayout={e => setContainerWidth(e.nativeEvent.layout.width)}
      >
        {containerWidth > 0 && smoothCoords.length > 0 && (
          <>
            {smoothCoords.map((pt, i) => {
              if (i === smoothCoords.length - 1) return null
              const nextPt = smoothCoords[i + 1]
              const stripWidth = Math.max(1, nextPt.x - pt.x)
              const avgY = (pt.y + nextPt.y) / 2
              const fillHeight = chartHeight + 10 - avgY
              return (
                <View
                  key={`fill-${i}`}
                  style={{
                    position: 'absolute',
                    left: pt.x,
                    bottom: 0,
                    width: stripWidth + 0.6,
                    height: fillHeight,
                    backgroundColor: 'rgba(16, 185, 129, 0.14)',
                  }}
                />
              )
            })}

            {smoothCoords.map((pt, i) => {
              if (i === smoothCoords.length - 1) return null
              const nextPt = smoothCoords[i + 1]
              return <LineSegment key={`line-${i}`} x1={pt.x} y1={pt.y} x2={nextPt.x} y2={nextPt.y} color={colors.success} strokeWidth={2.5} />
            })}

            {lastPt && (
              <View
                style={{
                  position: 'absolute',
                  left: lastPt.x - 5,
                  top: lastPt.y - 5,
                  width: 10,
                  height: 10,
                  borderRadius: 5,
                  backgroundColor: colors.success,
                  borderWidth: 2,
                  borderColor: '#fff',
                  shadowColor: colors.success,
                  shadowOffset: { width: 0, height: 0 },
                  shadowOpacity: 0.8,
                  shadowRadius: 6,
                  elevation: 4,
                }}
              />
            )}
          </>
        )}
      </View>

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 4, paddingTop: 8 }}>
        {dateLabels.map(day => (
          <Text key={day} style={{ color: '#4B5563', fontSize: 10, fontWeight: '500' }}>{day}</Text>
        ))}
      </View>
    </View>
  )
}

export default function CollectionsScreen() {
  const { profile } = useAuth()
  const navigation = useNavigation()
  const [rows, setRows] = useState([])
  const [buildingName, setBuildingName] = useState('Your building')
  const [maintenanceDueDay, setMaintenanceDueDay] = useState(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')
  const [viewingProofFor, setViewingProofFor] = useState(null)
  const [proofModalUrl, setProofModalUrl] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [exporting, setExporting] = useState(false)
  const [sendingReminders, setSendingReminders] = useState(false)
  const month = currentMonthStr()

  async function loadData() {
    if (!profile?.building_id) return
    setLoading(true)
    const [flatsResult, duesResult, buildingResult] = await Promise.all([
      supabase.from('flats').select('id, flat_number, maintenance_amount, maintenance_payer').eq('building_id', profile.building_id).order('flat_number'),
      supabase.from('dues').select('*').eq('month', month).eq('building_id', profile.building_id),
      supabase.from('buildings').select('name, maintenance_due_day').eq('id', profile.building_id).maybeSingle(),
    ])
    const flatIds = (flatsResult.data || []).map(flat => flat.id)
    const residentsResult = flatIds.length
      ? await supabase.from('profiles').select('flat_id, full_name, ownership, id, push_token').in('flat_id', flatIds)
      : { data: [] }
    const duesByFlat = new Map((duesResult.data || []).map(due => [due.flat_number, due]))
    const residentsByFlat = new Map()
      ; (residentsResult.data || []).forEach(resident => {
        const residents = residentsByFlat.get(resident.flat_id) || []
        residents.push(resident)
        residentsByFlat.set(resident.flat_id, residents)
      })
    setRows((flatsResult.data || []).map(flat => ({ ...flat, residents: residentsByFlat.get(flat.id) || [], due: duesByFlat.get(flat.flat_number) || null })))
    setBuildingName(buildingResult.data?.name || 'Your building')
    setMaintenanceDueDay(buildingResult.data?.maintenance_due_day || null)
    setLoading(false)
  }

  useEffect(() => { loadData() }, [profile?.building_id])

  async function generateDuesForAll() {
    const missingAmounts = rows.filter(row => Number(row.maintenance_amount) <= 0)
    if (missingAmounts.length) {
      const msg = `Set maintenance amounts for all flats in Maintenance Setup before generating dues. (${missingAmounts.length} flat(s) missing amount)`
      setError(msg)
      Alert.alert('Maintenance Amount Required', msg)
      return
    }
    setGenerating(true)
    setError('')
    const dueDate = dueDateForMonth(month, maintenanceDueDay)
    const { error: upsertError } = await supabase.from('dues').upsert(
      rows.map(row => ({ flat_number: row.flat_number, month, due_date: dueDate, maintenance: Number(row.maintenance_amount), total: Number(row.maintenance_amount), status: 'pending', building_id: profile.building_id })),
      { onConflict: 'building_id,flat_number,month', ignoreDuplicates: true }
    )
    if (upsertError) {
      setError(upsertError.message)
      Alert.alert('Could Not Generate Dues', upsertError.message)
    } else {
      Alert.alert('Success', `Monthly dues generated for ${monthLabel(month)}.`)
    }
    await loadData()
    setGenerating(false)
  }

  async function sendOverdueReminders() {
    const overdueRows = rows.filter(row => row.due?.status === 'pending')

    if (!overdueRows.length) {
      Alert.alert('No Overdue Dues', 'No pending maintenance dues right now.')
      return
    }

    const tokens = overdueRows.flatMap(row => row.residents.map(r => r.push_token).filter(Boolean))
    if (!tokens.length) {
      Alert.alert('No Reminders Sent', 'None of the overdue residents have notifications enabled yet.')
      return
    }

    setSendingReminders(true)
    try {
      const res = await fetch('https://eebzdurarsyuqbdtwswl.supabase.co/functions/v1/send-push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tokens,
          title: 'Maintenance Payment Reminder',
          body: `Your maintenance for ${monthLabel(month)} is still pending — please pay at your earliest convenience.`,
        }),
      })
      const result = await res.json()
      Alert.alert('Reminders Sent', `Sent to ${result.sent || 0} device(s) across ${overdueRows.length} overdue flat(s).`)
    } catch (err) {
      Alert.alert('Could Not Send Reminders', err.message)
    }
    setSendingReminders(false)
  }

  async function markPaid(due, flatNumber, maintenanceAmount) {
    if (due?.id) {
      const paidAt = new Date().toISOString()
      const { error: settleError } = await supabase
        .from('dues')
        .update({ status: 'paid', paid_at: paidAt })
        .eq('building_id', profile.building_id)
        .eq('flat_number', flatNumber)
        .lte('month', month)
        .neq('status', 'paid')
      if (settleError) {
        Alert.alert('Could Not Mark Paid', settleError.message)
        return
      }
      await supabase.from('dues').update({ proof_url: null }).eq('id', due.id)
      if (due.proof_url) {
        const { error: storageError } = await supabase.storage.from('payment-proofs').remove([due.proof_url])
        if (storageError) console.log('Could not delete proof file:', storageError.message)
      }
    } else if (flatNumber) {
      const amount = Number(maintenanceAmount || 0)
      await supabase.from('dues').upsert({
        flat_number: flatNumber,
        month,
        maintenance: amount,
        total: amount,
        due_date: dueDateForMonth(month, maintenanceDueDay),
        building_id: profile.building_id,
        status: 'paid',
        paid_at: new Date().toISOString(),
      }, { onConflict: 'building_id,flat_number,month' })
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
    const datedPayments = paid.filter(row => row.due?.paid_at).sort((a, b) => new Date(a.due.paid_at) - new Date(b.due.paid_at))
    let runningTotal = 0
    const trend = datedPayments.map(row => {
      runningTotal += amountFor(row)
      return { amount: runningTotal, label: new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short' }).format(new Date(row.due.paid_at)) }
    })
    const lastEntry = datedPayments.length ? amountFor(datedPayments[datedPayments.length - 1]) : 0
    return { totalUnits: rows.length, paid: paid.length, pending: rows.length - paid.length, collected, expected, trend, lastEntry }
  }, [rows])

  const filteredRows = rows.filter(row => {
    const query = searchQuery.trim().toLowerCase()
    if (query) {
      const residentNames = row.residents.map(r => r.full_name || '').join(' ').toLowerCase()
      const searchTarget = `${row.flat_number} ${residentNames}`
      if (!searchTarget.includes(query)) return false
    }
    if (statusFilter === 'not_generated') return !row.due
    if (statusFilter === 'paid') return row.due?.status === 'paid'
    if (statusFilter === 'pending') return row.due && row.due.status !== 'paid'
    return true
  })
  const filters = [{ key: 'all', label: 'All' }, { key: 'paid', label: 'Paid' }, { key: 'pending', label: 'Pending' }, { key: 'not_generated', label: 'Not generated' }]

  if (loading) return <View style={styles.centered}><ActivityIndicator color={colors.success} /><Text style={styles.loadingText}>Loading collections…</Text></View>

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Collection</Text>
          <Text style={styles.subtitle}>{buildingName} · {monthLabel(month)}</Text>
        </View>
        <TouchableOpacity style={styles.headerIcon} onPress={() => navigation.navigate('CollectionHistory')}>
  <Ionicons name="time-outline" size={18} color={colors.success} />
</TouchableOpacity>
      </View>

      <View style={[styles.card, styles.summaryCard]}>
        <CollectionRing percentage={metrics.totalUnits ? metrics.paid / metrics.totalUnits : 0} paidUnits={metrics.paid} totalUnits={metrics.totalUnits} />
        <View style={styles.summaryInfo}>
          <Text style={styles.eyebrow}>COLLECTED</Text>
          <Text style={styles.bigAmount}>{formatMoney(metrics.collected)}</Text>
          <Text style={styles.expected}>of {formatMoney(metrics.expected)} expected</Text>
          <View style={styles.statusLine}>
            <View style={[styles.dot, { backgroundColor: colors.success }]} />
            <Text style={styles.statusText}>{metrics.paid} paid on time</Text>
          </View>
          <View style={styles.statusLine}>
            <View style={[styles.dot, { backgroundColor: colors.warning }]} />
            <Text style={styles.statusText}>{metrics.pending} pending</Text>
          </View>
          <View style={styles.statusLine}>
            <View style={[styles.dot, { backgroundColor: '#4B5563' }]} />
            <Text style={styles.dueText}>Due {dueDateLabel(month, maintenanceDueDay)}</Text>
          </View>
        </View>
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitleHeader}>COLLECTION TREND</Text>
        {metrics.lastEntry > 0 ? (
          <Text style={styles.lastEntryText}>+{formatMoney(metrics.lastEntry)} last entry</Text>
        ) : null}
      </View>
      <View style={[styles.card, styles.chartCard]}>
        <Text style={styles.eyebrow}>CUMULATIVE · {monthLabel(month).split(' ')[0].toUpperCase()}</Text>
        <Text style={styles.chartAmount}>{formatMoney(metrics.collected)}</Text>
        <CollectionTrend points={metrics.trend} />
      </View>

      <View style={styles.actionRow}>
        <TouchableOpacity style={styles.generateButton} onPress={generateDuesForAll} disabled={generating}>
          <Ionicons name="add-circle-outline" size={17} color={colors.text} />
          <Text style={styles.generateText}>{generating ? 'Generating…' : 'Generate monthly dues'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.exportButton} onPress={exportCSV} disabled={exporting}>
          <Ionicons name="download-outline" size={18} color={colors.text} />
        </TouchableOpacity>
      </View>

      <View style={styles.actionRow}>
        <TouchableOpacity style={styles.generateButton} onPress={sendOverdueReminders} disabled={sendingReminders}>
          <Ionicons name="notifications-outline" size={17} color={colors.text} />
          <Text style={styles.generateText}>{sendingReminders ? 'Sending…' : 'Remind unpaid residents'}</Text>
        </TouchableOpacity>
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <TextInput style={styles.searchInput} placeholder="Search flat or resident…" placeholderTextColor={colors.textFaint} value={searchQuery} onChangeText={setSearchQuery} />
      <View style={styles.filterRow}>{filters.map(filter => <TouchableOpacity key={filter.key} style={statusFilter === filter.key ? styles.filterActive : styles.filter} onPress={() => setStatusFilter(filter.key)}><Text style={statusFilter === filter.key ? styles.filterTextActive : styles.filterText}>{filter.label}</Text></TouchableOpacity>)}</View>

      <Text style={styles.sectionTitle}>Unit payment status</Text>
      {filteredRows.map(row => {
        const paid = row.due?.status === 'paid'
        const submitted = row.due?.status === 'submitted'
        const statusColor = paid ? colors.success : submitted ? colors.warning : colors.danger
        const statusBackground = paid ? colors.successBg : submitted ? colors.warningBg : colors.dangerBg
        const residentNames = row.residents.map(resident => `${resident.full_name || 'Resident'} (${resident.ownership || 'resident'})`).join(' · ')
        const bottomText = paid
          ? (row.due?.paid_at ? `Paid at ${new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short' }).format(new Date(row.due.paid_at))}` : 'Paid')
          : submitted
            ? 'Awaiting approval'
            : 'Awaiting payment'

        return <View key={row.id} style={styles.unitCard}><View style={[styles.flatBadge, { backgroundColor: statusBackground }]}><Text style={[styles.flatBadgeText, { color: statusColor }]}>{row.flat_number}</Text></View><View style={styles.unitInfo}><Text style={styles.residentName} numberOfLines={1}>{residentNames || 'Resident not assigned'}</Text><Text style={[styles.amountMeta, { color: paid ? colors.success : submitted ? colors.warning : colors.textTertiary }]}>{bottomText}</Text></View><View style={styles.unitActions}>{paid ? <Ionicons name="checkmark-circle" size={26} color={colors.success} /> : <TouchableOpacity style={[styles.markButton, { backgroundColor: statusBackground }]} onPress={() => markPaid(row.due, row.flat_number, row.maintenance_amount)}><Text style={[styles.markButtonText, { color: statusColor }]}>{submitted ? 'Approve' : 'Mark paid'}</Text></TouchableOpacity>}{submitted && row.due?.proof_url ? <TouchableOpacity onPress={() => viewProof(row.due)} disabled={viewingProofFor === row.due.id}><Text style={styles.proofText}>{viewingProofFor === row.due.id ? 'Opening…' : 'Proof'}</Text></TouchableOpacity> : null}</View></View>
      })}

      {!filteredRows.length && <Text style={styles.empty}>No flats match this search or filter.</Text>}

      <Modal visible={!!proofModalUrl} transparent animationType="fade" onRequestClose={() => setProofModalUrl(null)}><View style={styles.modalOverlay}><TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setProofModalUrl(null)} />{proofModalUrl && <Image source={{ uri: proofModalUrl }} style={styles.modalImage} resizeMode="contain" />}<TouchableOpacity style={styles.closeButton} onPress={() => setProofModalUrl(null)}><Text style={styles.closeButtonText}>Close</Text></TouchableOpacity></View></Modal>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.bg },
  content: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxxl,
  },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  loadingText: { color: colors.textSecondary, marginTop: 10 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.sm, marginBottom: spacing.xl },
  title: { color: colors.text, fontSize: 28, fontWeight: '800', letterSpacing: -0.7 },
  subtitle: { color: colors.textSecondary, marginTop: 4, fontSize: 13 },
  headerIcon: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.successBg, borderWidth: 1, borderColor: 'rgba(16,185,129,0.28)' },
  card: { backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, ...shadow.card },
  summaryCard: { flexDirection: 'row', alignItems: 'center', padding: 16, marginBottom: spacing.xl },
  ringContainer: { width: 132, height: 132, alignItems: 'center', justifyContent: 'center' },
  ringWrap: { width: 132, height: 132, position: 'relative', alignItems: 'center', justifyContent: 'center' },
  ringLabelInner: { alignItems: 'center', justifyContent: 'center' },
  ringPercentText: { fontSize: 28, fontWeight: '800', color: colors.text },
  ringSubUnitsText: { fontSize: 11, color: colors.textTertiary, marginTop: 1 },
  summaryInfo: { flex: 1, marginLeft: 14 },
  eyebrow: { color: colors.textTertiary, fontSize: 10.5, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase' },
  bigAmount: { color: colors.text, fontSize: 25, fontWeight: '800', letterSpacing: -0.5, marginTop: 2 },
  expected: { color: colors.textTertiary, fontSize: 11.5, marginTop: 2, marginBottom: 8 },
  statusLine: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  dot: { width: 6, height: 6, borderRadius: 3, marginRight: 8 },
  statusText: { color: colors.textSecondary, fontSize: 12, fontWeight: '600' },
  dueText: { color: colors.textTertiary, fontSize: 12, fontWeight: '500' },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  sectionTitle: { color: colors.text, fontSize: 15, fontWeight: '700', marginBottom: 10 },
  sectionTitleHeader: { color: colors.textTertiary, fontSize: 11, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 10 },
  lastEntryText: { color: colors.success, fontSize: 12, fontWeight: '700', marginBottom: 10 },
  chartCard: { padding: spacing.lg, marginBottom: spacing.xl },
  chartAmount: { color: colors.text, fontSize: 27, fontWeight: '800', marginTop: 3, marginBottom: 4, letterSpacing: -0.5 },
  actionRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  generateButton: { flex: 1, minHeight: 46, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, backgroundColor: colors.accent, borderRadius: radius.md },
  generateText: { color: colors.text, fontWeight: '700', fontSize: 13 },
  exportButton: { width: 46, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.borderStrong },
  error: { color: colors.danger, fontSize: 12, marginBottom: 10 },
  searchInput: { color: colors.text, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 13, paddingVertical: 12, fontSize: 13.5, marginTop: 4, marginBottom: 10 },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: spacing.xl },
  filter: { paddingVertical: 7, paddingHorizontal: 12, borderRadius: radius.pill, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  filterActive: { paddingVertical: 7, paddingHorizontal: 12, borderRadius: radius.pill, backgroundColor: colors.accent },
  filterText: { color: colors.textSecondary, fontSize: 12, fontWeight: '600' },
  filterTextActive: { color: colors.text, fontSize: 12, fontWeight: '700' },
  unitCard: { minHeight: 74, flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: radius.lg, marginBottom: 9, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  flatBadge: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  flatBadgeText: { fontSize: 11, fontWeight: '800' },
  unitInfo: { flex: 1, marginLeft: 11 },
  residentName: { color: colors.text, fontSize: 16, fontWeight: '700' },
  statusMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  unitMeta: { fontSize: 11, fontWeight: '600' },
  amountMeta: { color: colors.textTertiary, fontSize: 12, marginTop: 2, fontWeight: '500' },
  unitActions: { alignItems: 'flex-end', gap: 4 },
  markButton: { paddingVertical: 6, paddingHorizontal: 9, borderRadius: 8 },
  markButtonText: { fontSize: 11, fontWeight: '700' },
  proofText: { color: colors.accent, fontSize: 11, fontWeight: '700' },
  empty: { color: colors.textSecondary, textAlign: 'center', paddingVertical: 24 },
  modalOverlay: { flex: 1, backgroundColor: colors.overlay, alignItems: 'center', justifyContent: 'center' },
  modalImage: { width: '92%', height: '75%' },
  closeButton: { marginTop: 20, backgroundColor: 'rgba(255,255,255,0.15)', paddingVertical: 10, paddingHorizontal: 24, borderRadius: 8 },
  closeButtonText: { color: '#fff', fontWeight: '700', fontSize: 14 },
})
