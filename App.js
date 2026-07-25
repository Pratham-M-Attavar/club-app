import { NavigationContainer } from '@react-navigation/native'
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { AuthProvider, useAuth } from './lib/AuthContext'
import LoginScreen from './screens/LoginScreen'
import PendingApprovalScreen from './screens/PendingApprovalScreen'
import HomeScreen from './screens/HomeScreen'
import PaymentHistoryScreen from './screens/PaymentHistoryScreen'
import ServicesScreen from './screens/ServicesScreen'
import VendorDetailScreen from './screens/VendorDetailScreen'
import EmergencyContactsScreen from './screens/EmergencyContactsScreen'
import CommitteeMenuScreen from './screens/CommitteeMenuScreen'
import PendingResidentsScreen from './screens/PendingResidentsScreen'
import NoticesScreen from './screens/NoticesScreen'
import CollectionsScreen from './screens/CollectionsScreen'
import TicketsScreen from './screens/TicketsScreen'
import VendorBookingsScreen from './screens/VendorBookingsScreen'
import ManageCommitteeScreen from './screens/ManageCommitteeScreen'
import { View, Text } from 'react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'

const Tab = createMaterialTopTabNavigator()
const CommitteeStack = createNativeStackNavigator()
const ServicesStack = createNativeStackNavigator()
const HomeStack = createNativeStackNavigator()

function CommitteeStackNavigator() {
  return (
    <CommitteeStack.Navigator>
      <CommitteeStack.Screen name="CommitteeMenu" component={CommitteeMenuScreen} options={{ title: 'Committee' }} />
      <CommitteeStack.Screen name="Notices" component={NoticesScreen} options={{ title: 'Post Notices' }} />
      <CommitteeStack.Screen name="Collections" component={CollectionsScreen} options={{ title: 'Collections' }} />
      <CommitteeStack.Screen name="Tickets" component={TicketsScreen} options={{ title: 'Tickets' }} />
      <CommitteeStack.Screen name="VendorBookings" component={VendorBookingsScreen} options={{ title: 'Vendor Bookings' }} />
      <CommitteeStack.Screen name="ManageCommittee" component={ManageCommitteeScreen} options={{ title: 'Manage Committee' }} />
      <CommitteeStack.Screen name="PendingResidents" component={PendingResidentsScreen} options={{ title: 'Pending Residents' }} />
    </CommitteeStack.Navigator>
  )
}

function HomeStackNavigator() {
  return (
    <HomeStack.Navigator>
      <HomeStack.Screen name="HomeMain" component={HomeScreen} options={{ headerShown: false }} />
      <HomeStack.Screen name="PaymentHistory" component={PaymentHistoryScreen} options={{ title: 'Payment History' }} />
    </HomeStack.Navigator>
  )
}

function ServicesStackNavigator() {
  return (
    <ServicesStack.Navigator>
      <ServicesStack.Screen name="ServicesHome" component={ServicesScreen} options={{ title: 'Services' }} />
      <ServicesStack.Screen
        name="VendorDetail"
        component={VendorDetailScreen}
        options={({ route }) => ({ title: route.params?.vendor?.name || 'Vendor' })}
      />
      <ServicesStack.Screen name="EmergencyContacts" component={EmergencyContactsScreen} options={{ title: 'Emergency Contacts' }} />
    </ServicesStack.Navigator>
  )
}

function MainTabs() {
  const { isCommittee } = useAuth()

  return (
    <Tab.Navigator
      tabBarPosition="bottom"
      screenOptions={{
        swipeEnabled: true,
        animationEnabled: true,
        tabBarShowLabel: true,
        tabBarShowIcon: false,
        tabBarIndicatorStyle: { height: 0 }, // hides the default top-tab underline bar
        tabBarActiveTintColor: '#14262a',
        tabBarInactiveTintColor: '#9aa5a3',
        tabBarStyle: { backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#e4ddd0', elevation: 0, shadowOpacity: 0 },
        tabBarLabelStyle: { fontSize: 12, fontWeight: '600', textTransform: 'none' },
        tabBarPressColor: 'transparent',
      }}
    >
      <Tab.Screen name="Home" component={HomeStackNavigator} />
      <Tab.Screen name="Services" component={ServicesStackNavigator} />
      {isCommittee && <Tab.Screen name="Committee" component={CommitteeStackNavigator} />}
    </Tab.Navigator>
  )
}

function Root() {
  const { session, profile, loading } = useAuth()

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Text>Loading…</Text>
      </View>
    )
  }

  if (!session) {
    return (
      <NavigationContainer>
        <LoginScreen />
      </NavigationContainer>
    )
  }

  // Session exists but profile hasn't finished loading yet — brief moment
  // right after login/signup. Don't flash the approval screen during this.
  if (!profile) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Text>Loading…</Text>
      </View>
    )
  }

  if (profile.approval_status !== 'approved') {
    return (
      <NavigationContainer>
        <PendingApprovalScreen />
      </NavigationContainer>
    )
  }

  return (
    <NavigationContainer>
      <MainTabs />
    </NavigationContainer>
  )
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <Root />
      </AuthProvider>
    </SafeAreaProvider>
  )
}