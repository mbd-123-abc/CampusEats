import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  SafeAreaView, ActivityIndicator, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { api } from '../api/client';
import { useAuthStore } from '../store/authStore';

const UNIVERSITIES = [{ id: 'uw_seattle', label: 'University of Washington' }];

export default function RegisterScreen() {
  const router = useRouter();
  const setToken = useAuthStore((s) => s.setToken);

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');  // client-side only, never sent
  const [university] = useState('uw_seattle');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (username.length < 3 || username.length > 30) errs.username = 'Username must be 3–30 characters';
    if (!/^[a-zA-Z0-9_]+$/.test(username)) errs.username = 'Letters, digits, and underscores only';
    if (password.length < 10) errs.password = 'Password must be at least 10 characters';
    if (password !== confirmPassword) errs.confirmPassword = 'Passwords do not match';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleRegister = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      // confirmPassword is NOT sent to the backend
      const { data } = await api.post('/auth/register', { username, password, university });
      await setToken(data);
      try {
        router.replace('/dashboard');
      } catch {
        router.push('/dashboard');
      }
    } catch (err: any) {
      const detail = err.response?.data?.detail ?? 'Registration failed';
      Alert.alert('Error', detail);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Create Account</Text>

      <TextInput
        style={styles.input}
        placeholder="Username"
        placeholderTextColor="#666"
        value={username}
        onChangeText={setUsername}
        autoCapitalize="none"
        autoCorrect={false}
      />
      {errors.username && <Text style={styles.error}>{errors.username}</Text>}

      <TextInput
        style={styles.input}
        placeholder="Password"
        placeholderTextColor="#666"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />
      {errors.password && <Text style={styles.error}>{errors.password}</Text>}

      {/* Confirm password — client-side validation only, never sent to backend */}
      <TextInput
        style={styles.input}
        placeholder="Confirm Password"
        placeholderTextColor="#666"
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        secureTextEntry
      />
      {errors.confirmPassword && <Text style={styles.error}>{errors.confirmPassword}</Text>}

      <View style={styles.universityBox}>
        <Text style={styles.universityLabel}>University</Text>
        <Text style={styles.universityValue}>{UNIVERSITIES[0].label}</Text>
      </View>

      <TouchableOpacity style={styles.btn} onPress={handleRegister} disabled={loading} accessibilityRole="button">
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Create Account</Text>}
      </TouchableOpacity>

      <TouchableOpacity onPress={() => router.push('/login')} accessibilityRole="button">
        <Text style={styles.link}>Already have an account? Log in</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f1a', padding: 24, justifyContent: 'center' },
  title: { color: '#fff', fontSize: 28, fontWeight: '700', marginBottom: 32 },
  input: {
    backgroundColor: '#1a1a2e', color: '#fff', borderRadius: 10,
    padding: 14, marginBottom: 4, fontSize: 15,
  },
  error: { color: '#ff6b6b', fontSize: 12, marginBottom: 8, marginLeft: 4 },
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
  link: { color: '#a0c4ff', textAlign: 'center', fontSize: 14 },
});
