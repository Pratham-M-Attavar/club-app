import { useCallback, useEffect, useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Linking, Alert } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import Screen from '../components/Screen'
import { Card, EmptyState } from '../components/UI'
import { colors, spacing, typography } from '../lib/theme'

const DEFAULT_CONTACTS = [
  { label: 'Society office', phone: '080-0000000', type: 'office' },
  { label: 'Security gate', phone: '080-0000001', type: 'security' },
  { label: 'Ambulance', phone: '108', type: 'emergency' },
  { label: 'Police', phone: '100', type: 'emergency' },
  { label: 'Fire', phone: '101', type: 'emergency' },
]

const TYPE_ICONS = {
  office: 'business-outline',
  security: 'shield-outline',
  emergency: 'medkit-outline',
  hospital: 'heart-outline',
}

export default function EmergencyContactsScreen({ navigation }) {
  const { profile } = useAuth()
  const [contacts, setContacts] = useState([])
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async () => {
    if (!profile?.building_id) return
    const { data, error } = await supabase
      .from('emergency_contacts')
      .select('*')
      .eq('building_id', profile.building_id)
      .order('label')

    setContacts(!error && data?.length ? data : DEFAULT_CONTACTS)
  }, [profile])

  useEffect(() => { load() }, [load])

  function call(phone) {
    Linking.openURL(`tel:${phone}`).catch(() => Alert.alert('Could not open dialer'))
  }

  return (
    <Screen refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false) }}>
      <TouchableOpacity style={styles.back} onPress={() => navigation.goBack()}>
        <Ionicons name="arrow-back" size={20} color={colors.primary} />
        <Text style={styles.backText}>Back</Text>
      </TouchableOpacity>

      <Text style={styles.title}>Emergency contacts</Text>
      <Text style={styles.sub}>Tap to call — available 24/7 for urgent help</Text>

      {contacts.map((c, i) => (
        <TouchableOpacity key={c.id || i} onPress={() => call(c.phone)}>
          <Card style={styles.contactCard}>
            <View style={styles.iconWrap}>
              <Ionicons name={TYPE_ICONS[c.type] || 'call-outline'} size={22} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>{c.label}</Text>
              <Text style={styles.phone}>{c.phone}</Text>
            </View>
            <Ionicons name="call" size={20} color={colors.success} />
          </Card>
        </TouchableOpacity>
      ))}
    </Screen>
  )
}

const styles = StyleSheet.create({
  back: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: spacing.md },
  backText: { fontSize: 14, fontWeight: '600', color: colors.primary },
  title: { ...typography.h1, color: colors.primary },
  sub: { ...typography.caption, marginBottom: spacing.lg },
  contactCard: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconWrap: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: colors.dangerBg, alignItems: 'center', justifyContent: 'center',
  },
  label: { fontSize: 14, fontWeight: '700', color: colors.text },
  phone: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
})
