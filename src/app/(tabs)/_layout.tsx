// Bottom navigation: Coco · Tree · Profile (clay icons from the Figma BottomTabNavigation).
// Tabs switch instantly: they're used tens of times a day, so motion there would only feel slow.
import { Image } from 'expo-image';
import { Tabs } from 'expo-router';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ICONS } from '@/art';
import { tap } from '@/lib/feedback';
import { color, radius } from '@/design/tokens';

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
      backBehavior="initialRoute"
      screenOptions={{ headerShown: false, animation: 'none', sceneStyle: { backgroundColor: color.bg.sky } }}
      tabBar={({ state, navigation }) => (
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-around',
            alignItems: 'center',
            backgroundColor: color.bg.raised,
            borderTopWidth: 1,
            borderColor: color.border.default,
            paddingTop: 12,
            paddingBottom: Math.max(insets.bottom, 12),
          }}>
          {ORDER.map((t) => {
            const idx = state.routes.findIndex((r) => r.name === t.name);
            const active = state.index === idx;
            return (
              <Pressable
                key={t.name}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                accessibilityLabel={t.name}
                onPress={() => {
                  if (!active) tap('select');
                  navigation.navigate(t.name);
                }}
                style={{
                  width: 60,
                  height: 60,
                  borderRadius: radius.lg,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: active ? color.selected.bg : 'transparent',
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
