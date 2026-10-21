import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { NoteField } from '@/components/NoteField';
import { PRList } from '@/components/PRList';
import { Screen } from '@/components/Screen';
import { startWorkout } from '@/components/startWorkout';
import { WorkoutEditor } from '@/components/workout/WorkoutEditor';
import { Button, Card, Empty, Txt, confirm } from '@/components/ui';
import { NumInput } from '@/components/workout/NumInput';
import { clone, completedSetCount, setLabels, fmtDurationShort, fmtNum, fmtSet, fmtVolume, workoutDurationMs, workoutVolume } from '@/lib/calc';
import { exerciseName, useExercises } from '@/lib/hooks';
import { useStore } from '@/lib/store';
import { detectPRs, templateFromWorkout } from '@/lib/tracking';
import { keepCompletedSets } from '@/lib/workoutOps';
import type { Workout } from '@/lib/types';
import { C } from '@/lib/theme';

export default function WorkoutDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const workout = useStore((s) => s.history.find((w) => w.id === id));
  const history = useStore((s) => s.history);
  const unit = useStore((s) => s.settings.unit);
  const programName = useStore((s) => (workout?.programRef ? s.programs.find((p) => p.id === workout.programRef!.programId)?.name : undefined));
  const { byId } = useExercises();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Workout | null>(null);
  const updateDraft = useCallback((fn: (w: Workout) => Workout) => setDraft((d) => (d ? fn(d) : d)), []);

  if (!workout) return <Empty icon="alert-circle-outline" title="Workout not found" />;
  const w = editing && draft ? draft : workout;
  const prs = detectPRs(workout, history);

  const beginEdit = () => {
    setDraft(clone(workout));
    setEditing(true);
  };
  const saveEdit = () => {
    if (!draft) return;
    // Sets left unchecked while editing are dropped, same as finishing a live workout.
    useStore.getState().updateHistory(workout.id, () => keepCompletedSets(draft));
    setEditing(false);
    setDraft(null);
  };

  const durMin = Math.round(workoutDurationMs(w) / 60000);

  return (
    <>
      <Stack.Screen
        options={{
          title: '',
          headerRight: () =>
            editing ? (
              <Pressable style={{ paddingHorizontal: 12 }} testID="save-workout-edit" onPress={saveEdit} hitSlop={8}>
                <Txt weight="700" color={C.accentText}>
                  Save
                </Txt>
              </Pressable>
            ) : (
              <Pressable style={{ paddingHorizontal: 12 }} testID="edit-workout" onPress={beginEdit} hitSlop={8}>
                <Txt weight="700" color={C.accentText}>
                  Edit
                </Txt>
              </Pressable>
            ),
        }}
      />
      <Screen header>
        {editing && draft ? (
          <>
            <TextInput value={draft.name} onChangeText={(name) => setDraft({ ...draft, name })} style={{ color: C.text, fontSize: 24, fontWeight: '800', padding: 0 }} />
            <NoteField testID="edit-workout-note" value={draft.notes} onChangeText={(notes) => setDraft({ ...draft, notes })} placeholder="Workout notes" />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Txt dim>Duration (min)</Txt>
              <View style={{ width: 80 }}>
                <NumInput
                  label="Duration in minutes"
                  integer
                  value={durMin}
                  onChange={(n) => n != null && setDraft({ ...draft, endedAt: draft.startedAt + (draft.pausedMs ?? 0) + n * 60000 })}
                />
              </View>
            </View>
            <WorkoutEditor workout={draft} update={updateDraft} mode="edit" />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Button
                style={{ flex: 1 }}
                variant="secondary"
                title="Cancel"
                onPress={() => {
                  setEditing(false);
                  setDraft(null);
                }}
              />
              <Button style={{ flex: 1 }} title="Save Changes" onPress={saveEdit} />
            </View>
          </>
        ) : (
          <>
            <View style={{ gap: 4 }}>
              <Txt size={24} weight="800">
                {w.name}
              </Txt>
              <Txt dim>
                {new Date(w.startedAt).toLocaleString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}
              </Txt>
              {w.programRef && (
                <Txt dim size={13}>
                  {programName ?? 'Program'} · Day {w.programRef.day + 1}
                </Txt>
              )}
              {w.notes ? (
                <Txt style={{ fontStyle: 'italic' }} dim>
                  “{w.notes}”
                </Txt>
              ) : null}
            </View>
            <Card style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
              <Stat label="Duration" value={fmtDurationShort(workoutDurationMs(w))} />
              <Stat label={`Volume (${unit})`} value={fmtVolume(workoutVolume(w))} />
              <Stat label="Sets" value={String(completedSetCount(w))} />
            </Card>
            {prs.length > 0 && (
              <Card>
                <Txt weight="800" color={C.orange}>
                  🏆 Personal Records
                </Txt>
                <PRList prs={prs} unit={unit} />
              </Card>
            )}
            {w.exercises.map((e, ei) => (
              <Card key={e.id} onPress={() => router.push(`/exercise/${e.exerciseId}`)}>
                <Txt weight="700" color={C.accentText}>
                  {ei + 1}. {exerciseName(byId, e.exerciseId)}
                </Txt>
                {e.notes ? (
                  <Txt dim size={13} style={{ fontStyle: 'italic' }}>
                    “{e.notes}”
                  </Txt>
                ) : null}
                {e.sets.map((s, i) => {
                  const pr = prs.find((p) => p.setId === s.id);
                  return (
                    <View key={s.id} style={{ flexDirection: 'row', gap: 10 }}>
                      <Txt dim style={{ width: 22 }}>
                        {setLabels(e.sets)[i]}
                      </Txt>
                      <Txt style={{ flex: 1 }}>
                        {fmtSet(s, unit)}
                        {s.rpe != null ? <Txt dim>{`  @${fmtNum(s.rpe)}`}</Txt> : null}
                      </Txt>
                      {pr && (
                        <Txt size={12} color={C.orange}>
                          🏆 PR
                        </Txt>
                      )}
                    </View>
                  );
                })}
              </Card>
            ))}
            <Button testID="repeat-workout" title="Repeat Workout" icon="repeat" onPress={() => startWorkout(() => useStore.getState().startFromWorkout(workout))} />
            <Button
              variant="secondary"
              title="Save as Template"
              icon="document-text-outline"
              onPress={() => {
                useStore.getState().saveTemplate(templateFromWorkout(workout, workout.name, Date.now()));
                router.push('/programs');
              }}
            />
            <Button
              testID="delete-workout"
              variant="danger"
              title="Delete Workout"
              icon="trash-outline"
              onPress={async () => {
                if (await confirm('Delete workout?', 'This permanently removes it from your history.', 'Delete', true)) {
                  useStore.getState().deleteWorkout(workout.id);
                  router.back();
                }
              }}
            />
          </>
        )}
      </Screen>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ alignItems: 'center' }}>
      <Txt size={20} weight="800">
        {value}
      </Txt>
      <Txt dim size={12}>
        {label}
      </Txt>
    </View>
  );
}
