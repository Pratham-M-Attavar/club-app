import { useEffect, useState, useMemo } from 'react'
import { View, Text, TouchableOpacity, TextInput, StyleSheet, ScrollView, Linking, Alert, Modal, Image } from 'react-native'
import * as Clipboard from 'expo-clipboard'
import { SafeAreaView } from 'react-native-safe-area-context'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { useTheme } from '../lib/ThemeContext'
import { spacing, radius, NOTICE_CATEGORY_TONES } from '../lib/theme'

import { generateReceipt } from '../lib/receipt'
import { pickAndUploadProof } from '../lib/paymentProof'
import { pickAndUploadRentProof } from '../lib/rentProof'
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
  const { theme } = useTheme()
  const styles = useMemo(() => createStyles(theme), [theme])
  const type = theme.type
  const colors = theme.colors
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
  const [flatInfo, setFlatInfo] = useState(null) // { id, maintenance_payer }
  const [counterpart, setCounterpart] = useState(null) // the other owner/tenant on this flat, if any
  const [updatingPayer, setUpdatingPayer] = useState(false)

  // Rent (tenant <-> owner, independent of building maintenance)
  const [rentPayment, setRentPayment] = useState(null)
  const [rentLoading, setRentLoading] = useState(true)
  const [showRentPayPanel, setShowRentPayPanel] = useState(false)
  const [uploadingRentProof, setUploadingRentProof] = useState(false)
  const [rentAmountInput, setRentAmountInput] = useState('')
  const [rentUpiInput, setRentUpiInput] = useState('')
  const [savingRentSettings, setSavingRentSettings] = useState(false)
  const [rentSettingsPrefilled, setRentSettingsPrefilled] = useState(false)
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

  useEffect(() => {
    if (profile?.ownership === 'owner' && flatInfo && !rentSettingsPrefilled) {
      setRentAmountInput(flatInfo.rent_amount ? String(flatInfo.rent_amount) : '')
      setRentUpiInput(flatInfo.owner_upi_id || '')
      setRentSettingsPrefilled(true)
    }
  }, [profile, flatInfo, rentSettingsPrefilled])

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

  async function saveRentSettings() {
    if (!flatInfo) return
    const amount = parseFloat(rentAmountInput)
    if (!amount || amount <= 0) {
      Alert.alert('Enter a valid amount', 'Rent amount should be a positive number.')
      return
    }
    if (!rentUpiInput.trim()) {
      Alert.alert('Enter your UPI ID', "So your tenant can pay you directly.")
      return
    }
    setSavingRentSettings(true)
    const { error } = await supabase
      .from('flats')
      .update({ rent_amount: amount, owner_upi_id: rentUpiInput.trim() })
      .eq('id', flatInfo.id)
    setSavingRentSettings(false)
    if (error) {
      Alert.alert('Could not save', error.message)
      return
    }
    setFlatInfo({ ...flatInfo, rent_amount: amount, owner_upi_id: rentUpiInput.trim() })
    Alert.alert('Saved', 'Rent settings updated.')
  }

  function openRentUpiApp() {
    if (!flatInfo?.owner_upi_id || !rentPayment?.amount) return
    const url = `upi://pay?pa=${flatInfo.owner_upi_id}&pn=${encodeURIComponent(counterpart?.full_name || 'Owner')}&am=${rentPayment.amount}&cu=INR&tn=${encodeURIComponent('Rent - Flat ' + profile.flat_number)}`
    Linking.openURL(url).catch(() => Alert.alert('No UPI app found', 'Install GPay or PhonePe to pay directly, or copy the UPI ID instead.'))
  }

  async function copyRentUpiId() {
    await Clipboard.setStringAsync(flatInfo.owner_upi_id)
    Alert.alert('Copied', "Owner's UPI ID copied to clipboard")
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

  async function setMaintenancePayer(payer) {
    if (!flatInfo) return
    setUpdatingPayer(true)
    const { error } = await supabase.from('flats').update({ maintenance_payer: payer }).eq('id', flatInfo.id)
    setUpdatingPayer(false)
    if (error) {
      Alert.alert('Could not update', error.message)
      return
    }
    setFlatInfo({ ...flatInfo, maintenance_payer: payer })
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
  const maintenancePayer = flatInfo?.maintenance_payer || 'owner'
  const payerIsMe = profile.ownership === maintenancePayer
  const counterpartLabel = profile.ownership === 'owner' ? 'tenant' : 'owner'

  return (
    <SafeAreaView style={styles.page} edges={['top']}>
    <ScrollView style={styles.page} contentContainerStyle={{ padding: spacing.xl }} showsVerticalScrollIndicator={false}>
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={type.display}>Hi, {profile.full_name?.split(' ')[0]}</Text>
          <Text style={[type.bodyMuted, { marginTop: 4 }]}>Flat {profile.flat_number}</Text>
        </View>
      </View>

      {profile.ownership === 'owner' && counterpart && (
        <Card>
          <Text style={type.eyebrow}>Who pays maintenance?</Text>
          <Text style={[type.bodyMuted, { marginBottom: spacing.md }]}>
            Choose whether you or your tenant ({counterpart.full_name}) handles the monthly maintenance for this flat.
          </Text>
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <Button
              label="I pay"
              onPress={() => setMaintenancePayer('owner')}
              variant={maintenancePayer === 'owner' ? 'primary' : 'outline'}
              disabled={updatingPayer}
              style={{ flex: 1 }}
            />
            <Button
              label="Tenant pays"
              onPress={() => setMaintenancePayer('tenant')}
              variant={maintenancePayer === 'tenant' ? 'primary' : 'outline'}
              disabled={updatingPayer}
              style={{ flex: 1 }}
            />
          </View>
        </Card>
      )}

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
                <Button label="Download receipt" onPress={downloadReceipt} variant="outline" style={styles.onDarkOutline} textStyle={{ color: colors.heroText }} />
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
                    textStyle={{ color: colors.heroText }}
                  />
                </View>
              ) : (
                <>
                  {payerIsMe ? (
                    <>
                      <Button label={showPayPanel ? 'Hide payment' : 'Pay now'} onPress={() => setShowPayPanel(!showPayPanel)} variant="primary" />

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
                        textStyle={{ color: colors.heroText }}
                      />
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
                label="View payment history →"
                onPress={() => navigation.navigate('PaymentHistory')}
                variant="ghost"
                textStyle={{ color: colors.heroMuted }}
                style={{ marginTop: spacing.md, paddingHorizontal: 0 }}
              />
            </>
          ) : (
            <Text style={styles.duesLabel}>No dues generated yet for this month.</Text>
          )}
        </Card>
      )}

      {!rentLoading && counterpart && (
        <Card>
          <Text style={type.eyebrow}>Rent</Text>

          {profile.ownership === 'owner' ? (
            <>
              <Text style={[type.bodyMuted, { marginBottom: spacing.sm }]}>
                Set the monthly rent and your UPI ID so {counterpart.full_name} can pay you directly.
              </Text>
              <TextInput
                style={styles.rentInput}
                placeholder="Monthly rent amount (₹)"
                placeholderTextColor={colors.textFaint}
                value={rentAmountInput}
                onChangeText={setRentAmountInput}
                keyboardType="numeric"
              />
              <TextInput
                style={styles.rentInput}
                placeholder="Your UPI ID (e.g. name@upi)"
                placeholderTextColor={colors.textFaint}
                value={rentUpiInput}
                onChangeText={setRentUpiInput}
                autoCapitalize="none"
              />
              <Button
                label={savingRentSettings ? 'Saving…' : 'Save rent settings'}
                onPress={saveRentSettings}
                loading={savingRentSettings}
                variant="outline"
                style={{ marginBottom: spacing.md }}
              />

              {rentPayment ? (
                <View style={styles.rentStatusBox}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Text style={styles.rentAmount}>₹{rentPayment.amount}</Text>
                    <Badge
                      label={rentPayment.status}
                      tone={rentPayment.status === 'paid' ? 'success' : rentPayment.status === 'submitted' ? 'warning' : 'cove'}
                    />
                  </View>

                  {rentPayment.status === 'submitted' && (
                    <Button
                      label={viewingRentProof ? 'Opening…' : 'View proof'}
                      onPress={viewRentProof}
                      disabled={viewingRentProof}
                      variant="outline"
                      style={{ marginTop: spacing.sm }}
                    />
                  )}

                  {rentPayment.status !== 'paid' && (
                    <Button
                      label={confirmingRent ? 'Confirming…' : 'Confirm rent received'}
                      onPress={confirmRent}
                      loading={confirmingRent}
                      variant="primary"
                      style={{ marginTop: spacing.sm, alignSelf: 'stretch' }}
                    />
                  )}
                </View>
              ) : (
                <Text style={type.bodyMuted}>No rent recorded yet this month.</Text>
              )}
            </>
          ) : (
            <>
              <Text style={styles.rentAmount}>₹{rentPayment?.amount ?? flatInfo?.rent_amount ?? '—'}</Text>
              <Badge
                label={rentPayment?.status || 'pending'}
                tone={rentPayment?.status === 'paid' ? 'success' : rentPayment?.status === 'submitted' ? 'warning' : 'cove'}
              />

              {rentPayment?.status === 'paid' ? (
                <Text style={[type.bodyMuted, { marginTop: spacing.md }]}>Paid for this month.</Text>
              ) : rentPayment?.status === 'submitted' ? (
                <Text style={[type.bodyMuted, { marginTop: spacing.md }]}>
                  Proof submitted — awaiting confirmation from {counterpart.full_name}.
                </Text>
              ) : !flatInfo?.owner_upi_id ? (
                <Text style={[type.bodyMuted, { marginTop: spacing.md }]}>
                  Your owner hasn't set up rent details yet.
                </Text>
              ) : (
                <View style={{ marginTop: spacing.md }}>
                  <Button
                    label={showRentPayPanel ? 'Hide payment details' : 'Pay now →'}
                    onPress={() => setShowRentPayPanel(!showRentPayPanel)}
                    variant="primary"
                  />

                  {showRentPayPanel && (
                    <View style={styles.rentPayPanel}>
                      <Text style={styles.rentPayPanelLabel}>Pay via UPI to:</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
                        <Text style={styles.rentUpiText}>{flatInfo.owner_upi_id}</Text>
                        <TouchableOpacity style={styles.rentCopyBtn} onPress={copyRentUpiId}>
                          <Text style={styles.rentCopyBtnText}>Copy</Text>
                        </TouchableOpacity>
                      </View>
                      <Button label="Open in UPI app →" onPress={openRentUpiApp} variant="primary" />
                    </View>
                  )}

                  <Button
                    label={uploadingRentProof ? 'Uploading…' : 'Upload payment proof'}
                    onPress={handleUploadRentProof}
                    loading={uploadingRentProof}
                    variant="outline"
                    style={{ marginTop: spacing.md }}
                  />
                </View>
              )}
            </>
          )}
        </Card>
      )}

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
    </SafeAreaView>
  )
}

const createStyles = theme => {
  const colors = theme.colors
  return StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.bg },
  centerFill: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, backgroundColor: colors.bg },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: spacing.xl, gap: spacing.md },

  duesLabel: { fontSize: 11, color: colors.heroMuted, textTransform: 'uppercase', fontWeight: '700', marginRight: spacing.sm },
  duesAmount: { fontSize: 34, fontWeight: '700', color: colors.heroText, marginBottom: spacing.md, letterSpacing: -1 },
  onDarkOutline: { borderColor: colors.heroMuted, backgroundColor: 'transparent' },
  awaitingBox: { backgroundColor: theme.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.1)', borderRadius: radius.md, padding: spacing.md },
  awaitingText: { fontSize: 13, color: colors.heroMuted, lineHeight: 20 },

  payPanel: { marginTop: spacing.md, backgroundColor: theme.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.1)', borderRadius: radius.md, padding: spacing.md },
  payPanelLabel: { fontSize: 11, color: colors.heroMuted, marginBottom: 6, fontWeight: '600' },
  upiId: { flex: 1, backgroundColor: 'rgba(0,0,0,0.2)', color: colors.heroText, padding: 10, borderRadius: radius.sm, fontSize: 13, marginRight: 8, fontWeight: '500' },
  copyBtn: { borderWidth: 1, borderColor: colors.heroMuted, borderRadius: radius.sm, paddingVertical: 6, paddingHorizontal: 12 },
  copyBtnText: { color: colors.heroText, fontSize: 12, fontWeight: '600' },
  payNote: { fontSize: 12, color: colors.heroMuted, marginTop: spacing.md, lineHeight: 18 },

  row: { paddingVertical: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rowTitle: { fontWeight: '600', fontSize: 15, color: colors.text, flexShrink: 1, marginRight: spacing.sm },
  noticeBody: { fontSize: 14, color: colors.textSecondary, marginTop: 8, lineHeight: 21 },

  categoryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: spacing.sm },
  categoryChip: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill, paddingVertical: 8, paddingHorizontal: 14, backgroundColor: colors.chip },
  categoryChipActive: { backgroundColor: colors.chipActive, borderColor: colors.chipActive, borderRadius: radius.pill, paddingVertical: 8, paddingHorizontal: 14 },
  categoryChipText: { fontSize: 13, color: colors.chipText, fontWeight: '500' },
  categoryChipTextActive: { fontSize: 13, color: colors.chipTextActive, fontWeight: '600' },
  textArea: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, fontSize: 15, minHeight: 88, textAlignVertical: 'top', marginBottom: spacing.sm, color: colors.text, backgroundColor: colors.inputBg },

  rentInput: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, padding: spacing.md, fontSize: 15, marginBottom: spacing.sm, color: colors.text, backgroundColor: colors.inputBg },
  rentAmount: { fontSize: 22, fontWeight: '700', color: colors.text, letterSpacing: -0.5 },
  rentStatusBox: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, paddingTop: spacing.md, marginTop: spacing.sm },
  rentPayPanel: { marginTop: spacing.md, backgroundColor: colors.surfaceMuted, borderRadius: radius.md, padding: spacing.md },
  rentPayPanelLabel: { fontSize: 11, color: colors.textSecondary, marginBottom: 6, fontWeight: '600' },
  rentUpiText: { flex: 1, backgroundColor: colors.inputBg, borderWidth: 1, borderColor: colors.border, color: colors.text, padding: 10, borderRadius: radius.sm, fontSize: 13, marginRight: 8 },
  rentCopyBtn: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, paddingVertical: 6, paddingHorizontal: 12 },
  rentCopyBtnText: { color: colors.text, fontSize: 12, fontWeight: '600' },

  modalOverlay: { flex: 1, backgroundColor: colors.overlay, alignItems: 'center', justifyContent: 'center' },
  modalImage: { width: '92%', height: '75%', borderRadius: radius.md },
  modalCloseBtn: { marginTop: 20, backgroundColor: colors.surfaceElevated, paddingVertical: 12, paddingHorizontal: 28, borderRadius: radius.md },
  modalCloseBtnText: { color: colors.text, fontWeight: '600', fontSize: 15 },
  })
}