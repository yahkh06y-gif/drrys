// A picture from Qloo. The server drops anything adult or unsuitable before it gets here
// (supabase/functions/qloo); without a picture this shows the area's icon instead.
import { Image } from 'expo-image';
import { Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { C } from '@/theme';

export function SafePicture({ uri, emoji, icon, style, emojiSize = 22 }: { uri?: string; emoji: string; icon?: number; style?: StyleProp<ViewStyle>; emojiSize?: number }) {
  return (
    <View style={[{ backgroundColor: C.sand, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }, style]}>
      {uri ? (
        <Image source={{ uri }} style={{ position: 'absolute', inset: 0 }} contentFit="cover" transition={250} />
      ) : icon !== undefined ? (
        <Image source={icon} style={{ width: '78%', height: '78%' }} contentFit="contain" />
      ) : (
        <Text style={{ fontSize: emojiSize, opacity: 0.35 }}>{emoji}</Text>
      )}
    </View>
  );
}
