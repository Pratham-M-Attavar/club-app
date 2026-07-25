import { useCallback, useEffect, useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Linking, Alert, Switch } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import Screen from '../components/Screen'
import Card from '../components/ui/Card'
import EmptyState from '../components/ui/EmptyState'
import { colors, spacing, type } from '../lib/theme'

export default function DirectoryScreen({ navigation }) {
  const { profile } = useAuth()
  const [residents, setResidents] = useState([])
  const [showPhone, setShowPhone] = useState(!!profile?.show_in_directory)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async () => {
    if (!profile?.building_id) return
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, flat_number, phone, show_in_directory')
      .eq('building_id', profile.building_id)
      .order('flat_number')
    setResidents((data || []).filter(r => r.show_in_directory !== false))
  }, [profile])

  useEffect(() => { load() }, [load])

  async function toggleVisibility(value) {
    setShowPhone(value)
    await supabase.from('profiles').update({ show_in_directory: value }).eq('id', profile.id)
  }

  function call(phone) {
    if (!phone) return Alert.alert('No number', 'This resident has not shared their phone.')
    Linking.openURL(`tel:${phone}`)
  }

  return (
    <Screen refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false) }}>
      <TouchableOpacity style={styles.back} onPress={() => navigation.goBack()}>
        <Ionicons name="arrow-back" size={20} color={colors.accent} />
        <Text style={styles.backText}>Back</Text>
      </TouchableOpacity>

      <Text style={styles.title}>Society directory</Text>
      <Text style={styles.sub}>Opt-in listing for your neighbours</Text>

      <Card style={styles.optIn}>
        <View style={styles.optInRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.optInTitle}>Show me in directory</Text>
            <Text style={styles.optInSub}>Your flat and name will be visible to residents</Text>
          </View>
          <Switch value={showPhone} onValueChange={toggleVisibility} trackColor={{ true: colors.accent }} />
        </View>
      </Card>

      {residents.length === 0 ? (
        <EmptyState title="No listings yet" subtitle="Residents can opt in to appear here." />
      ) : (
        residents.map(r => (
          <Card key={r.id} style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{r.full_name}</Text>
              <Text style={styles.flat}>Flat {r.flat_number}</Text>
            </View>
            {r.phone && r.show_in_directory !== false ? (
              <TouchableOpacity style={styles.callBtn} onPress={() => call(r.phone)}>
                <Ionicons name="call-outline" size={16} color={colors.success} />
              </TouchableOpacity>
            ) : null}
          </Card>
        ))
      )}
    </Screen>
  )
}

const styles = StyleSheet.create({
  back: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: spacing.md },
  backText: { fontSize: 14, fontWeight: '600', color: colors.accent },
  title: { ...type.h1, color: colors.accent },
  sub: { ...type.caption, marginBottom: spacing.lg },
  optIn: { marginBottom: spacing.lg },
  optInRow: { flexDirection: 'row', alignItems: 'center' },
  optInTitle: { fontSize: 14, fontWeight: '700', color: colors.text },
  optInSub: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  row: { flexDirection: 'row', alignItems: 'center' },
  name: { fontSize: 14, fontWeight: '700', color: colors.text },
  flat: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  callBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: colors.successBg, alignItems: 'center', justifyContent: 'center',
  },
})
