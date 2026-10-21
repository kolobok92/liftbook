import { useCallback, useRef, useState } from 'react';
import { View } from 'react-native';
import Swipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import { NoteModal } from './NoteModal';
import { exerciseName, useExercises } from '@/lib/hooks';
import { SwipeDeleteAction } from './SwipeDelete';
import { supersetLabels, uid } from '@/lib/calc';
import { useExercisePicker } from '@/lib/picker';
import { emptySet } from '@/lib/tracking';
import type { Workout, WorkoutExercise } from '@/lib/types';
import { C, R, themed } from '@/lib/theme';
import { Button, MenuItem, Sheet, confirm } from '../ui';
import { ExerciseCard } from './ExerciseCard';
import { CardRegistryContext, useCardRegistryValue } from './focusChain';
import { ReorderSheet } from './ReorderSheet';

function newWorkoutExercise(exerciseId: string): WorkoutExercise {
  return { id: uid(), exerciseId, notes: '', sets: [emptySet(), emptySet(), emptySet()] };
}

/** Exercise list + add/menus, shared by the live tracker and editing a logged workout. */
const swipeDelete = themed(
  () => ({ width: 84, backgroundColor: C.red, alignItems: 'center', justifyContent: 'center', gap: 2, borderRadius: R.lg, marginLeft: 8 }) as const,
);

export function WorkoutEditor({ workout, update, mode }: { workout: Workout; update: (fn: (w: Workout) => Workout) => void; mode: 'live' | 'edit' }) {
  const [menuFor, setMenuFor] = useState<number | null>(null);
  /** Runs once the menu sheet has fully closed (e.g. focusing a note; see Sheet onClosed). */
  const afterMenu = useRef<(() => void) | null>(null);
  const [reorder, setReorder] = useState(false);
  const pickExercises = useExercisePicker();
  // Exercise row whose note popup is open (opened from the ••• menu or by tapping the note).
  const [noteFor, setNoteFor] = useState<string | null>(null);
  const registry = useCardRegistryValue(setNoteFor);
  const { byId } = useExercises();
  const noteEx = noteFor ? workout.exercises.find((e) => e.id === noteFor) : undefined;
  const labels = supersetLabels(workout.exercises);
  // The exercise holding the workout's next unchecked set (marked "up next" in its card).
  const upNextRow = mode === 'live' ? workout.exercises.find((e) => e.sets.some((s) => !s.done))?.id : undefined;

  const setExercises = useCallback((fn: (exs: WorkoutExercise[]) => WorkoutExercise[]) => update((w) => ({ ...w, exercises: fn(w.exercises) })), [update]);

  // Stable callbacks (they take the row id) so typing in one card doesn't re-render the others.
  const onCardChange = useCallback(
    (rowId: string, fn: (e: WorkoutExercise) => WorkoutExercise) => setExercises((exs) => exs.map((x) => (x.id === rowId ? fn(x) : x))),
    [setExercises],
  );

  const addExercises = () => {
    pickExercises({ multi: true }, (ids) => setExercises((exs) => [...exs, ...ids.map(newWorkoutExercise)]));
  };

  const swap = useCallback(
    (id: string) =>
      pickExercises({ multi: false }, ([newId]) =>
        setExercises((exs) =>
          exs.map((x) =>
            x.id === id ? { ...x, exerciseId: newId, sets: x.sets.map((s) => ({ ...s, weight: s.done ? s.weight : null, reps: s.done ? s.reps : null })) } : x,
          ),
        ),
      ),
    [pickExercises, setExercises],
  );

  /** Deleting logged sets loses data, so confirm then; an untouched exercise just goes. */
  const removeExercise = async (e: WorkoutExercise) => {
    const logged = e.sets.filter((s) => s.done).length;
    if (logged > 0) {
      const ok = await confirm('Delete exercise?', `${logged} logged set${logged > 1 ? 's' : ''} will be removed.`, 'Delete', true);
      if (!ok) return;
    }
    setExercises((exs) => exs.filter((x) => x.id !== e.id));
  };

  const i = menuFor;
  const current = i != null ? workout.exercises[i] : undefined;
  const nextEx = i != null ? workout.exercises[i + 1] : undefined;
  const inSuperset = !!current?.superset && workout.exercises.filter((e) => e.superset === current.superset).length > 1;

  return (
    <CardRegistryContext.Provider value={registry}>
      <View style={{ gap: 12 }}>
        {workout.exercises.map((e, idx) => (
          <Swipeable
            key={e.id}
            friction={2}
            rightThreshold={60}
            overshootRight={false}
            renderRightActions={(progress) => (
              <SwipeDeleteAction
                progress={progress}
                testID={`swipe-delete-exercise-${idx}`}
                label="Delete exercise"
                onPress={() => removeExercise(e)}
                style={swipeDelete}
                iconSize={20}
              />
            )}
          >
            <ExerciseCard
              key={e.id}
              exercise={e}
              index={idx}
              unit={workout.unit}
              workoutId={workout.id}
              startedAt={workout.startedAt}
              programRef={workout.programRef}
              mode={mode}
              supersetLabel={labels[idx]}
              onChange={onCardChange}
              onMenu={setMenuFor}
              onSwap={swap}
              upNext={e.id === upNextRow}
            />
          </Swipeable>
        ))}
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Button testID="add-exercise" style={{ flex: 1 }} title="Add Exercise" icon="add" variant="secondary" onPress={addExercises} />
          {workout.exercises.length > 1 && (
            <Button testID="open-reorder" title="Reorder" icon="reorder-three-outline" variant="secondary" onPress={() => setReorder(true)} />
          )}
        </View>

        <ReorderSheet visible={reorder} exercises={workout.exercises} onChange={(next) => setExercises(() => next)} onClose={() => setReorder(false)} />

        <Sheet
          visible={current != null}
          onClose={() => setMenuFor(null)}
          onClosed={() => {
            afterMenu.current?.();
            afterMenu.current = null;
          }}
          title="Exercise Options"
        >
          {/* Only while an exercise is selected: during the close animation the items are still
        tappable, and a second tap used to act on an exercise that was no longer selected. */}
          {current && (
            <>
              <MenuItem
                testID="menu-swap"
                icon="swap-horizontal"
                label="Swap exercise"
                onPress={() => {
                  const id = current!.id;
                  setMenuFor(null);
                  swap(id);
                }}
              />
              {inSuperset ? (
                <MenuItem
                  icon="git-merge-outline"
                  label="Remove from superset"
                  onPress={() => {
                    const id = current!.id;
                    setExercises((exs) => exs.map((x) => (x.id === id ? { ...x, superset: undefined } : x)));
                    setMenuFor(null);
                  }}
                />
              ) : nextEx ? (
                <MenuItem
                  testID="menu-superset"
                  icon="git-merge-outline"
                  label="Superset with next exercise"
                  onPress={() => {
                    const group = nextEx.superset ?? current!.superset ?? uid();
                    const ids = new Set([current!.id, nextEx.id]);
                    setExercises((exs) => exs.map((x) => (ids.has(x.id) ? { ...x, superset: group } : x)));
                    setMenuFor(null);
                  }}
                />
              ) : null}
              <MenuItem
                testID="menu-note"
                icon="create-outline"
                label={current?.notes ? 'Edit note' : 'Add note'}
                onPress={() => {
                  const id = current!.id;
                  afterMenu.current = () => registry.openNote(id);
                  setMenuFor(null);
                }}
              />
              <MenuItem
                testID="menu-reorder"
                icon="reorder-three-outline"
                label="Reorder exercises"
                onPress={() => {
                  setMenuFor(null);
                  setReorder(true);
                }}
              />
              <MenuItem
                testID="menu-remove"
                icon="trash-outline"
                label="Remove exercise"
                danger
                onPress={() => {
                  const ex = current!;
                  setMenuFor(null);
                  removeExercise(ex);
                }}
              />
            </>
          )}
        </Sheet>
      </View>
      {noteEx && (
        <NoteModal
          key={noteEx.id}
          title={exerciseName(byId, noteEx.exerciseId)}
          initial={noteEx.notes}
          onSave={(notes) => onCardChange(noteEx.id, (e) => ({ ...e, notes }))}
          onClose={() => setNoteFor(null)}
        />
      )}
    </CardRegistryContext.Provider>
  );
}
