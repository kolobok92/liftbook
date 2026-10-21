import { Pressable, View } from 'react-native';
import { RPE_LABELS, fmtNum } from '@/lib/calc';
import { C, R } from '@/lib/theme';
import { Button, Segmented, Sheet, Txt } from '../ui';
import { useState } from 'react';

const VALUES = [6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10];

/** RPE keypad. Shows RIR equivalents on the second tab. */
export function RpeSheet({ visible, value, onPick, onClose }: { visible: boolean; value: number | null; onPick: (v: number | null) => void; onClose: () => void }) {
  const [mode, setMode] = useState<'rpe' | 'rir'>('rpe');
  return (
    <Sheet visible={visible} onClose={onClose} title="Rate of Perceived Exertion">
      <Segmented
        options={[
          { value: 'rpe', label: 'RPE' },
          { value: 'rir', label: 'RIR' },
        ]}
        value={mode}
        onChange={setMode}
      />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {VALUES.map((v) => {
          const selected = value === v;
          const rir = 10 - v;
          return (
            <Pressable
              key={v}
              testID={`rpe-${v}`}
              accessibilityRole="button"
              accessibilityLabel={`RPE ${v}`}
              onPress={() => onPick(v)}
              style={{
                width: '31.5%',
                paddingVertical: 12,
                borderRadius: R.md,
                alignItems: 'center',
                backgroundColor: selected ? C.accent : C.surface3,
              }}
            >
              <Txt size={20} weight="800" color={selected ? C.onAccent : C.text}>
                {mode === 'rpe' ? fmtNum(v) : `${fmtNum(rir)}`}
              </Txt>
              <Txt size={11} color={selected ? C.onAccent : C.textDim}>
                {mode === 'rpe' ? RPE_LABELS[String(v)] : rir === 0 ? 'No reps left' : `${fmtNum(rir)} in reserve`}
              </Txt>
            </Pressable>
          );
        })}
      </View>
      <Button title="Clear" variant="secondary" onPress={() => onPick(null)} />
    </Sheet>
  );
}
