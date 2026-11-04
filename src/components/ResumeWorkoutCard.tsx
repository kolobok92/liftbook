import { router } from 'expo-router';
import { View } from 'react-native';
import { fmtDuration, workoutDurationMs } from '@/lib/calc';
import { exerciseName, useExercises, useTick } from '@/lib/hooks';
import { useStore } from '@/lib/store';
import { currentRow } from '@/lib/tracking';
import { C, R } from '@/lib/theme';
import { Button, Card, Txt } from './ui';

/**
 * The workout in progress, at the top of Home: while one is running, getting back to it is
 * the only thing this screen should ask of you, so it gets the one filled button.
 */
export function ResumeWorkoutCard() {
  const active = useStore((s) => s.active);
  const now = useTick(1000, !!active);
  const { byId } = useExercises();
  if (!active) return null;

  const sets = active.exercises.flatMap((e) => e.sets);
  const done = sets.filter((s) => s.done).length;
  const row = currentRow(active);
  const i = row ? row.sets.findIndex((s) => !s.done) : -1;
  const onNow = row && i >= 0 ? `${exerciseName(byId, row.exerciseId)} · Set ${i + 1} of ${row.sets.length}` : 'All sets done';

  return (
    <Card testID="resume-workout-card" style={{ borderWidth: 1, borderColor: C.accentDim, gap: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: active.pausedAt ? C.textFaint : C.accent }} />
        <Txt size={13} dim style={{ flex: 1 }}>
          {active.pausedAt ? 'Paused' : 'In progress'}
        </Txt>
        <Txt testID="resume-elapsed" size={13} dim style={{ fontVariant: ['tabular-nums'] }}>
          {fmtDuration(workoutDurationMs(active, now))}
        </Txt>
      </View>
      <View style={{ gap: 4 }}>
        <Txt size={22} weight="600" numberOfLines={1}>
          {active.name}
        </Txt>
        <Txt dim size={14} numberOfLines={1}>
          {onNow}
        </Txt>
      </View>
      <View style={{ gap: 6 }}>
        <View style={{ height: 4, backgroundColor: C.surface3, borderRadius: R.sm, overflow: 'hidden' }}>
          <View style={{ width: `${sets.length ? (done / sets.length) * 100 : 0}%`, height: '100%', backgroundColor: C.accent }} />
        </View>
        <Txt faint size={12} style={{ fontVariant: ['tabular-nums'] }}>
          {done} of {sets.length} sets
        </Txt>
      </View>
      <Button testID="resume-workout" title="Resume workout" icon="play" onPress={() => router.push('/workout')} />
    </Card>
  );
}
