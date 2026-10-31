// Keeping a memory-hook drawing: a small PNG file in the app's documents folder (not inside the saved
// state, so it stays light). On the web it is just a data URI.
import { Directory, File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';

export async function saveSketch(cardId: string, base64: string): Promise<string | undefined> {
  if (Platform.OS === 'web') return `data:image/png;base64,${base64}`;
  try {
    const dir = new Directory(Paths.document, 'hooks');
    dir.create({ intermediates: true, idempotent: true });
    const file = new File(dir, `${cardId}-${Date.now().toString(36)}.png`);
    file.create({ overwrite: true });
    file.write(base64, { encoding: 'base64' });
    return file.uri;
  } catch {
    return undefined;
  }
}
