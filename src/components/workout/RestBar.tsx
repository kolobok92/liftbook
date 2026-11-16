import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTick } from '@/lib/hooks';
import { useStore } from '@/lib/store';
import { C, R, themed } from '@/lib/theme';
import { MenuItem, Sheet, Txt, haptic } from '../ui';

export const fmtRest = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

const STEP = 15;

/**
 * The rest countdown, floating over the bottom of the workout (it overlays the list, so nothing
 * moves when it appears; the keypad covers it while you type). Buzzes and goes away at zero.
 */
export function RestBar() {
  const rest = useStore((s) => s.active?.rest);
  const now = useTick(250, !!rest);
  const bottom = useSafeAreaInsets().bottom + 8;
  // Capped at the full time: the ticking clock can be a beat behind when a rest starts.
  const left = rest ? Math.min(rest.seconds, Math.max(0, Math.ceil((rest.endsAt - now) / 1000))) : 0;
  const over = !!rest && left === 0;

  useEffect(() => {
    if (!over) return;
    haptic('success');
    useStore.getState().updateActive(({ rest: _done, ...w }) => w);
  }, [over]);

  if (!rest || over) return null;
  const shift = (by: number) =>
    useStore.getState().updateActive((w) => (w.rest ? { ...w, rest: { endsAt: w.rest.endsAt + by * 1000, seconds: Math.max(STEP, w.rest.seconds + by) } } : w));
  return (
    <View pointerEvents="box-none" style={[StyleSheet.absoluteFill, { justifyContent: 'flex-end' }]}>
      <View testID="rest-bar" style={[styles.bar, { marginBottom: bottom }]}>
        <View style={styles.row}>
          <Pressable testID="rest-minus" accessibilityRole="button" accessibilityLabel={`${STEP} seconds less rest`} onPress={() => shift(-STEP)} hitSlop={6} style={styles.step}>
            <Txt size={13} weight="500">
              −{STEP}
            </Txt>
          </Pressable>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Txt size={12} dim>
              Rest
            </Txt>
            <Txt testID="rest-remaining" size={22} weight="600" style={{ fontVariant: ['tabular-nums'] }}>
              {fmtRest(left)}
            </Txt>
          </View>
          <Pressable testID="rest-plus" accessibilityRole="button" accessibilityLabel={`${STEP} seconds more rest`} onPress={() => shift(STEP)} hitSlop={6} style={styles.step}>
            <Txt size={13} weight="500">
              +{STEP}
            </Txt>
          </Pressable>
          <Pressable testID="rest-skip" accessibilityRole="button" accessibilityLabel="Skip rest" onPress={() => useStore.getState().updateActive(({ rest: _skipped, ...w }) => w)} hitSlop={6} style={[styles.step, { backgroundColor: 'transparent' }]}>
            <Txt size={13} weight="600" color={C.accentText}>
              Skip
            </Txt>
          </Pressable>
        </View>
        <View style={styles.track}>
          <View style={{ width: `${Math.min(100, (left / rest.seconds) * 100)}%`, height: '100%', backgroundColor: C.accent }} />
        </View>
      </View>
    </View>
  );
}

const TIMES = [30, 45, 60, 90, 120, 150, 180, 240, 300];

/** Pick a rest time; for one exercise (`defaultSeconds` set) also "Use default" (null) and none (0). */
export function RestTimeSheet({
  visible,
  onClose,
  title,
  value,
  onPick,
  defaultSeconds,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  value: number | undefined;
  onPick: (seconds: number | null) => void;
  /** Set for an exercise's picker: offers going back to this default. */
  defaultSeconds?: number;
}) {
  const check = (on: boolean) => (on ? <Txt color={C.accentText}>✓</Txt> : undefined);
  return (
    <Sheet visible={visible} onClose={onClose} title={title}>
      {defaultSeconds != null && <MenuItem testID="rest-pick-default" label={`Use default (${fmtRest(defaultSeconds)})`} right={check(value == null)} onPress={() => onPick(null)} />}
      {defaultSeconds != null && <MenuItem testID="rest-pick-0" label="No rest timer" right={check(value === 0)} onPress={() => onPick(0)} />}
      {TIMES.map((s) => (
        <MenuItem key={s} testID={`rest-pick-${s}`} label={fmtRest(s)} right={check(value === s)} onPress={() => onPick(s)} />
      ))}
    </Sheet>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    bar: { marginHorizontal: 12, backgroundColor: C.surface2, borderRadius: R.lg, borderWidth: 1, borderColor: C.border, overflow: 'hidden' },
    row: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, paddingHorizontal: 12 },
    step: { minWidth: 44, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: R.md, backgroundColor: C.surface3 },
    track: { height: 3, backgroundColor: C.surface3 },
  }),
);
