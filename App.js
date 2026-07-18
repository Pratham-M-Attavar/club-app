import { NavigationContainer } from '@react-navigation/native'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { AuthProvider, useAuth } from './lib/AuthContext'
import LoginScreen from './screens/LoginScreen'
import HomeScreen from './screens/HomeScreen'
import ServicesScreen from './screens/ServicesScreen'
import CommitteeMenuScreen from './screens/CommitteeMenuScreen'
import NoticesScreen from './screens/NoticesScreen'
import CollectionsScreen from './screens/CollectionsScreen'
import TicketsScreen from './screens/TicketsScreen'
import VendorsScreen from './screens/VendorsScreen'
import VendorBookingsScreen from './screens/VendorBookingsScreen'
import ManageCommitteeScreen from './screens/ManageCommitteeScreen'
import { View, Text } from 'react-native'

const Tab = createBottomTabNavigator()
const CommitteeStack = createNativeStackNavigator()

// The Committee tab is its own mini-stack: starts at a menu screen,
// tapping an item pushes to that specific admin screen — same idea as
// web's sidebar, just reshaped for a small screen.
function CommitteeStackNavigator() {
  return (
    <CommitteeStack.Navigator>
      <CommitteeStack.Screen name="CommitteeMenu" component={CommitteeMenuScreen} options={{ title: 'Committee' }} />
      <CommitteeStack.Screen name="Notices" component={NoticesScreen} options={{ title: 'Post Notices' }} />
      <CommitteeStack.Screen name="Collections" component={CollectionsScreen} options={{ title: 'Collections' }} />
      <CommitteeStack.Screen name="Tickets" component={TicketsScreen} options={{ title: 'Tickets' }} />
      <CommitteeStack.Screen name="Vendors" component={VendorsScreen} options={{ title: 'Vendors' }} />
      <CommitteeStack.Screen name="VendorBookings" component={VendorBookingsScreen} options={{ title: 'Vendor Bookings' }} />
      <CommitteeStack.Screen name="ManageCommittee" component={ManageCommitteeScreen} options={{ title: 'Manage Committee' }} />
    </CommitteeStack.Navigator>
  )
}

function MainTabs() {
  const { isCommittee } = useAuth()

  return (
    <Tab.Navigator screenOptions={{ headerShown: false }}>
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Services" component={ServicesScreen} />
      {isCommittee && (
        <Tab.Screen name="CommitteeTab" component={CommitteeStackNavigator} options={{ title: 'Committee' }} />
      )}
    </Tab.Navigator>
  )
}

function Root() {
  const { session, loading } = useAuth()

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Text>Loading…</Text>
      </View>
    )
  }

  return (
    <NavigationContainer>
      {session ? <MainTabs /> : <LoginScreen />}
    </NavigationContainer>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <Root />
    </AuthProvider>
  )
}
