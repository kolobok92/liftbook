import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Screen } from '@/components/Screen';
import { WorkoutCard } from '@/components/WorkoutCard';
import { Card, Empty, H1, Txt } from '@/components/ui';
import { startOfDay } from '@/lib/calc';
import { useNow } from '@/lib/hooks';
import { useStore } from '@/lib/store';
import { detectPRs, sortedHistory } from '@/lib/tracking';
import { C } from '@/lib/theme';

const DOW = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

export default function History() {
  const history = useStore((s) => s.history);
  const unit = useStore((s) => s.settings.unit);
  const sorted = useMemo(() => sortedHistory(history), [history]);
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1).getTime();
  });
  const [day, setDay] = useState<number | null>(null);

  const byDay = useMemo(() => {
    const m = new Map<number, number>();
    for (const w of sorted) m.set(startOfDay(w.startedAt), (m.get(startOfDay(w.startedAt)) ?? 0) + 1);
    return m;
  }, [sorted]);

  const prCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const w of sorted.slice(0, 60)) m.set(w.id, detectPRs(w, history).length);
    return m;
  }, [sorted, history]);

  const md = new Date(month);
  const firstDow = (md.getDay() + 6) % 7;
  const daysInMonth = new Date(md.getFullYear(), md.getMonth() + 1, 0).getDate();
  const cells: (number | null)[] = [...Array(firstDow).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => new Date(md.getFullYear(), md.getMonth(), i + 1).getTime())];
  const monthCount = sorted.filter((w) => w.startedAt >= month && w.startedAt < new Date(md.getFullYear(), md.getMonth() + 1, 1).getTime()).length;
  const today = startOfDay(useNow());

  const list = day != null ? sorted.filter((w) => startOfDay(w.startedAt) === day) : sorted;

  // Group list by month heading.
  const groups: { title: string; items: typeof list }[] = [];
  for (const w of list) {
    const title = new Date(w.startedAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    if (groups[groups.length - 1]?.title !== title) groups.push({ title, items: [] });
    groups[groups.length - 1].items.push(w);
  }

  const shiftMonth = (d: number) => {
    setDay(null);
    setMonth(new Date(md.getFullYear(), md.getMonth() + d, 1).getTime());
  };

  return (
    <Screen>
      <H1>History</H1>
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Pressable accessibilityLabel="Previous month" onPress={() => shiftMonth(-1)} hitSlop={8} style={{ padding: 4 }}>
            <Ionicons name="chevron-back" size={20} color={C.text} />
          </Pressable>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Txt weight="700">{md.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</Txt>
            <Txt dim size={12}>
              {monthCount} workout{monthCount === 1 ? '' : 's'}
            </Txt>
          </View>
          <Pressable accessibilityLabel="Next month" onPress={() => shiftMonth(1)} hitSlop={8} style={{ padding: 4 }}>
            <Ionicons name="chevron-forward" size={20} color={C.text} />
          </Pressable>
        </View>
        <View style={{ flexDirection: 'row' }}>
          {DOW.map((d, i) => (
            <Txt key={i} faint size={12} style={{ flex: 1, textAlign: 'center' }}>
              {d}
            </Txt>
          ))}
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          {cells.map((t, i) => {
            if (t == null) return <View key={i} style={{ width: `${100 / 7}%`, height: 40 }} />;
            const n = byDay.get(t) ?? 0;
            const selected = day === t;
            return (
              <Pressable key={i} onPress={() => setDay(selected ? null : n ? t : null)} style={{ width: `${100 / 7}%`, height: 40, alignItems: 'center', justifyContent: 'center' }}>
                <View
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 16,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: selected ? C.accent : n ? C.accentDim : 'transparent',
                    borderWidth: t === today ? 1 : 0,
                    borderColor: C.textDim,
                  }}
                >
                  <Txt size={13} weight={n ? '700' : '400'} color={selected ? C.onAccent : n ? C.accentText : C.textDim}>
                    {new Date(t).getDate()}
                  </Txt>
                </View>
              </Pressable>
            );
          })}
        </View>
        {day != null && (
          <Pressable onPress={() => setDay(null)}>
            <Txt size={13} color={C.accentText}>
              Showing {new Date(day).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · Show all
            </Txt>
          </Pressable>
        )}
      </Card>

      {sorted.length === 0 && <Empty icon="calendar-outline" title="No workouts yet" body="Finished workouts show up here." />}
      {groups.map((g) => (
        <View key={g.title} style={{ gap: 10 }}>
          <Txt dim size={13} weight="700" style={{ marginTop: 4 }}>
            {g.title.toUpperCase()}
          </Txt>
          {g.items.map((w) => (
            <WorkoutCard key={w.id} w={w} unit={unit} prCount={prCounts.get(w.id)} />
          ))}
        </View>
      ))}
    </Screen>
  );
}
