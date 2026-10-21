import { router } from 'expo-router';
import { View } from 'react-native';
import { Screen } from '@/components/Screen';
import { AppSwitch, Card, Chip, Divider, H1, MenuItem, SectionTitle, Segmented, Txt, confirm, notify } from '@/components/ui';
import { NumInput } from '@/components/workout/NumInput';
import { exportCsv, importCsv } from '@/lib/csv';
import { pickTextFile, saveTextFile } from '@/lib/files';
import { useExercises } from '@/lib/hooks';
import { useStore } from '@/lib/store';
import { makeBackup, parseBackup } from '@/lib/persistence';
import type { ActiveProgram, Exercise, Program, Template, Unit, Workout } from '@/lib/types';

export default function Profile() {
  const settings = useStore((s) => s.settings);
  const historyCount = useStore((s) => s.history.length);
  const { list, byId } = useExercises();
  const unit = settings.unit;

  const importFile = async () => {
    try {
      const file = await pickTextFile(['text/csv', 'text/comma-separated-values', 'text/plain', 'application/vnd.ms-excel', '*/*']);
      if (!file) return;
      const res = importCsv(file.text, list, unit);
      if (res.error) return notify('Import failed', res.error);
      if (res.workouts.length === 0) return notify('Nothing to import', 'No workouts were found in that file.');
      const ok = await confirm(
        'Import workouts?',
        `${res.workouts.length} workouts · ${res.setCount} sets` +
          (res.newExercises.length ? `\n${res.newExercises.length} unrecognized exercise names will be added as custom exercises.` : '') +
          (res.skippedRows ? `\n${res.skippedRows} rows were skipped (missing date or exercise).` : ''),
        'Import',
      );
      if (!ok) return;
      const added = useStore.getState().importWorkouts(res.workouts, res.newExercises);
      notify('Imported', `${added} workouts added${added < res.workouts.length ? ` (${res.workouts.length - added} already in your history were skipped)` : ''}.`);
    } catch (e) {
      notify('Import failed', String(e));
    }
  };

  const exportHistory = async () => {
    try {
      await saveTextFile(`liftbook-history-${new Date().toISOString().slice(0, 10)}.csv`, exportCsv(useStore.getState().history, byId), 'text/csv');
    } catch (e) {
      notify('Export failed', String(e));
    }
  };

  const backup = async () => {
    const st = useStore.getState();
    const data = makeBackup({
      programs: st.programs,
      activeProgram: st.activeProgram,
      history: st.history,
      customExercises: st.customExercises,
      templates: st.templates,
      oneRepMaxes: st.oneRepMaxes,
      settings: st.settings,
    });
    try {
      await saveTextFile(`liftbook-backup-${new Date().toISOString().slice(0, 10)}.json`, data, 'application/json');
    } catch (e) {
      notify('Backup failed', String(e));
    }
  };

  const restore = async () => {
    try {
      const file = await pickTextFile(['application/json', '*/*']);
      if (!file) return;
      // Older backups are upgraded with the same migrate() as on-device data (persistence.ts).
      const parsed = parseBackup(file.text);
      if (!parsed.ok) return notify('Not a backup', parsed.error);
      const { data } = parsed;
      const ok = await confirm('Restore backup?', `This replaces everything on this device with the backup from ${(parsed.exportedAt ?? 'unknown date').slice(0, 10)} (${data.history.length} workouts).`, 'Restore', true);
      if (!ok) return;
      useStore.getState().replaceAll({
        programs: data.programs as Program[],
        activeProgram: data.activeProgram as ActiveProgram | undefined,
        history: data.history as Workout[],
        customExercises: data.customExercises as Exercise[],
        templates: data.templates as Template[],
        oneRepMaxes: data.oneRepMaxes,
        settings: { ...settings, ...data.settings },
      });
      notify('Restored', 'Your data has been restored.');
    } catch (e) {
      notify('Restore failed', String(e));
    }
  };

  const changeUnit = async (u: Unit) => {
    if (u === unit) return;
    if (historyCount > 0) {
      const ok = await confirm('Switch units?', `All logged weights will be converted to ${u}.`, 'Convert');
      if (!ok) return;
    }
    useStore.getState().setUnit(u);
  };

  return (
    <Screen>
      <H1>Profile</H1>

      <SectionTitle>Workout</SectionTitle>
      <Card testID="settings-workout-card">
        <Row label="Weight unit">
          <View style={{ width: 120 }}>
            <Segmented
              testID="unit"
              options={[
                { value: 'lb', label: 'lb' },
                { value: 'kg', label: 'kg' },
              ]}
              value={unit}
              onChange={changeUnit}
            />
          </View>
        </Row>
        <Divider />
        <Row label="Fill in numbers automatically" sub="Start each set with last session's numbers already entered instead of shown as hints. Tapping a set fills it in either way.">
          <AppSwitch testID="autofill-switch" value={settings.autofillValues} onValueChange={(v) => useStore.getState().updateSettings({ autofillValues: v })} />
        </Row>
        <Divider />
        <Row label="Appearance">
          <View style={{ width: 210 }}>
            <Segmented
              testID="appearance"
              options={[
                { value: 'system', label: 'System' },
                { value: 'light', label: 'Light' },
                { value: 'dark', label: 'Dark' },
              ]}
              value={settings.appearance}
              onChange={(appearance) => useStore.getState().updateSettings({ appearance })}
            />
          </View>
        </Row>
        <Divider />
        <Row label="Haptics">
          <AppSwitch value={settings.haptics} onValueChange={(v) => useStore.getState().updateSettings({ haptics: v })} />
        </Row>
      </Card>

      <SectionTitle>Plates & Rounding</SectionTitle>
      <Card>
        <Row label="Bar weight">
          <View style={{ width: 80 }}>
            <NumInput label="Bar weight" value={settings.barWeight[unit]} onChange={(n) => n != null && useStore.getState().updateSettings({ barWeight: { ...settings.barWeight, [unit]: n } })} />
          </View>
        </Row>
        <Divider />
        <Row label="Round % weights to" sub="Used for percentage-of-1RM sets.">
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {(unit === 'lb' ? [2.5, 5, 10] : [1, 2.5, 5]).map((r) => (
              <Chip key={r} label={String(r)} active={settings.plateRounding[unit] === r} onPress={() => useStore.getState().updateSettings({ plateRounding: { ...settings.plateRounding, [unit]: r } })} />
            ))}
          </View>
        </Row>
      </Card>

      <SectionTitle>Library</SectionTitle>
      <Card style={{ paddingVertical: 4 }}>
        <MenuItem icon="barbell-outline" label="Exercises" onPress={() => router.push('/exercises')} />
        <MenuItem icon="trophy-outline" label="Rep Maxes" onPress={() => router.push('/program/rep-maxes')} />
      </Card>

      <SectionTitle>Data</SectionTitle>
      <Card style={{ paddingVertical: 4 }}>
        <MenuItem testID="import-csv" icon="cloud-upload-outline" label="Import history (CSV)" onPress={importFile} />
        <MenuItem icon="cloud-download-outline" label="Export history (CSV)" onPress={exportHistory} />
        <MenuItem icon="save-outline" label="Back up everything (JSON)" onPress={backup} />
        <MenuItem icon="refresh-outline" label="Restore from backup" onPress={restore} />
      </Card>
      <Txt faint size={12}>
        CSV import understands exports from Boostcamp, Strong and Hevy, plus generic files with date, exercise, weight and reps columns. Your data is stored only on this device — back up regularly.
      </Txt>
      <Card style={{ paddingVertical: 4 }}>
        <MenuItem
          icon="trash-outline"
          label="Erase all data"
          danger
          onPress={async () => {
            if (await confirm('Erase all data?', 'Deletes every workout, program and setting on this device. This cannot be undone.', 'Erase', true)) useStore.getState().resetAll();
          }}
        />
      </Card>
    </Screen>
  );
}

function Row({ label, sub, children }: { label: string; sub?: string; children: React.ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <View style={{ flex: 1 }}>
        <Txt weight="600">{label}</Txt>
        {sub && (
          <Txt dim size={12}>
            {sub}
          </Txt>
        )}
      </View>
      {children}
    </View>
  );
}
