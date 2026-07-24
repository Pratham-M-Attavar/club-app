import { useCallback, useEffect, useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet, FlatList, ScrollView } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { colors, spacing, radius, type, VENDOR_CATEGORIES } from '../lib/theme'
import Card from '../components/ui/Card'
import Badge from '../components/ui/Badge'
import EmptyState from '../components/ui/EmptyState'
import { RowSkeleton } from '../components/ui/Skeleton'

export default function ServicesScreen({ navigation }) {
  const { profile } = useAuth()
  const [vendors, setVendors] = useState([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState(null)

  const loadVendors = useCallback(async () => {
    if (!profile?.building_id) return
    setLoading(true)

    // NOTE: matches your actual schema — approved (not "proved"), rating (not "ratings").
    let q = supabase
      .from('vendors')
      .select('*')
      .eq('building_id', profile.building_id)
      .eq('approved', true)
      .order('rating', { ascending: false })

    if (category) q = q.eq('category', category)

    const { data, error } = await q
    if (error) console.log('loadVendors error:', error.message)
    setVendors(data || [])
    setLoading(false)
  }, [profile, category])

  useEffect(() => {
    loadVendors()
  }, [loadVendors])

  const filtered = vendors.filter(v =>
    !query.trim() || v.name?.toLowerCase().includes(query.toLowerCase())
  )

  return (
    <ScrollView style={styles.page} contentContainerStyle={{ padding: spacing.xl }}>
      <Text style={type.display}>Services</Text>
      <Text style={[type.bodyMuted, { marginBottom: spacing.lg }]}>Trusted vendors for your society</Text>

      <TouchableOpacity onPress={() => navigation.navigate('EmergencyContacts')}>
        <View style={styles.emergencyBanner}>
          <Text style={styles.emergencyIcon}>🚨</Text>
          <Text style={styles.emergencyText}>Emergency Contacts</Text>
          <Text style={styles.emergencyChevron}>›</Text>
        </View>
      </TouchableOpacity>

      <View style={styles.searchBar}>
        <Ionicons name="search-outline" size={16} color={colors.textFaint} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search vendors…"
          placeholderTextColor={colors.textFaint}
          value={query}
          onChangeText={setQuery}
        />
      </View>

      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={[{ key: null, label: 'All', icon: 'grid-outline' }, ...VENDOR_CATEGORIES]}
        keyExtractor={item => item.key ?? 'all'}
        contentContainerStyle={{ gap: spacing.sm, marginBottom: spacing.lg }}
        renderItem={({ item }) => {
          const active = category === item.key
          return (
            <TouchableOpacity
              style={[styles.catChip, active && styles.catChipActive]}
              onPress={() => setCategory(item.key)}
            >
              <Ionicons name={item.icon} size={15} color={active ? colors.white : colors.cove} />
              <Text style={[styles.catLabel, active && styles.catLabelActive]}>{item.label}</Text>
            </TouchableOpacity>
          )
        }}
      />

      {loading ? (
        <>
          <RowSkeleton />
          <RowSkeleton />
          <RowSkeleton />
        </>
      ) : filtered.length === 0 ? (
        <EmptyState
          title="No vendors yet"
          subtitle="Vendors for your building will appear here once onboarded."
        />
      ) : (
        filtered.map(v => (
          <TouchableOpacity key={v.id} onPress={() => navigation.navigate('VendorDetail', { vendor: v })}>
            <Card>
              <View style={styles.vendorRow}>
                <View style={styles.vendorIcon}>
                  <Ionicons name="construct-outline" size={20} color={colors.cove} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.vendorName}>{v.name}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                    <Badge label={formatCategory(v.category)} tone="cove" />
                    <Text style={type.caption}>{v.jobs_completed || 0} jobs done</Text>
                  </View>
                  <StarRating rating={v.rating} />
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
              </View>
            </Card>
          </TouchableOpacity>
        ))
      )}
    </ScrollView>
  )
}

function formatCategory(key) {
  const found = VENDOR_CATEGORIES.find(c => c.key === key)
  return found ? found.label : key
}

function StarRating({ rating }) {
  const value = Math.round(rating || 0)
  return (
    <View style={{ flexDirection: 'row', marginTop: 4 }}>
      {[1, 2, 3, 4, 5].map(i => (
        <Ionicons
          key={i}
          name={i <= value ? 'star' : 'star-outline'}
          size={12}
          color={colors.warning}
          style={{ marginRight: 1 }}
        />
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.paper },
  emergencyBanner: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.lateriteSoft, borderRadius: radius.md,
    padding: spacing.md, marginBottom: spacing.lg,
  },
  emergencyIcon: { fontSize: 18 },
  emergencyText: { flex: 1, fontSize: 14, fontWeight: '700', color: colors.lateriteDark },
  emergencyChevron: { fontSize: 20, color: colors.lateriteDark },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.lg,
  },
  searchInput: { flex: 1, paddingVertical: spacing.md, fontSize: 14, color: colors.ink },
  catChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  catChipActive: { backgroundColor: colors.cove, borderColor: colors.cove },
  catLabel: { fontSize: 12, fontWeight: '600', color: colors.cove },
  catLabelActive: { color: colors.white },
  vendorRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  vendorIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.coveSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vendorName: { fontSize: 15, fontWeight: '700', color: colors.ink },
})