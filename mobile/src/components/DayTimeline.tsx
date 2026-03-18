import React from 'react';
import { ScrollView, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { TimelineBlock } from '../types';

interface Props {
  blocks: TimelineBlock[];
  onGapPress: (block: TimelineBlock) => void;
}

function formatTime(iso: string): string {
  // Derive display string from ISO timestamp — never bare "HH:MM"
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function DayTimeline({ blocks, onGapPress }: Props) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scroll}>
      {blocks.map((block, i) => {
        const isClass = block.type === 'class';
        return isClass ? (
          // Class blocks: greyed out, non-tappable, no nutrientMatchLabel
          <View key={i} style={[styles.block, styles.classBlock]}>
            <Text style={styles.classTime}>{formatTime(block.startTime)}</Text>
            <Text style={styles.classLabel}>{block.label}</Text>
          </View>
        ) : (
          // Meal gap blocks: tappable, shows nutrientMatchLabel and venueHint
          <TouchableOpacity
            key={i}
            style={[styles.block, styles.gapBlock]}
            onPress={() => onGapPress(block)}
            accessibilityRole="button"
            accessibilityLabel={`${block.label} — ${block.nutrientMatchLabel}`}
          >
            <Text style={styles.gapTime}>{formatTime(block.startTime)}</Text>
            <Text style={styles.gapLabel}>{block.label}</Text>
            {block.nutrientMatchLabel && (
              <Text style={styles.matchLabel}>{block.nutrientMatchLabel}</Text>
            )}
            {block.venueHint && (
              <Text style={styles.venueHint}>{block.venueHint}</Text>
            )}
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 16, paddingVertical: 12 },
  block: { width: 140, borderRadius: 12, padding: 12, marginRight: 10 },
  classBlock: { backgroundColor: '#2d2d2d' },
  gapBlock: { backgroundColor: '#0d3b2e' },
  classTime: { color: '#666', fontSize: 11 },
  classLabel: { color: '#888', fontSize: 13, marginTop: 4 },
  gapTime: { color: '#52b788', fontSize: 11 },
  gapLabel: { color: '#d8f3dc', fontSize: 13, fontWeight: '600', marginTop: 4 },
  matchLabel: { color: '#95d5b2', fontSize: 11, marginTop: 4 },
  venueHint: { color: '#74c69d', fontSize: 11, marginTop: 2 },
});
