import React, { useState } from 'react';
import {
  SafeAreaView, ScrollView, View, Text, TextInput,
  TouchableOpacity, StyleSheet, Alert, ActivityIndicator, Switch, Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { api } from '../api/client';

const VENUES = [
  // Dining halls
  'Center Table',
  'Local Point',
  // Food court
  'Husky Den Food Court',
  // Restaurants
  'Cultivate',
  'By George',
  // Cafés & espresso bars
  'Dawg Bites',
  'Husky Den Café',
  'Husky Grind Café — Alder',
  'Husky Grind Café — Oak',
  'Husky Grind Café — Mercer Court',
  'Microsoft Café',
  "Orin's Place",
  'Public Grounds',
  'The Rotunda',
  'Tower Café',
  // Starbucks
  'Starbucks — Population Health',
  'Starbucks — Suzzallo',
  // Markets
  'District Market — Alder',
  'District Market — Oak',
  'Etc. — The HUB',
];

const DIET_TAGS = [
  'vegan', 'vegetarian', 'pescatarian', 'pollotarian', 'eggetarian',
  'halal', 'kosher', 'gluten-free', 'nut-free', 'dairy-free',
];

const MEAL_PERIODS = ['breakfast', 'lunch', 'dinner', 'all day'];

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      style={[styles.chip, selected && styles.chipOn]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
    >
      <Text style={[styles.chipText, selected && styles.chipTextOn]}>{label}</Text>
    </TouchableOpacity>
  );
}

function toggle<T>(arr: T[], item: T): T[] {
  return arr.includes(item) ? arr.filter((x) => x !== item) : [...arr, item];
}

function toDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function CalendarPicker({ value, onChange }: { value: string; onChange: (d: string) => void }) {
  const today = new Date();
  const initial = value ? new Date(value + 'T12:00:00') : today;
  const [viewing, setViewing] = useState(new Date(initial.getFullYear(), initial.getMonth(), 1));
  const [open, setOpen] = useState(false);

  const year = viewing.getFullYear();
  const month = viewing.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const select = (day: number) => {
    const d = new Date(year, month, day);
    onChange(toDateString(d));
    setOpen(false);
  };

  const selectedDay = value ? new Date(value + 'T12:00:00') : null;

  return (
    <>
      <TouchableOpacity style={styles.dateBtn} onPress={() => setOpen(true)} accessibilityRole="button">
        <Text style={styles.dateBtnText}>{value || 'Pick a date'}</Text>
        <Text style={styles.dateBtnIcon}>📅</Text>
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade">
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setOpen(false)}>
          <TouchableOpacity activeOpacity={1} style={styles.calendar}>
            {/* Month nav */}
            <View style={styles.calHeader}>
              <TouchableOpacity onPress={() => setViewing(new Date(year, month - 1, 1))} accessibilityRole="button">
                <Text style={styles.calNav}>‹</Text>
              </TouchableOpacity>
              <Text style={styles.calMonth}>{MONTHS[month]} {year}</Text>
              <TouchableOpacity onPress={() => setViewing(new Date(year, month + 1, 1))} accessibilityRole="button">
                <Text style={styles.calNav}>›</Text>
              </TouchableOpacity>
            </View>

            {/* Day labels */}
            <View style={styles.calRow}>
              {DAYS.map((d) => (
                <Text key={d} style={styles.calDayLabel}>{d}</Text>
              ))}
            </View>

            {/* Date grid */}
            <View style={styles.calGrid}>
              {cells.map((day, i) => {
                if (!day) return <View key={`e-${i}`} style={styles.calCell} />;
                const isSelected = selectedDay?.getDate() === day &&
                  selectedDay?.getMonth() === month &&
                  selectedDay?.getFullYear() === year;
                const isToday = today.getDate() === day &&
                  today.getMonth() === month &&
                  today.getFullYear() === year;
                return (
                  <TouchableOpacity
                    key={day}
                    style={[styles.calCell, isSelected && styles.calCellSelected, isToday && !isSelected && styles.calCellToday]}
                    onPress={() => select(day)}
                    accessibilityRole="button"
                  >
                    <Text style={[styles.calCellText, isSelected && styles.calCellTextSelected]}>{day}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

export default function AdminMenuScreen() {
  const router = useRouter();

  const [name, setName] = useState('');
  const [venue, setVenue] = useState('');
  const [mealPeriod, setMealPeriod] = useState('');
  const [date, setDate] = useState('');
  const [alwaysAvailable, setAlwaysAvailable] = useState(false);
  const [tags, setTags] = useState<string[]>([]);
  const [venueOpen, setVenueOpen] = useState(true);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!name.trim() || !venue || !mealPeriod) {
      Alert.alert('Name, venue, and meal period are required');
      return;
    }
    if (!alwaysAvailable && !date) {
      Alert.alert('Pick a date or mark as always available');
      return;
    }
    setSaving(true);
    try {
      await Promise.all([
        api.post('/admin/menu/items', {
          name: name.trim(),
          venue,
          meal_period: mealPeriod,
          date: alwaysAvailable ? null : date,
          always_available: alwaysAvailable,
          diet_tags: tags,
        }),
        api.patch('/admin/venues/' + encodeURIComponent(venue), { is_open: venueOpen }),
      ]);
      Alert.alert('Saved', `${name} added to ${venue}`);
      setName('');
      setMealPeriod('');
      setDate('');
      setAlwaysAvailable(false);
      setTags([]);
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.detail ?? 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} accessibilityRole="button">
          <Text style={styles.back}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Admin — Menu</Text>
        <View style={{ width: 48 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.section}>Add Weekly Item</Text>

        <TextInput
          style={styles.input}
          placeholder="Item name (e.g. Quinoa Power Bowl)"
          placeholderTextColor="#555"
          value={name}
          onChangeText={setName}
        />

        <Text style={styles.label}>Date</Text>
        <View style={styles.toggleRow}>
          <Text style={styles.toggleLabel}>Always available</Text>
          <Switch
            value={alwaysAvailable}
            onValueChange={setAlwaysAvailable}
            trackColor={{ false: '#333', true: '#52b788' }}
            thumbColor="#fff"
          />
        </View>
        {!alwaysAvailable && (
          <>
            <Text style={styles.subLabel}>Pick a date</Text>
            <CalendarPicker value={date} onChange={setDate} />
          </>
        )}

        <Text style={styles.label}>Meal Period</Text>
        <View style={styles.chipRow}>
          {MEAL_PERIODS.map((p) => (
            <Chip key={p} label={p} selected={mealPeriod === p} onPress={() => setMealPeriod(p)} />
          ))}
        </View>

        <Text style={styles.label}>Venue</Text>
        <View style={styles.chipRow}>
          {VENUES.map((v) => (
            <Chip key={v} label={v} selected={venue === v} onPress={() => setVenue(v)} />
          ))}
        </View>

        {/* Venue open/close — inline, only shown once a venue is selected */}
        {venue !== '' && (
          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>
              {venue} is {venueOpen ? 'open' : 'closed'}
            </Text>
            <Switch
              value={venueOpen}
              onValueChange={setVenueOpen}
              trackColor={{ false: '#ff6b6b', true: '#52b788' }}
              thumbColor="#fff"
            />
          </View>
        )}

        <Text style={styles.label}>Dietary Tags</Text>
        <View style={styles.chipRow}>
          {DIET_TAGS.map((t) => (
            <Chip key={t} label={t} selected={tags.includes(t)} onPress={() => setTags(toggle(tags, t))} />
          ))}
        </View>

        <Text style={styles.note}>Nutrient data is calculated automatically.</Text>

        <TouchableOpacity
          style={[styles.btn, saving && styles.btnDisabled]}
          onPress={handleSubmit}
          disabled={saving}
          accessibilityRole="button"
        >
          {saving ? <ActivityIndicator color="#0f0f1a" /> : <Text style={styles.btnText}>Save Item</Text>}
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
  title: { color: '#fff', fontSize: 17, fontWeight: '700' },
  back: { color: '#a0c4ff', fontSize: 14, width: 48 },
  scroll: { paddingHorizontal: 16, paddingBottom: 48 },
  section: { color: '#a0c4ff', fontSize: 13, fontWeight: '700', textTransform: 'uppercase', marginBottom: 12 },
  label: { color: '#666', fontSize: 11, textTransform: 'uppercase', marginTop: 16, marginBottom: 6 },
  input: {
    backgroundColor: '#1a1a2e', color: '#fff', borderRadius: 10,
    padding: 12, fontSize: 14, marginBottom: 8,
  },
  dateBtn: {
    backgroundColor: '#1a1a2e', borderRadius: 10, padding: 12,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  dateBtnText: { color: '#fff', fontSize: 14 },
  dateBtnIcon: { fontSize: 16 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderColor: '#333', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
  chipOn: { backgroundColor: '#a0c4ff', borderColor: '#a0c4ff' },
  chipText: { color: '#888', fontSize: 12 },
  chipTextOn: { color: '#0f0f1a', fontWeight: '600' },
  toggleRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', paddingVertical: 12, marginTop: 8,
  },
  toggleLabel: { color: '#ccc', fontSize: 14 },
  note: { color: '#444', fontSize: 12, marginTop: 16, fontStyle: 'italic' },
  subLabel: { color: '#555', fontSize: 11, textTransform: 'uppercase', marginBottom: 6, marginTop: 8 },
  btn: {
    backgroundColor: '#a0c4ff', borderRadius: 12,
    paddingVertical: 14, alignItems: 'center', marginTop: 20,
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: '#0f0f1a', fontWeight: '700', fontSize: 15 },
  // Calendar modal
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center', alignItems: 'center',
  },
  calendar: {
    backgroundColor: '#1a1a2e', borderRadius: 16, padding: 16, width: 320,
  },
  calHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  calMonth: { color: '#fff', fontSize: 15, fontWeight: '700' },
  calNav: { color: '#a0c4ff', fontSize: 22, paddingHorizontal: 8 },
  calRow: { flexDirection: 'row', marginBottom: 4 },
  calDayLabel: { color: '#555', fontSize: 11, width: 40, textAlign: 'center' },
  calGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  calCell: { width: 40, height: 36, justifyContent: 'center', alignItems: 'center' },
  calCellSelected: { backgroundColor: '#a0c4ff', borderRadius: 18 },
  calCellToday: { borderWidth: 1, borderColor: '#a0c4ff', borderRadius: 18 },
  calCellText: { color: '#ccc', fontSize: 13 },
  calCellTextSelected: { color: '#0f0f1a', fontWeight: '700' },
});
