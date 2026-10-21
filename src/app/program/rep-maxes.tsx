import { useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { Screen } from '@/components/Screen';
import { Button, Card, Txt } from '@/components/ui';
import { NumInput } from '@/components/workout/NumInput';
import { CalcSheet } from '@/components/workout/CalcSheet';
import { fmtNum } from '@/lib/calc';
import { exerciseName, useExercises } from '@/lib/hooks';
import { useStore } from '@/lib/store';
import { recordsFor } from '@/lib/tracking';

/** Training maxes used to compute weights for "% of 1RM" sets. */
export default function RepMaxes() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const program = useStore((s) => s.programs.find((p) => p.id === id));
  const maxes = useStore((s) => s.oneRepMaxes);
  const history = useStore((s) => s.history);
  const unit = useStore((s) => s.settings.unit);
  const { byId } = useExercises();
  const [calc, setCalc] = useState(false);

  const ids = useMemo(() => {
    const out = new Set<string>();
    for (const w of program?.weeks ?? []) for (const d of w.days) for (const e of d.exercises) if (e.sets.some((s) => s.intensity.kind === 'pct')) out.add(e.exerciseId);
    if (!program) for (const k of Object.keys(maxes)) out.add(k);
    return [...out];
  }, [program, maxes]);

  return (
    <Screen header>
      <Txt dim>
        Enter your one rep max (or a training max a little under it) for each lift. Percent-based sets use these; if blank, your best estimated 1RM from history is used.
      </Txt>
      <Card>
        {ids.length === 0 && <Txt faint>This program has no percentage-based sets.</Txt>}
        {ids.map((eid) => {
          const est = recordsFor(history, eid).bestE1rm;
          return (
            <View key={eid} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 6 }}>
              <View style={{ flex: 1 }}>
                <Txt weight="600">{exerciseName(byId, eid)}</Txt>
                {est > 0 && (
                  <Txt dim size={12}>
                    Est. from history: {fmtNum(Math.round(est))} {unit}
                  </Txt>
                )}
              </View>
              <View style={{ width: 90 }}>
                <NumInput label={`${exerciseName(byId, eid)} 1RM`} value={maxes[eid] ?? null} placeholder={est ? Math.round(est) : null} onChange={(n) => useStore.getState().setOneRepMax(eid, n)} />
              </View>
              <Txt dim>{unit}</Txt>
            </View>
          );
        })}
      </Card>
      <Button variant="secondary" title="One Rep Max Calculator" icon="calculator-outline" onPress={() => setCalc(true)} />
      <CalcSheet visible={calc} onClose={() => setCalc(false)} />
    </Screen>
  );
}
