import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { View } from 'react-native';
import { Screen } from '@/components/Screen';
import { startWorkout } from '@/components/startWorkout';
import { Button, Card, Empty, H1, IconBtn, SectionTitle, Txt, confirm } from '@/components/ui';
import { daysPerWeek } from '@/lib/tracking';
import { useStore } from '@/lib/store';
import { C } from '@/lib/theme';

export default function Programs() {
  const programs = useStore((s) => s.programs);
  const activeId = useStore((s) => s.activeProgram?.programId);
  const templates = useStore((s) => s.templates);
  const sorted = [...programs].sort((a, b) => (a.id === activeId ? -1 : b.id === activeId ? 1 : b.updatedAt - a.updatedAt));

  return (
    <Screen>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <H1 style={{ flex: 1 }}>Programs</H1>
        <Button testID="new-program" small title="New" icon="add" onPress={() => router.push('/program/edit/new')} />
      </View>

      {sorted.length === 0 && (
        <Empty icon="albums-outline" title="No programs yet" body="Build a program with your own days, exercises and set targets.">
          <Button title="Build a Program" onPress={() => router.push('/program/edit/new')} />
        </Empty>
      )}
      {sorted.map((p) => (
        <Card key={p.id} testID={`program-card-${p.id}`} onPress={() => router.push(`/program/${p.id}`)}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={{ flex: 1 }}>
              <Txt size={18} weight="800">
                {p.name}
              </Txt>
              <Txt dim size={13}>
                {p.mode === 'loop' ? 'Loop' : `${p.numWeeks} weeks`} · {daysPerWeek(p)} days{p.mode === 'loop' ? ' per cycle' : '/week'}
              </Txt>
            </View>
            {p.id === activeId && (
              <View style={{ backgroundColor: C.accentDim, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 }}>
                <Txt size={11} weight="800" color={C.accentText}>
                  ACTIVE
                </Txt>
              </View>
            )}
            <Ionicons name="chevron-forward" size={18} color={C.textFaint} />
          </View>
          {p.description ? (
            <Txt dim size={13} numberOfLines={2}>
              {p.description}
            </Txt>
          ) : null}
        </Card>
      ))}

      <SectionTitle>Workout Templates</SectionTitle>
      {templates.length === 0 && (
        <Txt faint size={13}>
          Finish a free-form workout and choose “Save as template” to reuse it here.
        </Txt>
      )}
      {templates.map((t) => (
        <Card key={t.id} style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ flex: 1 }}>
            <Txt weight="700">{t.name}</Txt>
            <Txt dim size={12}>
              {t.exercises.length} exercises
            </Txt>
          </View>
          <IconBtn
            name="trash-outline"
            label={`Delete template ${t.name}`}
            onPress={async () => {
              if (await confirm('Delete template?', t.name, 'Delete', true)) useStore.getState().deleteTemplate(t.id);
            }}
          />
          <Button small title="Start" icon="play" onPress={() => startWorkout(() => useStore.getState().startFromTemplate(t))} />
        </Card>
      ))}
    </Screen>
  );
}
