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
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useAuth } from '../lib/AuthContext'
import { colors } from '../lib/theme'
import { supabase } from '../lib/supabase'

export default function OwnerTenantScreen() {
  const { profile, signOut } = useAuth()
  const c = colors

  // Toggles state
  const [notifications, setNotifications] = useState(true)
  const [paymentReminders, setPaymentReminders] = useState(true)

  // Supabase Dynamic Data
  const [buildingInfo, setBuildingInfo] = useState(null)
  const [flatInfo, setFlatInfo] = useState(null)

  // Owner Management Form State
  const [rentAmount, setRentAmount] = useState('')
  const [ownerUpiId, setOwnerUpiId] = useState('')
  const [maintenancePayer, setMaintenancePayer] = useState('owner') // 'owner' | 'tenant'
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

    // Fetch flat configuration (Rent, Owner UPI, Maintenance Payer)
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
    const { error } = await supabase
      .from('flats')
      .update({
        rent_amount: numericRent || null,
        owner_upi_id: ownerUpiId.trim() || null,
        maintenance_payer: maintenancePayer,
      })
      .eq('id', flatInfo.id)

    setSaving(false)

    if (error) {
      Alert.alert('Could Not Save', error.message)
      return
    }

    Alert.alert('Settings Saved', 'Your rent and maintenance preferences were updated.')
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

          <View style={styles.memberPill}>
            <Text style={styles.memberPillText}>
              {profile?.role === 'committee' ? 'Committee Member' : 'Approved Resident'}
            </Text>
          </View>
        </View>

        {/* OWNER RENT & MAINTENANCE SETUP SECTION (Only for Owners) */}
        {profile?.ownership === 'owner' && (
          <>
            <Text style={styles.sectionHeader}>OWNER RENT & MAINTENANCE SETUP</Text>
            <View style={styles.groupedCard}>
              <Text style={styles.setupSubtext}>
                Set the monthly rent amount, your receiving UPI ID, and choose who pays monthly maintenance.
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
            <Text style={styles.itemVal}>{roleLabel}</Text>
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
            onPress={() => Alert.alert('Help & Support', 'Support team is available for your apartment building.')}
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
            onPress={() => Alert.alert('Terms & Privacy', 'Building community guidelines & privacy terms.')}
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
})
