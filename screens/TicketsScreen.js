import { useEffect, useState } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Modal,
  TextInput,
  Alert,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { SafeAreaView } from 'react-native-safe-area-context'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { colors } from '../lib/theme'

export default function TicketsScreen() {
  const { profile, isCommittee } = useAuth()
  const c = colors

  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(true)
  const [showRaiseModal, setShowRaiseModal] = useState(false)
  const [updatingTicketId, setUpdatingTicketId] = useState(null)

  // Raise Complaint Form State
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState('Electrical')
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const CATEGORIES = [
  'Electrical',
  'Plumbing',
  'Cleaning',
  'Security',
  'Scrap',
  'Housekeeping',
  'Other',
]

  async function loadTickets() {
    setLoading(true)
    const { data } = await supabase
      .from('tickets')
      .select('*')
      .eq('building_id', profile?.building_id)
      .order('created_at', { ascending: false })
    setTickets(data || [])
    setLoading(false)
  }

  useEffect(() => {
    if (profile) loadTickets()
  }, [profile])

  async function handleCreateTicket() {
    if (!title.trim()) {
      Alert.alert('Missing Title', 'Please enter a title for your complaint.')
      return
    }
    setSubmitting(true)
    const { error } = await supabase.from('tickets').insert({
      raised_by: profile.id,
      flat_number: profile.flat_number,
      category: category.toLowerCase(),
      description: `${title}\n${description}`.trim(),
      building_id: profile.building_id,
      status: 'pending',
    })

    setSubmitting(false)
    if (error) {
      Alert.alert('Error', error.message)
      return
    }

    setTitle('')
    setDescription('')
    setShowRaiseModal(false)
    loadTickets()
  }

  async function updateTicketStatus(ticketId, status) {
    setUpdatingTicketId(ticketId)
    const { error } = await supabase
      .from('tickets')
      .update({ status })
      .eq('id', ticketId)
      .eq('building_id', profile.building_id)
    setUpdatingTicketId(null)

    if (error) {
      Alert.alert('Could Not Update Request', error.message)
      return
    }
    setTickets(previous => previous.map(ticket => ticket.id === ticketId ? { ...ticket, status } : ticket))
  }

  const getStatusBadge = status => {
    switch (status) {
      case 'in_progress':
        return {
          label: 'Under Review',
          bg: 'rgba(59, 130, 246, 0.16)',
          text: '#3B82F6',
          icon: 'search-outline',
        }
      case 'done':
      case 'resolved':
        return {
          label: 'Finished',
          bg: c.successBg,
          text: c.success,
          icon: 'checkmark-circle-outline',
        }
      default:
        return {
          label: 'Pending',
          bg: c.warningBg,
          text: c.warning,
          icon: 'alert-circle-outline',
        }
    }
  }

  const displayList = tickets

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Header matching Page 3 */}
        <View style={styles.headerBlock}>
          <Text style={styles.titleText}>Requests</Text>
          <Text style={styles.subtitleText}>Track your complaints and issues</Text>
        </View>

        {loading ? (
          <ActivityIndicator color={c.accent} style={{ marginTop: 20 }} />
        ) : (
          <View style={styles.ticketList}>
            {displayList.map(t => {
              const badge = getStatusBadge(t.status)
              const firstLine = t.title || t.description?.split('\n')[0] || `${t.category} Issue`
              const dateStr = t.date || new Date(t.created_at || Date.now()).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
              const catStr = t.category ? t.category.charAt(0).toUpperCase() + t.category.slice(1) : 'General'

              return (
                <View key={t.id} style={styles.ticketCard}>
                  <View style={styles.ticketMainRow}>
                  <View style={[styles.ticketIconWrap, { backgroundColor: badge.bg }]}>
                    <Ionicons name={badge.icon} size={20} color={badge.text} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.ticketTitle} numberOfLines={1}>
                      {firstLine}
                    </Text>
                    <Text style={styles.ticketSub}>
                      {catStr} · {dateStr}
                    </Text>
                  </View>
                  <View style={[styles.statusPill, { backgroundColor: badge.bg }]}>
                    <Text style={[styles.statusPillText, { color: badge.text }]}>
                      {badge.label}
                    </Text>
                  </View>
                  </View>
                  {isCommittee && (
                    <View style={styles.statusControls}>
                      {[
                        { key: 'pending', label: 'Pending', color: c.warning, bg: c.warningBg },
                        { key: 'in_progress', label: 'Under Review', color: '#3B82F6', bg: 'rgba(59, 130, 246, 0.16)' },
                        { key: 'done', label: 'Finished', color: c.success, bg: c.successBg },
                      ].map(option => {
                        const selected = t.status === option.key || (option.key === 'done' && t.status === 'resolved')
                        return (
                          <TouchableOpacity
                            key={option.key}
                            style={[styles.statusControl, selected && { backgroundColor: option.bg, borderColor: option.color }]}
                            onPress={() => updateTicketStatus(t.id, option.key)}
                            disabled={updatingTicketId === t.id || selected}
                          >
                            {updatingTicketId === t.id && !selected ? (
                              <ActivityIndicator size="small" color={option.color} />
                            ) : (
                              <Text style={[styles.statusControlText, selected && { color: option.color }]}>{option.label}</Text>
                            )}
                          </TouchableOpacity>
                        )
                      })}
                    </View>
                  )}
                </View>
              )
            })}
          </View>
        )}
      </ScrollView>

      {/* Floating / Bottom Action Button matching Page 3 */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={styles.raiseButton}
          onPress={() => setShowRaiseModal(true)}
          activeOpacity={0.85}
        >
          <Text style={styles.raiseButtonText}>+ Raise a Complaint</Text>
        </TouchableOpacity>
      </View>

      {/* Raise a Complaint Modal Sheet matching Page 6 */}
      <Modal visible={showRaiseModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={styles.modalBackdrop}
            onPress={() => setShowRaiseModal(false)}
          />
          <View style={styles.modalSheet}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Raise a Complaint</Text>
              <TouchableOpacity
                onPress={() => setShowRaiseModal(false)}
                style={styles.closeBtn}
              >
                <Ionicons name="close" size={18} color={c.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.fieldLabel}>ISSUE TITLE</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Brief description of the problem"
                placeholderTextColor={c.textTertiary}
                value={title}
                onChangeText={setTitle}
              />

              <Text style={styles.fieldLabel}>CATEGORY</Text>
              <View style={styles.categoryChipsRow}>
                {CATEGORIES.map(cat => {
                  const isSel = category === cat
                  return (
                    <TouchableOpacity
                      key={cat}
                      style={[
                        styles.catChip,
                        isSel && styles.catChipSelected,
                      ]}
                      onPress={() => setCategory(cat)}
                    >
                      <Text
                        style={[
                          styles.catChipText,
                          isSel && styles.catChipTextSelected,
                        ]}
                      >
                        {cat}
                      </Text>
                    </TouchableOpacity>
                  )
                })}
              </View>

              <Text style={styles.fieldLabel}>DESCRIPTION</Text>
              <TextInput
                style={[styles.textInput, styles.textAreaInput]}
                placeholder="Describe the issue in detail..."
                placeholderTextColor={c.textTertiary}
                multiline
                numberOfLines={4}
                value={description}
                onChangeText={setDescription}
              />

              <TouchableOpacity
                style={styles.submitButton}
                onPress={handleCreateTicket}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator color={c.text} />
                ) : (
                  <Text style={styles.submitButtonText}>Submit Complaint</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 90,
  },
  headerBlock: {
    marginBottom: 20,
  },
  titleText: {
    fontSize: 32,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.6,
  },
  subtitleText: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 4,
  },
  ticketList: {
    gap: 12,
  },
  ticketCard: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 14,
  },
  ticketMainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  ticketIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ticketTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  ticketSub: {
    fontSize: 13,
    color: colors.textTertiary,
    marginTop: 3,
  },
  statusPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  statusPillText: {
    fontSize: 12,
    fontWeight: '600',
  },
  statusControls: {
    width: '100%',
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  statusControl: {
    flex: 1,
    minHeight: 34,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
  },
  statusControlText: {
    color: colors.textSecondary,
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'center',
  },
  bottomBar: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
  },
  raiseButton: {
    backgroundColor: colors.accent,
    borderRadius: 16,
    height: 54,
    justifyContent: 'center',
    alignItems: 'center',
  },
  raiseButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: colors.overlay,
  },
  modalBackdrop: {
    flex: 1,
  },
  modalSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: '85%',
    borderWidth: 1,
    borderColor: colors.border,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.borderStrong,
    alignSelf: 'center',
    marginBottom: 16,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  sheetTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surfaceElevated,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
    letterSpacing: 0.8,
    marginBottom: 8,
    marginTop: 12,
  },
  textInput: {
    backgroundColor: colors.bg,
    borderRadius: 14,
    paddingHorizontal: 16,
    height: 50,
    fontSize: 14,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
  },
  textAreaInput: {
    height: 100,
    paddingTop: 14,
    textAlignVertical: 'top',
  },
  categoryChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  catChip: {
    backgroundColor: colors.bg,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
  },
  catChipSelected: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  catChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  catChipTextSelected: {
    color: colors.text,
  },
  submitButton: {
    backgroundColor: colors.accent,
    borderRadius: 14,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 20,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
})
