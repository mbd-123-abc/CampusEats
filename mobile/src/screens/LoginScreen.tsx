import React, { useState, useEffect } from 'react';
import {
  Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { api } from '../api/client';
import { useAuthStore } from '../store/authStore';
import type { AuthState } from '../store/authStore';

export default function LoginScreen() {
  const router = useRouter();
  const setToken  = useAuthStore((s: AuthState) => s.setToken);
  const error     = useAuthStore((s: AuthState) => s.error);
  const clearError = useAuthStore((s: AuthState) => s.clearError);
  const setError  = useAuthStore((s: AuthState) => s.setError);

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  // Clear stale errors on mount
  useEffect(() => { clearError(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleLogin = async () => {
    if (!username.trim() || !password) {
      setError('Please fill in all fields');
      return;
    }
    clearError();
    setLoading(true);
    let success = false;
    try {
      const response = await api.post('/auth/login', { username, password });
      await setToken({ access_token: response.data.access_token, token_type: 'bearer', expires_in: response.data.expires_in ?? 86400 });
      success = true;
    } catch (err: any) {
      console.error('Raw Auth Error:', err.message);
      console.error('Full Error Object:', err);
      const rawDetail = err.response?.data?.detail;
      const detail = Array.isArray(rawDetail) ? (rawDetail[0]?.msg ?? '') : (rawDetail ?? '');
      const lower = String(detail).toLowerCase();
      if (lower.includes('locked')) {
        setError(String(detail));
      } else {
        setError('Incorrect credentials. Please try again.');
      }
    } finally {
      setLoading(false);
    }
    if (success) router.replace('/dashboard');
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'android' ? 'height' : 'padding'} style={{ flex: 1, justifyContent: 'center' }}>
      <Text style={styles.title}>Welcome back</Text>

      <TextInput
        style={styles.input}
        placeholder="Username"
        placeholderTextColor="#666"
        value={username}
        onChangeText={t => { setUsername(t); clearError(); }}
        autoCapitalize="none"
        autoCorrect={false}
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        placeholderTextColor="#666"
        value={password}
        onChangeText={t => { setPassword(t); clearError(); }}
        secureTextEntry
      />

      {error && <Text style={styles.errorBox}>{error}</Text>}

      <TouchableOpacity style={styles.btn} onPress={handleLogin} disabled={loading} accessibilityRole="button">
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Log In</Text>}
      </TouchableOpacity>

      <TouchableOpacity onPress={() => router.push('/register')} accessibilityRole="button">
        <Text style={styles.link}>New here? Create an account</Text>
      </TouchableOpacity>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f1a', padding: 24 },
  title:     { color: '#fff', fontSize: 28, fontWeight: '700', marginBottom: 32 },
  input: {
    backgroundColor: '#1a1a2e', color: '#fff', borderRadius: 10,
    padding: 14, marginBottom: 12, fontSize: 15,
  },
  errorBox: {
    backgroundColor: '#2d0a0a', borderWidth: 1, borderColor: '#c0392b',
    borderRadius: 8, padding: 12, marginBottom: 12,
    color: '#ff6b6b', fontSize: 13, textAlign: 'center',
  },
  btn: {
    backgroundColor: '#4361ee', borderRadius: 10, padding: 16,
    alignItems: 'center', marginBottom: 16,
  },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  link:    { color: '#a0c4ff', textAlign: 'center', fontSize: 14 },
});
