import React from 'react';
import { ScrollView, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { TimelineBlock, GapCategory } from '../types';

interface Props {
  blocks: TimelineBlock[];
  onGapPress: (block: TimelineBlock) => void;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

const GAP_COLORS: Record<GapCategory, string> = {
  sprint:   '#242432',
  micro:    '#282c3d',
  standard: '#282c3d',
  deep:     '#33304a',
};

const GAP_BORDER: Record<GapCategory, string> = {
  sprint:   '#323246',
  micro:    '#323246',
  standard: '#323246',
  deep:     '#323246',
};

export function DayTimeline({ blocks, onGapPress }: Props) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scroll}>
      {blocks.map((block, i) => {
        const isClass = block.type === 'class';
        if (isClass) {
          return (
            <View key={i} style={[styles.block, styles.classBlock]}>
              <Text style={styles.classTime}>{formatTime(block.startTime)}</Text>
              <Text style={styles.classLabel}>{block.label}</Text>
            </View>
          );
        }

        const cat = block.gap_category ?? 'standard';
        const bgColor = GAP_COLORS[cat];
        const borderColor = GAP_BORDER[cat];

        return (
          <TouchableOpacity
            key={i}
            style={[styles.block, { backgroundColor: bgColor, borderColor, borderWidth: 1 }]}
            onPress={() => onGapPress(block)}
            accessibilityRole="button"
            accessibilityLabel={block.label}
          >
            <Text style={styles.gapTime}>{formatTime(block.startTime)}</Text>
            <Text style={styles.gapLabel}>{block.label}</Text>
            <Text style={styles.gapDuration}>
              {Math.round((new Date(block.endTime).getTime() - new Date(block.startTime).getTime()) / 60000)} min
            </Text>

            {/* Time-to-action badge */}
            {block.actionTimeMinutes != null && (
              <Text style={styles.actionBadge}>~{block.actionTimeMinutes} min to eat</Text>
            )}

            {block.nutrientMatchLabel && (
              <Text style={styles.matchLabel}>{block.nutrientMatchLabel}</Text>
            )}
            {block.venueHint && (
              <Text style={styles.venueHint}>{block.venueHint}</Text>
            )}

            {/* Deep break indicator */}
            {cat === 'deep' && (
              <Text style={styles.deepBadge}>📚 Study spot</Text>
            )}
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll:      { paddingHorizontal: 16, paddingVertical: 12 },
  block:       { width: 148, borderRadius: 12, padding: 12, marginRight: 10 },
  classBlock:  { backgroundColor: '#33304a', borderWidth: 1, borderColor: '#323246' },
  classTime:   { color: '#c7c7e2', fontSize: 11 },
  classLabel:  { color: '#c7c7e2', fontSize: 13, marginTop: 4 },
  gapTime:     { color: '#a0afc0', fontSize: 11 },
  gapLabel:    { color: '#e2e2e9', fontSize: 15, fontWeight: '700', marginTop: 4 },
  gapDuration: { color: '#a0afc0', fontSize: 11, marginTop: 2 },
  actionBadge: { color: '#9381ff', fontSize: 10, marginTop: 5, opacity: 0.85 },
  matchLabel:  { color: '#9381ff', fontSize: 11, marginTop: 4 },
  venueHint:   { color: '#a0afc0', fontSize: 11, marginTop: 2 },
  deepBadge:   { color: '#c7c7e2', fontSize: 10, marginTop: 5 },
});
