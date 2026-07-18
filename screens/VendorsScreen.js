import { View, Text, StyleSheet } from 'react-native'

export default function VendorsScreen() {
  return (
    <View style={styles.page}>
      <Text style={styles.text}>VendorsScreen — coming soon</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f4f1ea' },
  text: { color: '#6b7674', fontSize: 14 },
})
