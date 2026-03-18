import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuthToken } from '../types';

function parseUsername(token: string): string | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.username ?? payload.sub ?? null;
  } catch {
    return null;
  }
}

export interface AuthState {
  token: string | null;
  username: string | null;
  hydrated: boolean;
  setToken: (token: AuthToken) => Promise<void>;
  clearToken: () => Promise<void>;
  loadToken: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  username: null,
  hydrated: false,

  setToken: async (auth: AuthToken) => {
    await AsyncStorage.setItem('access_token', auth.access_token);
    set({ token: auth.access_token, username: parseUsername(auth.access_token) });
  },

  clearToken: async () => {
    await AsyncStorage.removeItem('access_token');
    set({ token: null, username: null });
  },

  loadToken: async () => {
    const token = await AsyncStorage.getItem('access_token');
    set({ token, username: token ? parseUsername(token) : null, hydrated: true });
  },
}));
