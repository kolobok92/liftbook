import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { memo, useCallback, useEffect, useMemo, useRef, useState, type ComponentRef } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import Swipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import { SwipeDeleteAction } from './SwipeDelete';
import { bestSet, setLabels, fmtNum, fmtSet, targetLabel } from '@/lib/calc';
import { exerciseName, useExercises, useOneRepMax } from '@/lib/hooks';
import { useStore } from '@/lib/store';
import { completeSet, emptySet, findPrevious, previousSetFor, suggestFor, type Suggestion } from '@/lib/tracking';
import type { LoggedSet, SetType, Unit, WorkoutExercise } from '@/lib/types';
import { C, R, SET_TYPE_COLOR, themed } from '@/lib/theme';
import { IconLine, LastNote } from '../NoteField';
import { MenuItem, Sheet, Txt, haptic } from '../ui';
import { useRegisterCard } from './focusChain';
import { NumInput } from './NumInput';
import { RpeSheet } from './RpeSheet';

export type ExerciseCardProps = {
  exercise: WorkoutExercise;
  index: number;
  unit: Unit;
  workoutId: string;
  startedAt: number;
  programRef?: { programId: string; week: number; day: number };
  /** live: the in-progress workout. edit: editing a logged workout. */
  mode: 'live' | 'edit';
  supersetLabel?: string;
  /** Stable callbacks from the editor (keyed by row id / index) so memo can skip unchanged cards. */
  onChange: (rowId: string, fn: (e: WorkoutExercise) => WorkoutExercise) => void;
  onMenu: (index: number) => void;
  onSwap: (rowId: string) => void;
  /** Called after the last open set here is checked, to move focus to the next exercise. */
  onAdvance?: (rowId: string) => void;
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
  // The set being edited (last focused); it and its card get the orange outline.
  const [activeRow, setActiveRow] = useState<number | null>(null);
  const [typeFor, setTypeFor] = useState<number | null>(null);
  const [showInstr, setShowInstr] = useState(false);
  const repRefs = useRef<(ComponentRef<typeof TextInput> | null)[]>([]);
  const weightRefs = useRef<(ComponentRef<typeof TextInput> | null)[]>([]);
  const setsRef = useRef(we.sets);
  setsRef.current = we.sets;

  // Focusing a set's weight also prefills it from last time (see prefill), like tapping it.
  const focusFirstOpen = useCallback(() => {
    const i = setsRef.current.findIndex((s) => !s.done);
    if (i < 0) return false;
    weightRefs.current[i]?.focus();
    return true;
  }, []);
  const registry = useRegisterCard(we.id, focusFirstOpen);

  const prev = useMemo(
    () => findPrevious(history, we.exerciseId, { programRef: p.programRef, excludeWorkoutId: p.workoutId, before: p.startedAt }),
    [history, we.exerciseId, p.programRef, p.workoutId, p.startedAt],
  );
  const suggestions: Suggestion[] = useMemo(
    () => we.sets.map((_, i) => suggestFor({ sets: we.sets, index: i, prev: prev?.sets, oneRepMax: oneRm, rounding })),
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

  const { onChange } = p;
  const change = useCallback((fn: (e: WorkoutExercise) => WorkoutExercise) => onChange(we.id, fn), [onChange, we.id]);

  const updateSet = (i: number, patch: Partial<LoggedSet>) =>
    change((e) => ({ ...e, sets: e.sets.map((s, j) => (j === i ? { ...s, ...patch } : s)) }));

  const toggleDone = (i: number) => {
    const s = we.sets[i];
    if (s.done) {
      updateSet(i, { done: false });
      return;
    }
    const committed = completeSet(s, suggestions[i]);
    // Nothing entered and nothing to hint from: don't log an empty set, and stay put.
    if (timed ? committed.seconds == null : committed.reps == null) {
      haptic('warning');
      return;
    }
    change((e) => ({ ...e, sets: e.sets.map((x, j) => (j === i ? committed : x)) }));
    haptic('light');
    if (p.mode !== 'live') return;
    // Move on to the next unfinished set here, else the next exercise.
    const next = we.sets.findIndex((x, j) => j > i && !x.done);
    const before = we.sets.findIndex((x, j) => j < i && !x.done);
    const target = next >= 0 ? next : before;
    if (target >= 0) setTimeout(() => weightRefs.current[target]?.focus(), 0);
    else setTimeout(() => p.onAdvance?.(we.id), 0);
  };

  const toggleAll = () => {
    if (allDone) {
      change((e) => ({ ...e, sets: e.sets.map((s) => ({ ...s, done: false })) }));
      return;
    }
    change((e) => {
      const sets = [...e.sets];
      for (let i = 0; i < sets.length; i++) {
        if (sets[i].done) continue;
        const c = completeSet(sets[i], suggestFor({ sets, index: i, prev: prev?.sets, oneRepMax: oneRm, rounding }));
        if (timed ? c.seconds != null : c.reps != null) sets[i] = c;
      }
      return { ...e, sets };
    });
    haptic('light');
  };

  /** Tapping into an unfinished set fills its empty inputs with the suggestion (Boostcamp-style). */
  const prefill = (i: number) => {
    setActiveRow(i);
    const s = we.sets[i];
    const sug = suggestions[i];
    if (!s || s.done) return;
    const patch: Partial<LoggedSet> = {};
    if (s.weight == null && sug.weight != null) patch.weight = sug.weight;
    if (timed) {
      if (s.seconds == null && sug.seconds != null) patch.seconds = sug.seconds;
    } else if (s.reps == null && sug.reps != null) patch.reps = sug.reps;
    if (Object.keys(patch).length) updateSet(i, patch);
  };

  const copyPrevious = (i: number) => {
    const ps = previousSetFor(we.sets, i, prev?.sets);
    if (!ps) return;
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
  const best = bestSet(we.sets.filter((x) => x.done));
  const doneCount = we.sets.filter((x) => x.done).length;
  const activeOpen = p.mode === 'live' && activeRow != null && we.sets[activeRow] && !we.sets[activeRow].done ? activeRow : null;

  const header = (
    <View style={styles.head}>
      <Pressable style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 }} onPress={() => router.push(`/exercise/${we.exerciseId}`)}>
        <Txt size={17} weight="600">
          {p.index + 1}
        </Txt>
        <Txt size={17} weight="700" numberOfLines={1} style={{ flexShrink: 1 }}>
          {name}
        </Txt>
      </Pressable>
      {p.mode === 'live' && (
        <Pressable
          testID={`collapse-${p.index}`}
          accessibilityLabel={collapsed ? 'Expand exercise' : 'Collapse exercise'}
          hitSlop={10}
          onPress={() => setCollapsedOverride(!collapsed)}
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
        onPress={() => setCollapsedOverride(false)}
        style={[styles.card, p.supersetLabel ? styles.superset : null]}
      >
        {header}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 6 }}>
          {allDone && (
            <View style={styles.doneDot}>
              <Ionicons name="checkmark" size={12} color={C.onAccent} />
            </View>
          )}
          <Txt dim size={13} testID={`collapsed-summary-${p.index}`}>
            {allDone ? `${we.sets.length} sets` : `${doneCount}/${we.sets.length} sets`}
            {best ? ` · best ${fmtSet(best, unit, timed)}` : ''}
          </Txt>
        </View>
      </Pressable>
    );
  }

  return (
    <View style={[styles.card, activeOpen != null && styles.cardActive, p.supersetLabel ? styles.superset : null]} testID={`exercise-card-${p.index}`}>
      {p.supersetLabel && (
        <Txt size={11} weight="800" color={C.accentText} style={{ letterSpacing: 0.6, paddingHorizontal: 6 }}>
          {p.supersetLabel}
        </Txt>
      )}
      {header}

      {we.instructions ? (
        <Pressable onPress={() => setShowInstr((v) => !v)} style={{ paddingHorizontal: 6 }}>
          <Txt dim size={13} numberOfLines={showInstr ? undefined : 2}>
            {we.instructions}
          </Txt>
        </Pressable>
      ) : null}

      {!we.notes && prev?.exercise.notes ? (
        <View style={{ paddingHorizontal: 6 }}>
          <LastNote testID={`last-note-${p.index}`} text={prev.exercise.notes} onPress={() => change((e) => ({ ...e, notes: prev.exercise.notes }))} />
        </View>
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
        const sug = suggestions[i];
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
              <Pressable testID={`prev-${p.index}-${i}`} accessibilityLabel={pl.top === '—' ? 'No previous' : `Copy previous ${pl.top}`} onPress={() => copyPrevious(i)} style={styles.colPrev}>
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
              <View style={[styles.colPill, styles.pill, active && styles.pillActive]}>
                <NumInput
                  inputRef={(r) => {
                    weightRefs.current[i] = r;
                  }}
                  testID={`weight-${p.index}-${i}`}
                  label={`Set ${i + 1} weight`}
                  value={s.weight}
                  placeholder={sug.weight}
                  done={s.done}
                  onFocus={() => prefill(i)}
                  onChange={(n) => updateSet(i, { weight: n })}
                  style={styles.pillInput}
                />
                <View style={styles.pillDivider} />
                {timed ? (
                  <NumInput
                    inputRef={(r) => {
                      repRefs.current[i] = r;
                    }}
                    testID={`seconds-${p.index}-${i}`}
                    label={`Set ${i + 1} seconds`}
                    integer
                    value={s.seconds}
                    placeholder={sug.seconds}
                    done={s.done}
                    onFocus={() => prefill(i)}
                    onChange={(n) => updateSet(i, { seconds: n })}
                    style={styles.pillInput}
                  />
                ) : (
                  <NumInput
                    inputRef={(r) => {
                      repRefs.current[i] = r;
                    }}
                    testID={`reps-${p.index}-${i}`}
                    label={`Set ${i + 1} reps`}
                    integer
                    value={s.reps}
                    placeholder={sug.reps}
                    done={s.done}
                    onFocus={() => prefill(i)}
                    onChange={(n) => updateSet(i, { reps: n })}
                    style={styles.pillInput}
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
                <View style={[styles.check, active && styles.checkActive, s.done && styles.checkOn]}>
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
        <Pressable testID={`exercise-menu-${p.index}`} accessibilityLabel="Exercise options" hitSlop={8} onPress={() => p.onMenu(p.index)} style={styles.footBtn}>
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

const styles = themed(() => StyleSheet.create({
  card: { backgroundColor: C.surface, borderRadius: R.lg, paddingVertical: 14, paddingHorizontal: 12, gap: 8, borderWidth: 1.5, borderColor: 'transparent' },
  cardActive: { borderColor: C.orange },
  superset: { borderLeftWidth: 3, borderLeftColor: C.accent },
  doneDot: { width: 18, height: 18, borderRadius: 9, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center' },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 6, paddingVertical: 4 },
  headerRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, gap: 4 },
  hdr: { fontSize: 13, color: C.textDim, textAlign: 'center' },
  swipeDelete: { width: 76, backgroundColor: C.red, alignItems: 'center', justifyContent: 'center', gap: 2, borderRadius: R.sm, marginLeft: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 58, backgroundColor: C.surface, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.border },
  colSet: { width: 28, alignItems: 'center', justifyContent: 'center', alignSelf: 'stretch' },
  colPrev: { flex: 1.2, justifyContent: 'center', alignSelf: 'stretch' },
  colTarget: { flex: 1.15, justifyContent: 'center' },
  colPill: { width: 104 },
  pill: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.surface2, borderRadius: R.sm, borderWidth: 1.5, borderColor: 'transparent', height: 38 },
  pillActive: { borderColor: C.orange },
  pillInput: { flex: 1, backgroundColor: 'transparent', paddingVertical: 0, height: '100%' },
  pillDivider: { width: 1, alignSelf: 'stretch', marginVertical: 6, backgroundColor: C.border },
  colCheck: { width: 40, alignItems: 'center', justifyContent: 'center', alignSelf: 'stretch' },
  typeBadge: { width: 22, height: 22, borderRadius: 5, alignItems: 'center', justifyContent: 'center' },
  check: { width: 30, height: 30, borderRadius: 15, borderWidth: 2, borderColor: C.textFaint, alignItems: 'center', justifyContent: 'center' },
  checkActive: { borderColor: C.orange },
  checkOn: { backgroundColor: C.accent, borderColor: C.accent },
  footer: { flexDirection: 'row', alignItems: 'center', gap: 20, paddingTop: 10, paddingHorizontal: 4, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.border },
  footBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4 },
}));
