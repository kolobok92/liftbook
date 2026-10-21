import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState, type ComponentProps, type ReactNode } from 'react';
import {
  Alert,
  Animated,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text as RNText,
  TextInput,
  View,
  useWindowDimensions,
  type StyleProp,
  type TextProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStore } from '@/lib/store';
import { C, R, themed } from '@/lib/theme';

export type IconName = ComponentProps<typeof Ionicons>['name'];

export function Txt({
  style,
  dim,
  faint,
  size = 15,
  weight,
  color,
  ...p
}: TextProps & { dim?: boolean; faint?: boolean; size?: number; weight?: TextStyle['fontWeight']; color?: string }) {
  return (
    <RNText
      {...p}
      style={[{ color: color ?? (faint ? C.textFaint : dim ? C.textDim : C.text), fontSize: size, fontWeight: weight }, style]}
    />
  );
}

export function H1({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  return (
    <Txt size={26} weight="800" style={style}>
      {children}
    </Txt>
  );
}

export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <View style={styles.sectionTitle}>
      <Txt size={13} weight="700" dim style={{ textTransform: 'uppercase', letterSpacing: 0.6 }}>
        {children}
      </Txt>
      {right}
    </View>
  );
}

export function Card({ children, style, onPress, testID }: { children: ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void; testID?: string }) {
  if (onPress)
    return (
      <Pressable testID={testID} onPress={onPress} style={({ pressed }) => [styles.card, pressed && { opacity: 0.8 }, style]}>
        {children}
      </Pressable>
    );
  return (
    <View testID={testID} style={[styles.card, style]}>
      {children}
    </View>
  );
}

type BtnVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

export function Button({
  title,
  onPress,
  variant = 'primary',
  icon,
  style,
  small,
  disabled,
  testID,
}: {
  title: string;
  onPress: () => void;
  variant?: BtnVariant;
  icon?: IconName;
  style?: StyleProp<ViewStyle>;
  small?: boolean;
  disabled?: boolean;
  testID?: string;
}) {
  const bg = { primary: C.accent, secondary: C.surface3, ghost: 'transparent', danger: C.redDim }[variant];
  const fg = { primary: C.onAccent, secondary: C.text, ghost: C.accentText, danger: C.red }[variant];
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={title}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.btn,
        small && styles.btnSmall,
        { backgroundColor: bg, opacity: disabled ? 0.4 : pressed ? 0.75 : 1 },
        style,
      ]}
    >
      {icon && <Ionicons name={icon} size={small ? 15 : 18} color={fg} />}
      <Txt size={small ? 13 : 15} weight="700" color={fg}>
        {title}
      </Txt>
    </Pressable>
  );
}

export function IconBtn({
  name,
  onPress,
  color = C.textDim,
  size = 22,
  label,
  style,
  testID,
}: {
  name: IconName;
  onPress: () => void;
  color?: string;
  size?: number;
  label: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      onPress={onPress}
      style={({ pressed }) => [{ padding: 4, opacity: pressed ? 0.6 : 1 }, style]}
    >
      <Ionicons name={name} size={size} color={color} />
    </Pressable>
  );
}

export function Chip({ label, active, onPress, testID }: { label: string; active?: boolean; onPress: () => void; testID?: string }) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ selected: !!active }}
      onPress={onPress}
      style={[styles.chip, active && { backgroundColor: C.accent, borderColor: C.accent }]}
    >
      <Txt size={13} weight="600" color={active ? C.onAccent : C.text}>
        {label}
      </Txt>
    </Pressable>
  );
}

/** iOS-style switch in the app's colours (white thumb in both schemes). */
export function AppSwitch(props: { value: boolean; onValueChange: (v: boolean) => void; testID?: string }) {
  return (
    <Switch
      {...props}
      trackColor={{ true: C.accent, false: C.surface3 }}
      thumbColor="#FFFFFF"
      ios_backgroundColor={C.surface3}
      // react-native-web only: its default "on" thumb is teal.
      {...({ activeThumbColor: '#FFFFFF' } as object)}
    />
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  testID,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  /** Each option gets `${testID}-${value}`. */
  testID?: string;
}) {
  return (
    <View style={styles.segmented}>
      {options.map((o) => (
        <Pressable
          key={o.value}
          testID={testID ? `${testID}-${o.value}` : undefined}
          accessibilityRole="button"
          accessibilityState={{ selected: o.value === value }}
          onPress={() => onChange(o.value)}
          style={[styles.segment, o.value === value && { backgroundColor: C.segmentOn }]}
        >
          <Txt size={13} weight="600" color={o.value === value ? C.text : C.textDim}>
            {o.label}
          </Txt>
        </Pressable>
      ))}
    </View>
  );
}

export function Field({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  multiline,
  suffix,
  testID,
  autoFocus,
}: {
  label?: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  keyboardType?: ComponentProps<typeof TextInput>['keyboardType'];
  multiline?: boolean;
  suffix?: string;
  testID?: string;
  autoFocus?: boolean;
}) {
  return (
    <View style={{ gap: 6 }}>
      {label && (
        <Txt size={13} dim weight="600">
          {label}
        </Txt>
      )}
      <View style={styles.field}>
        <TextInput
          testID={testID}
          accessibilityLabel={label ?? placeholder}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={C.textFaint}
          keyboardType={keyboardType}
          multiline={multiline}
          autoFocus={autoFocus}
          style={[styles.fieldInput, multiline && { minHeight: 70, textAlignVertical: 'top' }]}
        />
        {suffix && (
          <Txt dim size={14}>
            {suffix}
          </Txt>
        )}
      </View>
    </View>
  );
}

export function Divider({ style }: { style?: StyleProp<ViewStyle> }) {
  return <View style={[{ height: StyleSheet.hairlineWidth, backgroundColor: C.border }, style]} />;
}

export function Empty({ icon, title, body, children }: { icon: IconName; title: string; body?: string; children?: ReactNode }) {
  return (
    <View style={{ alignItems: 'center', paddingVertical: 40, paddingHorizontal: 24, gap: 10 }}>
      <Ionicons name={icon} size={40} color={C.textFaint} />
      <Txt size={17} weight="700">
        {title}
      </Txt>
      {body && (
        <Txt dim style={{ textAlign: 'center' }}>
          {body}
        </Txt>
      )}
      {children}
    </View>
  );
}

/**
 * Bottom sheet on React Native's Modal (works the same on iOS, Android and web).
 * Close by tapping the backdrop, the X, or dragging the handle down.
 */
export function Sheet({
  visible,
  onClose,
  title,
  children,
  footer,
  onClosed,
}: {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  footer?: ReactNode;
  /**
   * After the sheet has fully gone. Run focus changes here, not in onClose: while the modal is
   * still closing it restores focus to its trigger (web) or restarts the keyboard (Android),
   * which swallowed the first keystrokes in the field the action focused.
   */
  onClosed?: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const [drag] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (visible) drag.setValue(0);
  }, [visible, drag]);

  // Android's Modal has no onDismiss: wait out the slide animation instead.
  const shown = useRef(visible);
  const closedRef = useRef(onClosed);
  useEffect(() => {
    closedRef.current = onClosed;
  });
  useEffect(() => {
    const was = shown.current;
    shown.current = visible;
    if (Platform.OS !== 'android' || !was || visible) return;
    const t = setTimeout(() => closedRef.current?.(), 350);
    return () => clearTimeout(t);
  }, [visible]);

  const pan = Gesture.Pan()
    .runOnJS(true)
    .onUpdate((e) => drag.setValue(Math.max(0, e.translationY)))
    .onEnd((e) => {
      if (e.translationY > 90 || e.velocityY > 800) onClose();
      else Animated.spring(drag, { toValue: 0, useNativeDriver: Platform.OS !== 'web', bounciness: 4 }).start();
    });

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      onDismiss={Platform.OS === 'android' ? undefined : () => closedRef.current?.()}
      statusBarTranslucent
    >
      <GestureHandlerRootView style={{ flex: 1 }}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, justifyContent: 'flex-end' }}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close sheet">
            <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' }} />
          </Pressable>
          <Animated.View style={[styles.sheet, { maxHeight: height * 0.9, paddingBottom: Math.max(insets.bottom, 16), transform: [{ translateY: drag }] }]}>
            <GestureDetector gesture={pan}>
              <View style={{ paddingTop: 8 }}>
                <View style={styles.grabber} />
                {title ? (
                  <View style={styles.sheetHeader}>
                    <Txt size={18} weight="700" style={{ flex: 1 }} numberOfLines={1}>
                      {title}
                    </Txt>
                    <IconBtn name="close" label="Close" onPress={onClose} />
                  </View>
                ) : null}
              </View>
            </GestureDetector>
            <ScrollView keyboardShouldPersistTaps="handled" bounces={false} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 8, gap: 12 }}>
              {children}
            </ScrollView>
            {footer ? <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>{footer}</View> : null}
          </Animated.View>
        </KeyboardAvoidingView>
      </GestureHandlerRootView>
    </Modal>
  );
}

/** A tappable list row for sheets/menus. */
export function MenuItem({ icon, label, onPress, danger, right, testID }: { icon?: IconName; label: string; onPress: () => void; danger?: boolean; right?: ReactNode; testID?: string }) {
  return (
    <Pressable testID={testID} accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.menuItem, pressed && { backgroundColor: C.surface3 }]}>
      {icon && <Ionicons name={icon} size={20} color={danger ? C.red : C.text} />}
      <Txt style={{ flex: 1 }} color={danger ? C.red : C.text} weight="500">
        {label}
      </Txt>
      {right}
    </Pressable>
  );
}

/** Cross-platform confirm (Alert.alert doesn't render on web). */
export function confirm(title: string, message: string, confirmLabel = 'OK', destructive = false): Promise<boolean> {
  if (Platform.OS === 'web') return Promise.resolve(window.confirm(`${title}\n\n${message}`));
  return new Promise((resolve) =>
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
      { text: confirmLabel, style: destructive ? 'destructive' : 'default', onPress: () => resolve(true) },
    ]),
  );
}

export function notify(title: string, message: string) {
  if (Platform.OS === 'web') window.alert(`${title}\n\n${message}`);
  else Alert.alert(title, message);
}

export function haptic(kind: 'light' | 'success' | 'warning' = 'light') {
  if (Platform.OS === 'web' || !useStore.getState().settings.haptics) return;
  if (kind === 'light') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  else Haptics.notificationAsync(kind === 'success' ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Warning).catch(() => {});
}

export const styles = themed(() => StyleSheet.create({
  card: { backgroundColor: C.surface, borderRadius: R.lg, padding: 16, gap: 10 },
  btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 13, paddingHorizontal: 18, borderRadius: R.md },
  btnSmall: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: R.sm },
  chip: { paddingVertical: 7, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1, borderColor: C.surface3, backgroundColor: C.surface2 },
  segmented: { flexDirection: 'row', backgroundColor: C.surface2, borderRadius: R.md, padding: 3 },
  segment: { flex: 1, alignItems: 'center', paddingVertical: 7, borderRadius: R.sm },
  field: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.surface2, borderRadius: R.md, paddingHorizontal: 12, borderWidth: 1, borderColor: C.border },
  fieldInput: { flex: 1, color: C.text, fontSize: 16, paddingVertical: 11 },
  sectionTitle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8, marginBottom: 2 },
  sheet: { backgroundColor: C.surface, borderTopLeftRadius: 18, borderTopRightRadius: 18 },
  grabber: { alignSelf: 'center', width: 38, height: 5, borderRadius: 3, backgroundColor: C.surface3, marginBottom: 4 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 8 },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, paddingHorizontal: 4, borderRadius: R.sm },
}));
