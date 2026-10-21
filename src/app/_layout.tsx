import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, Platform, useColorScheme, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useHydrated } from '@/lib/hooks';
import { useWorkoutLiveActivity } from '@/lib/liveActivity';
import { useStore } from '@/lib/store';
import { applyScheme, C, type Scheme } from '@/lib/theme';

// react-native-svg (body map) forwards RN responder props and `accessible` to DOM nodes on web.
// Harmless web-only React warnings; drop them so they don't cover the UI in dev.
if (__DEV__ && Platform.OS === 'web') {
  const original = console.error;
  const noise = [/Unknown event handler property/, /for a non-boolean attribute/];
  console.error = (...args: unknown[]) => {
    if (typeof args[0] === 'string' && noise.some((re) => re.test(args[0] as string))) return;
    original(...args);
  };
}

export default function RootLayout() {
  const hydrated = useHydrated();
  useWorkoutLiveActivity();
  const appearance = useStore((s) => s.settings.appearance);
  const system = useColorScheme();
  const scheme: Scheme = appearance === 'system' ? (system === 'light' ? 'light' : 'dark') : appearance;
  // Swap the palette before any child reads C this render; the key below remounts the tree so
  // every screen picks it up (styles are read at render time, see themed()).
  applyScheme(scheme);
  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
  const theme = { ...base, colors: { ...base.colors, background: C.bg, card: C.bg, text: C.text, border: C.border, primary: C.accentText } };
  return (
    <GestureHandlerRootView key={scheme} style={{ flex: 1, backgroundColor: C.bg }}>
      <ThemeProvider value={theme}>
        <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
        {!hydrated ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg }}>
            <ActivityIndicator color={C.accent} />
          </View>
        ) : (
          <Stack
            screenOptions={{
              headerStyle: { backgroundColor: C.bg },
              headerTintColor: C.text,
              headerTitleStyle: { fontWeight: '700' },
              contentStyle: { backgroundColor: C.bg },
              headerShadowVisible: false,
              headerBackButtonDisplayMode: 'minimal',
            }}
          >
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="workout" options={{ presentation: 'fullScreenModal', headerShown: false, gestureEnabled: false }} />
            <Stack.Screen name="workout-summary" options={{ presentation: 'modal', headerShown: false }} />
            <Stack.Screen name="exercise-picker" options={{ presentation: 'modal', title: 'Add Exercises' }} />
            <Stack.Screen name="program/[id]" options={{ title: '' }} />
            <Stack.Screen name="program/edit/[id]" options={{ title: 'Program Builder' }} />
            <Stack.Screen name="program/rep-maxes" options={{ title: 'Rep Maxes' }} />
            <Stack.Screen name="exercise/[id]" options={{ title: '' }} />
            <Stack.Screen name="exercise/new" options={{ presentation: 'modal', title: 'Custom Exercise' }} />
            <Stack.Screen name="exercises" options={{ title: 'Exercises' }} />
            <Stack.Screen name="history/[id]" options={{ title: '' }} />
          </Stack>
        )}
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
