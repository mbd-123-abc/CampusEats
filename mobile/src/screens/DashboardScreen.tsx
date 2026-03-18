import React, { useEffect, useState, useCallback } from 'react';
import { View, ScrollView, Text, TouchableOpacity, StyleSheet, SafeAreaView, Linking, Platform } from 'react-native';
import { useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router';

import { HeroCard } from '../components/HeroCard';
import { DayTimeline } from '../components/DayTimeline';
import { NutrientPulse } from '../components/NutrientPulse';
import { QuickLogPrompt } from '../components/QuickLogPrompt';
import { resolveDashboardState, minutesUntilWindow } from '../utils/dashboardState';
import { currentMealPeriod } from './VenueMenuScreen';
import { recommendVenue } from '../utils/recommendVenue';
import { defaultMealWindows, windowsToBlocks } from '../utils/mealWindows';
import { api } from '../api/client';
import { useAuthStore } from '../store/authStore';
import type { AuthState } from '../store/authStore';
import {
  EatingWindow,
  TimelineBlock,
  TrackedNutrient,
  MealRecommendation,
} from '../types';

const UW_VENUES: Record<string, { menuUrl: string; mapsQuery: string; dubGrubScheme?: string }> = {
  'Center Table':                   { menuUrl: 'https://hfs.uw.edu/eat/locations-and-hours/center-table/', mapsQuery: 'Center+Table+UW+Seattle', dubGrubScheme: 'dubgrub://' },
  'Local Point':                    { menuUrl: 'https://hfs.uw.edu/eat/locations-and-hours/local-point/', mapsQuery: 'Local+Point+UW+Seattle', dubGrubScheme: 'dubgrub://' },
  'Husky Den Food Court':           { menuUrl: 'https://hfs.uw.edu/eat/locations-and-hours/husky-den/', mapsQuery: 'Husky+Den+Food+Court+UW+Seattle', dubGrubScheme: 'dubgrub://' },
  'Cultivate':                      { menuUrl: 'https://hfs.uw.edu/eat/locations-and-hours/cultivate/', mapsQuery: 'Cultivate+UW+Seattle' },
  'By George':                      { menuUrl: 'https://hfs.uw.edu/eat/locations-and-hours/by-george/', mapsQuery: 'By+George+UW+Seattle' },
  'Dawg Bites':                     { menuUrl: 'https://hfs.uw.edu/eat/locations-and-hours/dawg-bites/', mapsQuery: 'Dawg+Bites+IMA+UW+Seattle' },
  'Husky Den Café':                 { menuUrl: 'https://hfs.uw.edu/eat/locations-and-hours/husky-den-cafe/', mapsQuery: 'Husky+Den+Cafe+HUB+UW+Seattle' },
  'Husky Grind Café — Alder':       { menuUrl: 'https://hfs.uw.edu/eat/locations-and-hours/husky-grind-alder/', mapsQuery: 'Husky+Grind+Alder+UW+Seattle' },
  'Husky Grind Café — Oak':         { menuUrl: 'https://hfs.uw.edu/eat/locations-and-hours/husky-grind-oak/', mapsQuery: 'Husky+Grind+Oak+UW+Seattle' },
  'Husky Grind Café — Mercer Court':{ menuUrl: 'https://hfs.uw.edu/eat/locations-and-hours/husky-grind-mercer/', mapsQuery: 'Husky+Grind+Mercer+Court+UW+Seattle' },
  'Microsoft Café':                 { menuUrl: 'https://hfs.uw.edu/eat/locations-and-hours/microsoft-cafe/', mapsQuery: 'Microsoft+Cafe+Gates+Center+UW+Seattle' },
  "Orin's Place":                   { menuUrl: 'https://hfs.uw.edu/eat/locations-and-hours/orins-place/', mapsQuery: "Orin's+Place+Paccar+Hall+UW+Seattle" },
  'Public Grounds':                 { menuUrl: 'https://hfs.uw.edu/eat/locations-and-hours/public-grounds/', mapsQuery: 'Public+Grounds+Parrington+Hall+UW+Seattle' },
  'The Rotunda':                    { menuUrl: 'https://hfs.uw.edu/eat/locations-and-hours/the-rotunda/', mapsQuery: 'Rotunda+Health+Sciences+UW+Seattle' },
  'Tower Café':                     { menuUrl: 'https://hfs.uw.edu/eat/locations-and-hours/tower-cafe/', mapsQuery: 'Tower+Cafe+UW+Tower+Seattle' },
  'Starbucks — Population Health':  { menuUrl: 'https://hfs.uw.edu/eat/locations-and-hours/starbucks-population-health/', mapsQuery: 'Starbucks+Hans+Rosling+Center+UW+Seattle' },
  'Starbucks — Suzzallo':           { menuUrl: 'https://hfs.uw.edu/eat/locations-and-hours/starbucks-suzzallo/', mapsQuery: 'Starbucks+Suzzallo+Library+UW+Seattle' },
  'District Market — Alder':        { menuUrl: 'https://hfs.uw.edu/eat/locations-and-hours/district-market-alder/', mapsQuery: 'District+Market+Alder+Hall+UW+Seattle' },
  'District Market — Oak':          { menuUrl: 'https://hfs.uw.edu/eat/locations-and-hours/district-market-oak/', mapsQuery: 'District+Market+Oak+Hall+UW+Seattle' },
  'Etc. — The HUB':                 { menuUrl: 'https://hfs.uw.edu/eat/locations-and-hours/etc-hub/', mapsQuery: 'Etc+Market+HUB+UW+Seattle' },
};

const MOCK_WINDOWS: EatingWindow[] = defaultMealWindows();

const MOCK_BLOCKS: TimelineBlock[] = [
  {
    startTime: new Date(Date.now() - 60 * 60000).toISOString(),
    endTime: new Date(Date.now() - 10 * 60000).toISOString(),
    type: 'class',
    label: 'CHEM 142',
  },
  ...windowsToBlocks(MOCK_WINDOWS),
];

const NUTRIENT_GOALS: Record<string, { goalAmount: number; unit: string }> = {
  iron:        { goalAmount: 18,   unit: 'mg'  },
  protein:     { goalAmount: 60,   unit: 'g'   },
  vitamin_d:   { goalAmount: 20,   unit: 'mcg' },
  calcium:     { goalAmount: 1000, unit: 'mg'  },
  vitamin_b12: { goalAmount: 2.4,  unit: 'mcg' },
  fiber:       { goalAmount: 25,   unit: 'g'   },
};

const DEFAULT_RECOMMENDATION: MealRecommendation = {
  mealName: 'Drip Coffee + Croissant',
  nutrientMatchScores: {},
  overallScore: 0.78,
  venueName: 'Husky Grind Café — Mercer Court',
  walkMinutes: 5,
};

export default function DashboardScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ calendar?: string }>();
  const username = useAuthStore((s: AuthState) => s.username);
  const token = useAuthStore((s: AuthState) => s.token);
  const isAdmin = username === 'admin';
  const [now, setNow] = useState(new Date());
  const [recommendation, setRecommendation] = useState<MealRecommendation>(DEFAULT_RECOMMENDATION);
  const [trackedNutrients, setTrackedNutrients] = useState<TrackedNutrient[]>([
    { nutrientName: 'Iron', currentAmount: 0, goalAmount: 18, unit: 'mg' },
    { nutrientName: 'Protein', currentAmount: 0, goalAmount: 60, unit: 'g' },
  ]);
  const [quickLog, setQuickLog] = useState({ show: false, mealName: '' });
  const [calendarConnected, setCalendarConnected] = useState(false);

  // Detect return from Google OAuth callback
  useEffect(() => {
    if (params.calendar === 'connected') {
      setCalendarConnected(true);
    }
  }, [params.calendar]);

  // Tick every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(interval);
  }, []);

  // Load profile + recommendation — re-runs every time screen comes into focus
  // so nutrient changes in Profile are reflected immediately on return
  const loadProfile = useCallback(() => {
    const nextWindow = MOCK_WINDOWS.find((w) => new Date(w.end) > new Date());
    const gapMinutes = nextWindow?.duration_minutes ?? 60;

    // Fetch profile and today's nutrient totals in parallel
    Promise.all([
      api.get('/profile/preferences').catch(() => ({ data: {} })),
      api.get('/meals/today').catch(() => ({ data: { nutrients: {} } })),
    ]).then(([{ data: prefs }, { data: todayData }]) => {
      const focus: string[] = prefs.nutrient_focus ?? [];
      const todayTotals: Record<string, number> = todayData.nutrients ?? {};

      // Build rings with today's actual amounts
      const keys = focus.length > 0 ? focus : ['iron', 'protein'];
      const nutrients: TrackedNutrient[] = keys.map((k) => ({
        nutrientName: k.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
        // cap at goal so ring shows full, not over
        currentAmount: Math.min(
          todayTotals[k] ?? 0,
          NUTRIENT_GOALS[k]?.goalAmount ?? 100
        ),
        goalAmount: NUTRIENT_GOALS[k]?.goalAmount ?? 100,
        unit: NUTRIENT_GOALS[k]?.unit ?? 'g',
      }));
      setTrackedNutrients(nutrients);

      return recommendVenue({
        walkingSpeed: prefs.walking_speed ?? 'average',
        studyIntensity: prefs.academic_intensity ?? 'chill',
        gapMinutes,
        hardFilters: prefs.hard_filters ?? [],
        prefFilters: prefs.preference_filters ?? [],
      });
    }).then((result) => {
      if (result) {
        setRecommendation({ ...DEFAULT_RECOMMENDATION, venueName: result.venueName, walkMinutes: result.walkMinutes });
      }
    }).catch(() => {
      recommendVenue({ walkingSpeed: 'average', studyIntensity: 'chill', gapMinutes })
        .then((r) => setRecommendation({ ...DEFAULT_RECOMMENDATION, venueName: r.venueName, walkMinutes: r.walkMinutes }))
        .catch(() => {});
    });
  }, []);

  useFocusEffect(loadProfile);

  const dashboardState = resolveDashboardState(now, MOCK_BLOCKS, MOCK_WINDOWS);
  const nextWindow = MOCK_WINDOWS.find((w) => new Date(w.end) > now);
  const minsUntil = nextWindow ? minutesUntilWindow(now, nextWindow) : 0;

  const handleGetDirections = () => {
    const venue = UW_VENUES[recommendation.venueName];
    const query = venue?.mapsQuery ?? encodeURIComponent(recommendation.venueName + ' UW Seattle');
    const googleUrl = `https://www.google.com/maps/search/?api=1&query=${query}`;
    const appleUrl = `maps://?q=${query}`;
    if (Platform.OS === 'ios') {
      Linking.canOpenURL(appleUrl)
        .then((ok) => Linking.openURL(ok ? appleUrl : googleUrl))
        .catch(() => Linking.openURL(googleUrl));
    } else {
      Linking.openURL(googleUrl);
    }
  };

  const handleSeeMenu = () => {
    const period = currentMealPeriod(new Date());
    router.push(`/menu/${encodeURIComponent(recommendation.venueName)}?period=${encodeURIComponent(period)}` as any);
  };

  const handleCalendarConnect = () => {
    if (!token) return;
    const backendUrl = (api.defaults.baseURL ?? 'http://localhost:8000').replace(/\/$/, '');
    Linking.openURL(`${backendUrl}/calendar/connect-init?token=${encodeURIComponent(token)}`);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.push('/profile')} accessibilityRole="button">
          <Text style={styles.profileBtn}>Profile</Text>
        </TouchableOpacity>
        <Text style={styles.appTitle}>Campus Eats</Text>
        <TouchableOpacity onPress={() => router.push(isAdmin ? '/admin/menu' : '/log')} accessibilityRole="button">
          <Text style={styles.addBtn}>{isAdmin ? '+ Menu' : '[+]'}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView>
        {/* Hero Card — venue recommendation */}
        <HeroCard
          minutesUntilWindow={minsUntil}
          windowType={nextWindow?.window_type ?? 'golden'}
          recommendation={recommendation}
          dashboardState={dashboardState}
          onGetDirections={handleGetDirections}
          onSeeMenu={handleSeeMenu}
        />

        {/* Today timeline */}
        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>Today</Text>
        </View>
        <DayTimeline blocks={MOCK_BLOCKS} onGapPress={() => {}} />

        {/* Calendar hero card */}
        <TouchableOpacity
          style={styles.calendarCard}
          onPress={handleCalendarConnect}
          accessibilityRole="button"
          accessibilityLabel="Connect Google Calendar"
        >
          <View style={styles.calendarIconWrap}>
            <Text style={styles.calendarPlus}>+</Text>
          </View>
          <View style={styles.calendarText}>
            <Text style={styles.calendarTitle}>
              {calendarConnected ? 'Calendar Connected' : 'Connect Google Calendar'}
            </Text>
            <Text style={styles.calendarSub}>
              {calendarConnected ? 'Tap to re-sync your schedule' : 'Auto-detect meal gaps between classes'}
            </Text>
          </View>
        </TouchableOpacity>

        {/* Nutrient Pulse */}
        <Text style={[styles.sectionTitle, { marginLeft: 16, marginTop: 20 }]}>Nutrient Pulse</Text>
        <NutrientPulse trackedNutrients={trackedNutrients} showCalories={false} />
      </ScrollView>

      <QuickLogPrompt
        show={quickLog.show}
        mealName={quickLog.mealName}
        onYes={() => console.log('Auto-logging meal')}
        onNo={() => setQuickLog({ show: false, mealName: '' })}
        onUndo={() => console.log('Undoing auto-log')}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f1a' },
  topBar: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12,
  },
  appTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },
  profileBtn: { color: '#a0c4ff', fontSize: 14 },
  addBtn: { color: '#a0c4ff', fontSize: 18, fontWeight: '700' },
  sectionRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginLeft: 16, marginRight: 16, marginTop: 20,
  },
  sectionTitle: { color: '#666', fontSize: 12, textTransform: 'uppercase' },
  calendarCard: {
    flexDirection: 'row', alignItems: 'center', gap: 16,
    backgroundColor: '#1a0808', borderWidth: 1, borderColor: '#c0392b',
    borderRadius: 16, padding: 20, marginHorizontal: 16, marginTop: 12,
  },
  calendarIconWrap: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: '#c0392b', alignItems: 'center', justifyContent: 'center',
  },
  calendarPlus: { color: '#fff', fontSize: 28, fontWeight: '300', lineHeight: 32 },
  calendarText: { flex: 1 },
  calendarTitle: { color: '#e74c3c', fontSize: 16, fontWeight: '600', marginBottom: 3 },
  calendarSub: { color: '#7a3030', fontSize: 13 },
});
