import { useEffect, useMemo, useState } from 'react'
import { View, Text, TouchableOpacity, TextInput, StyleSheet, ScrollView, Linking, Alert } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { useTheme, spacing, radius } from '../lib/theme'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'

// Standard India-wide emergency numbers. These never change per-building,
// so they're hardcoded rather than pulled from the database.
const NATIONAL_CONTACTS = [
  { key: 'ambulance', label: 'Ambulance', number: '108', icon: 'medkit-outline' },
  { key: 'police', label: 'Police', number: '100', icon: 'shield-checkmark-outline' },
  { key: 'fire', label: 'Fire', number: '101', icon: 'flame-outline' },
]

function call(number) {
  if (!number) return
  Linking.openURL(`tel:${number}`)
}

export default function EmergencyContactsScreen() {
  const { profile } = useAuth()
  const { colors, type } = useTheme()
  const styles = useMemo(() => getStyles(colors, type), [colors, type])
  const [building, setBuilding] = useState(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [securityInput, setSecurityInput] = useState('')
  const [officeInput, setOfficeInput] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!profile?.building_id) return
    supabase
      .from('buildings')
      .select('id, name, security_phone, office_phone')
      .eq('id', profile.building_id)
      .maybeSingle()
      .then(({ data }) => {
        setBuilding(data)
        setSecurityInput(data?.security_phone || '')
        setOfficeInput(data?.office_phone || '')
        setLoading(false)
      })
  }, [profile])

  async function saveNumbers() {
    setSaving(true)
    const { data, error } = await supabase
      .from('buildings')
      .update({ security_phone: securityInput.trim() || null, office_phone: officeInput.trim() || null })
      .eq('id', building.id)
      .select()
    setSaving(false)
    if (error) {
      Alert.alert('Could not save', error.message)
      return
    }
    if (!data || data.length === 0) {
      // Update ran with no error but matched zero rows — usually an RLS
      // policy silently blocking the write rather than a real failure.
      Alert.alert('Could not save', "The update didn't go through — you may not have permission to edit this.")
      return
    }
    setBuilding({ ...building, security_phone: securityInput.trim() || null, office_phone: officeInput.trim() || null })
    setEditing(false)
  }

  const isCommittee = profile?.role === 'committee'

  return (
    <ScrollView style={styles.page} contentContainerStyle={{ padding: spacing.xl }}>
      <Text style={type.display}>Emergency contacts</Text>
      <Text style={[type.bodyMuted, { marginBottom: spacing.xl }]}>Tap any number to call immediately.</Text>

      <Text style={styles.sectionLabel}>National</Text>
      {NATIONAL_CONTACTS.map(c => (
        <ContactCard key={c.key} icon={c.icon} label={c.label} number={c.number} onCall={() => call(c.number)} />
      ))}

      <Text style={[styles.sectionLabel, { marginTop: spacing.lg }]}>Your building</Text>

      <ContactCard
        icon="shield-outline"
        label="Building Security"
        number={loading ? null : building?.security_phone}
        placeholder={isCommittee ? 'Not set — add it below' : 'Not added yet by your committee'}
        onCall={() => call(building?.security_phone)}
      />
      <ContactCard
        icon="business-outline"
        label="Committee / Society Office"
        number={loading ? null : building?.office_phone}
        placeholder={isCommittee ? 'Not set — add it below' : 'Not added yet by your committee'}
        onCall={() => call(building?.office_phone)}
      />

      {isCommittee && (
        <Card>
          {!editing ? (
            <Button label="Edit these numbers" onPress={() => setEditing(true)} variant="outline" style={{ alignSelf: 'stretch' }} />
          ) : (
            <>
              <Text style={type.eyebrow}>Building Security number</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. +91 98765 43210"
                placeholderTextColor={colors.textFaint}
                value={securityInput}
                onChangeText={setSecurityInput}
                keyboardType="phone-pad"
              />
              <Text style={[type.eyebrow, { marginTop: spacing.sm }]}>Committee / Office number</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. +91 98765 43210"
                placeholderTextColor={colors.textFaint}
                value={officeInput}
                onChangeText={setOfficeInput}
                keyboardType="phone-pad"
              />
              <Button
                label={saving ? 'Saving…' : 'Save'}
                onPress={saveNumbers}
                loading={saving}
                style={{ alignSelf: 'stretch', marginTop: spacing.md }}
              />
            </>
          )}
        </Card>
      )}
    </ScrollView>
  )
}

function ContactCard({ icon, label, number, placeholder, onCall }) {
  const { colors, type } = useTheme()
  const styles = useMemo(() => getStyles(colors, type), [colors, type])
  const disabled = !number
  return (
    <TouchableOpacity activeOpacity={disabled ? 1 : 0.7} onPress={disabled ? undefined : onCall}>
      <Card>
        <View style={styles.row}>
          <View style={styles.iconWrap}>
            <Ionicons name={icon} size={22} color={colors.accent} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>{label}</Text>
            <Text style={disabled ? styles.numberMuted : styles.number}>{number || placeholder}</Text>
          </View>
          {!disabled && (
            <View style={styles.callBadge}>
              <Text style={styles.callBadgeText}>Call</Text>
            </View>
          )}
        </View>
      </Card>
    </TouchableOpacity>
  )
}

function getStyles(colors, type) {
  return StyleSheet.create({
    page: { flex: 1, backgroundColor: colors.bg },
    sectionLabel: { ...type.eyebrow, marginBottom: spacing.sm },
    row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
    iconWrap: {
      width: 44,
      height: 44,
      borderRadius: radius.md,
      backgroundColor: colors.accentSoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    label: { fontSize: 15, fontWeight: '700', color: colors.text },
    number: { fontSize: 18, fontWeight: '700', color: colors.accent, marginTop: 2 },
    numberMuted: { ...type.bodyMuted, marginTop: 2, fontStyle: 'italic' },
    callBadge: { backgroundColor: colors.accent, borderRadius: radius.pill, paddingVertical: 6, paddingHorizontal: 14 },
    callBadgeText: { color: colors.text, fontWeight: '700', fontSize: 12.5 },
    input: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, padding: spacing.md, fontSize: 14, marginTop: spacing.xs, color: colors.text, backgroundColor: colors.surface },
  })
}