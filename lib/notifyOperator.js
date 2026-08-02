import * as Notifications from 'expo-notifications'
import { supabase } from './supabase'

const baseUrl = (process.env.EXPO_PUBLIC_SUPABASE_URL || '').replace(/\/+$/, '')
const FUNCTIONS_URL = `${baseUrl}/functions/v1/notify-booking`

/** Tell the operator and resident about a new booking via local notification + Expo push API. */
export async function notifyOperatorOfBooking(bookingId, details = {}) {
  const categoryName = details.category || 'Service'

  // 1. Present instant local notification banner on the current user's device
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Booking Request Sent 🛠️',
        body: `Your request for ${categoryName} has been recorded. We will contact you shortly.`,
        sound: true,
      },
      trigger: null, // null triggers immediately
    })
  } catch (err) {
    console.log('Local notification error:', err?.message || err)
  }

  // 2. Fetch push tokens of operators, admins, and the current user
  try {
    const { data: sessionData } = await supabase.auth.getSession()
    const currentUserId = sessionData?.session?.user?.id

    const { data: profilesWithTokens } = await supabase
      .from('profiles')
      .select('push_token, id')
      .or(`is_operator.eq.true,is_admin.eq.true,role.eq.admin,id.eq.${currentUserId}`)
      .not('push_token', 'is', null)

    const tokens = Array.from(new Set((profilesWithTokens || []).map(p => p.push_token).filter(Boolean)))

    if (tokens.length > 0) {
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
            title: 'New Service Booking 🔔',
            body: `A new booking request for ${categoryName} was created.`,
            priority: 'high',
          }))
        ),
      })
    }
  } catch (err) {
    console.log('Remote push dispatch error:', err?.message || err)
  }

  // 3. Edge function fallback call if deployed
  if (bookingId) {
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token
      if (token) {
        await fetch(FUNCTIONS_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ booking_id: bookingId }),
        })
      }
    } catch (err) {
      // Ignore edge function failure if standalone push succeeded
    }
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
