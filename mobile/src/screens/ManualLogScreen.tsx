import React, { useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Alert, ActivityIndicator, FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { api } from '../api/client';
import { useFoodSearch, calcMultiplier, applyPortion } from '../hooks/useFoodSearch';
import type { FoodResult, QuickPortion } from '../hooks/useFoodSearch';
import type { MealMood } from '../types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface LoggedItem {
  food: FoodResult;
  mode: 'quick' | 'digit';
  quickPortion: QuickPortion;
  digitCount: number;
  // resolved nutrients after portion math
  nutrients: Record<string, number>;
  multiplier: number;
}

// Each mood option needs a unique id so selection is truly single-pick
const MOOD_OPTIONS: { emoji: string; label: string; value: MealMood; id: string }[] = [
  { id: 'stuffed',      emoji: '🤤', label: 'Stuffed',      value: 'food_coma'    },
  { id: 'energetic',    emoji: '⚡️', label: 'Energetic',    value: 'energized'    },
  { id: 'happy',        emoji: '😊', label: 'Happy',        value: 'satisfied'    },
  { id: 'satisfied',    emoji: '👌', label: 'Satisfied',    value: 'satisfied'    },
  { id: 'tired',        emoji: '😴', label: 'Tired',        value: 'food_coma'    },
  { id: 'light',        emoji: '🪶', label: 'Light',        value: 'energized'    },
  { id: 'still_hungry', emoji: '🥨', label: 'Still Hungry', value: 'still_hungry' },
  { id: 'sleepy',       emoji: '💤', label: 'Sleepy',       value: 'food_coma'    },
];

const QUICK_OPTIONS: { label: string; value: QuickPortion }[] = [
  { label: 'Side',   value: 'side'   },
  { label: 'Main',   value: 'main'   },
  { label: 'Hungry', value: 'hungry' },
];

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SearchResult({ food, onAdd }: { food: FoodResult; onAdd: (f: FoodResult) => void }) {
  return (
    <TouchableOpacity style={styles.resultRow} onPress={() => onAdd(food)} accessibilityRole="button">
      <Text style={styles.resultName} numberOfLines={2}>{food.name}</Text>
      {food.portion && (
        <Text style={styles.resultUnit}>per {food.portion.description}</Text>
      )}
    </TouchableOpacity>
  );
}

function ItemCard({
  item,
  onRemove,
  onChange,
}: {
  item: LoggedItem;
  onRemove: () => void;
  onChange: (updates: Partial<LoggedItem>) => void;
}) {
  const portionLabel = item.mode === 'digit' && item.food.portion
    ? `${item.digitCount} ${item.food.portion.description}`
    : QUICK_OPTIONS.find(o => o.value === item.quickPortion)?.label ?? 'Main';

  return (
    <View style={styles.itemCard}>
      <View style={styles.itemCardHeader}>
        <Text style={styles.itemCardName} numberOfLines={2}>{item.food.name}</Text>
        <TouchableOpacity onPress={onRemove} accessibilityRole="button" accessibilityLabel="Remove item">
          <Text style={styles.removeX}>×</Text>
        </TouchableOpacity>
      </View>

      {/* Quick portion chips */}
      <View style={styles.portionRow}>
        {QUICK_OPTIONS.map(opt => (
          <TouchableOpacity
            key={opt.value}
            style={[styles.portionChip, item.mode === 'quick' && item.quickPortion === opt.value && styles.portionChipActive]}
            onPress={() => onChange({ mode: 'quick', quickPortion: opt.value })}
            accessibilityRole="radio"
            accessibilityState={{ checked: item.mode === 'quick' && item.quickPortion === opt.value }}
          >
            <Text style={[styles.portionChipText, item.mode === 'quick' && item.quickPortion === opt.value && styles.portionChipTextActive]}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        ))}

        {/* Digit entry — only show if FDC returned a portion unit */}
        {item.food.portion && (
          <TextInput
            style={[styles.digitInput, item.mode === 'digit' && styles.digitInputActive]}
            keyboardType="numeric"
            value={item.mode === 'digit' ? String(item.digitCount) : ''}
            placeholder="#"
            placeholderTextColor="#555"
            onFocus={() => onChange({ mode: 'digit' })}
            onChangeText={t => {
              const n = parseInt(t, 10);
              if (!isNaN(n) && n > 0) onChange({ mode: 'digit', digitCount: n });
            }}
            maxLength={3}
            accessibilityLabel={`Quantity for ${item.food.portion.description}`}
          />
        )}
      </View>

      {/* Nutrient preview */}
      <Text style={styles.nutrientPreview}>
        {Object.entries(item.nutrients).length === 0
          ? 'No nutrient data from USDA'
          : Object.entries(item.nutrients)
              .filter(([k]) => ['protein', 'iron', 'calcium', 'fiber', 'vitamin_d', 'vitamin_b12', 'calories'].includes(k))
              .map(([k, v]) => `${k.replace(/_/g, ' ')}: ${v}`)
              .join('  ·  ') || 'Nutrients tracked'
        }
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

export default function ManualLogScreen() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<LoggedItem[]>([]);
  const [moods, setMoods] = useState<Set<string>>(new Set());
  const [logging, setLogging] = useState(false);

  const { results, loading: searching, error: searchError } = useFoodSearch(query);

  function resolveItem(food: FoodResult, mode: 'quick' | 'digit', quickPortion: QuickPortion, digitCount: number): LoggedItem {
    const multiplier = calcMultiplier(mode, quickPortion, digitCount, food.portion);
    const nutrients  = applyPortion(food.nutrients, multiplier);
    return { food, mode, quickPortion, digitCount, nutrients, multiplier };
  }

  const addFood = (food: FoodResult) => {
    // Prevent duplicate entries for the same food
    if (items.some(i => i.food.fdcId === food.fdcId)) {
      setQuery('');
      return;
    }
    setItems(prev => [...prev, resolveItem(food, 'quick', 'main', 1)]);
    setQuery('');
  };

  const updateItem = (index: number, updates: Partial<LoggedItem>) => {
    setItems(prev => prev.map((item, i) => {
      if (i !== index) return item;
      const next = { ...item, ...updates };
      // Recalculate nutrients whenever portion changes
      const multiplier = calcMultiplier(next.mode, next.quickPortion, next.digitCount, next.food.portion);
      return { ...next, multiplier, nutrients: applyPortion(next.food.nutrients, multiplier) };
    }));
  };

  const handleLog = async () => {
    if (items.length === 0) { Alert.alert('Add at least one item'); return; }
    setLogging(true);
    try {
      // Merge nutrients across all items
      const merged: Record<string, number> = {};
      for (const item of items) {
        for (const [k, v] of Object.entries(item.nutrients)) {
          merged[k] = (merged[k] ?? 0) + v;
        }
      }

      const nutrientPayload = Object.entries(merged).map(([name, amount]) => ({
        nutrient_name: name,
        raw_amount: amount,
        effective_amount: amount,
        is_estimated: true,
        accuracy_score: 0.80,
      }));

      const selectedMood = MOOD_OPTIONS.find(o => moods.has(o.id))?.value ?? null;

      const payload = {
        items: items.map(i => i.food.name),
        item_portions: items.map(i => i.multiplier),
        meal_mood: selectedMood,
        source: 'manual_search',
        nutrients: nutrientPayload,
      };
      console.log('Sending to Backend:', JSON.stringify(payload, null, 2));

      await api.post('/meals/log', payload);

      router.replace('/dashboard?refetch=1' as any);
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.detail ?? 'Failed to log meal');
    } finally {
      setLogging(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Log a Meal</Text>

        {/* Search */}
        <TextInput
          style={styles.searchInput}
          placeholder="Search Food"
          placeholderTextColor="#555"
          value={query}
          onChangeText={setQuery}
          returnKeyType="search"
          autoCorrect={false}
        />

        {/* Search results dropdown */}
        {query.length > 0 && (
          <View style={styles.resultsBox}>
            {searching ? (
              <ActivityIndicator color="#a0c4ff" style={{ padding: 12 }} />
            ) : searchError ? (
              <Text style={styles.searchError}>{searchError}</Text>
            ) : results.length === 0 ? (
              <Text style={styles.noResults}>No foods found.</Text>
            ) : (
              results.map(f => <SearchResult key={f.fdcId} food={f} onAdd={addFood} />)
            )}
          </View>
        )}

        {/* Logged items */}
        {items.map((item, i) => (
          <ItemCard
            key={`${item.food.fdcId}-${i}`}
            item={item}
            onRemove={() => setItems(prev => prev.filter((_, idx) => idx !== i))}
            onChange={updates => updateItem(i, updates)}
          />
        ))}

        {/* Mood */}
        {items.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>How do you feel? (optional)</Text>
            <View style={styles.moodGrid}>
              {MOOD_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt.id}
                  style={[styles.moodBtn, moods.has(opt.id) && styles.moodBtnActive]}
                  onPress={() => setMoods(prev => {
                    const next = new Set(prev);
                    next.has(opt.id) ? next.delete(opt.id) : next.add(opt.id);
                    return next;
                  })}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: moods.has(opt.id) }}
                >
                  <Text style={styles.moodEmoji}>{opt.emoji}</Text>
                  <Text style={[styles.moodLabel, moods.has(opt.id) && styles.moodLabelActive]}>{opt.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={[styles.logBtn, logging && styles.logBtnDisabled]}
              onPress={handleLog}
              disabled={logging}
              accessibilityRole="button"
            >
              {logging ? <ActivityIndicator color="#fff" /> : <Text style={styles.logBtnText}>Log Meal</Text>}
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: '#0f0f1a' },
  scroll:      { padding: 16, paddingBottom: 48 },
  title:       { color: '#fff', fontSize: 24, fontWeight: '700', marginBottom: 16 },

  searchInput: {
    backgroundColor: '#1a1a2e', color: '#fff', borderRadius: 12,
    padding: 14, fontSize: 15, marginBottom: 4,
  },
  resultsBox: {
    backgroundColor: '#12122a', borderRadius: 12, marginBottom: 12,
    borderWidth: 1, borderColor: '#2a2a4a', overflow: 'hidden',
  },
  resultRow: { padding: 12, borderBottomWidth: 1, borderBottomColor: '#1e1e3a' },
  resultName: { color: '#fff', fontSize: 14 },
  resultUnit: { color: '#555', fontSize: 11, marginTop: 2 },
  noResults:  { color: '#555', padding: 12, textAlign: 'center' },
  searchError: { color: '#e74c3c', padding: 12, textAlign: 'center', fontSize: 13 },

  itemCard: {
    backgroundColor: '#1a1a2e', borderRadius: 14, padding: 14,
    marginBottom: 10, gap: 10,
  },
  itemCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  itemCardName:   { color: '#fff', fontSize: 14, fontWeight: '600', flex: 1, marginRight: 8 },
  removeX:        { color: '#555', fontSize: 22, lineHeight: 24 },

  portionRow:      { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  portionChip:     { borderWidth: 1, borderColor: '#333', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6 },
  portionChipActive: { backgroundColor: '#4361ee', borderColor: '#4361ee' },
  portionChipText:   { color: '#888', fontSize: 13 },
  portionChipTextActive: { color: '#fff', fontWeight: '600' },

  digitInput:      { color: '#fff', fontSize: 14, width: 44, height: 34, textAlign: 'center', borderWidth: 1, borderColor: '#333', borderRadius: 8, backgroundColor: '#12122a' },
  digitInputActive: { borderColor: '#4361ee' },

  nutrientPreview: { color: '#444', fontSize: 11, lineHeight: 16 },

  sectionLabel: { color: '#666', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, marginTop: 20, marginBottom: 10 },
  moodGrid:     { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 24 },
  moodBtn:      { backgroundColor: '#1a1a2e', borderRadius: 12, paddingVertical: 10, paddingHorizontal: 14, alignItems: 'center', minWidth: 76 },
  moodBtnActive: { backgroundColor: '#2d2d4e', borderWidth: 1, borderColor: '#4361ee' },
  moodEmoji:    { fontSize: 20, marginBottom: 4 },
  moodLabel:    { color: '#666', fontSize: 11 },
  moodLabelActive: { color: '#a0c4ff' },

  logBtn:         { backgroundColor: '#4361ee', borderRadius: 12, padding: 16, alignItems: 'center' },
  logBtnDisabled: { opacity: 0.6 },
  logBtnText:     { color: '#fff', fontSize: 16, fontWeight: '600' },
});
