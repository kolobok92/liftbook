import { router } from 'expo-router';
import { View } from 'react-native';
import { bestSet, fmtDate, fmtDurationShort, fmtSet, fmtVolume, workoutDurationMs, workoutVolume } from '@/lib/calc';
import { exerciseName, useExercises } from '@/lib/hooks';
import type { Unit, Workout } from '@/lib/types';
import { C } from '@/lib/theme';
import { Card, Txt } from './ui';

/** History list card: title, date, stats and a best-set line per exercise. */
export function WorkoutCard({ w, unit, prCount }: { w: Workout; unit: Unit; prCount?: number }) {
  const { byId } = useExercises();
  return (
    <Card testID={`history-card-${w.id}`} onPress={() => router.push(`/history/${w.id}`)}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
        <View style={{ flex: 1 }}>
          <Txt size={16} weight="700">
            {w.name}
          </Txt>
          <Txt dim size={12}>
            {fmtDate(w.startedAt, { weekday: 'long', month: 'short', day: 'numeric' })} ·{' '}
            {new Date(w.startedAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
          </Txt>
        </View>
        {prCount ? (
          <Txt size={12} weight="800" color={C.orange}>
            🏆 {prCount} PR{prCount > 1 ? 's' : ''}
          </Txt>
        ) : null}
      </View>
      <View style={{ flexDirection: 'row', gap: 16 }}>
        <Txt dim size={13}>
          ⏱ {fmtDurationShort(workoutDurationMs(w))}
        </Txt>
        <Txt dim size={13}>
          ⚖ {fmtVolume(workoutVolume(w))} {unit}
        </Txt>
      </View>
      <View style={{ gap: 3 }}>
        <View style={{ flexDirection: 'row' }}>
          <Txt faint size={12} style={{ flex: 1 }}>
            Exercise
          </Txt>
          <Txt faint size={12}>
            Best set
          </Txt>
        </View>
        {w.exercises.slice(0, 8).map((e) => {
          const best = bestSet(e.sets);
          return (
            <View key={e.id} style={{ flexDirection: 'row', gap: 8 }}>
              <Txt size={13} style={{ flex: 1 }} numberOfLines={1}>
                {e.sets.length} × {exerciseName(byId, e.exerciseId)}
              </Txt>
              <Txt size={13} dim>
                {best ? fmtSet(best, unit) : ''}
              </Txt>
            </View>
          );
        })}
        {w.exercises.length > 8 && (
          <Txt faint size={12}>
            +{w.exercises.length - 8} more
          </Txt>
        )}
      </View>
    </Card>
  );
}
