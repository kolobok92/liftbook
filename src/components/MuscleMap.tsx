import { View } from 'react-native';
import Body, { type ExtendedBodyPart, type Slug } from 'react-native-body-highlighter';
import { MUSCLE_LABEL } from '@/lib/exercises';
import type { Muscle } from '@/lib/types';
import { C } from '@/lib/theme';
import { Txt } from './ui';

const SLUG: Record<Muscle, Slug> = {
  chest: 'chest',
  frontDelts: 'deltoids',
  sideDelts: 'deltoids',
  rearDelts: 'deltoids',
  triceps: 'triceps',
  biceps: 'biceps',
  forearms: 'forearm',
  lats: 'upper-back',
  upperBack: 'upper-back',
  traps: 'trapezius',
  lowerBack: 'lower-back',
  abs: 'abs',
  obliques: 'obliques',
  quads: 'quadriceps',
  hamstrings: 'hamstring',
  glutes: 'gluteal',
  calves: 'calves',
  adductors: 'adductors',
  abductors: 'gluteal',
};

/** Low → high shading levels (index = intensity - 1). */
const LEVELS = ['#5A4710', '#9C7A12', '#D9A514', '#FFC21A'];

/**
 * Front/back body heat map. `values` is any per-muscle quantity (sets, % share);
 * shading is relative to the largest value, or to `max` when given (e.g. a weekly set target).
 */
export function MuscleMap({ values, max, scale = 0.62 }: { values: Partial<Record<Muscle, number>>; max?: number; scale?: number }) {
  const bySlug = new Map<Slug, number>();
  for (const [m, v] of Object.entries(values) as [Muscle, number][]) {
    if (!v) continue;
    const slug = SLUG[m];
    bySlug.set(slug, Math.max(bySlug.get(slug) ?? 0, v));
  }
  const top = max ?? Math.max(0, ...bySlug.values());
  const data: ExtendedBodyPart[] = [...bySlug.entries()].map(([slug, v]) => ({
    slug,
    intensity: Math.max(1, Math.min(LEVELS.length, Math.ceil((v / (top || 1)) * LEVELS.length))),
  }));
  const common = { data, colors: LEVELS, scale, border: 'none' as const, defaultFill: C.surface3 };
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 4 }}>
      <Body {...common} side="front" />
      <Body {...common} side="back" />
    </View>
  );
}

/** Horizontal bar list, e.g. "Triceps ▇▇▇ 13.8%". */
export function MuscleBars({ rows, format }: { rows: { muscle: Muscle; value: number }[]; format: (v: number) => string }) {
  const top = Math.max(1e-9, ...rows.map((r) => r.value));
  return (
    <View style={{ gap: 8 }}>
      {rows.map((r) => (
        <View key={r.muscle} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Txt size={13} style={{ width: 96 }} numberOfLines={1}>
            {MUSCLE_LABEL[r.muscle]}
          </Txt>
          <View style={{ flex: 1, height: 8, backgroundColor: C.surface3, borderRadius: 4, overflow: 'hidden' }}>
            <View style={{ width: `${(r.value / top) * 100}%`, height: '100%', backgroundColor: C.accent, borderRadius: 4 }} />
          </View>
          <Txt size={13} dim style={{ width: 48, textAlign: 'right' }}>
            {format(r.value)}
          </Txt>
        </View>
      ))}
    </View>
  );
}
