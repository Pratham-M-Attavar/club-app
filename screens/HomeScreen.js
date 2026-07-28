import { useEffect, useState } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Linking,
  Alert,
  Modal,
  RefreshControl,
  ActivityIndicator,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import * as Clipboard from 'expo-clipboard'
import { SafeAreaView } from 'react-native-safe-area-context'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'

import { pickAndUploadProof } from '../lib/paymentProof'
import { colors } from '../lib/theme'

export default function HomeScreen({ navigation }) {
  const { profile } = useAuth()
  const c = colors
  const [refreshing, setRefreshing] = useState(false)
  // Dynamic Supabase State
  const [buildingInfo, setBuildingInfo] = useState(null)
  const [flatInfo, setFlatInfo] = useState(null)
  const [counterpart, setCounterpart] = useState(null)

  const [currentDue, setCurrentDue] = useState(null)
  const [duesLoading, setDuesLoading] = useState(true)

  const [tickets, setTickets] = useState([])
  const [notices, setNotices] = useState([])

  // Modal Sheet Visibility State
  const [showPayPanel, setShowPayPanel] = useState(false)
  const [showRentPayPanel, setShowRentPayPanel] = useState(false)
  const [showNoticesModal, setShowNoticesModal] = useState(false)

  const [uploadingProof, setUploadingProof] = useState(false)
  const [rentPayment, setRentPayment] = useState(null)

  function loadEverything() {
    if (!profile) return

    const firstOfMonth = new Date()
    firstOfMonth.setDate(1)
    const monthStr = firstOfMonth.toISOString().slice(0, 10)

    if (profile.building_id) {
      supabase
        .from('buildings')
        .select('*')
        .eq('id', profile.building_id)
        .maybeSingle()
        .then(({ data }) => {
          if (data) setBuildingInfo(data)
        })
    }

    if (profile.flat_id) {
      supabase
        .from('flats')
        .select('*')
        .eq('id', profile.flat_id)
        .maybeSingle()
        .then(({ data }) => {
          if (data) setFlatInfo(data)
        })

      supabase
        .from('profiles')
        .select('id, full_name, ownership')
        .eq('flat_id', profile.flat_id)
        .neq('id', profile.id)
        .maybeSingle()
        .then(({ data }) => setCounterpart(data))
    }

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

    supabase
      .from('tickets')
      .select('*')
      .eq('raised_by', profile.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setTickets(data || [])
      })

    supabase
      .from('notices')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5)
      .then(({ data }) => {
        setNotices(data || [])
      })
  }

  useEffect(() => {
    if (profile) loadEverything()
  }, [profile])

  useEffect(() => {
    if (!profile?.flat_id || !flatInfo) return
    if (!counterpart && profile.ownership === 'owner') {
      setRentPayment(null)
      return
    }
    loadOrCreateRent()
  }, [profile, flatInfo, counterpart])

  async function loadOrCreateRent() {
    const firstOfMonth = new Date()
    firstOfMonth.setDate(1)
    const monthStr = firstOfMonth.toISOString().slice(0, 10)

    const tenantId = profile.ownership === 'tenant' ? profile.id : counterpart?.id
    const ownerId = profile.ownership === 'owner' ? profile.id : counterpart?.id

    if (profile.ownership === 'tenant' && tenantId && ownerId) {
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

    const { data } = await supabase
      .from('rent_payments')
      .select('*')
      .eq('flat_id', profile.flat_id)
      .eq('month', monthStr)
      .maybeSingle()

    setRentPayment(data)
  }

  async function payViaGPay(targetUpiId, targetName, amount, noteText) {
    const upiId = targetUpiId || buildingInfo?.upi_id || buildingInfo?.account_details
    if (!upiId) {
      Alert.alert(
        'UPI ID Missing',
        'No UPI ID found for this building or owner in Supabase. Please ask your committee or owner to update it.'
      )
      return
    }

    const payeeName = targetName || buildingInfo?.name || 'Building Maintenance'
    const paymentNote = noteText || `Payment - Flat ${profile?.flat_number || ''}`
    const payAmount = amount ? String(amount) : '0'

    const encodedPa = encodeURIComponent(upiId)
    const encodedPn = encodeURIComponent(payeeName)
    const encodedTn = encodeURIComponent(paymentNote)

    const gpayUrl = `gpay://upi/pay?pa=${encodedPa}&pn=${encodedPn}&am=${payAmount}&cu=INR&tn=${encodedTn}`
    const standardUpiUrl = `upi://pay?pa=${encodedPa}&pn=${encodedPn}&am=${payAmount}&cu=INR&tn=${encodedTn}`

    try {
      const canOpenGPay = await Linking.canOpenURL(gpayUrl)
      if (canOpenGPay) {
        await Linking.openURL(gpayUrl)
        return
      }
    } catch (err) {
      // Fallback
    }

    Linking.openURL(standardUpiUrl).catch(async () => {
      await Clipboard.setStringAsync(upiId)
      Alert.alert(
        'UPI ID Copied',
        `Google Pay / UPI app could not be opened directly. The UPI ID (${upiId}) has been copied to your clipboard.`
      )
    })
  }

  async function handleUploadProof() {
    setUploadingProof(true)
    try {
      const path = await pickAndUploadProof(currentDue, profile)
      if (path) {
        Alert.alert(
          'Uploaded Successfully',
          'Your payment proof was submitted. The committee will verify it shortly.'
        )
        loadEverything()
      }
    } catch (err) {
      Alert.alert('Upload Failed', err.message)
    }
    setUploadingProof(false)
  }
  async function handleRefresh() {
  setRefreshing(true)
  try {
    loadEverything()
    if (profile?.flat_id && flatInfo) {
      await loadOrCreateRent()
    }
  } finally {
    setRefreshing(false)
  }
}

  const getGreeting = () => {
    const hour = new Date().getHours()
    if (hour < 12) return 'Good morning'
    if (hour < 17) return 'Good afternoon'
    return 'Good evening'
  }

  const currentMonthName = new Date().toLocaleDateString('en-US', { month: 'long' })
  const apartmentName = buildingInfo?.name || 'My Building'
  const flatNumber = profile?.flat_number || ''
  const isTenant = profile?.ownership === 'tenant'
  const isOwnerWithTenant = profile?.ownership === 'owner' && Boolean(counterpart)

  // Who currently owes maintenance for this flat. Defaults to 'owner' when
  // unset (matches OwnerTenantScreen's default). Only meaningful when the
  // owner actually has a tenant on the flat.
  const maintenancePayer = flatInfo?.maintenance_payer || 'owner'
  // True when the person viewing this screen is the one responsible for
  // paying maintenance this month.
  const viewerOwesMaintenance = isTenant
    ? maintenancePayer === 'tenant'
    : !isOwnerWithTenant || maintenancePayer === 'owner'

  const rentAmountValue = rentPayment?.amount || flatInfo?.rent_amount || currentDue?.total || 0
  const formattedRentAmount = rentAmountValue ? `₹${Number(rentAmountValue).toLocaleString('en-IN')}` : '₹0'

  const maintenanceTotal = currentDue?.total || 0
  const formattedMaintenanceAmount = maintenanceTotal ? `₹${Number(maintenanceTotal).toLocaleString('en-IN')}` : '₹0'

  const openTickets = tickets.filter(t => t && t.status !== 'resolved' && t.status !== 'done')
  const inProgressTickets = tickets.filter(t => t && t.status === 'in_progress')

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} refreshControl={
    <RefreshControl
      refreshing={refreshing}
      onRefresh={handleRefresh}
      tintColor={c.accent}
      colors={[c.accent]}
    />
  }>
        {/* Header */}
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.greetingText}>{getGreeting()}</Text>
            <Text style={styles.nameText}>
              {profile?.full_name?.split(' ')[0] || 'Resident'}
            </Text>
            <Text style={styles.subtitleText}>
              {apartmentName} · Flat {flatNumber}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.bellButton}
            onPress={() => setShowNoticesModal(true)}
            activeOpacity={0.7}
          >
            <Ionicons name="notifications-outline" size={20} color={c.text} />
            {notices.length > 0 && <View style={styles.bellBadge} />}
          </TouchableOpacity>
        </View>

        {/* Dynamic Main Rent / Maintenance Banner */}
        <TouchableOpacity
          style={styles.mainBannerCard}
          onPress={() => {
            if (isTenant) {
              setShowRentPayPanel(true)
            } else if (viewerOwesMaintenance) {
              setShowPayPanel(true)
            }
            // Owner who has opted the tenant into paying maintenance sees
            // an informational card only — no pay action to trigger.
          }}
          activeOpacity={isTenant || viewerOwesMaintenance ? 0.85 : 1}
        >
          <View style={styles.bannerTopRow}>
            <View style={styles.bannerIconWrap}>
              <Ionicons name="card-outline" size={18} color={c.accent} />
            </View>
            <View
              style={[
                styles.dueBadge,
                currentDue?.status === 'approved' && { backgroundColor: c.successBg },
              ]}
            >
              <Text
                style={[
                  styles.dueBadgeText,
                  currentDue?.status === 'approved' && { color: c.success },
                ]}
              >
                {currentDue?.status === 'approved' ? 'Paid' : 'Due Soon'}
              </Text>
            </View>
          </View>

          <Text style={styles.rentLabel}>
            {isTenant
              ? 'Monthly Rent'
              : viewerOwesMaintenance
              ? 'Maintenance Fee'
              : 'Maintenance (Tenant Pays)'}
          </Text>
          <Text style={styles.rentAmount}>
            {isTenant
              ? formattedRentAmount
              : viewerOwesMaintenance
              ? formattedMaintenanceAmount
              : '—'}
          </Text>

          <Text style={styles.rentSubtext}>
            {isTenant || viewerOwesMaintenance
              ? `Due ${currentMonthName} · Tap to pay via GPay / UPI`
              : `${counterpart?.full_name || 'Tenant'} is responsible this month`}
          </Text>
        </TouchableOpacity>

        {/* 2-Column Dynamic Row */}
        <View style={styles.twoColRow}>
          {/* If Owner with Tenant -> Show Rent Status Card */}
          {isOwnerWithTenant ? (
            <TouchableOpacity
              style={styles.colCard}
              onPress={() => setShowRentPayPanel(true)}
              activeOpacity={0.85}
            >
              <View
                style={[
                  styles.colIconWrap,
                  {
                    backgroundColor:
                      rentPayment?.status === 'paid' ? c.successBg : c.warningBg,
                  },
                ]}
              >
                <Ionicons
                  name={rentPayment?.status === 'paid' ? 'cash-outline' : 'time-outline'}
                  size={18}
                  color={rentPayment?.status === 'paid' ? c.success : c.warning}
                />
              </View>
              <Text style={styles.colLabel}>Rent Status</Text>
              <Text style={styles.colValueBold}>
                {rentPayment?.status === 'paid' ? 'Received' : 'Pending'}
              </Text>
              <Text
                style={
                  rentPayment?.status === 'paid'
                    ? styles.colSubtextGreen
                    : styles.colSubtextMuted
                }
              >
                {rentPayment?.status === 'paid'
                  ? `${currentMonthName} ✓`
                  : 'Awaiting Tenant'}
              </Text>
            </TouchableOpacity>
          ) : (
            /* Standard Maintenance Card */
            <TouchableOpacity
              style={styles.colCard}
              onPress={() => viewerOwesMaintenance && setShowPayPanel(true)}
              activeOpacity={viewerOwesMaintenance ? 0.85 : 1}
            >
              <View style={[styles.colIconWrap, { backgroundColor: c.successBg }]}>
                <Ionicons name="build-outline" size={18} color={c.success} />
              </View>
              <Text style={styles.colLabel}>Maintenance</Text>
              <Text style={styles.colValueBold}>
                {currentDue?.status === 'approved' ? 'Paid' : 'Pending'}
              </Text>
              <Text style={styles.colSubtextGreen}>
                {currentMonthName} {currentDue?.status === 'approved' ? '✓' : ''}
              </Text>
            </TouchableOpacity>
          )}

          {/* Requests Status Card */}
          <TouchableOpacity
            style={styles.colCard}
            onPress={() => navigation.navigate('Requests')}
            activeOpacity={0.85}
          >
            <View style={[styles.colIconWrap, { backgroundColor: c.warningBg }]}>
              <Ionicons name="alert-circle-outline" size={18} color={c.warning} />
            </View>
            <Text style={styles.colLabel}>Requests</Text>
            <Text style={styles.colValueBold}>
              {openTickets.length > 0 ? `${openTickets.length} Open` : '0 Open'}
            </Text>
            <Text style={styles.colSubtextMuted}>
              {inProgressTickets.length > 0
                ? `${inProgressTickets.length} in progress`
                : 'No pending issues'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Community Notices Card (Entire card opens modal smoothly when pressed) */}
        <TouchableOpacity
          style={styles.noticeCard}
          onPress={() => setShowNoticesModal(true)}
          activeOpacity={0.85}
        >
          <View style={styles.noticeHeaderRow}>
            <View style={styles.noticeTitleGroup}>
              <View style={styles.noticeIconWrap}>
                <Ionicons name="notifications-outline" size={18} color={c.accent} />
              </View>
              <Text style={styles.noticeTitle}>Community Notices</Text>
            </View>
            <View style={styles.newBadgePill}>
              <Text style={styles.newBadgeText}>{notices.length} New ›</Text>
            </View>
          </View>

          <View style={styles.noticeList}>
            {notices.length === 0 ? (
              <Text style={{ fontSize: 13, color: c.textTertiary }}>
                No recent community notices posted.
              </Text>
            ) : (
              notices.slice(0, 3).map(n => (
                <View key={n.id} style={styles.noticeBulletRow}>
                  <View style={styles.bulletDot} />
                  <Text style={styles.bulletText} numberOfLines={1}>
                    {n.title || 'Community Notice'}
                  </Text>
                </View>
              ))
            )}
          </View>
        </TouchableOpacity>
      </ScrollView>

      {/* Rent / Payment Details Modal Sheet */}
      <Modal visible={showRentPayPanel} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={styles.modalBackdrop}
            onPress={() => setShowRentPayPanel(false)}
          />
          <View style={styles.modalSheet}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Rent Details</Text>
              <TouchableOpacity
                onPress={() => setShowRentPayPanel(false)}
                style={styles.closeBtn}
              >
                <Ionicons name="close" size={18} color={c.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={styles.amountBox}>
              <Text style={styles.amountBoxLabel}>Amount Due</Text>
              <Text style={styles.amountBoxValue}>{formattedRentAmount}</Text>
              <View style={styles.dueBadgeRow}>
                <Ionicons name="calendar-outline" size={14} color={c.warning} />
                <Text style={styles.dueBadgeRowText}>Due {currentMonthName}</Text>
              </View>
            </View>

            <View style={styles.kvList}>
              <View style={styles.kvRow}>
                <Text style={styles.kvKey}>Payment Method</Text>
                <Text style={styles.kvVal}>GPay / UPI Transfer</Text>
              </View>
              <View style={styles.kvRow}>
                <Text style={styles.kvKey}>Reference</Text>
                <Text style={styles.kvVal}>
                  {((apartmentName || 'APT').slice(0, 3) + '-' + (flatNumber || '')).toUpperCase()}
                </Text>
              </View>
              <View style={styles.kvRow}>
                <Text style={styles.kvKey}>Owner UPI ID</Text>
                <Text style={styles.kvVal}>
                  {flatInfo?.owner_upi_id || buildingInfo?.upi_id || 'Not set'}
                </Text>
              </View>
              <View style={styles.kvRow}>
                <Text style={styles.kvKey}>Status</Text>
                <Text
                  style={[
                    styles.kvVal,
                    { color: rentPayment?.status === 'paid' ? c.success : c.warning },
                  ]}
                >
                  {rentPayment?.status === 'paid' ? 'Paid' : 'Unpaid'}
                </Text>
              </View>
            </View>

            {/* Only the tenant pays rent. The owner (payee) sees a
                read-only status line instead of a pay action. */}
            {isTenant ? (
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={() => {
                  setShowRentPayPanel(false)
                  payViaGPay(
                    flatInfo?.owner_upi_id || buildingInfo?.upi_id,
                    counterpart?.full_name || 'Flat Owner',
                    rentAmountValue,
                    `Rent - Flat ${flatNumber}`
                  )
                }}
              >
                <Ionicons name="logo-google" size={18} color={c.text} style={{ marginRight: 8 }} />
                <Text style={styles.primaryButtonText}>Pay Now with GPay</Text>
              </TouchableOpacity>
            ) : (
              <View
                style={[
                  styles.paidStatusCard,
                  rentPayment?.status !== 'paid' && {
                    backgroundColor: c.warningBg,
                    borderColor: 'rgba(245,158,11,0.3)',
                  },
                ]}
              >
                <Ionicons
                  name={rentPayment?.status === 'paid' ? 'checkmark-circle-outline' : 'time-outline'}
                  size={24}
                  color={rentPayment?.status === 'paid' ? c.success : c.warning}
                />
                <View>
                  <Text
                    style={[
                      styles.paidStatusTitle,
                      rentPayment?.status !== 'paid' && { color: c.warning },
                    ]}
                  >
                    {rentPayment?.status === 'paid' ? 'Rent Received' : 'Rent Pending'}
                  </Text>
                  <Text style={styles.paidStatusSub}>
                    {rentPayment?.status === 'paid'
                      ? `${currentMonthName} ✓`
                      : `Waiting on ${counterpart?.full_name || 'tenant'} to pay`}
                  </Text>
                </View>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* Maintenance Fee Modal Sheet */}
      <Modal visible={showPayPanel} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={styles.modalBackdrop}
            onPress={() => setShowPayPanel(false)}
          />
          <View style={styles.modalSheet}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Maintenance Fee</Text>
              <TouchableOpacity
                onPress={() => setShowPayPanel(false)}
                style={styles.closeBtn}
              >
                <Ionicons name="close" size={18} color={c.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Status Card */}
            <View
              style={[
                styles.paidStatusCard,
                currentDue?.status !== 'approved' && {
                  backgroundColor: c.warningBg,
                  borderColor: 'rgba(245,158,11,0.3)',
                },
              ]}
            >
              <Ionicons
                name={
                  currentDue?.status === 'approved'
                    ? 'checkmark-circle-outline'
                    : 'time-outline'
                }
                size={24}
                color={currentDue?.status === 'approved' ? c.success : c.warning}
              />
              <View>
                <Text
                  style={[
                    styles.paidStatusTitle,
                    currentDue?.status !== 'approved' && { color: c.warning },
                  ]}
                >
                  {currentMonthName} Maintenance — {formattedMaintenanceAmount}
                </Text>
                <Text style={styles.paidStatusSub}>
                  {currentDue?.status === 'approved'
                    ? 'Approved by committee'
                    : 'Payment pending for current month'}
                </Text>
              </View>
            </View>

            {/* Pay via GPay button — only for whoever currently owes
                maintenance this month (owner by default, or tenant if the
                owner has toggled "Tenant Pays"). */}
            {viewerOwesMaintenance ? (
              <>
                <TouchableOpacity
                  style={[styles.primaryButton, { marginBottom: 14 }]}
                  onPress={() => {
                    payViaGPay(
                      buildingInfo?.upi_id || buildingInfo?.account_details,
                      buildingInfo?.name || 'Building Maintenance',
                      maintenanceTotal,
                      `Maintenance - Flat ${flatNumber}`
                    )
                  }}
                >
                  <Ionicons name="logo-google" size={18} color={c.text} style={{ marginRight: 8 }} />
                  <Text style={styles.primaryButtonText}>Pay Now with GPay</Text>
                </TouchableOpacity>

                {/* Upload Receipt Dropzone */}
                <TouchableOpacity
                  style={styles.uploadDropzone}
                  onPress={handleUploadProof}
                  activeOpacity={0.8}
                  disabled={uploadingProof}
                >
                  {uploadingProof ? (
                    <ActivityIndicator color={c.accent} />
                  ) : (
                    <>
                      <Ionicons name="cloud-upload-outline" size={24} color={c.textSecondary} />
                      <Text style={styles.uploadTitle}>Upload Receipt / Payment Proof</Text>
                      <Text style={styles.uploadSub}>PDF, PNG, or JPG · max 10 MB</Text>
                    </>
                  )}
                </TouchableOpacity>
              </>
            ) : (
              <Text style={{ fontSize: 13, color: c.textSecondary, textAlign: 'center', marginTop: 4 }}>
                {isTenant
                  ? 'The owner handles maintenance for this flat.'
                  : `${counterpart?.full_name || 'Your tenant'} handles maintenance for this flat.`}
              </Text>
            )}
          </View>
        </View>
      </Modal>

      {/* Community Notices Modal Sheet */}
      <Modal visible={showNoticesModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={styles.modalBackdrop}
            onPress={() => setShowNoticesModal(false)}
          />
          <View style={styles.modalSheet}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Community Notices</Text>
              <TouchableOpacity
                onPress={() => setShowNoticesModal(false)}
                style={styles.closeBtn}
              >
                <Ionicons name="close" size={18} color={c.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 400 }}>
              {notices.length === 0 ? (
                <Text style={{ color: c.textSecondary, textAlign: 'center', marginVertical: 20 }}>
                  No community notices found.
                </Text>
              ) : (
                notices.map(n => (
                  <View key={n.id} style={styles.noticeItemCard}>
                    <View style={styles.noticeBulletRow}>
                      <View style={styles.bulletDot} />
                      <Text style={styles.noticeItemTitle}>{n.title}</Text>
                    </View>
                    {n.content ? (
                      <Text style={{ color: c.textSecondary, fontSize: 13, marginTop: 6, paddingLeft: 16 }}>
                        {n.content}
                      </Text>
                    ) : null}
                    <View style={styles.noticeMetaRow}>
                      <View style={[styles.tagPill, { backgroundColor: c.accentSoft }]}>
                        <Text style={[styles.tagPillText, { color: c.accent }]}>
                          {n.category || 'General'}
                        </Text>
                      </View>
                      <Text style={styles.noticeItemDate}>
                        {new Date(n.created_at).toLocaleDateString()}
                      </Text>
                    </View>
                  </View>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 30,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  greetingText: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '400',
  },
  nameText: {
    fontSize: 32,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.6,
    marginTop: 2,
  },
  subtitleText: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 4,
  },
  bellButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  bellBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.accent,
  },
  mainBannerCard: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 16,
  },
  bannerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  bannerIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.accentSoft,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dueBadge: {
    backgroundColor: colors.warningBg,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
  },
  dueBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.warning,
  },
  rentLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  rentAmount: {
    fontSize: 36,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -1,
    marginTop: 4,
  },
  rentSubtext: {
    fontSize: 13,
    color: colors.textTertiary,
    marginTop: 8,
  },
  twoColRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  colCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  colIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  colLabel: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  colValueBold: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    marginTop: 4,
  },
  colSubtextGreen: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.success,
    marginTop: 4,
  },
  colSubtextMuted: {
    fontSize: 12,
    color: colors.textTertiary,
    marginTop: 4,
  },
  noticeCard: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.border,
  },
  noticeHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  noticeTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  noticeIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: colors.accentSoft,
    justifyContent: 'center',
    alignItems: 'center',
  },
  noticeTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  newBadgePill: {
    backgroundColor: colors.accentSoft,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  newBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.accent,
  },
  noticeList: {
    gap: 12,
  },
  noticeBulletRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  bulletDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.accent,
  },
  bulletText: {
    fontSize: 14,
    color: colors.text,
    fontWeight: '500',
    flex: 1,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: colors.overlay,
  },
  modalBackdrop: {
    flex: 1,
  },
  modalSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.borderStrong,
    alignSelf: 'center',
    marginBottom: 16,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  sheetTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surfaceElevated,
    justifyContent: 'center',
    alignItems: 'center',
  },
  amountBox: {
    backgroundColor: colors.bg,
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
  },
  amountBoxLabel: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  amountBoxValue: {
    fontSize: 34,
    fontWeight: '800',
    color: colors.text,
    marginTop: 4,
  },
  dueBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  dueBadgeRowText: {
    fontSize: 13,
    color: colors.warning,
    fontWeight: '600',
  },
  kvList: {
    gap: 16,
    marginBottom: 24,
  },
  kvRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  kvKey: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  kvVal: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  primaryButton: {
    flexDirection: 'row',
    backgroundColor: colors.accent,
    borderRadius: 14,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  paidStatusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.successBg,
    padding: 16,
    borderRadius: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.3)',
  },
  paidStatusTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.success,
  },
  paidStatusSub: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  uploadDropzone: {
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    borderStyle: 'dashed',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    marginBottom: 10,
  },
  uploadTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
    marginTop: 8,
  },
  uploadSub: {
    fontSize: 12,
    color: colors.textTertiary,
    marginTop: 4,
  },
  noticeItemCard: {
    backgroundColor: colors.bg,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
  },
  noticeItemTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    flex: 1,
  },
  noticeMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    paddingLeft: 16,
  },
  tagPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  tagPillText: {
    fontSize: 11,
    fontWeight: '600',
  },
  noticeItemDate: {
    fontSize: 12,
    color: colors.textTertiary,
  },
})