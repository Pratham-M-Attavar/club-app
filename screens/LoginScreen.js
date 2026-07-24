import { useState, useEffect } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { supabase } from '../lib/supabase'
import { colors, spacing, radius, type } from '../lib/theme'
import Button from '../components/ui/Button'

export default function LoginScreen() {
  const [mode, setMode] = useState('signin') // 'signin' | 'signup'

  return (
    <SafeAreaView style={styles.page}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: spacing.xl }}>
        <View style={styles.card}>
          <Text style={styles.brandName}>Club</Text>
          <Text style={styles.brandSub}>Apartment living, simplified</Text>

          <View style={styles.tabRow}>
            <TouchableOpacity style={mode === 'signin' ? styles.tabActive : styles.tab} onPress={() => setMode('signin')}>
              <Text style={mode === 'signin' ? styles.tabActiveText : styles.tabText}>Sign in</Text>
            </TouchableOpacity>
            <TouchableOpacity style={mode === 'signup' ? styles.tabActive : styles.tab} onPress={() => setMode('signup')}>
              <Text style={mode === 'signup' ? styles.tabActiveText : styles.tabText}>New resident</Text>
            </TouchableOpacity>
          </View>

          {mode === 'signin' ? <SignInForm /> : <SignUpWizard />}
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

  async function handleSubmit() {
    setError('')
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError(error.message)
    setLoading(false)
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
    </View>
  )
}

// ============ SIGN UP WIZARD ============
function SignUpWizard() {
  const [step, setStep] = useState('search-building')

  const [query, setQuery] = useState('')
  const [buildingResults, setBuildingResults] = useState([])
  const [selectedBuilding, setSelectedBuilding] = useState(null)

  const [blocks, setBlocks] = useState([])
  const [selectedBlock, setSelectedBlock] = useState(null)

  const [flats, setFlats] = useState([])
  const [selectedFlat, setSelectedFlat] = useState(null)

  const [ownership, setOwnership] = useState(null)

  const [fullName, setFullName] = useState('')
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

  async function handleSubmit() {
    setError('')
    setLoading(true)

    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) { setError(error.message); setLoading(false); return }

    const userId = data.user?.id
    if (userId) {
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
      if (profileError) {
        console.log('Profile insert failed:', profileError.message)
        setError(profileError.message)
      }
    }
    setLoading(false)
  }

  return (
    <View>
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
          <TextInput style={styles.input} placeholder="Email" placeholderTextColor={colors.textFaint} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
          <TextInput style={styles.input} placeholder="Password" placeholderTextColor={colors.textFaint} value={password} onChangeText={setPassword} secureTextEntry />
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
  page: { flex: 1, backgroundColor: colors.paper },
  card: { backgroundColor: colors.white, borderRadius: radius.lg, padding: spacing.xxl, borderWidth: 1, borderColor: colors.border },
  brandName: { ...type.display },
  brandSub: { ...type.bodyMuted, marginBottom: spacing.xl },
  tabRow: { flexDirection: 'row', backgroundColor: colors.paper, borderRadius: radius.md, padding: 3, marginBottom: spacing.lg },
  tab: { flex: 1, padding: spacing.md, borderRadius: radius.sm, alignItems: 'center' },
  tabActive: { flex: 1, padding: spacing.md, borderRadius: radius.sm, alignItems: 'center', backgroundColor: colors.laterite },
  tabText: { color: colors.textMuted, fontWeight: '600', fontSize: 13 },
  tabActiveText: { color: colors.white, fontWeight: '600', fontSize: 13 },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, padding: spacing.md, fontSize: 14, marginBottom: spacing.md, color: colors.ink },
  error: { color: colors.danger, fontSize: 12.5, marginBottom: spacing.sm },
  breadcrumb: { ...type.caption, marginBottom: spacing.lg },
  stepLabel: { ...type.h2, marginBottom: spacing.md },
  listItem: { padding: spacing.md, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.sm },
  listItemTitle: { fontWeight: '600', fontSize: 13.5, color: colors.ink },
  listItemSub: { ...type.caption },
  helpText: { ...type.bodyMuted, marginBottom: spacing.sm },
  choiceBtn: { flex: 1, padding: spacing.lg, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
  choiceBtnText: { fontWeight: '600', fontSize: 14, color: colors.ink },
  backLink: { fontSize: 12, color: colors.textMuted },
})