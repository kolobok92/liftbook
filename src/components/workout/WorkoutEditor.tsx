import { useCallback, useRef, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Swipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import { NoteModal } from './NoteModal';
import { exerciseName, useExercises } from '@/lib/hooks';
import { SwipeDeleteAction } from './SwipeDelete';
import { supersetLabels, uid } from '@/lib/calc';
import { supersetWith } from '@/lib/workoutOps';
import { useExercisePicker } from '@/lib/picker';
import { useStore } from '@/lib/store';
import { carriedNote, currentRow, emptySet } from '@/lib/tracking';
import type { Workout, WorkoutExercise } from '@/lib/types';
import { C, R, themed } from '@/lib/theme';
import { Button, MenuItem, Sheet, Txt, confirm } from '../ui';
import { useKeypad } from './keypadStore';
import { ExerciseCard } from './ExerciseCard';
import { CardRegistryContext, useCardRegistryValue } from './focusChain';
import { ReorderSheet } from './ReorderSheet';

/** An added exercise, with its note from last time (e.g. machine settings). */
function newWorkoutExercise(exerciseId: string): WorkoutExercise {
  return { id: uid(), exerciseId, notes: carriedNote(useStore.getState().history, exerciseId), sets: [emptySet(), emptySet(), emptySet()] };
}

/** Runs of the list to draw together: a superset's consecutive members, else one exercise. */
function groupRuns(exs: WorkoutExercise[]): { e: WorkoutExercise; idx: number }[][] {
  const runs: { e: WorkoutExercise; idx: number }[][] = [];
  exs.forEach((e, idx) => {
    const last = runs[runs.length - 1];
    const prev = last?.[last.length - 1].e;
    if (prev && e.superset && prev.superset === e.superset) last.push({ e, idx });
    else runs.push([{ e, idx }]);
  });
  return runs;
}

type Run = { e: WorkoutExercise; idx: number }[];
const TAB_TINTS = ['accent', 'blue', 'green', 'red'] as const;

/**
 * A superset: one card, a tab per exercise (letter, name, sets done), the chosen exercise's
 * sets below. The tab follows the set you're due (A1 → B1 → A2, see currentRow); tapping a tab
 * holds it until your next check.
 */
function SupersetCard({
  run,
  label,
  upNextRow,
  names,
  renderCard,
}: {
  run: Run;
  label: string;
  upNextRow: string | undefined;
  names: string[];
  renderCard: (e: WorkoutExercise, idx: number, embedded?: boolean) => ReactNode;
}) {
  const doneTotal = run.reduce((n, { e }) => n + e.sets.filter((s) => s.done).length, 0);
  const [picked, setPicked] = useState<{ rowId: string; at: number } | null>(null);
  const editingRow = useKeypad((k) => k.target?.id.split(':')[0]);
  const auto = run.find(({ e }) => e.id === upNextRow) ?? run.find(({ e }) => e.sets.some((s) => !s.done)) ?? run[0];
  const shown = (picked && picked.at === doneTotal && run.find(({ e }) => e.id === picked.rowId)) || auto;
  const active = run.some(({ e }) => e.id === upNextRow || e.id === editingRow);
  return (
    <View testID={`superset-box-${run[0].idx}`} style={[supersetStyles.box, active && supersetStyles.boxActive]}>
      <Txt size={11} weight="800" color={C.accentText} style={{ letterSpacing: 0.6, paddingHorizontal: 6 }}>
        {label}
      </Txt>
      <View style={supersetStyles.tabs} accessibilityRole="tablist">
        {run.map(({ e, idx }, k) => {
          const on = e.id === shown.e.id;
          const tint = C[TAB_TINTS[k % TAB_TINTS.length]];
          const done = e.sets.filter((s) => s.done).length;
          return (
            <Pressable
              key={e.id}
              testID={`superset-tab-${idx}`}
              accessibilityRole="tab"
              aria-selected={on}
              accessibilityLabel={`${names[k]}, ${done} of ${e.sets.length} sets`}
              onPress={() => setPicked({ rowId: e.id, at: doneTotal })}
              style={[supersetStyles.tab, on && supersetStyles.tabOn, on && active && { borderColor: C.orange }]}
            >
              <View style={[supersetStyles.letter, { backgroundColor: tint + '33' }]}>
                <Txt size={12} weight="800" color={tint}>
                  {String.fromCharCode(65 + k)}
                </Txt>
              </View>
              <Txt size={13} weight="700" numberOfLines={1} color={on ? C.text : C.textDim} style={{ flex: 1 }}>
                {names[k]}
              </Txt>
              <Txt size={12} color={on ? C.textDim : C.textFaint}>
                {done}/{e.sets.length}
              </Txt>
            </Pressable>
          );
        })}
      </View>
      {renderCard(shown.e, shown.idx, true)}
    </View>
  );
}

const supersetStyles = themed(() =>
  StyleSheet.create({
    box: { backgroundColor: C.surface, borderRadius: R.lg, borderWidth: 1.5, borderColor: 'transparent', paddingVertical: 12, paddingHorizontal: 12, gap: 10 },
    boxActive: { borderColor: C.orange },
    tabs: { flexDirection: 'row', gap: 6, padding: 4, borderRadius: R.md, backgroundColor: C.bg },
    tab: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
      paddingVertical: 8,
      paddingHorizontal: 8,
      borderRadius: 8,
      borderWidth: 1.5,
      borderColor: 'transparent',
    },
    tabOn: { backgroundColor: C.surface3 },
    letter: { width: 22, height: 22, borderRadius: 5, alignItems: 'center', justifyContent: 'center' },
  }),
);

/** Exercise list + add/menus, shared by the live tracker and editing a logged workout. */
const swipeDelete = themed(
  () => ({ width: 84, backgroundColor: C.red, alignItems: 'center', justifyContent: 'center', gap: 2, borderRadius: R.lg, marginLeft: 8 }) as const,
);

export function WorkoutEditor({ workout, update, mode }: { workout: Workout; update: (fn: (w: Workout) => Workout) => void; mode: 'live' | 'edit' }) {
  const [menuFor, setMenuFor] = useState<number | null>(null);
  /** Runs once the menu sheet has fully closed (e.g. focusing a note; see Sheet onClosed). */
  const afterMenu = useRef<(() => void) | null>(null);
  const [reorder, setReorder] = useState(false);
  // Row picking its superset partner (the "Superset with…" list).
  const [pairFor, setPairFor] = useState<string | null>(null);
  const pickExercises = useExercisePicker();
  // Exercise row whose note popup is open (opened from the ••• menu or by tapping the note).
  const [noteFor, setNoteFor] = useState<string | null>(null);
  const registry = useCardRegistryValue(setNoteFor);
  const { byId } = useExercises();
  const noteEx = noteFor ? workout.exercises.find((e) => e.id === noteFor) : undefined;
  const labels = supersetLabels(workout.exercises);
  // The exercise holding the workout's next unchecked set (marked "up next" in its card).
  const upNextRow = mode === 'live' ? currentRow(workout)?.id : undefined;

  const setExercises = useCallback((fn: (exs: WorkoutExercise[]) => WorkoutExercise[]) => update((w) => ({ ...w, exercises: fn(w.exercises) })), [update]);
  // The exercise being worked on (checked a set / opened a field), for currentRow().
  const onWorkOn = useCallback(
    (rowId: string, by: 'check' | 'open') => update((w) => (w.currentRowId === rowId && w.currentBy === by ? w : { ...w, currentRowId: rowId, currentBy: by })),
    [update],
  );

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
            x.id === id
              ? {
                  ...x,
                  exerciseId: newId,
                  notes: carriedNote(useStore.getState().history, newId), // the new exercise's own note
                  sets: x.sets.map((s) => ({ ...s, weight: s.done ? s.weight : null, reps: s.done ? s.reps : null })),
                }
              : x,
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
  const inSuperset = !!current?.superset && workout.exercises.filter((e) => e.superset === current.superset).length > 1;

  // One exercise card (swipe to delete); `embedded` inside a superset card.
  const renderCard = (e: WorkoutExercise, idx: number, embedded?: boolean) => (
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
        embedded={embedded}
        onChange={onCardChange}
        onMenu={setMenuFor}
        onSwap={swap}
        upNext={e.id === upNextRow}
        onWorkOn={onWorkOn}
      />
    </Swipeable>
  );

  return (
    <CardRegistryContext.Provider value={registry}>
      <View style={{ gap: 12 }}>
        {/* A superset's consecutive exercises share one card, with a tab per exercise. */}
        {groupRuns(workout.exercises).map((run) =>
          run.length === 1 ? (
            renderCard(run[0].e, run[0].idx)
          ) : (
            <SupersetCard
              key={run[0].e.id}
              run={run}
              label={labels[run[0].idx] ?? 'SUPERSET'}
              upNextRow={upNextRow}
              // Tab labels drop the equipment ("(Cable)"); the full name heads the card below.
              names={run.map(({ e }) => exerciseName(byId, e.exerciseId).replace(/\s*\(.*\)$/, ''))}
              renderCard={renderCard}
            />
          ),
        )}
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Button testID="add-exercise" style={{ flex: 1 }} title="Add Exercise" icon="add" variant="secondary" onPress={addExercises} />
          {workout.exercises.length > 1 && (
            <Button testID="open-reorder" title="Reorder" icon="reorder-three-outline" variant="secondary" onPress={() => setReorder(true)} />
          )}
        </View>

        <Sheet visible={pairFor != null} onClose={() => setPairFor(null)} title="Superset with">
          {workout.exercises.map((e, idx) =>
            e.id === pairFor ? null : (
              <MenuItem
                key={e.id}
                testID={`superset-pick-${idx}`}
                icon="barbell-outline"
                label={exerciseName(byId, e.exerciseId)}
                onPress={() => {
                  const id = pairFor;
                  setPairFor(null);
                  if (id) setExercises((exs) => supersetWith(exs, id, e.id, uid()));
                }}
              />
            ),
          )}
        </Sheet>

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
              ) : workout.exercises.length > 1 ? (
                <MenuItem
                  testID="menu-superset"
                  icon="git-merge-outline"
                  label="Superset with…"
                  onPress={() => {
                    const id = current!.id;
                    afterMenu.current = () => setPairFor(id);
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
