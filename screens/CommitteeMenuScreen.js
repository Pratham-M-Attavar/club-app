import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { SafeAreaView } from 'react-native-safe-area-context'
import { colors } from '../lib/theme'

const MENU_ITEMS = [
  { key: 'PendingResidents', label: 'Pending Residents', icon: 'person-add-outline' },
  { key: 'Notices', label: 'Post Notices', icon: 'megaphone-outline' },
  { key: 'Collections', label: 'Collections', icon: 'wallet-outline' },
  { key: 'MaintenanceSetup', label: 'Maintenance Setup', icon: 'construct-outline' },
  { key: 'ManageCommittee', label: 'Manage Committee', icon: 'people-outline' },
]


export default function CommitteeMenuScreen({ navigation }) {
  const c = colors

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.headerBlock}>
          <Text style={styles.titleText}>Committee Management</Text>
          <Text style={styles.subtitleText}>Manage your building in one place</Text>
        </View>

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
  headerBlock: {
    marginBottom: 20,
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