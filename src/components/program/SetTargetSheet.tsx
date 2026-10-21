import { useState } from 'react';
import { View } from 'react-native';
import { fmtNum, parseNum } from '@/lib/calc';
import type { Intensity, RepTarget, SetTarget } from '@/lib/types';
import { C } from '@/lib/theme';
import { Button, Chip, Field, Sheet, Txt } from '../ui';

type TargetKind = RepTarget['kind'];
type IntensityKind = Intensity['kind'];

const TARGET_KINDS: { value: TargetKind; label: string }[] = [
  { value: 'reps', label: 'Reps' },
  { value: 'range', label: 'Rep Range' },
  { value: 'amrap', label: 'AMRAP' },
  { value: 'time', label: 'Time' },
  { value: 'timeRange', label: 'Time Range' },
];
const INTENSITY_KINDS: { value: IntensityKind; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'rpe', label: 'RPE' },
  { value: 'rpeRange', label: 'RPE Range' },
  { value: 'pct', label: '% of 1RM' },
];

const s = (n: number | undefined) => (n == null ? '' : fmtNum(n));

function fieldsFor(set: SetTarget | undefined) {
  const f = { kind: 'range' as TargetKind, a: '', b: '', ik: 'none' as IntensityKind, ia: '', ib: '' };
  if (!set) return f;
  const t = set.target;
  f.kind = t.kind;
  if (t.kind === 'reps') f.a = s(t.reps);
  else if (t.kind === 'range' || t.kind === 'timeRange') {
    f.a = s(t.min);
    f.b = s(t.max);
  } else if (t.kind === 'amrap') f.a = s(t.min);
  else f.a = s(t.seconds);
  const i = set.intensity;
  f.ik = i.kind;
  if (i.kind === 'rpe') f.ia = s(i.rpe);
  else if (i.kind === 'rpeRange') {
    f.ia = s(i.min);
    f.ib = s(i.max);
  } else if (i.kind === 'pct') f.ia = s(i.pct);
  return f;
}

/** Edit one set's target and intensity, optionally applying to every set of the exercise. */
export function SetTargetSheet({
  visible,
  set,
  onClose,
  onSave,
}: {
  visible: boolean;
  set: SetTarget | undefined;
  onClose: () => void;
  onSave: (t: Pick<SetTarget, 'target' | 'intensity'>, applyAll: boolean) => void;
}) {
  // Fields start from the set being edited; the caller remounts this sheet per set (key).
  const [init] = useState(() => fieldsFor(set));
  const [kind, setKind] = useState<TargetKind>(init.kind);
  const [a, setA] = useState(init.a);
  const [b, setB] = useState(init.b);
  const [ik, setIk] = useState<IntensityKind>(init.ik);
  const [ia, setIa] = useState(init.ia);
  const [ib, setIb] = useState(init.ib);

  const build = (): Pick<SetTarget, 'target' | 'intensity'> | string => {
    const na = parseNum(a);
    const nb = parseNum(b);
    let target: RepTarget;
    switch (kind) {
      case 'reps':
        if (!na) return 'Enter the number of reps.';
        target = { kind, reps: na };
        break;
      case 'range':
      case 'timeRange':
        if (!na || !nb) return 'Enter both ends of the range.';
        target = { kind, min: Math.min(na, nb), max: Math.max(na, nb) };
        break;
      case 'amrap':
        target = { kind, min: na ?? undefined };
        break;
      case 'time':
        if (!na) return 'Enter the number of seconds.';
        target = { kind, seconds: na };
        break;
    }
    const nia = parseNum(ia);
    const nib = parseNum(ib);
    let intensity: Intensity = { kind: 'none' };
    if (ik === 'rpe') {
      if (!nia || nia < 1 || nia > 10) return 'RPE must be between 1 and 10.';
      intensity = { kind: 'rpe', rpe: nia };
    } else if (ik === 'rpeRange') {
      if (!nia || !nib) return 'Enter both RPE values.';
      intensity = { kind: 'rpeRange', min: Math.min(nia, nib), max: Math.max(nia, nib) };
    } else if (ik === 'pct') {
      if (!nia || nia <= 0 || nia > 120) return 'Percentage must be between 1 and 120.';
      intensity = { kind: 'pct', pct: nia };
    }
    return { target, intensity };
  };

  const result = build();
  const error = typeof result === 'string' ? result : undefined;

  return (
    <Sheet visible={visible} onClose={onClose} title="Set Target">
      <Txt dim size={13} weight="600">
        Target
      </Txt>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {TARGET_KINDS.map((k) => (
          <Chip key={k.value} testID={`target-kind-${k.value}`} label={k.label} active={kind === k.value} onPress={() => setKind(k.value)} />
        ))}
      </View>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        {kind === 'reps' && <View style={{ flex: 1 }}><Field testID="target-a" label="Reps" value={a} onChangeText={setA} keyboardType="number-pad" /></View>}
        {kind === 'amrap' && <View style={{ flex: 1 }}><Field testID="target-a" label="Minimum reps (optional)" value={a} onChangeText={setA} keyboardType="number-pad" /></View>}
        {kind === 'time' && <View style={{ flex: 1 }}><Field testID="target-a" label="Seconds" value={a} onChangeText={setA} keyboardType="number-pad" /></View>}
        {(kind === 'range' || kind === 'timeRange') && (
          <>
            <View style={{ flex: 1 }}>
              <Field testID="target-a" label={kind === 'range' ? 'Min reps' : 'Min sec'} value={a} onChangeText={setA} keyboardType="number-pad" />
            </View>
            <View style={{ flex: 1 }}>
              <Field testID="target-b" label={kind === 'range' ? 'Max reps' : 'Max sec'} value={b} onChangeText={setB} keyboardType="number-pad" />
            </View>
          </>
        )}
      </View>

      <Txt dim size={13} weight="600">
        Intensity
      </Txt>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {INTENSITY_KINDS.map((k) => (
          <Chip key={k.value} testID={`intensity-kind-${k.value}`} label={k.label} active={ik === k.value} onPress={() => setIk(k.value)} />
        ))}
      </View>
      {ik !== 'none' && (
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <View style={{ flex: 1 }}>
            <Field testID="intensity-a" label={ik === 'pct' ? '% of 1RM' : ik === 'rpe' ? 'RPE' : 'Min RPE'} value={ia} onChangeText={setIa} keyboardType="decimal-pad" />
          </View>
          {ik === 'rpeRange' && (
            <View style={{ flex: 1 }}>
              <Field testID="intensity-b" label="Max RPE" value={ib} onChangeText={setIb} keyboardType="decimal-pad" />
            </View>
          )}
        </View>
      )}
      {ik === 'pct' && (
        <Txt faint size={12}>
          Weight is calculated from the 1RM you enter under Rep Maxes, or your best estimated 1RM if you haven’t entered one.
        </Txt>
      )}
      {error && (
        <Txt size={13} color={C.red}>
          {error}
        </Txt>
      )}
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Button style={{ flex: 1 }} variant="secondary" title="This Set" disabled={!!error} onPress={() => typeof result !== 'string' && onSave(result, false)} />
        <Button testID="target-apply-all" style={{ flex: 1 }} title="All Sets" disabled={!!error} onPress={() => typeof result !== 'string' && onSave(result, true)} />
      </View>
    </Sheet>
  );
}
