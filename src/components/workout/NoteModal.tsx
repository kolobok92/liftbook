import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Button, Txt } from '@/components/ui';
import { C, R, themed } from '@/lib/theme';

/**
 * Boostcamp-style note editor: a centered popup with the text and clear OK / Delete buttons
 * (a multiline field inline on the card had no obvious way to finish on iOS). Tapping outside
 * cancels. Mount it keyed by the exercise so each opening starts from that note.
 */
export function NoteModal({
  title,
  initial,
  onSave,
  onClose,
}: {
  title: string;
  initial: string;
  onSave: (text: string) => void;
  onClose: () => void;
}) {
  const [text, setText] = useState(initial);
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.center}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Cancel note">
          <View style={styles.backdrop} />
        </Pressable>
        <View style={styles.card}>
          <Txt size={13} dim numberOfLines={1}>
            Note · {title}
          </Txt>
          <TextInput
            testID="note-input"
            value={text}
            onChangeText={setText}
            placeholder="Seat height, grip, cues…"
            placeholderTextColor={C.textFaint}
            multiline
            autoFocus
            style={styles.input}
          />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Button
              testID="note-delete"
              variant="danger"
              title="Delete"
              style={{ flex: 1 }}
              onPress={() => {
                onSave('');
                onClose();
              }}
            />
            <Button
              testID="note-ok"
              title="OK"
              style={{ flex: 1 }}
              onPress={() => {
                onSave(text.trim());
                onClose();
              }}
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = themed(() =>
  StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
  card: { width: '100%', maxWidth: 420, backgroundColor: C.surface, borderRadius: R.lg, padding: 16, gap: 12 },
    input: { minHeight: 96, maxHeight: 200, backgroundColor: C.surface2, borderRadius: R.md, padding: 12, color: C.text, fontSize: 16, textAlignVertical: 'top' },
  }),
);
