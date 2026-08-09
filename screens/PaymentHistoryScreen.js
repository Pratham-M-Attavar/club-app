import { useEffect, useMemo, useState } from 'react'
import { View, Text, StyleSheet, ScrollView } from 'react-native'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { useTheme, spacing } from '../lib/theme'
import { generateReceipt } from '../lib/receipt'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import EmptyState from '../components/ui/EmptyState'
import { RowSkeleton } from '../components/ui/Skeleton'

const MONTHS_TO_SHOW = 12

export default function PaymentHistoryScreen() {
  const { profile } = useAuth()
  const { colors, type } = useTheme()
  const styles = useMemo(() => getStyles(colors, type), [colors, type])
  const [dues, setDues] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!profile) return

    const cutoff = new Date()
    cutoff.setMonth(cutoff.getMonth() - MONTHS_TO_SHOW)

    setLoading(true)
    supabase
      .from('dues')
      .select('*')
      .eq('flat_number', profile.flat_number)
      .gte('month', cutoff.toISOString().slice(0, 10))
      .order('month', { ascending: false })
      .then(({ data, error }) => {
        if (error) console.log('PaymentHistory load error:', error.message)
        setDues(data || [])
        setLoading(false)
      })
  }, [profile])

  return (
    <ScrollView style={styles.page} contentContainerStyle={{ padding: spacing.xl }}>
      <Text style={[type.bodyMuted, { marginBottom: spacing.lg }]}>Last {MONTHS_TO_SHOW} months, Flat {profile?.flat_number}</Text>

      {loading ? (
        <Card>
          <RowSkeleton />
          <RowSkeleton />
          <RowSkeleton />
        </Card>
      ) : dues.length === 0 ? (
        <Card>
          <EmptyState title="No payment history yet" subtitle="Once dues are generated for your flat, they'll show up here month by month." />
        </Card>
      ) : (
        dues.map(due => (
          <Card key={due.id}>
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.monthLabel}>
                  {new Date(due.month).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
                </Text>
                <Text style={styles.amount}>₹{due.total}</Text>
              </View>
              <Badge label={due.status} tone={due.status === 'paid' ? 'success' : due.status === 'submitted' ? 'warning' : 'cove'} />
            </View>

            {due.status === 'paid' && (
              <Button
                label="Download receipt →"
                onPress={() => generateReceipt(due, profile)}
                variant="outline"
                style={{ marginTop: spacing.md }}
              />
            )}
          </Card>
        ))
      )}
    </ScrollView>
  )
}

function getStyles(colors, type) {
  return StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.bg },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  monthLabel: { ...type.eyebrow, marginBottom: 4 },
  amount: { fontSize: 20, fontWeight: '700', color: colors.text },
  })
}