import { useState } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '../lib/supabase'
import { colors, spacing, radius, type, shadow } from '../lib/theme'
import Button from '../components/ui/Button'

export default function ResetPasswordScreen({ onDone }) {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordFocused, setPasswordFocused] = useState(false)
  const [confirmFocused, setConfirmFocused] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  async function handleSubmit() {
    if (!password || password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }
    setError('')
    setSubmitting(true)

    const { error: updateError } = await supabase.auth.updateUser({ password })

    setSubmitting(false)
    if (updateError) {
      setError(updateError.message)
      return
    }
    setDone(true)
  }

  async function handleContinue() {
    // Sign out so they log in fresh with the new password
    await supabase.auth.signOut()
    onDone?.()
  }

  return (
    <SafeAreaView style={styles.page}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <View style={styles.centerWrap}>
          <View style={styles.card}>
            {done ? (
              <View style={{ alignItems: 'center', paddingVertical: 12 }}>
                <Ionicons name="checkmark-circle" size={48} color={colors.accent} />
                <Text style={[styles.title, { marginTop: 12, textAlign: 'center' }]}>
                  Password updated
                </Text>
                <Text style={[styles.subtitle, { marginTop: 6, textAlign: 'center' }]}>
                  You can now sign in with your new password.
                </Text>
                <Button
                  label="Continue to Sign in"
                  onPress={handleContinue}
                  style={[styles.primaryButton, { marginTop: 20 }]}
                />
              </View>
            ) : (
              <>
                <View style={styles.headerContainer}>
                  <View style={styles.logoBadge}>
                    <Ionicons name="lock-closed" size={26} color={colors.accent} />
                  </View>
                  <Text style={styles.title}>Set a new password</Text>
                  <Text style={styles.subtitle}>Choose a password you'll remember</Text>
                </View>

                <View style={[styles.inputWrapper, passwordFocused && styles.inputFocused]}>
                  <Ionicons name="lock-closed-outline" size={18} color={passwordFocused ? colors.accent : colors.textTertiary} style={styles.inputIcon} />
                  <TextInput
                    style={styles.inputField}
                    placeholder="New password"
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

                <View style={[styles.inputWrapper, confirmFocused && styles.inputFocused]}>
                  <Ionicons name="lock-closed-outline" size={18} color={confirmFocused ? colors.accent : colors.textTertiary} style={styles.inputIcon} />
                  <TextInput
                    style={styles.inputField}
                    placeholder="Confirm new password"
                    placeholderTextColor={colors.placeholder}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    onFocus={() => setConfirmFocused(true)}
                    onBlur={() => setConfirmFocused(false)}
                    secureTextEntry={!showPassword}
                  />
                </View>

                {error ? (
                  <View style={styles.errorBox}>
                    <Ionicons name="alert-circle-outline" size={16} color={colors.danger} />
                    <Text style={styles.errorText}>{error}</Text>
                  </View>
                ) : null}

                <Button
                  label={submitting ? 'Updating…' : 'Update password'}
                  onPress={handleSubmit}
                  loading={submitting}
                  style={styles.primaryButton}
                />
              </>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.bg },
  centerWrap: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.card,
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
  title: {
    ...type.display,
    textAlign: 'center',
    letterSpacing: -0.6,
    fontSize: 20,
  },
  subtitle: {
    ...type.bodyMuted,
    textAlign: 'center',
    marginTop: 4,
  },
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
  primaryButton: {
    alignSelf: 'stretch',
    marginTop: spacing.xs,
    height: 48,
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
})