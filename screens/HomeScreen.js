import { useEffect, useState, useMemo } from 'react'
import { View, Text, TouchableOpacity, TextInput, StyleSheet, ScrollView, Linking, Alert, Modal, Image } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import * as Clipboard from 'expo-clipboard'
import { SafeAreaView } from 'react-native-safe-area-context'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'

import { NOTICE_CATEGORY_TONES } from '../lib/theme'

import { generateReceipt } from '../lib/receipt'
import { pickAndUploadProof } from '../lib/paymentProof'
import { pickAndUploadRentProof } from '../lib/rentProof'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import EmptyState from '../components/ui/EmptyState'
import { DuesCardSkeleton, RowSkeleton } from '../components/ui/Skeleton'
import {
    colors as themeColors,
    spacing,
    radius,
    type,
    shadow
} from '../lib/theme'
const BUILDING_UPI_ID = 'club-pilot@upi'
const BUILDING_UPI_NAME = 'Madhuvan Apartment'

const CATEGORIES = ['plumbing', 'electrical', 'security', 'cleanliness', 'other']

export default function HomeScreen({ navigation }) {
  const { profile, signOut } = useAuth()

  const styles = useMemo(() => createStyles(), [])

  const palette = themeColors
  const [currentDue, setCurrentDue] = useState(null)
  const [duesLoading, setDuesLoading] = useState(true)
  const [tickets, setTickets] = useState([])
  const [ticketsLoading, setTicketsLoading] = useState(true)
  const [notices, setNotices] = useState([])
  const [noticesLoading, setNoticesLoading] = useState(true)
  const [selectedNotice, setSelectedNotice] = useState(null)
  const [showPayPanel, setShowPayPanel] = useState(false)
  const [showRentPayPanel, setShowRentPayPanel] = useState(false)
  const [showTicketForm, setShowTicketForm] = useState(false)
  const [ticketCategory, setTicketCategory] = useState('plumbing')
  const [ticketDescription, setTicketDescription] = useState('')
  const [submittingTicket, setSubmittingTicket] = useState(false)
  const [uploadingProof, setUploadingProof] = useState(false)
  const [flatInfo, setFlatInfo] = useState(null)
  const [counterpart, setCounterpart] = useState(null) // the other owner/tenant on this flat, if any

  // Rent (tenant <-> owner, independent of building maintenance)
  const [rentPayment, setRentPayment] = useState(null)
  const [rentLoading, setRentLoading] = useState(true)
  const [uploadingRentProof, setUploadingRentProof] = useState(false)
  const [confirmingRent, setConfirmingRent] = useState(false)
  const [rentProofModalUrl, setRentProofModalUrl] = useState(null)
  const [viewingRentProof, setViewingRentProof] = useState(false)

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

    if (profile.flat_id) {
      supabase
        .from('flats')
        .select('id, maintenance_payer, rent_amount, owner_upi_id')
        .eq('id', profile.flat_id)
        .maybeSingle()
        .then(({ data }) => setFlatInfo(data))

      supabase
        .from('profiles')
        .select('id, full_name, ownership')
        .eq('flat_id', profile.flat_id)
        .neq('id', profile.id)
        .maybeSingle()
        .then(({ data }) => setCounterpart(data))
    }

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

  useEffect(() => {
    if (!profile?.flat_id || !flatInfo) return
    if (!counterpart) {
      setRentPayment(null)
      setRentLoading(false)
      return
    }
    loadOrCreateRent()
  }, [profile, flatInfo, counterpart])

  async function loadOrCreateRent() {
    setRentLoading(true)
    const firstOfMonth = new Date()
    firstOfMonth.setDate(1)
    const monthStr = firstOfMonth.toISOString().slice(0, 10)

    const tenantId = profile.ownership === 'tenant' ? profile.id : counterpart.id
    const ownerId = profile.ownership === 'owner' ? profile.id : counterpart.id

    if (profile.ownership === 'tenant') {
      await supabase.from('rent_payments').upsert(
        {
          flat_id: profile.flat_id,
          tenant_id: tenantId,
          owner_id: ownerId,
          building_id: profile.building_id,
          month: monthStr,
          amount: flatInfo.rent_amount || null,
          status: 'pending',
        },
        { onConflict: 'flat_id,month', ignoreDuplicates: true }
      )
    }

    const { data, error } = await supabase
      .from('rent_payments')
      .select('*')
      .eq('flat_id', profile.flat_id)
      .eq('month', monthStr)
      .maybeSingle()

    if (error) console.log('loadOrCreateRent error:', error.message)
    setRentPayment(data)
    setRentLoading(false)
  }

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

  async function copyRentAccountDetails() {
    if (!flatInfo?.owner_upi_id) {
      Alert.alert('No details', 'No rent account details were added yet.')
      return
    }
    await Clipboard.setStringAsync(flatInfo.owner_upi_id)
    Alert.alert('Copied', 'Rent account details copied to clipboard')
  }

  function openUpiApp() {
    const url = `upi://pay?pa=${BUILDING_UPI_ID}&pn=${encodeURIComponent(BUILDING_UPI_NAME)}&am=${currentDue.total}&cu=INR&tn=${encodeURIComponent('Maintenance - Flat ' + profile.flat_number)}`
    Linking.openURL(url).catch(() => Alert.alert('No UPI app found', 'Install GPay or PhonePe to pay directly, or copy the UPI ID instead.'))
  }

  function openRentUpiApp() {
    const rentAmount = rentPayment?.amount ?? flatInfo?.rent_amount
    const rentUpiId = flatInfo?.owner_upi_id

    if (!rentUpiId) {
      Alert.alert('No rent details', 'Add the rent account or UPI details first so the payment can be opened directly.')
      return
    }

    const url = `upi://pay?pa=${encodeURIComponent(rentUpiId)}&pn=${encodeURIComponent(profile.full_name || 'Rent Payment')}&am=${rentAmount || 0}&cu=INR&tn=${encodeURIComponent('Rent - Flat ' + profile.flat_number)}`
    Linking.openURL(url).catch(() => Alert.alert('No UPI app found', 'Install GPay or PhonePe to pay directly, or copy the rent account details instead.'))
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

  async function handleUploadRentProof() {
    setUploadingRentProof(true)
    try {
      const path = await pickAndUploadRentProof(rentPayment, profile)
      if (path) {
        Alert.alert('Uploaded', 'Your rent payment proof was submitted. Your owner will confirm it soon.')
        loadOrCreateRent()
      }
    } catch (err) {
      Alert.alert('Could not upload proof', err.message)
    }
    setUploadingRentProof(false)
  }

  async function viewRentProof() {
    if (!rentPayment?.proof_url) return
    setViewingRentProof(true)
    const { data, error } = await supabase.storage
      .from('payment-proofs')
      .createSignedUrl(rentPayment.proof_url, 120)
    setViewingRentProof(false)
    if (error) {
      Alert.alert('Could not open proof', error.message)
      return
    }
    setRentProofModalUrl(data.signedUrl)
  }

  async function confirmRent() {
    if (!rentPayment) return
    setConfirmingRent(true)
    const { error } = await supabase
      .from('rent_payments')
      .update({ status: 'paid', paid_at: new Date().toISOString(), proof_url: null })
      .eq('id', rentPayment.id)

    if (!error && rentPayment.proof_url) {
      const { error: removeError } = await supabase.storage.from('payment-proofs').remove([rentPayment.proof_url])
      if (removeError) console.log('Could not delete rent proof file:', removeError.message)
    }

    setConfirmingRent(false)
    if (error) {
      Alert.alert('Could not confirm', error.message)
      return
    }
    loadOrCreateRent()
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
  const payerIsMe = profile.ownership === (flatInfo?.maintenance_payer || 'owner')
  const counterpartLabel = profile.ownership === 'owner' ? 'tenant' : 'owner'

  return (
    <SafeAreaView style={styles.page} edges={['top']}>
    <ScrollView style={styles.page} contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false}>
      <View style={styles.heroCard}>
        <View style={{ flex: 1 }}>
          <Text style={styles.heroEyebrow}>Community home</Text>
          <Text style={styles.heroTitle}>Hi, {profile.full_name?.split(' ')[0] || 'there'}</Text>
          <Text style={[type.bodyMuted, { marginTop: 6 }]}>Flat {profile.flat_number} • Everything you need is here.</Text>
        </View>
        <View style={styles.heroBadge}>
          <Text style={styles.heroBadgeText}>Resident</Text>
        </View>
      </View>

      {duesLoading ? (
        <DuesCardSkeleton />
      ) : (
        <Card dark style={styles.heroPanel}>
          {currentDue ? (
            <>
              <View style={styles.duesHeader}>
                <View style={styles.duesTitleWrap}>
                  <View style={styles.duesAccent} />
                  <Text style={styles.duesLabel}>Maintenance</Text>
                </View>
                <Badge
                  label={currentDue.status}
                  tone={currentDue.status === 'paid' ? 'success' : currentDue.status === 'submitted' ? 'warning' : 'cove'}
                />
              </View>
              <View style={styles.duesAmountRow}>
                <Text style={styles.duesAmount}>₹{currentDue.total}</Text>
                {currentDue.status === 'paid' && (
                  <Button label="Receipt" onPress={downloadReceipt} variant="outline" style={styles.receiptButton} textStyle={{ color: palette.heroText }} />
                )}
              </View>

              {currentDue.status === 'paid' ? null : currentDue.status === 'Fsubmitted' ? (
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
                    textStyle={{ color: palette.heroText }}
                  />
                </View>
              ) : (
                <>
                  {payerIsMe ? (
                    <>
                      <View style={styles.primaryActionsRow}>
                        <Button label={showPayPanel ? 'Hide payment' : 'Pay now'} onPress={() => setShowPayPanel(!showPayPanel)} variant="primary" style={styles.primaryActionButton} />
                        <Button
                          label={uploadingProof ? 'Uploading…' : 'Upload proof'}
                          onPress={handleUploadProof}
                          loading={uploadingProof}
                          variant="outline"
                          style={styles.secondaryActionButton}
                          textStyle={{ color: palette.heroText }}
                        />
                      </View>

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

                    </>
                  ) : (
                    <View style={styles.awaitingBox}>
                      <Text style={styles.awaitingText}>
                        Your {counterpartLabel} handles maintenance payment for this flat.
                      </Text>
                    </View>
                  )}
                </>
              )}

              <Button
                label="History"
                onPress={() => navigation.navigate('PaymentHistory')}
                variant="ghost"
                style={styles.paymentHistoryButton}
              />
            </>
          ) : (
            <Text style={styles.duesLabel}>No dues generated yet for this month.</Text>
          )}
        </Card>
      )}

      {!rentLoading && counterpart && (
        <Card style={styles.rentCard}>
          <View style={styles.duesHeader}>
            <View style={styles.duesTitleWrap}>
              <View style={styles.rentAccent} />
              <Text style={styles.duesLabelLarge}>Rent</Text>
            </View>
          </View>

          {profile.ownership === 'owner' ? (
            <>
              <Text style={[type.bodyMuted, { marginBottom: spacing.sm }]}>Track whether rent has been paid and confirm receipt professionally.</Text>
              <View style={styles.rentStatusBox}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text style={styles.rentAmount}>Status</Text>
                  <Badge
                    label={rentPayment?.status || 'pending'}
                    tone={rentPayment?.status === 'paid' ? 'success' : rentPayment?.status === 'submitted' ? 'warning' : 'cove'}
                  />
                </View>

                {rentPayment?.status === 'submitted' && (
                  <Button
                    label={viewingRentProof ? 'Opening…' : 'View proof'}
                    onPress={viewRentProof}
                    disabled={viewingRentProof}
                    variant="outline"
                    style={{ marginTop: spacing.sm }}
                  />
                )}

                {rentPayment?.status !== 'paid' && (
                  <Button
                    label={confirmingRent ? 'Confirming…' : 'Confirm rent received'}
                    onPress={confirmRent}
                    loading={confirmingRent}
                    variant="primary"
                    style={{ marginTop: spacing.sm, alignSelf: 'stretch' }}
                  />
                )}
              </View>
            </>
          ) : (
            <>
              <Text style={[type.bodyMuted, { marginBottom: spacing.sm }]}>Your rent status for this month.</Text>
              <View style={styles.rentStatusBox}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text style={styles.rentAmount}>Status</Text>
                  <Badge
                    label={rentPayment?.status || 'pending'}
                    tone={rentPayment?.status === 'paid' ? 'success' : rentPayment?.status === 'submitted' ? 'warning' : 'cove'}
                  />
                </View>

                {rentPayment?.status === 'paid' ? (
                  <Text style={[type.bodyMuted, { marginTop: spacing.md }]}>Rent has been paid for this month.</Text>
                ) : rentPayment?.status === 'submitted' ? (
                  <Text style={[type.bodyMuted, { marginTop: spacing.md }]}>Your payment proof is under review.</Text>
                ) : (
                  <>
                    <View style={styles.primaryActionsRow}>
                      <Button
                        label={showRentPayPanel ? 'Hide payment' : 'Pay now'}
                        onPress={() => setShowRentPayPanel(prev => !prev)}
                        variant="primary"
                        style={styles.primaryActionButton}
                      />
                      <Button
                        label={uploadingRentProof ? 'Uploading…' : 'Upload proof'}
                        onPress={handleUploadRentProof}
                        loading={uploadingRentProof}
                        variant="outline"
                        style={styles.secondaryActionButton}
                      />
                    </View>

                    {showRentPayPanel && (
                      <View style={styles.rentPayPanel}>
                        <Text style={styles.rentPayPanelLabel}>Rent amount</Text>
                        <Text style={styles.rentAmount}>₹{rentPayment?.amount ?? flatInfo?.rent_amount ?? '—'}</Text>
                        <Text style={[type.bodyMuted, { marginTop: spacing.sm }]}>Use the payment details below to settle this month’s rent.</Text>

                        <Text style={[styles.rentPayPanelLabel, { marginTop: spacing.md }]}>Account / UPI</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6 }}>
                          <Text style={styles.rentUpiText}>{flatInfo?.owner_upi_id || 'No rent account details added yet'}</Text>
                          <TouchableOpacity style={styles.rentCopyBtn} onPress={copyRentAccountDetails}>
                            <Text style={styles.rentCopyBtnText}>Copy</Text>
                          </TouchableOpacity>
                        </View>

                        <Button label="Open in UPI app →" onPress={openRentUpiApp} variant="primary" style={{ marginTop: spacing.md }} />
                        <Text style={styles.payNote}>Opens GPay/PhonePe if installed. Once paid, you can upload proof from the button above.</Text>
                      </View>
                    )}
                  </>
                )}
              </View>
            </>
          )}
        </Card>
      )}

      <Card featured style={styles.ticketsCard}>
        <View style={styles.cardHeader}>
          <View style={styles.sectionTitleWrap}>
            <View style={styles.ticketsAccent} />
            <View>
              <Text style={styles.cardTitle}>REQUESTS</Text>
            </View>
          </View>
          {!ticketsLoading && openTickets.length > 0 && (
            <View style={styles.ticketCount}>
              <Text style={styles.ticketCountText}>{openTickets.length} open</Text>
            </View>
          )}
        </View>

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
              <Text style={styles.ticketRowTitle} numberOfLines={1} ellipsizeMode="tail">{t.description || t.category}</Text>
              <Badge label={t.status} tone={t.status === 'in_progress' ? 'warning' : 'neutral'} />
            </View>
          ))
        )}

        <Button
          label={showTicketForm ? 'Cancel' : 'Raise complaint'}
          onPress={() => setShowTicketForm(!showTicketForm)}
          variant="outline"
          style={{ marginTop: spacing.sm }}
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
              placeholderTextColor={palette.textTertiary}
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

      <Card style={styles.noticesCard}>
        <View style={styles.cardHeader}>
          <View style={styles.sectionTitleWrap}>
            <View style={styles.noticesAccent} />
            <View>
              <Text style={styles.noticesTitle}>NOTICES</Text>
            </View>
          </View>
        </View>

        {noticesLoading ? (
          <>
            <RowSkeleton />
            <RowSkeleton />
          </>
        ) : notices.length === 0 ? (
          <EmptyState title="No notices yet" subtitle="Committee announcements will show up here." />
        ) : (
          notices.map(n => (
            <TouchableOpacity
              key={n.id}
              style={styles.noticeItem}
              activeOpacity={0.76}
              onPress={() => setSelectedNotice(n)}
            >
              <View style={styles.noticeItemTopRow}>
                <Badge label={n.category || 'general'} tone={NOTICE_CATEGORY_TONES[n.category] || 'neutral'} />
                <Text style={styles.noticeTimestamp}>{relativeTime(n.created_at)}</Text>
              </View>
              <View style={styles.noticeItemBody}>
                <Text style={styles.noticeItemTitle} numberOfLines={2}>{n.title || 'Untitled notice'}</Text>
                <Ionicons name="chevron-forward" size={18} color={palette.textTertiary} />
              </View>
            </TouchableOpacity>
          ))
        )}
      </Card>

      <Button label="Sign out" onPress={signOut} variant="outline" style={{ alignSelf: 'stretch', marginTop: spacing.xs, marginBottom: spacing.xxl }} />
    </ScrollView>

    <Modal
      visible={!!rentProofModalUrl}
      transparent
      animationType="fade"
      onRequestClose={() => setRentProofModalUrl(null)}
    >
      <View style={styles.modalOverlay}>
        <TouchableOpacity style={StyleSheet.absoluteFillObject} onPress={() => setRentProofModalUrl(null)} />
        {rentProofModalUrl && (
          <Image source={{ uri: rentProofModalUrl }} style={styles.modalImage} resizeMode="contain" />
        )}
        <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setRentProofModalUrl(null)}>
          <Text style={styles.modalCloseBtnText}>Close</Text>
        </TouchableOpacity>
      </View>
    </Modal>

    <Modal
      visible={!!selectedNotice}
      transparent
      animationType="fade"
      onRequestClose={() => setSelectedNotice(null)}
    >
      <View style={styles.noticeModalOverlay}>
        <TouchableOpacity style={StyleSheet.absoluteFillObject} activeOpacity={1} onPress={() => setSelectedNotice(null)} />
        {selectedNotice && (
          <View style={styles.noticeModalCard}>
            <View style={styles.noticeModalHeader}>
              <Badge label={selectedNotice.category || 'general'} tone={NOTICE_CATEGORY_TONES[selectedNotice.category] || 'neutral'} />
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Close notice"
                hitSlop={10}
                onPress={() => setSelectedNotice(null)}
                style={styles.noticeModalClose}
              >
                <Ionicons name="close" size={20} color={palette.textSecondary} />
              </TouchableOpacity>
            </View>
            <Text style={styles.noticeModalTitle}>{selectedNotice.title || 'Untitled notice'}</Text>
            <Text style={styles.noticeModalDate}>Posted {formatNoticeDate(selectedNotice.created_at)}</Text>
            <View style={styles.noticeModalDivider} />
            <Text style={styles.noticeModalBody}>{selectedNotice.body || 'No additional details were provided.'}</Text>
          </View>
        )}
      </View>
    </Modal>
    </SafeAreaView>
  )
}

const createStyles = () => {
  const palette = themeColors
  return StyleSheet.create({
  page: { flex: 1, backgroundColor: palette.bg },
  contentContainer: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.xxl },
  centerFill: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, backgroundColor: palette.bg },
  heroCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.md },
  heroEyebrow: { fontSize: 10, fontWeight: '600', color: palette.textSecondary, textTransform: 'uppercase', letterSpacing: 0.8 },
  heroTitle: { fontSize: 20, fontWeight: '700', color: palette.text, letterSpacing: -0.3, marginTop: 3 },
  heroBadge: { backgroundColor: palette.surfaceElevated, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 5 },
  heroBadgeText: { fontSize: 11, fontWeight: '600', color: palette.textSecondary },
  heroPanel: { backgroundColor: palette.surfaceElevated, borderWidth: 1, borderColor: palette.border, borderRadius: radius.lg, marginBottom: spacing.md },
  softCard: { backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border, borderRadius: radius.lg, marginBottom: spacing.md },
  ticketsCard: { backgroundColor: palette.surface, borderColor: palette.borderStrong, marginBottom: spacing.md },
  noticesCard: { backgroundColor: palette.surface, borderColor: palette.border, marginBottom: spacing.md },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.xs },
  sectionTitleWrap: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  ticketsAccent: { width: 10, height: 10, borderRadius: radius.pill, backgroundColor: palette.accent },
  noticesAccent: { width: 10, height: 10, borderRadius: radius.pill, backgroundColor: palette.warning },
  cardTitle: { fontSize: 16, fontWeight: '700', color: palette.text, letterSpacing: -0.25 },
  noticesTitle: { fontSize: 16, fontWeight: '700', color: palette.text, letterSpacing: -0.4 },
  ticketCount: { backgroundColor: palette.accentSoft, paddingHorizontal: spacing.sm, paddingVertical: 5, borderRadius: radius.pill },
  ticketCountText: { color: palette.accentPressed, fontSize: 11, fontWeight: '700' },
  sectionEyebrow: { fontSize: 10, fontWeight: '700', color: palette.textSecondary, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: spacing.xs },
  duesLabelLarge: { fontSize: 16, color: palette.text, textTransform: 'uppercase', fontWeight: '700', marginRight: spacing.sm },
  rentCard: { borderWidth: 1, borderColor: palette.border, backgroundColor: palette.surface, borderRadius: radius.lg, marginBottom: spacing.md },

  duesHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.xs },
  duesTitleWrap: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  duesAccent: { width: 10, height: 10, borderRadius: 999, backgroundColor: palette.accent },
  rentAccent: { width: 10, height: 10, borderRadius: 999, backgroundColor: palette.warning },
  duesLabel: { fontSize: 16, color: palette.text, textTransform: 'uppercase', fontWeight: '700', marginRight: spacing.sm },
  duesAmountRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
  duesAmount: { fontSize: 28, fontWeight: '700', color: palette.heroText, letterSpacing: -0.8 },
  receiptButton: { borderColor: palette.heroMuted, backgroundColor: 'transparent', paddingHorizontal: 10, paddingVertical: 6 },
  onDarkOutline: { borderColor: palette.heroMuted, backgroundColor: 'transparent' },
  primaryActionsRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm },
  primaryActionButton: { flex: 1 },
  secondaryActionButton: { flex: 1, borderColor: palette.heroMuted, backgroundColor: 'transparent' },
  paymentHistoryButton: { marginTop: spacing.xs, alignSelf: 'flex-start', paddingVertical: 2, paddingHorizontal: 0 },
  awaitingBox: { backgroundColor: palette.bg, borderRadius: radius.md, padding: spacing.md },
  awaitingText: { fontSize: 13, color: palette.heroMuted, lineHeight: 20 },

  payPanel: { marginTop: spacing.md, backgroundColor: palette.bg, borderRadius: radius.md, padding: spacing.md },
  payPanelLabel: { fontSize: 11, color: palette.heroMuted, marginBottom: 6, fontWeight: '600' },
  upiId: { flex: 1, backgroundColor: 'rgba(0,0,0,0.2)', color: palette.heroText, padding: 10, borderRadius: radius.sm, fontSize: 13, marginRight: 8, fontWeight: '500' },
  copyBtn: { borderWidth: 1, borderColor: palette.heroMuted, borderRadius: radius.sm, paddingVertical: 6, paddingHorizontal: 12 },
  copyBtnText: { color: palette.heroText, fontSize: 12, fontWeight: '600' },
  payNote: { fontSize: 12, color: palette.heroMuted, marginTop: spacing.md, lineHeight: 18 },

  row: { paddingVertical: spacing.xs, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: palette.border, flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  rowTitle: { fontWeight: '600', fontSize: 13, color: palette.text, flexShrink: 1, marginRight: spacing.sm },
  ticketRowTitle: { fontWeight: '600', fontSize: 12.5, color: palette.text, flexShrink: 1, marginRight: spacing.sm, maxWidth: '78%' },
  noticeBody: { fontSize: 12.5, color: palette.textSecondary, marginTop: 4, lineHeight: 18 },
  noticeItem: { backgroundColor: palette.surfaceMuted, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm },
  noticeItemTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
  noticeTimestamp: { fontSize: 11, color: palette.textTertiary, fontWeight: '500' },
  noticeItemBody: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  noticeItemTitle: { flex: 1, fontSize: 14, lineHeight: 20, fontWeight: '700', color: palette.text },

  categoryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: spacing.sm },
  categoryChip: { borderWidth: 1, borderColor: palette.border, borderRadius: radius.pill, paddingVertical: 6, paddingHorizontal: 12, backgroundColor: palette.chip },
  categoryChipActive: { backgroundColor: palette.chipActive, borderColor: palette.chipActive, borderRadius: radius.pill, paddingVertical: 6, paddingHorizontal: 12 },
  categoryChipText: { fontSize: 12, color: palette.chipText, fontWeight: '500' },
  categoryChipTextActive: { fontSize: 12, color: palette.chipTextActive, fontWeight: '600' },
  textArea: { borderWidth: 1, borderColor: palette.border, borderRadius: radius.md, padding: spacing.sm, fontSize: 14, minHeight: 78, textAlignVertical: 'top', marginBottom: spacing.sm, color: palette.text, backgroundColor: palette.inputBg },

  rentInput: { borderWidth: 1, borderColor: palette.border, borderRadius: radius.sm, padding: spacing.sm, fontSize: 14, marginBottom: spacing.sm, color: palette.text, backgroundColor: palette.inputBg },
  rentAmount: { fontSize: 15, fontWeight: '700', color: palette.text, letterSpacing: -0.5 },
  rentStatusBox: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: palette.border, paddingTop: spacing.md, marginTop: spacing.sm },
  rentPayPanel: { marginTop: spacing.md, backgroundColor: palette.surfaceMuted, borderRadius: radius.md, padding: spacing.md },
  rentPayPanelLabel: { fontSize: 11, color: palette.textSecondary, marginBottom: 6, fontWeight: '600' },
  rentUpiText: { flex: 1, backgroundColor: palette.inputBg, borderWidth: 1, borderColor: palette.border, color: palette.text, padding: 10, borderRadius: radius.sm, fontSize: 13, marginRight: 8 },
  rentCopyBtn: { borderWidth: 1, borderColor: palette.border, borderRadius: radius.sm, paddingVertical: 6, paddingHorizontal: 12 },
  rentCopyBtnText: { color: palette.text, fontSize: 12, fontWeight: '600' },

  modalOverlay: { flex: 1, backgroundColor: palette.overlay, alignItems: 'center', justifyContent: 'center' },
  modalImage: { width: '92%', height: '75%', borderRadius: radius.md },
  modalCloseBtn: { marginTop: 20, backgroundColor: palette.surfaceElevated, paddingVertical: 12, paddingHorizontal: 28, borderRadius: radius.md },
  modalCloseBtnText: { color: palette.text, fontWeight: '600', fontSize: 15 },
  noticeModalOverlay: { flex: 1, backgroundColor: 'rgba(2, 6, 23, 0.72)', padding: spacing.xl, justifyContent: 'center' },
  noticeModalCard: { backgroundColor: palette.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: palette.borderStrong, padding: spacing.xl, ...shadow.card },
  noticeModalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.lg },
  noticeModalClose: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.surfaceMuted },
  noticeModalTitle: { fontSize: 22, lineHeight: 29, fontWeight: '700', letterSpacing: -0.45, color: palette.text },
  noticeModalDate: { fontSize: 12, color: palette.textTertiary, marginTop: spacing.sm },
  noticeModalDivider: { height: StyleSheet.hairlineWidth, backgroundColor: palette.border, marginVertical: spacing.lg },
  noticeModalBody: { fontSize: 15, lineHeight: 23, color: palette.textSecondary },
  })
}

function relativeTime(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const diffMinutes = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60000))
  if (diffMinutes < 1) return 'Just now'
  if (diffMinutes < 60) return `${diffMinutes} min ago`
  const diffHours = Math.floor(diffMinutes / 60)
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`
  if (diffHours < 48) return 'Yesterday'
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

function formatNoticeDate(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'recently'
  return date.toLocaleString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit'
  })
}
