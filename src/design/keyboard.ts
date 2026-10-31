// Sheets with a text box (Ask Coco, the memory hook) sit on top of the keyboard with this, not with
// KeyboardAvoidingView. On Android the window may already shrink for the keyboard (edge to edge, in a Modal)
// and KeyboardAvoidingView then lifts the sheet a second time: the sheet is squeezed to its input bar at the top
// of the screen. Here the lift is measured: how much of the sheet's area the keyboard really covers, which is 0
// when the window already made room.
import { useCallback, useEffect, useRef, useState } from 'react';
import { Keyboard, Platform, type LayoutChangeEvent, type View } from 'react-native';

/**
 * Put `ref` and `onLayout` on a view that fills the screen (the sheet's backdrop). `lift`: how far up to put
 * the bottom of the sheet; `room`: the height that is left above the keyboard in that view.
 */
export function useKeyboardLift() {
  const ref = useRef<View>(null);
  const kbTop = useRef<number | undefined>(undefined); // the keyboard's top edge on the screen, while it is open
  const [lift, setLift] = useState(0);
  const [height, setHeight] = useState(0);
  const [open, setOpen] = useState(false);

  const measure = useCallback(() => {
    const top = kbTop.current;
    if (top === undefined) return setLift(0);
    ref.current?.measureInWindow((_x, y, _w, h) => {
      setHeight(h);
      setLift(Math.max(0, Math.round(y + h - top)));
    });
  }, []);

  useEffect(() => {
    const ios = Platform.OS === 'ios';
    const show = Keyboard.addListener(ios ? 'keyboardWillShow' : 'keyboardDidShow', (e) => {
      kbTop.current = e.endCoordinates.screenY;
      setOpen(true);
      measure();
    });
    const hide = Keyboard.addListener(ios ? 'keyboardWillHide' : 'keyboardDidHide', () => {
      kbTop.current = undefined;
      setOpen(false);
      setLift(0);
    });
    return () => {
      show.remove();
      hide.remove();
    };
  }, [measure]);

  // the window may shrink a moment after the keyboard event: measure again when it does
  const onLayout = useCallback(
    (e: LayoutChangeEvent) => {
      setHeight(e.nativeEvent.layout.height);
      measure();
    },
    [measure],
  );

  return { ref, onLayout, lift, room: Math.max(0, height - lift), open };
}
