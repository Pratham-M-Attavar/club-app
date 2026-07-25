import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native'
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { Ionicons } from '@expo/vector-icons'
import { StatusBar } from 'expo-status-bar'
import { AuthProvider, useAuth } from './lib/AuthContext'
import { ThemeProvider, useTheme } from './lib/ThemeContext'
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
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native'

const Tab = createMaterialTopTabNavigator()
const CommitteeStack = createNativeStackNavigator()
const ServicesStack = createNativeStackNavigator()
const HomeStack = createNativeStackNavigator()

function stackScreenOptions(theme) {
  const c = theme.colors
  return {
    headerStyle: { backgroundColor: c.surface },
    headerTintColor: c.text,
    headerTitleStyle: { fontWeight: '600', fontSize: 17, letterSpacing: -0.3 },
    headerShadowVisible: false,
    contentStyle: { backgroundColor: c.bg },
  }
}

function CommitteeStackNavigator() {
  const { theme } = useTheme()
  return (
    <CommitteeStack.Navigator screenOptions={stackScreenOptions(theme)}>
      <CommitteeStack.Screen name="CommitteeMenu" component={CommitteeMenuScreen} options={{ title: 'Committee' }} />
      <CommitteeStack.Screen name="Notices" component={NoticesScreen} options={{ title: 'Notices' }} />
      <CommitteeStack.Screen name="Collections" component={CollectionsScreen} options={{ title: 'Collections' }} />
      <CommitteeStack.Screen name="Tickets" component={TicketsScreen} options={{ title: 'Tickets' }} />
      <CommitteeStack.Screen name="VendorBookings" component={VendorBookingsScreen} options={{ title: 'Bookings' }} />
      <CommitteeStack.Screen name="ManageCommittee" component={ManageCommitteeScreen} options={{ title: 'Members' }} />
      <CommitteeStack.Screen name="PendingResidents" component={PendingResidentsScreen} options={{ title: 'Pending' }} />
    </CommitteeStack.Navigator>
  )
}

function HomeStackNavigator() {
  const { theme } = useTheme()
  return (
    <HomeStack.Navigator screenOptions={stackScreenOptions(theme)}>
      <HomeStack.Screen name="HomeMain" component={HomeScreen} options={{ headerShown: false }} />
      <HomeStack.Screen name="PaymentHistory" component={PaymentHistoryScreen} options={{ title: 'Payment history' }} />
    </HomeStack.Navigator>
  )
}

function ServicesStackNavigator() {
  const { theme } = useTheme()
  return (
    <ServicesStack.Navigator screenOptions={stackScreenOptions(theme)}>
      <ServicesStack.Screen name="ServicesHome" component={ServicesScreen} options={{ headerShown: false }} />
      <ServicesStack.Screen
        name="VendorDetail"
        component={VendorDetailScreen}
        options={({ route }) => ({ title: route.params?.vendor?.name || 'Vendor' })}
      />
      <ServicesStack.Screen name="EmergencyContacts" component={EmergencyContactsScreen} options={{ title: 'Emergency' }} />
    </ServicesStack.Navigator>
  )
}

function TabIcon({ name, color, focused }) {
  return <Ionicons name={focused ? name.replace('-outline', '') : name} size={24} color={color} />
}

function MainTabs() {
  const { isCommittee } = useAuth()
  const { theme } = useTheme()
  const c = theme.colors

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
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: c.tabBarBorder,
          elevation: 0,
          shadowOpacity: 0,
          height: 64,
          paddingBottom: 8,
          paddingTop: 6,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600', textTransform: 'none', letterSpacing: -0.1 },
        tabBarPressColor: 'transparent',
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeStackNavigator}
        options={{
          tabBarIcon: ({ color, focused }) => <TabIcon name="home-outline" color={color} focused={focused} />,
        }}
      />
      <Tab.Screen
        name="Services"
        component={ServicesStackNavigator}
        options={{
          tabBarIcon: ({ color, focused }) => <TabIcon name="grid-outline" color={color} focused={focused} />,
        }}
      />
      {isCommittee && (
        <Tab.Screen
          name="Committee"
          component={CommitteeStackNavigator}
          options={{
            tabBarIcon: ({ color, focused }) => <TabIcon name="people-outline" color={color} focused={focused} />,
          }}
        />
      )}
    </Tab.Navigator>
  )
}

function LoadingView({ message = 'Loading…' }) {
  const { theme } = useTheme()
  const c = theme.colors
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: c.bg }}>
      <ActivityIndicator color={c.accent} size="large" />
      <Text style={{ marginTop: 14, color: c.textSecondary, fontSize: 15 }}>{message}</Text>
    </View>
  )
}

function Root() {
  const { session, profile, loading } = useAuth()
  const { theme, isDark } = useTheme()

  const navTheme = {
    ...(isDark ? DarkTheme : DefaultTheme),
    colors: {
      ...(isDark ? DarkTheme.colors : DefaultTheme.colors),
      primary: theme.colors.accent,
      background: theme.colors.bg,
      card: theme.colors.surface,
      text: theme.colors.text,
      border: theme.colors.border,
    },
  }

  if (loading) return <LoadingView />

  if (!session) {
    return (
      <>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <NavigationContainer theme={navTheme}>
          <LoginScreen />
        </NavigationContainer>
      </>
    )
  }

  if (!profile) return <LoadingView />

  if (profile.approval_status !== 'approved') {
    return (
      <>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <NavigationContainer theme={navTheme}>
          <PendingApprovalScreen />
        </NavigationContainer>
      </>
    )
  }

  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <NavigationContainer theme={navTheme}>
        <MainTabs />
      </NavigationContainer>
    </>
  )
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Root />
      </AuthProvider>
    </ThemeProvider>
  )
}
