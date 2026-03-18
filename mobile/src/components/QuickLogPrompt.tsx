import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { QuickLogPromptProps } from '../types';

/**
 * Contextual auto-log prompt — shown automatically after a window passes.
 * Completely separate from the [+] manual log button.
 *
 * "Yes" silently logs nutrients in the background — no navigation, no form.
 * Shows a 5-second undo toast after logging.
 */
export function QuickLogPrompt({ show, mealName, onYes, onNo, onUndo }: QuickLogPromptProps) {
  const [showUndo, setShowUndo] = React.useState(false);
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: show ? 1 : 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [show, opacity]);

  const handleYes = () => {
    onYes();  // silent background log — no navigation
    setShowUndo(true);
    setTimeout(() => setShowUndo(false), 5000);
  };

  if (!show && !showUndo) return null;

  if (showUndo) {
    return (
      <View style={styles.undoToast}>
        <Text style={styles.undoText}>Logged!</Text>
        <TouchableOpacity onPress={() => { onUndo(); setShowUndo(false); }} accessibilityRole="button">
          <Text style={styles.undoBtn}>Undo</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <Animated.View style={[styles.prompt, { opacity }]}>
      <Text style={styles.question}>Did you grab that {mealName}?</Text>
      <View style={styles.actions}>
        <TouchableOpacity style={styles.yesBtn} onPress={handleYes} accessibilityRole="button">
          <Text style={styles.yesBtnText}>Yes</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.noBtn} onPress={onNo} accessibilityRole="button">
          <Text style={styles.noBtnText}>No</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  prompt: {
    position: 'absolute',
    bottom: 90,
    left: 16,
    right: 16,
    backgroundColor: '#1a1a2e',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  question: { color: '#fff', fontSize: 15, flex: 1 },
  actions: { flexDirection: 'row', gap: 8 },
  yesBtn: { backgroundColor: '#4361ee', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 16 },
  yesBtnText: { color: '#fff', fontWeight: '600' },
  noBtn: { backgroundColor: '#2d2d2d', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 16 },
  noBtnText: { color: '#aaa' },
  undoToast: {
    position: 'absolute',
    bottom: 90,
    left: 16,
    right: 16,
    backgroundColor: '#2d2d2d',
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  undoText: { color: '#fff', fontSize: 14 },
  undoBtn: { color: '#4361ee', fontSize: 14, fontWeight: '600' },
});
