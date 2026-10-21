import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { TrendLine } from '@/components/Charts';
import { HowTo } from '@/components/HowTo';
import { MuscleMap } from '@/components/MuscleMap';
import { Screen } from '@/components/Screen';
import { Button, Card, Empty, Segmented, Txt, confirm } from '@/components/ui';
import { exerciseSessions } from '@/lib/analytics';
import { setLabels, e1rm, fmtDate, fmtNum, fmtSet, fmtVolume, weightForReps } from '@/lib/calc';
import { EQUIPMENT_LABEL, MUSCLE_LABEL, exerciseDetails } from '@/lib/exercises';
import { exerciseName, useExercises } from '@/lib/hooks';
import { useStore } from '@/lib/store';
import { recordsFor, sortedHistory } from '@/lib/tracking';
import type { Muscle } from '@/lib/types';
import { C, R, SET_TYPE_COLOR } from '@/lib/theme';

type Tab = 'about' | 'records' | 'chart' | 'history';
type Metric = 'e1rm' | 'weight' | 'volume';

export default function ExerciseDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { byId } = useExercises();
  const ex = byId[id];
  const history = useStore((s) => s.history);
  const unit = useStore((s) => s.settings.unit);
  const entered1rm = useStore((s) => s.oneRepMaxes[id]);
  const hasHowTo = !!exerciseDetails(id);
  // New-to-you exercises open on How to; logged ones on Records.
  const [tab, setTab] = useState<Tab>(() => (hasHowTo && recordsFor(useStore.getState().history, id).maxReps === 0 ? 'about' : 'records'));
  const [metric, setMetric] = useState<Metric>('e1rm');

  const records = useMemo(() => recordsFor(history, id), [history, id]);
  const sessions = useMemo(() => exerciseSessions(history, id), [history, id]);
  const logs = useMemo(
    () =>
      sortedHistory(history)
        .map((w) => ({ w, sets: w.exercises.filter((e) => e.exerciseId === id).flatMap((e) => e.sets.filter((s) => s.done)), notes: w.exercises.filter((e) => e.exerciseId === id).map((e) => e.notes).filter(Boolean) }))
        .filter((x) => x.sets.length > 0),
    [history, id],
  );

  /** When each record was set, for the "PR history" list. */
  const prTimeline = useMemo(() => {
    const out: { t: number; label: string; workoutId: string }[] = [];
    let best = 0;
    for (const s of sessions) {
      if (s.bestE1rm > best + 1e-9 && s.bestSet) {
        if (best > 0) out.push({ t: s.t, label: `${fmtSet(s.bestSet, unit)} · e1RM ${fmtNum(Math.round(s.bestE1rm))}`, workoutId: s.workoutId });
        best = s.bestE1rm;
      }
    }
    return out.reverse();
  }, [sessions, unit]);

  if (!ex && logs.length === 0) return <Empty icon="alert-circle-outline" title="Exercise not found" />;
  const name = exerciseName(byId, id);
  const muscles: Partial<Record<Muscle, number>> = {};
  for (const m of ex?.secondary ?? []) muscles[m] = 1;
  for (const m of ex?.primary ?? []) muscles[m] = 3;

  const points = sessions.map((s) => ({ t: s.t, v: metric === 'e1rm' ? s.bestE1rm : metric === 'weight' ? s.maxWeight : s.volume }));
  const repRows = Array.from({ length: 12 }, (_, i) => i + 1);

  return (
    <>
      <Stack.Screen options={{ title: '' }} />
      <Screen header>
        <View style={{ gap: 4 }}>
          <Txt size={24} weight="800">
            {name}
          </Txt>
          {ex && (
            <Txt dim>
              {EQUIPMENT_LABEL[ex.equipment]}
              {ex.primary.length ? ` · ${ex.primary.map((m) => MUSCLE_LABEL[m]).join(', ')}` : ''}
              {ex.secondary.length ? ` (+ ${ex.secondary.map((m) => MUSCLE_LABEL[m]).join(', ')})` : ''}
            </Txt>
          )}
        </View>
        <Segmented
          options={[
            ...(hasHowTo ? [{ value: 'about' as const, label: 'About' }] : []),
            { value: 'records', label: 'Records' },
            { value: 'chart', label: 'Chart' },
            { value: 'history', label: 'History' },
          ]}
          value={tab}
          onChange={setTab}
        />

        {tab === 'about' && <HowTo exerciseId={id} />}

        {tab === 'records' && (
          <>
            {records.maxReps === 0 ? (
              <Card>
                <Txt dim>No completed sets yet. Records appear after you log this exercise.</Txt>
              </Card>
            ) : (
              <>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                  <RecordTile testID="record-e1rm" label="Est. 1RM" value={`${fmtNum(Math.round(records.bestE1rm))}`} unit={unit} />
                  <RecordTile testID="record-weight" label="Max Weight" value={fmtNum(records.maxWeight)} unit={unit} />
                  <RecordTile label="Max Volume (set)" value={fmtVolume(records.maxVolumeSet)} unit={unit} />
                  <RecordTile label="Max Reps" value={String(records.maxReps)} />
                </View>
                <Card>
                  <Txt weight="700">Rep Maxes</Txt>
                  <View style={{ flexDirection: 'row' }}>
                    <Txt faint size={12} style={{ width: 52 }}>
                      Reps
                    </Txt>
                    <Txt faint size={12} style={{ flex: 1 }}>
                      Best
                    </Txt>
                    <Txt faint size={12} style={{ flex: 1, textAlign: 'right' }}>
                      Estimated
                    </Txt>
                  </View>
                  {repRows.map((r) => {
                    const best = records.repMaxes[r];
                    const est = weightForReps(records.bestE1rm, r);
                    return (
                      <View key={r} style={{ flexDirection: 'row', paddingVertical: 3 }}>
                        <Txt weight="600" style={{ width: 52 }}>
                          {r}RM
                        </Txt>
                        <Txt style={{ flex: 1 }} color={best ? C.text : C.textFaint}>
                          {best ? `${fmtNum(best)} ${unit}` : '—'}
                        </Txt>
                        <Txt dim style={{ flex: 1, textAlign: 'right' }}>
                          {fmtNum(Math.round(est))} {unit}
                        </Txt>
                      </View>
                    );
                  })}
                </Card>
                {prTimeline.length > 0 && (
                  <Card>
                    <Txt weight="700">PR History</Txt>
                    {prTimeline.map((p, i) => (
                      <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                        <Txt dim>{fmtDate(p.t, { month: 'short', day: 'numeric', year: 'numeric' })}</Txt>
                        <Txt>{p.label}</Txt>
                      </View>
                    ))}
                  </Card>
                )}
              </>
            )}
            <Card style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ flex: 1 }}>
                <Txt weight="700">Training max</Txt>
                <Txt dim size={13}>
                  {entered1rm ? `${fmtNum(entered1rm)} ${unit} (entered)` : 'Not set — % sets use your est. 1RM'}
                </Txt>
              </View>
              <Button small variant="secondary" title="Edit" onPress={() => router.push('/program/rep-maxes')} />
            </Card>
            {ex && (ex.primary.length > 0 || ex.secondary.length > 0) && (
              <Card>
                <Txt weight="700">Muscles Worked</Txt>
                <MuscleMap values={muscles} max={3} scale={0.55} />
              </Card>
            )}
          </>
        )}

        {tab === 'chart' && (
          <Card>
            <Segmented
              options={[
                { value: 'e1rm', label: 'Est. 1RM' },
                { value: 'weight', label: 'Max Weight' },
                { value: 'volume', label: 'Volume' },
              ]}
              value={metric}
              onChange={setMetric}
            />
            <TrendLine points={points} format={(v) => (metric === 'volume' ? fmtVolume(v) : metric === 'weight' ? fmtNum(Math.round(v * 100) / 100) : fmtNum(Math.round(v)))} />
          </Card>
        )}

        {tab === 'history' && (
          <>
            {logs.length === 0 && <Txt faint>No history yet.</Txt>}
            {logs.map(({ w, sets, notes }) => (
              <Card key={w.id} onPress={() => router.push(`/history/${w.id}`)}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Txt weight="700">{w.name}</Txt>
                  <Txt dim size={13}>
                    {fmtDate(w.startedAt, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                  </Txt>
                </View>
                {sets.map((s, i) => (
                  <View key={s.id} style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
                    <View style={{ width: 22, height: 22, borderRadius: 5, alignItems: 'center', justifyContent: 'center', backgroundColor: s.type === 'normal' ? C.surface2 : SET_TYPE_COLOR[s.type] + '33' }}>
                      <Txt size={11} weight="800" color={s.type === 'normal' ? C.textDim : SET_TYPE_COLOR[s.type]}>
                        {setLabels(sets)[i]}
                      </Txt>
                    </View>
                    <Txt style={{ flex: 1 }}>
                      {fmtSet(s, unit)}
                      {s.rpe != null ? <Txt dim>{`  @${fmtNum(s.rpe)}`}</Txt> : null}
                    </Txt>
                    {s.weight && s.reps ? (
                      <Txt faint size={12}>
                        e1RM {fmtNum(Math.round(e1rm(s.weight, s.reps)))}
                      </Txt>
                    ) : null}
                  </View>
                ))}
                {notes.map((n, i) => (
                  <Txt key={i} dim size={13} style={{ fontStyle: 'italic' }}>
                    “{n}”
                  </Txt>
                ))}
              </Card>
            ))}
          </>
        )}

        {ex?.custom && (
          <Button
            variant="danger"
            title="Delete Custom Exercise"
            onPress={async () => {
              if (await confirm('Delete exercise?', 'It is removed from the library. Logged sets stay in your history.', 'Delete', true)) {
                useStore.getState().deleteCustomExercise(ex.id);
                router.back();
              }
            }}
          />
        )}
      </Screen>
    </>
  );
}

function RecordTile({ label, value, unit, testID }: { label: string; value: string; unit?: string; testID?: string }) {
  return (
    // collapsable: Android flattens layout-only views, which would leave testID with no children.
    <View testID={testID} collapsable={false} style={{ flexBasis: '47%', flexGrow: 1, backgroundColor: C.surface, borderRadius: R.lg, padding: 14, gap: 4 }}>
      <Txt dim size={12}>
        {label}
      </Txt>
      <Txt size={22} weight="800" color={C.orange}>
        {value}
        {unit ? <Txt size={13} dim>{` ${unit}`}</Txt> : null}
      </Txt>
    </View>
  );
}
