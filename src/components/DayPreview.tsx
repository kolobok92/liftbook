import { View } from 'react-native';
import { fmtIntensity, fmtTarget } from '@/lib/calc';
import { exerciseName, useExercises } from '@/lib/hooks';
import type { ProgramDay } from '@/lib/types';
import { C } from '@/lib/theme';
import { Txt } from './ui';

/** Compact "exercise · sets × reps @ intensity" list for a program day. */
export function DayPreview({ day, max }: { day: ProgramDay; max?: number }) {
  const { byId } = useExercises();
  const list = max ? day.exercises.slice(0, max) : day.exercises;
  return (
    <View style={{ gap: 8 }}>
      {list.map((pe, i) => {
        const working = pe.sets.filter((s) => s.type !== 'warmup');
        const first = working[0] ?? pe.sets[0];
        return (
          <View key={pe.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            {pe.superset ? <View style={{ width: 3, alignSelf: 'stretch', backgroundColor: C.accent, borderRadius: 2 }} /> : null}
            <Txt faint size={13} style={{ width: 16 }}>
              {i + 1}
            </Txt>
            <Txt style={{ flex: 1 }} numberOfLines={1}>
              {exerciseName(byId, pe.exerciseId)}
            </Txt>
            {first && (
              <Txt dim size={13}>
                {working.length || pe.sets.length} × {fmtTarget(first.target)} {fmtIntensity(first.intensity)}
              </Txt>
            )}
          </View>
        );
      })}
      {max && day.exercises.length > max ? (
        <Txt faint size={13}>
          +{day.exercises.length - max} more
        </Txt>
      ) : null}
      {day.exercises.length === 0 && <Txt faint>No exercises yet.</Txt>}
    </View>
  );
}
