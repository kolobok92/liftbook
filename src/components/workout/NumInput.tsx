import { useEffect, useImperativeHandle, useRef, useState, type ComponentRef, type Ref } from 'react';
import { Platform, StyleSheet, TextInput, type StyleProp, type TextStyle } from 'react-native';
import { fmtNum, parseNum } from '@/lib/calc';
import { C, R, themed } from '@/lib/theme';

/**
 * Numeric input that keeps the user's in-progress text ("102.") locally and reports
 * parsed numbers. The placeholder shows the suggested value in grey.
 */
export function NumInput({
  value,
  onChange,
  placeholder,
  done,
  testID,
  label,
  style,
  integer,
  onFocus,
  inputRef,
}: {
  value: number | null | undefined;
  onChange: (n: number | null) => void;
  placeholder?: number | null;
  done?: boolean;
  testID?: string;
  label: string;
  style?: StyleProp<TextStyle>;
  integer?: boolean;
  /** Called on focus, e.g. to prefill the set from its suggestion. */
  onFocus?: () => void;
  inputRef?: Ref<ComponentRef<typeof TextInput>>;
}) {
  const [text, setText] = useState(value == null ? '' : fmtNum(value));
  const lastSent = useRef<number | null | undefined>(value);
  const focused = useRef(false);
  const field = useRef<ComponentRef<typeof TextInput> | null>(null);
  // Re-run on `done`: the key below swaps in a new native field, which the lint can't see.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useImperativeHandle(inputRef, () => field.current!, [done]);
  // While focused, the number shows as the grey hint in an empty field (Boostcamp-style), so
  // typing always starts fresh; leaving without typing puts it back. Rewriting the text instead
  // (select-all, or replacing it on the first keystroke) raced the keyboard on Android: the tap
  // or the rewrite moved the caret and digits landed inside the number (135 → 113535, 140 → 401).
  const [over, setOver] = useState<string | null>(null);
  // Checking/unchecking swaps in a new native field (key below) without a blur: treat it as one,
  // or the checked set kept showing its number as a faint hint.
  const [wasDone, setWasDone] = useState(done);
  if (done !== wasDone) {
    setWasDone(done);
    setOver(null);
    setText(value == null ? '' : fmtNum(value));
  }
  useEffect(() => {
    focused.current = false;
  }, [done]);

  // Sync when the value changes from outside (copy previous, prefill, set completion).
  useEffect(() => {
    if (value !== lastSent.current) {
      const next = value == null ? '' : fmtNum(value);
      lastSent.current = value;
      if (focused.current) setOver(next || null); // a prefill on focus: hint, not text
      else setText(next);
    }
  }, [value]);

  return (
    <TextInput
      // Fresh native field when a set is checked/unchecked: Android keeps the scroll offset from
      // editing, which clipped the numbers of the set you just checked.
      key={done ? 'done' : 'open'}
      ref={field}
      onFocus={() => {
        focused.current = true;
        if (text) {
          setOver(text);
          setText('');
        }
        onFocus?.();
      }}
      onBlur={() => {
        focused.current = false;
        if (over != null) setText(over);
        setOver(null);
      }}
      testID={testID}
      accessibilityLabel={label}
      value={text}
      onChangeText={(t) => {
        setOver(null);
        const clean = integer ? t.replace(/[^0-9]/g, '') : t.replace(/[^0-9.,]/g, '');
        setText(clean);
        const n = parseNum(clean);
        lastSent.current = n;
        onChange(n);
      }}
      placeholder={over ?? (placeholder == null ? '' : fmtNum(placeholder))}
      placeholderTextColor={C.textFaint}
      keyboardType={integer ? 'number-pad' : 'decimal-pad'}
      returnKeyType="done"
      style={[styles.input, done && styles.done, Platform.OS === 'web' && styles.noRing, style]}
    />
  );
}

const styles = themed(() => StyleSheet.create({
  input: {
    backgroundColor: C.surface3,
    color: C.text,
    borderRadius: R.sm,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '600',
    paddingVertical: 7,
    minWidth: 0,
    // Android: no extra font padding, centred vertically, so digits sit inside short pills.
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  done: { backgroundColor: 'transparent', color: C.text },
  // The pill's orange outline shows focus; drop the browser's own ring on web.
  noRing: { outlineStyle: 'none' } as unknown as TextStyle,
}));
