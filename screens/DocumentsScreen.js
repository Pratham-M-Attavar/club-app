import { useCallback, useEffect, useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Linking, Alert } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import Screen from '../components/Screen'
import { Card, EmptyState } from '../components/UI'
import { colors, spacing, typography } from '../lib/theme'
import { formatDate } from '../lib/format'

export default function DocumentsScreen({ navigation }) {
  const { profile } = useAuth()
  const [docs, setDocs] = useState([])
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async () => {
    if (!profile?.building_id) return
    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .eq('building_id', profile.building_id)
      .order('created_at', { ascending: false })
    if (!error) setDocs(data || [])
  }, [profile])

  useEffect(() => { load() }, [load])

  function openDoc(doc) {
    if (!doc.file_url) return Alert.alert('Unavailable', 'No file linked for this document.')
    Linking.openURL(doc.file_url).catch(() => Alert.alert('Could not open', 'Try again later.'))
  }

  return (
    <Screen refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false) }}>
      <TouchableOpacity style={styles.back} onPress={() => navigation.goBack()}>
        <Ionicons name="arrow-back" size={20} color={colors.primary} />
        <Text style={styles.backText}>Back</Text>
      </TouchableOpacity>

      <Text style={styles.title}>Documents</Text>
      <Text style={styles.sub}>By-laws, AGM minutes, and society files</Text>

      {docs.length === 0 ? (
        <EmptyState
          title="No documents yet"
          subtitle="Your committee can upload society documents here."
        />
      ) : (
        docs.map(d => (
          <TouchableOpacity key={d.id} onPress={() => openDoc(d)}>
            <Card style={styles.docRow}>
              <Ionicons name="document-text-outline" size={24} color={colors.primary} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.docTitle}>{d.title}</Text>
                <Text style={styles.docMeta}>
                  {(d.category || 'General').replace('_', ' ')} · {formatDate(d.created_at)}
                </Text>
              </View>
              <Ionicons name="open-outline" size={18} color={colors.textMuted} />
            </Card>
          </TouchableOpacity>
        ))
      )}
    </Screen>
  )
}

const styles = StyleSheet.create({
  back: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: spacing.md },
  backText: { fontSize: 14, fontWeight: '600', color: colors.primary },
  title: { ...typography.h1, color: colors.primary },
  sub: { ...typography.caption, marginBottom: spacing.lg },
  docRow: { flexDirection: 'row', alignItems: 'center' },
  docTitle: { fontSize: 14, fontWeight: '700', color: colors.text },
  docMeta: { fontSize: 12, color: colors.textMuted, marginTop: 2, textTransform: 'capitalize' },
})
