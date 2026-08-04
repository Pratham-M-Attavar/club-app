import { useEffect, useRef, useState } from 'react'
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
import { getCurrentMonthStr } from '../lib/format'
import BuildingPickerModal from '../components/BuildingPickerModal'

export default function HomeScreen({ navigation }) {

  const { profile, isAdmin, adminBuilding, realProfile } = useAuth()
  const c = colors
  const [refreshing, setRefreshing] = useState(false)
  const [showBuildingPicker, setShowBuildingPicker] = useState(false)
  // Dynamic Supabase State
  const [buildingInfo, setBuildingInfo] = useState(null)
  const [flatInfo, setFlatInfo] = useState(null)
  const [counterpart, setCounterpart] = useState(null)

  const [currentDue, setCurrentDue] = useState(null)
  const [duesLoading, setDuesLoading] = useState(true)
  // A Realtime event is newer than any request that started before it.
  // Incrementing this invalidates those in-flight reads so they cannot put
  // the previous amount back on screen after the event has updated the card.
  const dueRequestVersion = useRef(0)

  const [tickets, setTickets] = useState([])
  const [notices, setNotices] = useState([])

  // Modal Sheet Visibility State
  const [showPayPanel, setShowPayPanel] = useState(false)
  const [showRentPayPanel, setShowRentPayPanel] = useState(false)
  const [showNoticesModal, setShowNoticesModal] = useState(false)

  const [uploadingProof, setUploadingProof] = useState(false)
  const [notifyingCommittee, setNotifyingCommittee] = useState(false)
  const [rentPayment, setRentPayment] = useState(null)
  const [previousRentPayment, setPreviousRentPayment] = useState(null)
  const rentRequestVersion = useRef(0)
  const [notifyingOwner, setNotifyingOwner] = useState(false)
  const [reviewingRent, setReviewingRent] = useState(false)
  const [sendingRentReminder, setSendingRentReminder] = useState(false)

  function loadEverything() {
    if (!profile) return

    const monthStr = getCurrentMonthStr()

    function loadCurrentDue(flatNumber) {
      const requestVersion = ++dueRequestVersion.current
      if (!flatNumber) {
        if (requestVersion === dueRequestVersion.current) {
          setCurrentDue(null)
          setDuesLoading(false)
        }
        return
      }
      setDuesLoading(true)
      supabase
        .from('dues')
        .select('*')
        .eq('building_id', profile.building_id)
        .eq('flat_number', flatNumber)
        .eq('month', monthStr)
        .maybeSingle()
        .then(({ data, error }) => {
          if (requestVersion !== dueRequestVersion.current) return
          if (error) console.log('Could not load maintenance due:', error.message)
          setCurrentDue(data || null)
          setDuesLoading(false)
        })
    }

    if (profile.building_id) {
      supabase
        .from('buildings')
        .select('*')
        .eq('id', profile.building_id)
        .maybeSingle()
        .then(({ data }) => {
          if (data) setBuildingInfo(data)
          else {
            supabase
              .from('public_buildings_search')
              .select('*')
              .eq('id', profile.building_id)
              .maybeSingle()
              .then(({ data: viewData }) => {
                if (viewData) setBuildingInfo(viewData)
              })
          }
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
          // Dues use the canonical number in flats; tenant profiles can have
          // a missing or stale flat_number.
          loadCurrentDue(data?.flat_number || profile.flat_number)
        })

      supabase
        .from('profiles')
        .select('id, full_name, ownership, push_token')
        .eq('flat_id', profile.flat_id)
        .neq('id', profile.id)
        .maybeSingle()
        .then(({ data }) => setCounterpart(data))
    } else {
      loadCurrentDue(profile.flat_number)
    }

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
      .eq('building_id', profile.building_id)
      .order('created_at', { ascending: false })
      .limit(5)
      .then(({ data }) => {
        setNotices(data || [])
      })
  }

  useEffect(() => {
    if (profile) loadEverything()
  }, [profile])

  // Keep the card current when the committee changes this flat's amount or
  // its current-month due while the resident is already on the home screen.
  useEffect(() => {
    if (!profile?.building_id || !profile?.flat_id) return

    const currentMonth = getCurrentMonthStr()
    const channel = supabase
      .channel(`home-maintenance-${profile.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'flats', filter: `id=eq.${profile.flat_id}` },
        ({ new: updatedFlat }) => {
          rentRequestVersion.current += 1
          setFlatInfo(previous => ({ ...previous, ...updatedFlat }))
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'dues', filter: `building_id=eq.${profile.building_id}` },
        ({ eventType, new: updatedDue, old: previousDue }) => {
          const due = eventType === 'DELETE' ? previousDue : updatedDue
          const flatNumber = flatInfo?.flat_number || profile.flat_number
          if (due?.flat_number !== flatNumber || due?.month !== currentMonth) return
          dueRequestVersion.current += 1
          setCurrentDue(eventType === 'DELETE' ? null : updatedDue)
          setDuesLoading(false)
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'rent_payments', filter: `flat_id=eq.${profile.flat_id}` },
        ({ eventType, new: updatedPayment, old: previousPayment }) => {
          const payment = eventType === 'DELETE' ? previousPayment : updatedPayment
          if (payment?.month !== currentMonth) return
          rentRequestVersion.current += 1
          setRentPayment(eventType === 'DELETE' ? null : updatedPayment)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [profile?.id, profile?.building_id, profile?.flat_id, profile?.flat_number, flatInfo?.flat_number])

  // Home remains mounted in the tab navigator, so refresh its server state
  // whenever the resident returns to it (also covers projects without
  // Supabase Realtime enabled).
  useEffect(() => navigation.addListener('focus', loadEverything), [navigation, profile])

  useEffect(() => {
    if (!profile?.flat_id || !flatInfo) return
    if (!counterpart && profile.ownership === 'owner') {
      setRentPayment(null)
      return
    }
    loadOrCreateRent()
  }, [profile, flatInfo, counterpart])
  async function loadOrCreateRent() {
    const requestVersion = ++rentRequestVersion.current
    const firstOfMonth = new Date()
    firstOfMonth.setDate(1)
    const monthStr = getCurrentMonthStr()

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

    if (requestVersion !== rentRequestVersion.current) return
    setRentPayment(data)
    const { data: previousPayment } = await supabase
      .from('rent_payments')
      .select('id, status, month')
      .eq('flat_id', profile.flat_id)
      .lt('month', monthStr)
      .order('month', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (requestVersion === rentRequestVersion.current) setPreviousRentPayment(previousPayment)
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
      const amount = currentDue?.total ?? currentDue?.maintenance ?? flatInfo?.maintenance_amount ?? 0
      const path = await pickAndUploadProof(currentDue, profile, amount)
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

  async function notifyCommitteeOfPayment() {
    setNotifyingCommittee(true)
    const monthStr = getCurrentMonthStr()
    const effectiveFlatNumber = flatInfo?.flat_number || profile?.flat_number
    if (!effectiveFlatNumber) {
      Alert.alert('Error', 'Flat number missing from your profile.')
      setNotifyingCommittee(false)
      return
    }
    const amount = Number(currentDue?.total ?? currentDue?.maintenance ?? flatInfo?.maintenance_amount ?? 0)

    const { error } = await supabase
      .from('dues')
      .upsert(
        {
          flat_number: effectiveFlatNumber,
          month: monthStr,
          maintenance: amount,
          total: amount,
          building_id: profile.building_id,
          status: 'submitted',
          proof_uploaded_at: new Date().toISOString(),
        },
        { onConflict: 'flat_number,month' }
      )

    setNotifyingCommittee(false)
    if (error) {
      Alert.alert('Could Not Notify Committee', error.message)
      return
    }
    Alert.alert('Committee Notified', 'Your payment is pending committee approval.')
    loadEverything()
  }

  async function remindTenantRent() {
    if (!counterpart?.push_token) {
      Alert.alert('No Reminder Sent', `${counterpart?.full_name || 'Your tenant'} hasn't enabled notifications yet.`)
      return
    }
    setSendingRentReminder(true)
    try {
      const res = await fetch('https://eebzdurarsyuqbdtwswl.supabase.co/functions/v1/send-push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tokens: [counterpart.push_token],
          title: 'Rent Reminder',
          body: `Your rent for ${currentMonthName} is still pending — please pay when you get a chance.`,
        }),
      })
      const result = await res.json()
      if (result.sent > 0) {
        Alert.alert('Reminder Sent', `${counterpart?.full_name || 'Your tenant'} has been notified.`)
      } else {
        Alert.alert('Could Not Send', 'The reminder could not be delivered.')
      }
    } catch (err) {
      Alert.alert('Could Not Send Reminder', err.message)
    }
    setSendingRentReminder(false)
  }

  async function notifyOwnerOfRentPayment() {
    if (!rentPayment?.id) return
    setNotifyingOwner(true)
    const { error } = await supabase.from('rent_payments').update({ status: 'submitted' }).eq('id', rentPayment.id)
    setNotifyingOwner(false)
    if (error) return Alert.alert('Could Not Notify Owner', error.message)
    Alert.alert('Owner Notified', 'Your payment is waiting for the owner’s approval.')
  }

  async function reviewRentPayment(approved) {
    if (!rentPayment?.id) return
    setReviewingRent(true)
    const { error } = await supabase.from('rent_payments').update(approved ? { status: 'paid', paid_at: new Date().toISOString() } : { status: 'pending' }).eq('id', rentPayment.id)
    setReviewingRent(false)
    if (error) return Alert.alert('Could Not Update Rent', error.message)
    Alert.alert(approved ? 'Rent Approved' : 'Rent Declined', approved ? 'Rent is marked paid for this month.' : 'The tenant can notify you again after payment.')
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
  const rentUnderReview = rentPayment?.status === 'submitted'
  const rentPaid = rentPayment?.status === 'paid'
  const rentDueDay = Number(flatInfo?.rent_due_day)
  const rentDueDate = rentDueDay
    ? new Date(new Date().getFullYear(), new Date().getMonth(), rentDueDay)
    : null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const daysUntilRentDue = rentDueDate ? Math.ceil((rentDueDate - today) / 86400000) : null
  const isRentDueWindow = daysUntilRentDue !== null && daysUntilRentDue <= 7
  // Before the seven-day window, a previously paid tenant remains shown as
  // paid. A new tenant has no previous record, so they see Due soon instead.
  const showPreviousRentAsPaid = !rentPaid && !rentUnderReview && !isRentDueWindow && previousRentPayment?.status === 'paid'
  const rentDisplayStatus = rentPaid || showPreviousRentAsPaid ? 'paid' : rentUnderReview ? 'submitted' : 'due'
  const rentCountdownText = daysUntilRentDue === null
    ? 'Due soon'
    : daysUntilRentDue > 7 ? 'Due soon'
    : daysUntilRentDue > 0 ? `Due in ${daysUntilRentDue} day${daysUntilRentDue === 1 ? '' : 's'}`
    : daysUntilRentDue === 0 ? 'Due today' : `${Math.abs(daysUntilRentDue)} day${Math.abs(daysUntilRentDue) === 1 ? '' : 's'} overdue`

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

  const maintenanceDueDay = Number(buildingInfo?.maintenance_due_day)
  const maintenanceDueLabel = maintenanceDueDay
    ? `on the ${maintenanceDueDay}${maintenanceDueDay === 1 || maintenanceDueDay === 21 || maintenanceDueDay === 31 ? 'st' : maintenanceDueDay === 2 || maintenanceDueDay === 22 ? 'nd' : maintenanceDueDay === 3 || maintenanceDueDay === 23 ? 'rd' : 'th'}`
    : `in ${currentMonthName}`
  const maintenanceDueDate = maintenanceDueDay
    ? new Date(new Date().getFullYear(), new Date().getMonth(), maintenanceDueDay)
    : null
  const daysUntilMaintenanceDue = maintenanceDueDate ? Math.ceil((maintenanceDueDate - today) / 86400000) : null
  const isMaintenanceDueWindow = daysUntilMaintenanceDue !== null && daysUntilMaintenanceDue <= 7
  const maintenanceDueText = daysUntilMaintenanceDue === null || daysUntilMaintenanceDue > 7
    ? 'Due soon'
    : daysUntilMaintenanceDue > 0 ? `Due in ${daysUntilMaintenanceDue} day${daysUntilMaintenanceDue === 1 ? '' : 's'}`
    : daysUntilMaintenanceDue === 0 ? 'Due today' : `${Math.abs(daysUntilMaintenanceDue)} day${Math.abs(daysUntilMaintenanceDue) === 1 ? '' : 's'} overdue`
  const currentMonthPrefix = getCurrentMonthStr().slice(0, 7)
  // Old paid rows can remain while the new cycle is being set up. They must
  // not hide this month's due amount or countdown. A paid state is current
  // only when the recorded payment happened in this calendar month.
  const maintenancePaidThisMonth = currentDue?.status === 'paid'
    && currentDue?.paid_at?.slice(0, 7) === currentMonthPrefix
  const maintenanceDisplayStatus = currentDue?.status === 'submitted'
    ? 'submitted'
    : maintenancePaidThisMonth || (!isMaintenanceDueWindow && currentDue?.status === 'paid') ? 'paid' : 'due'
  const maintenanceTotal = maintenanceDisplayStatus === 'due'
    ? flatInfo?.maintenance_amount ?? currentDue?.total ?? currentDue?.maintenance ?? 0
    : currentDue?.total ?? currentDue?.maintenance ?? flatInfo?.maintenance_amount ?? 0
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
          <View style={{ flex: 1 }}>
            <Text style={styles.greetingText}>{getGreeting()}</Text>
            <Text style={styles.nameText}>
              {profile?.full_name?.split(' ')[0] || 'Resident'}
            </Text>
            <Text style={styles.subtitleText}>
              {apartmentName} {flatNumber ? `· Flat ${flatNumber}` : ''}
            </Text>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            {isAdmin && (
              <TouchableOpacity
                style={styles.buildingPillBtn}
                onPress={() => setShowBuildingPicker(true)}
                activeOpacity={0.8}
              >
                <Ionicons name="business" size={15} color={c.accent} />
                <Text style={styles.buildingPillText} numberOfLines={1}>
                  {adminBuilding ? adminBuilding.name : 'Building'}
                </Text>
                <Ionicons name="chevron-down" size={13} color={c.accent} />
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.bellButton}
              onPress={() => setShowNoticesModal(true)}
              activeOpacity={0.7}
            >
              <Ionicons name="notifications-outline" size={20} color={c.text} />
              {notices.length > 0 && <View style={styles.bellBadge} />}
            </TouchableOpacity>
          </View>
        </View>

        {/* ADMIN MODE BANNER (When managing another building without being a resident) */}
        {isAdmin && adminBuilding && (
          <TouchableOpacity
            style={styles.adminModeBanner}
            onPress={() => setShowBuildingPicker(true)}
            activeOpacity={0.85}
          >
            <View style={styles.adminModeIconWrap}>
              <Ionicons name="shield-checkmark" size={18} color="#EAB308" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.adminModeTitle}>
                Admin Mode · {adminBuilding.name}
              </Text>
              <Text style={styles.adminModeSub}>
                Managing building accounts & committee without resident flat
              </Text>
            </View>
            <View style={styles.adminModeSwitchBadge}>
              <Text style={styles.adminModeSwitchText}>Switch</Text>
              <Ionicons name="swap-horizontal" size={12} color="#EAB308" />
            </View>
          </TouchableOpacity>
        )}

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
                (isTenant ? rentDisplayStatus === 'paid' : maintenanceDisplayStatus === 'paid') && { backgroundColor: c.successBg },
              ]}
            >
              <Text
                style={[
                  styles.dueBadgeText,
                  (isTenant ? rentDisplayStatus === 'paid' : maintenanceDisplayStatus === 'paid') && { color: c.success },
                ]}
              >
                {isTenant ? rentDisplayStatus === 'paid' ? 'Paid' : rentDisplayStatus === 'submitted' ? 'Under Review' : rentCountdownText : maintenanceDisplayStatus === 'paid' ? 'Paid' : maintenanceDisplayStatus === 'submitted' ? 'Under Review' : maintenanceDueText}
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
  {isTenant
    ? `Due ${flatInfo?.rent_due_day ? `on the ${flatInfo.rent_due_day}${flatInfo.rent_due_day === 1 || flatInfo.rent_due_day === 21 || flatInfo.rent_due_day === 31 ? 'st' : flatInfo.rent_due_day === 2 || flatInfo.rent_due_day === 22 ? 'nd' : flatInfo.rent_due_day === 3 || flatInfo.rent_due_day === 23 ? 'rd' : 'th'}` : currentMonthName} · Tap to pay via GPay / UPI`
    : viewerOwesMaintenance
    ? `Due ${maintenanceDueLabel} · Tap to pay via GPay / UPI`
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
                      rentDisplayStatus === 'paid' ? c.successBg : c.warningBg,
                  },
                ]}
              >
                <Ionicons
                  name={rentDisplayStatus === 'paid' ? 'cash-outline' : 'time-outline'}
                  size={18}
                  color={rentDisplayStatus === 'paid' ? c.success : c.warning}
                />
              </View>
              <Text style={styles.colLabel}>Rent Status</Text>
              <Text style={styles.colValueBold}>
                {rentDisplayStatus === 'paid' ? 'Received' : rentDisplayStatus === 'submitted' ? 'Under Review' : rentCountdownText}
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
                {currentDue?.status === 'paid' ? 'Paid' : currentDue?.status === 'submitted' ? 'Under Review' : 'Pending'}
              </Text>
              <Text style={styles.colSubtextGreen}>
                {currentMonthName} {currentDue?.status === 'paid' ? '✓' : ''}
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
    <Text style={styles.kvKey}>Due Day</Text>
    <Text style={styles.kvVal}>
      {flatInfo?.rent_due_day ? `${flatInfo.rent_due_day}th of every month` : 'Not set'}
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
            {isTenant && !rentPaid && !rentUnderReview ? (
              <>
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
              <TouchableOpacity style={[styles.primaryButton, { marginTop: 10 }]} onPress={notifyOwnerOfRentPayment} disabled={notifyingOwner}>
                {notifyingOwner ? <ActivityIndicator color={c.text} /> : <Text style={styles.primaryButtonText}>I've Paid — Notify Owner</Text>}
              </TouchableOpacity>
              </>
            ) : isTenant ? (
              <View style={[styles.paidStatusCard, rentUnderReview && { backgroundColor: c.warningBg, borderColor: 'rgba(245,158,11,0.3)' }]}>
                <Ionicons name={rentPaid ? "checkmark-circle-outline" : "time-outline"} size={24} color={rentPaid ? c.success : c.warning} />
                <View><Text style={[styles.paidStatusTitle, rentUnderReview && { color: c.warning }]}>{rentPaid ? 'Rent Paid' : 'Payment Under Review'}</Text><Text style={styles.paidStatusSub}>{rentPaid ? `${currentMonthName} âœ“` : 'Waiting for owner approval'}</Text></View>
              </View>
            ) : (
              <>
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
                      {rentPaid ? 'Rent Received' : rentUnderReview ? 'Payment Awaiting Approval' : 'Rent Pending'}
                    </Text>
                    <Text style={styles.paidStatusSub}>
                      {rentPayment?.status === 'paid'
                        ? `${currentMonthName} ✓`
                        : `Waiting on ${counterpart?.full_name || 'tenant'} to pay`}
                    </Text>
                  </View>
                </View>

                {rentUnderReview ? (
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <TouchableOpacity style={[styles.primaryButton, { flex: 1, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border }]} onPress={() => reviewRentPayment(false)} disabled={reviewingRent}><Text style={[styles.primaryButtonText, { color: c.textSecondary }]}>Decline</Text></TouchableOpacity>
                    <TouchableOpacity style={[styles.primaryButton, { flex: 1 }]} onPress={() => reviewRentPayment(true)} disabled={reviewingRent}>{reviewingRent ? <ActivityIndicator color={c.text} /> : <Text style={styles.primaryButtonText}>Approve</Text>}</TouchableOpacity>
                  </View>
                ) : rentPayment?.status !== 'paid' && isRentDueWindow && (
                  <TouchableOpacity
                    style={styles.primaryButton}
                    onPress={remindTenantRent}
                    disabled={sendingRentReminder}
                  >
                    {sendingRentReminder ? (
                      <ActivityIndicator color={c.text} />
                    ) : (
                      <Text style={styles.primaryButtonText}>Remind Tenant</Text>
                    )}
                  </TouchableOpacity>
                )}
              </>
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
                currentDue?.status !== 'paid' && {
                  backgroundColor: c.warningBg,
                  borderColor: 'rgba(245,158,11,0.3)',
                },
              ]}
            >
              <Ionicons
                name={
                  currentDue?.status === 'paid'
                    ? 'checkmark-circle-outline'
                    : 'time-outline'
                }
                size={24}
                color={currentDue?.status === 'paid' ? c.success : c.warning}
              />
              <View>
                <Text
                  style={[
                    styles.paidStatusTitle,
                    currentDue?.status !== 'paid' && { color: c.warning },
                  ]}
                >
                  {currentMonthName} Maintenance — {formattedMaintenanceAmount}
                </Text>
                <Text style={styles.paidStatusSub}>
                  {currentDue?.status === 'paid'
                    ? 'Approved by committee'
                    : currentDue?.status === 'submitted'
                    ? 'Payment reported · awaiting committee approval'
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
                {currentDue?.status !== 'paid' && (
                  <TouchableOpacity
                    style={[styles.primaryButton, { marginTop: 12, backgroundColor: c.success }]}
                    onPress={notifyCommitteeOfPayment}
                    disabled={notifyingCommittee}
                  >
                    {notifyingCommittee ? (
                      <ActivityIndicator color={c.text} />
                    ) : (
                      <Text style={styles.primaryButtonText}>
                        {currentDue?.status === 'submitted' ? 'Payment Reported · Re-notify Committee' : "I've Paid — Notify Committee"}
                      </Text>
                    )}
                  </TouchableOpacity>
                )}
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

      <BuildingPickerModal
        visible={showBuildingPicker}
        onClose={() => setShowBuildingPicker(false)}
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  buildingPillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.accentSoft,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(234, 179, 8, 0.3)',
    maxWidth: 130,
  },
  buildingPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.accent,
  },
  adminModeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(234, 179, 8, 0.1)',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(234, 179, 8, 0.3)',
    marginBottom: 20,
  },
  adminModeIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(234, 179, 8, 0.18)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  adminModeTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  adminModeSub: {
    fontSize: 11.5,
    color: colors.textSecondary,
    marginTop: 2,
  },
  adminModeSwitchBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(234, 179, 8, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
  },
  adminModeSwitchText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#EAB308',
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
