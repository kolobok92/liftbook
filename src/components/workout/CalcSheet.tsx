import { useState } from 'react';
import { View } from 'react-native';
import { calcPlates, e1rm, fmtNum, parseNum, weightForReps } from '@/lib/calc';
import { useStore } from '@/lib/store';
import { C, R } from '@/lib/theme';
import { Field, Segmented, Sheet, Txt } from '../ui';

const PLATE_COLORS: Record<string, string> = {
  '45': '#3B6FD8',
  '25': '#2FA35A',
  '35': '#E0B23A',
  '10': '#E8E8E8',
  '5': '#C9483F',
  '2.5': '#7A7A7A',
  '20': '#3B6FD8',
  '15': '#E0B23A',
  '1.25': '#9A9A9A',
};

/** Plate calculator + one-rep-max calculator. */
export function CalcSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const settings = useStore((s) => s.settings);
  const unit = settings.unit;
  const [tab, setTab] = useState<'plates' | '1rm'>('plates');
  const [target, setTarget] = useState('');
  const [bar, setBar] = useState(String(settings.barWeight[unit]));
  const [w, setW] = useState('');
  const [reps, setReps] = useState('');

  const t = parseNum(target);
  const b = parseNum(bar) ?? 0;
  const plates = t ? calcPlates(t, b, settings.availablePlates[unit]) : undefined;
  const oneRm = parseNum(w) && parseNum(reps) ? e1rm(parseNum(w)!, parseNum(reps)!) : 0;

  return (
    <Sheet visible={visible} onClose={onClose} title="Calculator">
      <Segmented
        options={[
          { value: 'plates', label: 'Plates' },
          { value: '1rm', label: 'One Rep Max' },
        ]}
        value={tab}
        onChange={setTab}
      />
      {tab === 'plates' ? (
        <>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Field testID="plate-target" label="Target weight" value={target} onChangeText={setTarget} keyboardType="decimal-pad" suffix={unit} />
            </View>
            <View style={{ flex: 1 }}>
              <Field label="Bar" value={bar} onChangeText={setBar} keyboardType="decimal-pad" suffix={unit} />
            </View>
          </View>
          {plates && (
            <View style={{ gap: 10, backgroundColor: C.surface2, borderRadius: R.md, padding: 14 }}>
              <Txt dim size={13}>
                Per side
              </Txt>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 90 }}>
                <View style={{ width: 28, height: 10, backgroundColor: '#9A9A9A', borderRadius: 2 }} />
                {plates.perSide.map((p, i) => {
                  const h = 40 + Math.min(1, p / (unit === 'lb' ? 45 : 20)) * 50;
                  return (
                    <View
                      key={i}
                      style={{ width: 16, height: h, backgroundColor: PLATE_COLORS[String(p)] ?? C.surface3, borderRadius: 3, alignItems: 'center', justifyContent: 'center' }}
                    />
                  );
                })}
                <View style={{ flex: 1, height: 10, backgroundColor: '#9A9A9A', borderRadius: 2 }} />
              </View>
              <Txt testID="plate-result" size={18} weight="700">
                {plates.perSide.length ? plates.perSide.map(fmtNum).join(' + ') : 'Empty bar'}
              </Txt>
              {plates.remainder > 0 && (
                <Txt color={C.orange} size={13}>
                  Closest: {fmtNum(plates.achieved)} {unit} ({fmtNum(plates.remainder)} {unit} short)
                </Txt>
              )}
            </View>
          )}
        </>
      ) : (
        <>
          <Txt dim>Enter a weight and the reps you can do with it to estimate your one rep max.</Txt>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Field testID="orm-weight" label="Weight" value={w} onChangeText={setW} keyboardType="decimal-pad" suffix={unit} />
            </View>
            <View style={{ flex: 1 }}>
              <Field testID="orm-reps" label="Reps" value={reps} onChangeText={setReps} keyboardType="number-pad" />
            </View>
          </View>
          {oneRm > 0 && (
            <View style={{ gap: 8, backgroundColor: C.surface2, borderRadius: R.md, padding: 14 }}>
              <Txt testID="orm-result" size={18} weight="700">
                Your one rep max is {fmtNum(Math.round(oneRm * 10) / 10)} {unit}
              </Txt>
              {[2, 3, 5, 8, 10, 12].map((r) => (
                <View key={r} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Txt dim>{r} reps</Txt>
                  <Txt>
                    {fmtNum(Math.round(weightForReps(oneRm, r)))} {unit}
                  </Txt>
                </View>
              ))}
            </View>
          )}
        </>
      )}
    </Sheet>
  );
}
