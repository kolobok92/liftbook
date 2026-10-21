import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import type { ApplyScope, PendingProgramChange } from '@/lib/programSync';
import { useStore } from '@/lib/store';
import { C, R } from '@/lib/theme';
import { Button, Card, Txt } from './ui';

/**
 * After a program workout, offer to carry its edits (swaps, sets, added/removed exercises,
 * order, supersets) into the program — chosen per exercise.
 */
export function ProgramChangesCard({ pending }: { pending: PendingProgramChange }) {
  const [accepted, setAccepted] = useState<Set<string>>(() => new Set(pending.items.map((i) => i.key)));
  const [result, setResult] = useState<string | null>(null);

  if (result)
    return (
      <Card testID="program-changes-result">
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Ionicons name="checkmark-circle" size={18} color={C.green} />
          <Txt weight="600">{result}</Txt>
        </View>
      </Card>
    );

  const toggle = (key: string) =>
    setAccepted((s) => {
      const next = new Set(s);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const apply = (scope: ApplyScope, label: string) => {
    useStore.getState().applyPendingChange([...accepted], scope);
    setResult(label);
  };
  const none = accepted.size === 0;

  return (
    <Card testID="program-changes">
      <Txt weight="800">Update your program?</Txt>
      <Txt dim size={13}>
        You changed this workout. Choose which changes to keep for next time.
      </Txt>
      <View style={{ gap: 8 }}>
        {pending.items.map((item) => {
          const on = accepted.has(item.key);
          return (
            <Pressable
              key={item.key}
              testID={`change-item-${item.key}`}
              accessibilityRole="checkbox"
              aria-checked={on}
              onPress={() => toggle(item.key)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.surface2, borderRadius: R.md, padding: 12 }}
            >
              <View
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 6,
                  borderWidth: 2,
                  borderColor: on ? C.accent : C.textFaint,
                  backgroundColor: on ? C.accent : 'transparent',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {on && <Ionicons name="checkmark" size={14} color={C.onAccent} />}
              </View>
              <View style={{ flex: 1 }}>
                <Txt weight="600">{item.title}</Txt>
                <Txt dim size={12}>
                  {item.details.join(' · ')}
                </Txt>
              </View>
            </Pressable>
          );
        })}
      </View>
      {pending.periodized ? (
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Button testID="apply-week" style={{ flex: 1 }} small variant="secondary" disabled={none} title={`Week ${pending.week + 1} only`} onPress={() => apply('week', `Updated week ${pending.week + 1}.`)} />
          <Button testID="apply-later" style={{ flex: 1 }} small disabled={none} title="This & later weeks" onPress={() => apply('fromWeek', `Updated week ${pending.week + 1} and later weeks.`)} />
        </View>
      ) : (
        <Button testID="apply-program" disabled={none} title={accepted.size === pending.items.length ? 'Update Program' : `Update Program (${accepted.size})`} onPress={() => apply('template', 'Program updated. Next time starts with these changes.')} />
      )}
      <Button
        testID="keep-oneoff"
        variant="ghost"
        small
        title="Just this workout"
        onPress={() => {
          useStore.getState().dismissPendingChange();
          setResult('Kept as a one-off. Your program is unchanged.');
        }}
      />
    </Card>
  );
}
