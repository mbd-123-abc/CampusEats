import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { api } from '../api/client';
import { useAuthStore } from '../store/authStore';
import type { AuthState } from '../store/authStore';

const UNIVERSITIES = [{ id: 'uw_seattle', label: 'University of Washington' }];

export default function RegisterScreen() {
  const router = useRouter();
  const setToken   = useAuthStore((s: AuthState) => s.setToken);
  const error      = useAuthStore((s: AuthState) => s.error);
  const clearError = useAuthStore((s: AuthState) => s.clearError);
  const setError   = useAuthStore((s: AuthState) => s.setError);

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [university] = useState('uw_seattle');
  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Clear stale errors on mount
  useEffect(() => { clearError(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (username.length < 3 || username.length > 30) errs.username = 'Username must be 3–30 characters';
    else if (!/^[a-zA-Z0-9_]+$/.test(username)) errs.username = 'Letters, digits, and underscores only';
    if (password.length < 10) errs.password = 'Password must be at least 10 characters';
    if (password !== confirmPassword) errs.confirmPassword = 'Passwords do not match';
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleRegister = async () => {
    clearError();
    if (!validate()) return;
    setLoading(true);
    let success = false;
    try {
      const { data } = await api.post('/auth/register', { username, password, university });
      await setToken({ access_token: data.access_token, token_type: 'bearer', expires_in: data.expires_in ?? 86400 });
      success = true;
    } catch (err: any) {
      console.error('Raw Register Error:', err.message);
      console.error('Register Response:', err.response?.status, JSON.stringify(err.response?.data));
      const rawDetail = err.response?.data?.detail;
      // FastAPI 422 returns detail as an array of validation error objects
      const detail = Array.isArray(rawDetail)
        ? (rawDetail[0]?.msg ?? 'Validation error')
        : (rawDetail ?? '');
      const lower = String(detail).toLowerCase();
      if (lower.includes('username') || lower.includes('already') || lower.includes('exist') || lower.includes('taken')) {
        setError('That username is unavailable. Please try a different one.');
      } else if (lower.includes('password') || lower.includes('weak')) {
        setError(String(detail));
      } else if (detail) {
        setError(String(detail));
      } else {
        setError('Registration failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
    if (success) router.replace('/dashboard');
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'android' ? 'height' : 'padding'} style={{ flex: 1, justifyContent: 'center' }}>
      <Text style={styles.title}>Create Account</Text>

      <TextInput
        style={styles.input}
        placeholder="Username"
        placeholderTextColor="#666"
        value={username}
        onChangeText={t => { setUsername(t); clearError(); setFieldErrors(p => ({ ...p, username: '' })); }}
        autoCapitalize="none"
        autoCorrect={false}
      />
      {fieldErrors.username ? <Text style={styles.fieldError}>{fieldErrors.username}</Text> : null}

      <TextInput
        style={styles.input}
        placeholder="Password"
        placeholderTextColor="#666"
        value={password}
        onChangeText={t => { setPassword(t); clearError(); setFieldErrors(p => ({ ...p, password: '' })); }}
        secureTextEntry
      />
      {fieldErrors.password ? <Text style={styles.fieldError}>{fieldErrors.password}</Text> : null}

      <TextInput
        style={styles.input}
        placeholder="Confirm Password"
        placeholderTextColor="#666"
        value={confirmPassword}
        onChangeText={t => { setConfirmPassword(t); setFieldErrors(p => ({ ...p, confirmPassword: '' })); }}
        secureTextEntry
      />
      {fieldErrors.confirmPassword ? <Text style={styles.fieldError}>{fieldErrors.confirmPassword}</Text> : null}

      <View style={styles.universityBox}>
        <Text style={styles.universityLabel}>University</Text>
        <Text style={styles.universityValue}>{UNIVERSITIES[0].label}</Text>
      </View>

      {error && <Text style={styles.errorBox}>{error}</Text>}

      <TouchableOpacity style={styles.btn} onPress={handleRegister} disabled={loading} accessibilityRole="button">
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Create Account</Text>}
      </TouchableOpacity>

      <TouchableOpacity onPress={() => router.push('/login')} accessibilityRole="button">
        <Text style={styles.link}>Already have an account? Log in</Text>
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
    padding: 14, marginBottom: 4, fontSize: 15,
  },
  fieldError: { color: '#ff6b6b', fontSize: 12, marginBottom: 8, marginLeft: 4 },
  errorBox: {
    backgroundColor: '#2d0a0a', borderWidth: 1, borderColor: '#c0392b',
    borderRadius: 8, padding: 12, marginBottom: 12,
    color: '#ff6b6b', fontSize: 13, textAlign: 'center',
  },
  universityBox: {
    backgroundColor: '#1a1a2e', borderRadius: 10, padding: 14, marginBottom: 16,
  },
  universityLabel: { color: '#666', fontSize: 11, marginBottom: 2 },
  universityValue: { color: '#fff', fontSize: 15 },
  btn: {
    backgroundColor: '#4361ee', borderRadius: 10, padding: 16,
    alignItems: 'center', marginBottom: 16,
  },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  link:    { color: '#a0c4ff', textAlign: 'center', fontSize: 14 },
});
