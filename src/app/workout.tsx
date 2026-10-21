import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useRef, useState, type ComponentRef } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NoteField } from '@/components/NoteField';
import { CalcSheet } from '@/components/workout/CalcSheet';
import { Keypad, KeypadSpacer } from '@/components/workout/Keypad';
import { WorkoutEditor } from '@/components/workout/WorkoutEditor';
import { Button, Empty, Txt, confirm, haptic } from '@/components/ui';
import { completedSetCount, fmtDuration, workoutDurationMs } from '@/lib/calc';
import { useTick } from '@/lib/hooks';
import { useStore } from '@/lib/store';
import { C, R, themed } from '@/lib/theme';

export default function WorkoutScreen() {
  const active = useStore((s) => s.active);
  const updateActive = useStore((s) => s.updateActive);
  const program = useStore((s) => s.programs.find((p) => p.id === s.active?.programRef?.programId));
  const programName = program?.name;
  const programMode = program?.mode;
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);
  const scrollY = useRef(0);
  const now = useTick(1000, !!active && !active.pausedAt);
  const [calc, setCalc] = useState(false);

  if (!active) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg, paddingTop: insets.top + 40 }}>
        <Empty icon="barbell-outline" title="No workout in progress">
          <Button title="Close" variant="secondary" onPress={() => router.back()} />
        </Empty>
      </View>
    );
  }

  const done = completedSetCount(active);
  const total = active.exercises.reduce((n, e) => n + e.sets.length, 0);

  const finish = async () => {
    if (done === 0) {
      const ok = await confirm('No sets completed', 'Discard this workout instead?', 'Discard', true);
      if (ok) {
        useStore.getState().discardActive();
        router.back();
      }
      return;
    }
    if (done < total) {
      const ok = await confirm('Finish workout?', `${total - done} set(s) aren't checked off and won't be saved.`, 'Finish');
      if (!ok) return;
    }
    const res = useStore.getState().finishActive();
    if (res) {
      haptic('success');
      router.replace('/workout-summary');
    }
  };

  const discard = async () => {
    const ok = await confirm('Discard workout?', 'Everything logged in this session will be lost.', 'Discard', true);
    if (ok) {
      useStore.getState().discardActive();
      router.back();
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={[styles.top, { paddingTop: insets.top + 6 }]}>
        <Pressable testID="minimize-workout" accessibilityLabel="Minimize workout" onPress={() => router.back()} style={styles.topBtn}>
          <Ionicons name="chevron-down" size={22} color={C.text} />
        </Pressable>
        <Pressable testID="open-calc" onPress={() => setCalc(true)} style={styles.topBtn}>
          <Ionicons name="calculator-outline" size={20} color={C.text} />
          <Txt size={11}>Calc</Txt>
        </Pressable>
        <View style={{ flex: 1 }} />
        <Pressable testID="pause-workout" accessibilityLabel={active.pausedAt ? 'Resume timer' : 'Pause timer'} onPress={() => useStore.getState().togglePause()} style={styles.timer}>
          <Ionicons name={active.pausedAt ? 'play' : 'pause'} size={14} color={C.text} />
          <Txt testID="workout-elapsed" weight="700" style={{ fontVariant: ['tabular-nums'] }}>
            {fmtDuration(workoutDurationMs(active, now))}
          </Txt>
        </Pressable>
        <Pressable testID="finish-workout" accessibilityRole="button" onPress={finish} style={styles.finish}>
          <Txt weight="800" color={C.onAccent}>
            Finish
          </Txt>
        </Pressable>
      </View>

      {/* No keyboard avoidance: set numbers use the in-app keypad, which overlays the list and
          scrolls it only when the edited field would be hidden (Keypad.tsx). Resizing for the
          system keyboard as well made the list jump on every set. */}
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={{ padding: 12, gap: 12, paddingBottom: 60 }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        scrollEventThrottle={16}
        onScroll={(e) => (scrollY.current = e.nativeEvent.contentOffset.y)}
      >
          <View style={{ gap: 4, paddingHorizontal: 4 }}>
            <TextInput
              testID="workout-name"
              value={active.name}
              onChangeText={(t) => updateActive((w) => ({ ...w, name: t }))}
              style={{ color: C.text, fontSize: 24, fontWeight: '800', padding: 0 }}
              accessibilityLabel="Workout name"
            />
            {active.programRef && (
              <Txt dim size={13}>
                {programName ? `${programName} · ` : ''}
                {programMode === 'loop' ? 'Cycle' : 'Week'} {active.programRef.week + 1} · Day {active.programRef.day + 1}
              </Txt>
            )}
            <NoteField testID="workout-note" value={active.notes} onChangeText={(t) => updateActive((w) => ({ ...w, notes: t }))} placeholder="Add notes here" />
            <Txt faint size={12}>
              {done} / {total} sets
            </Txt>
          </View>

          <WorkoutEditor workout={active} update={updateActive} mode="live" />

          <Button testID="discard-workout" title="Discard Workout" variant="danger" onPress={discard} />
          <KeypadSpacer />
      </ScrollView>
      <Keypad scrollRef={scrollRef} scrollY={scrollY} />


      <CalcSheet visible={calc} onClose={() => setCalc(false)} />
    </View>
  );
}

const styles = themed(() => StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingBottom: 8, backgroundColor: C.surface, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border },
  topBtn: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8, paddingVertical: 4, minWidth: 40 },
  timer: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.surface3, paddingVertical: 8, paddingHorizontal: 12, borderRadius: R.sm },
  finish: { backgroundColor: C.accent, paddingVertical: 8, paddingHorizontal: 16, borderRadius: R.sm },
}));
