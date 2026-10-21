import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { E2E, SCENARIOS } from '@/lib/e2eScenarios';
import { useHydrated } from '@/lib/hooks';
import { useStore } from '@/lib/store';

/**
 * liftbook://e2e-seed?scenario=<name>: replaces all data with a named test scenario and opens
 * its screen. Test builds only (EXPO_PUBLIC_E2E=1); anywhere else it just goes home.
 */
export default function E2ESeed() {
  const { scenario } = useLocalSearchParams<{ scenario?: string }>();
  const hydrated = useHydrated();
  const s = E2E && scenario ? SCENARIOS[scenario] : undefined;

  useEffect(() => {
    // After hydration, so stored (empty) state can't land on top of the scenario.
    if (!s || !hydrated) return;
    useStore.getState().resetAll();
    useStore.setState(s.state(Date.now()));
    router.replace(s.open);
  }, [s, hydrated]);

  return s ? null : <Redirect href="/" />;
}
