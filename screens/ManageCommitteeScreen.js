import { useEffect, useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator } from 'react-native'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'

export default function ManageCommitteeScreen() {
  const { profile } = useAuth()
  const [residents, setResidents] = useState([])
  const [loading, setLoading] = useState(true)

  async function loadResidents() {
    setLoading(true)
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('building_id', profile.building_id)
      .order('flat_number')
    setResidents(data || [])
    setLoading(false)
  }

  useEffect(() => {
    if (profile) loadResidents()
  }, [profile])

  async function toggleRole(person) {
    const newRole = person.role === 'committee' ? 'resident' : 'committee'
    await supabase.from('profiles').update({ role: newRole }).eq('id', person.id)
    loadResidents()
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator />
        <Text style={styles.muted}>Loading residents…</Text>
      </View>
    )
  }

  return (
    <ScrollView style={styles.page} contentContainerStyle={{ padding: 20 }}>
      <Text style={styles.title}>Manage committee</Text>
      <Text style={styles.sub}>Promote a resident to committee, or step someone down.</Text>

      {residents.map(r => (
        <View key={r.id} style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.flatNumber}>{r.flat_number} — {r.full_name}</Text>
            <View style={[styles.roleChip, r.role === 'committee' ? styles.roleChipCommittee : styles.roleChipResident]}>
              <Text style={[styles.roleText, r.role === 'committee' ? styles.roleTextCommittee : styles.roleTextResident]}>
                {r.role}
              </Text>
            </View>
          </View>

          {r.id !== profile.id && (
            <TouchableOpacity style={styles.toggleBtn} onPress={() => toggleRole(r)}>
              <Text style={styles.toggleBtnText}>{r.role === 'committee' ? 'Step down' : 'Promote'}</Text>
            </TouchableOpacity>
          )}
        </View>
      ))}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#f4f1ea' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f4f1ea' },
  muted: { fontSize: 12, color: '#6b7674', marginTop: 8 },
  title: { fontSize: 20, fontWeight: '700', color: '#14262a' },
  sub: { fontSize: 13, color: '#6b7674', marginTop: 4, marginBottom: 16 },

  row: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff',
    borderWidth: 1, borderColor: '#e4ddd0', borderRadius: 12, padding: 14, marginBottom: 10,
  },
  flatNumber: { fontWeight: '600', fontSize: 13.5, color: '#1d2b2a', marginBottom: 6 },

  roleChip: { alignSelf: 'flex-start', paddingVertical: 3, paddingHorizontal: 10, borderRadius: 20 },
  roleChipCommittee: { backgroundColor: '#e8d9b8' },
  roleChipResident: { backgroundColor: '#dfe9e6' },
  roleText: { fontSize: 11, fontWeight: '700' },
  roleTextCommittee: { color: '#8a641e' },
  roleTextResident: { color: '#3a6b63' },

  toggleBtn: { borderWidth: 1, borderColor: '#e4ddd0', borderRadius: 6, paddingVertical: 6, paddingHorizontal: 12 },
  toggleBtnText: { fontSize: 11.5, fontWeight: '700', color: '#1d2b2a' },
})