import React, { useEffect, useState, useCallback } from 'react';
import { View, ScrollView, Text, TouchableOpacity, StyleSheet, Linking, Platform, ActivityIndicator, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router';

import { HeroCard } from '../components/HeroCard';
import { DayTimeline } from '../components/DayTimeline';
import { NutrientPulse } from '../components/NutrientPulse';
import { QuickLogPrompt } from '../components/QuickLogPrompt';
import { resolveDashboardState, minutesUntilWindow } from '../utils/dashboardState';
import { currentMealPeriod } from './VenueMenuScreen';
import { recommendVenue, VenueRecommendation } from '../utils/recommendVenue';
import { api } from '../api/client';
import { useAuthStore } from '../store/authStore';
import { useCalendar } from '../hooks/useCalendar';
import type { AuthState } from '../store/authStore';
import type { TrackedNutrient, MealRecommendation } from '../types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const UW_VENUES: Record<string, { mapsQuery: string }> = {
  'Center Table':                    { mapsQuery: 'Center+Table+UW+Seattle' },
  'Local Point':                     { mapsQuery: 'Local+Point+UW+Seattle' },
  'Husky Den Food Court':            { mapsQuery: 'Husky+Den+Food+Court+UW+Seattle' },
  'Cultivate':                       { mapsQuery: 'Cultivate+UW+Seattle' },
  'By George':                       { mapsQuery: 'By+George+UW+Seattle' },
  'Dawg Bites':                      { mapsQuery: 'Dawg+Bites+IMA+UW+Seattle' },
  'Husky Den Café':                  { mapsQuery: 'Husky+Den+Cafe+HUB+UW+Seattle' },
  'Husky Grind Café — Alder':        { mapsQuery: 'Husky+Grind+Alder+UW+Seattle' },
  'Husky Grind Café — Oak':          { mapsQuery: 'Husky+Grind+Oak+UW+Seattle' },
  'Husky Grind Café — Mercer Court': { mapsQuery: 'Husky+Grind+Mercer+Court+UW+Seattle' },
  'Microsoft Café':                  { mapsQuery: 'Microsoft+Cafe+Gates+Center+UW+Seattle' },
  "Orin's Place":                    { mapsQuery: "Orin's+Place+Paccar+Hall+UW+Seattle" },
  'Public Grounds':                  { mapsQuery: 'Public+Grounds+Parrington+Hall+UW+Seattle' },
  'The Rotunda':                     { mapsQuery: 'Rotunda+Health+Sciences+UW+Seattle' },
  'Tower Café':                      { mapsQuery: 'Tower+Cafe+UW+Tower+Seattle' },
  'Starbucks — Population Health':   { mapsQuery: 'Starbucks+Hans+Rosling+Center+UW+Seattle' },
  'Starbucks — Suzzallo':            { mapsQuery: 'Starbucks+Suzzallo+Library+UW+Seattle' },
  'District Market — Alder':         { mapsQuery: 'District+Market+Alder+Hall+UW+Seattle' },
  'District Market — Oak':           { mapsQuery: 'District+Market+Oak+Hall+UW+Seattle' },
  'Etc. — The HUB':                  { mapsQuery: 'Etc+Market+HUB+UW+Seattle' },
};

const NUTRIENT_GOALS: Record<string, { goalAmount: number; unit: string }> = {
  iron:        { goalAmount: 18,   unit: 'mg'  },
  protein:     { goalAmount: 60,   unit: 'g'   },
  vitamin_d:   { goalAmount: 20,   unit: 'mcg' },
  calcium:     { goalAmount: 1000, unit: 'mg'  },
  vitamin_b12: { goalAmount: 2.4,  unit: 'mcg' },
  fiber:       { goalAmount: 25,   unit: 'g'   },
};

const DEFAULT_RECOMMENDATION: MealRecommendation = {
  mealName: '',
  nutrientMatchScores: {},
  overallScore: 0,
  venueName: 'Husky Grind Café — Mercer Court',
  walkMinutes: 5,
  actionTimeMinutes: 15,
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function DashboardScreen() {
  const router  = useRouter();
  const params  = useLocalSearchParams<{ calendar?: string; refetch?: string }>();
  const username = useAuthStore((s: AuthState) => s.username);
  const token    = useAuthStore((s: AuthState) => s.token);
  const isAdmin  = username === 'admin';

  const [now, setNow] = useState(new Date());
  const [recommendation, setRecommendation] = useState<MealRecommendation>(DEFAULT_RECOMMENDATION);
  const [detourInfo, setDetourInfo] = useState<VenueRecommendation['detourLabel']>('on-your-way');
  const [trackedNutrients, setTrackedNutrients] = useState<TrackedNutrient[]>([
    { nutrientName: 'Iron',    currentAmount: 0, goalAmount: 18, unit: 'mg' },
    { nutrientName: 'Protein', currentAmount: 0, goalAmount: 60, unit: 'g'  },
  ]);
  const [quickLog, setQuickLog] = useState({ show: false, mealName: '' });

  // Calendar — single source of truth
  const calendar = useCalendar();

  // When returning from OAuth, trigger a refresh
  useEffect(() => {
    if (params.calendar === 'connected') {
      calendar.refresh();
    }
  }, [params.calendar]); // eslint-disable-line react-hooks/exhaustive-deps

  // Clock tick every 30s
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(id);
  }, []);

  // Load profile + nutrients + venue recommendation
  const loadProfile = useCallback(() => {
    const nextWindow = calendar.eatingWindows.find(w => new Date(w.end) > new Date());
    const gapMinutes = nextWindow?.duration_minutes ?? 60;

    Promise.all([
      api.get('/profile/preferences').catch(() => ({ data: {} })),
      api.get('/meals/today').catch(() => ({ data: { nutrients: {} } })),
    ]).then(async ([{ data: prefs }, { data: todayData }]) => {
      // Nutrients
      const focus: string[] = prefs.nutrient_focus ?? [];
      const totals: Record<string, number> = todayData.nutrients ?? {};
      const keys = focus.length > 0 ? focus : ['iron', 'protein'];
      setTrackedNutrients(keys.map(k => ({
        nutrientName: k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
        currentAmount: totals[k] ?? 0,
        goalAmount: NUTRIENT_GOALS[k]?.goalAmount ?? 100,
        unit: NUTRIENT_GOALS[k]?.unit ?? 'g',
      })));

      // Venue recommendation
      const lastLoggedAt: string | null = todayData.last_logged_at ?? null;
      const minutesSinceLastMeal = lastLoggedAt
        ? Math.round((Date.now() - new Date(lastLoggedAt).getTime()) / 60000)
        : 999;

      const venueResult = await recommendVenue({
        walkingSpeed: prefs.walking_speed ?? 'average',
        studyIntensity: prefs.academic_intensity ?? 'chill',
        gapMinutes,
        gapCategory: nextWindow?.gap_category,
        minutesSinceLastMeal,
        nextEventTitle: calendar.nextEventTitle,
        hardFilters: prefs.hard_filters ?? [],
        prefFilters: prefs.preference_filters ?? [],
      });

      setDetourInfo(venueResult.detourLabel);

      // Fetch nutrient-aware meal recommendation for this venue
      let mealName = 'Something good';
      let matchScores: Record<string, number> = {};
      let overallScore = 0;
      try {
        const { data: rec } = await api.get('/meals/recommendation', {
          params: { venue: venueResult.venueName },
        });
        mealName = rec.meal_name ?? mealName;
        matchScores = rec.nutrient_match_scores ?? {};
        overallScore = rec.overall_score ?? 0;
      } catch {
        // No menu data yet — show venue without a specific meal
      }

      setRecommendation({
        mealName,
        venueName: venueResult.venueName,
        walkMinutes: venueResult.walkMinutes,
        actionTimeMinutes: venueResult.actionTimeMinutes,
        nutrientMatchScores: matchScores,
        overallScore,
      });
    }).catch(() => {
      recommendVenue({ walkingSpeed: 'average', studyIntensity: 'chill', gapMinutes: 60 })
        .then(r => {
          setRecommendation({ ...DEFAULT_RECOMMENDATION, venueName: r.venueName, walkMinutes: r.walkMinutes, actionTimeMinutes: r.actionTimeMinutes });
          setDetourInfo(r.detourLabel);
        }).catch(() => {});
    });
  }, [calendar.eatingWindows, calendar.nextEventTitle]);

  useFocusEffect(loadProfile);

  // Force nutrient refetch when returning from log screen
  useEffect(() => {
    if (params.refetch === '1') loadProfile();
  }, [params.refetch]); // eslint-disable-line react-hooks/exhaustive-deps

  // Derived
  const classBlocks = calendar.timelineBlocks.filter(b => b.type === 'class');
  const dashboardState = resolveDashboardState(now, classBlocks, calendar.eatingWindows);
  const nextWindow = calendar.eatingWindows.find(w => new Date(w.end) > now);
  const minsUntil  = nextWindow ? minutesUntilWindow(now, nextWindow) : 0;

  // Find the label for the next meal window from the timeline blocks
  const nextMealBlock = calendar.timelineBlocks.find(
    b => b.type === 'meal_gap' && nextWindow && b.startTime === nextWindow.start
  );
  const nextMealLabel = nextMealBlock?.label ?? 'Meal';
  const nextMealTime  = nextWindow?.start;

  const handleGetDirections = () => {
    const query = UW_VENUES[recommendation.venueName]?.mapsQuery ?? encodeURIComponent(recommendation.venueName + ' UW Seattle');
    const googleUrl = `https://www.google.com/maps/search/?api=1&query=${query}`;
    const appleUrl  = `maps://?q=${query}`;
    if (Platform.OS === 'ios') {
      Linking.canOpenURL(appleUrl).then(ok => Linking.openURL(ok ? appleUrl : googleUrl)).catch(() => Linking.openURL(googleUrl));
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
    const backendUrl = (api.defaults.baseURL ?? 'http://localhost:8000');
    calendar.connect(token, backendUrl);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.push('/profile')} accessibilityRole="button">
          <Text style={styles.profileBtn}>Profile</Text>
        </TouchableOpacity>
        <Text style={styles.appTitle}>Campus Eats</Text>
        <TouchableOpacity onPress={() => router.push(isAdmin ? '/admin/menu' : '/log')} accessibilityRole="button">
          <Text style={styles.addBtn}>{isAdmin ? '+ Menu' : 'Log Meal'}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView>
        <HeroCard
          minutesUntilWindow={minsUntil}
          windowType={nextWindow?.window_type ?? 'golden'}
          recommendation={recommendation}
          dashboardState={dashboardState}
          onGetDirections={handleGetDirections}
          onSeeMenu={handleSeeMenu}
          detourLabel={detourInfo}
          nextMealLabel={nextMealLabel}
          nextMealTime={nextMealTime}
        />

        {/* Today */}
        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>Today</Text>
        </View>

        {calendar.status === 'loading' ? (
          <ActivityIndicator color="#9381ff" style={{ marginTop: 24 }} />
        ) : calendar.status === 'connected' ? (
          calendar.timelineBlocks.length > 0 ? (
            <DayTimeline blocks={calendar.timelineBlocks} onGapPress={() => {}} />
          ) : (
            <View style={styles.emptyCalendar}>
              <Text style={styles.emptyCalendarText}>No events today</Text>
              <Text style={styles.emptyCalendarSub}>Add events to Google Calendar to see your schedule here</Text>
            </View>
          )
        ) : (
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
              <Text style={styles.calendarTitle}>Connect Google Calendar</Text>
              <Text style={styles.calendarSub}>Auto-detect meal gaps between classes</Text>
            </View>
          </TouchableOpacity>
        )}

        {/* Nutrient Pulse */}
        <Text style={[styles.sectionTitle, { marginLeft: 16, marginTop: 20 }]}>Nutrient Pulse</Text>
        <NutrientPulse trackedNutrients={trackedNutrients} showCalories={false} />
      </ScrollView>

      <QuickLogPrompt
        show={quickLog.show}
        mealName={quickLog.mealName}
        onYes={() => console.log('logged')}
        onNo={() => setQuickLog({ show: false, mealName: '' })}
        onUndo={() => console.log('undo')}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:  { flex: 1, backgroundColor: '#1a1a24' },
  topBar:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  appTitle:   { color: '#e2e2e9', fontSize: 18, fontWeight: '700' },
  profileBtn: { color: '#a0afc0', fontSize: 14, fontWeight: '600' },
  addBtn:     { color: '#4361ee', fontSize: 14, fontWeight: '600' },
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginLeft: 16, marginRight: 16, marginTop: 20 },
  sectionTitle: { color: '#a0afc0', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1 },
  calendarCard: {
    flexDirection: 'row', alignItems: 'center', gap: 16,
    backgroundColor: '#1a0808', borderWidth: 1, borderColor: '#c0392b',
    borderRadius: 16, padding: 20, marginHorizontal: 16, marginTop: 12,
  },
  calendarIconWrap: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#c0392b', alignItems: 'center', justifyContent: 'center' },
  calendarPlus:  { color: '#fff', fontSize: 28, fontWeight: '300', lineHeight: 32 },
  calendarText:  { flex: 1 },
  calendarTitle: { color: '#e74c3c', fontSize: 16, fontWeight: '600', marginBottom: 3 },
  calendarSub:   { color: '#7a3030', fontSize: 13 },
  emptyCalendar: { alignItems: 'center', paddingVertical: 32, paddingHorizontal: 24 },
  emptyCalendarText: { color: '#c7c7e2', fontSize: 15, fontWeight: '600', marginBottom: 6 },
  emptyCalendarSub:  { color: '#6b6b8a', fontSize: 13, textAlign: 'center' },
});
