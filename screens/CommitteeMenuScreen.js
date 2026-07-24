import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native'

const MENU_ITEMS = [
  { key: 'PendingResidents', label: 'Pending Residents', icon: '🛎️' },
  { key: 'Notices', label: 'Post Notices', icon: '📣' },
  { key: 'Collections', label: 'Collections', icon: '₹' },
  { key: 'Tickets', label: 'Tickets', icon: '◎' },
  { key: 'VendorBookings', label: 'Vendor Bookings', icon: '📋' },
  { key: 'ManageCommittee', label: 'Manage Committee', icon: '👥' },
]

export default function CommitteeMenuScreen({ navigation }) {
  return (
    <ScrollView style={styles.page} contentContainerStyle={{ padding: 20 }}>
      <Text style={styles.title}>Committee</Text>
      <Text style={styles.sub}>Manage your building</Text>

      {MENU_ITEMS.map(item => (
        <TouchableOpacity
          key={item.key}
          style={styles.menuItem}
          onPress={() => navigation.navigate(item.key)}
        >
          <Text style={styles.icon}>{item.icon}</Text>
          <Text style={styles.label}>{item.label}</Text>
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#f4f1ea' },
  title: { fontSize: 22, fontWeight: '700', color: '#14262a' },
  sub: { fontSize: 13, color: '#6b7674', marginTop: 2, marginBottom: 20 },
  menuItem: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff',
    borderWidth: 1, borderColor: '#e4ddd0', borderRadius: 12, padding: 16, marginBottom: 10,
  },
  icon: { fontSize: 18, marginRight: 12 },
  label: { flex: 1, fontSize: 14, fontWeight: '600', color: '#1d2b2a' },
  chevron: { fontSize: 18, color: '#6b7674' },
})