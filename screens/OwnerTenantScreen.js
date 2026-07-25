import { useEffect, useMemo, useState } from 'react'
import { Alert, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import EmptyState from '../components/ui/EmptyState'
import { useAuth } from '../lib/AuthContext'
import { colors, radius, spacing, type } from '../lib/theme'
import { supabase } from '../lib/supabase'

export default function OwnerTenantScreen() {
  const { profile } = useAuth()
  const palette = colors
  const styles = useMemo(() => createStyles(), [])

  const [flatInfo, setFlatInfo] = useState(null)
  const [counterpart, setCounterpart] = useState(null)
  const [isEditing, setIsEditing] = useState(false)
  const [maintenancePayer, setMaintenancePayer] = useState('owner')
  const [rentAmount, setRentAmount] = useState('')
  const [rentAccountDetails, setRentAccountDetails] = useState('')
  const [saving, setSaving] = useState(false)

  const formattedRentAmount = rentAmount ? `₹${Number(rentAmount).toLocaleString('en-IN')}` : '—'

  useEffect(() => {
    if (!profile?.flat_id) return

    supabase
      .from('flats')
      .select('id, maintenance_payer, rent_amount, owner_upi_id')
      .eq('id', profile.flat_id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setFlatInfo(data)
          setMaintenancePayer(data.maintenance_payer || 'owner')
          setRentAmount(data.rent_amount ? String(data.rent_amount) : '')
          setRentAccountDetails(data.owner_upi_id || '')
        }
      })

    supabase
      .from('profiles')
      .select('id, full_name, ownership')
      .eq('flat_id', profile.flat_id)
      .neq('id', profile.id)
      .maybeSingle()
      .then(({ data }) => setCounterpart(data))
  }, [profile])

  async function saveSettings() {
    if (!flatInfo) return

    const amount = parseFloat(rentAmount)
    if (!amount || amount <= 0) {
      Alert.alert('Enter a valid rent amount', 'The rent amount should be a positive number.')
      return
    }

    if (!rentAccountDetails.trim()) {
      Alert.alert('Enter rent account details', 'Add the UPI ID or account details so rent can be paid directly.')
      return
    }

    setSaving(true)
    const { error } = await supabase
      .from('flats')
      .update({
        maintenance_payer: maintenancePayer,
        rent_amount: amount,
        owner_upi_id: rentAccountDetails.trim(),
      })
      .eq('id', flatInfo.id)
    setSaving(false)

    if (error) {
      Alert.alert('Could not save', error.message)
      return
    }

    setFlatInfo({ ...flatInfo, maintenance_payer: maintenancePayer, rent_amount: amount, owner_upi_id: rentAccountDetails.trim() })
    setIsEditing(false)
    Alert.alert('Saved', 'Your setup is updated and ready to use.')
  }

  if (!profile) {
    return (
      <SafeAreaView style={styles.page} edges={['top']}>
        <View style={styles.centerFill}>
          <Text style={type.bodyMuted}>Loading your setup…</Text>
        </View>
      </SafeAreaView>
    )
  }

  if (profile.ownership !== 'owner') {
    return (
      <SafeAreaView style={styles.page} edges={['top']}>
        <View style={styles.centerFill}>
          <Text style={styles.title}>Tenant setup</Text>
          <Text style={[type.bodyMuted, { textAlign: 'center' }]}>This section is only for owners managing a tenant relationship.</Text>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.page} edges={['top']}>
      <ScrollView contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Tenant setup</Text>
        <Text style={[type.bodyMuted, { marginBottom: spacing.lg }]}>Keep your maintenance details tidy and easy to update from one place.</Text>

        {!counterpart ? (
          <EmptyState title="No tenant linked yet" subtitle="This section appears once your flat has a tenant connected to it." />
        ) : !isEditing ? (
          <Card style={styles.summaryCard}>
            <Text style={styles.sectionEyebrow}>Saved details</Text>

            <View style={styles.infoBlock}>
              <Text style={styles.summaryLabel}>Maintenance</Text>
              <Text style={styles.summaryValue}>{maintenancePayer === 'owner' ? 'You pay' : 'Tenant pays'}</Text>
            </View>

            <View style={styles.infoBlock}>
              <Text style={styles.summaryLabel}>Rent amount</Text>
              <Text style={styles.summaryValue}>{formattedRentAmount}</Text>
              <Text style={[styles.summaryLabel, { marginTop: spacing.sm }]}>Rent account</Text>
              <Text style={styles.summaryValueSmall}>{rentAccountDetails || 'No rent account details added yet'}</Text>
            </View>

            <Button label="Edit details" onPress={() => setIsEditing(true)} variant="outline" style={{ marginTop: spacing.md }} />
          </Card>
        ) : (
          <Card style={styles.formCard}>
            <Text style={styles.sectionEyebrow}>Edit setup</Text>
            <Text style={[type.bodyMuted, { marginBottom: spacing.md }]}>Set the maintenance payer separately from the rent amount and rent account details.</Text>

            <View style={styles.formBlock}>
              <Text style={styles.blockTitle}>Maintenance</Text>
              <Text style={[type.bodyMuted, { marginBottom: spacing.sm }]}>Choose who pays the monthly maintenance for this flat.</Text>
              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                <Button
                  label="I pay"
                  onPress={() => setMaintenancePayer('owner')}
                  variant={maintenancePayer === 'owner' ? 'primary' : 'outline'}
                  style={{ flex: 1 }}
                />
                <Button
                  label="Tenant pays"
                  onPress={() => setMaintenancePayer('tenant')}
                  variant={maintenancePayer === 'tenant' ? 'primary' : 'outline'}
                  style={{ flex: 1 }}
                />
              </View>
            </View>

            <View style={styles.formBlock}>
              <Text style={styles.blockTitle}>Rent</Text>
              <Text style={[type.bodyMuted, { marginBottom: spacing.sm }]}>Add the rent amount and the UPI or account details for rent payments.</Text>
              <TextInput
                style={styles.input}
                placeholder="Rent amount (₹)"
                placeholderTextColor={palette.textFaint}
                value={rentAmount}
                onChangeText={setRentAmount}
                keyboardType="numeric"
              />

              <TextInput
                style={styles.input}
                placeholder="UPI ID / bank account details"
                placeholderTextColor={palette.textFaint}
                value={rentAccountDetails}
                onChangeText={setRentAccountDetails}
                autoCapitalize="none"
              />
            </View>

            <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md }}>
              <Button label="Cancel" onPress={() => setIsEditing(false)} variant="outline" style={{ flex: 1 }} />
              <Button label={saving ? 'Saving…' : 'Save'} onPress={saveSettings} loading={saving} style={{ flex: 1 }} />
            </View>
          </Card>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

const createStyles = () => {
  const palette = colors
  return StyleSheet.create({
    page: { flex: 1, backgroundColor: palette.bg },
    centerFill: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, backgroundColor: palette.bg },
    contentContainer: { padding: spacing.lg, paddingBottom: spacing.xxl },
    title: { fontSize: 22, fontWeight: '700', color: palette.text, letterSpacing: -0.4, marginBottom: spacing.xs },
    sectionEyebrow: { fontSize: 10, fontWeight: '700', color: palette.textSecondary, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: spacing.sm },
    summaryCard: { backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border, borderRadius: radius.lg },
    formCard: { backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border, borderRadius: radius.lg },
    summaryLabel: { fontSize: 11, fontWeight: '700', color: palette.textSecondary, marginTop: spacing.sm, textTransform: 'uppercase', letterSpacing: 0.6 },
    summaryValue: { fontSize: 16, fontWeight: '600', color: palette.text, marginTop: 4 },
    summaryValueSmall: { fontSize: 13, fontWeight: '500', color: palette.textSecondary, marginTop: 6, lineHeight: 18 },
    infoBlock: { marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: palette.border },
    formBlock: { marginTop: spacing.md, padding: spacing.md, borderRadius: radius.md, backgroundColor: palette.surfaceElevated },
    blockTitle: { fontSize: 14, fontWeight: '700', color: palette.text, marginBottom: spacing.xs },
    input: {
      borderWidth: 1,
      borderColor: palette.border,
      borderRadius: radius.md,
      padding: spacing.sm,
      fontSize: 14,
      marginTop: spacing.md,
      color: palette.text,
      backgroundColor: palette.inputBg,
    },
  })
}
