import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native'
import { colors, spacing, radius } from '../lib/theme'

const MENU_ITEMS = [
  { key: 'PendingResidents', label: 'Pending Residents', icon: '🛎️' },
  { key: 'Notices', label: 'Post Notices', icon: '📣' },
  { key: 'Collections', label: 'Collections', icon: '₹' },
  { key: 'Tickets', label: 'Tickets', icon: '◎' },
  { key: 'VendorBookings', label: 'Vendor Bookings', icon: '📋' },
  { key: 'ManageCommittee', label: 'Manage Committee', icon: '👥' },
]

export default function CommitteeMenuScreen({ navigation }) {
  const c = colors

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.contentContainer}>
      <View style={[styles.headerCard, { borderColor: c.border }] }>
        <Text style={styles.sub}>Manage your building in one place.</Text>
      </View>

      {MENU_ITEMS.map(item => (
        <TouchableOpacity
          key={item.key}
          style={[styles.menuItem, { backgroundColor: c.surface, borderColor: c.border }]}
          onPress={() => navigation.navigate(item.key)}
        >
          <View style={[styles.iconWrap, { backgroundColor: c.accentSoft }] }>
            <Text style={styles.icon}>{item.icon}</Text>
          </View>
          <Text style={[styles.label, { color: c.text }]}>{item.label}</Text>
          <Text style={[styles.chevron, { color: c.textTertiary }]}>›</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.bg },
  contentContainer: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: spacing.xxl },
  headerCard: {
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  sub: { fontSize: 13, color: colors.textSecondary },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  icon: { fontSize: 18 },
  label: { flex: 1, fontSize: 15, fontWeight: '600' },
  chevron: { fontSize: 20, fontWeight: '600' },
})