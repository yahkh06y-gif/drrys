// Full-bleed video layer for the Blender renders (fixed camera → drop-in backgrounds).
import { useEvent } from 'expo';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';

import { VIDEO_BG, VIDEO_MS, VIDEO_SOUND, VIDEOS, type VideoKey } from '@/art-videos';
import { useApp } from '@/store';

/** Video sound level (0–1). The renders are mixed loud; this keeps them under the UI sounds. */
export const VIDEO_VOLUME = 0.45;

export function Motion({
  video,
  loop = true,
  playing = true,
  onEnd,
  style,
  fit = 'cover',
  startAt = 0,
}: {
  video: VideoKey;
  loop?: boolean;
  playing?: boolean;
  onEnd?: () => void;
  style?: StyleProp<ViewStyle>;
  fit?: 'cover' | 'contain';
  /** seconds: the first play starts here; later loops play the whole clip */
  startAt?: number;
}) {
  const soundOn = useApp((s) => s.sound);
  // a screen left underneath another one (e.g. "Not now" on the planting page) goes quiet and still
  const [focused, setFocused] = useState(true);
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );
  const live = playing && focused;
  const withSound = !!VIDEO_SOUND[video] && soundOn;
  const player = useVideoPlayer(VIDEOS[video], (p) => {
    p.loop = loop;
    p.muted = !withSound;
    p.volume = VIDEO_VOLUME;
    p.audioMixingMode = 'mixWithOthers';
    if (startAt) p.currentTime = startAt;
    if (playing) p.play();
  });

  useEffect(() => {
    player.muted = !withSound;
  }, [withSound, player]);

  // a one-shot clip that already ended starts over when it's played again (e.g. after going back)
  const ended = useRef(false);
  useEffect(() => {
    if (live) {
      if (ended.current) {
        ended.current = false;
        player.currentTime = startAt;
      }
      player.play();
    } else player.pause();
  }, [live, player, startAt]);

  // Once the first frame is ready, never hide the video again — so one-shot clips
  // stay on their last frame instead of disappearing when playback ends.
  const { status } = useEvent(player, 'statusChange', { status: player.status });
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (status !== 'readyToPlay' || shown) return;
    // some platforms ignore a seek made before the clip is loaded: seek again, then show it
    if (startAt && player.currentTime < startAt - 0.3) player.currentTime = startAt;
    setShown(true);
  }, [status, shown, startAt, player]);

  useEffect(() => {
    const sub = player.addListener('playToEnd', () => {
      if (!loop) {
        ended.current = true;
        // hold the final frame
        player.pause();
        player.currentTime = Math.max(0, player.duration - 0.05);
      }
      onEnd?.();
    });
    return () => sub.remove();
  }, [player, onEnd, loop]);

  // Safety net for one-shot clips: advance even if the clip never reports its end.
  useEffect(() => {
    if (!onEnd || loop || !live) return;
    const t = setTimeout(onEnd, VIDEO_MS[video] + 2500);
    return () => clearTimeout(t);
  }, [onEnd, loop, live, video]);

  return (
    <View style={[{ backgroundColor: VIDEO_BG[video], overflow: 'hidden' }, style]} pointerEvents="none">
      <VideoView
        player={player}
        style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', opacity: shown ? 1 : 0 }}
        contentFit={fit}
        // Android: TextureView respects opacity and stacking. The default SurfaceView draws on top of
        // everything, so several stacked videos (cross-fades, preloaded clips) all showed the last one.
        surfaceType="textureView"
        nativeControls={false}
        allowsPictureInPicture={false}
      />
    </View>
  );
}
