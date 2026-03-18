import React, { useEffect, useRef, useState } from 'react';
import {
  SafeAreaView,
  ScrollView,
  View,
  Text,
  Switch,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { api } from '../src/api/client';
import { useAuthStore } from '../src/store/authStore';
import type { AuthState } from '../src/store/authStore';

const HARD_FILTER_OPTIONS = ['nut-free', 'gluten-free', 'dairy-free'];
const PREF_FILTER_OPTIONS = ['vegan', 'vegetarian', 'pescatarian', 'pollotarian', 'eggetarian', 'halal', 'kosher'];
const NUTRIENT_OPTIONS = ['iron', 'protein', 'vitamin_d', 'calcium', 'vitamin_b12', 'fiber'];
const INTENSITY_OPTIONS: Array<'chill' | 'midterm' | 'finals'> = ['chill', 'midterm', 'finals'];
const SPEED_OPTIONS: Array<'slow' | 'average' | 'power'> = ['slow', 'average', 'power'];
const MEAL_PLAN_OPTIONS: Array<'unlimited' | '14_per_week' | 'commuter_cash'> = [
  'unlimited', '14_per_week', 'commuter_cash',
];

function toggle<T>(arr: T[], item: T): T[] {
  return arr.includes(item) ? arr.filter((x) => x !== item) : [...arr, item];
}

function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      style={[styles.chip, selected && styles.chipSelected]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
    >
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </TouchableOpacity>
  );
}

function SectionLabel({ title }: { title: string }) {
  return <Text style={styles.sectionLabel}>{title}</Text>;
}

export default function ProfileScreen() {
  const router = useRouter();
  const clearToken = useAuthStore((s: AuthState) => s.clearToken);

  const [hardFilters, setHardFilters] = useState<string[]>([]);
  const [prefFilters, setPrefFilters] = useState<string[]>([]);
  const [trackedNutrients, setTrackedNutrients] = useState<string[]>(['iron', 'protein']);
  const [studyIntensity, setStudyIntensity] = useState<'chill' | 'midterm' | 'finals'>('chill');
  const [walkingSpeed, setWalkingSpeed] = useState<'slow' | 'average' | 'power'>('average');
  const [mealPlan, setMealPlan] = useState<'unlimited' | '14_per_week' | 'commuter_cash'>('unlimited');
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadedRef = useRef(false);

  // Load saved preferences on mount
  useEffect(() => {
    api.get('/profile/preferences').then(({ data }) => {
      if (data.hard_filters?.length)       setHardFilters(data.hard_filters);
      if (data.preference_filters?.length) setPrefFilters(data.preference_filters);
      if (data.nutrient_focus?.length)     setTrackedNutrients(data.nutrient_focus);
      if (data.academic_intensity)         setStudyIntensity(data.academic_intensity);
      if (data.walking_speed)              setWalkingSpeed(data.walking_speed);
      if (data.meal_plan_type)             setMealPlan(data.meal_plan_type);
      loadedRef.current = true;
    }).catch(() => { loadedRef.current = true; });
  }, []);

  // Auto-save with debounce whenever any preference changes
  const autoSave = (overrides: object = {}) => {
    if (!loadedRef.current) return; // don't save during initial load
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setSaveStatus('saving');
    debounceRef.current = setTimeout(() => {
      api.put('/profile/preferences', {
        hard_filters: hardFilters,
        preference_filters: prefFilters,
        nutrient_focus: trackedNutrients,
        likes: [],
        dislikes: [],
        pantry_items: [],
        academic_intensity: studyIntensity,
        walking_speed: walkingSpeed,
        meal_plan_type: mealPlan,
        dislike_strictness: 'low',
        show_calories: false,
        ...overrides,
      }).then(() => setSaveStatus('saved'))
        .catch(() => setSaveStatus('idle'));
    }, 600);
  };

  const handleLogout = () => {
    Alert.alert('Log out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log out', style: 'destructive', onPress: () => { clearToken(); router.replace('/login'); } },
    ]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} accessibilityRole="button">
          <Text style={styles.backBtn}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Profile</Text>
        <Text style={styles.saveIndicator}>
          {saveStatus === 'saving' ? 'saving…' : saveStatus === 'saved' ? 'saved' : ''}
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <SectionLabel title="Allergies & Dietary Restrictions" />
        <Text style={styles.hint}>Items that don't match are hidden from your menu.</Text>
        <View style={styles.chipRow}>
          {HARD_FILTER_OPTIONS.map((f) => (
            <Chip key={f} label={f} selected={hardFilters.includes(f)} onPress={() => {
              const next = toggle(hardFilters, f);
              setHardFilters(next);
              autoSave({ hard_filters: next });
            }} />
          ))}
        </View>

        <SectionLabel title="Food Preferences" />
        <Text style={styles.hint}>Only items matching your preferences are shown.</Text>
        <View style={styles.chipRow}>
          {PREF_FILTER_OPTIONS.map((f) => (
            <Chip key={f} label={f} selected={prefFilters.includes(f)} onPress={() => {
              const next = toggle(prefFilters, f);
              setPrefFilters(next);
              autoSave({ preference_filters: next });
            }} />
          ))}
        </View>

        <SectionLabel title="Track These Nutrients" />
        <View style={styles.chipRow}>
          {NUTRIENT_OPTIONS.map((n) => (
            <Chip key={n} label={n.replace('_', ' ')} selected={trackedNutrients.includes(n)} onPress={() => {
              const next = toggle(trackedNutrients, n);
              setTrackedNutrients(next);
              autoSave({ nutrient_focus: next });
            }} />
          ))}
        </View>

        <SectionLabel title="Study Intensity" />
        <View style={styles.chipRow}>
          {INTENSITY_OPTIONS.map((i) => (
            <Chip key={i} label={i} selected={studyIntensity === i} onPress={() => {
              setStudyIntensity(i);
              autoSave({ academic_intensity: i });
            }} />
          ))}
        </View>

        <SectionLabel title="Walking Speed" />
        <View style={styles.chipRow}>
          {SPEED_OPTIONS.map((s) => (
            <Chip key={s} label={s} selected={walkingSpeed === s} onPress={() => {
              setWalkingSpeed(s);
              autoSave({ walking_speed: s });
            }} />
          ))}
        </View>

        <SectionLabel title="Meal Plan" />
        <View style={styles.chipRow}>
          {MEAL_PLAN_OPTIONS.map((m) => (
            <Chip key={m} label={m.replace(/_/g, ' ')} selected={mealPlan === m} onPress={() => {
              setMealPlan(m);
              autoSave({ meal_plan_type: m });
            }} />
          ))}
        </View>

        <SectionLabel title="Notifications" />
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Meal window alerts</Text>
          <Switch
            value={notificationsEnabled}
            onValueChange={setNotificationsEnabled}
            trackColor={{ false: '#333', true: '#a0c4ff' }}
            thumbColor={notificationsEnabled ? '#fff' : '#888'}
          />
        </View>

        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} accessibilityRole="button">
          <Text style={styles.logoutText}>Log out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f1a' },
  topBar: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12,
  },
  title: { color: '#fff', fontSize: 18, fontWeight: '700' },
  backBtn: { color: '#a0c4ff', fontSize: 14, width: 48 },
  saveIndicator: { color: '#555', fontSize: 12, width: 48, textAlign: 'right' },
  scroll: { paddingHorizontal: 16, paddingBottom: 40 },
  sectionLabel: {
    color: '#666', fontSize: 11, textTransform: 'uppercase',
    letterSpacing: 1, marginTop: 24, marginBottom: 4,
  },
  hint: { color: '#555', fontSize: 12, marginBottom: 8 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderColor: '#333', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
  chipSelected: { backgroundColor: '#a0c4ff', borderColor: '#a0c4ff' },
  chipText: { color: '#888', fontSize: 13 },
  chipTextSelected: { color: '#0f0f1a', fontWeight: '600' },
  row: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#1e1e2e',
  },
  rowLabel: { color: '#ccc', fontSize: 15 },
  logoutBtn: {
    borderWidth: 1, borderColor: '#ff6b6b', borderRadius: 12,
    paddingVertical: 14, alignItems: 'center', marginTop: 32,
  },
  logoutText: { color: '#ff6b6b', fontWeight: '600', fontSize: 16 },
});
