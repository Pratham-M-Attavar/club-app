import { supabase } from './supabase'

const baseUrl = (process.env.EXPO_PUBLIC_SUPABASE_URL || '').replace(/\/+$/, '')
const FUNCTIONS_URL = `${baseUrl}/functions/v1/notify-booking`

/** Tell the operator (you) about a new booking. Free via Expo push — fails silently for residents. */
export async function notifyOperatorOfBooking(bookingId) {
  if (!bookingId) return

  try {
    const { data: sessionData } = await supabase.auth.getSession()
    const token = sessionData.session?.access_token
    if (!token) return

    await fetch(FUNCTIONS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ booking_id: bookingId }),
    })
  } catch (err) {
    console.log('Operator notification skipped:', err?.message || err)
  }
}

/** Tell operators/admins about a new resident signing up for approval. */
export async function notifyOperatorsOfNewResident({ fullName, flatNumber, buildingName }) {
  try {
    const { data: operators } = await supabase
      .from('profiles')
      .select('push_token')
      .or('is_operator.eq.true,is_admin.eq.true,role.eq.admin')
      .not('push_token', 'is', null)

    const tokens = (operators || []).map(o => o.push_token).filter(Boolean)
    if (!tokens.length) return

    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(
        tokens.map(token => ({
          to: token,
          sound: 'default',
          title: 'New Resident Registration',
          body: `${fullName || 'A new resident'} (Flat ${flatNumber || ''}) registered for ${buildingName || 'your building'} and requires approval.`,
          priority: 'high',
        }))
      ),
    })
  } catch (err) {
    console.log('New resident push notification skipped:', err?.message || err)
  }
}
