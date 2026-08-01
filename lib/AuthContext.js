import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { registerForPushNotifications } from '../lib/pushNotifications'
const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  async function loadProfile(userId) {
    // Calling getUser() first ensures the session is fully settled before
    // querying — without this, the query could fire before login was fully
    // attached, silently returning nothing instead of the real profile.
    await supabase.auth.getUser()

    const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle()
    if (error) {
      console.log('loadProfile error:', error.message)
    }
    setProfile(data)
    if (data) registerForPushNotifications(data.id)
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session?.user) loadProfile(session.user.id)
      setLoading(false)
    }).catch(err => {
      console.log('getSession threw an error:', err.message)
      setLoading(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session?.user) {
        loadProfile(session.user.id)
      } else {
        setProfile(null)
      }
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  const value = {
    session,
    profile,
    loading,
    isCommittee: profile?.role === 'committee',
    signOut: () => supabase.auth.signOut(),
    // Needed after Google onboarding inserts a new profile row — the
    // onAuthStateChange listener won't fire again on its own for that,
    // so this lets the wizard explicitly ask AuthContext to re-fetch.
    refreshProfile: () => (session?.user ? loadProfile(session.user.id) : null),
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}