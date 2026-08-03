import { useEffect, useState } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Switch,
  TextInput,
  Alert,
  ActivityIndicator,
  Modal,
  Linking,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useAuth } from '../lib/AuthContext'
import { colors } from '../lib/theme'
import { supabase } from '../lib/supabase'
import BuildingPickerModal from '../components/BuildingPickerModal'
import { getCurrentMonthStr } from '../lib/format'

const DAYS = Array.from({ length: 31 }, (_, i) => i + 1)

// Replace with your real number — country code + number, no spaces or dashes
const SUPPORT_PHONE_NUMBER = '919999999999'

function ordinal(day) {
  if (!day) return ''
  const s = ['th', 'st', 'nd', 'rd']
  const v = day % 100
  return day + (s[(v - 20) % 10] || s[v] || s[0])
}

export default function OwnerTenantScreen() {
  const { profile, signOut, isAdmin, adminBuilding, switchBuilding } = useAuth()
  const c = colors

  // Toggles state
  const [notifications, setNotifications] = useState(true)
  const [paymentReminders, setPaymentReminders] = useState(true)

  // Supabase Dynamic Data
  const [buildingInfo, setBuildingInfo] = useState(null)
  const [flatInfo, setFlatInfo] = useState(null)
  const [allBuildings, setAllBuildings] = useState([])
  const [showBuildingPicker, setShowBuildingPicker] = useState(false)

  // Owner Management Form State
  const [rentAmount, setRentAmount] = useState('')
  const [ownerUpiId, setOwnerUpiId] = useState('')
  const [maintenancePayer, setMaintenancePayer] = useState('owner') // 'owner' | 'tenant'
  const [rentDueDay, setRentDueDay] = useState(null)
  const [showDayPicker, setShowDayPicker] = useState(false)
  const [showTermsModal, setShowTermsModal] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!profile) return

    // Fetch dynamic building name
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

    // Fetch flat configuration (Rent, Owner UPI, Maintenance Payer, Rent Due Day)
    if (profile.flat_id) {
      supabase
        .from('flats')
        .select('*')
        .eq('id', profile.flat_id)
        .maybeSingle()
        .then(({ data }) => {
          if (data) {
            setFlatInfo(data)
            setRentAmount(data.rent_amount ? String(data.rent_amount) : '')
            setOwnerUpiId(data.owner_upi_id || '')
            setMaintenancePayer(data.maintenance_payer || 'owner')
            setRentDueDay(data.rent_due_day || null)
          }
        })
    }
  }, [profile])

  async function handleSaveOwnerSettings() {
    if (!flatInfo?.id) {
      Alert.alert('Error', 'Flat details not found in Supabase.')
      return
    }

    const numericRent = parseFloat(rentAmount)
    if (rentAmount && (isNaN(numericRent) || numericRent < 0)) {
      Alert.alert('Invalid Amount', 'Please enter a valid positive rent amount.')
      return
    }

    setSaving(true)
    try {
      // The current month's pending rent changes immediately. Paid rent keeps
      // its recorded amount; the new flat default takes effect next month.
      const { error: rentError } = await supabase
        .from('rent_payments')
        .update({ amount: numericRent || null })
        .eq('flat_id', flatInfo.id)
        .eq('month', getCurrentMonthStr())
        .eq('status', 'pending')
      if (rentError) throw rentError

      const { error } = await supabase
        .from('flats')
        .update({
          rent_amount: numericRent || null,
          owner_upi_id: ownerUpiId.trim() || null,
          maintenance_payer: maintenancePayer,
          rent_due_day: rentDueDay,
        })
        .eq('id', flatInfo.id)
      if (error) throw error

      Alert.alert('Settings Saved', 'Your rent and maintenance preferences were updated.')
    } catch (error) {
      Alert.alert('Could Not Save', error.message)
    } finally {
      setSaving(false)
    }
  }

  function contactSupport() {
    Alert.alert(
      'Help & Support',
      'How would you like to reach us?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'WhatsApp',
          onPress: () => {
            Linking.openURL(`https://wa.me/${SUPPORT_PHONE_NUMBER}`).catch(() =>
              Alert.alert('Could Not Open WhatsApp', 'Make sure WhatsApp is installed.')
            )
          },
        },
        {
          text: 'Call',
          onPress: () => {
            Linking.openURL(`tel:+${SUPPORT_PHONE_NUMBER}`).catch(() =>
              Alert.alert('Could Not Open Dialer', 'Try calling manually instead.')
            )
          },
        },
      ]
    )
  }

  const getInitials = name => {
    if (!name) return 'MC'
    const parts = name.split(' ')
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
    return name.slice(0, 2).toUpperCase()
  }

  const roleLabel =
    profile?.ownership === 'owner'
      ? 'Owner'
      : profile?.ownership === 'tenant'
      ? 'Tenant'
      : 'Resident'

  // Fully dynamic apartment and unit label (NO HARDCODING)
  const apartmentName = buildingInfo?.name || 'Apartment'
  const unitLabel = `${apartmentName} · Unit ${profile?.flat_number || ''}`

  async function openBuildingPicker() {
    setShowBuildingPicker(true)
    const { data } = await supabase.from('buildings').select('*').order('name')
    setAllBuildings(data || [])
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* User Profile Header with Dynamic Building & Unit Name */}
        <View style={styles.profileHeader}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>{getInitials(profile?.full_name)}</Text>
            <View style={styles.avatarSubBadge}>
              <Ionicons name="home-outline" size={10} color={c.text} />
            </View>
          </View>

          <Text style={styles.userName}>{profile?.full_name || 'Resident'}</Text>
          <Text style={styles.userRoleSub}>{roleLabel} · {unitLabel}</Text>

          <View style={[styles.memberPill, isAdmin && { backgroundColor: 'rgba(234, 179, 8, 0.15)' }]}>
            <Text style={[styles.memberPillText, isAdmin && { color: '#EAB308', fontWeight: '700' }]}>
              {isAdmin ? '👑 Admin & Operator' : profile?.role === 'committee' ? 'Committee Member' : 'Approved Resident'}
            </Text>
          </View>
        </View>

        {/* OWNER RENT & MAINTENANCE SETUP SECTION (Only for Owners) */}
        {profile?.ownership === 'owner' && (
          <>
            <Text style={styles.sectionHeader}>OWNER RENT & MAINTENANCE SETUP</Text>
            <View style={styles.groupedCard}>
              <Text style={styles.setupSubtext}>
                Set the monthly rent amount, your receiving UPI ID, the day rent is due, and choose
                who pays monthly maintenance.
              </Text>

              <Text style={styles.inputLabel}>MONTHLY RENT AMOUNT (₹)</Text>
              <TextInput
                style={styles.textInput}
                placeholder="e.g. 24500"
                placeholderTextColor={c.textTertiary}
                keyboardType="numeric"
                value={rentAmount}
                onChangeText={setRentAmount}
              />

              <Text style={styles.inputLabel}>YOUR UPI ID (TO RECEIVE RENT)</Text>
              <TextInput
                style={styles.textInput}
                placeholder="e.g. owner@upi"
                placeholderTextColor={c.textTertiary}
                autoCapitalize="none"
                value={ownerUpiId}
                onChangeText={setOwnerUpiId}
              />

              <Text style={styles.inputLabel}>RENT DUE DAY (EVERY MONTH)</Text>
              <TouchableOpacity style={styles.dayPickerButton} onPress={() => setShowDayPicker(true)}>
                <Ionicons name="calendar-outline" size={16} color={c.textSecondary} />
                <Text style={styles.dayPickerButtonText}>
                  {rentDueDay ? `${ordinal(rentDueDay)} of every month` : 'Not set'}
                </Text>
                <Ionicons name="chevron-down" size={16} color={c.textTertiary} />
              </TouchableOpacity>

              <Text style={styles.inputLabel}>WHO PAYS MONTHLY MAINTENANCE?</Text>
              <View style={styles.payerToggleRow}>
                <TouchableOpacity
                  style={[
                    styles.payerOption,
                    maintenancePayer === 'owner' && styles.payerOptionSelected,
                  ]}
                  onPress={() => setMaintenancePayer('owner')}
                >
                  <Ionicons
                    name="person-outline"
                    size={16}
                    color={maintenancePayer === 'owner' ? c.text : c.textSecondary}
                  />
                  <Text
                    style={[
                      styles.payerOptionText,
                      maintenancePayer === 'owner' && styles.payerOptionTextSelected,
                    ]}
                  >
                    I Pay
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.payerOption,
                    maintenancePayer === 'tenant' && styles.payerOptionSelected,
                  ]}
                  onPress={() => setMaintenancePayer('tenant')}
                >
                  <Ionicons
                    name="people-outline"
                    size={16}
                    color={maintenancePayer === 'tenant' ? c.text : c.textSecondary}
                  />
                  <Text
                    style={[
                      styles.payerOptionText,
                      maintenancePayer === 'tenant' && styles.payerOptionTextSelected,
                    ]}
                  >
                    Tenant Pays
                  </Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={styles.saveButton}
                onPress={handleSaveOwnerSettings}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color={c.text} />
                ) : (
                  <Text style={styles.saveButtonText}>Save Owner Settings</Text>
                )}
              </TouchableOpacity>
            </View>
          </>
        )}

        {/* ACCOUNT Grouped Section */}
        <Text style={styles.sectionHeader}>ACCOUNT</Text>
        <View style={styles.groupedCard}>
          <View style={styles.itemRow}>
            <View style={styles.itemLeft}>
              <Ionicons name="person-outline" size={18} color={c.textSecondary} />
              <Text style={styles.itemKey}>Full Name</Text>
            </View>
            <Text style={styles.itemVal}>{profile?.full_name || 'Resident'}</Text>
          </View>

          <View style={styles.itemDivider} />

          <View style={styles.itemRow}>
            <View style={styles.itemLeft}>
              <Ionicons name="shield-outline" size={18} color={c.textSecondary} />
              <Text style={styles.itemKey}>Role</Text>
            </View>
            <Text style={styles.itemVal}>{isAdmin ? 'Admin & Operator' : roleLabel}</Text>
          </View>

          <View style={styles.itemDivider} />

          <View style={styles.itemRow}>
            <View style={styles.itemLeft}>
              <Ionicons name="location-outline" size={18} color={c.textSecondary} />
              <Text style={styles.itemKey}>Unit</Text>
            </View>
            <Text style={styles.itemVal}>Flat {profile?.flat_number || ''}</Text>
          </View>
        </View>

        {/* ADMIN & NOTIFICATIONS Grouped Section */}
        {isAdmin && (
          <>
            <Text style={styles.sectionHeader}>ADMIN CONTROLS & NOTIFICATIONS</Text>
            <View style={styles.groupedCard}>
              <TouchableOpacity style={styles.itemRow} onPress={openBuildingPicker}>
                <View style={styles.itemLeft}>
                  <Ionicons name="business-outline" size={20} color={c.accent} />
                  <View>
                    <Text style={styles.itemKey}>Active Building</Text>
                    <Text style={{ fontSize: 11.5, color: c.textTertiary, marginTop: 2 }}>
                      {adminBuilding ? adminBuilding.name : (buildingInfo?.name || 'Home Building')}
                    </Text>
                  </View>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={{ color: c.accent, fontSize: 13, fontWeight: '600' }}>Switch</Text>
                  <Ionicons name="chevron-forward" size={16} color={c.accent} />
                </View>
              </TouchableOpacity>

              <View style={styles.itemDivider} />

              <View style={styles.itemRow}>
                <View style={styles.itemLeft}>
                  <Ionicons name="notifications-circle-outline" size={20} color={c.accent} />
                  <View>
                    <Text style={styles.itemKey}>Vendor Booking Alerts</Text>
                    <Text style={{ fontSize: 11.5, color: c.textTertiary, marginTop: 2 }}>
                      Push alerts delivered when residents book vendors
                    </Text>
                  </View>
                </View>
                <View style={{ backgroundColor: 'rgba(34, 197, 94, 0.15)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 }}>
                  <Text style={{ color: '#22C55E', fontSize: 11, fontWeight: '700' }}>Active</Text>
                </View>
              </View>

              <View style={styles.itemDivider} />

              <View style={styles.itemRow}>
                <View style={styles.itemLeft}>
                  <Ionicons name="key-outline" size={18} color={c.textSecondary} />
                  <Text style={styles.itemKey}>Push Token Status</Text>
                </View>
                <Text style={styles.itemVal}>{profile?.push_token ? 'Registered' : 'Pending Permission'}</Text>
              </View>
            </View>
          </>
        )}

        {/* PREFERENCES Grouped Section */}
        <Text style={styles.sectionHeader}>PREFERENCES</Text>
        <View style={styles.groupedCard}>
          <View style={styles.itemRow}>
            <View style={styles.itemLeft}>
              <Ionicons name="notifications-outline" size={18} color={c.textSecondary} />
              <Text style={styles.itemKey}>Notifications</Text>
            </View>
            <Switch
              value={notifications}
              onValueChange={setNotifications}
              trackColor={{ false: c.surfaceElevated, true: c.accent }}
              thumbColor={c.text}
            />
          </View>

          <View style={styles.itemDivider} />

          <View style={styles.itemRow}>
            <View style={styles.itemLeft}>
              <Ionicons name="card-outline" size={18} color={c.textSecondary} />
              <Text style={styles.itemKey}>Payment Reminders</Text>
            </View>
            <Switch
              value={paymentReminders}
              onValueChange={setPaymentReminders}
              trackColor={{ false: c.surfaceElevated, true: c.accent }}
              thumbColor={c.text}
            />
          </View>
        </View>

        {/* SUPPORT Grouped Section */}
        <Text style={styles.sectionHeader}>SUPPORT</Text>
        <View style={styles.groupedCard}>
          <TouchableOpacity
            style={styles.itemRow}
            onPress={contactSupport}
          >
            <View style={styles.itemLeft}>
              <Ionicons name="help-circle-outline" size={18} color={c.textSecondary} />
              <Text style={styles.itemKey}>Help & Support</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={c.textTertiary} />
          </TouchableOpacity>

          <View style={styles.itemDivider} />

          <TouchableOpacity
            style={styles.itemRow}
            onPress={() => setShowTermsModal(true)}
          >
            <View style={styles.itemLeft}>
              <Ionicons name="document-text-outline" size={18} color={c.textSecondary} />
              <Text style={styles.itemKey}>Terms & Privacy</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={c.textTertiary} />
          </TouchableOpacity>
        </View>

        {/* Sign Out Button */}
        <TouchableOpacity
          style={styles.signOutButton}
          onPress={signOut}
          activeOpacity={0.8}
        >
          <Ionicons name="log-out-outline" size={18} color={c.danger} />
          <Text style={styles.signOutButtonText}>Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Rent Due Day Picker Modal */}
      <Modal visible={showDayPicker} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalBackdrop} onPress={() => setShowDayPicker(false)} />
          <View style={styles.modalSheet}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Rent Due Day</Text>
              <TouchableOpacity onPress={() => setShowDayPicker(false)} style={styles.closeBtn}>
                <Ionicons name="close" size={18} color={c.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.pickerHint}>Rent will be shown as due on this day every month.</Text>

            <ScrollView style={styles.dayScrollList} showsVerticalScrollIndicator={false}>
              <View style={styles.dayGrid}>
                {DAYS.map(day => (
                  <TouchableOpacity
                    key={day}
                    style={[styles.dayCell, rentDueDay === day && styles.dayCellSelected]}
                    onPress={() => {
                      setRentDueDay(day)
                      setShowDayPicker(false)
                    }}
                  >
                    <Text style={[styles.dayCellText, rentDueDay === day && styles.dayCellTextSelected]}>
                      {day}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Terms & Privacy Modal */}
      <Modal visible={showTermsModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalBackdrop} onPress={() => setShowTermsModal(false)} />
          <View style={styles.modalSheet}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Terms & Privacy</Text>
              <TouchableOpacity onPress={() => setShowTermsModal(false)} style={styles.closeBtn}>
                <Ionicons name="close" size={18} color={c.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 420 }}>
              <Text style={styles.termsSectionTitle}>Community Guidelines</Text>
              <Text style={styles.termsBody}>
                Club is provided to help residents of your building manage maintenance, notices,
                visitor approval, and vendor services. By using the app, you agree to provide
                accurate flat and payment information, and to use the vendor and service request
                features responsibly.
              </Text>

              <Text style={styles.termsSectionTitle}>Payments</Text>
              <Text style={styles.termsBody}>
                Maintenance and rent payments are made directly between residents via UPI. Club
                does not process or hold funds. Payment proof uploads are used only to confirm
                payment status with your building's committee.
              </Text>

              <Text style={styles.termsSectionTitle}>Privacy</Text>
              <Text style={styles.termsBody}>
                Your name, flat number, and contact details are visible to your building's
                committee and, where relevant, your flatmate (owner/tenant). Payment proof images
                are stored securely and are only accessible to you and your committee.
              </Text>

              <Text style={styles.termsFooter}>Last updated August 2026</Text>
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
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 40,
  },
  profileHeader: {
    alignItems: 'center',
    marginBottom: 28,
  },
  avatarCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.accentSoft,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  avatarText: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.accent,
  },
  avatarSubBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.surfaceElevated,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.bg,
  },
  userName: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.3,
  },
  userRoleSub: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 4,
  },
  memberPill: {
    backgroundColor: colors.accentSoft,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    marginTop: 12,
  },
  memberPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.accent,
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
    letterSpacing: 0.8,
    marginBottom: 10,
    marginTop: 8,
  },
  groupedCard: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 20,
  },
  setupSubtext: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 16,
    lineHeight: 18,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
    letterSpacing: 0.8,
    marginBottom: 8,
    marginTop: 10,
  },
  textInput: {
    backgroundColor: colors.bg,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 48,
    fontSize: 14,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 8,
  },
  dayPickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.bg,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 48,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 8,
  },
  dayPickerButtonText: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
    fontWeight: '500',
  },
  payerToggleRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
    marginBottom: 18,
  },
  payerOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
  },
  payerOptionSelected: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  payerOptionText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  payerOptionTextSelected: {
    color: colors.text,
  },
  saveButton: {
    backgroundColor: colors.accent,
    borderRadius: 14,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 6,
  },
  saveButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
  },
  itemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  itemKey: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  itemVal: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  itemDivider: {
    height: 1,
    backgroundColor: colors.border,
  },
  signOutButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.dangerBg,
    borderRadius: 999,
    height: 52,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.3)',
    marginTop: 10,
  },
  signOutButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.danger,
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
    maxHeight: '70%',
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
    marginBottom: 8,
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
  pickerHint: {
    fontSize: 12.5,
    color: colors.textTertiary,
    marginBottom: 16,
  },
  dayScrollList: {
    maxHeight: 320,
  },
  dayGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    paddingBottom: 10,
  },
  dayCell: {
    width: '17%',
    aspectRatio: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCellSelected: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  dayCellText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  dayCellTextSelected: {
    color: colors.text,
  },
  termsSectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
    marginTop: 14,
    marginBottom: 6,
  },
  termsBody: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 19,
  },
  termsFooter: {
    fontSize: 11,
    color: colors.textTertiary,
    marginTop: 20,
    marginBottom: 10,
  },
})
