import { useEffect, useState } from 'react'
import { View, Text, TouchableOpacity, TextInput, StyleSheet, ScrollView, Linking, Alert } from 'react-native'
import * as Clipboard from 'expo-clipboard'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { colors, spacing, radius, type, NOTICE_CATEGORY_TONES } from '../lib/theme'
import { generateReceipt } from '../lib/receipt'
import { pickAndUploadProof } from '../lib/paymentProof'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import EmptyState from '../components/ui/EmptyState'
import { DuesCardSkeleton, RowSkeleton } from '../components/ui/Skeleton'

const BUILDING_UPI_ID = 'club-pilot@upi'
const BUILDING_UPI_NAME = 'Madhuvan Apartment'

const CATEGORIES = ['plumbing', 'electrical', 'security', 'cleanliness', 'other']

export default function HomeScreen({ navigation }) {
  const { profile, signOut } = useAuth()
  const [currentDue, setCurrentDue] = useState(null)
  const [duesLoading, setDuesLoading] = useState(true)
  const [tickets, setTickets] = useState([])
  const [ticketsLoading, setTicketsLoading] = useState(true)
  const [notices, setNotices] = useState([])
  const [noticesLoading, setNoticesLoading] = useState(true)
  const [openNoticeId, setOpenNoticeId] = useState(null)
  const [showPayPanel, setShowPayPanel] = useState(false)
  const [showTicketForm, setShowTicketForm] = useState(false)
  const [ticketCategory, setTicketCategory] = useState('plumbing')
  const [ticketDescription, setTicketDescription] = useState('')
  const [submittingTicket, setSubmittingTicket] = useState(false)
  const [uploadingProof, setUploadingProof] = useState(false)

  function loadTickets() {
    setTicketsLoading(true)
    supabase
      .from('tickets')
      .select('*')
      .eq('raised_by', profile.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setTickets(data || [])
        setTicketsLoading(false)
      })
  }

  function loadEverything() {
    const firstOfMonth = new Date()
    firstOfMonth.setDate(1)
    const monthStr = firstOfMonth.toISOString().slice(0, 10)

    setDuesLoading(true)
    supabase
      .from('dues')
      .select('*')
      .eq('flat_number', profile.flat_number)
      .eq('month', monthStr)
      .maybeSingle()
      .then(({ data }) => {
        setCurrentDue(data)
        setDuesLoading(false)
      })

    loadTickets()

    setNoticesLoading(true)
    supabase
      .from('notices')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5)
      .then(({ data }) => {
        setNotices(data || [])
        setNoticesLoading(false)
      })
  }

  useEffect(() => {
    if (profile) loadEverything()
  }, [profile])

  async function handleRaiseTicket() {
    if (!ticketDescription.trim()) return
    setSubmittingTicket(true)
    await supabase.from('tickets').insert({
      raised_by: profile.id,
      flat_number: profile.flat_number,
      category: ticketCategory,
      description: ticketDescription,
      building_id: profile.building_id,
    })
    setTicketDescription('')
    setShowTicketForm(false)
    loadTickets()
    setSubmittingTicket(false)
  }

  async function copyUpiId() {
    await Clipboard.setStringAsync(BUILDING_UPI_ID)
    Alert.alert('Copied', 'UPI ID copied to clipboard')
  }

  function openUpiApp() {
    const url = `upi://pay?pa=${BUILDING_UPI_ID}&pn=${encodeURIComponent(BUILDING_UPI_NAME)}&am=${currentDue.total}&cu=INR&tn=${encodeURIComponent('Maintenance - Flat ' + profile.flat_number)}`
    Linking.openURL(url).catch(() => Alert.alert('No UPI app found', 'Install GPay or PhonePe to pay directly, or copy the UPI ID instead.'))
  }

  async function downloadReceipt() {
    await generateReceipt(currentDue, profile)
  }

  async function handleUploadProof() {
    setUploadingProof(true)
    try {
      const path = await pickAndUploadProof(currentDue, profile)
      if (path) {
        Alert.alert('Uploaded', 'Your payment proof was submitted. The committee will confirm it soon.')
        loadEverything()
      }
    } catch (err) {
      Alert.alert('Could not upload proof', err.message)
    }
    setUploadingProof(false)
  }

  if (!profile) {
    return (
      <View style={styles.centerFill}>
        <Text style={{ marginBottom: 16, ...type.bodyMuted }}>Loading your flat details…</Text>
        <Button label="Taking too long? Sign out" onPress={signOut} variant="outline" />
      </View>
    )
  }

  const openTickets = tickets.filter(t => t.status !== 'done')

  return (
    <ScrollView style={styles.page} contentContainerStyle={{ padding: spacing.xl }}>
      <Text style={type.display}>Hi {profile.full_name?.split(' ')[0]}</Text>
      <Text style={[type.bodyMuted, { marginTop: 2, marginBottom: spacing.xl }]}>Flat {profile.flat_number}</Text>

      {/* Dues */}
      {duesLoading ? (
        <DuesCardSkeleton />
      ) : (
        <Card dark featured>
          {currentDue ? (
            <>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                <Text style={styles.duesLabel}>Maintenance</Text>
                <Badge
                  label={currentDue.status}
                  tone={currentDue.status === 'paid' ? 'success' : currentDue.status === 'submitted' ? 'warning' : 'cove'}
                />
              </View>
              <Text style={styles.duesAmount}>₹{currentDue.total}</Text>

              {currentDue.status === 'paid' ? (
                <Button label="Download receipt →" onPress={downloadReceipt} variant="outline" style={styles.onDarkOutline} textStyle={{ color: colors.white }} />
              ) : currentDue.status === 'submitted' ? (
                <View style={styles.awaitingBox}>
                  <Text style={styles.awaitingText}>
                    Payment proof submitted{currentDue.proof_uploaded_at ? ` on ${new Date(currentDue.proof_uploaded_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}` : ''} — awaiting committee confirmation.
                  </Text>
                  <Button
                    label={uploadingProof ? 'Uploading…' : 'Re-upload proof'}
                    onPress={handleUploadProof}
                    loading={uploadingProof}
                    variant="outline"
                    style={[styles.onDarkOutline, { marginTop: spacing.sm }]}
                    textStyle={{ color: colors.white }}
                  />
                </View>
              ) : (
                <>
                  <Button label={showPayPanel ? 'Hide payment details' : 'Pay now →'} onPress={() => setShowPayPanel(!showPayPanel)} variant="primary" />

                  {showPayPanel && (
                    <View style={styles.payPanel}>
                      <Text style={styles.payPanelLabel}>Pay via UPI to:</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
                        <Text style={styles.upiId}>{BUILDING_UPI_ID}</Text>
                        <TouchableOpacity style={styles.copyBtn} onPress={copyUpiId}>
                          <Text style={styles.copyBtnText}>Copy</Text>
                        </TouchableOpacity>
                      </View>
                      <Button label="Open in UPI app →" onPress={openUpiApp} variant="primary" />
                      <Text style={styles.payNote}>
                        Opens GPay/PhonePe if installed. Once paid, the committee will mark it as received.
                      </Text>
                    </View>
                  )}

                  <Button
                    label={uploadingProof ? 'Uploading…' : 'Upload payment proof'}
                    onPress={handleUploadProof}
                    loading={uploadingProof}
                    variant="outline"
                    style={[styles.onDarkOutline, { marginTop: spacing.md }]}
                    textStyle={{ color: colors.white }}
                  />
                </>
              )}

              <Button
                label="View payment history →"
                onPress={() => navigation.navigate('PaymentHistory')}
                variant="ghost"
                textStyle={{ color: '#CFE0DC' }}
                style={{ marginTop: spacing.md, paddingHorizontal: 0 }}
              />
            </>
          ) : (
            <Text style={styles.duesLabel}>No dues generated yet for this month.</Text>
          )}
        </Card>
      )}

      {/* Tickets */}
      <Card>
        <Text style={type.eyebrow}>Your open requests</Text>

        {ticketsLoading ? (
          <>
            <RowSkeleton />
            <RowSkeleton />
          </>
        ) : openTickets.length === 0 ? (
          <EmptyState title="No open tickets" subtitle="Anything not working? Raise it here and the committee gets notified." />
        ) : (
          openTickets.map(t => (
            <View key={t.id} style={styles.row}>
              <Text style={styles.rowTitle}>{t.description || t.category}</Text>
              <Badge label={t.status} tone={t.status === 'in_progress' ? 'warning' : 'neutral'} />
            </View>
          ))
        )}

        <Button
          label={showTicketForm ? 'Cancel' : '+ Raise a complaint'}
          onPress={() => setShowTicketForm(!showTicketForm)}
          variant="outline"
          style={{ marginTop: spacing.md }}
        />

        {showTicketForm && (
          <View style={{ marginTop: spacing.md }}>
            <View style={styles.categoryRow}>
              {CATEGORIES.map(c => (
                <TouchableOpacity
                  key={c}
                  style={ticketCategory === c ? styles.categoryChipActive : styles.categoryChip}
                  onPress={() => setTicketCategory(c)}
                >
                  <Text style={ticketCategory === c ? styles.categoryChipTextActive : styles.categoryChipText}>{c}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TextInput
              style={styles.textArea}
              placeholder="What's the issue?"
              placeholderTextColor={colors.textFaint}
              value={ticketDescription}
              onChangeText={setTicketDescription}
              multiline
            />
            <Button
              label={submittingTicket ? 'Submitting…' : 'Submit'}
              onPress={handleRaiseTicket}
              disabled={submittingTicket}
              loading={submittingTicket}
              style={{ alignSelf: 'stretch' }}
            />
          </View>
        )}
      </Card>

      {/* Notices */}
      <Card>
        <Text style={type.eyebrow}>Notices</Text>

        {noticesLoading ? (
          <>
            <RowSkeleton />
            <RowSkeleton />
          </>
        ) : notices.length === 0 ? (
          <EmptyState title="No notices yet" subtitle="Committee announcements will show up here." />
        ) : (
          notices.map(n => {
            const isOpen = openNoticeId === n.id
            return (
              <TouchableOpacity key={n.id} style={styles.row} onPress={() => setOpenNoticeId(isOpen ? null : n.id)}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', width: '100%' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexShrink: 1 }}>
                    <Badge label={n.category || 'general'} tone={NOTICE_CATEGORY_TONES[n.category] || 'neutral'} />
                    <Text style={styles.rowTitle}>{n.title}</Text>
                  </View>
                  <Text style={type.caption}>{isOpen ? '▲' : '▼'}</Text>
                </View>
                <Text style={type.caption}>{new Date(n.created_at).toLocaleDateString()}</Text>
                {isOpen && <Text style={styles.noticeBody}>{n.body || 'No additional details.'}</Text>}
              </TouchableOpacity>
            )
          })
        )}
      </Card>

      <Button label="Sign out" onPress={signOut} variant="outline" style={{ alignSelf: 'stretch', marginTop: spacing.xs, marginBottom: spacing.xxl }} />
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.paper },
  centerFill: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },

  duesLabel: { fontSize: 11, color: '#A9BCB7', textTransform: 'uppercase', fontWeight: '700', marginRight: spacing.sm },
  duesAmount: { fontSize: 32, fontWeight: '700', color: colors.paper, marginBottom: spacing.md },
  onDarkOutline: { borderColor: colors.inkFaint },
  awaitingBox: { backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: radius.md, padding: spacing.md },
  awaitingText: { fontSize: 12.5, color: '#CFE0DC', lineHeight: 18 },

  payPanel: { marginTop: spacing.md, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: radius.md, padding: spacing.md },
  payPanelLabel: { fontSize: 11, color: '#A9BCB7', marginBottom: 6 },
  upiId: { backgroundColor: 'rgba(0,0,0,0.25)', color: colors.paper, padding: 8, borderRadius: 6, fontSize: 13, marginRight: 8 },
  copyBtn: { borderWidth: 1, borderColor: colors.inkFaint, borderRadius: 6, paddingVertical: 5, paddingHorizontal: 10 },
  copyBtnText: { color: '#CFE0DC', fontSize: 11.5 },
  payNote: { fontSize: 11, color: '#A9BCB7', marginTop: spacing.md, lineHeight: 16 },

  row: { paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rowTitle: { fontWeight: '600', fontSize: 13.5, color: colors.ink, flexShrink: 1, marginRight: spacing.sm },
  noticeBody: { fontSize: 13, color: colors.ink, marginTop: 6, lineHeight: 18 },

  categoryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: spacing.sm },
  categoryChip: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill, paddingVertical: 6, paddingHorizontal: 12 },
  categoryChipActive: { backgroundColor: colors.ink, borderRadius: radius.pill, paddingVertical: 6, paddingHorizontal: 12 },
  categoryChipText: { fontSize: 12, color: colors.ink },
  categoryChipTextActive: { fontSize: 12, color: colors.white },
  textArea: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, fontSize: 13, minHeight: 70, textAlignVertical: 'top', marginBottom: spacing.sm, color: colors.ink },
})