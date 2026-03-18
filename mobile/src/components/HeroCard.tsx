import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { HeroCardProps } from '../types';

export function HeroCard({
  minutesUntilWindow,
  windowType,
  recommendation,
  dashboardState,
  onGetDirections,
  onSeeMenu,
}: HeroCardProps) {
  if (dashboardState === 'in_class') {
    return (
      <View style={styles.card}>
        <Text style={styles.stateLabel}>Focus Mode</Text>
        {recommendation && (
          <Text style={styles.subtitle}>
            After class: {recommendation.mealName} at {recommendation.venueName}
          </Text>
        )}
      </View>
    );
  }

  if (dashboardState === 'end_of_day') {
    return (
      <View style={styles.card}>
        <Text style={styles.stateLabel}>Dorm-Chef Mode</Text>
        {recommendation && (
          <Text style={styles.subtitle}>{recommendation.mealName}</Text>
        )}
      </View>
    );
  }

  // normal state
  return (
    <View style={styles.card}>
      <Text style={styles.countdown}>
        {minutesUntilWindow > 0
          ? `Next eating window in ${minutesUntilWindow} min`
          : 'Eating window open now'}
      </Text>
      {recommendation && (
        <>
          <Text style={styles.mealName}>{recommendation.mealName}</Text>
          <Text style={styles.venue}>
            {recommendation.venueName} · {recommendation.walkMinutes} min walk
          </Text>
          <View style={styles.actions}>
            <TouchableOpacity style={styles.btn} onPress={onGetDirections} accessibilityRole="button">
              <Text style={styles.btnText}>Get Directions</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.btn} onPress={onSeeMenu} accessibilityRole="button">
              <Text style={styles.btnText}>See Menu</Text>
            </TouchableOpacity>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#1a1a2e',
    borderRadius: 16,
    padding: 20,
    marginHorizontal: 16,
    marginTop: 12,
  },
  countdown: { color: '#a0c4ff', fontSize: 14, marginBottom: 8 },
  mealName: { color: '#fff', fontSize: 20, fontWeight: '600', marginBottom: 4 },
  venue: { color: '#8ecae6', fontSize: 14, marginBottom: 16 },
  stateLabel: { color: '#ffd166', fontSize: 18, fontWeight: '600', marginBottom: 8 },
  subtitle: { color: '#8ecae6', fontSize: 14 },
  actions: { flexDirection: 'row', gap: 12 },
  btn: { backgroundColor: '#4361ee', borderRadius: 8, paddingVertical: 10, paddingHorizontal: 16 },
  btnText: { color: '#fff', fontSize: 14, fontWeight: '500' },
});
