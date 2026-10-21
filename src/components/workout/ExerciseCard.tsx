import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { memo, useCallback, useContext, useEffect, useMemo, useRef, useState, type ComponentRef } from 'react';
import { LayoutAnimation, Pressable, StyleSheet, View } from 'react-native';
import Swipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import { SwipeDeleteAction } from './SwipeDelete';
import { setLabels, fmtNum, fmtSet, targetLabel } from '@/lib/calc';
import { exerciseName, useExercises, useOneRepMax } from '@/lib/hooks';
import { useStore } from '@/lib/store';
import { completeSet, emptySet, findPrevious, hintFor, previousSetFor, suggestFor, type Suggestion } from '@/lib/tracking';
import type { LoggedSet, SetType, Unit, WorkoutExercise } from '@/lib/types';
import { C, R, SET_TYPE_COLOR, themed } from '@/lib/theme';
import { IconLine } from '../NoteField';
import { MenuItem, Sheet, Txt, haptic } from '../ui';
import { CardRegistryContext } from './focusChain';
import { useKeypad } from './keypadStore';
import { RpeSheet } from './RpeSheet';
import { SetField } from './SetField';

type Field = 'weight' | 'reps' | 'seconds';

/** Smooth the card folding/unfolding (instead of everything below jumping). */
const animateLayout = () => LayoutAnimation.configureNext(LayoutAnimation.create(220, 'easeInEaseOut', 'opacity'));

export type ExerciseCardProps = {
  exercise: WorkoutExercise;
  index: number;
  unit: Unit;
  workoutId: string;
  startedAt: number;
  programRef?: { programId: string; week: number; day: number };
  /** live: the in-progress workout. edit: editing a logged workout. */
  mode: 'live' | 'edit';
  /** Shown inside a superset card (WorkoutEditor draws the frame and the exercise tabs). */
  embedded?: boolean;
  /** Stable callbacks from the editor (keyed by row id / index) so memo can skip unchanged cards. */
  onChange: (rowId: string, fn: (e: WorkoutExercise) => WorkoutExercise) => void;
  onMenu: (index: number) => void;
  onSwap: (rowId: string) => void;
  /** This card holds the workout's next unchecked set: mark it (Boostcamp: "your current set stays highlighted"). */
  upNext?: boolean;
  /** This exercise is being worked on (a set checked, a field opened). */
  onWorkOn?: (rowId: string, by: 'check' | 'open') => void;
};

function prevLabel(s: LoggedSet | undefined, unit: Unit, timed?: boolean): { top: string; sub: string } {
  if (!s) return { top: '—', sub: '' };
  return { top: fmtSet(s, unit, timed), sub: s.rpe != null ? `RPE ${fmtNum(s.rpe)}` : '' };
}

export const ExerciseCard = memo(function ExerciseCard(p: ExerciseCardProps) {
  const { exercise: we, unit } = p;
  const { byId } = useExercises();
  const ex = byId[we.exerciseId];
  const history = useStore((s) => s.history);
  const settings = useStore((s) => s.settings);
  const oneRm = useOneRepMax(we.exerciseId);
  const rounding = settings.plateRounding[unit];
  const [rpeFor, setRpeFor] = useState<number | null>(null);
  const [typeFor, setTypeFor] = useState<number | null>(null);
  const [showInstr, setShowInstr] = useState(false);
  const registry = useContext(CardRegistryContext);
  // The set whose field is on the keypad; it and its card get the orange outline.
  const editingSetId = useKeypad((k) => (k.target?.id.startsWith(`${we.id}:`) ? k.target.id.split(':')[1] : null));
  const fieldRefs = useRef(new Map<string, ComponentRef<typeof View> | null>());
  // Close the pad if the field it types into goes away under it: the set or the exercise is
  // deleted, or a swap changes reps to seconds. It would keep writing where you can't see.
  const timedNow = !!ex?.timed;
  useEffect(() => {
    const k = useKeypad.getState();
    const [row, setId, field] = k.target?.id.split(':') ?? [];
    if (row !== we.id) return;
    if (!we.sets.some((x) => x.id === setId) || (field !== 'weight' && (field === 'seconds') !== timedNow)) k.close();
  }, [we.id, we.sets, timedNow]);
  useEffect(
    () => () => {
      const k = useKeypad.getState();
      if (k.target?.id.startsWith(`${we.id}:`)) k.close(); // the exercise was removed
    },
    [we.id],
  );
  const setsRef = useRef(we.sets);
  useEffect(() => {
    setsRef.current = we.sets;
  });

  const prev = useMemo(
    () => findPrevious(history, we.exerciseId, { programRef: p.programRef, excludeWorkoutId: p.workoutId, before: p.startedAt }),
    [history, we.exerciseId, p.programRef, p.workoutId, p.startedAt],
  );
  // Grey hints: the set above's numbers (Boostcamp); the circle may also fall back to last time.
  const hints: Suggestion[] = useMemo(
    () => we.sets.map((_, i) => hintFor({ sets: we.sets, index: i, prev: prev?.sets, oneRepMax: oneRm, rounding })),
    [we.sets, prev, oneRm, rounding],
  );

  const timed = !!ex?.timed;
  const allDone = we.sets.length > 0 && we.sets.every((s) => s.done);
  // Finished exercises fold up automatically (live only); the chevron overrides either way.
  // Finishing an exercise again clears the override so it folds back up.
  const [collapsedOverride, setCollapsedOverride] = useState<boolean | null>(null);
  useEffect(() => {
    if (allDone) setCollapsedOverride(null);
  }, [allDone]);
  const collapsed = p.mode === 'live' && (collapsedOverride ?? allDone);

  const { onChange, onWorkOn } = p;
  const change = useCallback((fn: (e: WorkoutExercise) => WorkoutExercise) => onChange(we.id, fn), [onChange, we.id]);

  const updateSet = (i: number, patch: Partial<LoggedSet>) => change((e) => ({ ...e, sets: e.sets.map((s, j) => (j === i ? { ...s, ...patch } : s)) }));

  const toggleDone = (i: number) => {
    const s = we.sets[i];
    if (s.done) {
      updateSet(i, { done: false });
      return;
    }
    const committed = completeSet(s, suggestFor({ sets: we.sets, index: i, prev: prev?.sets, oneRepMax: oneRm, rounding }));
    // Nothing entered and nothing to hint from: don't log an empty set, and stay put.
    if (!(timed ? committed.seconds : committed.reps)) {
      haptic('warning');
      return;
    }
    // Nothing moves: no focus jump or keyboard (Boostcamp). The next set's hints already show
    // these numbers, so its circle is one tap away. Finishing the exercise folds it, smoothly.
    useKeypad.getState().close();
    p.onWorkOn?.(we.id, 'check');
    if (p.mode === 'live' && we.sets.every((x, j) => j === i || x.done)) animateLayout();
    change((e) => ({ ...e, sets: e.sets.map((x, j) => (j === i ? committed : x)) }));
    haptic('light');
  };

  const toggleAll = () => {
    useKeypad.getState().close();
    if (p.mode === 'live') animateLayout();
    if (allDone) {
      change((e) => ({ ...e, sets: e.sets.map((s) => ({ ...s, done: false })) }));
      return;
    }
    change((e) => {
      const sets = [...e.sets];
      for (let i = 0; i < sets.length; i++) {
        if (sets[i].done) continue;
        const c = completeSet(sets[i], suggestFor({ sets, index: i, prev: prev?.sets, oneRepMax: oneRm, rounding }));
        if (timed ? c.seconds : c.reps) sets[i] = c;
      }
      return { ...e, sets };
    });
    haptic('light');
  };

  /**
   * Put a field on the keypad. Typing replaces its number (it starts out selected); Next walks
   * weight → reps → the following unfinished set. Nothing is filled in by just tapping.
   */
  const openField = useCallback(
    (setId: string, field: Field) => {
      const sets = setsRef.current;
      const i = sets.findIndex((x) => x.id === setId);
      if (i < 0) return;
      const second: Field = timed ? 'seconds' : 'reps';
      const later = sets.findIndex((x, j) => j > i && !x.done);
      const following: [string, Field] | undefined = field === 'weight' ? [setId, second] : later >= 0 ? [sets[later].id, 'weight'] : undefined;
      const value = sets[i][field];
      // Fixing a number in a checked set (e.g. an earlier exercise) isn't moving on to it.
      if (!sets[i].done) onWorkOn?.(we.id, 'open');
      const unitName = ex?.bodyweight ? `+${unit}` : unit === 'lb' ? 'lbs' : 'kg';
      useKeypad.getState().open(
        {
          id: `${we.id}:${setId}:${field}`,
          integer: field !== 'weight',
          kind: field,
          rpe: {
            value: sets[i].rpe,
            onPick: (v) => change((e) => ({ ...e, sets: e.sets.map((x) => (x.id === setId ? { ...x, rpe: v } : x)) })),
          },
          label: `Set ${setLabels(sets)[i]} · ${field === 'weight' ? unitName : field}`,
          onChange: (n) => change((e) => ({ ...e, sets: e.sets.map((x) => (x.id === setId ? { ...x, [field]: n } : x)) })),
          next: following ? () => openField(following[0], following[1]) : undefined,
          anchor: fieldRefs.current.get(`${setId}:${field}`),
        },
        value == null ? '' : fmtNum(value),
      );
    },
    [timed, ex?.bodyweight, unit, we.id, change, onWorkOn],
  );

  const copyPrevious = (i: number) => {
    const ps = previousSetFor(we.sets, i, prev?.sets);
    if (!ps) return;
    // Close the pad: an open field would keep showing what was typed, not the copied numbers.
    useKeypad.getState().close();
    updateSet(i, { weight: ps.weight, reps: ps.reps, seconds: ps.seconds ?? null, rpe: ps.rpe });
  };

  const addSet = () =>
    change((e) => {
      const last = e.sets[e.sets.length - 1];
      const next: LoggedSet = { ...emptySet(last?.type === 'warmup' ? 'normal' : (last?.type ?? 'normal')), target: last?.target };
      return { ...e, sets: [...e.sets, next] };
    });

  const setType = (i: number, t: SetType) => {
    updateSet(i, { type: t });
    setTypeFor(null);
  };

  const name = exerciseName(byId, we.exerciseId);
  const labels = setLabels(we.sets);
  const editingIndex = editingSetId ? we.sets.findIndex((x) => x.id === editingSetId) : -1;
  const activeOpen = p.mode === 'live' && editingIndex >= 0 && !we.sets[editingIndex].done ? editingIndex : null;
  const upNextIndex = p.upNext ? we.sets.findIndex((x) => !x.done) : -1;

  const header = (
    <View style={styles.head}>
      <Pressable style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 }} onPress={() => router.push(`/exercise/${we.exerciseId}`)}>
        {p.mode === 'live' && allDone ? (
          <Ionicons testID={`done-mark-${p.index}`} name="checkmark" size={18} color={C.textDim} />
        ) : (
          <Txt size={17} weight="600">
            {p.index + 1}
          </Txt>
        )}
        <Txt size={17} weight="700" numberOfLines={1} style={{ flexShrink: 1 }}>
          {name}
        </Txt>
      </Pressable>
      {p.mode === 'live' && (
        <Pressable
          testID={`collapse-${p.index}`}
          accessibilityLabel={collapsed ? 'Expand exercise' : 'Collapse exercise'}
          hitSlop={10}
          onPress={() => {
            animateLayout();
            setCollapsedOverride(!collapsed);
          }}
          style={{ padding: 4 }}
        >
          <Ionicons name={collapsed ? 'chevron-down' : 'chevron-up'} size={20} color={C.textDim} />
        </Pressable>
      )}
    </View>
  );

  if (collapsed) {
    return (
      <Pressable
        testID={`exercise-card-${p.index}`}
        accessibilityLabel={`${name}, tap to expand`}
        onPress={() => {
          animateLayout();
          setCollapsedOverride(false);
        }}
        style={[styles.card, p.embedded && styles.embedded]}
      >
        {header}
      </Pressable>
    );
  }

  return (
    <View style={[styles.card, p.embedded ? styles.embedded : (activeOpen != null || p.upNext) && styles.cardActive]} testID={`exercise-card-${p.index}`}>
      {header}

      {we.instructions ? (
        <Pressable onPress={() => setShowInstr((v) => !v)} style={{ paddingHorizontal: 6 }}>
          <Txt dim size={13} numberOfLines={showInstr ? undefined : 2}>
            {we.instructions}
          </Txt>
        </Pressable>
      ) : null}

      {we.notes ? (
        // Tap to edit in the note popup (WorkoutEditor's NoteModal).
        <Pressable testID={`note-${p.index}`} onPress={() => registry?.openNote(we.id)} style={{ paddingHorizontal: 6 }}>
          <IconLine icon="create-outline" size={13} lineHeight={19} color={C.textDim} testID={`note-${p.index}`}>
            <Txt size={13} style={{ fontStyle: 'italic', lineHeight: 19 }}>
              {we.notes}
            </Txt>
          </IconLine>
        </Pressable>
      ) : null}

      <View style={styles.headerRow}>
        <Txt style={[styles.colSet, styles.hdr]}>Set</Txt>
        <Txt style={[styles.colPrev, styles.hdr]}>Previous</Txt>
        <Txt style={[styles.colTarget, styles.hdr]}>Target</Txt>
        <View style={[styles.colPill, { flexDirection: 'row' }]}>
          <Txt style={[styles.hdr, { flex: 1 }]}>{ex?.bodyweight ? `+${unit}` : unit === 'lb' ? 'Lbs' : 'Kg'}</Txt>
          <Txt style={[styles.hdr, { flex: 1 }]}>{timed ? 'Sec' : 'Reps'}</Txt>
        </View>
        <Pressable testID={`complete-all-${p.index}`} accessibilityLabel="Complete all sets" onPress={toggleAll} style={styles.colCheck}>
          <Ionicons name="checkmark-done" size={17} color={allDone ? C.accentText : C.textDim} />
        </Pressable>
      </View>

      {we.sets.map((s, i) => {
        const ps = previousSetFor(we.sets, i, prev?.sets);
        const pl = prevLabel(ps, unit, timed);
        const sug = hints[i];
        const { top: targetTop, sub: targetSub } = targetLabel(s.target, unit, oneRm, rounding);
        const active = activeOpen === i;
        return (
          <Swipeable
            key={s.id}
            friction={2}
            rightThreshold={40}
            overshootRight={false}
            renderRightActions={(progress) => (
              <SwipeDeleteAction
                progress={progress}
                testID={`swipe-delete-${p.index}-${i}`}
                label={`Delete set ${i + 1}`}
                onPress={() => change((e) => ({ ...e, sets: e.sets.filter((x) => x.id !== s.id) }))}
                style={styles.swipeDelete}
              />
            )}
          >
            <View style={styles.row} testID={`set-row-${p.index}-${i}`}>
              <Pressable testID={`set-type-${p.index}-${i}`} accessibilityLabel={`Set ${i + 1} options`} onPress={() => setTypeFor(i)} style={styles.colSet}>
                {s.type === 'normal' ? (
                  <Txt>{labels[i]}</Txt>
                ) : (
                  <View style={[styles.typeBadge, { backgroundColor: SET_TYPE_COLOR[s.type] + '33' }]}>
                    <Txt size={12} weight="800" color={SET_TYPE_COLOR[s.type]}>
                      {labels[i]}
                    </Txt>
                  </View>
                )}
              </Pressable>
              <Pressable
                testID={`prev-${p.index}-${i}`}
                accessibilityLabel={pl.top === '—' ? 'No previous' : `Copy previous ${pl.top}`}
                onPress={() => copyPrevious(i)}
                style={styles.colPrev}
              >
                <Txt size={14} style={{ textAlign: 'center' }} numberOfLines={1}>
                  {pl.top}
                </Txt>
                {pl.sub ? (
                  <Txt size={11} dim style={{ textAlign: 'center' }}>
                    {pl.sub}
                  </Txt>
                ) : null}
              </Pressable>
              <View style={styles.colTarget}>
                <Txt size={14} style={{ textAlign: 'center' }} numberOfLines={1}>
                  {targetTop}
                </Txt>
                {targetSub ? (
                  <Txt size={12} dim style={{ textAlign: 'center' }} numberOfLines={1}>
                    {targetSub}
                  </Txt>
                ) : null}
              </View>
              <View style={[styles.colPill, styles.pill, (active || upNextIndex === i) && styles.pillActive]}>
                <SetField
                  fieldId={`${we.id}:${s.id}:weight`}
                  testID={`weight-${p.index}-${i}`}
                  label={`Set ${i + 1} weight`}
                  value={s.weight}
                  hint={sug.weight}
                  onPress={() => openField(s.id, 'weight')}
                  viewRef={(v) => {
                    fieldRefs.current.set(`${s.id}:weight`, v);
                  }}
                />
                <View style={styles.pillDivider} />
                {timed ? (
                  <SetField
                    fieldId={`${we.id}:${s.id}:seconds`}
                    testID={`seconds-${p.index}-${i}`}
                    label={`Set ${i + 1} seconds`}
                    value={s.seconds}
                    hint={sug.seconds}
                    onPress={() => openField(s.id, 'seconds')}
                    viewRef={(v) => {
                      fieldRefs.current.set(`${s.id}:seconds`, v);
                    }}
                  />
                ) : (
                  <SetField
                    fieldId={`${we.id}:${s.id}:reps`}
                    testID={`reps-${p.index}-${i}`}
                    label={`Set ${i + 1} reps`}
                    value={s.reps}
                    hint={sug.reps}
                    onPress={() => openField(s.id, 'reps')}
                    viewRef={(v) => {
                      fieldRefs.current.set(`${s.id}:reps`, v);
                    }}
                  />
                )}
              </View>
              <Pressable
                testID={`check-${p.index}-${i}`}
                accessibilityRole="checkbox"
                aria-checked={s.done}
                accessibilityLabel={`Complete set ${i + 1}`}
                onPress={() => toggleDone(i)}
                style={styles.colCheck}
              >
                <View
                  testID={upNextIndex === i ? `up-next-${p.index}` : undefined}
                  style={[styles.check, (active || upNextIndex === i) && styles.checkActive, s.done && styles.checkOn]}
                >
                  {s.done && <Ionicons name="checkmark" size={18} color={C.onAccent} />}
                </View>
              </Pressable>
            </View>
          </Swipeable>
        );
      })}

      <View style={styles.footer}>
        <Pressable testID={`add-set-${p.index}`} onPress={addSet} style={styles.footBtn}>
          <Ionicons name="add-circle-outline" size={20} color={C.text} />
          <Txt weight="600">Add Set</Txt>
        </Pressable>
        <Pressable testID={`swap-${p.index}`} onPress={() => p.onSwap(we.id)} style={styles.footBtn}>
          <Ionicons name="swap-horizontal" size={20} color={C.text} />
          <Txt weight="600">Swap</Txt>
        </Pressable>
        <View style={{ flex: 1 }} />
        <Pressable
          testID={`exercise-menu-${p.index}`}
          accessibilityLabel="Exercise options"
          hitSlop={8}
          onPress={() => p.onMenu(p.index)}
          style={styles.footBtn}
        >
          <Ionicons name="ellipsis-horizontal" size={20} color={C.text} />
        </Pressable>
      </View>

      <RpeSheet
        visible={rpeFor != null}
        value={rpeFor != null ? (we.sets[rpeFor]?.rpe ?? null) : null}
        onClose={() => setRpeFor(null)}
        onPick={(v) => {
          if (rpeFor != null) updateSet(rpeFor, { rpe: v });
          setRpeFor(null);
        }}
      />
      <Sheet visible={typeFor != null} onClose={() => setTypeFor(null)} title={typeFor != null ? `Set ${typeFor + 1}` : ''}>
        <MenuItem
          testID="set-rpe"
          label={typeFor != null && we.sets[typeFor]?.rpe != null ? `RPE ${fmtNum(we.sets[typeFor].rpe!)}` : 'Add RPE'}
          icon="speedometer-outline"
          onPress={() => {
            const i = typeFor;
            setTypeFor(null);
            setRpeFor(i);
          }}
        />
        <MenuItem testID="settype-warmup" label="Warm-up (W)" icon="flame-outline" onPress={() => typeFor != null && setType(typeFor, 'warmup')} />
        <MenuItem testID="settype-normal" label="Working set" icon="barbell-outline" onPress={() => typeFor != null && setType(typeFor, 'normal')} />
        <MenuItem testID="settype-drop" label="Drop set (D)" icon="trending-down-outline" onPress={() => typeFor != null && setType(typeFor, 'drop')} />
        <MenuItem testID="settype-failure" label="Failure (F)" icon="skull-outline" onPress={() => typeFor != null && setType(typeFor, 'failure')} />
        <MenuItem
          testID="remove-set"
          label="Remove set"
          icon="trash-outline"
          danger
          onPress={() => {
            if (typeFor != null) change((e) => ({ ...e, sets: e.sets.filter((_, j) => j !== typeFor) }));
            setTypeFor(null);
          }}
        />
      </Sheet>
    </View>
  );
});

const styles = themed(() =>
  StyleSheet.create({
    card: { backgroundColor: C.surface, borderRadius: R.lg, paddingVertical: 14, paddingHorizontal: 12, gap: 8, borderWidth: 1.5, borderColor: 'transparent' },
    cardActive: { borderColor: C.orange },
    embedded: { backgroundColor: 'transparent', borderWidth: 0, borderRadius: 0, paddingHorizontal: 0, paddingVertical: 0 },
    head: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 6, paddingVertical: 4 },
    headerRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, gap: 4 },
    hdr: { fontSize: 13, color: C.textDim, textAlign: 'center' },
    swipeDelete: { width: 76, backgroundColor: C.red, alignItems: 'center', justifyContent: 'center', gap: 2, borderRadius: R.sm, marginLeft: 6 },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      minHeight: 58,
      backgroundColor: C.surface,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: C.border,
    },
    colSet: { width: 28, alignItems: 'center', justifyContent: 'center', alignSelf: 'stretch' },
    colPrev: { flex: 1.2, justifyContent: 'center', alignSelf: 'stretch' },
    colTarget: { flex: 1.15, justifyContent: 'center' },
    colPill: { width: 104 },
    pill: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: C.surface2,
      borderRadius: R.sm,
      borderWidth: 1.5,
      borderColor: 'transparent',
      height: 38,
    },
    pillActive: { borderColor: C.orange },
    pillDivider: { width: 1, alignSelf: 'stretch', marginVertical: 6, backgroundColor: C.border },
    colCheck: { width: 40, alignItems: 'center', justifyContent: 'center', alignSelf: 'stretch' },
    typeBadge: { width: 22, height: 22, borderRadius: 5, alignItems: 'center', justifyContent: 'center' },
    check: { width: 30, height: 30, borderRadius: 15, borderWidth: 2, borderColor: C.textFaint, alignItems: 'center', justifyContent: 'center' },
    checkActive: { borderColor: C.orange },
    checkOn: { backgroundColor: C.accent, borderColor: C.accent },
    footer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 20,
      paddingTop: 10,
      paddingHorizontal: 4,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: C.border,
    },
    footBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4 },
  }),
);
