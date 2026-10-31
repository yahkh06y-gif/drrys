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

// What a real file of each kind starts with, in base64: a PowerPoint is a zip ("PK\x03\x04"), a PDF starts "%PDF".
const MAGIC = { zip: 'UEsD', pdf: 'JVBER' } as const;
export type FileKind = keyof typeof MAGIC;

/** A file's content as base64. On a phone the new file API can refuse a file the app is allowed to read
 *  ("Missing 'READ' permission"), so two other ways are tried before giving up (the first error is the one reported).
 *  `kind`: the content must look like that kind of file; a way that returns something else (a damaged read) is
 *  skipped and the next one is tried. */
export async function readFileBase64(uri: string, kind?: FileKind): Promise<string> {
  const ok = (b: string) => !!b && (!kind || b.startsWith(MAGIC[kind]));
  if (Platform.OS === 'web') return viaBlob(uri);
  let first: unknown;
  let got = '';
  for (const way of [() => new File(uri).base64(), () => Legacy.readAsStringAsync(uri, { encoding: 'base64' }), () => viaBlob(uri)]) {
    try {
      const b = await way();
      if (ok(b)) return b;
      got ||= b;
    } catch (e) {
      first ??= e;
    }
  }
  if (got) throw new Error(kind === 'zip' ? 'the saved copy is not a PowerPoint file' : 'the saved copy is not a PDF');
  throw first;
}
