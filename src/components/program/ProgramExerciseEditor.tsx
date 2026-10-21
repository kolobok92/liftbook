import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { setLabels, fmtIntensity, fmtTargetLong, newSetTarget } from '@/lib/calc';
import { exerciseName, useExercises } from '@/lib/hooks';
import type { ProgramExercise, SetType } from '@/lib/types';
import { C, R, SET_TYPE_COLOR, themed } from '@/lib/theme';
import { Txt } from '../ui';

const NEXT_TYPE: Record<SetType, SetType> = { normal: 'warmup', warmup: 'drop', drop: 'failure', failure: 'normal' };

/** One exercise inside a program day: instructions, sets with targets, and actions. */
export function ProgramExerciseEditor({
  pe,
  index,
  supersetLabel,
  onChange,
  onEditSet,
  onMenu,
}: {
  pe: ProgramExercise;
  index: number;
  supersetLabel?: string;
  onChange: (pe: ProgramExercise) => void;
  onEditSet: (setIndex: number) => void;
  onMenu: () => void;
}) {
  const { byId } = useExercises();
  return (
    <View style={[styles.card, supersetLabel ? styles.superset : null]} testID={`builder-exercise-${index}`}>
      {supersetLabel && (
        <Txt size={11} weight="800" color={C.accentText}>
          {supersetLabel}
        </Txt>
      )}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Txt weight="700" style={{ flex: 1 }} numberOfLines={1}>
          {index + 1}. {exerciseName(byId, pe.exerciseId)}
        </Txt>
        <Pressable testID={`builder-exercise-menu-${index}`} accessibilityLabel="Exercise options" hitSlop={8} onPress={onMenu}>
          <Ionicons name="ellipsis-horizontal" size={20} color={C.textDim} />
        </Pressable>
      </View>
      <TextInput
        value={pe.notes}
        onChangeText={(notes) => onChange({ ...pe, notes })}
        placeholder="Instructions (cues, tempo, rest…)"
        placeholderTextColor={C.textFaint}
        multiline
        style={styles.notes}
      />
      {pe.sets.map((s, i) => (
        <View key={s.id} style={styles.setRow}>
          <Pressable
            accessibilityLabel={`Set ${i + 1} type`}
            onPress={() => onChange({ ...pe, sets: pe.sets.map((x, j) => (j === i ? { ...x, type: NEXT_TYPE[x.type] } : x)) })}
            style={[styles.badge, s.type !== 'normal' && { backgroundColor: SET_TYPE_COLOR[s.type] + '33' }]}
          >
            <Txt size={12} weight="800" color={s.type === 'normal' ? C.textDim : SET_TYPE_COLOR[s.type]}>
              {setLabels(pe.sets)[i]}
            </Txt>
          </Pressable>
          <Pressable testID={`builder-set-${index}-${i}`} onPress={() => onEditSet(i)} style={styles.target}>
            <Txt weight="600">{fmtTargetLong(s.target)}</Txt>
            {s.intensity.kind !== 'none' && <Txt dim>{fmtIntensity(s.intensity)}</Txt>}
            <View style={{ flex: 1 }} />
            <Ionicons name="create-outline" size={16} color={C.textFaint} />
          </Pressable>
          <Pressable
            accessibilityLabel={`Remove set ${i + 1}`}
            hitSlop={6}
            onPress={() => onChange({ ...pe, sets: pe.sets.filter((_, j) => j !== i) })}
            style={{ padding: 4 }}
          >
            <Ionicons name="remove-circle-outline" size={20} color={C.textFaint} />
          </Pressable>
        </View>
      ))}
      <Pressable
        testID={`builder-add-set-${index}`}
        onPress={() => {
          const last = pe.sets[pe.sets.length - 1];
          const next = last ? { ...last, id: newSetTarget().id, type: last.type === 'warmup' ? ('normal' as const) : last.type } : newSetTarget();
          onChange({ ...pe, sets: [...pe.sets, next] });
        }}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4 }}
      >
        <Ionicons name="add-circle-outline" size={18} color={C.text} />
        <Txt weight="600">Add Set</Txt>
      </Pressable>
    </View>
  );
}

const styles = themed(() => StyleSheet.create({
  card: { backgroundColor: C.surface2, borderRadius: R.md, padding: 12, gap: 8 },
  superset: { borderLeftWidth: 3, borderLeftColor: C.accent },
  notes: { color: C.textDim, fontSize: 13, padding: 0, fontStyle: 'italic' },
  setRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  badge: { width: 26, height: 26, borderRadius: 6, alignItems: 'center', justifyContent: 'center', backgroundColor: C.surface3 },
  target: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.surface3, borderRadius: R.sm, paddingVertical: 8, paddingHorizontal: 10 },
}));
