import { useEffect, useState } from 'react'
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, Modal, TextInput, Alert } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { colors, spacing, radius, VENDOR_CATEGORIES } from '../lib/theme'

const STATUS_COLORS = {
  requested: { bg: '#7F1D1D', text: '#FECACA' },
  confirmed: { bg: '#78350F', text: '#FDE68A' },
  in_progress: { bg: '#78350F', text: '#FDE68A' },
  completed: { bg: '#14532D', text: '#BBF7D0' },
  cancelled: { bg: '#334155', text: '#CBD5E1' },
}

function categoryLabelFor(category) {
  return VENDOR_CATEGORIES.find(c => c.key === category)?.label || category
}

export default function VendorBookingsScreen() {
  const { profile } = useAuth()
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const [completingBooking, setCompletingBooking] = useState(null) // booking currently being marked done
  const [amountInput, setAmountInput] = useState('')
  const [saving, setSaving] = useState(false)

  function loadBookings() {
    if (!profile) return
    setLoading(true)
    supabase
      .from('vendor_bookings')
      .select('*, vendors(category)')
      .eq('building_id', profile.building_id)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setBookings(data || [])
        setLoading(false)
      })
  }

  useEffect(() => {
    loadBookings()
  }, [profile])

  function canManage(booking) {
    return booking.resident_id === profile?.id || profile?.role === 'committee'
  }

  function openCompleteModal(booking) {
    setAmountInput('')
    setCompletingBooking(booking)
  }

  async function confirmComplete() {
    if (!completingBooking) return
    const numericAmount = parseFloat(amountInput)
    if (!amountInput || isNaN(numericAmount) || numericAmount < 0) {
      Alert.alert('Invalid Amount', 'Please enter the amount charged for this job.')
      return
    }

    setSaving(true)
    const { error } = await supabase
      .from('vendor_bookings')
      .update({ status: 'completed', amount: numericAmount })
      .eq('id', completingBooking.id)
    setSaving(false)

    if (error) {
      Alert.alert('Could Not Save', error.message)
      return
    }

    setCompletingBooking(null)
    loadBookings()
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.accent} />
        <Text style={styles.muted}>Loading bookings…</Text>
      </View>
    )
  }

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.contentContainer}>
      <Text style={styles.title}>Vendor Bookings</Text>
      <Text style={styles.sub}>Everyone in the building can see requested services and their status.</Text>

      {bookings.length === 0 && <Text style={styles.muted}>No bookings yet.</Text>}

      {bookings.map(b => {
        const chipColors = STATUS_COLORS[b.status] || STATUS_COLORS.requested
        const categoryLabel = categoryLabelFor(b.category || b.vendors?.category)
        const isMine = b.resident_id === profile?.id

        return (
          <View key={b.id} style={styles.card}>
            <View style={styles.cardTopRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>
                  {isMine ? 'You booked a' : `Flat ${b.flat_number} booked a`} {categoryLabel} vendor
                </Text>
                <Text style={styles.cardMeta}>
                  {b.slot_time
                    ? new Date(b.slot_time).toLocaleString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        hour: 'numeric',
                        minute: '2-digit',
                      })
                    : 'Time not set'}
                  {' · '}Requested {new Date(b.created_at).toLocaleDateString()}
                </Text>
                {b.status === 'completed' && b.amount != null && (
                  <Text style={styles.amountText}>Charged ₹{Number(b.amount).toLocaleString('en-IN')}</Text>
                )}
              </View>
              <View style={[styles.statusChip, { backgroundColor: chipColors.bg }]}>
                <Text style={[styles.statusText, { color: chipColors.text }]}>{b.status.replace('_', ' ')}</Text>
              </View>
            </View>

            {b.status !== 'completed' && canManage(b) && (
              <TouchableOpacity style={styles.doneButton} onPress={() => openCompleteModal(b)}>
                <Ionicons name="checkmark-circle-outline" size={15} color={colors.text} />
                <Text style={styles.doneButtonText}>Mark as Done</Text>
              </TouchableOpacity>
            )}
          </View>
        )
      })}

      <Modal visible={!!completingBooking} transparent animationType="fade" onRequestClose={() => setCompletingBooking(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Mark Job as Done</Text>
            <Text style={styles.modalSub}>Enter the amount charged, for future reference.</Text>

            <TextInput
              style={styles.amountInput}
              placeholder="e.g. 500"
              placeholderTextColor={colors.textFaint}
              keyboardType="numeric"
              value={amountInput}
              onChangeText={setAmountInput}
              autoFocus
            />

            <View style={styles.modalActionsRow}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setCompletingBooking(null)} disabled={saving}>
                <Text style={styles.modalCancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalConfirmBtn} onPress={confirmComplete} disabled={saving}>
                {saving ? (
                  <ActivityIndicator color={colors.text} />
                ) : (
                  <Text style={styles.modalConfirmBtnText}>Confirm</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.bg },
  contentContainer: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: spacing.xxl },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  muted: { fontSize: 12, color: colors.textSecondary, marginTop: 8 },
  title: { fontSize: 20, fontWeight: '700', color: colors.text },
  sub: { fontSize: 12.5, color: colors.textSecondary, marginTop: 4, marginBottom: 16 },

  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: 14,
    marginBottom: 10,
  },
  cardTopRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  cardTitle: { fontWeight: '700', fontSize: 13.5, color: colors.text },
  cardMeta: { fontSize: 11.5, color: colors.textTertiary, marginTop: 4 },
  amountText: { fontSize: 12.5, color: colors.success, fontWeight: '700', marginTop: 6 },

  statusChip: { paddingVertical: 3, paddingHorizontal: 10, borderRadius: radius.pill, marginLeft: 8 },
  statusText: { fontSize: 11, fontWeight: '700' },

  doneButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    height: 38,
    marginTop: 12,
  },
  doneButtonText: { color: colors.text, fontSize: 12.5, fontWeight: '700' },

  modalOverlay: { flex: 1, backgroundColor: colors.overlay, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  modalCard: {
    width: '100%',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
  },
  modalTitle: { fontSize: 17, fontWeight: '700', color: colors.text },
  modalSub: { fontSize: 12.5, color: colors.textSecondary, marginTop: 4, marginBottom: 16 },
  amountInput: {
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    height: 48,
    fontSize: 14,
    color: colors.text,
  },
  modalActionsRow: { flexDirection: 'row', gap: 10, marginTop: 18 },
  modalCancelBtn: {
    flex: 1,
    height: 46,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelBtnText: { color: colors.text, fontWeight: '700', fontSize: 13.5 },
  modalConfirmBtn: {
    flex: 1,
    height: 46,
    borderRadius: radius.md,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalConfirmBtnText: { color: colors.text, fontWeight: '700', fontSize: 13.5 },
})