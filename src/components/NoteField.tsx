import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { Platform, Pressable, TextInput, View, type TextStyle } from 'react-native';
import { C } from '@/lib/theme';
import type { IconName } from './ui';
import { Txt } from './ui';

/**
 * Icon + text on a shared line grid: the icon sits in a box one line tall, so it's centered
 * on the first line of text however many lines the text wraps to. Use this for every
 * icon-labelled text row instead of hand-tuned margins.
 */
export function IconLine({
  icon,
  size = 14,
  lineHeight = 20,
  color = C.textFaint,
  children,
  testID,
}: {
  icon: IconName;
  size?: number;
  lineHeight?: number;
  color?: string;
  children: ReactNode;
  testID?: string;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
      <View testID={testID ? `${testID}-icon` : undefined} style={{ height: lineHeight, justifyContent: 'center' }}>
        <Ionicons name={icon} size={size + 2} color={color} />
      </View>
      <View style={{ flex: 1 }}>{children}</View>
    </View>
  );
}

const noRing = (Platform.OS === 'web' ? { outlineStyle: 'none' } : {}) as unknown as TextStyle;

/** Multiline note input on the IconLine grid. */
export function NoteField({
  value,
  onChangeText,
  placeholder,
  size = 14,
  autoFocus,
  onBlur,
  testID,
}: {
  value: string;
  onChangeText: (t: string) => void;
  placeholder: string;
  size?: number;
  autoFocus?: boolean;
  onBlur?: () => void;
  testID?: string;
}) {
  const lineHeight = Math.round(size * 1.45);
  return (
    <IconLine icon="create-outline" size={size} lineHeight={lineHeight} color={C.textDim} testID={testID}>
      <TextInput
        testID={testID}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={C.textFaint}
        multiline
        autoFocus={autoFocus}
        onBlur={onBlur}
        accessibilityLabel={placeholder}
        style={[{ color: C.text, fontSize: size, lineHeight, minHeight: lineHeight, fontStyle: 'italic', padding: 0, margin: 0, textAlignVertical: 'top' }, noRing]}
      />
    </IconLine>
  );
}

/** Tappable "Last time: …" hint on the same grid. */
export function LastNote({ text, onPress, testID }: { text: string; onPress: () => void; testID?: string }) {
  return (
    <Pressable testID={testID} onPress={onPress} accessibilityLabel={`Use last note: ${text}`}>
      <IconLine icon="time-outline" size={13} lineHeight={19} testID={testID}>
        <Txt faint size={13} style={{ lineHeight: 19, fontStyle: 'italic' }} numberOfLines={2}>
          Last time: {text}
        </Txt>
      </IconLine>
    </Pressable>
  );
}
