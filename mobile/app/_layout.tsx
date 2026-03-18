import { Stack, useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';
import { useAuthStore } from '../src/store/authStore';
import type { AuthState } from '../src/store/authStore';

const PUBLIC_ROUTES = ['index', 'login', 'register'];

export default function RootLayout() {
  const loadToken = useAuthStore((s: AuthState) => s.loadToken);
  const token = useAuthStore((s: AuthState) => s.token);
  const hydrated = useAuthStore((s: AuthState) => s.hydrated);
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    loadToken();
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const currentRoute = segments[0] ?? 'index';
    const isPublic = PUBLIC_ROUTES.includes(currentRoute);
    if (!token && !isPublic) {
      // Not authenticated — kick to login
      router.replace('/login');
    }
  }, [token, hydrated, segments]);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="login" />
      <Stack.Screen name="register" />
      <Stack.Screen name="dashboard" />
      <Stack.Screen name="log" />
      <Stack.Screen name="profile" />
      <Stack.Screen name="admin/menu" />
      <Stack.Screen name="menu/[venue]" />
    </Stack>
  );
}
