import { useEffect, useMemo, useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useTheme } from '../lib/theme'
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../lib/supabase'
import BuildingPickerModal from '../components/BuildingPickerModal'

const MENU_ITEMS = [
  { key: 'PendingResidents', label: 'Pending Residents', icon: 'person-add-outline' },
  { key: 'Notices', label: 'Post Notices', icon: 'megaphone-outline' },
  { key: 'Collections', label: 'Collections', icon: 'wallet-outline' },
  { key: 'MaintenanceSetup', label: 'Maintenance Setup', icon: 'construct-outline' },
  { key: 'ManageCommittee', label: 'Manage Committee', icon: 'people-outline' },
]

export default function CommitteeMenuScreen({ navigation }) {
  const { colors: c } = useTheme()
  const styles = useMemo(() => getStyles(c), [c])
  const { profile, isAdmin, adminBuilding } = useAuth()
  const [showBuildingPicker, setShowBuildingPicker] = useState(false)
  const [buildingName, setBuildingName] = useState('')

  useEffect(() => {
    if (adminBuilding?.name) {
      setBuildingName(adminBuilding.name)
    } else if (profile?.building_id) {
      supabase
        .from('public_buildings_search')
        .select('name')
        .eq('id', profile.building_id)
        .maybeSingle()
        .then(({ data }) => {
          if (data?.name) setBuildingName(data.name)
        })
    }
  }, [profile, adminBuilding])

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.headerBlock}>
          <Text style={styles.titleText}>Committee Management</Text>
          <Text style={styles.subtitleText}>Manage your building in one place</Text>
        </View>

        {/* ADMIN BUILDING SWITCHER BAR */}
        {isAdmin && (
          <TouchableOpacity
            style={styles.buildingBar}
            onPress={() => setShowBuildingPicker(true)}
            activeOpacity={0.8}
          >
            <View style={styles.buildingBarLeft}>
              <View style={styles.buildingIconWrap}>
                <Ionicons name="business" size={18} color={c.accent} />
              </View>
              <View>
                <Text style={styles.buildingBarLabel}>Active Management Scope</Text>
                <Text style={styles.buildingBarName}>
                  {adminBuilding ? adminBuilding.name : (buildingName || 'Home Building')}
                  {adminBuilding ? ' (Admin View)' : ''}
                </Text>
              </View>
            </View>

            <View style={styles.switchBadge}>
              <Text style={styles.switchBadgeText}>Switch</Text>
              <Ionicons name="swap-horizontal" size={14} color={c.accent} />
            </View>
          </TouchableOpacity>
        )}

        <View style={styles.menuList}>
          {MENU_ITEMS.map(item => (
            <TouchableOpacity
              key={item.key}
              style={styles.menuCard}
              onPress={() => navigation.navigate(item.key)}
              activeOpacity={0.8}
            >
              <View style={styles.iconWrap}>
                <Ionicons name={item.icon} size={20} color={c.accent} />
              </View>
              <Text style={styles.label}>{item.label}</Text>
              <Ionicons name="chevron-forward" size={18} color={c.textTertiary} />
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      <BuildingPickerModal
        visible={showBuildingPicker}
        onClose={() => setShowBuildingPicker(false)}
      />
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
      marginBottom: 16,
    },
    titleText: {
      fontSize: 28,
      fontWeight: '800',
      color: colors.text,
      letterSpacing: -0.5,
    },
    subtitleText: {
      fontSize: 14,
      color: colors.textSecondary,
      marginTop: 4,
    },
    buildingBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 14,
      borderWidth: 1,
      borderColor: colors.accent,
      marginBottom: 20,
    },
    buildingBarLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      flex: 1,
    },
    buildingIconWrap: {
      width: 36,
      height: 36,
      borderRadius: 10,
      backgroundColor: colors.accentSoft,
      justifyContent: 'center',
      alignItems: 'center',
    },
    buildingBarLabel: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.textTertiary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    buildingBarName: {
      fontSize: 14.5,
      fontWeight: '700',
      color: colors.text,
      marginTop: 1,
    },
    switchBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: colors.accentSoft,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 10,
    },
    switchBadgeText: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.accent,
    },
    menuList: {
      gap: 12,
    },
    menuCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: 20,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.border,
    },
    iconWrap: {
      width: 44,
      height: 44,
      borderRadius: 14,
      backgroundColor: colors.accentSoft,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 14,
    },
    label: {
      flex: 1,
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
    },
  })
}