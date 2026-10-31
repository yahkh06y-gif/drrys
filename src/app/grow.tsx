// After a subject is saved: the seed closes (plantClose), then it grows into a tree (plantTree). Both clips are
// preloaded and plantTree's first frame is plantClose's last, so the cut between them doesn't show. Tap to skip.
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { color } from '@/design/tokens';
import { Motion } from '@/components/Motion';
import { useBack } from '@/lib/back';
import { haptic } from '@/lib/feedback';
import { finishOnboarding } from '@/lib/finish';
import { C, F } from '@/theme';

type Stage = 'close' | 'tree';

export default function Grow() {
  const { onboarding } = useLocalSearchParams<{ onboarding?: string }>();
  const [stage, setStage] = useState<Stage>('close');
  const done = useRef(false);

  const go = useCallback(() => {
    if (done.current) return;
    done.current = true;
    if (onboarding) finishOnboarding();
    else router.dismissTo('/(tabs)/tree');
  }, [onboarding]);

  // the tree is already saved: back would return to the form and plant it twice, so back = skip
  useBack(
    useCallback(() => {
      go();
      return true;
    }, [go]),
  );

  const onClosed = useCallback(() => setStage('tree'), []);

  // the clips have their own sound design; haptics mark the two moments
  useEffect(() => {
    haptic(stage === 'close' ? 'light' : 'success');
  }, [stage]);

  const fill = { position: 'absolute', inset: 0 } as const;

  return (
    <Pressable style={{ flex: 1 }} onPress={go}>
      <Motion video="plantClose" loop={false} playing={stage === 'close'} onEnd={stage === 'close' ? onClosed : undefined} style={fill} />
      {/* preloaded under an opacity switch: an instant cut from the closed seed's last frame */}
      <View style={[fill, { opacity: stage === 'tree' ? 1 : 0 }]}>
        <Motion video="plantTree" loop={false} playing={stage === 'tree'} onEnd={stage === 'tree' ? go : undefined} style={{ flex: 1 }} />
      </View>
      <SafeAreaView pointerEvents="none" style={{ position: 'absolute', bottom: 0, left: 0, right: 0, alignItems: 'center', paddingBottom: 16 }}>
        <View style={{ backgroundColor: color.overlay.shade, borderRadius: 99, paddingHorizontal: 14, paddingVertical: 6 }}>
          <Text style={{ fontFamily: F.medium, fontSize: 12, color: C.white }}>Tap to skip</Text>
        </View>
      </SafeAreaView>
    </Pressable>
  );
}
