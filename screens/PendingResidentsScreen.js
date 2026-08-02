import { useEffect, useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Alert, RefreshControl } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { colors, spacing, radius, type } from '../lib/theme'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import EmptyState from '../components/ui/EmptyState'

export default function PendingResidentsScreen() {
  const { profile, adminBuilding } = useAuth()
  const [pending, setPending] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [actingOn, setActingOn] = useState(null)
  const [buildingName, setBuildingName] = useState('')

  async function loadPending() {
    if (!profile?.building_id) return
    setLoading(true)

    // Load active building name
    if (adminBuilding?.name) {
      setBuildingName(adminBuilding.name)
    } else {
      supabase
        .from('public_buildings_search')
        .select('name')
        .eq('id', profile.building_id)
        .maybeSingle()
        .then(({ data }) => {
          if (data?.name) setBuildingName(data.name)
        })
    }

    // Query unapproved / pending residents for this building
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('building_id', profile.building_id)
      .or('approval_status.eq.pending,approval_status.is.null,approval_status.neq.approved')
      .order('flat_number', { ascending: true })

    if (error) {
      console.log('loadPending error:', error.message)
    }
    // Filter out already approved or rejected profiles
    const filtered = (data || []).filter(r => r.approval_status !== 'approved' && r.approval_status !== 'rejected')
    setPending(filtered)
    setLoading(false)
  }

  useEffect(() => {
    if (profile) loadPending()
  }, [profile, adminBuilding])

  async function handleRefresh() {
    setRefreshing(true)
    await loadPending()
    setRefreshing(false)
  }

  async function decide(residentId, decision) {
    setActingOn(residentId)
    const { error } = await supabase
      .from('profiles')
      .update({ approval_status: decision })
      .eq('id', residentId)

    setActingOn(null)
    if (error) {
      Alert.alert('Could Not Update Status', error.message)
      return
    }
    Alert.alert('Resident Updated', `Resident has been ${decision}.`)
    loadPending()
  }

  if (loading && !refreshing) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.accent} size="large" />
        <Text style={[type.bodyMuted, { marginTop: 12 }]}>Loading pending residents…</Text>
      </View>
    )
  }

  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={{ padding: spacing.xl }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          tintColor={colors.accent}
        />
      }
    >
      <Text style={type.display}>Pending residents</Text>
      <Text style={[type.bodyMuted, { marginBottom: spacing.md }]}>
        New sign-ups waiting on your approval.
      </Text>

      {buildingName ? (
        <View style={styles.buildingScopeTag}>
          <Ionicons name="business" size={14} color={colors.accent} />
          <Text style={styles.buildingScopeText}>Building: {buildingName}</Text>
        </View>
      ) : null}

      {pending.length === 0 ? (
        <EmptyState
          title="All caught up"
          subtitle={`No new resident sign-ups waiting for ${buildingName || 'this building'}.`}
        />
      ) : (
        pending.map(r => (
          <Card key={r.id} style={{ marginBottom: spacing.md }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={styles.name}>{r.full_name}</Text>
              <View style={styles.pendingBadge}>
                <Text style={styles.pendingBadgeText}>Pending</Text>
              </View>
            </View>

            <Text style={[type.bodyMuted, { marginTop: 4 }]}>
              Flat {r.flat_number || 'N/A'} · {r.ownership === 'owner' ? 'Owner' : 'Tenant'}
            </Text>
            {r.phone && <Text style={[type.caption, { marginTop: 2 }]}>{r.phone}</Text>}

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
  name: { fontSize: 16, fontWeight: '700', color: colors.text },
  actionsRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
  buildingScopeTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.accentSoft,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginBottom: spacing.lg,
  },
  buildingScopeText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: colors.accent,
  },
  pendingBadge: {
    backgroundColor: colors.warningBg,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  pendingBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.warning,
  },
})