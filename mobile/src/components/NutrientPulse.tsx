import React from 'react';
import { ScrollView, View, Text, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { NutrientPulseProps, TrackedNutrient } from '../types';

const RING_SIZE = 80;
const STROKE_WIDTH = 8;
const RADIUS = (RING_SIZE - STROKE_WIDTH) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

function NutrientRing({ nutrient }: { nutrient: TrackedNutrient }) {
  const progress = (nutrient.goalAmount > 0 && nutrient.currentAmount > 0)
    ? Math.min(nutrient.currentAmount / nutrient.goalAmount, 1)
    : 0;
  const strokeDashoffset = progress === 0 ? CIRCUMFERENCE : CIRCUMFERENCE * (1 - progress);

  return (
    <View style={styles.ringContainer}>
      <Svg width={RING_SIZE} height={RING_SIZE}>
        <Circle
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={RADIUS}
          stroke="#2d2d3f"
          strokeWidth={STROKE_WIDTH}
          fill="none"
        />
        <Circle
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={RADIUS}
          stroke="#9381ff"
          strokeWidth={STROKE_WIDTH}
          fill="none"
          strokeDasharray={`${CIRCUMFERENCE} ${CIRCUMFERENCE}`}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          rotation="-90"
          origin={`${RING_SIZE / 2}, ${RING_SIZE / 2}`}
        />
      </Svg>
      <View style={styles.ringLabel}>
        <Text style={styles.ringValue}>
          {Math.round(nutrient.currentAmount)}{nutrient.unit}
        </Text>
      </View>
      <Text style={styles.nutrientName}>{nutrient.nutrientName}</Text>
      <Text style={styles.goal}>/ {nutrient.goalAmount}{nutrient.unit}</Text>
      {nutrient.forwardLookingHint && (
        <Text style={styles.hint}>{nutrient.forwardLookingHint}</Text>
      )}
    </View>
  );
}

export function NutrientPulse({ trackedNutrients, showCalories }: NutrientPulseProps) {
  // Filter out calories if showCalories is false
  const visible = showCalories
    ? trackedNutrients
    : trackedNutrients.filter((n) => n.nutrientName.toLowerCase() !== 'calories');

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scroll}>
      {visible.map((nutrient, i) => (
        <NutrientRing key={i} nutrient={nutrient} />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 16, paddingVertical: 12 },
  ringContainer: { alignItems: 'center', marginRight: 20, width: RING_SIZE + 20 },
  ringLabel: {
    position: 'absolute',
    top: RING_SIZE / 2 - 10,
    alignItems: 'center',
    width: RING_SIZE,
  },
  ringValue: { color: '#fff', fontSize: 12, fontWeight: '600' },
  nutrientName: { color: '#b8b8d1', fontSize: 12, marginTop: 6, textAlign: 'center' },
  goal: { color: '#a0afc0', fontSize: 10 },
  hint: { color: '#9381ff', fontSize: 10, textAlign: 'center', marginTop: 4, maxWidth: 100 },
});
