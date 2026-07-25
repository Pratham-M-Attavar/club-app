import { useEffect, useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Alert } from 'react-native'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { colors, spacing, radius, type } from '../lib/theme'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import EmptyState from '../components/ui/EmptyState'

export default function PendingResidentsScreen() {
  const { profile } = useAuth()
  const [pending, setPending] = useState([])
  const [loading, setLoading] = useState(true)
  const [actingOn, setActingOn] = useState(null)

  async function loadPending() {
    setLoading(true)
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('building_id', profile.building_id)
      .eq('approval_status', 'pending')
      .order('flat_number')

    if (error) console.log('loadPending error:', error.message)
    setPending(data || [])
    setLoading(false)
  }

  useEffect(() => {
    if (profile) loadPending()
  }, [profile])

  async function decide(residentId, decision) {
    setActingOn(residentId)
    const { error } = await supabase
      .from('profiles')
      .update({ approval_status: decision })
      .eq('id', residentId)

    setActingOn(null)
    if (error) {
      Alert.alert('Could not update', error.message)
      return
    }
    loadPending()
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator />
        <Text style={type.bodyMuted}>Loading pending residents…</Text>
      </View>
    )
  }

  return (
    <ScrollView style={styles.page} contentContainerStyle={{ padding: spacing.xl }}>
      <Text style={type.display}>Pending residents</Text>
      <Text style={[type.bodyMuted, { marginBottom: spacing.lg }]}>New sign-ups waiting on your approval.</Text>

      {pending.length === 0 ? (
        <EmptyState title="All caught up" subtitle="No new resident sign-ups are waiting right now." />
      ) : (
        pending.map(r => (
          <Card key={r.id}>
            <Text style={styles.name}>{r.full_name}</Text>
            <Text style={type.bodyMuted}>
              Flat {r.flat_number} · {r.ownership === 'owner' ? 'Owner' : 'Tenant'}
            </Text>
            {r.phone && <Text style={type.caption}>{r.phone}</Text>}

            <View style={styles.actionsRow}>
              <Button
                label={actingOn === r.id ? '…' : 'Approve'}
                onPress={() => decide(r.id, 'approved')}
                disabled={actingOn === r.id}
                variant="primary"
                style={{ flex: 1 }}
              />
              <Button
                label="Reject"
                onPress={() => decide(r.id, 'rejected')}
                disabled={actingOn === r.id}
                variant="outline"
                style={{ flex: 1 }}
              />
            </View>
          </Card>
        ))
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.bg },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  name: { fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 2 },
  actionsRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
})