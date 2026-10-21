import { Ionicons } from '@expo/vector-icons';
import { router, Stack, useLocalSearchParams, useNavigation, usePreventRemove } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';
import { ProgramExerciseEditor } from '@/components/program/ProgramExerciseEditor';
import { SetTargetSheet } from '@/components/program/SetTargetSheet';
import { Screen } from '@/components/Screen';
import { Button, Card, Field, MenuItem, Segmented, Sheet, Txt, confirm, notify } from '@/components/ui';
import { clone, supersetLabels, uid } from '@/lib/calc';
import { useExercisePicker } from '@/lib/picker';
import {
  MAX_DAYS,
  cloneDay,
  cloneWeek,
  forAllWeeks,
  move,
  setMode,
  setNumWeeks,
  updateDay,
  updateWeek,
  validateProgram,
} from '@/lib/programOps';
import { blankProgram, blankProgramExercise, useStore } from '@/lib/store';
import type { Program, ProgramExercise } from '@/lib/types';
import { C, R, themed } from '@/lib/theme';

type SetRef = { day: number; ex: number; set: number };
type ExRef = { day: number; ex: number };

export default function ProgramBuilder() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const existing = useStore((s) => s.programs.find((p) => p.id === id));
  // Snapshot at open; saving updates the store but shouldn't move the baseline mid-navigation.
  const [initial] = useState<Program>(() => (existing ? clone(existing) : blankProgram()));
  const [draft, setDraft] = useState<Program>(initial);
  const [week, setWeek] = useState(0);
  const [setRef, setSetRef] = useState<SetRef | null>(null);
  const [exMenu, setExMenu] = useState<ExRef | null>(null);
  const [dayMenu, setDayMenu] = useState<number | null>(null);
  const navigation = useNavigation();
  const pickExercises = useExercisePicker();
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);
  // Leaving after save/discard: first drop the guard (state), then navigate once it has re-rendered.
  const [leave, setLeave] = useState<(() => void) | null>(null);
  useEffect(() => {
    if (leave) leave();
  }, [leave]);

  usePreventRemove(dirty && !leave, ({ data }) => {
    confirm('Discard changes?', 'You have unsaved changes to this program.', 'Discard', true).then((ok) => {
      if (ok) setLeave(() => () => navigation.dispatch(data.action));
    });
  });

  const wi = draft.mode === 'periodized' ? week : 0;
  const days = draft.weeks[wi]?.days ?? [];

  const save = () => {
    const err = validateProgram(draft);
    if (err) return notify("Can't save yet", err);
    useStore.getState().saveProgram(draft);
    // `existing` is from this render, i.e. before the save.
    setLeave(() => (existing ? () => router.back() : () => router.replace(`/program/${draft.id}`)));
  };

  const addExercises = (di: number) => {
    pickExercises({ multi: true }, (ids) => setDraft((p) => updateDay(p, wi, di, (d) => ({ ...d, exercises: [...d.exercises, ...ids.map((x) => blankProgramExercise(x))] }))));
  };

  const editingSet = setRef ? days[setRef.day]?.exercises[setRef.ex]?.sets[setRef.set] : undefined;
  const menuEx = exMenu ? days[exMenu.day]?.exercises[exMenu.ex] : undefined;
  const menuNext = exMenu ? days[exMenu.day]?.exercises[exMenu.ex + 1] : undefined;
  const inSuperset = !!menuEx?.superset && (days[exMenu!.day]?.exercises.filter((e) => e.superset === menuEx.superset).length ?? 0) > 1;

  const updateEx = (r: ExRef, fn: (e: ProgramExercise) => ProgramExercise) =>
    setDraft((p) => updateDay(p, wi, r.day, (d) => ({ ...d, exercises: d.exercises.map((e, i) => (i === r.ex ? fn(e) : e)) })));

  return (
    <>
      <Stack.Screen
        options={{
          title: existing ? 'Edit Program' : 'New Program',
          headerRight: () => (
            <Pressable style={{ paddingHorizontal: 12 }} testID="save-program" onPress={save} hitSlop={8}>
              <Txt weight="700" color={C.accentText}>
                Save
              </Txt>
            </Pressable>
          ),
        }}
      />
      <Screen header>
        <Field testID="program-name" label="Program name" value={draft.name} onChangeText={(name) => setDraft((p) => ({ ...p, name }))} placeholder="e.g. Upper / Lower" />
        <Field label="Description" value={draft.description} onChangeText={(description) => setDraft((p) => ({ ...p, description }))} placeholder="Optional" multiline />

        <Txt dim size={13} weight="600">
          Structure
        </Txt>
        <Segmented
          options={[
            { value: 'loop', label: 'Loop' },
            { value: 'repeating', label: 'Repeating Weeks' },
            { value: 'periodized', label: 'Periodized' },
          ]}
          value={draft.mode}
          onChange={async (mode) => {
            if (draft.mode === 'periodized' && mode !== 'periodized' && draft.weeks.length > 1) {
              const ok = await confirm('Keep only week 1?', 'Switching away from periodized keeps week 1 and removes the other weeks.', 'Switch', true);
              if (!ok) return;
            }
            setWeek(0);
            setDraft((p) => setMode(p, mode));
          }}
        />
        <Txt faint size={12}>
          {draft.mode === 'loop'
            ? 'Days repeat in order forever. Edit any time — changes apply to your next workout.'
            : draft.mode === 'repeating'
              ? 'One week template repeated for a fixed number of weeks.'
              : 'Write each week separately (e.g. rising % of 1RM). Days line up across weeks.'}
        </Txt>

        {draft.mode !== 'loop' && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Txt style={{ flex: 1 }}>Weeks</Txt>
            <Pressable accessibilityLabel="Fewer weeks" onPress={() => setDraft((p) => setNumWeeks(p, p.numWeeks - 1))} style={stepBtn}>
              <Ionicons name="remove" size={18} color={C.text} />
            </Pressable>
            <Txt testID="num-weeks" size={18} weight="700" style={{ minWidth: 28, textAlign: 'center' }}>
              {draft.numWeeks}
            </Txt>
            <Pressable accessibilityLabel="More weeks" onPress={() => setDraft((p) => setNumWeeks(p, p.numWeeks + 1))} style={stepBtn}>
              <Ionicons name="add" size={18} color={C.text} />
            </Pressable>
          </View>
        )}

        {draft.mode === 'periodized' && (
          <>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
              {draft.weeks.map((w, i) => (
                <Pressable key={w.id} onPress={() => setWeek(i)} style={{ paddingVertical: 6, paddingHorizontal: 12, borderRadius: 999, backgroundColor: i === week ? C.accent : C.surface2 }}>
                  <Txt size={13} weight="700" color={i === week ? C.onAccent : C.textDim}>
                    Week {i + 1}
                  </Txt>
                </Pressable>
              ))}
            </ScrollView>
            <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
              <View style={{ flex: 1 }}>
                <TextInput
                  value={draft.weeks[week]?.phase ?? ''}
                  onChangeText={(phase) => setDraft((p) => updateWeek(p, week, (w) => ({ ...w, phase })))}
                  placeholder="Phase title (e.g. Volume, Peak)"
                  placeholderTextColor={C.textFaint}
                  style={{ color: C.text, backgroundColor: C.surface2, borderRadius: R.md, paddingHorizontal: 12, paddingVertical: 10 }}
                />
              </View>
              <Button
                small
                variant="secondary"
                title="Copy to later weeks"
                onPress={async () => {
                  const ok = await confirm('Copy week?', `Replace weeks ${week + 2}–${draft.numWeeks} with a copy of week ${week + 1}?`, 'Copy', true);
                  if (ok) setDraft((p) => ({ ...p, weeks: p.weeks.map((w, i) => (i > week ? { ...cloneWeek(p.weeks[week]), phase: w.phase } : w)) }));
                }}
              />
            </View>
          </>
        )}

        {days.map((d, di) => {
          const labels = supersetLabels(d.exercises);
          return (
            <Card key={d.id} testID={`builder-day-${di}`}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <TextInput
                  testID={`day-name-${di}`}
                  value={d.name}
                  onChangeText={(name) => setDraft((p) => forAllWeeks(p, (w) => ({ ...w, days: w.days.map((x, i) => (i === di ? { ...x, name } : x)) })))}
                  style={{ flex: 1, color: C.text, fontSize: 18, fontWeight: '700', padding: 0 }}
                  accessibilityLabel={`Day ${di + 1} name`}
                />
                <Pressable testID={`day-menu-${di}`} accessibilityLabel="Day options" hitSlop={8} onPress={() => setDayMenu(di)}>
                  <Ionicons name="ellipsis-horizontal" size={20} color={C.textDim} />
                </Pressable>
              </View>
              {d.exercises.map((pe, ei) => (
                <ProgramExerciseEditor
                  key={pe.id}
                  pe={pe}
                  index={ei}
                  supersetLabel={labels[ei]}
                  onChange={(next) => updateEx({ day: di, ex: ei }, () => next)}
                  onEditSet={(si) => setSetRef({ day: di, ex: ei, set: si })}
                  onMenu={() => setExMenu({ day: di, ex: ei })}
                />
              ))}
              <Button testID={`builder-add-exercise-${di}`} small variant="secondary" icon="add" title="Add Exercises" onPress={() => addExercises(di)} />
            </Card>
          );
        })}
        {days.length < MAX_DAYS && (
          <Button
            testID="builder-add-day"
            variant="ghost"
            icon="add-circle-outline"
            title="Add Day"
            onPress={() => setDraft((p) => forAllWeeks(p, (w) => ({ ...w, days: [...w.days, { id: uid(), name: `Day ${w.days.length + 1}`, exercises: [] }] })))}
          />
        )}
        <Button testID="save-program-bottom" title="Save Program" onPress={save} />
      </Screen>

      <SetTargetSheet
        key={editingSet?.id ?? 'none'}
        visible={!!editingSet}
        set={editingSet}
        onClose={() => setSetRef(null)}
        onSave={(t, all) => {
          const r = setRef!;
          updateEx(r, (e) => ({ ...e, sets: e.sets.map((s, i) => (all || i === r.set ? { ...s, ...t } : s)) }));
          setSetRef(null);
        }}
      />

      <Sheet visible={!!menuEx} onClose={() => setExMenu(null)} title="Exercise">
        <MenuItem
          icon="swap-horizontal"
          label="Replace exercise"
          onPress={() => {
            const r = exMenu!;
            setExMenu(null);
            pickExercises({ multi: false }, ([x]) => updateEx(r, (e) => ({ ...e, exerciseId: x })));
          }}
        />
        {inSuperset ? (
          <MenuItem
            icon="git-merge-outline"
            label="Remove from superset"
            onPress={() => {
              updateEx(exMenu!, (e) => ({ ...e, superset: undefined }));
              setExMenu(null);
            }}
          />
        ) : menuNext ? (
          <MenuItem
            testID="builder-superset"
            icon="git-merge-outline"
            label="Superset with next"
            onPress={() => {
              const r = exMenu!;
              const group = menuNext.superset ?? uid();
              setDraft((p) =>
                updateDay(p, wi, r.day, (d) => ({ ...d, exercises: d.exercises.map((e, i) => (i === r.ex || i === r.ex + 1 ? { ...e, superset: group } : e)) })),
              );
              setExMenu(null);
            }}
          />
        ) : null}
        <MenuItem
          icon="copy-outline"
          label="Duplicate"
          onPress={() => {
            const r = exMenu!;
            setDraft((p) =>
              updateDay(p, wi, r.day, (d) => {
                const a = [...d.exercises];
                a.splice(r.ex + 1, 0, { ...clone(a[r.ex]), id: uid(), superset: undefined, sets: a[r.ex].sets.map((s) => ({ ...s, id: uid() })) });
                return { ...d, exercises: a };
              }),
            );
            setExMenu(null);
          }}
        />
        <MenuItem
          icon="arrow-up"
          label="Move up"
          onPress={() => {
            const r = exMenu!;
            setDraft((p) => updateDay(p, wi, r.day, (d) => ({ ...d, exercises: move(d.exercises, r.ex, r.ex - 1) })));
            setExMenu(null);
          }}
        />
        <MenuItem
          icon="arrow-down"
          label="Move down"
          onPress={() => {
            const r = exMenu!;
            setDraft((p) => updateDay(p, wi, r.day, (d) => ({ ...d, exercises: move(d.exercises, r.ex, r.ex + 1) })));
            setExMenu(null);
          }}
        />
        <MenuItem
          testID="builder-remove-exercise"
          icon="trash-outline"
          label="Remove"
          danger
          onPress={() => {
            const r = exMenu!;
            setDraft((p) => updateDay(p, wi, r.day, (d) => ({ ...d, exercises: d.exercises.filter((_, i) => i !== r.ex) })));
            setExMenu(null);
          }}
        />
      </Sheet>

      <Sheet visible={dayMenu != null} onClose={() => setDayMenu(null)} title={dayMenu != null ? days[dayMenu]?.name : ''}>
        {days.length < MAX_DAYS && (
          <MenuItem
            icon="copy-outline"
            label="Duplicate day"
            onPress={() => {
              const di = dayMenu!;
              setDraft((p) => forAllWeeks(p, (w) => {
                const a = [...w.days];
                a.splice(di + 1, 0, { ...cloneDay(w.days[di]), name: `${w.days[di].name} (Copy)` });
                return { ...w, days: a };
              }));
              setDayMenu(null);
            }}
          />
        )}
        <MenuItem
          icon="arrow-up"
          label="Move up"
          onPress={() => {
            const di = dayMenu!;
            setDraft((p) => forAllWeeks(p, (w) => ({ ...w, days: move(w.days, di, di - 1) })));
            setDayMenu(null);
          }}
        />
        <MenuItem
          icon="arrow-down"
          label="Move down"
          onPress={() => {
            const di = dayMenu!;
            setDraft((p) => forAllWeeks(p, (w) => ({ ...w, days: move(w.days, di, di + 1) })));
            setDayMenu(null);
          }}
        />
        <MenuItem
          testID="delete-day"
          icon="trash-outline"
          label="Delete day"
          danger
          onPress={async () => {
            const di = dayMenu!;
            setDayMenu(null);
            const ok = await confirm('Delete day?', `Remove ${days[di]?.name}${draft.mode === 'periodized' ? ' from every week' : ''}?`, 'Delete', true);
            if (ok) setDraft((p) => forAllWeeks(p, (w) => ({ ...w, days: w.days.filter((_, i) => i !== di) })));
          }}
        />
      </Sheet>
    </>
  );
}

const stepBtn = themed(() => ({ width: 36, height: 36, borderRadius: 18, backgroundColor: C.surface2, alignItems: 'center', justifyContent: 'center' } as const));
