import { Ionicons } from '@expo/vector-icons';
import { router, usePathname } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fmtDuration, workoutDurationMs } from '@/lib/calc';
import { useTick } from '@/lib/hooks';
import { useStore } from '@/lib/store';
import { C, R, themed } from '@/lib/theme';
import { Txt } from './ui';

/**
 * Collapsed "workout in progress" bar shown above the tab bar. Not on Home, where the
 * Resume card at the top already is the way back.
 */
export function ActiveWorkoutBar() {
  const active = useStore((s) => s.active);
  const onHome = usePathname() === '/';
  const now = useTick(1000, !!active && !onHome);
  if (!active || onHome) return null;
  return <Bar name={active.name} elapsed={fmtDuration(workoutDurationMs(active, now))} paused={!!active.pausedAt} />;
}

function Bar({ name, elapsed, paused }: { name: string; elapsed: string; paused: boolean }) {
  // Sits outside the tab navigator, so estimate the bar height: 49pt + home indicator.
  const tabH = 49 + useSafeAreaInsets().bottom;
  return (
    <View pointerEvents="box-none" style={[StyleSheet.absoluteFill, { justifyContent: 'flex-end' }]}>
      <Pressable
        testID="active-workout-bar"
        accessibilityRole="button"
        accessibilityLabel="Resume workout"
        onPress={() => router.push('/workout')}
        style={[styles.bar, { marginBottom: tabH + 8 }]}
      >
        <View style={styles.dot} />
        <View style={{ flex: 1 }}>
          <Txt size={14} weight="600" numberOfLines={1}>
            {name}
          </Txt>
          <Txt size={12} dim style={{ fontVariant: ['tabular-nums'] }}>
            {paused ? 'Paused · ' : ''}
            {elapsed}
          </Txt>
        </View>
        <View style={styles.cta}>
          <Ionicons name="play" size={14} color={C.onAccent} />
          <Txt size={14} weight="600" color={C.onAccent}>
            Resume
          </Txt>
        </View>
      </Pressable>
    </View>
  );
}

const styles = themed(() => StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: 12,
    paddingVertical: 10,
    paddingLeft: 16,
    paddingRight: 10,
    backgroundColor: C.surface2,
    borderRadius: R.lg,
    borderWidth: 1,
    borderColor: C.accentDim,
  },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.accent },
  cta: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 12, borderRadius: R.md, backgroundColor: C.accent },
}));
