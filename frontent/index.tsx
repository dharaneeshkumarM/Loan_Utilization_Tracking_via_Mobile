import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { colors } from '@/lib/theme';
import { useAuth } from '@/lib/auth';
import { useEffect } from 'react';
import { useRouter } from 'expo-router';

export default function Index() {
  const { session, profile, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!session) {
      router.replace('/(auth)/login');
      return;
    }
    if (!profile) return;
    if (profile.role === 'admin') {
      router.replace('/(admin)/dashboard');
    } else {
      router.replace('/(app)/dashboard');
    }
  }, [session, profile, loading]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={colors.primary[600]} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.neutral[50],
  },
});
