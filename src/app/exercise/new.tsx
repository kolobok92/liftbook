import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Screen } from '@/components/Screen';
import { Button, Chip, Field, Txt, notify } from '@/components/ui';
import { ALL_MUSCLES, EQUIPMENT_LABEL, MUSCLE_LABEL, slugify } from '@/lib/exercises';
import { useExercises } from '@/lib/hooks';
import { useStore } from '@/lib/store';
import type { Equipment, Muscle } from '@/lib/types';

export default function NewExercise() {
  const params = useLocalSearchParams<{ name?: string }>();
  const { list } = useExercises();
  const [name, setName] = useState(params.name ?? '');
  const [equipment, setEquipment] = useState<Equipment>('other');
  const [primary, setPrimary] = useState<Muscle[]>([]);
  const [secondary, setSecondary] = useState<Muscle[]>([]);
  const [kind, setKind] = useState<'weight' | 'bodyweight' | 'timed'>('weight');

  const toggle = (arr: Muscle[], set: (m: Muscle[]) => void, m: Muscle) => set(arr.includes(m) ? arr.filter((x) => x !== m) : [...arr, m]);

  const save = () => {
    const n = name.trim();
    if (!n) return notify('Name required', 'Give the exercise a name.');
    if (list.some((e) => e.name.toLowerCase() === n.toLowerCase())) return notify('Already exists', `"${n}" is already in the exercise list.`);
    useStore.getState().saveCustomExercise({
      id: `custom-${slugify(n)}`,
      name: n,
      equipment,
      primary,
      secondary: secondary.filter((m) => !primary.includes(m)),
      bodyweight: kind === 'bodyweight' || undefined,
      timed: kind === 'timed' || undefined,
      custom: true,
    });
    router.back();
  };

  return (
    <Screen header>
      <Field testID="custom-name" label="Name" value={name} onChangeText={setName} placeholder="e.g. Cable Y-Raise" />
      <Txt dim weight="600" size={13}>
        Tracks
      </Txt>
      <View style={{ flexDirection: 'row', gap: 6 }}>
        <Chip label="Weight & reps" active={kind === 'weight'} onPress={() => setKind('weight')} />
        <Chip label="Bodyweight reps" active={kind === 'bodyweight'} onPress={() => setKind('bodyweight')} />
        <Chip label="Time" active={kind === 'timed'} onPress={() => setKind('timed')} />
      </View>
      <Txt dim weight="600" size={13}>
        Equipment
      </Txt>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {(Object.keys(EQUIPMENT_LABEL) as Equipment[]).map((e) => (
          <Chip key={e} label={EQUIPMENT_LABEL[e]} active={equipment === e} onPress={() => setEquipment(e)} />
        ))}
      </View>
      <Txt dim weight="600" size={13}>
        Primary muscles
      </Txt>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {ALL_MUSCLES.map((m) => (
          <Chip key={m} label={MUSCLE_LABEL[m]} active={primary.includes(m)} onPress={() => toggle(primary, setPrimary, m)} />
        ))}
      </View>
      <Txt dim weight="600" size={13}>
        Secondary muscles
      </Txt>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {ALL_MUSCLES.filter((m) => !primary.includes(m)).map((m) => (
          <Chip key={m} label={MUSCLE_LABEL[m]} active={secondary.includes(m)} onPress={() => toggle(secondary, setSecondary, m)} />
        ))}
      </View>
      <Button testID="save-custom-exercise" title="Save Exercise" onPress={save} />
    </Screen>
  );
}
