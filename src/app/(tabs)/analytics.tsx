import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { VolumeBars } from '@/components/Charts';
import { MuscleBars, MuscleMap } from '@/components/MuscleMap';
import { Screen } from '@/components/Screen';
import { Button, Card, H1, Segmented, Txt } from '@/components/ui';
import { inRange, muscleSets, summarize, volumeSeries, weekStreak, type Bucket } from '@/lib/analytics';
import { fmtDate, fmtNum, fmtVolume, startOfWeek } from '@/lib/calc';
import { exerciseName, useExercises, useNow } from '@/lib/hooks';
import { useStore } from '@/lib/store';
import { PR_LABEL, detectPRs, fmtPR } from '@/lib/tracking';
import type { Muscle } from '@/lib/types';
import { C } from '@/lib/theme';

const WEEK = 7 * 24 * 3600 * 1000;

function pctChange(cur: number, prev: number): number | null {
  // No comparison until there's something on both sides (an empty week isn't "-100%").
  if (!prev || !cur) return null;
  return Math.round(((cur - prev) / prev) * 100);
}

export default function Analytics() {
  const history = useStore((s) => s.history);
  const unit = useStore((s) => s.settings.unit);
  const { byId } = useExercises();
  const [tab, setTab] = useState<'muscles' | 'summary'>('muscles');
  const [bucket, setBucket] = useState<Bucket>('weekly');
  const [weekOffset, setWeekOffset] = useState(0);

  const finished = useMemo(() => history.filter((w) => w.endedAt), [history]);
  const lifetime = useMemo(() => summarize(finished), [finished]);
  const streak = useMemo(() => weekStreak(finished), [finished]);

  const now = useNow();
  const thisWeekStart = startOfWeek(now) - weekOffset * WEEK;
  const thisWeek = useMemo(() => inRange(finished, thisWeekStart, thisWeekStart + WEEK), [finished, thisWeekStart]);
  const lastWeek = useMemo(() => inRange(finished, thisWeekStart - WEEK, thisWeekStart), [finished, thisWeekStart]);
  const cur = summarize(thisWeek);
  const prev = summarize(lastWeek);
  const weekPRs = useMemo(() => thisWeek.flatMap((w) => detectPRs(w, history)).slice(0, 8), [thisWeek, history]);
  const muscles = useMemo(() => muscleSets(thisWeek, byId), [thisWeek, byId]);
  const muscleRows = (Object.entries(muscles) as [Muscle, number][]).map(([muscle, value]) => ({ muscle, value })).sort((a, b) => b.value - a.value);
  const series = useMemo(() => volumeSeries(finished, bucket, bucket === 'daily' ? 14 : bucket === 'weekly' ? 12 : 12), [finished, bucket]);

  const weekLabel =
    weekOffset === 0 ? 'This Week' : `${fmtDate(thisWeekStart)} – ${fmtDate(thisWeekStart + WEEK - 1)}`;

  return (
    <Screen>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <H1 style={{ flex: 1 }}>Analytics</H1>
        <Button testID="open-exercises" small variant="secondary" title="Exercises" onPress={() => router.push('/exercises')} />
      </View>

      <Card>
        <Txt weight="700">
          <Ionicons name="time-outline" size={15} color={C.text} /> Lifetime
        </Txt>
        <View style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
          <Big value={String(lifetime.workouts)} label="Workouts" />
          <Big value={fmtNum(lifetime.durationMs < 36_000_000 ? Math.round(lifetime.durationMs / 360000) / 10 : Math.round(lifetime.durationMs / 3600000))} label="Hours" />
          <Big value={fmtVolume(lifetime.volume)} suffix={unit} label="Lifted" />
        </View>
        <View style={{ backgroundColor: C.surface2, borderRadius: 8, paddingVertical: 6, alignItems: 'center' }}>
          <Txt size={13}>
            <Txt color={C.orange} weight="800">
              {streak}
            </Txt>{' '}
            week streak
          </Txt>
        </View>
      </Card>

      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Pressable accessibilityLabel="Previous week" onPress={() => setWeekOffset((o) => o + 1)} hitSlop={8}>
            <Ionicons name="chevron-back" size={18} color={C.text} />
          </Pressable>
          <Txt weight="700" style={{ flex: 1, textAlign: 'center' }}>
            {weekLabel}
          </Txt>
          <Pressable accessibilityLabel="Next week" disabled={weekOffset === 0} onPress={() => setWeekOffset((o) => Math.max(0, o - 1))} hitSlop={8}>
            <Ionicons name="chevron-forward" size={18} color={weekOffset === 0 ? C.textFaint : C.text} />
          </Pressable>
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
          <Big value={String(cur.workouts)} label="Workouts" change={pctChange(cur.workouts, prev.workouts)} plain />
          <Big value={fmtNum(Math.round((cur.durationMs / 3600000) * 10) / 10)} label="Hours" change={pctChange(cur.durationMs, prev.durationMs)} plain />
          <Big value={fmtVolume(cur.volume)} suffix={unit} label="Lifted" change={pctChange(cur.volume, prev.volume)} plain />
        </View>
        <Txt faint size={11} style={{ textAlign: 'center' }}>
          vs. previous week
        </Txt>
        {weekPRs.length > 0 && (
          <View style={{ gap: 6, marginTop: 4 }}>
            <Txt weight="700" size={13}>
              New Personal Records
            </Txt>
            {weekPRs.map((p, i) => (
              <Pressable key={i} onPress={() => router.push(`/exercise/${p.exerciseId}`)} style={{ flexDirection: 'row', gap: 8 }}>
                <Txt size={13} style={{ flex: 1 }} numberOfLines={1}>
                  🏆 {exerciseName(byId, p.exerciseId)}
                </Txt>
                <Txt size={13} dim>
                  {PR_LABEL[p.kind]}
                </Txt>
                <Txt size={13} weight="700">
                  {fmtPR(p, unit)}
                </Txt>
              </Pressable>
            ))}
          </View>
        )}
      </Card>

      <Segmented
        options={[
          { value: 'muscles', label: 'Muscle Tracker' },
          { value: 'summary', label: 'Workout Summary' },
        ]}
        value={tab}
        onChange={setTab}
      />

      {tab === 'muscles' ? (
        <Card>
          <Txt weight="700">Sets per muscle · {weekLabel.toLowerCase()}</Txt>
          <Txt faint size={12}>
            Primary muscles count a full set, secondary muscles half. 10–20 sets per week is a common hypertrophy range.
          </Txt>
          <MuscleMap values={muscles} max={Math.max(10, ...Object.values(muscles))} />
          {muscleRows.length ? (
            <MuscleBars rows={muscleRows} format={(v) => fmtNum(Math.round(v * 10) / 10)} />
          ) : (
            <Txt faint>No sets logged in this week.</Txt>
          )}
        </Card>
      ) : (
        <>
          <Card>
            <Segmented
              options={[
                { value: 'daily', label: 'Daily' },
                { value: 'weekly', label: 'Weekly' },
                { value: 'monthly', label: 'Monthly' },
              ]}
              value={bucket}
              onChange={setBucket}
            />
            <Txt weight="700">Total Training Volume ({unit})</Txt>
            <VolumeBars
              points={series}
              labelFmt={(t) =>
                bucket === 'monthly' ? new Date(t).toLocaleDateString('en-US', { month: 'short' }) : fmtDate(t, { month: 'numeric', day: 'numeric' })
              }
            />
          </Card>
        </>
      )}

    </Screen>
  );
}

function Big({ value, label, suffix, change, plain }: { value: string; label: string; suffix?: string; change?: number | null; plain?: boolean }) {
  return (
    <View style={{ alignItems: 'center', minWidth: 80 }}>
      <Txt size={26} weight="800" color={plain ? C.text : C.orange}>
        {value}
        {suffix ? <Txt size={12} dim>{` ${suffix}`}</Txt> : null}
      </Txt>
      <Txt dim size={12}>
        {label}
      </Txt>
      {change != null && (
        <Txt size={11} weight="700" color={change >= 0 ? C.green : C.red}>
          {change >= 0 ? '▲' : '▼'} {Math.abs(change)}%
        </Txt>
      )}
    </View>
  );
}
