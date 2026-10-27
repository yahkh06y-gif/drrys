// All the memory hooks the student made for one chapter (opened by holding that branch on the tree).
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';

import type { Card } from '@/store';
import { autoDir } from '@/design/rtl';
import { color } from '@/design/tokens';
import { C, F } from '@/theme';

export function HookGallery({ title, cards, onClose }: { title?: string; cards: Card[]; onClose: () => void }) {
  return (
    <Modal visible={!!title} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: color.overlay.scrim }}>
        <View style={{ backgroundColor: C.paper, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 18, gap: 10, maxHeight: '80%' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{ fontFamily: F.semi, fontSize: 17, color: C.ink }}>Your memory hooks · {title}</Text>
            <Pressable hitSlop={10} onPress={onClose}>
              <Ionicons name="close" size={22} color={C.muted} />
            </Pressable>
          </View>
          {cards.length === 0 ? (
            <Text style={{ fontFamily: F.medium, fontSize: 14, lineHeight: 21, color: C.body, paddingVertical: 12 }}>
              No hooks on this branch yet.
            </Text>
          ) : (
            <ScrollView contentContainerStyle={{ gap: 10, paddingBottom: 8 }}>
              {cards.map((c) => (
                <View key={c.id} style={{ backgroundColor: C.white, borderRadius: 16, borderWidth: 1, borderColor: C.line, padding: 12, gap: 6 }}>
                  <Text style={[{ fontFamily: F.medium, fontSize: 14, color: C.ink }, autoDir(c.q)]}>{c.q}</Text>
                  <Text style={{ fontFamily: F.medium, fontSize: 13, color: C.teal }}>{c.a}</Text>
                  <View style={{ backgroundColor: color.feedback.almost.bg, borderRadius: 12, borderWidth: 1, borderColor: C.amber, padding: 10 }}>
                    <Text style={[{ fontFamily: F.medium, fontSize: 14, lineHeight: 20, color: color.feedback.almost.text }, autoDir(c.mnemonic)]}>{c.mnemonic}</Text>
                    {!!c.mnemonicImg && <Image source={{ uri: c.mnemonicImg }} style={{ width: '100%', height: 150, marginTop: 8, borderRadius: 10, backgroundColor: C.white }} contentFit="contain" />}
                  </View>
                </View>
              ))}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}
