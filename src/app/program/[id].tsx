import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { DayPreview } from '@/components/DayPreview';
import { MuscleBars, MuscleMap } from '@/components/MuscleMap';
import { Screen } from '@/components/Screen';
import { Button, Card, Empty, MenuItem, SectionTitle, Sheet, Txt, confirm } from '@/components/ui';
import { programMuscleShare } from '@/lib/analytics';
import { fmtNum } from '@/lib/calc';
import { useExercises } from '@/lib/hooks';
import { cloneProgram } from '@/lib/programOps';
import { goHome } from '@/lib/nav';
import { useStore } from '@/lib/store';
import { daysPerWeek } from '@/lib/tracking';
import { C } from '@/lib/theme';

export default function ProgramDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const program = useStore((s) => s.programs.find((p) => p.id === id));
  const activeProgram = useStore((s) => s.activeProgram);
  const { byId } = useExercises();
  const [week, setWeek] = useState(0);
  const [menu, setMenu] = useState(false);
  const [showAllMuscles, setShowAllMuscles] = useState(false);
  const share = useMemo(() => (program ? programMuscleShare(program, byId) : []), [program, byId]);

  if (!program) return <Empty icon="alert-circle-outline" title="Program not found" />;
  const isActive = activeProgram?.programId === program.id;
  const hasPct = program.weeks.some((w) => w.days.some((d) => d.exercises.some((e) => e.sets.some((s) => s.intensity.kind === 'pct'))));
  const weekData = program.mode === 'periodized' ? program.weeks[week] : program.weeks[0];

  const activate = async () => {
    if (activeProgram && !isActive) {
      const ok = await confirm('Switch program?', 'Your progress in the current program will be reset. Logged workouts are kept.', 'Switch');
      if (!ok) return;
    }
    useStore.getState().startProgram(program.id);
    goHome();
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: '',
          headerRight: () => (
            <Pressable style={{ paddingHorizontal: 12 }} testID="program-menu" onPress={() => setMenu(true)} hitSlop={8}>
              <Txt color={C.accentText} weight="700">
                •••
              </Txt>
            </Pressable>
          ),
        }}
      />
      <Screen header>
        <View style={{ gap: 4 }}>
          <Txt size={26} weight="800">
            {program.name}
          </Txt>
          {program.description ? <Txt dim>{program.description}</Txt> : null}
        </View>
        <Card style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
          <Stat label={program.mode === 'loop' ? 'Type' : 'Length'} value={program.mode === 'loop' ? 'Loop' : `${program.numWeeks} wks`} />
          <Stat label={program.mode === 'loop' ? 'Days / cycle' : 'Days / week'} value={String(daysPerWeek(program))} />
          <Stat label="Exercises" value={String(program.weeks[0]?.days.reduce((n, d) => n + d.exercises.length, 0) ?? 0)} />
        </Card>

        <View style={{ flexDirection: 'row', gap: 10 }}>
          {isActive ? (
            <Button style={{ flex: 1 }} variant="secondary" title="Active Program" icon="checkmark-circle" onPress={() => goHome()} />
          ) : (
            <Button testID="start-program" style={{ flex: 1 }} title="Start Program" icon="play" onPress={activate} />
          )}
          <Button testID="edit-program" style={{ flex: 1 }} variant="secondary" title="Edit" icon="create-outline" onPress={() => router.push(`/program/edit/${program.id}`)} />
        </View>
        {hasPct && <Button variant="ghost" title="Set Rep Maxes for % sets" icon="barbell-outline" onPress={() => router.push({ pathname: '/program/rep-maxes', params: { id: program.id } })} />}

        {share.length > 0 && (
          <>
            <SectionTitle>Muscle Engagement</SectionTitle>
            <Card>
              <MuscleMap values={Object.fromEntries(share.map((s) => [s.muscle, s.pct]))} />
              <MuscleBars rows={(showAllMuscles ? share : share.slice(0, 6)).map((s) => ({ muscle: s.muscle, value: s.pct }))} format={(v) => `${fmtNum(Math.round(v * 10) / 10)}%`} />
              {share.length > 6 && <Button small variant="ghost" title={showAllMuscles ? 'Show less' : `Show all ${share.length} muscles`} onPress={() => setShowAllMuscles((v) => !v)} />}
            </Card>
          </>
        )}

        <SectionTitle>{program.mode === 'periodized' ? 'Workouts' : program.mode === 'loop' ? 'Days' : 'Weekly Workouts'}</SectionTitle>
        {program.mode === 'periodized' && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
            {program.weeks.map((w, i) => (
              <Pressable key={w.id} onPress={() => setWeek(i)} style={{ paddingVertical: 6, paddingHorizontal: 12, borderRadius: 999, backgroundColor: i === week ? C.accent : C.surface2 }}>
                <Txt size={13} weight="700" color={i === week ? C.onAccent : C.textDim}>
                  W{i + 1}
                  {w.phase ? ` · ${w.phase}` : ''}
                </Txt>
              </Pressable>
            ))}
          </ScrollView>
        )}
        {weekData?.days.map((d, i) => (
          <Card key={d.id}>
            <Txt size={16} weight="700">
              Day {i + 1} · {d.name}
            </Txt>
            <DayPreview day={d} />
          </Card>
        ))}
      </Screen>

      <Sheet visible={menu} onClose={() => setMenu(false)} title={program.name}>
        <MenuItem
          icon="copy-outline"
          label="Duplicate program"
          onPress={() => {
            const copy = cloneProgram(program);
            useStore.getState().saveProgram(copy);
            setMenu(false);
            router.replace(`/program/${copy.id}`);
          }}
        />
        {isActive && (
          <MenuItem
            icon="stop-circle-outline"
            label="Stop program"
            onPress={async () => {
              setMenu(false);
              if (await confirm('Stop program?', 'Progress tracking stops. Logged workouts are kept.', 'Stop', true)) useStore.getState().stopProgram();
            }}
          />
        )}
        <MenuItem
          testID="delete-program"
          icon="trash-outline"
          label="Delete program"
          danger
          onPress={async () => {
            setMenu(false);
            if (await confirm('Delete program?', `"${program.name}" will be deleted. Logged workouts are kept.`, 'Delete', true)) {
              useStore.getState().deleteProgram(program.id);
              router.back();
            }
          }}
        />
      </Sheet>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ alignItems: 'center' }}>
      <Txt size={17} weight="800">
        {value}
      </Txt>
      <Txt dim size={12}>
        {label}
      </Txt>
    </View>
  );
}
