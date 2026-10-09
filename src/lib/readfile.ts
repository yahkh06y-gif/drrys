import * as Legacy from 'expo-file-system/legacy';
import { File } from 'expo-file-system';
import { Platform } from 'react-native';

const viaBlob = async (uri: string) => {
  const blob = await (await fetch(uri)).blob();
  return new Promise<string>((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result).split(',')[1] ?? '');
    r.onerror = () => rej(r.error);
    r.readAsDataURL(blob);
  });
};

/** A file's content as base64. On a phone the new file API can refuse a file the app is allowed to read
 *  ("Missing 'READ' permission"), so two other ways are tried before giving up (the first error is the one reported). */
export async function readFileBase64(uri: string): Promise<string> {
  if (Platform.OS === 'web') return viaBlob(uri);
  let first: unknown;
  try {
    return await new File(uri).base64();
  } catch (e) {
    first = e;
  }
  try {
    return await Legacy.readAsStringAsync(uri, { encoding: 'base64' });
  } catch {}
  try {
    const b = await viaBlob(uri);
    if (b) return b;
  } catch {}
  throw first;
}
