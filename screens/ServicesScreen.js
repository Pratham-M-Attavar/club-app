import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  FlatList,
  Alert,
  ActivityIndicator,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { SafeAreaView } from 'react-native-safe-area-context'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { notifyOperatorOfBooking } from '../lib/notifyOperator'
import { useTheme, VENDOR_CATEGORIES } from '../lib/theme'

export default function ServicesScreen({ navigation }) {
  const { profile } = useAuth()
  const { colors: c } = useTheme()
  const styles = useMemo(() => getStyles(c), [c])

  const [vendors, setVendors] = useState([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [selectedCat, setSelectedCat] = useState(null)
  const [requestingCat, setRequestingCat] = useState(null)

  const loadVendors = useCallback(async () => {
    if (!profile?.building_id) return
    setLoading(true)

    let q = supabase
      .from('vendors')
      .select('*')
      .eq('building_id', profile.building_id)
      .eq('approved', true)
      .order('rating', { ascending: false })

    if (selectedCat) q = q.eq('category', selectedCat)

    const { data } = await q
    setVendors(data || [])
    setLoading(false)
  }, [profile, selectedCat])

  useEffect(() => {
    loadVendors()
  }, [loadVendors])

  function confirmRequestService(catKey, catLabel) {
    Alert.alert(
      `Request ${catLabel}?`,
      `We'll call you shortly to arrange a ${catLabel.toLowerCase()} professional.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Yes, Request', onPress: () => requestService(catKey, catLabel) },
      ]
    )
  }

  async function requestService(catKey, catLabel) {
    if (!profile?.building_id || !profile?.flat_id) {
      Alert.alert('Error', 'Your flat details are missing from your profile.')
      return
    }
    setRequestingCat(catKey)

    const { error: requestError } = await supabase.from('service_requests').insert({
      building_id: profile.building_id,
      flat_id: profile.flat_id,
      requested_by: profile.id,
      category: catKey,
    })

    const { error: bookingError, data: bookingData } = await supabase.from('vendor_bookings').insert({
      building_id: profile.building_id,
      resident_id: profile.id,
      booked_by: profile.id,
      flat_number: profile.flat_number,
      category: catKey,
      status: 'requested',
    }).select('id').single()

    setRequestingCat(null)

    if (requestError && bookingError) {
      Alert.alert('Could Not Send Request', requestError.message || bookingError.message)
      return
    }

    notifyOperatorOfBooking(bookingData?.id || null, { category: catLabel })

    navigation.navigate('ServiceContact', { categoryLabel: catLabel })
  }

  const filtered = vendors.filter(v =>
    !query.trim() || v.name?.toLowerCase().includes(query.toLowerCase())
  )

  const GRID_CATEGORIES = [
    { key: 'cleaning', label: 'Cleaning', icon: 'sparkles-outline' },
    { key: 'electrical', label: 'Electrical', icon: 'flash-outline' },
    { key: 'plumbing', label: 'Plumbing', icon: 'water-outline' },
    { key: 'Scrap', label: 'Scrap', icon: 'cube-outline' },
    { key: 'security', label: 'Security', icon: 'shield-checkmark-outline' },
    { key: 'housekeeping', label: 'Housekeeping', icon: 'home-outline' },
  ]

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Title Header matching Page 2 */}
        <View style={styles.headerBlock}>
          <Text style={styles.titleText}>Services</Text>
          <Text style={styles.subtitleText}>Book building services instantly</Text>
        </View>

        {/* Search Bar matching Page 2 */}
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={18} color={c.textTertiary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search services..."
            placeholderTextColor={c.textTertiary}
            value={query}
            onChangeText={setQuery}
          />
        </View>

        {/* 3-Column Category Grid matching Page 2 */}
        <View style={styles.categoryGrid}>
          {GRID_CATEGORIES.map(cat => {
            const isSelected = selectedCat === cat.key
            return (
              <TouchableOpacity
                key={cat.key}
                style={[
                  styles.gridCard,
                  isSelected && styles.gridCardSelected,
                  cat.unavailable && styles.gridCardDisabled,
                ]}
                onPress={() => {
                  if (cat.unavailable || requestingCat) return
                  confirmRequestService(cat.key, cat.label)
                }}
                activeOpacity={cat.unavailable ? 1 : 0.8}
                disabled={requestingCat !== null}
              >
                <View style={[styles.gridIconWrap, isSelected && styles.gridIconWrapSelected]}>
                  {requestingCat === cat.key ? (
                    <ActivityIndicator size="small" color={c.accent} />
                  ) : (
                    <Ionicons
                      name={cat.icon}
                      size={22}
                      color={cat.unavailable ? c.textTertiary : c.accent}
                    />
                  )}
                </View>
                <Text
                  style={[
                    styles.gridLabel,
                    cat.unavailable && styles.gridLabelDisabled,
                    isSelected && styles.gridLabelSelected,
                  ]}
                >
                  {cat.label}
                </Text>
                {cat.unavailable && (
                  <Text style={styles.unavailableText}>Unavailable</Text>
                )}
              </TouchableOpacity>
            )
          })}
        </View>

        {/* Emergency Contacts Banner */}
        <TouchableOpacity
          style={styles.emergencyBanner}
          onPress={() => navigation.navigate('EmergencyContacts')}
          activeOpacity={0.8}
        >
          <View style={styles.emergencyLeft}>
            <View style={styles.emergencyIconWrap}>
              <Ionicons name="call-outline" size={18} color={c.danger} />
            </View>
            <View>
              <Text style={styles.emergencyTitle}>Emergency Contacts</Text>
              <Text style={styles.emergencySub}>Security guard, lift manager, fire desk</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={18} color={c.textTertiary} />
        </TouchableOpacity>

        {/* My Vendor Bookings Banner */}
        <TouchableOpacity
          style={[styles.emergencyBanner, { marginTop: 12 }]}
          onPress={() => navigation.navigate('VendorBookings')}
          activeOpacity={0.8}
        >
          <View style={styles.emergencyLeft}>
            <View style={[styles.emergencyIconWrap, { backgroundColor: c.accentSoft }]}>
              <Ionicons name="briefcase-outline" size={18} color={c.accent} />
            </View>
            <View>
              <Text style={styles.emergencyTitle}>Vendor Bookings</Text>
              <Text style={styles.emergencySub}>Track requested services and status</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={18} color={c.textTertiary} />
        </TouchableOpacity>
        {/* Vendor List for Selected Category / Search */}
        {selectedCat || query.trim() ? (
          <View style={{ marginTop: 24 }}>
            <Text style={styles.sectionTitle}>
              AVAILABLE VENDORS ({filtered.length})
            </Text>
            {filtered.length === 0 ? (
              <Text style={styles.noVendorsText}>
                No vendors found for this category.
              </Text>
            ) : (
              filtered.map(v => (
                <TouchableOpacity
                  key={v.id}
                  style={styles.vendorCard}
                  onPress={() => navigation.navigate('VendorDetail', { vendor: v })}
                >
                  <View style={styles.vendorIconWrap}>
                    <Ionicons name="construct-outline" size={20} color={c.accent} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.vendorName}>{v.name}</Text>
                    <Text style={styles.vendorSub}>
                      {v.jobs_completed || 0} jobs done · {v.rating || 4.8} ★
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={c.textTertiary} />
                </TouchableOpacity>
              ))
            )}
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  )
}

function getStyles(colors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.bg,
    },
    scrollContent: {
      paddingHorizontal: 20,
      paddingTop: 16,
      paddingBottom: 30,
    },
    headerBlock: {
      marginBottom: 20,
    },
    titleText: {
      fontSize: 32,
      fontWeight: '800',
      color: colors.text,
      letterSpacing: -0.6,
    },
    subtitleText: {
      fontSize: 14,
      color: colors.textSecondary,
      marginTop: 4,
    },
    searchBar: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: 16,
      paddingHorizontal: 16,
      height: 52,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 24,
      gap: 10,
    },
    searchInput: {
      flex: 1,
      fontSize: 15,
      color: colors.text,
    },
    categoryGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
      marginBottom: 20,
    },
    gridCard: {
      width: '30.5%',
      aspectRatio: 1,
      backgroundColor: colors.surface,
      borderRadius: 20,
      padding: 12,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.border,
    },
    gridCardSelected: {
      borderColor: colors.accent,
      backgroundColor: colors.surfaceElevated,
    },
    gridCardDisabled: {
      opacity: 0.45,
    },
    gridIconWrap: {
      width: 44,
      height: 44,
      borderRadius: 14,
      backgroundColor: colors.accentSoft,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 10,
    },
    gridIconWrapSelected: {
      backgroundColor: colors.accent,
    },
    gridLabel: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.text,
      textAlign: 'center',
    },
    gridLabelSelected: {
      color: colors.text,
    },
    gridLabelDisabled: {
      color: colors.textTertiary,
    },
    unavailableText: {
      fontSize: 10,
      color: colors.textTertiary,
      marginTop: 2,
    },
    emergencyBanner: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.border,
    },
    emergencyLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    emergencyIconWrap: {
      width: 36,
      height: 36,
      borderRadius: 10,
      backgroundColor: colors.dangerBg,
      justifyContent: 'center',
      alignItems: 'center',
    },
    emergencyTitle: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.text,
    },
    emergencySub: {
      fontSize: 12,
      color: colors.textTertiary,
      marginTop: 2,
    },
    sectionTitle: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.textSecondary,
      letterSpacing: 0.8,
      marginBottom: 12,
    },
    noVendorsText: {
      fontSize: 14,
      color: colors.textTertiary,
    },
    vendorCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 16,
      marginBottom: 10,
      borderWidth: 1,
      borderColor: colors.border,
    },
    vendorIconWrap: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: colors.accentSoft,
      justifyContent: 'center',
      alignItems: 'center',
    },
    vendorName: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.text,
    },
    vendorSub: {
      fontSize: 12,
      color: colors.textTertiary,
      marginTop: 2,
    },
  })
}