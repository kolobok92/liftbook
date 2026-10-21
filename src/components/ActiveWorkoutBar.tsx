import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fmtDuration, workoutDurationMs } from '@/lib/calc';
import { useTick } from '@/lib/hooks';
import { useStore } from '@/lib/store';
import { C, R, themed } from '@/lib/theme';
import { Txt } from './ui';

/** Collapsed "workout in progress" bar shown above the tab bar. */
export function ActiveWorkoutBar() {
  const active = useStore((s) => s.active);
  const now = useTick(1000, !!active);
  if (!active) return null;
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
          <Txt size={14} weight="700" numberOfLines={1}>
            {name}
          </Txt>
          <Txt size={12} dim>
            {paused ? 'Paused · ' : ''}
            {elapsed}
          </Txt>
        </View>
        <Txt size={14} weight="700" color={C.accentText}>
          Resume
        </Txt>
        <Ionicons name="chevron-up" size={18} color={C.accentText} />
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
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: C.surface2,
    borderRadius: R.lg,
    borderWidth: 1,
    borderColor: C.accentDim,
  },
  dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: C.accent },
}));
