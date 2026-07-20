import { useEffect, useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView } from 'react-native'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'

const CATEGORIES = ['general', 'maintenance', 'event', 'security']

export default function NoticesScreen() {
  const { profile } = useAuth()
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [category, setCategory] = useState('general')
  const [notices, setNotices] = useState([])
  const [error, setError] = useState('')
  const [posting, setPosting] = useState(false)

  async function loadNotices() {
    const { data } = await supabase
      .from('notices')
      .select('*')
      .eq('building_id', profile.building_id)
      .order('created_at', { ascending: false })
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

  return (
    <ScrollView style={styles.page} contentContainerStyle={{ padding: 20 }}>
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
      {notices.map(n => (
        <View key={n.id} style={styles.noticeRow}>
          <Text style={styles.noticeTitle}>{n.title}</Text>
          {n.body ? <Text style={styles.noticeBody}>{n.body}</Text> : null}
          <Text style={styles.noticeMeta}>{n.category} · {new Date(n.created_at).toLocaleDateString()}</Text>
        </View>
      ))}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#f4f1ea' },
  title: { fontSize: 20, fontWeight: '700', color: '#14262a', marginBottom: 16 },
  input: { borderWidth: 1, borderColor: '#e4ddd0', borderRadius: 9, padding: 12, fontSize: 14, marginBottom: 10, backgroundColor: '#fff' },
  textArea: { borderWidth: 1, borderColor: '#e4ddd0', borderRadius: 9, padding: 12, fontSize: 14, marginBottom: 10, minHeight: 70, textAlignVertical: 'top', backgroundColor: '#fff' },
  categoryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
  categoryChip: { borderWidth: 1, borderColor: '#e4ddd0', borderRadius: 20, paddingVertical: 6, paddingHorizontal: 12, backgroundColor: '#fff' },
  categoryChipActive: { backgroundColor: '#14262a', borderRadius: 20, paddingVertical: 6, paddingHorizontal: 12 },
  categoryChipText: { fontSize: 12, color: '#1d2b2a' },
  categoryChipTextActive: { fontSize: 12, color: '#fff' },
  error: { color: '#b5533c', fontSize: 12.5, marginBottom: 10 },
  postBtn: { backgroundColor: '#14262a', padding: 13, borderRadius: 9, alignItems: 'center', marginBottom: 24 },
  postBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#14262a', marginBottom: 10 },
  noticeRow: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e4ddd0', borderRadius: 10, padding: 14, marginBottom: 8 },
  noticeTitle: { fontWeight: '600', fontSize: 13.5, color: '#1d2b2a' },
  noticeBody: { fontSize: 12.5, color: '#4a5654', marginTop: 4 },
  noticeMeta: { fontSize: 11.5, color: '#6b7674', marginTop: 6 },
})
