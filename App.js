import { NavigationContainer, DarkTheme } from '@react-navigation/native'
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { Ionicons } from '@expo/vector-icons'
import { StatusBar } from 'expo-status-bar'
import { AuthProvider, useAuth } from './lib/AuthContext'
import { colors } from './lib/theme'
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
import OwnerTenantScreen from './screens/OwnerTenantScreen'
import MaintenanceSetupScreen from './screens/MaintenanceSetupScreen'
import { View, Text, ActivityIndicator } from 'react-native'

const Tab = createMaterialTopTabNavigator()
const CommitteeStack = createNativeStackNavigator()
const ServicesStack = createNativeStackNavigator()
const HomeStack = createNativeStackNavigator()
const RequestsStack = createNativeStackNavigator()

function stackScreenOptions() {
  const c = colors

  return {
    headerStyle: { backgroundColor: c.bg },
    headerTintColor: c.text,
    headerTitleStyle: {
      fontWeight: '700',
      fontSize: 18,
      letterSpacing: -0.3,
    },
    headerShadowVisible: false,
    contentStyle: { backgroundColor: c.bg },
  }
}

function CommitteeStackNavigator() {
  return (
    <CommitteeStack.Navigator screenOptions={stackScreenOptions()}>
      <CommitteeStack.Screen
        name="CommitteeMenu"
        component={CommitteeMenuScreen}
        options={{ headerShown: false }}
      />
      <CommitteeStack.Screen name="Notices" component={NoticesScreen} options={{ title: 'Notices' }} />
      <CommitteeStack.Screen name="Collections" component={CollectionsScreen} options={{ title: 'Collections' }} />
      <CommitteeStack.Screen name="VendorBookings" component={VendorBookingsScreen} options={{ title: 'Bookings' }} />
      <CommitteeStack.Screen name="ManageCommittee" component={ManageCommitteeScreen} options={{ title: 'Members' }} />
      <CommitteeStack.Screen name="PendingResidents" component={PendingResidentsScreen} options={{ title: 'Pending Approval' }} />
      <CommitteeStack.Screen name="MaintenanceSetup" component={MaintenanceSetupScreen} />
    </CommitteeStack.Navigator>
  )
}

function HomeStackNavigator() {
  return (
    <HomeStack.Navigator screenOptions={stackScreenOptions()}>
      <HomeStack.Screen name="HomeMain" component={HomeScreen} options={{ headerShown: false }} />
      <HomeStack.Screen name="PaymentHistory" component={PaymentHistoryScreen} options={{ title: 'Payment History' }} />
      <HomeStack.Screen name="Notices" component={NoticesScreen} options={{ title: 'Community Notices' }} />
    </HomeStack.Navigator>
  )
}

function ServicesStackNavigator() {
  return (
    <ServicesStack.Navigator screenOptions={stackScreenOptions()}>
      <ServicesStack.Screen name="ServicesHome" component={ServicesScreen} options={{ headerShown: false }} />
      <ServicesStack.Screen
        name="VendorDetail"
        component={VendorDetailScreen}
        options={({ route }) => ({ title: route.params?.vendor?.name || 'Vendor' })}
      />
      <ServicesStack.Screen name="EmergencyContacts" component={EmergencyContactsScreen} options={{ title: 'Emergency Contacts' }} />
    </ServicesStack.Navigator>
  )
}

function RequestsStackNavigator() {
  return (
    <RequestsStack.Navigator screenOptions={stackScreenOptions()}>
      <RequestsStack.Screen name="RequestsMain" component={TicketsScreen} options={{ headerShown: false }} />
    </RequestsStack.Navigator>
  )
}

function TabIcon({ name, color, focused }) {
  return <Ionicons name={focused ? name.replace('-outline', '') : name} size={22} color={color} />
}

function MainTabs() {
  const { isCommittee } = useAuth()
  const c = colors

  return (
    <Tab.Navigator
      tabBarPosition="bottom"
      screenOptions={{
        swipeEnabled: true,
        animationEnabled: true,
        tabBarShowLabel: true,
        tabBarShowIcon: true,
        tabBarIndicatorStyle: { height: 0 },
        tabBarActiveTintColor: c.tabActive,
        tabBarInactiveTintColor: c.tabInactive,
        tabBarStyle: {
          backgroundColor: c.tabBar,
          borderTopWidth: 1,
          borderTopColor: c.tabBarBorder,
          elevation: 0,
          shadowOpacity: 0,
          height: 64,
          paddingBottom: 6,
          paddingTop: 6,
          paddingHorizontal: 4,
        },
        tabBarItemStyle: { height: 50, borderRadius: 12 },
        tabBarLabelStyle: { fontSize: 10, fontWeight: '600', textTransform: 'none', letterSpacing: -0.1, marginTop: 2 },
        tabBarPressColor: 'transparent',
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeStackNavigator}
        options={{
          tabBarLabel: 'Home',
          tabBarIcon: ({ color, focused }) => <TabIcon name="home-outline" color={color} focused={focused} />,
        }}
      />
      <Tab.Screen
        name="Services"
        component={ServicesStackNavigator}
        options={{
          tabBarLabel: 'Services',
          tabBarIcon: ({ color, focused }) => <TabIcon name="cube-outline" color={color} focused={focused} />,
        }}
      />
      {isCommittee && (
        <Tab.Screen
          name="Committee"
          component={CommitteeStackNavigator}
          options={{
            tabBarLabel: 'Committee',
            tabBarIcon: ({ color, focused }) => <TabIcon name="people-outline" color={color} focused={focused} />,
          }}
        />
      )}
      <Tab.Screen
        name="Requests"
        component={RequestsStackNavigator}
        options={{
          tabBarLabel: 'Requests',
          tabBarIcon: ({ color, focused }) => <TabIcon name="document-text-outline" color={color} focused={focused} />,
        }}
      />
      <Tab.Screen
        name="Profile"
        component={OwnerTenantScreen}
        options={{
          tabBarLabel: 'Profile',
          tabBarIcon: ({ color, focused }) => <TabIcon name="person-outline" color={color} focused={focused} />,
        }}
      />
    </Tab.Navigator>
  )
}

function LoadingView({ message = 'Loading…' }) {
  const c = colors
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: c.bg }}>
      <ActivityIndicator color={c.accent} size="large" />
      <Text style={{ marginTop: 14, color: c.textSecondary, fontSize: 15, fontWeight: '500' }}>{message}</Text>
    </View>
  )
}

function Root() {
  const { session, profile, loading } = useAuth()

  const navTheme = {
    ...DarkTheme,
    colors: {
      ...DarkTheme.colors,
      primary: colors.accent,
      background: colors.bg,
      card: colors.surface,
      text: colors.text,
      border: colors.border,
    },
  }

  if (loading) return <LoadingView />

  if (!session) {
    return (
      <>
        <StatusBar style="light" />
        <NavigationContainer theme={navTheme}>
          <LoginScreen />
        </NavigationContainer>
      </>
    )
  }

  if (!profile) {
    const isGoogleUser =
      session.user.app_metadata?.provider === 'google' ||
      session.user.identities?.some(identity => identity.provider === 'google')
    return isGoogleUser ? <LoginScreen onboardingUser={session.user} /> : <LoadingView />
  }

  if (profile.approval_status !== 'approved') {
    return (
      <>
        <StatusBar style="light" />
        <NavigationContainer theme={navTheme}>
          <PendingApprovalScreen />
        </NavigationContainer>
      </>
    )
  }

  return (
    <>
      <StatusBar style="light" />
      <NavigationContainer theme={navTheme}>
        <MainTabs />
      </NavigationContainer>
    </>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <Root />
    </AuthProvider>
  )
}