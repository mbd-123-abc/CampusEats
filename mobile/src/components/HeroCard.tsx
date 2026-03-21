import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { HeroCardProps } from '../types';

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function HeroCard({
  minutesUntilWindow,
  windowType,
  recommendation,
  dashboardState,
  onGetDirections,
  onSeeMenu,
  detourLabel,
  nextMealLabel,
  nextMealTime,
}: HeroCardProps) {
  // Shared action buttons — shown whenever we have a recommendation
  const actionButtons = recommendation ? (
    <View style={styles.actions}>
      <TouchableOpacity style={styles.btn} onPress={onGetDirections} accessibilityRole="button">
        <Text style={styles.btnText}>Get Directions</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.btn} onPress={onSeeMenu} accessibilityRole="button">
        <Text style={styles.btnText}>See Menu</Text>
      </TouchableOpacity>
    </View>
  ) : null;

  if (dashboardState === 'in_class') {
    return (
      <View style={[styles.card, styles.preFuelCard]}>
        <Text style={styles.preFuelLabel}>Preview Meal</Text>
        {recommendation && (
          <>
            <Text style={styles.foodName}>{recommendation.mealName || '—'}</Text>
            <Text style={styles.preFuelVenue}>
              {recommendation.venueName} · {recommendation.walkMinutes} min walk
            </Text>
          </>
        )}
        {actionButtons}
      </View>
    );
  }

  if (dashboardState === 'end_of_day') {
    return (
      <View style={[styles.card, styles.preFuelCard]}>
        <Text style={styles.preFuelLabel}>Preview Meal</Text>
        {recommendation && (
          <>
            <Text style={styles.foodName}>{recommendation.mealName || '—'}</Text>
            <Text style={styles.preFuelVenue}>
              {recommendation.venueName} · {recommendation.walkMinutes} min walk
            </Text>
          </>
        )}
        {actionButtons}
      </View>
    );
  }

  // normal state
  const mealLabel = nextMealLabel ?? 'Meal';
  const timeStr = nextMealTime ? formatTime(nextMealTime) : null;
  const countdown = minutesUntilWindow > 0 ? `in ${minutesUntilWindow} min` : 'Now';

  return (
    <View style={[styles.card, styles.preFuelCard]}>
      <Text style={styles.preFuelLabel}>
        {mealLabel}{timeStr ? `  ·  ${timeStr}` : ''}  ·  {countdown}
      </Text>
      {recommendation?.mealName ? (
        <Text style={styles.foodName}>{recommendation.mealName}</Text>
      ) : (
        <Text style={styles.foodName}>—</Text>
      )}
      {recommendation && (
        <>
          <Text style={styles.preFuelVenue}>
            {recommendation.venueName} · {recommendation.walkMinutes} min walk
            {detourLabel === 'on-your-way' ? '  · On your way' : detourLabel === 'short-detour' ? '  · Short detour' : ''}
          </Text>
          {actionButtons}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#242432',
    borderRadius: 16,
    padding: 20,
    marginHorizontal: 16,
    marginTop: 12,
  },
  preFuelCard: {
    backgroundColor: '#242432',
    borderWidth: 1,
    borderColor: '#323246',
  },
  preFuelLabel:  { color: '#e9d5ff', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 6 },
  preFuelMeal:   { color: '#e2e2e9', fontSize: 20, fontWeight: '700', marginBottom: 4 },
  preFuelVenue:  { color: '#b8b8d1', fontSize: 14, marginBottom: 16 },
  foodName:      { color: '#fff', fontSize: 26, fontWeight: '700', marginBottom: 10, lineHeight: 32 },
  mealLabel:     { color: '#e2e2e9', fontSize: 28, fontWeight: '700', marginBottom: 2 },
  mealTime:      { color: '#e9d5ff', fontSize: 16, marginBottom: 4 },
  countdown:     { color: '#e9d5ff', fontSize: 13, marginBottom: 12 },
  venue:         { color: '#b8b8d1', fontSize: 14, marginBottom: 16 },
  actions:       { flexDirection: 'row', gap: 12 },
  btn:           { backgroundColor: '#4361ee', borderRadius: 8, paddingVertical: 10, paddingHorizontal: 16 },
  btnText:       { color: '#fff', fontSize: 14, fontWeight: '700' },
});
