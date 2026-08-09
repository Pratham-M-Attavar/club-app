import { useEffect, useMemo, useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator } from 'react-native'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { useTheme, spacing, radius } from '../lib/theme'

export default function ManageCommitteeScreen() {
  const { profile, isAdmin } = useAuth()
  const { colors } = useTheme()
  const styles = useMemo(() => getStyles(colors), [colors])
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
        <ActivityIndicator color={colors.accent} />
        <Text style={styles.muted}>Loading residents…</Text>
      </View>
    )
  }

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.contentContainer}>
      <Text style={styles.title}>Manage committee</Text>
      <Text style={styles.sub}>Promote a resident to committee, or step someone down.</Text>

      {residents.map(r => {
        const isPersonAdmin = r.is_admin || r.is_operator
        return (
          <View key={r.id} style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.flatNumber}>{r.flat_number} — {r.full_name}</Text>
              <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                <View style={[styles.roleChip, r.role === 'committee' ? styles.roleChipCommittee : styles.roleChipResident]}>
                  <Text style={[styles.roleText, r.role === 'committee' ? styles.roleTextCommittee : styles.roleTextResident]}>
                    {r.role}
                  </Text>
                </View>
                {isPersonAdmin && (
                  <View style={[styles.roleChip, { backgroundColor: 'rgba(234, 179, 8, 0.15)' }]}>
                    <Text style={[styles.roleText, { color: '#EAB308' }]}>Admin</Text>
                  </View>
                )}
              </View>
            </View>

            {r.id !== profile.id && !isPersonAdmin && (
              <TouchableOpacity style={styles.toggleBtn} onPress={() => toggleRole(r)}>
                <Text style={styles.toggleBtnText}>{r.role === 'committee' ? 'Step down' : 'Promote'}</Text>
              </TouchableOpacity>
            )}
          </View>
        )
      })}
    </ScrollView>
  )
}

function getStyles(colors) {
  return StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.bg },
  contentContainer: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: spacing.xxl },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  muted: { fontSize: 12, color: colors.textSecondary, marginTop: 8 },
  title: { fontSize: 20, fontWeight: '700', color: colors.text },
  sub: { fontSize: 13, color: colors.textSecondary, marginTop: 4, marginBottom: 16 },

  row: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: 14, marginBottom: 10,
  },
  flatNumber: { fontWeight: '600', fontSize: 13.5, color: colors.text, marginBottom: 6 },

  roleChip: { alignSelf: 'flex-start', paddingVertical: 3, paddingHorizontal: 10, borderRadius: radius.pill },
  roleChipCommittee: { backgroundColor: colors.warningBg },
  roleChipResident: { backgroundColor: colors.successBg },
  roleText: { fontSize: 11, fontWeight: '700' },
  roleTextCommittee: { color: colors.warning },
  roleTextResident: { color: colors.success },

  toggleBtn: { borderWidth: 1, borderColor: colors.border, borderRadius: 6, paddingVertical: 6, paddingHorizontal: 12 },
  toggleBtnText: { fontSize: 11.5, fontWeight: '700', color: colors.text },
  })
}