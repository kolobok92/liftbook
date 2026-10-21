import type { ComponentRef } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { fmtNum } from '@/lib/calc';
import { C, themed } from '@/lib/theme';
import { Txt } from '../ui';
import { useKeypad } from './keypadStore';

/**
 * A set's weight/reps/seconds: a tap target, not a text input. Tapping opens the in-app keypad
 * (Keypad.tsx). Shows the value in white, or the hint in grey when empty. While edited, a fresh
 * number is shown selected (the first key replaces it) and a caret follows typed digits.
 */
export function SetField({
  fieldId,
  testID,
  label,
  value,
  hint,
  onPress,
  viewRef,
  style,
}: {
  fieldId: string;
  testID: string;
  label: string;
  value: number | null | undefined;
  hint: number | null | undefined;
  onPress: () => void;
  viewRef?: (v: ComponentRef<typeof View> | null) => void;
  style?: StyleProp<ViewStyle>;
}) {
  const active = useKeypad((s) => s.target?.id === fieldId);
  const typed = useKeypad((s) => (s.target?.id === fieldId ? s.text : null));
  const fresh = useKeypad((s) => s.target?.id === fieldId && s.fresh);
  const shown = typed ?? (value == null ? '' : fmtNum(value));
  const hintText = hint == null ? '' : fmtNum(hint);
  return (
    <Pressable
      ref={viewRef}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${shown || (hintText ? `${hintText} suggested` : 'empty')}`}
      onPress={onPress}
      style={[styles.field, style]}
    >
      {active && !shown ? <View style={styles.caret} /> : null}
      {shown ? (
        <Txt testID={`${testID}-value`} size={16} weight="600" style={active && fresh ? styles.selected : undefined}>
          {shown}
        </Txt>
      ) : (
        <Txt testID={`${testID}-hint`} size={16} weight="600" color={C.textFaint}>
          {hintText}
        </Txt>
      )}
      {active && shown && !fresh ? <View style={styles.caret} /> : null}
    </Pressable>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    field: { flex: 1, height: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
    selected: { backgroundColor: C.accent + '55', borderRadius: 3, paddingHorizontal: 2 },
    caret: { width: 2, height: 18, marginHorizontal: 1, backgroundColor: C.orange, borderRadius: 1 },
  }),
);
