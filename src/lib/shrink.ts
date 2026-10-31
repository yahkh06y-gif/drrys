// On the web the saved state lives in localStorage (about 5 MB in all), so a picture kept as a data URI must be small.
// Native builds keep pictures as files and are not affected. Re-encodes an image as a JPEG of at most `max` px.
import { Platform } from 'react-native';

export async function shrinkImage(src: string, max = 900, quality = 0.72): Promise<string> {
  if (Platform.OS !== 'web') return src;
  try {
    const g = globalThis as any;
    const img: any = await new Promise((res, rej) => {
      const i = new g.Image();
      i.onload = () => res(i);
      i.onerror = rej;
      i.src = src;
    });
    const k = Math.min(1, max / Math.max(img.width, img.height));
    const c = g.document.createElement('canvas');
    c.width = Math.max(1, Math.round(img.width * k));
    c.height = Math.max(1, Math.round(img.height * k));
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', quality);
  } catch {
    return src;
  }
}

/** Web only: pictures saved before this fix can be a few MB each; shrink them once so the saved state fits again. */
export async function shrinkBigPictures<T extends { mnemonicImg?: string }>(cards: T[]): Promise<T[] | undefined> {
  if (Platform.OS !== 'web') return undefined;
  const big = cards.filter((c) => c.mnemonicImg?.startsWith('data:') && c.mnemonicImg.length > 150_000);
  if (!big.length) return undefined;
  const small = new Map<T, string>();
  for (const c of big) small.set(c, await shrinkImage(c.mnemonicImg!));
  return cards.map((c) => (small.has(c) ? { ...c, mnemonicImg: small.get(c) } : c));
}
