// A picture from Qloo that is shown only after the AI check says it's suitable (src/lib/pictures.ts).
// Until then — and for good if it's hidden — it looks like a picture that simply hasn't loaded yet.
import { Image } from 'expo-image';
import { Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { usePictureOk } from '@/lib/pictures';
import { C } from '@/theme';

export function SafePicture({ uri, emoji, style, emojiSize = 22 }: { uri?: string; emoji: string; style?: StyleProp<ViewStyle>; emojiSize?: number }) {
  const ok = usePictureOk(uri);
  return (
    <View style={[{ backgroundColor: C.sand, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }, style]}>
      {ok && uri ? (
        <Image source={{ uri }} style={{ position: 'absolute', inset: 0 }} contentFit="cover" transition={250} />
      ) : (
        <Text style={{ fontSize: emojiSize, opacity: 0.35 }}>{emoji}</Text>
      )}
    </View>
  );
}
