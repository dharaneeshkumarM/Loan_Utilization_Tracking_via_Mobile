import { Tabs } from 'expo-router';
import { Home, Camera, User } from 'lucide-react-native';
import { colors, typography } from '@/lib/theme';

export default function AppLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary[600],
        tabBarInactiveTintColor: colors.neutral[400],
        tabBarLabelStyle: {
          fontFamily: typography.fontFamilyMedium,
          fontSize: 12,
        },
        tabBarStyle: {
          backgroundColor: colors.neutral[0],
          borderTopColor: colors.neutral[200],
          borderTopWidth: 1,
          height: 56,
          paddingBottom: 4,
          paddingTop: 4,
        },
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => <Home color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="submit"
        options={{
          title: 'Submit',
          tabBarIcon: ({ color, size }) => <Camera color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => <User color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}
