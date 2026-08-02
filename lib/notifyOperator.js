import { supabase } from './supabase'

const FUNCTIONS_URL = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/notify-booking`

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
