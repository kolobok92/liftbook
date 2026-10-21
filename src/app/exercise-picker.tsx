import { Ionicons } from '@expo/vector-icons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Keyboard, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ExerciseFilters, filterExercises, type Filters } from '@/components/ExerciseFilters';
import { Button, Txt } from '@/components/ui';
import { EQUIPMENT_LABEL, MUSCLE_LABEL } from '@/lib/exercises';
import { useExercises } from '@/lib/hooks';
import { usePickerResults } from '@/lib/picker';
import { useStore } from '@/lib/store';
import { C } from '@/lib/theme';

export default function ExercisePicker() {
  const { list } = useExercises();
  const history = useStore((s) => s.history);
  const insets = useSafeAreaInsets();
  // Opened via useExercisePicker(): `req` identifies the opener's pending request.
  const { req, multi: multiParam } = useLocalSearchParams<{ req?: string; multi?: string }>();
  const multi = multiParam !== '0';
  const [filters, setFilters] = useState<Filters>({ q: '' });
  const [selected, setSelected] = useState<string[]>([]);

  // Most recently used exercises float to the top when not searching.
  const lastUsed = useMemo(() => {
    const m = new Map<string, number>();
    for (const w of history) for (const e of w.exercises) m.set(e.exerciseId, Math.max(m.get(e.exerciseId) ?? 0, w.startedAt));
    return m;
  }, [history]);

  const results = useMemo(() => {
    const r = filterExercises(list, filters);
    if (!filters.q && !filters.muscle && !filters.equipment) {
      const recent = r.filter((e) => lastUsed.has(e.id)).sort((a, b) => lastUsed.get(b.id)! - lastUsed.get(a.id)!).slice(0, 8);
      const ids = new Set(recent.map((e) => e.id));
      return [...recent.map((e) => ({ ...e, recent: true })), ...r.filter((e) => !ids.has(e.id))];
    }
    return r;
  }, [list, filters, lastUsed]);

  const done = (ids: string[]) => {
    if (req && ids.length) usePickerResults.getState().deliver(req, ids);
    router.back();
  };

  const toggle = (id: string) => {
    if (!multi) return done([id]);
    // Reveal the Add button (the iOS keyboard covers the bottom of this sheet).
    Keyboard.dismiss();
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <Stack.Screen
        options={{
          title: multi ? 'Add Exercises' : 'Replace Exercise',
          headerLeft: () => (
            <Pressable style={{ paddingHorizontal: 12 }} onPress={() => done([])} hitSlop={8}>
              <Txt color={C.accentText}>Cancel</Txt>
            </Pressable>
          ),
          headerRight: () => (
            <Pressable
              testID="new-custom-exercise"
              style={{ paddingHorizontal: 12 }}
              hitSlop={8}
              onPress={() => {
                router.push({ pathname: '/exercise/new', params: { name: filters.q } });
              }}
            >
              <Txt color={C.accentText}>New</Txt>
            </Pressable>
          ),
        }}
      />
      <View style={{ padding: 12 }}>
        <ExerciseFilters value={filters} onChange={setFilters} />
      </View>
      <FlatList
        data={results}
        keyExtractor={(e) => e.id}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 24 }}
        renderItem={({ item, index }) => {
          const on = selected.includes(item.id);
          const showRecentHeader = 'recent' in item && index === 0;
          const showAllHeader = !('recent' in item) && index > 0 && 'recent' in results[index - 1];
          return (
            <>
              {showRecentHeader && (
                <Txt dim size={12} weight="700" style={{ marginVertical: 6 }}>
                  RECENT
                </Txt>
              )}
              {showAllHeader && (
                <Txt dim size={12} weight="700" style={{ marginVertical: 6 }}>
                  ALL EXERCISES
                </Txt>
              )}
              <Pressable
                testID={`pick-${item.id}`}
                onPress={() => toggle(item.id)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: C.border }}
              >
                <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: on ? C.accent : C.surface2, alignItems: 'center', justifyContent: 'center' }}>
                  {on ? <Ionicons name="checkmark" size={20} color={C.onAccent} /> : <Txt weight="800">{item.name[0]}</Txt>}
                </View>
                <View style={{ flex: 1 }}>
                  <Txt weight="600">{item.name}</Txt>
                  <Txt dim size={12}>
                    {[item.primary.map((m) => MUSCLE_LABEL[m]).join(', '), EQUIPMENT_LABEL[item.equipment]].filter(Boolean).join(' · ')}
                    {item.custom ? ' · Custom' : ''}
                  </Txt>
                </View>
              </Pressable>
            </>
          );
        }}
      />
      {multi && selected.length > 0 && (
        <View style={{ paddingHorizontal: 12, paddingTop: 8, paddingBottom: Math.max(insets.bottom, 12) }}>
          <Button testID="picker-add" title={`Add ${selected.length} Exercise${selected.length > 1 ? 's' : ''}`} onPress={() => done(selected)} />
        </View>
      )}
    </View>
  );
}
