// Bottom navigation: Coco · Tree · Profile (clay icons from the Figma BottomTabNavigation).
import { Image } from 'expo-image';
import { Tabs } from 'expo-router';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ICONS } from '@/art';
import { tap } from '@/lib/feedback';
import { C } from '@/theme';

const ORDER = [
  { name: 'coco', icon: ICONS.coco },
  { name: 'tree', icon: ICONS.tree },
  { name: 'profile', icon: ICONS.profile },
];

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  return (
    <Tabs
      initialRouteName="tree"
      screenOptions={{ headerShown: false, animation: 'shift' }}
      tabBar={({ state, navigation }) => (
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-around',
            alignItems: 'center',
            backgroundColor: '#FCF9F1',
            borderTopWidth: 2,
            borderColor: C.barkSoft,
            paddingTop: 12,
            paddingBottom: Math.max(insets.bottom, 12),
          }}>
          {ORDER.map((t) => {
            const idx = state.routes.findIndex((r) => r.name === t.name);
            const active = state.index === idx;
            return (
              <Pressable
                key={t.name}
                onPress={() => {
                  if (!active) tap('select');
                  navigation.navigate(t.name);
                }}
                style={{
                  width: 60,
                  height: 60,
                  borderRadius: 19,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: active ? 'rgba(0,106,98,0.16)' : 'transparent',
                  borderWidth: active ? 1 : 0,
                  borderColor: '#006A62',
                }}>
                <Image source={t.icon} style={{ width: 42, height: 44, transform: [{ scale: active ? 1.08 : 0.92 }] }} contentFit="contain" />
              </Pressable>
            );
          })}
        </View>
      )}>
      <Tabs.Screen name="coco" />
      <Tabs.Screen name="tree" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}
