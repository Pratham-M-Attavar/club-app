import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { registerForPushNotifications } from '../lib/pushNotifications'
const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [adminBuilding, setAdminBuilding] = useState(null)
  const [loading, setLoading] = useState(true)

  async function loadProfile(userId) {
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

  const effectiveProfile = profile ? {
    ...profile,
    building_id: adminBuilding?.id || profile.building_id
  } : null

  const value = {
    session,
    profile: effectiveProfile,
    realProfile: profile,
    adminBuilding,
    switchBuilding: (building) => setAdminBuilding(building),
    loading,
    isCommittee: profile?.role === 'committee' || profile?.role === 'admin' || profile?.is_admin === true || profile?.is_operator === true,
    isAdmin: profile?.role === 'admin' || profile?.is_admin === true || profile?.is_operator === true,
    signOut: () => supabase.auth.signOut(),
    refreshProfile: () => (session?.user ? loadProfile(session.user.id) : null),
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}