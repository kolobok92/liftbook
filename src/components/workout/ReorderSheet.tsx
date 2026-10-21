import { Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { exerciseName, useExercises } from '@/lib/hooks';
import { move } from '@/lib/programOps';
import type { WorkoutExercise } from '@/lib/types';
import { C, R } from '@/lib/theme';
import { Button, Sheet, Txt } from '../ui';

/** Reorder the exercises in a workout. Changes apply immediately. */
export function ReorderSheet({
  visible,
  exercises,
  onChange,
  onClose,
}: {
  visible: boolean;
  exercises: WorkoutExercise[];
  onChange: (next: WorkoutExercise[]) => void;
  onClose: () => void;
}) {
  const { byId } = useExercises();
  return (
    <Sheet visible={visible} onClose={onClose} title="Reorder Exercises" footer={<Button title="Done" onPress={onClose} />}>
      {exercises.map((e, i) => {
        const done = e.sets.length > 0 && e.sets.every((s) => s.done);
        return (
          <View
            key={e.id}
            testID={`reorder-row-${i}`}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.surface2, borderRadius: R.md, paddingVertical: 10, paddingHorizontal: 12 }}
          >
            <Txt dim weight="700" style={{ width: 20 }}>
              {i + 1}
            </Txt>
            <View style={{ flex: 1 }}>
              <Txt weight="600" numberOfLines={1}>
                {exerciseName(byId, e.exerciseId)}
              </Txt>
              <Txt dim size={12}>
                {e.sets.filter((s) => s.done).length}/{e.sets.length} sets{done ? ' · done' : ''}
              </Txt>
            </View>
            <Pressable
              testID={`reorder-top-${i}`}
              accessibilityLabel="Move to top"
              disabled={i === 0}
              hitSlop={6}
              onPress={() => onChange(move(exercises, i, 0))}
              style={{ padding: 6, opacity: i === 0 ? 0.3 : 1 }}
            >
              <Ionicons name="arrow-up-circle-outline" size={22} color={C.text} />
            </Pressable>
            <Pressable
              testID={`reorder-up-${i}`}
              accessibilityLabel="Move up"
              disabled={i === 0}
              hitSlop={6}
              onPress={() => onChange(move(exercises, i, i - 1))}
              style={{ padding: 6, opacity: i === 0 ? 0.3 : 1 }}
            >
              <Ionicons name="chevron-up" size={22} color={C.text} />
            </Pressable>
            <Pressable
              testID={`reorder-down-${i}`}
              accessibilityLabel="Move down"
              disabled={i === exercises.length - 1}
              hitSlop={6}
              onPress={() => onChange(move(exercises, i, i + 1))}
              style={{ padding: 6, opacity: i === exercises.length - 1 ? 0.3 : 1 }}
            >
              <Ionicons name="chevron-down" size={22} color={C.text} />
            </Pressable>
          </View>
        );
      })}
    </Sheet>
  );
}
