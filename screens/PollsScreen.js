import { useCallback, useEffect, useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import Screen from '../components/Screen'
import { Card, EmptyState, PrimaryButton, StatusBadge } from '../components/UI'
import { colors, spacing, typography } from '../lib/theme'
import { formatDate } from '../lib/format'

export default function PollsScreen({ navigation }) {
  const { profile, isCommittee } = useAuth()
  const [polls, setPolls] = useState([])
  const [votes, setVotes] = useState({})
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async () => {
    if (!profile?.building_id) return
    const { data: pollData } = await supabase
      .from('polls')
      .select('*')
      .eq('building_id', profile.building_id)
      .order('created_at', { ascending: false })

    setPolls(pollData || [])

    const { data: voteData } = await supabase
      .from('poll_votes')
      .select('poll_id, option_index')
      .eq('user_id', profile.id)

    const map = {}
    ;(voteData || []).forEach(v => { map[v.poll_id] = v.option_index })
    setVotes(map)
  }, [profile])

  useEffect(() => { load() }, [load])

  async function castVote(poll, optionIndex) {
    if (votes[poll.id] !== undefined) {
      Alert.alert('Already voted', 'You can only vote once per poll.')
      return
    }
    if (poll.ends_at && new Date(poll.ends_at) < new Date()) {
      Alert.alert('Poll closed', 'This poll has ended.')
      return
    }

    const { error } = await supabase.from('poll_votes').insert({
      poll_id: poll.id,
      user_id: profile.id,
      option_index: optionIndex,
    })

    if (error) {
      Alert.alert('Vote failed', error.message)
      return
    }
    setVotes(prev => ({ ...prev, [poll.id]: optionIndex }))
    load()
  }

  function getResults(poll) {
    const counts = (poll.options || []).map(() => 0)
    ;(poll.poll_votes || []).forEach(v => {
      if (counts[v.option_index] !== undefined) counts[v.option_index]++
    })
    const total = counts.reduce((a, b) => a + b, 0) || 1
    return counts.map(c => Math.round((c / total) * 100))
  }

  return (
    <Screen refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false) }}>
      <TouchableOpacity style={styles.back} onPress={() => navigation.goBack()}>
        <Ionicons name="arrow-back" size={20} color={colors.primary} />
        <Text style={styles.backText}>Back</Text>
      </TouchableOpacity>

      <Text style={styles.title}>Polls & voting</Text>
      <Text style={styles.sub}>AGM decisions and society surveys</Text>

      {polls.length === 0 ? (
        <EmptyState title="No active polls" subtitle="Committee can create polls for residents to vote on." />
      ) : (
        polls.map(poll => {
          const options = poll.options || []
          const hasVoted = votes[poll.id] !== undefined
          const closed = poll.ends_at && new Date(poll.ends_at) < new Date()
          const results = hasVoted || closed ? getResults(poll) : null

          return (
            <Card key={poll.id}>
              <Text style={styles.question}>{poll.question}</Text>
              <Text style={styles.meta}>
                {closed ? 'Closed' : `Open until ${formatDate(poll.ends_at)}`}
              </Text>

              {options.map((opt, i) => (
                <TouchableOpacity
                  key={i}
                  style={[
                    styles.option,
                    votes[poll.id] === i && styles.optionSelected,
                    (hasVoted || closed) && styles.optionDisabled,
                  ]}
                  onPress={() => !hasVoted && !closed && castVote(poll, i)}
                  disabled={hasVoted || closed}
                >
                  <Text style={styles.optionText}>{opt}</Text>
                  {results ? (
                    <View style={styles.resultBar}>
                      <View style={[styles.resultFill, { width: `${results[i]}%` }]} />
                      <Text style={styles.resultPct}>{results[i]}%</Text>
                    </View>
                  ) : null}
                </TouchableOpacity>
              ))}
            </Card>
          )
        })
      )}
    </Screen>
  )
}

const styles = StyleSheet.create({
  back: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: spacing.md },
  backText: { fontSize: 14, fontWeight: '600', color: colors.primary },
  title: { ...typography.h1, color: colors.primary },
  sub: { ...typography.caption, marginBottom: spacing.lg },
  question: { fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 4 },
  meta: { fontSize: 12, color: colors.textMuted, marginBottom: 12 },
  option: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  optionSelected: { borderColor: colors.primary, backgroundColor: colors.successBg },
  optionDisabled: { opacity: 0.9 },
  optionText: { fontSize: 13, fontWeight: '600', color: colors.text },
  resultBar: {
    marginTop: 8,
    height: 6,
    backgroundColor: colors.border,
    borderRadius: 3,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
  },
  resultFill: { height: '100%', backgroundColor: colors.primary },
  resultPct: { position: 'absolute', right: 0, top: 10, fontSize: 11, color: colors.textMuted },
})
