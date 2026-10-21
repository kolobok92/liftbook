import { Ionicons } from '@expo/vector-icons';
import { Pressable, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { type SharedValue, useAnimatedStyle } from 'react-native-reanimated';
import { Txt } from '@/components/ui';

/**
 * Red "Delete" revealed by swiping a row left. Hidden until the swipe starts: it sits behind the
 * row, and a closed row's anti-aliased rounded edge would otherwise show a red hairline.
 */
export function SwipeDeleteAction({
  progress,
  testID,
  label,
  onPress,
  style,
  iconSize = 18,
}: {
  progress: SharedValue<number>;
  testID: string;
  label: string;
  onPress: () => void;
  style: StyleProp<ViewStyle>;
  iconSize?: number;
}) {
  const shown = useAnimatedStyle(() => ({ opacity: progress.value > 0.01 ? 1 : 0 }));
  return (
    <Animated.View style={shown}>
      <Pressable testID={testID} accessibilityLabel={label} onPress={onPress} style={[{ flex: 1 }, style]}>
        <Ionicons name="trash-outline" size={iconSize} color="#FFFFFF" />
        <Txt size={12} weight="700" color="#FFFFFF">
          Delete
        </Txt>
      </Pressable>
    </Animated.View>
  );
}
