import { useState, useEffect } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import * as WebBrowser from 'expo-web-browser'
import * as AuthSession from 'expo-auth-session'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { colors, spacing, radius, type } from '../lib/theme'
import Button from '../components/ui/Button'

// Required once per app for the browser-based OAuth flow to properly close
// and hand control back to the app after Google redirects.
WebBrowser.maybeCompleteAuthSession()

export default function LoginScreen({ onboardingUser }) {
  const [mode, setMode] = useState('signin') // 'signin' | 'signup'

  return (
    <SafeAreaView style={styles.page}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: spacing.xl }}>
        <View style={styles.card}>
          <Text style={styles.brandName}>Club</Text>
          <Text style={styles.brandSub}>Apartment living, simplified</Text>

          {onboardingUser ? (
            <SignUpWizard googleUser={onboardingUser} />
          ) : (
            <>
              <View style={styles.tabRow}>
                <TouchableOpacity style={mode === 'signin' ? styles.tabActive : styles.tab} onPress={() => setMode('signin')}>
                  <Text style={mode === 'signin' ? styles.tabActiveText : styles.tabText}>Sign in</Text>
                </TouchableOpacity>
                <TouchableOpacity style={mode === 'signup' ? styles.tabActive : styles.tab} onPress={() => setMode('signup')}>
                  <Text style={mode === 'signup' ? styles.tabActiveText : styles.tabText}>New resident</Text>
                </TouchableOpacity>
              </View>

              {mode === 'signin' ? <SignInForm /> : <SignUpWizard />}
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

// ============ SIGN IN ============
function SignInForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)

  async function handleSubmit() {
    setError('')
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError(error.message)
    setLoading(false)
  }

  async function handleGoogleSignIn() {
    setError('')
    setGoogleLoading(true)
    const redirectTo = AuthSession.makeRedirectUri({
  scheme: 'club-mobile',
})
   console.log('REDIRECT URI:', redirectTo)
    try {
      const redirectTo = AuthSession.makeRedirectUri({
  scheme: 'club-mobile',
})

      const { data, error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo, skipBrowserRedirect: true },
        
      })
      console.log('OAuth URL:', data.url)
      if (oauthError) throw oauthError

      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo)

      if (result.type !== 'success') {
        setGoogleLoading(false)
        return
      }

      const fragment = result.url.split('#')[1] || result.url.split('?')[1] || ''
      const params = new URLSearchParams(fragment)
      const access_token = params.get('access_token')
      const refresh_token = params.get('refresh_token')

      if (!access_token || !refresh_token) {
        throw new Error('Google sign-in did not return a valid session. Please try again.')
      }

      const { error: sessionError } = await supabase.auth.setSession({ access_token, refresh_token })
      if (sessionError) throw sessionError
    } catch (err) {
      setError(err.message || 'Google sign-in failed. Please try again.')
    }
    setGoogleLoading(false)
  }

  return (
    <View>
      <TextInput
        style={styles.input}
        placeholder="Email"
        placeholderTextColor={colors.textFaint}
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        placeholderTextColor={colors.textFaint}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Button
        label={loading ? 'Please wait…' : 'Sign in'}
        onPress={handleSubmit}
        loading={loading}
        style={{ alignSelf: 'stretch' }}
      />

      <View style={styles.dividerRow}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>or</Text>
        <View style={styles.dividerLine} />
      </View>

      <TouchableOpacity
        style={styles.googleBtn}
        onPress={handleGoogleSignIn}
        disabled={googleLoading}
        activeOpacity={0.8}
      >
        <Ionicons name="logo-google" size={18} color={colors.text} />
        <Text style={styles.googleBtnText}>
          {googleLoading ? 'Opening Google…' : 'Continue with Google'}
        </Text>
      </TouchableOpacity>
    </View>
  )
}

// ============ SIGN UP WIZARD ============
function SignUpWizard({ googleUser }) {
  const { signOut, refreshProfile } = useAuth()
  const [step, setStep] = useState('search-building')

  const [query, setQuery] = useState('')
  const [buildingResults, setBuildingResults] = useState([])
  const [selectedBuilding, setSelectedBuilding] = useState(null)

  const [blocks, setBlocks] = useState([])
  const [selectedBlock, setSelectedBlock] = useState(null)

  const [flats, setFlats] = useState([])
  const [selectedFlat, setSelectedFlat] = useState(null)

  const [ownership, setOwnership] = useState(null)

  const [fullName, setFullName] = useState(
    googleUser?.user_metadata?.full_name || googleUser?.user_metadata?.name || ''
  )
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (query.trim().length < 2) { setBuildingResults([]); return }
    const timeout = setTimeout(() => {
      supabase.from('buildings').select('*').ilike('name', `%${query}%`).limit(8)
        .then(({ data }) => setBuildingResults(data || []))
    }, 250)
    return () => clearTimeout(timeout)
  }, [query])

  async function chooseBuilding(building) {
    setSelectedBuilding(building)
    if (building.has_blocks) {
      const { data } = await supabase.from('blocks').select('*').eq('building_id', building.id).order('name')
      setBlocks(data || [])
      setStep('select-block')
    } else {
      const { data } = await supabase.from('flats').select('*').eq('building_id', building.id).order('flat_number')
      setFlats(data || [])
      setStep('select-flat')
    }
  }

  async function chooseBlock(block) {
    setSelectedBlock(block)
    const { data } = await supabase.from('flats').select('*').eq('block_id', block.id).order('flat_number')
    setFlats(data || [])
    setStep('select-flat')
  }

  function chooseFlat(flat) {
    setSelectedFlat(flat)
    setStep('ownership')
  }

  function chooseOwnership(value) {
    setOwnership(value)
    setStep('details')
  }

  async function insertProfile(userId) {
    const combinedFlatNumber = selectedBlock
      ? `${selectedBlock.name}-${selectedFlat.flat_number}`
      : selectedFlat.flat_number

    const { error: profileError } = await supabase.from('profiles').insert({
      id: userId,
      full_name: fullName,
      flat_number: combinedFlatNumber,
      flat_type: selectedFlat.flat_type,
      ownership,
      role: 'resident',
      building_id: selectedBuilding.id,
      block_id: selectedBlock?.id || null,
      flat_id: selectedFlat.id,
    })
    return profileError
  }

  async function handleSubmit() {
    setError('')
    setLoading(true)

    if (googleUser) {
      const profileError = await insertProfile(googleUser.id)
      if (profileError) {
        console.log('Profile insert failed:', profileError.message)
        setError(profileError.message)
        setLoading(false)
        return
      }
      await refreshProfile?.()
      setLoading(false)
      return
    }

    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) { setError(error.message); setLoading(false); return }

    const userId = data.user?.id
    if (userId) {
      const profileError = await insertProfile(userId)
      if (profileError) {
        console.log('Profile insert failed:', profileError.message)
        setError(profileError.message)
      }
    }
    setLoading(false)
  }

  return (
    <View>
      {googleUser && (
        <View style={styles.googleOnboardingBanner}>
          <Text style={styles.googleOnboardingText}>Signed in as {googleUser.email}</Text>
          <TouchableOpacity onPress={() => signOut()}>
            <Text style={styles.googleOnboardingLink}>Not you? Sign out</Text>
          </TouchableOpacity>
        </View>
      )}

      <Text style={styles.breadcrumb}>
        {selectedBuilding?.name}
        {selectedBlock ? ` · Block ${selectedBlock.name}` : ''}
        {selectedFlat ? ` · Flat ${selectedFlat.flat_number}` : ''}
        {ownership ? ` · ${ownership === 'owner' ? 'Owner' : 'Tenant'}` : ''}
      </Text>

      {step === 'search-building' && (
        <View>
          <TextInput
            style={styles.input}
            placeholder="Search for your building…"
            placeholderTextColor={colors.textFaint}
            value={query}
            onChangeText={setQuery}
            autoFocus
          />
          {buildingResults.map(b => (
            <TouchableOpacity key={b.id} onPress={() => chooseBuilding(b)} style={styles.listItem}>
              <Text style={styles.listItemTitle}>{b.name}</Text>
              <Text style={styles.listItemSub}>{b.city}</Text>
            </TouchableOpacity>
          ))}
          {query.trim().length >= 2 && buildingResults.length === 0 && (
            <Text style={styles.helpText}>Can't find your building? It may not be onboarded yet — contact your committee.</Text>
          )}
        </View>
      )}

      {step === 'select-block' && (
        <View>
          <Text style={styles.stepLabel}>Which block?</Text>
          {blocks.map(b => (
            <TouchableOpacity key={b.id} onPress={() => chooseBlock(b)} style={styles.listItem}>
              <Text style={styles.listItemTitle}>Block {b.name}</Text>
            </TouchableOpacity>
          ))}
          <BackLink onPress={() => setStep('search-building')} />
        </View>
      )}

      {step === 'select-flat' && (
        <View>
          <Text style={styles.stepLabel}>Which flat?</Text>
          {flats.map(f => (
            <TouchableOpacity key={f.id} onPress={() => chooseFlat(f)} style={styles.listItem}>
              <Text style={styles.listItemTitle}>{f.flat_number}</Text>
              {f.flat_type ? <Text style={styles.listItemSub}>{f.flat_type}</Text> : null}
            </TouchableOpacity>
          ))}
          {flats.length === 0 && <Text style={styles.helpText}>No flats listed here yet — contact your committee.</Text>}
          <BackLink onPress={() => setStep(selectedBuilding.has_blocks ? 'select-block' : 'search-building')} />
        </View>
      )}

      {step === 'ownership' && (
        <View>
          <Text style={styles.stepLabel}>Are you the owner or a tenant?</Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <TouchableOpacity onPress={() => chooseOwnership('owner')} style={styles.choiceBtn}>
              <Text style={styles.choiceBtnText}>Owner</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => chooseOwnership('tenant')} style={styles.choiceBtn}>
              <Text style={styles.choiceBtnText}>Tenant</Text>
            </TouchableOpacity>
          </View>
          <BackLink onPress={() => setStep('select-flat')} />
        </View>
      )}

      {step === 'details' && (
        <View>
          <TextInput style={styles.input} placeholder="Full name" placeholderTextColor={colors.textFaint} value={fullName} onChangeText={setFullName} />
          {!googleUser && (
            <>
              <TextInput style={styles.input} placeholder="Email" placeholderTextColor={colors.textFaint} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
              <TextInput style={styles.input} placeholder="Password" placeholderTextColor={colors.textFaint} value={password} onChangeText={setPassword} secureTextEntry />
            </>
          )}
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Button
            label={loading ? 'Please wait…' : 'Create account'}
            onPress={handleSubmit}
            loading={loading}
            style={{ alignSelf: 'stretch' }}
          />
          <BackLink onPress={() => setStep('ownership')} />
        </View>
      )}
    </View>
  )
}

function BackLink({ onPress, label = '← Back' }) {
  return (
    <TouchableOpacity onPress={onPress} style={{ marginTop: spacing.md }}>
      <Text style={styles.backLink}>{label}</Text>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.bg },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.xxl, borderWidth: 1, borderColor: colors.border },
  brandName: { ...type.display },
  brandSub: { ...type.bodyMuted, marginBottom: spacing.xl },
  tabRow: { flexDirection: 'row', backgroundColor: colors.surfaceMuted, borderRadius: radius.md, padding: 3, marginBottom: spacing.lg },
  tab: { flex: 1, padding: spacing.md, borderRadius: radius.sm, alignItems: 'center' },
  tabActive: { flex: 1, padding: spacing.md, borderRadius: radius.sm, alignItems: 'center', backgroundColor: colors.accent },
  tabText: { color: colors.textMuted, fontWeight: '600', fontSize: 13 },
  tabActiveText: { color: colors.text, fontWeight: '600', fontSize: 13 },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, padding: spacing.md, fontSize: 14, marginBottom: spacing.md, color: colors.text },
  error: { color: colors.danger, fontSize: 12.5, marginBottom: spacing.sm },
  breadcrumb: { ...type.caption, marginBottom: spacing.lg },
  stepLabel: { ...type.h2, marginBottom: spacing.md },
  listItem: { padding: spacing.md, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.sm },
  listItemTitle: { fontWeight: '600', fontSize: 13.5, color: colors.text },
  listItemSub: { ...type.caption },
  helpText: { ...type.bodyMuted, marginBottom: spacing.sm },
  choiceBtn: { flex: 1, padding: spacing.lg, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
  choiceBtnText: { fontWeight: '600', fontSize: 14, color: colors.text },
  backLink: { fontSize: 12, color: colors.textMuted },

  dividerRow: { flexDirection: 'row', alignItems: 'center', marginVertical: spacing.lg },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.border },
  dividerText: { marginHorizontal: spacing.md, fontSize: 12, color: colors.textFaint },

  googleBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
    borderWidth: 1.5, borderColor: colors.borderStrong, borderRadius: radius.md,
    paddingVertical: 14, alignSelf: 'stretch',
  },
  googleBtnText: { fontSize: 15, fontWeight: '600', color: colors.text },

  googleOnboardingBanner: {
    backgroundColor: colors.surfaceMuted, borderRadius: radius.sm, padding: spacing.md,
    marginBottom: spacing.lg,
  },
  googleOnboardingText: { fontSize: 13, color: colors.text, fontWeight: '600' },
  googleOnboardingLink: { fontSize: 12, color: colors.accent, marginTop: 4 },
})