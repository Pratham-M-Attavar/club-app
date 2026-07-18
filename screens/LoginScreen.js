import { useState, useEffect } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView } from 'react-native'
import { supabase } from '../lib/supabase'
import { SafeAreaView } from 'react-native-safe-area-context'
export default function LoginScreen() {
  const [mode, setMode] = useState('signin') // 'signin' | 'signup'

  return (
    <SafeAreaView style={styles.page}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 20 }}>
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
      <TextInput style={styles.input} placeholder="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
      <TextInput style={styles.input} placeholder="Password" value={password} onChangeText={setPassword} secureTextEntry />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <TouchableOpacity style={styles.submit} onPress={handleSubmit} disabled={loading}>
        <Text style={styles.submitText}>{loading ? 'Please wait…' : 'Sign in'}</Text>
      </TouchableOpacity>
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
          <TextInput style={styles.input} placeholder="Full name" value={fullName} onChangeText={setFullName} />
          <TextInput style={styles.input} placeholder="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
          <TextInput style={styles.input} placeholder="Password" value={password} onChangeText={setPassword} secureTextEntry />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <TouchableOpacity style={styles.submit} onPress={handleSubmit} disabled={loading}>
            <Text style={styles.submitText}>{loading ? 'Please wait…' : 'Create account'}</Text>
          </TouchableOpacity>
          <BackLink onPress={() => setStep('ownership')} />
        </View>
      )}
    </View>
  )
}

function BackLink({ onPress }) {
  return (
    <TouchableOpacity onPress={onPress} style={{ marginTop: 12 }}>
      <Text style={styles.backLink}>← Back</Text>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#f4f1ea' },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 24, borderWidth: 1, borderColor: '#e4ddd0' },
  brandName: { fontSize: 22, fontWeight: '700', color: '#14262a' },
  brandSub: { fontSize: 12, color: '#6b7674', marginBottom: 20 },
  tabRow: { flexDirection: 'row', backgroundColor: '#f4f1ea', borderRadius: 10, padding: 3, marginBottom: 16 },
  tab: { flex: 1, padding: 10, borderRadius: 8, alignItems: 'center' },
  tabActive: { flex: 1, padding: 10, borderRadius: 8, alignItems: 'center', backgroundColor: '#b5872f' },
  tabText: { color: '#6b7674', fontWeight: '600', fontSize: 13 },
  tabActiveText: { color: '#20200f', fontWeight: '600', fontSize: 13 },
  input: { borderWidth: 1, borderColor: '#e4ddd0', borderRadius: 9, padding: 12, fontSize: 14, marginBottom: 10 },
  error: { color: '#b5533c', fontSize: 12.5, marginBottom: 8 },
  submit: { backgroundColor: '#14262a', padding: 14, borderRadius: 9, alignItems: 'center', marginTop: 4 },
  submitText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  breadcrumb: { fontSize: 11.5, color: '#6b7674', marginBottom: 14 },
  stepLabel: { fontSize: 13.5, fontWeight: '600', marginBottom: 10, color: '#1d2b2a' },
  listItem: { padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#e4ddd0', marginBottom: 6 },
  listItemTitle: { fontWeight: '600', fontSize: 13.5, color: '#1d2b2a' },
  listItemSub: { fontSize: 11.5, color: '#6b7674' },
  helpText: { fontSize: 12.5, color: '#6b7674', marginTop: 8 },
  choiceBtn: { flex: 1, padding: 14, borderRadius: 9, borderWidth: 1, borderColor: '#e4ddd0', alignItems: 'center' },
  choiceBtnText: { fontWeight: '600', fontSize: 14, color: '#1d2b2a' },
  backLink: { fontSize: 12, color: '#6b7674' },
})
