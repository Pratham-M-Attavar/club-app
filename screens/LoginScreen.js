import { useState, useEffect, useRef } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Animated,
  ActivityIndicator,
  Modal,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import * as WebBrowser from 'expo-web-browser'
import * as AuthSession from 'expo-auth-session'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { colors, spacing, radius, type, shadow } from '../lib/theme'
import Button from '../components/ui/Button'
import { notifyOperatorsOfNewResident } from '../lib/notifyOperator'

WebBrowser.maybeCompleteAuthSession()

export default function LoginScreen({ onboardingUser }) {
  const [mode, setMode] = useState('signin') // 'signin' | 'signup'

  // Tab indicator slide animation
  const tabAnim = useRef(new Animated.Value(mode === 'signin' ? 0 : 1)).current
  const fadeAnim = useRef(new Animated.Value(1)).current

  function switchMode(newMode) {
    if (newMode === mode) return
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 120,
      useNativeDriver: true,
    }).start(() => {
      setMode(newMode)
      Animated.parallel([
        Animated.timing(tabAnim, {
          toValue: newMode === 'signin' ? 0 : 1,
          duration: 220,
          useNativeDriver: false,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start()
    })
  }

  return (
    <SafeAreaView style={styles.page}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header Branding */}
          <View style={styles.headerContainer}>
            <View style={styles.logoBadge}>
              <Ionicons name="business" size={26} color={colors.accent} />
            </View>
            <Text style={styles.brandName}>Club</Text>
            <Text style={styles.brandSub}>Apartment living, simplified</Text>
          </View>

          {/* Main Form Card */}
          <View style={styles.card}>
            {onboardingUser ? (
              <SignUpWizard googleUser={onboardingUser} />
            ) : mode === 'forgot-password' ? (
              <ForgotPasswordWizard onBackToSignIn={() => switchMode('signin')} />
            ) : (
              <>
                {/* Segmented Tab Switcher */}
                <View style={styles.tabTrack}>
                  <Animated.View
                    style={[
                      styles.tabPill,
                      {
                        left: tabAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: ['1.5%', '50.5%'],
                        }),
                      },
                    ]}
                  />
                  <TouchableOpacity
                    style={styles.tabBtn}
                    onPress={() => switchMode('signin')}
                    activeOpacity={0.8}
                  >
                    <Text style={mode === 'signin' ? styles.tabTextActive : styles.tabText}>
                      Sign in
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.tabBtn}
                    onPress={() => switchMode('signup')}
                    activeOpacity={0.8}
                  >
                    <Text style={mode === 'signup' ? styles.tabTextActive : styles.tabText}>
                      New resident
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Form Content with Fade Animation */}
                <Animated.View style={{ opacity: fadeAnim }}>
                  {mode === 'signin' ? <SignInForm onForgotPassword={() => switchMode('forgot-password')} /> : <SignUpWizard />}
                </Animated.View>
              </>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

// ============ SIGN IN FORM ============
function SignInForm({ onForgotPassword }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)

  const [emailFocused, setEmailFocused] = useState(false)
  const [passwordFocused, setPasswordFocused] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  async function handleSubmit() {
    if (!email.trim() || !password) {
      setError('Please enter both email and password.')
      return
    }
    setError('')
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    if (error) setError(error.message)
    setLoading(false)
  }

  async function handleGoogleSignIn() {
    setError('')
    setGoogleLoading(true)
    const redirectTo = AuthSession.makeRedirectUri({ scheme: 'club-mobile' })

    try {
      const { data, error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo, skipBrowserRedirect: true },
      })
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
      <View style={[styles.inputWrapper, emailFocused && styles.inputFocused]}>
        <Ionicons name="mail-outline" size={18} color={emailFocused ? colors.accent : colors.textTertiary} style={styles.inputIcon} />
        <TextInput
          style={styles.inputField}
          placeholder="Email address"
          placeholderTextColor={colors.placeholder}
          value={email}
          onChangeText={setEmail}
          onFocus={() => setEmailFocused(true)}
          onBlur={() => setEmailFocused(false)}
          autoCapitalize="none"
          keyboardType="email-address"
        />
      </View>

      <View style={[styles.inputWrapper, passwordFocused && styles.inputFocused]}>
        <Ionicons name="lock-closed-outline" size={18} color={passwordFocused ? colors.accent : colors.textTertiary} style={styles.inputIcon} />
        <TextInput
          style={styles.inputField}
          placeholder="Password"
          placeholderTextColor={colors.placeholder}
          value={password}
          onChangeText={setPassword}
          onFocus={() => setPasswordFocused(true)}
          onBlur={() => setPasswordFocused(false)}
          secureTextEntry={!showPassword}
        />
        <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
          <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={18} color={colors.textTertiary} />
        </TouchableOpacity>
      </View>

      <TouchableOpacity onPress={onForgotPassword} style={{ alignSelf: 'flex-end', marginBottom: spacing.md }}>
        <Text style={{ color: colors.accent, fontSize: 12.5, fontWeight: '600' }}>Forgot password?</Text>
      </TouchableOpacity>

      {error ? (
        <View style={styles.errorBox}>
          <Ionicons name="alert-circle-outline" size={16} color={colors.danger} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <Button
        label={loading ? 'Signing in…' : 'Sign in'}
        onPress={handleSubmit}
        loading={loading}
        style={styles.primaryButton}
      />

      <View style={styles.dividerRow}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>OR</Text>
        <View style={styles.dividerLine} />
      </View>

      <TouchableOpacity
        style={styles.googleBtn}
        onPress={handleGoogleSignIn}
        disabled={googleLoading}
        activeOpacity={0.85}
      >
        <Ionicons name="logo-google" size={18} color={colors.text} />
        <Text style={styles.googleBtnText}>
          {googleLoading ? 'Connecting to Google…' : 'Continue with Google'}
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
  const [searching, setSearching] = useState(false)
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
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // Apartment request modal (fallback when building isn't listed)
  const [showApartmentRequestModal, setShowApartmentRequestModal] = useState(false)

  // Focus states
  const [searchFocused, setSearchFocused] = useState(false)
  const [nameFocused, setNameFocused] = useState(false)
  const [phoneFocused, setPhoneFocused] = useState(false)
  const [emailFocused, setEmailFocused] = useState(false)
  const [passFocused, setPassFocused] = useState(false)

  // Animation values for smooth step transition
  const stepAnim = useRef(new Animated.Value(1)).current
  const slideAnim = useRef(new Animated.Value(0)).current

  function animateToStep(nextStep, slideDirection = 1) {
    Animated.parallel([
      Animated.timing(stepAnim, { toValue: 0, duration: 100, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: -20 * slideDirection, duration: 100, useNativeDriver: true }),
    ]).start(() => {
      setStep(nextStep)
      slideAnim.setValue(20 * slideDirection)
      Animated.parallel([
        Animated.timing(stepAnim, { toValue: 1, duration: 160, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 0, duration: 160, useNativeDriver: true }),
      ]).start()
    })
  }

  // Calculate wizard step number for progress indicator
  const getStepNumber = () => {
    switch (step) {
      case 'search-building': return 1
      case 'select-block':
      case 'select-flat': return 2
      case 'ownership': return 3
      case 'details': return 4
      default: return 1
    }
  }

  useEffect(() => {
    if (query.trim().length < 2) {
      setBuildingResults([])
      setSearching(false)
      return
    }
    setSearching(true)
    const timeout = setTimeout(() => {
      supabase
        .from('public_buildings_search')
        .select('*')
        .ilike('name', `%${query.trim()}%`)
        .limit(10)
        .then(({ data }) => {
          setBuildingResults(data || [])
          setSearching(false)
        })
        .catch(() => setSearching(false))
    }, 250)
    return () => clearTimeout(timeout)
  }, [query])

  async function chooseBuilding(building) {
    setSelectedBuilding(building)
    if (building.has_blocks) {
      const { data } = await supabase.from('blocks').select('*').eq('building_id', building.id).order('name')
      setBlocks(data || [])
      animateToStep('select-block', 1)
    } else {
      const { data } = await supabase.from('public_flats_list').select('*').eq('building_id', building.id).order('flat_number')
      setFlats(data || [])
      animateToStep('select-flat', 1)
    }
  }

  async function chooseBlock(block) {
    setSelectedBlock(block)
    const { data } = await supabase.from('public_flats_list').select('*').eq('block_id', block.id).order('flat_number')
    setFlats(data || [])
    animateToStep('select-flat', 1)
  }

  function chooseFlat(flat) {
    setSelectedFlat(flat)
    animateToStep('ownership', 1)
  }

  function chooseOwnership(value) {
    setOwnership(value)
    animateToStep('details', 1)
  }

  async function insertProfile(userId) {
    const { error: profileError } = await supabase.from('profiles').insert({
      id: userId,
      full_name: fullName,
      phone: phone.trim(),
      flat_number: selectedFlat.flat_number,
      flat_type: selectedFlat.flat_type,
      ownership,
      role: 'resident',
      approval_status: 'pending',
      building_id: selectedBuilding.id,
      block_id: selectedBlock?.id || null,
      flat_id: selectedFlat.id,
    })

    if (!profileError) {
      notifyOperatorsOfNewResident({
        fullName,
        flatNumber: selectedFlat?.flat_number,
        buildingName: selectedBuilding?.name,
      })
    }

    return profileError
  }

  async function handleSubmit() {
    if (!fullName.trim()) {
      setError('Please enter your full name.')
      return
    }
    if (!phone.trim()) {
      setError('Please enter your phone number.')
      return
    }
    if (!googleUser && (!email.trim() || !password)) {
      setError('Please enter valid account credentials.')
      return
    }

    setError('')
    setLoading(true)

    if (googleUser) {
      const profileError = await insertProfile(googleUser.id)
      if (profileError) {
        setError(profileError.message)
        setLoading(false)
        return
      }
      await refreshProfile?.()
      setLoading(false)
      return
    }

    const { data, error } = await supabase.auth.signUp({ email: email.trim(), password })
    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    const userId = data.user?.id
    if (userId) {
      const profileError = await insertProfile(userId)
      if (profileError) {
        setError(profileError.message)
      }
    }
    setLoading(false)
  }

  const currentStepNum = getStepNumber()

  return (
    <View>
      {/* Progress Indicator */}
      <View style={styles.progressContainer}>
        <View style={styles.progressHeader}>
          <Text style={styles.progressText}>STEP {currentStepNum} OF 4</Text>
          <Text style={styles.progressTitle}>
            {currentStepNum === 1 && 'Find Building'}
            {currentStepNum === 2 && (step === 'select-block' ? 'Select Block' : 'Select Flat')}
            {currentStepNum === 3 && 'Residency Role'}
            {currentStepNum === 4 && 'Your Details'}
          </Text>
        </View>
        <View style={styles.progressBarTrack}>
          <View style={[styles.progressBarFill, { width: `${(currentStepNum / 4) * 100}%` }]} />
        </View>
      </View>

      {googleUser && (
        <View style={styles.googleOnboardingBanner}>
          <Ionicons name="logo-google" size={16} color={colors.accent} />
          <View style={{ flex: 1 }}>
            <Text style={styles.googleOnboardingText}>Signed in as {googleUser.email}</Text>
            <TouchableOpacity onPress={() => signOut()}>
              <Text style={styles.googleOnboardingLink}>Not you? Switch account</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Selected Breadcrumb Chip */}
      {(selectedBuilding || selectedBlock || selectedFlat || ownership) && (
        <View style={styles.breadcrumbContainer}>
          <Ionicons name="location-outline" size={14} color={colors.accent} />
          <Text style={styles.breadcrumbText} numberOfLines={1}>
            {selectedBuilding?.name}
            {selectedBlock ? ` · Block ${selectedBlock.name}` : ''}
            {selectedFlat ? ` · Flat ${selectedFlat.flat_number}` : ''}
            {ownership ? ` · ${ownership === 'owner' ? 'Owner' : 'Tenant'}` : ''}
          </Text>
        </View>
      )}

      {/* Animated Step Container */}
      <Animated.View style={{ opacity: stepAnim, transform: [{ translateY: slideAnim }] }}>
        {step === 'search-building' && (
          <View>
            <View style={[styles.inputWrapper, searchFocused && styles.inputFocused]}>
              <Ionicons name="search-outline" size={18} color={searchFocused ? colors.accent : colors.textTertiary} style={styles.inputIcon} />
              <TextInput
                style={styles.inputField}
                placeholder="Search your society / building name…"
                placeholderTextColor={colors.placeholder}
                value={query}
                onChangeText={setQuery}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setSearchFocused(false)}
                autoFocus
              />
              {query.length > 0 && (
                <TouchableOpacity onPress={() => setQuery('')} style={styles.eyeBtn}>
                  <Ionicons name="close-circle" size={16} color={colors.textTertiary} />
                </TouchableOpacity>
              )}
            </View>

            {searching && (
              <View style={styles.loadingBox}>
                <ActivityIndicator size="small" color={colors.accent} />
                <Text style={styles.loadingText}>Searching buildings…</Text>
              </View>
            )}

            {/* Scrollable list container so keyboard never obscures search results */}
            <ScrollView
              style={styles.resultsScroll}
              nestedScrollEnabled
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {buildingResults.map(b => (
                <TouchableOpacity
                  key={b.id}
                  onPress={() => chooseBuilding(b)}
                  style={styles.listItem}
                  activeOpacity={0.7}
                >
                  <View style={styles.itemIconContainer}>
                    <Ionicons name="business-outline" size={20} color={colors.accent} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.listItemTitle}>{b.name}</Text>
                    {b.city ? <Text style={styles.listItemSub}>{b.city}</Text> : null}
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
                </TouchableOpacity>
              ))}

              {query.trim().length >= 2 && !searching && buildingResults.length === 0 && (
                <View style={styles.emptyStateBox}>
                  <Ionicons name="alert-circle-outline" size={24} color={colors.textTertiary} />
                  <Text style={[styles.helpText, { color: colors.textSecondary, fontSize: 13.5 }]}>
                    Can't find your building? It might not be onboarded yet.
                  </Text>
                  <TouchableOpacity onPress={() => setShowApartmentRequestModal(true)} style={{ marginTop: 8 }}>
                    <Text style={{ color: colors.accent, fontWeight: '700', fontSize: 13 }}>
                      Register your apartment
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </ScrollView>
          </View>
        )}

        {step === 'select-block' && (
          <View>
            <Text style={styles.stepTitle}>Select your block / tower</Text>
            <ScrollView style={styles.resultsScroll} nestedScrollEnabled keyboardShouldPersistTaps="handled">
              {blocks.map(b => (
                <TouchableOpacity
                  key={b.id}
                  onPress={() => chooseBlock(b)}
                  style={styles.listItem}
                  activeOpacity={0.7}
                >
                  <View style={styles.itemIconContainer}>
                    <Ionicons name="grid-outline" size={18} color={colors.accent} />
                  </View>
                  <Text style={[styles.listItemTitle, { flex: 1 }]}>Block {b.name}</Text>
                  <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
                </TouchableOpacity>
              ))}
            </ScrollView>
            <BackLink onPress={() => animateToStep('search-building', -1)} />
          </View>
        )}

        {step === 'select-flat' && (
          <View>
            <Text style={styles.stepTitle}>Select your flat number</Text>
            <ScrollView style={styles.resultsScroll} nestedScrollEnabled keyboardShouldPersistTaps="handled">
              {flats.map(f => (
                <TouchableOpacity
                  key={f.id}
                  onPress={() => chooseFlat(f)}
                  style={styles.listItem}
                  activeOpacity={0.7}
                >
                  <View style={styles.itemIconContainer}>
                    <Ionicons name="key-outline" size={18} color={colors.accent} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.listItemTitle}>Flat {f.flat_number}</Text>
                    {f.flat_type ? <Text style={styles.listItemSub}>{f.flat_type}</Text> : null}
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
                </TouchableOpacity>
              ))}
              {flats.length === 0 && (
                <Text style={styles.helpText}>No flats available in this block yet.</Text>
              )}
            </ScrollView>
            <BackLink onPress={() => animateToStep(selectedBuilding.has_blocks ? 'select-block' : 'search-building', -1)} />
          </View>
        )}

        {step === 'ownership' && (
          <View>
            <Text style={styles.stepTitle}>Are you an Owner or Tenant?</Text>
            <View style={styles.choiceRow}>
              <TouchableOpacity
                onPress={() => chooseOwnership('owner')}
                style={[styles.choiceCard, ownership === 'owner' && styles.choiceCardActive]}
                activeOpacity={0.8}
              >
                <View style={[styles.choiceIconBadge, ownership === 'owner' && styles.choiceIconActive]}>
                  <Ionicons name="home-outline" size={24} color={ownership === 'owner' ? '#FFF' : colors.accent} />
                </View>
                <Text style={styles.choiceTitle}>Owner</Text>
                <Text style={styles.choiceSub}>Property owner or family member</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => chooseOwnership('tenant')}
                style={[styles.choiceCard, ownership === 'tenant' && styles.choiceCardActive]}
                activeOpacity={0.8}
              >
                <View style={[styles.choiceIconBadge, ownership === 'tenant' && styles.choiceIconActive]}>
                  <Ionicons name="person-outline" size={24} color={ownership === 'tenant' ? '#FFF' : colors.accent} />
                </View>
                <Text style={styles.choiceTitle}>Tenant</Text>
                <Text style={styles.choiceSub}>Renting this apartment unit</Text>
              </TouchableOpacity>
            </View>
            <BackLink onPress={() => animateToStep('select-flat', -1)} />
          </View>
        )}

        {step === 'details' && (
          <View>
            <Text style={styles.stepTitle}>Account details</Text>

            <View style={[styles.inputWrapper, nameFocused && styles.inputFocused]}>
              <Ionicons name="person-outline" size={18} color={nameFocused ? colors.accent : colors.textTertiary} style={styles.inputIcon} />
              <TextInput
                style={styles.inputField}
                placeholder="Full name"
                placeholderTextColor={colors.placeholder}
                value={fullName}
                onChangeText={setFullName}
                onFocus={() => setNameFocused(true)}
                onBlur={() => setNameFocused(false)}
              />
            </View>

            <View style={[styles.inputWrapper, phoneFocused && styles.inputFocused]}>
              <Ionicons name="call-outline" size={18} color={phoneFocused ? colors.accent : colors.textTertiary} style={styles.inputIcon} />
              <TextInput
                style={styles.inputField}
                placeholder="Phone number"
                placeholderTextColor={colors.placeholder}
                value={phone}
                onChangeText={setPhone}
                onFocus={() => setPhoneFocused(true)}
                onBlur={() => setPhoneFocused(false)}
                keyboardType="phone-pad"
              />
            </View>

            {!googleUser && (
              <>
                <View style={[styles.inputWrapper, emailFocused && styles.inputFocused]}>
                  <Ionicons name="mail-outline" size={18} color={emailFocused ? colors.accent : colors.textTertiary} style={styles.inputIcon} />
                  <TextInput
                    style={styles.inputField}
                    placeholder="Email address"
                    placeholderTextColor={colors.placeholder}
                    value={email}
                    onChangeText={setEmail}
                    onFocus={() => setEmailFocused(true)}
                    onBlur={() => setEmailFocused(false)}
                    autoCapitalize="none"
                    keyboardType="email-address"
                  />
                </View>

                <View style={[styles.inputWrapper, passFocused && styles.inputFocused]}>
                  <Ionicons name="lock-closed-outline" size={18} color={passFocused ? colors.accent : colors.textTertiary} style={styles.inputIcon} />
                  <TextInput
                    style={styles.inputField}
                    placeholder="Create a password"
                    placeholderTextColor={colors.placeholder}
                    value={password}
                    onChangeText={setPassword}
                    onFocus={() => setPassFocused(true)}
                    onBlur={() => setPassFocused(false)}
                    secureTextEntry
                  />
                </View>
              </>
            )}

            {error ? (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle-outline" size={16} color={colors.danger} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <Button
              label={loading ? 'Registering profile…' : 'Submit registration'}
              onPress={handleSubmit}
              loading={loading}
              style={styles.primaryButton}
            />

            <BackLink onPress={() => animateToStep('ownership', -1)} />
          </View>
        )}
      </Animated.View>

      <ApartmentRequestModal
        visible={showApartmentRequestModal}
        onClose={() => setShowApartmentRequestModal(false)}
      />
    </View>
  )
}

function BackLink({ onPress, label = 'Back to previous step' }) {
  return (
    <TouchableOpacity onPress={onPress} style={styles.backButton} activeOpacity={0.7}>
      <Ionicons name="arrow-back" size={14} color={colors.textSecondary} />
      <Text style={styles.backButtonText}>{label}</Text>
    </TouchableOpacity>
  )
}

// ============ FORGOT PASSWORD (NATIVE RESET) ============
function ForgotPasswordWizard({ onBackToSignIn }) {
  const [email, setEmail] = useState('')
  const [emailFocused, setEmailFocused] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [sent, setSent] = useState(false)

  async function handleSendReset() {
    if (!email.trim()) {
      setError('Please enter your email address.')
      return
    }
    setError('')
    setSubmitting(true)

    const redirectTo = AuthSession.makeRedirectUri({ scheme: 'club-mobile', path: 'reset-password' })
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo })

    setSubmitting(false)
    if (resetError) {
      setError(resetError.message)
      return
    }
    setSent(true)
  }

  if (sent) {
    return (
      <View style={{ alignItems: 'center', paddingVertical: 20 }}>
        <Ionicons name="mail-outline" size={48} color={colors.accent} />
        <Text style={[styles.stepTitle, { marginTop: 12, textAlign: 'center' }]}>
          Check your email
        </Text>
        <Text style={[styles.helpText, { marginTop: 6 }]}>
          We've sent a password reset link to {email.trim()}. Tap the link to set a new password.
        </Text>
        <TouchableOpacity onPress={onBackToSignIn} style={{ marginTop: 20 }}>
          <Text style={{ color: colors.accent, fontWeight: '700' }}>Back to Sign in</Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <View>
      <Text style={styles.stepTitle}>Reset your password</Text>
      <Text style={[styles.helpText, { textAlign: 'left', marginBottom: 16 }]}>
        Enter the email you used to sign up. We'll send you a link to reset your password.
      </Text>

      <View style={[styles.inputWrapper, emailFocused && styles.inputFocused]}>
        <Ionicons name="mail-outline" size={18} color={emailFocused ? colors.accent : colors.textTertiary} style={styles.inputIcon} />
        <TextInput
          style={styles.inputField}
          placeholder="Email address"
          placeholderTextColor={colors.placeholder}
          value={email}
          onChangeText={setEmail}
          onFocus={() => setEmailFocused(true)}
          onBlur={() => setEmailFocused(false)}
          autoCapitalize="none"
          keyboardType="email-address"
        />
      </View>

      {error ? (
        <View style={styles.errorBox}>
          <Ionicons name="alert-circle-outline" size={16} color={colors.danger} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <Button
        label={submitting ? 'Sending…' : 'Send reset link'}
        onPress={handleSendReset}
        loading={submitting}
        style={styles.primaryButton}
      />

      <BackLink onPress={onBackToSignIn} label="Back to Sign in" />
    </View>
  )
}

// ============ APARTMENT REQUEST MODAL ============
function ApartmentRequestModal({ visible, onClose }) {
  const [apartmentName, setApartmentName] = useState('')
  const [city, setCity] = useState('')
  const [flatCount, setFlatCount] = useState('')
  const [phone, setPhone] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit() {
    if (!apartmentName.trim() || !city.trim() || !flatCount.trim() || !phone.trim()) {
      setError('Please fill in all fields.')
      return
    }
    setError('')
    setSubmitting(true)

    const { error: insertError } = await supabase.from('apartment_requests').insert({
      apartment_name: apartmentName.trim(),
      city: city.trim(),
      approx_flat_count: flatCount.trim(),
      phone: phone.trim(),
    })

    setSubmitting(false)
    if (insertError) {
      setError(insertError.message)
      return
    }
    setSubmitted(true)
  }

  function handleClose() {
    // reset state so next open is fresh
    setApartmentName('')
    setCity('')
    setFlatCount('')
    setPhone('')
    setSubmitted(false)
    setError('')
    onClose()
  }

  return (
    <Modal visible={visible} transparent animationType="slide">
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <View style={styles.modalOverlayApt}>
          <TouchableOpacity style={styles.modalBackdropApt} onPress={handleClose} />
          <View style={styles.modalSheetApt}>
            <View style={styles.sheetHandleApt} />

            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              {submitted ? (
                <View style={{ alignItems: 'center', paddingVertical: 20 }}>
                  <Ionicons name="checkmark-circle" size={48} color={colors.accent} />
                  <Text style={[styles.stepTitle, { marginTop: 12, textAlign: 'center' }]}>
                    Thanks! We've got your request.
                  </Text>
                  <Text style={[styles.helpText, { marginTop: 6 }]}>
                    Our team will review your details and call you shortly to get your apartment set up.
                  </Text>
                  <TouchableOpacity onPress={handleClose} style={{ marginTop: 20 }}>
                    <Text style={{ color: colors.accent, fontWeight: '700' }}>Got it</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <>
                  <Text style={styles.stepTitle}>Register Your Apartment</Text>
                  <Text style={[styles.helpText, { textAlign: 'left', marginBottom: 16 }]}>
                    We'll review your details and get your building set up.
                  </Text>

                  <View style={styles.inputWrapper}>
                    <Ionicons name="business-outline" size={18} color={colors.textTertiary} style={styles.inputIcon} />
                    <TextInput
                      style={styles.inputField}
                      placeholder="Apartment / Society name"
                      placeholderTextColor={colors.placeholder}
                      value={apartmentName}
                      onChangeText={setApartmentName}
                    />
                  </View>

                  <View style={styles.inputWrapper}>
                    <Ionicons name="location-outline" size={18} color={colors.textTertiary} style={styles.inputIcon} />
                    <TextInput
                      style={styles.inputField}
                      placeholder="City"
                      placeholderTextColor={colors.placeholder}
                      value={city}
                      onChangeText={setCity}
                    />
                  </View>

                  <View style={styles.inputWrapper}>
                    <Ionicons name="grid-outline" size={18} color={colors.textTertiary} style={styles.inputIcon} />
                    <TextInput
                      style={styles.inputField}
                      placeholder="Approx. number of flats"
                      placeholderTextColor={colors.placeholder}
                      value={flatCount}
                      onChangeText={setFlatCount}
                      keyboardType="numeric"
                    />
                  </View>

                  <View style={styles.inputWrapper}>
                    <Ionicons name="call-outline" size={18} color={colors.textTertiary} style={styles.inputIcon} />
                    <TextInput
                      style={styles.inputField}
                      placeholder="Phone number"
                      placeholderTextColor={colors.placeholder}
                      value={phone}
                      onChangeText={setPhone}
                      keyboardType="phone-pad"
                    />
                  </View>
                  <Text style={[styles.helpText, { textAlign: 'left', fontSize: 11, marginTop: -6, marginBottom: 12 }]}>
                    We'll call you to verify.
                  </Text>

                  {error ? (
                    <View style={styles.errorBox}>
                      <Ionicons name="alert-circle-outline" size={16} color={colors.danger} />
                      <Text style={styles.errorText}>{error}</Text>
                    </View>
                  ) : null}

                  <Button
                    label={submitting ? 'Submitting…' : 'Submit Request'}
                    onPress={handleSubmit}
                    loading={submitting}
                    style={styles.primaryButton}
                  />
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.bg },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
  },
  headerContainer: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  logoBadge: {
    width: 56,
    height: 56,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.borderStrong,
    marginBottom: spacing.md,
    ...shadow.sm,
  },
  brandName: {
    ...type.display,
    textAlign: 'center',
    letterSpacing: -0.8,
  },
  brandSub: {
    ...type.bodyMuted,
    textAlign: 'center',
    marginTop: 2,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.card,
  },

  // Segmented Tab Switcher
  tabTrack: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    padding: 3,
    marginBottom: spacing.xl,
    position: 'relative',
    height: 46,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tabPill: {
    position: 'absolute',
    top: 3,
    bottom: 3,
    width: '48%',
    backgroundColor: colors.accent,
    borderRadius: radius.sm,
    ...shadow.sm,
  },
  tabBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  tabText: {
    color: colors.textSecondary,
    fontWeight: '600',
    fontSize: 14,
  },
  tabTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },

  // Inputs
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
    height: 48,
  },
  inputFocused: {
    borderColor: colors.accent,
    backgroundColor: colors.surfaceElevated,
  },
  inputIcon: {
    marginRight: spacing.sm,
  },
  inputField: {
    flex: 1,
    color: colors.text,
    fontSize: 14.5,
    height: '100%',
  },
  eyeBtn: {
    padding: spacing.xs,
  },

  // Buttons
  primaryButton: {
    alignSelf: 'stretch',
    marginTop: spacing.xs,
    height: 48,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing.lg,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  dividerText: {
    marginHorizontal: spacing.md,
    fontSize: 11,
    fontWeight: '700',
    color: colors.textTertiary,
    letterSpacing: 0.8,
  },
  googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    paddingVertical: 13,
    alignSelf: 'stretch',
  },
  googleBtnText: {
    fontSize: 14.5,
    fontWeight: '600',
    color: colors.text,
  },

  // Progress Bar in Wizard
  progressContainer: {
    marginBottom: spacing.lg,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  progressText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.accent,
    letterSpacing: 0.8,
  },
  progressTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  progressBarTrack: {
    height: 4,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: colors.accent,
    borderRadius: radius.pill,
  },

  // Breadcrumbs & Headers
  stepTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.md,
  },
  breadcrumbContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.accentSoft,
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.3)',
  },
  breadcrumbText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: colors.text,
    flex: 1,
  },

  // List Items & Scroll Containers
  resultsScroll: {
    maxHeight: 230,
    marginVertical: spacing.xs,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  itemIconContainer: {
    width: 34,
    height: 34,
    borderRadius: radius.sm,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listItemTitle: {
    fontWeight: '600',
    fontSize: 14,
    color: colors.text,
  },
  listItemSub: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 1,
  },
  loadingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  loadingText: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  emptyStateBox: {
    alignItems: 'center',
    padding: spacing.lg,
    gap: spacing.xs,
  },
  helpText: {
    ...type.bodyMuted,
    textAlign: 'center',
    fontSize: 13,
  },

  // Choice cards (Owner vs Tenant)
  choiceRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  choiceCard: {
    flex: 1,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
  },
  choiceCardActive: {
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft,
  },
  choiceIconBadge: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  choiceIconActive: {
    backgroundColor: colors.accent,
  },
  choiceTitle: {
    fontWeight: '700',
    fontSize: 15,
    color: colors.text,
    marginBottom: 2,
  },
  choiceSub: {
    fontSize: 11,
    color: colors.textSecondary,
    textAlign: 'center',
  },

  // Back button & Errors
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: spacing.sm,
    marginTop: spacing.sm,
  },
  backButtonText: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.dangerBg,
    padding: spacing.md,
    borderRadius: radius.sm,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  errorText: {
    color: colors.danger,
    fontSize: 13,
    flex: 1,
  },

  // Google Onboarding Banner
  googleOnboardingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.accentSoft,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.3)',
  },
  googleOnboardingText: { fontSize: 13, color: colors.text, fontWeight: '600' },
  googleOnboardingLink: { fontSize: 12, color: colors.accent, marginTop: 2, fontWeight: '600' },

  // Apartment Request Modal
  modalOverlayApt: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  modalBackdropApt: {
    flex: 1,
  },
  modalSheetApt: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sheetHandleApt: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.borderStrong,
    alignSelf: 'center',
    marginBottom: 16,
  },
})