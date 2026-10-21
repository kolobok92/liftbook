import { router, Stack } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, View } from 'react-native';
import { ExerciseFilters, filterExercises, type Filters } from '@/components/ExerciseFilters';
import { Txt } from '@/components/ui';
import { e1rm, fmtDate, fmtNum } from '@/lib/calc';
import { EQUIPMENT_LABEL, MUSCLE_LABEL } from '@/lib/exercises';
import { useExercises } from '@/lib/hooks';
import { useStore } from '@/lib/store';
import { C } from '@/lib/theme';

/** Exercise library with last-performed info. */
export default function Exercises() {
  const { list } = useExercises();
  const history = useStore((s) => s.history);
  const unit = useStore((s) => s.settings.unit);
  const [filters, setFilters] = useState<Filters>({ q: '' });
  const [loggedOnly, setLoggedOnly] = useState(false);

  const stats = useMemo(() => {
    const m = new Map<string, { last: number; count: number; best: number }>();
    for (const w of history) {
      if (!w.endedAt) continue;
      for (const e of w.exercises) {
        const cur = m.get(e.exerciseId) ?? { last: 0, count: 0, best: 0 };
        cur.last = Math.max(cur.last, w.startedAt);
        cur.count++;
        for (const s of e.sets) if (s.done && s.type !== 'warmup' && s.weight && s.reps) cur.best = Math.max(cur.best, e1rm(s.weight, s.reps));
        m.set(e.exerciseId, cur);
      }
    }
    return m;
  }, [history]);

  // Logged exercises first (most recent on top), then the rest alphabetically.
  const results = useMemo(
    () =>
      filterExercises(list, filters)
        .filter((e) => !loggedOnly || stats.has(e.id))
        .sort((a, b) => (stats.get(b.id)?.last ?? 0) - (stats.get(a.id)?.last ?? 0)),
    [list, filters, loggedOnly, stats],
  );

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Pressable style={{ paddingHorizontal: 12 }} onPress={() => router.push('/exercise/new')} hitSlop={8}>
              <Txt color={C.accentText} weight="700">
                New
              </Txt>
            </Pressable>
          ),
        }}
      />
      <View style={{ padding: 12, gap: 8 }}>
        <ExerciseFilters value={filters} onChange={setFilters} />
        <Pressable onPress={() => setLoggedOnly((v) => !v)} style={{ alignSelf: 'flex-start' }}>
          <Txt size={13} color={loggedOnly ? C.accentText : C.textDim} weight="600">
            {loggedOnly ? '✓ ' : ''}Only exercises I’ve logged
          </Txt>
        </Pressable>
      </View>
      <FlatList
        data={results}
        keyExtractor={(e) => e.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 40 }}
        renderItem={({ item }) => {
          const s = stats.get(item.id);
          return (
            <Pressable onPress={() => router.push(`/exercise/${item.id}`)} style={{ paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: C.border, gap: 2 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                <Txt weight="600" style={{ flex: 1 }}>
                  {item.name}
                </Txt>
                {s && s.best > 0 && (
                  <Txt size={13} color={C.orange}>
                    e1RM {fmtNum(Math.round(s.best))} {unit}
                  </Txt>
                )}
              </View>
              <Txt dim size={12}>
                {[item.primary.map((m) => MUSCLE_LABEL[m]).join(', '), EQUIPMENT_LABEL[item.equipment]].filter(Boolean).join(' · ')}
                {s ? ` · ${s.count}× · last ${fmtDate(s.last)}` : ''}
              </Txt>
            </Pressable>
          );
        }}
      />
    </View>
  );
}
