import { useEffect, useState } from 'react'
import { View, Text, TouchableOpacity, TextInput, StyleSheet, ScrollView, Linking, Alert } from 'react-native'
import * as Clipboard from 'expo-clipboard'
import * as Print from 'expo-print'
import * as Sharing from 'expo-sharing'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'

const BUILDING_UPI_ID = 'club-pilot@upi'
const BUILDING_UPI_NAME = 'Madhuvan Apartment'

export default function HomeScreen() {
  const { profile, signOut } = useAuth()
  const [currentDue, setCurrentDue] = useState(null)
  const [tickets, setTickets] = useState([])
  const [notices, setNotices] = useState([])
  const [openNoticeId, setOpenNoticeId] = useState(null)
  const [showPayPanel, setShowPayPanel] = useState(false)
  const [showTicketForm, setShowTicketForm] = useState(false)
  const [ticketCategory, setTicketCategory] = useState('plumbing')
  const [ticketDescription, setTicketDescription] = useState('')
  const [submittingTicket, setSubmittingTicket] = useState(false)

  function loadTickets() {
    supabase
      .from('tickets')
      .select('*')
      .eq('raised_by', profile.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => setTickets(data || []))
  }

  function loadEverything() {
    const firstOfMonth = new Date()
    firstOfMonth.setDate(1)
    const monthStr = firstOfMonth.toISOString().slice(0, 10)

    supabase
      .from('dues')
      .select('*')
      .eq('flat_number', profile.flat_number)
      .eq('month', monthStr)
      .maybeSingle()
      .then(({ data }) => setCurrentDue(data))

    loadTickets()

    supabase
      .from('notices')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5)
      .then(({ data }) => setNotices(data || []))
  }

  useEffect(() => {
    if (profile) loadEverything()
  }, [profile])

  async function handleRaiseTicket() {
    if (!ticketDescription.trim()) return
    setSubmittingTicket(true)
    await supabase.from('tickets').insert({
      raised_by: profile.id,
      flat_number: profile.flat_number,
      category: ticketCategory,
      description: ticketDescription,
      building_id: profile.building_id,
    })
    setTicketDescription('')
    setShowTicketForm(false)
    loadTickets()
    setSubmittingTicket(false)
  }

  async function copyUpiId() {
    await Clipboard.setStringAsync(BUILDING_UPI_ID)
    Alert.alert('Copied', 'UPI ID copied to clipboard')
  }

  function openUpiApp() {
    const url = `upi://pay?pa=${BUILDING_UPI_ID}&pn=${encodeURIComponent(BUILDING_UPI_NAME)}&am=${currentDue.total}&cu=INR&tn=${encodeURIComponent('Maintenance - Flat ' + profile.flat_number)}`
    Linking.openURL(url).catch(() => Alert.alert('No UPI app found', 'Install GPay or PhonePe to pay directly, or copy the UPI ID instead.'))
  }

  async function downloadReceipt() {
    const paidDate = currentDue.paid_at
      ? new Date(currentDue.paid_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
      : '—'
    const receiptNumber = currentDue.id.slice(0, 8).toUpperCase()

    // Simple HTML — expo-print turns this into a real PDF file on the phone
    const html = `
      <html>
        <body style="font-family: Helvetica; padding: 32px; color: #1d2b2a;">
          <h1 style="font-size: 20px; margin-bottom: 4px;">${BUILDING_UPI_NAME}</h1>
          <p style="color: #6b7674; font-size: 12px; margin-top: 0;">Maintenance Payment Receipt</p>
          <hr style="border: none; border-top: 1px solid #e4ddd0; margin: 20px 0;" />
          <table style="width: 100%; font-size: 14px;">
            <tr><td style="padding: 6px 0; color: #6b7674;">Receipt No.</td><td style="text-align: right;">${receiptNumber}</td></tr>
            <tr><td style="padding: 6px 0; color: #6b7674;">Flat</td><td style="text-align: right;">${profile.flat_number}</td></tr>
            <tr><td style="padding: 6px 0; color: #6b7674;">Resident</td><td style="text-align: right;">${profile.full_name}</td></tr>
            <tr><td style="padding: 6px 0; color: #6b7674;">Month</td><td style="text-align: right;">${new Date(currentDue.month).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</td></tr>
            <tr><td style="padding: 6px 0; color: #6b7674;">Date paid</td><td style="text-align: right;">${paidDate}</td></tr>
          </table>
          <hr style="border: none; border-top: 1px solid #e4ddd0; margin: 20px 0;" />
          <table style="width: 100%; font-size: 14px;">
            <tr><td style="padding: 4px 0;">Maintenance</td><td style="text-align: right;">₹${currentDue.maintenance}</td></tr>
            <tr><td style="padding: 4px 0;">Sinking fund</td><td style="text-align: right;">₹${currentDue.sinking_fund}</td></tr>
            <tr><td style="padding: 4px 0;">Festival fund</td><td style="text-align: right;">₹${currentDue.festival_fund}</td></tr>
            ${currentDue.late_fee > 0 ? `<tr><td style="padding: 4px 0;">Late fee</td><td style="text-align: right;">₹${currentDue.late_fee}</td></tr>` : ''}
          </table>
          <hr style="border: none; border-top: 1px solid #e4ddd0; margin: 20px 0;" />
          <table style="width: 100%; font-size: 16px; font-weight: bold;">
            <tr><td>Total paid</td><td style="text-align: right;">₹${currentDue.total}</td></tr>
          </table>
          <p style="color: #6b7674; font-size: 11px; margin-top: 32px;">Generated by Club — this is a system-generated receipt.</p>
        </body>
      </html>
    `

    try {
      const { uri } = await Print.printToFileAsync({ html })
      await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' })
    } catch (err) {
      Alert.alert('Could not generate receipt', err.message)
    }
  }

  if (!profile) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        <Text style={{ marginBottom: 16 }}>Loading your flat details…</Text>
        <TouchableOpacity style={styles.signOutBtn} onPress={signOut}>
          <Text style={styles.signOutText}>Taking too long? Sign out</Text>
        </TouchableOpacity>
      </View>
    )
  }

  const openTickets = tickets.filter(t => t.status !== 'done')

  return (
    <ScrollView style={styles.page} contentContainerStyle={{ padding: 20 }}>
      <Text style={styles.greeting}>Hi {profile.full_name?.split(' ')[0]}</Text>
      <Text style={styles.sub}>Flat {profile.flat_number}</Text>

      {/* Dues card */}
      <View style={styles.duesCard}>
        {currentDue ? (
          <>
            <Text style={styles.duesLabel}>Maintenance due — {currentDue.status}</Text>
            <Text style={styles.duesAmount}>₹{currentDue.total}</Text>

            {currentDue.status === 'paid' && (
              <TouchableOpacity style={styles.receiptBtn} onPress={downloadReceipt}>
                <Text style={styles.receiptBtnText}>Download receipt →</Text>
              </TouchableOpacity>
            )}

            {currentDue.status !== 'paid' && (
              <>
                <TouchableOpacity style={styles.payBtn} onPress={() => setShowPayPanel(!showPayPanel)}>
                  <Text style={styles.payBtnText}>{showPayPanel ? 'Hide payment details' : 'Pay now →'}</Text>
                </TouchableOpacity>

                {showPayPanel && (
                  <View style={styles.payPanel}>
                    <Text style={styles.payPanelLabel}>Pay via UPI to:</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
                      <Text style={styles.upiId}>{BUILDING_UPI_ID}</Text>
                      <TouchableOpacity style={styles.copyBtn} onPress={copyUpiId}>
                        <Text style={styles.copyBtnText}>Copy</Text>
                      </TouchableOpacity>
                    </View>
                    <TouchableOpacity style={styles.upiAppBtn} onPress={openUpiApp}>
                      <Text style={styles.upiAppBtnText}>Open in UPI app →</Text>
                    </TouchableOpacity>
                    <Text style={styles.payNote}>
                      Opens GPay/PhonePe if installed. Once paid, the committee will mark it as received.
                    </Text>
                  </View>
                )}
              </>
            )}
          </>
        ) : (
          <Text style={styles.duesLabel}>No dues generated yet for this month.</Text>
        )}
      </View>

      {/* Tickets */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Your open requests</Text>
        {openTickets.length === 0 && <Text style={styles.muted}>No open tickets — nice.</Text>}
        {openTickets.map(t => (
          <View key={t.id} style={styles.row}>
            <Text style={styles.rowTitle}>{t.description || t.category}</Text>
            <Text style={styles.muted}>{t.status}</Text>
          </View>
        ))}

        <TouchableOpacity style={styles.outlineBtn} onPress={() => setShowTicketForm(!showTicketForm)}>
          <Text style={styles.outlineBtnText}>{showTicketForm ? 'Cancel' : '+ Raise a complaint'}</Text>
        </TouchableOpacity>

        {showTicketForm && (
          <View style={{ marginTop: 10 }}>
            <View style={styles.categoryRow}>
              {['plumbing', 'electrical', 'security', 'cleanliness', 'other'].map(c => (
                <TouchableOpacity
                  key={c}
                  style={ticketCategory === c ? styles.categoryChipActive : styles.categoryChip}
                  onPress={() => setTicketCategory(c)}
                >
                  <Text style={ticketCategory === c ? styles.categoryChipTextActive : styles.categoryChipText}>{c}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TextInput
              style={styles.textArea}
              placeholder="What's the issue?"
              value={ticketDescription}
              onChangeText={setTicketDescription}
              multiline
            />
            <TouchableOpacity style={styles.submitBtn} onPress={handleRaiseTicket} disabled={submittingTicket}>
              <Text style={styles.submitBtnText}>{submittingTicket ? 'Submitting…' : 'Submit'}</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Notices */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Notices</Text>
        {notices.map(n => {
          const isOpen = openNoticeId === n.id
          return (
            <TouchableOpacity key={n.id} style={styles.row} onPress={() => setOpenNoticeId(isOpen ? null : n.id)}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={styles.rowTitle}>{n.title}</Text>
                <Text style={styles.muted}>{isOpen ? '▲' : '▼'}</Text>
              </View>
              <Text style={styles.muted}>{new Date(n.created_at).toLocaleDateString()}</Text>
              {isOpen && (
                <Text style={styles.noticeBody}>{n.body || 'No additional details.'}</Text>
              )}
            </TouchableOpacity>
          )
        })}
      </View>

      <TouchableOpacity style={styles.signOutBtn} onPress={signOut}>
        <Text style={styles.signOutText}>Sign out</Text>
      </TouchableOpacity>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#f4f1ea' },
  greeting: { fontSize: 22, fontWeight: '700', color: '#14262a', marginTop: 34 },
  sub: { fontSize: 13, color: '#6b7674', marginTop: 2, marginBottom: 20 },

  duesCard: { backgroundColor: '#14262a', borderRadius: 14, padding: 18, marginBottom: 16 },
  duesLabel: { fontSize: 12, color: '#a9bcb7', textTransform: 'uppercase' },
  duesAmount: { fontSize: 30, fontWeight: '700', color: '#f4f1ea', marginVertical: 4 },
  payBtn: { backgroundColor: '#b5872f', paddingVertical: 10, paddingHorizontal: 16, borderRadius: 9, alignSelf: 'flex-start', marginTop: 8 },
  payBtnText: { color: '#20200f', fontWeight: '700', fontSize: 13 },
  receiptBtn: { backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1, borderColor: '#3a5b57', paddingVertical: 10, paddingHorizontal: 16, borderRadius: 9, alignSelf: 'flex-start', marginTop: 8 },
  receiptBtnText: { color: '#f4f1ea', fontWeight: '600', fontSize: 13 },
  payPanel: { marginTop: 14, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 10, padding: 12 },
  payPanelLabel: { fontSize: 11, color: '#a9bcb7', marginBottom: 6 },
  upiId: { backgroundColor: 'rgba(0,0,0,0.25)', color: '#f4f1ea', padding: 8, borderRadius: 6, fontSize: 13, marginRight: 8 },
  copyBtn: { borderWidth: 1, borderColor: '#3a5b57', borderRadius: 6, paddingVertical: 5, paddingHorizontal: 10 },
  copyBtnText: { color: '#cfe0dc', fontSize: 11.5 },
  upiAppBtn: { backgroundColor: '#3a6b63', paddingVertical: 9, paddingHorizontal: 14, borderRadius: 8, alignSelf: 'flex-start' },
  upiAppBtnText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  payNote: { fontSize: 11, color: '#a9bcb7', marginTop: 10, lineHeight: 16 },

  card: { backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#e4ddd0' },
  cardTitle: { fontSize: 12, textTransform: 'uppercase', color: '#6b7674', fontWeight: '600', marginBottom: 10 },
  muted: { fontSize: 12, color: '#6b7674' },
  row: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#e4ddd0' },
  rowTitle: { fontWeight: '600', fontSize: 13.5, color: '#1d2b2a' },
  noticeBody: { fontSize: 13, color: '#1d2b2a', marginTop: 6, lineHeight: 18 },

  outlineBtn: { marginTop: 10, borderWidth: 1, borderColor: '#e4ddd0', paddingVertical: 9, paddingHorizontal: 14, borderRadius: 8, alignSelf: 'flex-start' },
  outlineBtnText: { fontSize: 12.5, fontWeight: '600', color: '#1d2b2a' },
  categoryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  categoryChip: { borderWidth: 1, borderColor: '#e4ddd0', borderRadius: 20, paddingVertical: 6, paddingHorizontal: 12 },
  categoryChipActive: { backgroundColor: '#14262a', borderRadius: 20, paddingVertical: 6, paddingHorizontal: 12 },
  categoryChipText: { fontSize: 12, color: '#1d2b2a' },
  categoryChipTextActive: { fontSize: 12, color: '#fff' },
  textArea: { borderWidth: 1, borderColor: '#e4ddd0', borderRadius: 8, padding: 10, fontSize: 13, minHeight: 70, textAlignVertical: 'top', marginBottom: 8 },
  submitBtn: { backgroundColor: '#14262a', padding: 11, borderRadius: 8, alignItems: 'center' },
  submitBtnText: { color: '#fff', fontWeight: '700', fontSize: 12.5 },

  signOutBtn: { borderWidth: 1, borderColor: '#e4ddd0', borderRadius: 9, padding: 12, alignItems: 'center', marginTop: 4, marginBottom: 30 },
  signOutText: { fontSize: 13, fontWeight: '600', color: '#1d2b2a' },
})
