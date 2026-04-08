import { createContext, useContext, useMemo, useState, type PropsWithChildren } from 'react';
import type { GlobalAudioState } from '../types/entities';

interface AudioTrack {
  id: string;
  url: string;
  title: string;
}

interface GlobalAudioContextValue {
  audioState: GlobalAudioState;
  currentTrack?: AudioTrack;
  playTrack: (track: AudioTrack, queue?: AudioTrack[]) => void;
  togglePlay: () => void;
  stop: () => void;
}

const initialState: GlobalAudioState = {
  currentTrackId: null,
  queue: [],
  isPlaying: false,
  currentTimeSec: 0,
  durationSec: 0,
  volume: 0.8,
  isMuted: false,
  repeatMode: 'off',
  shuffle: false,
};

const GlobalAudioContext = createContext<GlobalAudioContextValue | null>(null);

export function GlobalAudioProvider({ children }: PropsWithChildren) {
  const [audioState, setAudioState] = useState<GlobalAudioState>(initialState);
  const [trackMap, setTrackMap] = useState<Record<string, AudioTrack>>({});

  const value = useMemo<GlobalAudioContextValue>(
    () => ({
      audioState,
      currentTrack: audioState.currentTrackId ? trackMap[audioState.currentTrackId] : undefined,
      playTrack: (track, queue = [track]) => {
        setTrackMap((prev) => ({ ...prev, [track.id]: track, ...Object.fromEntries(queue.map((q) => [q.id, q])) }));
        setAudioState((prev) => ({
          ...prev,
          currentTrackId: track.id,
          queue: queue.map((q) => q.id),
          isPlaying: true,
        }));
      },
      togglePlay: () => setAudioState((prev) => ({ ...prev, isPlaying: !prev.isPlaying })),
      stop: () => setAudioState((prev) => ({ ...prev, isPlaying: false, currentTrackId: null })),
    }),
    [audioState, trackMap],
  );

  return <GlobalAudioContext.Provider value={value}>{children}</GlobalAudioContext.Provider>;
}

export function useGlobalAudio() {
  const context = useContext(GlobalAudioContext);
  if (!context) throw new Error('useGlobalAudio must be used inside GlobalAudioProvider');
  return context;
}
