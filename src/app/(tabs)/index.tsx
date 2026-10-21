import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { DayPreview } from '@/components/DayPreview';
import { Screen } from '@/components/Screen';
import { startWorkout } from '@/components/startWorkout';
import { Button, Card, H1, SectionTitle, Sheet, Txt } from '@/components/ui';
import { fmtDate, fmtDurationShort, fmtVolume, workoutDurationMs, workoutVolume } from '@/lib/calc';
import { useNow } from '@/lib/hooks';
import { SKIPPED, nextProgramSlot, useStore } from '@/lib/store';
import { daysPerWeek, programDayAt, slotKey, sortedHistory } from '@/lib/tracking';
import { C, R } from '@/lib/theme';

export default function Home() {
  const now = useNow();
  const programs = useStore((s) => s.programs);
  const activeProgram = useStore((s) => s.activeProgram);
  const history = useStore((s) => s.history);
  const templates = useStore((s) => s.templates);
  const unit = useStore((s) => s.settings.unit);
  const program = programs.find((p) => p.id === activeProgram?.programId);
  const next = program && activeProgram ? nextProgramSlot(program, activeProgram) : undefined;
  const [viewWeek, setViewWeek] = useState<number | null>(null);
  const [preview, setPreview] = useState<{ week: number; day: number } | null>(null);
  const [showPlan, setShowPlan] = useState(false);
  const week = viewWeek ?? next?.week ?? 0;
  const recent = useMemo(() => sortedHistory(history).slice(0, 3), [history]);

  const perWeek = program ? daysPerWeek(program) : 0;
  const isLoop = program?.mode === 'loop';
  const total = program ? perWeek * program.numWeeks : 0;
  const doneCount = activeProgram ? Object.keys(activeProgram.completed).length : 0;
  const nextDay = program && next ? programDayAt(program, next.week, next.day) : undefined;
  const previewDay = program && preview ? programDayAt(program, preview.week, preview.day) : undefined;

  return (
    <Screen>
      <View>
        <Txt dim size={13}>
          {fmtDate(now, { weekday: 'long', month: 'long', day: 'numeric' })}
        </Txt>
        <H1>Today</H1>
      </View>

      {program && activeProgram ? (
        <Card>
          <Pressable onPress={() => router.push(`/program/${program.id}`)} style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ flex: 1 }}>
              <Txt size={12} dim weight="700" style={{ letterSpacing: 0.6 }}>
                CURRENT PROGRAM
              </Txt>
              <Txt size={20} weight="800">
                {program.name}
              </Txt>
            </View>
            <Ionicons name="chevron-forward" size={20} color={C.textDim} />
          </Pressable>
          {isLoop ? (
            <Txt dim size={13}>
              Loop · {perWeek} days · {doneCount} workouts logged
            </Txt>
          ) : (
            <>
              <View style={{ height: 6, backgroundColor: C.surface3, borderRadius: 3, overflow: 'hidden' }}>
                <View style={{ width: `${total ? (doneCount / total) * 100 : 0}%`, height: '100%', backgroundColor: C.accent }} />
              </View>
              <Txt dim size={13}>
                {doneCount} of {total} workouts · {program.numWeeks} weeks
              </Txt>
            </>
          )}

          {!next && (
            <Txt color={C.green} weight="700">
              Program complete — nice work.
            </Txt>
          )}

          {/* Current day, highlighted and expanded: start or skip in one tap (Boostcamp). */}
          {next && nextDay && (
            <View testID="up-next" style={{ backgroundColor: C.surface2, borderRadius: R.md, borderWidth: 1.5, borderColor: C.accent, padding: 14, gap: 10, marginTop: 4 }}>
              <Txt size={12} color={C.accentText} weight="700">
                UP NEXT · {isLoop ? 'CYCLE' : 'WEEK'} {next.week + 1} · DAY {next.day + 1}
              </Txt>
              <Txt size={18} weight="700">
                {nextDay.name}
              </Txt>
              <DayPreview day={nextDay} max={6} />
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Button
                  testID="start-next-workout"
                  style={{ flex: 1 }}
                  title="Start Workout"
                  icon="play"
                  onPress={() => startWorkout(() => useStore.getState().startProgramWorkout(program.id, next.week, next.day))}
                />
                <Button testID="skip-next-workout" variant="secondary" title="Skip" icon="play-skip-forward" onPress={() => useStore.getState().setSlotSkipped(next.week, next.day, true)} />
              </View>
            </View>
          )}

          <Pressable testID="toggle-full-plan" onPress={() => setShowPlan((v) => !v)} hitSlop={6} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 6 }}>
            <Txt size={14} weight="600" color={C.accentText}>
              {showPlan ? 'Hide full plan' : 'View full plan'}
            </Txt>
            <Ionicons name={showPlan ? 'chevron-up' : 'chevron-down'} size={16} color={C.accentText} />
          </Pressable>

          {showPlan && !isLoop && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingVertical: 4 }}>
            {Array.from({ length: program.numWeeks }, (_, w) => (
              <Pressable
                key={w}
                onPress={() => setViewWeek(w)}
                style={{
                  paddingVertical: 6,
                  paddingHorizontal: 12,
                  borderRadius: 999,
                  backgroundColor: w === week ? C.accent : C.surface2,
                }}
              >
                <Txt size={13} weight="700" color={w === week ? C.onAccent : C.textDim}>
                  W{w + 1}
                </Txt>
              </Pressable>
            ))}
          </ScrollView>
          )}
          {showPlan && (
          <View style={{ gap: 6 }}>
            {Array.from({ length: perWeek }, (_, d) => {
              const day = programDayAt(program, week, d);
              const key = slotKey(week, d);
              const status = activeProgram.completed[key];
              const isNext = next?.week === week && next?.day === d;
              return (
                <Pressable
                  key={key}
                  testID={`program-day-${week}-${d}`}
                  onPress={() => setPreview({ week, day: d })}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 12, borderRadius: R.md, backgroundColor: C.surface2, borderWidth: 1.5, borderColor: isNext ? C.accent : 'transparent' }}
                >
                  <Ionicons
                    name={status === SKIPPED ? 'play-skip-forward-circle' : status ? 'checkmark-circle' : 'ellipse-outline'}
                    size={22}
                    color={status === SKIPPED ? C.textFaint : status ? C.green : isNext ? C.accentText : C.textFaint}
                  />
                  <View style={{ flex: 1 }}>
                    <Txt weight="600">
                      Day {d + 1} · {day?.name}
                    </Txt>
                    <Txt dim size={12}>
                      {isNext ? 'Up next · ' : status === SKIPPED ? 'Skipped · ' : status ? 'Done · ' : ''}{day?.exercises.length ?? 0} exercises
                    </Txt>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={C.textFaint} />
                </Pressable>
              );
            })}
          </View>
          )}
        </Card>
      ) : (
        <Card>
          <Txt size={17} weight="700">
            No active program
          </Txt>
          <Txt dim>Pick one of your programs or build a new one to get a guided week-by-week plan.</Txt>
          <Button title="Go to Programs" variant="secondary" onPress={() => router.push('/programs')} />
        </Card>
      )}

      <SectionTitle>Quick Start</SectionTitle>
      <Button
        testID="start-empty-workout"
        title="Start Empty Workout"
        variant="secondary"
        icon="add"
        onPress={() => startWorkout(() => useStore.getState().startEmptyWorkout())}
      />
      {templates.map((t) => (
        <Card key={t.id} onPress={() => startWorkout(() => useStore.getState().startFromTemplate(t))} style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Ionicons name="document-text-outline" size={20} color={C.textDim} />
          <View style={{ flex: 1 }}>
            <Txt weight="700">{t.name}</Txt>
            <Txt dim size={12}>
              {t.exercises.length} exercises · template
            </Txt>
          </View>
          <Ionicons name="play" size={18} color={C.accentText} />
        </Card>
      ))}

      {recent.length > 0 && <SectionTitle>Recent</SectionTitle>}
      {recent.map((w) => (
        // Repeat is a sibling of the row's link, not nested in it: iOS merges a pressable's
        // children into one accessibility element, which hides a nested button.
        <Card key={w.id}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Pressable testID={`recent-${w.id}`} style={{ flex: 1 }} onPress={() => router.push(`/history/${w.id}`)}>
              <Txt weight="700">{w.name}</Txt>
              <Txt dim size={12}>
                {fmtDate(w.startedAt, { weekday: 'short', month: 'short', day: 'numeric' })} · {fmtDurationShort(workoutDurationMs(w))} ·{' '}
                {fmtVolume(workoutVolume(w))} {unit}
              </Txt>
            </Pressable>
            <Button testID="repeat-workout" small variant="secondary" title="Repeat" icon="repeat" onPress={() => startWorkout(() => useStore.getState().startFromWorkout(w))} />
          </View>
        </Card>
      ))}

      <Sheet visible={!!preview} onClose={() => setPreview(null)} title={preview ? `${isLoop ? 'Cycle' : 'Week'} ${preview.week + 1} · Day ${preview.day + 1}` : ''}>
        {previewDay && preview && program && activeProgram && (
          <>
            <Txt size={18} weight="700">
              {previewDay.name}
            </Txt>
            <DayPreview day={previewDay} />
            <Button
              testID="start-preview-workout"
              title="Start This Workout"
              icon="play"
              onPress={() => {
                const p = preview;
                setPreview(null);
                startWorkout(() => useStore.getState().startProgramWorkout(program.id, p.week, p.day));
              }}
            />
            {activeProgram.completed[`${preview.week}-${preview.day}`] ? (
              activeProgram.completed[`${preview.week}-${preview.day}`] === SKIPPED ? (
                <Button
                  variant="ghost"
                  title="Unskip"
                  onPress={() => {
                    useStore.getState().setSlotSkipped(preview.week, preview.day, false);
                    setPreview(null);
                  }}
                />
              ) : (
                <Button
                  variant="secondary"
                  title="View Logged Workout"
                  onPress={() => {
                    const id = activeProgram.completed[`${preview.week}-${preview.day}`];
                    setPreview(null);
                    router.push(`/history/${id}`);
                  }}
                />
              )
            ) : (
              <Button
                variant="ghost"
                title="Skip This Workout"
                onPress={() => {
                  useStore.getState().setSlotSkipped(preview.week, preview.day, true);
                  setPreview(null);
                }}
              />
            )}
          </>
        )}
      </Sheet>
    </Screen>
  );
}
