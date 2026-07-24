import { View, Text, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useAuth } from '../lib/AuthContext'
import { colors, spacing, radius, type } from '../lib/theme'
import Button from '../components/ui/Button'

export default function PendingApprovalScreen() {
  const { profile, signOut } = useAuth()
  const isRejected = profile?.approval_status === 'rejected'

  return (
    <SafeAreaView style={styles.page}>
      <View style={styles.center}>
        <Text style={styles.icon}>{isRejected ? '✕' : '⏳'}</Text>
        <Text style={type.h1}>{isRejected ? 'Registration declined' : 'Waiting for approval'}</Text>
        <Text style={styles.body}>
          {isRejected
            ? "Your building's committee didn't approve this registration. If you think this is a mistake, please contact them directly."
            : `Your flat and details are in — your building's committee just needs to confirm you before you get full access. This usually doesn't take long.`}
        </Text>
        {profile?.flat_number && (
          <Text style={styles.meta}>Flat {profile.flat_number}</Text>
        )}
        <Button label="Sign out" onPress={signOut} variant="outline" style={{ marginTop: spacing.xxl }} />
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.paper },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xxl },
  icon: { fontSize: 36, marginBottom: spacing.md },
  body: { ...type.bodyMuted, textAlign: 'center', marginTop: spacing.sm, lineHeight: 20 },
  meta: { ...type.caption, marginTop: spacing.lg },
})