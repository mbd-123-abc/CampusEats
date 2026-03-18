import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  SafeAreaView, ScrollView, Alert, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { api } from '../api/client';
import { PortionSize, MealMood } from '../types';

const PORTION_OPTIONS: { label: string; value: PortionSize }[] = [
  { label: 'Small / Side', value: 0.5 },
  { label: 'Standard', value: 1.0 },
  { label: 'Large / Hungry', value: 1.5 },
];

const MOOD_OPTIONS: { emoji: string; value: MealMood }[] = [
  { emoji: '😴', value: 'low' },
  { emoji: '😐', value: 'neutral' },
  { emoji: '⚡️', value: 'high' },
];

/**
 * ManualLogScreen — opened by [+] button in top-right nav bar.
 * Full search/select flow. Completely separate from QuickLogPrompt.
 */
export default function ManualLogScreen() {
  const router = useRouter();
  const [itemInput, setItemInput] = useState('');
  const [items, setItems] = useState<string[]>([]);
  const [portion, setPortion] = useState<PortionSize>(1.0);
  const [mood, setMood] = useState<MealMood | null>(null);
  const [loading, setLoading] = useState(false);

  const addItem = () => {
    const trimmed = itemInput.trim();
    if (trimmed) {
      setItems((prev: string[]) => [...prev, trimmed]);
      setItemInput('');
    }
  };

  const removeItem = (index: number) => {
    setItems((prev: string[]) => prev.filter((_: string, i: number) => i !== index));
  };

  const handleLog = async () => {
    if (items.length === 0) {
      Alert.alert('Add at least one item');
      return;
    }
    setLoading(true);
    try {
      await api.post('/meals/log', {
        items,
        portion_size: portion,
        meal_mood: mood,
        source: 'manual_search',
        nutrients: [],  // auto-estimated server-side from USDA
      });
      router.back();
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.detail ?? 'Failed to log meal');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView>
        <Text style={styles.title}>Log a Meal</Text>

        {/* Smart-Box multi-select */}
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            placeholder="Search food items..."
            placeholderTextColor="#666"
            value={itemInput}
            onChangeText={setItemInput}
            onSubmitEditing={addItem}
            returnKeyType="done"
          />
          <TouchableOpacity style={styles.addItemBtn} onPress={addItem} accessibilityRole="button">
            <Text style={styles.addItemBtnText}>Add</Text>
          </TouchableOpacity>
        </View>

        {/* Chips */}
        <View style={styles.chips}>
          {items.map((item: string, i: number) => (
            <TouchableOpacity
              key={i}
              style={styles.chip}
              onPress={() => removeItem(i)}
              accessibilityRole="button"
              accessibilityLabel={`Remove ${item}`}
            >
              <Text style={styles.chipText}>{item} ×</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Portion toggle */}
        <Text style={styles.sectionLabel}>Portion Size</Text>
        <View style={styles.portionRow}>
          {PORTION_OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt.value}
              style={[styles.portionBtn, portion === opt.value && styles.portionBtnActive]}
              onPress={() => setPortion(opt.value)}
              accessibilityRole="radio"
              accessibilityState={{ checked: portion === opt.value }}
            >
              <Text style={[styles.portionText, portion === opt.value && styles.portionTextActive]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Meal mood — optional */}
        <Text style={styles.sectionLabel}>How did you feel after? (optional)</Text>
        <View style={styles.moodRow}>
          {MOOD_OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt.value}
              style={[styles.moodBtn, mood === opt.value && styles.moodBtnActive]}
              onPress={() => setMood(mood === opt.value ? null : opt.value)}
              accessibilityRole="radio"
              accessibilityState={{ checked: mood === opt.value }}
            >
              <Text style={styles.moodEmoji}>{opt.emoji}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity style={styles.logBtn} onPress={handleLog} disabled={loading} accessibilityRole="button">
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.logBtnText}>Log Meal</Text>}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f1a', padding: 16 },
  title: { color: '#fff', fontSize: 24, fontWeight: '700', marginBottom: 20 },
  inputRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  input: {
    flex: 1, backgroundColor: '#1a1a2e', color: '#fff',
    borderRadius: 10, padding: 12, fontSize: 15,
  },
  addItemBtn: { backgroundColor: '#4361ee', borderRadius: 10, padding: 12, justifyContent: 'center' },
  addItemBtnText: { color: '#fff', fontWeight: '600' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  chip: { backgroundColor: '#1a1a2e', borderRadius: 20, paddingVertical: 6, paddingHorizontal: 12 },
  chipText: { color: '#a0c4ff', fontSize: 13 },
  sectionLabel: { color: '#666', fontSize: 12, textTransform: 'uppercase', marginBottom: 8 },
  portionRow: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  portionBtn: { flex: 1, backgroundColor: '#1a1a2e', borderRadius: 10, padding: 12, alignItems: 'center' },
  portionBtnActive: { backgroundColor: '#4361ee' },
  portionText: { color: '#888', fontSize: 13 },
  portionTextActive: { color: '#fff', fontWeight: '600' },
  moodRow: { flexDirection: 'row', gap: 16, marginBottom: 24 },
  moodBtn: { backgroundColor: '#1a1a2e', borderRadius: 12, padding: 14 },
  moodBtnActive: { backgroundColor: '#2d2d4e' },
  moodEmoji: { fontSize: 24 },
  logBtn: {
    backgroundColor: '#4361ee', borderRadius: 12, padding: 16,
    alignItems: 'center', marginBottom: 32,
  },
  logBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
