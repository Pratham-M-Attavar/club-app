import { useEffect, useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { colors, spacing, radius } from '../lib/theme'

const CATEGORIES = ['general', 'maintenance', 'event', 'security']
const EXPIRY_DAYS = 3

function daysRemaining(createdAt) {
  const postedAt = new Date(createdAt).getTime()
  const expiresAt = postedAt + EXPIRY_DAYS * 24 * 60 * 60 * 1000
  const msLeft = expiresAt - Date.now()
  return Math.max(0, Math.ceil(msLeft / (24 * 60 * 60 * 1000)))
}

export default function NoticesScreen() {
  const { profile } = useAuth()
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [category, setCategory] = useState('general')
  const [notices, setNotices] = useState([])
  const [error, setError] = useState('')
  const [posting, setPosting] = useState(false)
  const [deletingId, setDeletingId] = useState(null)

  async function loadNotices() {
    if (!profile?.building_id) {
      setNotices([])
      return
    }
    const { data, error: loadError } = await supabase
      .from('notices')
      .select('*')
      .eq('building_id', profile.building_id)
      .order('created_at', { ascending: false })
    if (loadError) {
      setError(loadError.message)
      return
    }
    setNotices(data || [])
  }

  useEffect(() => {
    if (profile) loadNotices()
  }, [profile])

  async function handlePost() {
    if (!title.trim()) return
    setError('')
    setPosting(true)

    const { error } = await supabase.from('notices').insert({
      title,
      body,
      category,
      posted_by: profile.id,
      building_id: profile.building_id,
    })

    if (error) {
      setError(error.message)
    } else {
      setTitle('')
      setBody('')
      setCategory('general')
      loadNotices()
    }
    setPosting(false)
  }

  function confirmDelete(notice) {
    Alert.alert('Remove Notice', `Remove "${notice.title}"? This can't be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => handleDelete(notice.id) },
    ])
  }

  async function handleDelete(noticeId) {
    setDeletingId(noticeId)
    const { error } = await supabase
      .from('notices')
      .delete()
      .eq('id', noticeId)
      .eq('building_id', profile.building_id)
    setDeletingId(null)

    if (error) {
      Alert.alert('Could Not Remove Notice', error.message)
      return
    }
    setNotices(prev => prev.filter(n => n.id !== noticeId))
  }

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.contentContainer}>
      <Text style={styles.title}>Post a notice</Text>

      <TextInput
        style={styles.input}
        placeholder="Title (e.g. Lift B under maintenance)"
        value={title}
        onChangeText={setTitle}
      />
      <TextInput
        style={styles.textArea}
        placeholder="Details (optional)"
        value={body}
        onChangeText={setBody}
        multiline
      />

      <View style={styles.categoryRow}>
        {CATEGORIES.map(c => (
          <TouchableOpacity
            key={c}
            style={category === c ? styles.categoryChipActive : styles.categoryChip}
            onPress={() => setCategory(c)}
          >
            <Text style={category === c ? styles.categoryChipTextActive : styles.categoryChipText}>{c}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <TouchableOpacity style={styles.postBtn} onPress={handlePost} disabled={posting}>
        <Text style={styles.postBtnText}>{posting ? 'Posting…' : 'Post notice'}</Text>
      </TouchableOpacity>

      <Text style={styles.sectionTitle}>All notices</Text>
      <Text style={styles.sectionHint}>Notices are automatically removed 3 days after posting.</Text>

      {notices.map(n => {
        const left = daysRemaining(n.created_at)
        return (
          <View key={n.id} style={styles.noticeRow}>
            <View style={styles.noticeHeaderRow}>
              <Text style={styles.noticeTitle}>{n.title}</Text>
              <TouchableOpacity
                onPress={() => confirmDelete(n)}
                disabled={deletingId === n.id}
                style={styles.deleteBtn}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="trash-outline" size={16} color={colors.danger} />
              </TouchableOpacity>
            </View>

            {n.body ? <Text style={styles.noticeBody}>{n.body}</Text> : null}

            <View style={styles.noticeMetaRow}>
              <Text style={styles.noticeMeta}>
                {n.category} · {new Date(n.created_at).toLocaleDateString()}
              </Text>
              <Text style={left <= 1 ? styles.expiryTextSoon : styles.expiryText}>
                {left === 0 ? 'Expires today' : `${left}d left`}
              </Text>
            </View>
          </View>
        )
      })}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.bg },
  contentContainer: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: spacing.xxl },
  title: { fontSize: 20, fontWeight: '700', color: colors.text, marginBottom: 16 },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: 12, fontSize: 14, marginBottom: 10, backgroundColor: colors.surface, color: colors.text },
  textArea: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: 12, fontSize: 14, marginBottom: 10, minHeight: 70, textAlignVertical: 'top', backgroundColor: colors.surface, color: colors.text },
  categoryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
  categoryChip: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill, paddingVertical: 6, paddingHorizontal: 12, backgroundColor: colors.surface },
  categoryChipActive: { backgroundColor: colors.accent, borderRadius: radius.pill, paddingVertical: 6, paddingHorizontal: 12 },
  categoryChipText: { fontSize: 12, color: colors.textSecondary },
  categoryChipTextActive: { fontSize: 12, color: colors.text },
  error: { color: colors.danger, fontSize: 12.5, marginBottom: 10 },
  postBtn: { backgroundColor: colors.accent, padding: 13, borderRadius: radius.md, alignItems: 'center', marginBottom: 24 },
  postBtnText: { color: colors.text, fontWeight: '700', fontSize: 13 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 4 },
  sectionHint: { fontSize: 11.5, color: colors.textSecondary, marginBottom: 10 },
  noticeRow: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: 14, marginBottom: 8 },
  noticeHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  noticeTitle: { fontWeight: '600', fontSize: 13.5, color: colors.text, flex: 1, marginRight: 10 },
  deleteBtn: { padding: 2 },
  noticeBody: { fontSize: 12.5, color: colors.textSecondary, marginTop: 4 },
  noticeMetaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  noticeMeta: { fontSize: 11.5, color: colors.textSecondary },
  expiryText: { fontSize: 11, color: colors.textTertiary, fontWeight: '600' },
  expiryTextSoon: { fontSize: 11, color: colors.warning, fontWeight: '700' },
})
