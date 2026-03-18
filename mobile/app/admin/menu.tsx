import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { Alert } from 'react-native';
import { useAuthStore } from '../../src/store/authStore';
import AdminMenuScreen from '../../src/screens/AdminMenuScreen';

export default function AdminMenuRoute() {
  const router = useRouter();
  const username = useAuthStore((s) => s.username);

  useEffect(() => {
    if (username && username !== 'admin') {
      Alert.alert('Access denied');
      router.replace('/dashboard');
    }
  }, [username]);

  if (username !== 'admin') return null;
  return <AdminMenuScreen />;
}
