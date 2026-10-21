import { Ionicons } from '@expo/vector-icons';
import { Redirect } from 'expo-router';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PRList } from '@/components/PRList';
import { ProgramChangesCard } from '@/components/ProgramChangesCard';
import { Button, Card, Field, Txt } from '@/components/ui';
import { bestSet, completedSetCount, fmtDurationShort, fmtSet, fmtVolume, workoutDurationMs, workoutVolume } from '@/lib/calc';
import { exerciseName, useExercises } from '@/lib/hooks';
import { goHome } from '@/lib/nav';
import { useStore } from '@/lib/store';
import { templateFromWorkout } from '@/lib/tracking';
import { C } from '@/lib/theme';

export default function WorkoutSummary() {
  const result = useStore((s) => s.lastFinished);
  // Applying clears the store's pending change; keep showing the card (and its confirmation).
  const [pending] = useState(() => result?.pending);
  const unit = useStore((s) => s.settings.unit);
  const { byId } = useExercises();
  const insets = useSafeAreaInsets();
  const [templateName, setTemplateName] = useState('');
  const [saved, setSaved] = useState(false);

  if (!result) return <Redirect href="/" />;
  const w = result.workout;

  const saveTemplate = () => {
    useStore.getState().saveTemplate(templateFromWorkout(w, templateName.trim() || w.name, Date.now()));
    setSaved(true);
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={{ padding: 16, paddingTop: insets.top + 24, gap: 14, paddingBottom: 40 }}>
      <View style={{ alignItems: 'center', gap: 6 }}>
        <Ionicons name="trophy" size={44} color={C.accent} />
        <Txt size={24} weight="800">
          Workout Complete
        </Txt>
        <Txt dim>{w.name}</Txt>
      </View>
      <Card style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
        <Stat label="Duration" value={fmtDurationShort(workoutDurationMs(w))} />
        <Stat label="Volume" value={`${fmtVolume(workoutVolume(w))}`} suffix={unit} />
        <Stat label="Sets" value={String(completedSetCount(w))} />
      </Card>

      {pending && <ProgramChangesCard pending={pending} />}

      {result.prs.length > 0 && (
        <Card testID="summary-prs">
          <Txt weight="800" color={C.orange}>
            🏆 New Personal Records
          </Txt>
          <PRList prs={result.prs} unit={unit} />
        </Card>
      )}

      <Card>
        {w.exercises.map((e) => (
          <View key={e.id} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Txt style={{ flex: 1 }} numberOfLines={1}>
              {e.sets.length} × {exerciseName(byId, e.exerciseId)}
            </Txt>
            <Txt dim>
              {(() => {
                const best = bestSet(e.sets);
                return best ? fmtSet(best, unit) : '';
              })()}
            </Txt>
          </View>
        ))}
      </Card>

      {!w.programRef && (
        <Card>
          <Txt weight="700">Save as template</Txt>
          {saved ? (
            <Txt color={C.green}>Saved. Start it from Home → Quick Start.</Txt>
          ) : (
            <>
              <Field value={templateName} onChangeText={setTemplateName} placeholder={w.name} />
              <Button title="Save Template" variant="secondary" onPress={saveTemplate} />
            </>
          )}
        </Card>
      )}

      <Button testID="summary-done" title="Done" onPress={goHome} />
    </ScrollView>
  );
}

function Stat({ label, value, suffix }: { label: string; value: string; suffix?: string }) {
  return (
    <View style={{ alignItems: 'center' }}>
      <Txt size={22} weight="800">
        {value}
        {suffix ? <Txt size={12} dim>{` ${suffix}`}</Txt> : null}
      </Txt>
      <Txt dim size={12}>
        {label}
      </Txt>
    </View>
  );
}
