// A message box that works everywhere. react-native-web's Alert.alert shows nothing, so on the web the browser's
// own alert / confirm boxes carry the message (one confirm per choice when there are several).
import { Alert, Platform, type AlertButton } from 'react-native';

export function alert(title: string, message?: string, buttons?: AlertButton[]) {
  if (Platform.OS !== 'web') return Alert.alert(title, message, buttons);
  const w = globalThis as unknown as { alert?: (m: string) => void; confirm?: (m: string) => boolean };
  const text = message ? `${title}\n\n${message}` : title;
  const actions = (buttons ?? []).filter((b) => b.style !== 'cancel');
  const cancel = buttons?.find((b) => b.style === 'cancel');
  if (!cancel && actions.length <= 1) {
    w.alert?.(text);
    actions[0]?.onPress?.();
    return;
  }
  for (const b of actions) {
    if (w.confirm?.(`${text}\n\n${b.text ?? 'OK'}?`)) return b.onPress?.();
  }
  cancel?.onPress?.();
}
