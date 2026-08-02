import { useEffect, useState } from 'react'
import { Modal, View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { colors, radius, spacing } from '../lib/theme'

export default function BuildingPickerModal({ visible, onClose }) {
  const { realProfile, adminBuilding, switchBuilding } = useAuth()
  const c = colors
  const [buildings, setBuildings] = useState([])
  const [loading, setLoading] = useState(true)
  const [homeBuilding, setHomeBuilding] = useState(null)

  useEffect(() => {
    if (!visible) return
    let mounted = true
    setLoading(true)

    async function loadBuildings() {
      // 1. Fetch all registered buildings from public_buildings_search view (unrestricted by RLS)
      const { data: searchData } = await supabase.from('public_buildings_search').select('*').order('name')
      let list = searchData || []

      // 2. Fetch full table records if permitted and merge
      const { data: fullData } = await supabase.from('buildings').select('*').order('name')
      if (fullData && fullData.length > 0) {
        const fullMap = new Map(fullData.map(b => [b.id, b]))
        list = list.map(b => fullMap.get(b.id) || b)
      }

      if (!mounted) return
      setBuildings(list)

      if (realProfile?.building_id) {
        const home = list.find(b => b.id === realProfile.building_id)
        if (home) {
          setHomeBuilding(home)
        } else {
          const { data: homeData } = await supabase
            .from('public_buildings_search')
            .select('*')
            .eq('id', realProfile.building_id)
            .maybeSingle()
          if (mounted && homeData) setHomeBuilding(homeData)
        }
      }
      setLoading(false)
    }

    loadBuildings()
    return () => {
      mounted = false
    }
  }, [visible, realProfile])

  function handleSelect(building) {
    if (building === null || building.id === realProfile?.building_id) {
      switchBuilding(null) // Revert to resident home building
    } else {
      switchBuilding(building) // Switch to admin chosen building
    }
    onClose()
  }

  const isHomeSelected = !adminBuilding || adminBuilding.id === realProfile?.building_id

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} onPress={onClose} activeOpacity={1} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>Switch Active Building</Text>
              <Text style={styles.subtitle}>Admin & Committee multi-building switcher</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={18} color={c.textSecondary} />
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={{ padding: 40, alignItems: 'center' }}>
              <ActivityIndicator color={c.accent} size="large" />
              <Text style={{ color: c.textSecondary, marginTop: 12, fontSize: 13 }}>Loading buildings…</Text>
            </View>
          ) : (
            <ScrollView style={{ maxHeight: 400 }} showsVerticalScrollIndicator={false}>
              {/* Option 1: My Home Resident Building */}
              <TouchableOpacity
                style={[styles.buildingCard, isHomeSelected && styles.buildingCardActive]}
                onPress={() => handleSelect(null)}
                activeOpacity={0.8}
              >
                <View style={[styles.iconWrap, isHomeSelected && styles.iconWrapActive]}>
                  <Ionicons name="home" size={20} color={isHomeSelected ? c.accent : c.textSecondary} />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={styles.buildingName}>{homeBuilding?.name || 'My Home Building'}</Text>
                    <View style={styles.homeBadge}>
                      <Text style={styles.homeBadgeText}>Resident Home</Text>
                    </View>
                  </View>
                  <Text style={styles.buildingSub}>
                    Flat {realProfile?.flat_number || 'N/A'} · Personal resident account
                  </Text>
                </View>
                {isHomeSelected && (
                  <Ionicons name="checkmark-circle" size={22} color={c.accent} />
                )}
              </TouchableOpacity>

              <View style={styles.dividerRow}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>ALL BUILDINGS (ADMIN SCOPE)</Text>
                <View style={styles.dividerLine} />
              </View>

              {/* All Buildings in System */}
              {buildings.map(b => {
                const isCurrent = adminBuilding?.id === b.id || (!adminBuilding && b.id === realProfile?.building_id)
                const isHome = b.id === realProfile?.building_id

                return (
                  <TouchableOpacity
                    key={b.id}
                    style={[styles.buildingCard, isCurrent && styles.buildingCardActive]}
                    onPress={() => handleSelect(isHome ? null : b)}
                    activeOpacity={0.8}
                  >
                    <View style={[styles.iconWrap, isCurrent && styles.iconWrapActive]}>
                      <Ionicons name="business" size={20} color={isCurrent ? c.accent : c.textSecondary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={styles.buildingName}>{b.name}</Text>
                        {isHome && (
                          <View style={styles.homeBadge}>
                            <Text style={styles.homeBadgeText}>Home</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.buildingSub}>
                        {b.address || b.city || 'Building Management Scope'}
                      </Text>
                    </View>
                    {isCurrent ? (
                      <Ionicons name="checkmark-circle" size={22} color={c.accent} />
                    ) : (
                      <Ionicons name="chevron-forward" size={18} color={c.textTertiary} />
                    )}
                  </TouchableOpacity>
                )
              })}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: colors.overlay,
  },
  backdrop: {
    flex: 1,
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
    maxHeight: '75%',
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.borderStrong,
    alignSelf: 'center',
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 12.5,
    color: colors.textSecondary,
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surfaceElevated,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buildingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.bg,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 10,
  },
  buildingCardActive: {
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.surfaceElevated,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconWrapActive: {
    backgroundColor: colors.accentSoft,
  },
  buildingName: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  buildingSub: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  homeBadge: {
    backgroundColor: 'rgba(234, 179, 8, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  homeBadgeText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#EAB308',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 14,
    gap: 10,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  dividerText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: colors.textTertiary,
    letterSpacing: 0.8,
  },
})
