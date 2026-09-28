// Full-bleed video layer for the Blender renders (fixed camera → drop-in backgrounds).
import { useEvent } from 'expo';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEffect } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';

import { VIDEO_BG, VIDEO_MS, VIDEOS, type VideoKey } from '@/art-videos';

export function Motion({
  video,
  loop = true,
  playing = true,
  onEnd,
  style,
  fit = 'cover',
}: {
  video: VideoKey;
  loop?: boolean;
  playing?: boolean;
  onEnd?: () => void;
  style?: StyleProp<ViewStyle>;
  fit?: 'cover' | 'contain';
}) {
  const player = useVideoPlayer(VIDEOS[video], (p) => {
    p.loop = loop;
    p.muted = true;
    if (playing) p.play();
  });

  useEffect(() => {
    if (playing) player.play();
    else player.pause();
  }, [playing, player]);

  const { status } = useEvent(player, 'statusChange', { status: player.status });

  useEffect(() => {
    if (!onEnd) return;
    const sub = player.addListener('playToEnd', onEnd);
    return () => sub.remove();
  }, [player, onEnd]);

  // Safety net for one-shot clips: advance even if the clip never reports its end.
  useEffect(() => {
    if (!onEnd || loop || !playing) return;
    const t = setTimeout(onEnd, VIDEO_MS[video] + 2500);
    return () => clearTimeout(t);
  }, [onEnd, loop, playing, video]);

  return (
    <View style={[{ backgroundColor: VIDEO_BG[video], overflow: 'hidden' }, style]} pointerEvents="none">
      <VideoView
        player={player}
        style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', opacity: status === 'readyToPlay' ? 1 : 0 }}
        contentFit={fit}
        nativeControls={false}
        allowsPictureInPicture={false}
      />
    </View>
  );
}
