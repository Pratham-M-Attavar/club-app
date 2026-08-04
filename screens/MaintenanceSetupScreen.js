import { useEffect, useState } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useAuth } from '../lib/AuthContext'
import { colors } from '../lib/theme'
import { supabase } from '../lib/supabase'

export default function MaintenanceSetupScreen({ navigation }) {
  const { profile } = useAuth()
  const c = colors

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // 'same' = one amount applied to every flat in the building
  // 'per_flat' = committee sets an amount for each flat individually
  const [mode, setMode] = useState('same')

  const [uniformAmount, setUniformAmount] = useState('')
  const [maintenanceDueDay, setMaintenanceDueDay] = useState('')
  const [savingDueDay, setSavingDueDay] = useState(false)
  const [flats, setFlats] = useState([])
  // Per-flat draft amounts, keyed by flat id, so typing doesn't
  // re-fetch or lose other rows' edits.
  const [flatAmounts, setFlatAmounts] = useState({})

  useEffect(() => {
    if (profile?.building_id) loadFlats()
  }, [profile])

  async function loadFlats() {
    setLoading(true)
    const { data, error } = await supabase
      .from('flats')
      .select('id, flat_number, maintenance_amount')
      .eq('building_id', profile.building_id)
      .order('flat_number', { ascending: true })

    if (error) {
      Alert.alert('Could Not Load Flats', error.message)
      setLoading(false)
      return
    }

    setFlats(data || [])

    const draft = {}
      ; (data || []).forEach(f => {
        draft[f.id] = f.maintenance_amount != null ? String(f.maintenance_amount) : ''
      })
    setFlatAmounts(draft)

    const { data: building } = await supabase
      .from('buildings')
      .select('maintenance_due_day')
      .eq('id', profile.building_id)
      .maybeSingle()
    setMaintenanceDueDay(building?.maintenance_due_day ? String(building.maintenance_due_day) : '')

    setLoading(false)
  }
  function getCurrentMonthStr() {
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    return `${year}-${month}-01`
  }
  function updateFlatAmount(flatId, value) {
    setFlatAmounts(prev => ({ ...prev, [flatId]: value }))
  }

  async function saveMaintenanceDueDay() {
    const day = parseInt(maintenanceDueDay, 10)
    if (!Number.isInteger(day) || day < 1 || day > 31) {
      Alert.alert('Invalid Due Date', 'Enter a day from 1 to 31.')
      return
    }
    setSavingDueDay(true)
    const { error } = await supabase
      .from('buildings')
      .update({ maintenance_due_day: day })
      .eq('id', profile.building_id)
    setSavingDueDay(false)
    if (error) return Alert.alert('Could Not Save Due Date', error.message)
    Alert.alert('Saved', `Maintenance will be due on the ${day}${day === 1 || day === 21 || day === 31 ? 'st' : day === 2 || day === 22 ? 'nd' : day === 3 || day === 23 ? 'rd' : 'th'} of every month.`)
  }

  // Update the active unpaid due before the flat's default. That way, a
  // resident who is looking at the home card never sees an old current-month
  // due after seeing the new default amount. Paid/submitted dues are left
  // alone; the new flat amount is then used for the following month.
  async function updateCurrentPendingDue(flatNumber, amount) {
    const { error } = await supabase
      .from('dues')
      .update({ maintenance: amount, total: amount })
      .eq('building_id', profile.building_id)
      .eq('flat_number', flatNumber)
      .eq('month', getCurrentMonthStr())
      .eq('status', 'pending')

    if (error) throw error
  }

  async function handleSaveSameForAll() {
    const numeric = parseFloat(uniformAmount)
    if (!uniformAmount || isNaN(numeric) || numeric < 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid maintenance amount.')
      return
    }

    setSaving(true)
    try {
      await Promise.all(flats.map(flat => updateCurrentPendingDue(flat.flat_number, numeric)))

      const { error } = await supabase
        .from('flats')
        .update({ maintenance_amount: numeric })
        .eq('building_id', profile.building_id)

      if (error) throw error

      Alert.alert('Saved', 'Maintenance amount updated for every flat.')
      loadFlats()
    } catch (error) {
      Alert.alert('Could Not Save', error.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleSavePerFlat() {
    // Validate every entered value before writing anything.
    for (const f of flats) {
      const raw = flatAmounts[f.id]
      if (raw === '' || raw === undefined) continue // leaving a flat blank just skips it
      const numeric = parseFloat(raw)
      if (isNaN(numeric) || numeric < 0) {
        Alert.alert('Invalid Amount', `Flat ${f.flat_number} has an invalid amount.`)
        return
      }
    }

    setSaving(true)
    try {
      const changedFlats = flats.filter(f => flatAmounts[f.id] !== '' && flatAmounts[f.id] !== undefined)

      await Promise.all(changedFlats.map(flat =>
        updateCurrentPendingDue(flat.flat_number, parseFloat(flatAmounts[flat.id]))
      ))

      const results = await Promise.all(changedFlats.map(flat =>
        supabase
          .from('flats')
          .update({ maintenance_amount: parseFloat(flatAmounts[flat.id]) })
          .eq('id', flat.id)
      ))
      const failed = results.find(result => result.error)
      if (failed) throw failed.error

      Alert.alert('Saved', 'Maintenance amounts updated.')
      loadFlats()
    } catch (error) {
      Alert.alert('Could Not Save Some Flats', error.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={c.accent} size="large" />
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={22} color={c.text} />
          </TouchableOpacity>
          <Text style={styles.titleText}>Maintenance Setup</Text>
        </View>
        <Text style={styles.subtitleText}>
          Decide how the monthly maintenance amount is set for this building.
        </Text>

        <View style={[styles.card, { marginBottom: 20 }]}>
          <Text style={styles.inputLabel}>MAINTENANCE DUE DAY (SAME FOR EVERY FLAT)</Text>
          <TextInput style={styles.textInput} placeholder="e.g. 10" placeholderTextColor={c.textTertiary} keyboardType="number-pad" value={maintenanceDueDay} onChangeText={setMaintenanceDueDay} />
          <Text style={styles.helperText}>Residents in this building will all see this same monthly due date.</Text>
          <TouchableOpacity style={styles.saveButton} onPress={saveMaintenanceDueDay} disabled={savingDueDay}>
            {savingDueDay ? <ActivityIndicator color={c.text} /> : <Text style={styles.saveButtonText}>Save Due Date</Text>}
          </TouchableOpacity>
        </View>

        {/* Mode Toggle */}
        <View style={styles.modeToggleRow}>
          <TouchableOpacity
            style={[styles.modeOption, mode === 'same' && styles.modeOptionSelected]}
            onPress={() => setMode('same')}
          >
            <Ionicons
              name="people-outline"
              size={16}
              color={mode === 'same' ? c.text : c.textSecondary}
            />
            <Text style={[styles.modeOptionText, mode === 'same' && styles.modeOptionTextSelected]}>
              Same for Everyone
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.modeOption, mode === 'per_flat' && styles.modeOptionSelected]}
            onPress={() => setMode('per_flat')}
          >
            <Ionicons
              name="home-outline"
              size={16}
              color={mode === 'per_flat' ? c.text : c.textSecondary}
            />
            <Text
              style={[styles.modeOptionText, mode === 'per_flat' && styles.modeOptionTextSelected]}
            >
              Set Per Flat
            </Text>
          </TouchableOpacity>
        </View>

        {mode === 'same' ? (
          <View style={styles.card}>
            <Text style={styles.inputLabel}>MONTHLY MAINTENANCE AMOUNT (₹)</Text>
            <TextInput
              style={styles.textInput}
              placeholder="e.g. 2800"
              placeholderTextColor={c.textTertiary}
              keyboardType="numeric"
              value={uniformAmount}
              onChangeText={setUniformAmount}
            />
            <Text style={styles.helperText}>
              This will apply to all {flats.length} flat{flats.length === 1 ? '' : 's'} in this
              building and overwrite any per-flat amounts previously set.
            </Text>

            <TouchableOpacity
              style={styles.saveButton}
              onPress={handleSaveSameForAll}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color={c.text} />
              ) : (
                <Text style={styles.saveButtonText}>Apply to All Flats</Text>
              )}
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.card}>
            <Text style={styles.helperText}>
              Set an amount for each flat individually. Leave a flat blank to keep its current
              amount unchanged.
            </Text>

            {flats.length === 0 ? (
              <Text style={styles.emptyText}>No flats found for this building.</Text>
            ) : (
              flats.map(f => (
                <View key={f.id} style={styles.flatRow}>
                  <Text style={styles.flatLabel}>Flat {f.flat_number}</Text>
                  <TextInput
                    style={styles.flatInput}
                    placeholder="₹ Amount"
                    placeholderTextColor={c.textTertiary}
                    keyboardType="numeric"
                    value={flatAmounts[f.id] ?? ''}
                    onChangeText={val => updateFlatAmount(f.id, val)}
                  />
                </View>
              ))
            )}

            <TouchableOpacity
              style={styles.saveButton}
              onPress={handleSavePerFlat}
              disabled={saving || flats.length === 0}
            >
              {saving ? (
                <ActivityIndicator color={c.text} />
              ) : (
                <Text style={styles.saveButtonText}>Save Per-Flat Amounts</Text>
              )}
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  loadingWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 40,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 4,
  },
  titleText: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.4,
  },
  subtitleText: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 20,
    marginLeft: 4,
  },
  modeToggleRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  modeOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  modeOptionSelected: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  modeOptionText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  modeOptionTextSelected: {
    color: colors.text,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.border,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: colors.bg,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 48,
    fontSize: 14,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 10,
  },
  helperText: {
    fontSize: 12,
    color: colors.textTertiary,
    lineHeight: 17,
    marginBottom: 18,
  },
  saveButton: {
    backgroundColor: colors.accent,
    borderRadius: 14,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  flatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  flatLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  flatInput: {
    backgroundColor: colors.bg,
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 42,
    width: 130,
    fontSize: 14,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
    textAlign: 'right',
  },
  emptyText: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    marginVertical: 12,
  },
})
