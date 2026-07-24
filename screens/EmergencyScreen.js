import React from 'react'
import { View, Text, StyleSheet, TouchableOpacity, Linking } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { colors, spacing, radius, type, shadow } from '../lib/theme'

const CONTACTS = [
  {
    title: 'Police',
    number: '112',
    icon: 'shield-checkmark',
    color: colors.cove,
  },
  {
    title: 'Ambulance',
    number: '108',
    icon: 'medical',
    color: colors.areca,
  },
  {
    title: 'Fire Control',
    number: '101',
    icon: 'flame',
    color: colors.laterite,
  },
  {
    title: 'Apartment Security',
    number: '+91 9876543210', // Replace with your security number
    icon: 'lock-closed',
    color: colors.ink,
  },
]

export default function EmergencyScreen() {
  function call(number) {
    Linking.openURL(`tel:${number}`)
  }

  return (
    <View style={styles.container}>
      <Text style={type.display}>Emergency</Text>

      <Text style={styles.subtitle}>
        Tap any service below to call immediately.
      </Text>

      {CONTACTS.map(contact => (
        <TouchableOpacity
          key={contact.title}
          style={styles.card}
          activeOpacity={0.8}
          onPress={() => call(contact.number)}
        >
          <View
            style={[
              styles.iconContainer,
              { backgroundColor: contact.color + '20' },
            ]}
          >
            <Ionicons
              name={contact.icon}
              size={28}
              color={contact.color}
            />
          </View>

          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{contact.title}</Text>
            <Text style={styles.number}>{contact.number}</Text>
          </View>

          <Ionicons
            name="call"
            size={24}
            color={contact.color}
          />
        </TouchableOpacity>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.paper,
    padding: spacing.xl,
  },

  subtitle: {
    ...type.bodyMuted,
    marginTop: spacing.sm,
    marginBottom: spacing.xl,
  },

  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.card,
  },

  iconContainer: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.lg,
  },

  title: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.ink,
  },

  number: {
    marginTop: 4,
    fontSize: 14,
    color: colors.textMuted,
  },
})