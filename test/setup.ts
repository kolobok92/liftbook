/* eslint-disable @typescript-eslint/no-require-imports -- jest.mock factories are hoisted above imports, so they must require. */
// Native modules the components touch, swapped for small stand-ins (Reanimated's own mock loads
// its native worklets runtime, which doesn't exist under Jest). Swipe gestures are a device check.
import { jest } from '@jest/globals';
import 'react-native-gesture-handler/jestSetup';

jest.mock('react-native-gesture-handler/ReanimatedSwipeable', () => {
  const { View } = require('react-native');
  return { __esModule: true, default: ({ children }: { children: unknown }) => require('react').createElement(View, null, children) };
});
jest.mock('react-native-reanimated', () => {
  const { View } = require('react-native');
  const passthrough = <T,>(c: T) => c;
  const shared = <T,>(value: T) => ({ value });
  return {
    __esModule: true,
    default: { View, createAnimatedComponent: passthrough },
    createAnimatedComponent: passthrough,
    useAnimatedStyle: () => ({}),
    useSharedValue: shared,
    useEvent: () => () => {},
    useAnimatedRef: () => ({ current: null }),
    runOnJS: passthrough,
    isSharedValue: () => false,
  };
});
jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  const Icon = ({ name, testID }: { name: string; testID?: string }) => require('react').createElement(Text, { testID }, `[${name}]`);
  return { Ionicons: Icon, MaterialCommunityIcons: Icon };
});
jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('expo-haptics', () => ({ impactAsync: async () => {}, selectionAsync: jest.fn(async () => {}), notificationAsync: async () => {}, ImpactFeedbackStyle: {}, NotificationFeedbackType: {} }));
jest.mock('expo-router', () => ({ router: { push: () => {}, back: () => {}, replace: () => {} }, useLocalSearchParams: () => ({}), Link: 'Link' }));
// The store's debounced AsyncStorage writes would fire after a test ends; keep state in memory.
jest.mock('@/lib/storage', () => ({ debouncedStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} }, flushStorage: async () => {} }));
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
