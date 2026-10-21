import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

/** Let the user pick a text file (CSV/JSON) and return its contents, or null if cancelled. */
export async function pickTextFile(types: string[]): Promise<{ name: string; text: string } | null> {
  const res = await DocumentPicker.getDocumentAsync({ type: types, copyToCacheDirectory: true, multiple: false });
  if (res.canceled || !res.assets?.[0]) return null;
  const asset = res.assets[0];
  if (Platform.OS === 'web') {
    const text = asset.file ? await asset.file.text() : await (await fetch(asset.uri)).text();
    return { name: asset.name, text };
  }
  return { name: asset.name, text: await new File(asset.uri).text() };
}

/** Save/share a text file: browser download on web, share sheet on iOS/Android. */
export async function saveTextFile(name: string, content: string, mime: string): Promise<void> {
  if (Platform.OS === 'web') {
    const url = URL.createObjectURL(new Blob([content], { type: mime }));
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return;
  }
  const file = new File(Paths.cache, name);
  if (file.exists) file.delete();
  file.create();
  file.write(content);
  await Sharing.shareAsync(file.uri, { mimeType: mime, dialogTitle: name });
}
