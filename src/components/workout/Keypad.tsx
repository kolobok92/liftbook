import { Ionicons } from '@expo/vector-icons';
import { useEffect, type ComponentRef, type RefObject } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C, R, themed } from '@/lib/theme';
import { RPE_LABELS, fmtNum } from '@/lib/calc';
import { Txt, haptic } from '../ui';
import { useKeypad, type KeypadKey } from './keypadStore';

const TOOLBAR = 44;
const KEY = 50;
const GAP = 6;
const PAD = 8;

/** Height of the open pad, so a screen can leave room at the end of its list. */
export function keypadHeight(insetBottom: number) {
  return TOOLBAR + 4 * KEY + 3 * GAP + 2 * PAD + insetBottom;
}

const ROWS: KeypadKey[][] = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['.', '0', 'del'],
];

const RPES = [6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10];
const KIND_LABEL = { weight: 'Weight', reps: 'Reps', seconds: 'Time' } as const;

const WEB_KEYS: Record<string, KeypadKey> = { '.': '.', ',': '.', Backspace: 'del', Delete: 'clear' };

/**
 * The number pad for set fields: a fixed panel over the bottom of the screen. It never resizes
 * the screen; it only scrolls the list when the field being edited would sit behind it.
 */
export function Keypad({ scrollRef, scrollY }: { scrollRef?: RefObject<ComponentRef<typeof ScrollView> | null>; scrollY?: RefObject<number> }) {
  const target = useKeypad((s) => s.target);
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const height = keypadHeight(insets.bottom);

  // Close when the screen goes away (a stale target would point at a gone set).
  useEffect(() => () => useKeypad.getState().close(), []);

  // Keep the field being edited above the pad: scroll only as far as needed, only if needed.
  useEffect(() => {
    const anchor = target?.anchor;
    if (!anchor || !scrollRef?.current || !scrollY) return;
    const frame = requestAnimationFrame(() =>
      anchor.measureInWindow((_x, y, _w, h) => {
        const limit = windowHeight - height - 12;
        if (y + h > limit) scrollRef.current?.scrollTo({ y: scrollY.current + (y + h - limit), animated: true });
      }),
    );
    return () => cancelAnimationFrame(frame);
  }, [target, scrollRef, scrollY, windowHeight, height]);

  // Web: a physical keyboard types into the pad too. Listening for the screen's whole life (not
  // from when the pad renders) so keys typed right after the tap aren't lost.
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const onKey = (e: KeyboardEvent) => {
      const { target: open, press, next, close } = useKeypad.getState();
      const field = e.target as HTMLElement | null;
      if (!open || field?.tagName === 'INPUT' || field?.tagName === 'TEXTAREA') return;
      const k = /^[0-9]$/.test(e.key) ? (e.key as KeypadKey) : WEB_KEYS[e.key];
      if (k) press(k);
      else if (e.key === 'Enter' || e.key === 'Tab') next();
      else if (e.key === 'Escape') close();
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const tab = useKeypad((s) => s.tab);
  if (!target) return null;
  const { press, next, close, setTab, pickRpe } = useKeypad.getState();
  const rpeTab = tab === 'rpe' && !!target.rpe;
  const tabBtn = (id: 'number' | 'rpe', label: string) => (
    <Pressable testID={`keypad-tab-${id}`} accessibilityRole="tab" aria-selected={tab === id} onPress={() => setTab(id)} hitSlop={6} style={styles.tab}>
      <Txt weight={tab === id ? '800' : '600'} color={tab === id ? C.text : C.textFaint}>
        {label}
      </Txt>
    </Pressable>
  );
  return (
    <View testID="keypad" style={[styles.panel, { height, paddingBottom: PAD + insets.bottom }]}>
      <View style={styles.toolbar}>
        <Pressable testID="keypad-hide" accessibilityLabel="Hide keypad" hitSlop={8} onPress={close} style={styles.tool}>
          <Ionicons name="chevron-down" size={22} color={C.textDim} />
        </Pressable>
        <View style={styles.tabs}>
          {tabBtn('number', KIND_LABEL[target.kind])}
          {target.rpe ? tabBtn('rpe', 'RPE') : null}
        </View>
        {rpeTab ? (
          <Pressable
            testID="keypad-clear"
            accessibilityRole="button"
            onPress={() => {
              haptic('tick');
              pickRpe(null);
            }}
            style={styles.tool}
          >
            <Txt weight="600">Clear</Txt>
          </Pressable>
        ) : null}
        <Pressable
          testID="keypad-next"
          accessibilityRole="button"
          onPress={() => {
            haptic('tick');
            next();
          }}
          style={[styles.tool, styles.nextBtn]}
        >
          <Txt weight="800" color={C.bg}>
            {target.next ? 'Next' : 'Done'}
          </Txt>
        </Pressable>
      </View>
      {rpeTab ? (
        [0, 1, 2].map((r) => (
          <View key={r} style={styles.row}>
            {RPES.slice(r * 3, r * 3 + 3).map((v) => {
              const on = target.rpe?.value === v;
              return (
                <Pressable
                  key={v}
                  testID={`keypad-rpe-${v}`}
                  accessibilityRole="button"
                  accessibilityLabel={`RPE ${v}`}
                  onPress={() => {
                    haptic('tick');
                    pickRpe(v);
                  }}
                  style={[styles.key, styles.rpeKey, on && { backgroundColor: C.accent }]}
                >
                  <Txt size={20} weight="700" color={on ? C.onAccent : C.text}>
                    {fmtNum(v)}
                  </Txt>
                  <Txt size={11} color={on ? C.onAccent : C.textDim}>
                    {RPE_LABELS[String(v)]}
                  </Txt>
                </Pressable>
              );
            })}
          </View>
        ))
      ) : (
        <>
          {ROWS.map((row) => (
            <View key={row.join('')} style={styles.row}>
              {row.map((k) => (
                <Pressable
                  key={k}
                  testID={`key-${k === '.' ? 'dot' : k}`}
                  accessibilityRole="button"
                  accessibilityLabel={k === 'del' ? 'Delete' : k === '.' ? 'Decimal point' : k}
                  disabled={k === '.' && target.integer}
                  onPress={() => {
                    haptic('tick');
                    press(k);
                  }}
                  style={({ pressed }) => [styles.key, pressed && styles.keyPressed, k === '.' && target.integer && { opacity: 0.3 }]}
                >
                  {k === 'del' ? (
                    <Ionicons name="backspace-outline" size={24} color={C.text} />
                  ) : (
                    <Txt size={24} weight="600">
                      {k}
                    </Txt>
                  )}
                </Pressable>
              ))}
            </View>
          ))}
        </>
      )}
    </View>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    panel: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: C.surface,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: C.border,
      paddingHorizontal: PAD,
      paddingTop: PAD,
      gap: GAP,
    },
    toolbar: { height: TOOLBAR - GAP, flexDirection: 'row', alignItems: 'center', gap: 8 },
    tool: { height: 34, paddingHorizontal: 12, borderRadius: R.sm, alignItems: 'center', justifyContent: 'center', backgroundColor: C.surface2 },
    nextBtn: { backgroundColor: C.text, minWidth: 72 },
    tabs: { flex: 1, flexDirection: 'row', justifyContent: 'center', gap: 18 },
    tab: { paddingVertical: 6 },
    rpeKey: { height: (4 * KEY + GAP) / 3, gap: 2 },
    row: { flexDirection: 'row', gap: GAP },
    key: { flex: 1, height: KEY, borderRadius: R.md, backgroundColor: C.surface2, alignItems: 'center', justifyContent: 'center' },
    keyPressed: { backgroundColor: C.surface3 },
  }),
);

/** Room at the end of a scrolling list while the pad is open, so the last rows can sit above it. */
export function KeypadSpacer() {
  const open = useKeypad((s) => !!s.target);
  const insets = useSafeAreaInsets();
  return open ? <View style={{ height: keypadHeight(insets.bottom) }} /> : null;
}
