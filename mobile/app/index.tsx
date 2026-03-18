import { Redirect } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';
import { useAuthStore } from '../src/store/authStore';
import type { AuthState } from '../src/store/authStore';

export default function Index() {
  const token = useAuthStore((s: AuthState) => s.token);
  const hydrated = useAuthStore((s: AuthState) => s.hydrated);

  // Wait for AsyncStorage to load before redirecting
  if (!hydrated) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0f0f1a', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color="#a0c4ff" />
      </View>
    );
  }

  return <Redirect href={token ? '/dashboard' : '/login'} />;
}
