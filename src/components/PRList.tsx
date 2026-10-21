import { View } from 'react-native';
import { exerciseName, useExercises } from '@/lib/hooks';
import { PR_LABEL, fmtPR, groupPRs, type PR } from '@/lib/tracking';
import type { Unit } from '@/lib/types';
import { C } from '@/lib/theme';
import { Txt } from './ui';

/** "🏆 Bench Press — 205 lb · Max Weight, Est. 1RM" — one row per exercise. */
export function PRList({ prs, unit }: { prs: PR[]; unit: Unit }) {
  const { byId } = useExercises();
  return (
    <View style={{ gap: 8 }}>
      {groupPRs(prs).map((g) => (
        <View key={g.exerciseId} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={{ flex: 1 }}>
            <Txt numberOfLines={1}>{exerciseName(byId, g.exerciseId)}</Txt>
            <Txt dim size={12}>
              {g.kinds.map((k) => PR_LABEL[k]).join(' · ')}
            </Txt>
          </View>
          <Txt weight="800" color={C.orange}>
            {fmtPR(g.headline, unit)}
          </Txt>
        </View>
      ))}
    </View>
  );
}
