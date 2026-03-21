import React, { useEffect, useRef, useState } from 'react';
import {
  ScrollView, View, Text,
  TouchableOpacity, StyleSheet, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { api } from '../api/client';

// breakfast < 11:00, lunch 11:00–14:59, dinner 15:00–20:59, else all day
export function currentMealPeriod(now = new Date()): string {
  const h = now.getHours();
  if (h < 11) return 'breakfast';
  if (h < 15) return 'lunch';
  if (h < 21) return 'dinner';
  return 'all day';
}

const PERIOD_ORDER = ['breakfast', 'lunch', 'dinner', 'all day'];

const TAG_COLORS: Record<string, string> = {
  vegan: '#52b788',
  vegetarian: '#74c69d',
  pescatarian: '#4cc9f0',
  pollotarian: '#90e0ef',
  eggetarian: '#caf0f8',
  halal: '#f8961e',
  kosher: '#f3722c',
  'gluten-free': '#f9c74f',
  'nut-free': '#f9844a',
  'dairy-free': '#a0c4ff',
};

type MenuItem = {
  item_id: string;
  name: string;
  meal_period: string;
  diet_tags: string[];
  always_available: boolean;
  date: string | null;
};

export default function VenueMenuScreen() {
  const router = useRouter();
  const { venue, period: periodParam } = useLocalSearchParams<{ venue: string; period?: string }>();

  // null = show all periods; set when user taps a tab
  const [selectedPeriod, setSelectedPeriod] = useState<string | null>(null);
  const currentPeriod = periodParam ?? currentMealPeriod();

  const [items, setItems] = useState<MenuItem[]>([]);
  const [isOpen, setIsOpen] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [hardFilters, setHardFilters] = useState<string[]>([]);
  const [prefFilters, setPrefFilters] = useState<string[]>([]);
  const scrollRef = useRef<ScrollView>(null);
  const sectionOffsets = useRef<Record<string, number>>({});

  // Load user preferences
  useEffect(() => {
    api.get('/profile/preferences')
      .then(({ data }) => {
        setHardFilters(data.hard_filters ?? []);
        setPrefFilters(data.preference_filters ?? []);
      })
      .catch(() => {}); // silently ignore — no prefs = no filtering
  }, []);

  useEffect(() => {
    if (!venue) return;
    const url = `/admin/menu/${encodeURIComponent(venue)}`;
    console.log('[VenueMenu] fetching', url);
    api.get(url)
      .then(({ data }) => {
        console.log('[VenueMenu] got', data.items?.length, 'items');
        setItems(data.items);
        setIsOpen(data.is_open);
      })
      .catch((err) => {
        console.error('[VenueMenu] error', err?.response?.status, err?.message, err?.response?.data);
        setError(`Could not load menu (${err?.response?.status ?? err?.message})`);
      })
      .finally(() => setLoading(false));
  }, [venue]);

  // Scroll to active period once layout is ready
  const scrollToActivePeriod = () => {
    if (selectedPeriod) return; // user has manually filtered, don't auto-scroll
    const offset = sectionOffsets.current[currentPeriod];
    if (offset !== undefined) {
      scrollRef.current?.scrollTo({ y: offset - 12, animated: true });
    }
  };

  const grouped = PERIOD_ORDER.reduce<Record<string, MenuItem[]>>((acc, p) => {
    const group = items.filter((i) => {
      if (i.meal_period !== p) return false;
      // Hard-hide items that violate allergies (item must have ALL hard filter tags)
      if (hardFilters.length > 0) {
        const hasAllRestrictions = hardFilters.every(tag => i.diet_tags.includes(tag));
        if (!hasAllRestrictions) return false;
      }
      // Hard-hide items that don't match food preferences (when preferences are set)
      if (prefFilters.length > 0) {
        const matchesPref = prefFilters.some(tag => i.diet_tags.includes(tag));
        if (!matchesPref) return false;
      }
      return true;
    });
    if (group.length) acc[p] = group;
    return acc;
  }, {});

  // When a period is selected, only show that period's items; otherwise show all
  const visibleGrouped = selectedPeriod
    ? { [selectedPeriod]: grouped[selectedPeriod] ?? [] }
    : grouped;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} accessibilityRole="button">
          <Text style={styles.back}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title} numberOfLines={1}>{venue}</Text>
        <View style={{ width: 48 }} />
      </View>

      {isOpen !== null && (
        <View style={[styles.statusBadge, { backgroundColor: isOpen ? '#1a3a2a' : '#3a1a1a' }]}>
          <Text style={[styles.statusText, { color: isOpen ? '#52b788' : '#ff6b6b' }]}>
            {isOpen ? 'Open today' : 'Closed today'}
          </Text>
        </View>
      )}

      {/* Period tabs — tap to filter, tap again to show all */}
      {!loading && !error && (
        <View style={styles.tabs}>
          {PERIOD_ORDER.filter((p) => grouped[p]).map((p) => (
            <TouchableOpacity
              key={p}
              style={[styles.tab, p === selectedPeriod && styles.tabActive]}
              onPress={() => setSelectedPeriod(prev => prev === p ? null : p)}
              accessibilityRole="button"
            >
              <Text style={[styles.tabText, p === selectedPeriod && styles.tabTextActive]}>
                {p}{p === currentPeriod && !selectedPeriod ? ' ·' : ''}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {loading ? (
        <ActivityIndicator color="#a0c4ff" style={{ marginTop: 40 }} />
      ) : error ? (
        <Text style={styles.error}>{error}</Text>
      ) : items.length === 0 ? (
        <Text style={styles.empty}>No menu items for today.</Text>
      ) : (
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.scroll}
          onContentSizeChange={scrollToActivePeriod}
        >
          {Object.entries(visibleGrouped).map(([period, periodItems]) => (
            <View
              key={period}
              onLayout={(e) => { sectionOffsets.current[period] = e.nativeEvent.layout.y; }}
            >
              <View style={[styles.periodRow, period === currentPeriod && styles.periodRowActive]}>
                <Text style={[styles.periodHeader, period === currentPeriod && styles.periodHeaderActive]}>
                  {period}
                </Text>
                {period === currentPeriod && (
                  <Text style={styles.nowBadge}>now</Text>
                )}
              </View>
              {periodItems.map((item) => (
                <View key={item.item_id} style={styles.row}>
                  <Text style={styles.itemName}>{item.name}</Text>
                  {item.diet_tags.length > 0 && (
                    <View style={styles.tagRow}>
                      {item.diet_tags.map((tag) => (
                        <View key={tag} style={[styles.tag, { backgroundColor: TAG_COLORS[tag] ?? '#333' }]}>
                          <Text style={styles.tagText}>{tag}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              ))}
            </View>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f1a' },
  topBar: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12,
  },
  title: { color: '#fff', fontSize: 15, fontWeight: '700', flex: 1, textAlign: 'center' },
  back: { color: '#a0c4ff', fontSize: 14, width: 48 },
  statusBadge: {
    marginHorizontal: 16, marginBottom: 4,
    borderRadius: 8, paddingVertical: 6, paddingHorizontal: 12,
  },
  statusText: { fontSize: 13, fontWeight: '600' },
  tabs: {
    flexDirection: 'row', paddingHorizontal: 16, gap: 8,
    marginBottom: 8, marginTop: 4,
  },
  tab: {
    borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6,
    borderWidth: 1, borderColor: '#333',
  },
  tabActive: { backgroundColor: '#a0c4ff', borderColor: '#a0c4ff' },
  tabText: { color: '#666', fontSize: 12 },
  tabTextActive: { color: '#0f0f1a', fontWeight: '700' },
  scroll: { paddingHorizontal: 16, paddingBottom: 48 },
  periodRow: { flexDirection: 'row', alignItems: 'center', marginTop: 20, marginBottom: 8 },
  periodRowActive: {},
  periodHeader: {
    color: '#555', fontSize: 11, fontWeight: '700', textTransform: 'uppercase',
  },
  periodHeaderActive: { color: '#a0c4ff' },
  nowBadge: {
    marginLeft: 8, backgroundColor: '#a0c4ff', color: '#0f0f1a',
    fontSize: 9, fontWeight: '700', borderRadius: 6,
    paddingHorizontal: 6, paddingVertical: 2, textTransform: 'uppercase', overflow: 'hidden',
  },
  row: {
    backgroundColor: '#1a1a2e', borderRadius: 10,
    padding: 12, marginBottom: 8,
  },
  itemName: { color: '#fff', fontSize: 14, marginBottom: 4 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  tag: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  tagText: { color: '#0f0f1a', fontSize: 10, fontWeight: '600' },
  error: { color: '#ff6b6b', textAlign: 'center', marginTop: 40 },
  empty: { color: '#555', textAlign: 'center', marginTop: 40 },
});
