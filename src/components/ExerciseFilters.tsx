import { Ionicons } from '@expo/vector-icons';
import { ScrollView, TextInput, View } from 'react-native';
import { ALL_MUSCLES, EQUIPMENT_LABEL, MUSCLE_LABEL } from '@/lib/exercises';
import type { Filters } from '@/lib/exerciseSearch';
import type { Equipment } from '@/lib/types';
import { C } from '@/lib/theme';
import { Chip } from './ui';

export { filterExercises, type Filters } from '@/lib/exerciseSearch';

export function ExerciseFilters({ value, onChange }: { value: Filters; onChange: (f: Filters) => void }) {
  return (
    <View style={{ gap: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.surface2, borderRadius: 10, paddingHorizontal: 12 }}>
        <Ionicons name="search" size={18} color={C.textFaint} />
        <TextInput
          testID="exercise-search"
          accessibilityLabel="Search exercises"
          value={value.q}
          onChangeText={(q) => onChange({ ...value, q })}
          placeholder="Search exercises"
          placeholderTextColor={C.textFaint}
          style={{ flex: 1, color: C.text, fontSize: 16, paddingVertical: 11 }}
          autoCorrect={false}
        />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
        {ALL_MUSCLES.map((m) => (
          <Chip key={m} label={MUSCLE_LABEL[m]} active={value.muscle === m} onPress={() => onChange({ ...value, muscle: value.muscle === m ? undefined : m })} />
        ))}
      </ScrollView>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
        {(Object.keys(EQUIPMENT_LABEL) as Equipment[]).map((eq) => (
          <Chip key={eq} label={EQUIPMENT_LABEL[eq]} active={value.equipment === eq} onPress={() => onChange({ ...value, equipment: value.equipment === eq ? undefined : eq })} />
        ))}
      </ScrollView>
    </View>
  );
}
