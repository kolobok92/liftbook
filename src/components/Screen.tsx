import type { ReactNode } from 'react';
import { ScrollView, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStore } from '@/lib/store';
import { C } from '@/lib/theme';

/** Scrollable page with safe-area top padding (for tab screens without a header). */
export function Screen({
  children,
  header = false,
  contentStyle,
  scroll = true,
}: {
  children: ReactNode;
  /** True when a stack header already handles the top inset. */
  header?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
  scroll?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const hasActive = useStore((s) => !!s.active);
  const pad = [{ paddingTop: header ? 8 : insets.top + 12, paddingHorizontal: 16, paddingBottom: hasActive ? 110 : 32, gap: 14 }, contentStyle];
  if (!scroll) return <View style={[{ flex: 1, backgroundColor: C.bg }, pad]}>{children}</View>;
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={pad} keyboardShouldPersistTaps="handled">
        {children}
      </ScrollView>
      {/* Opaque status-bar backdrop so content doesn't scroll under the clock. */}
      {!header && <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, height: insets.top, backgroundColor: C.bg }} />}
    </View>
  );
}
