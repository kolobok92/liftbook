import { Image } from 'expo-image';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { exerciseDetails, exerciseImageUrl } from '@/lib/exercises';
import { C, R } from '@/lib/theme';
import { Card, Txt } from './ui';

/** Start/end photos and steps for library exercises that have them (free-exercise-db). */
export function HowTo({ exerciseId }: { exerciseId: string }) {
  const [allSteps, setAllSteps] = useState(false);
  const d = exerciseDetails(exerciseId);
  if (!d || (!d.images.length && !d.instructions.length)) return null;
  const steps = allSteps ? d.instructions : d.instructions.slice(0, 3);
  return (
    <Card testID="how-to">
      <Txt weight="700">How to</Txt>
      {d.images.length > 0 && (
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {d.images.slice(0, 2).map((p) => (
            <Image
              key={p}
              source={{ uri: exerciseImageUrl(p) }}
              // Disk cache: photos load instantly (and offline) after the first view.
              cachePolicy="disk"
              contentFit="cover"
              transition={150}
              accessibilityLabel="Exercise demonstration"
              style={{ flex: 1, aspectRatio: 4 / 3, borderRadius: R.md, backgroundColor: C.surface2 }}
            />
          ))}
        </View>
      )}
      {steps.map((s, i) => (
        <View key={i} style={{ flexDirection: 'row', gap: 10 }}>
          <Txt dim weight="700" style={{ width: 18, lineHeight: 20 }}>
            {i + 1}.
          </Txt>
          <Txt size={14} style={{ flex: 1, lineHeight: 20 }}>
            {s}
          </Txt>
        </View>
      ))}
      {d.instructions.length > 3 && (
        <Pressable testID="how-to-toggle" onPress={() => setAllSteps((v) => !v)} hitSlop={6}>
          <Txt size={13} weight="600" color={C.accentText}>
            {allSteps ? 'Show less' : `Show all ${d.instructions.length} steps`}
          </Txt>
        </Pressable>
      )}
    </Card>
  );
}
