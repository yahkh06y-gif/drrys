// Android hardware back: let a screen handle it itself (or swallow it) while it's focused.
import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { BackHandler } from 'react-native';

/** `handler` returns true when it dealt with the back press (the screen stays). */
export function useBack(handler: () => boolean) {
  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener('hardwareBackPress', handler);
      return () => sub.remove();
    }, [handler]),
  );
}
