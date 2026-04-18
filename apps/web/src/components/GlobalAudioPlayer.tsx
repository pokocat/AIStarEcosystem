"use client";

import { useEffect, useRef, useState } from 'react';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Slider } from './ui/slider';
import { 
  Play, Pause, SkipForward, SkipBack, Volume2, VolumeX, 
  Music, Repeat, Shuffle, X 
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface Song {
  id: string;
  title: string;
  date: string;
  status: string;
  audioUrl?: string;
}

interface GlobalAudioPlayerProps {
  currentSong: Song | null;
  isPlaying: boolean;
  onPlayPause: () => void;
  onNext: () => void;
  onPrevious: () => void;
  onClose: () => void;
  onSeek: (time: number) => void;
  currentTime: number;
  duration: number;
}

export default function GlobalAudioPlayer({
  currentSong,
  isPlaying,
  onPlayPause,
  onNext,
  onPrevious,
  onClose,
  onSeek,
  currentTime,
  duration
}: GlobalAudioPlayerProps) {
  const [volume, setVolume] = useState(80);
  const [isMuted, setIsMuted] = useState(false);
  const [isRepeat, setIsRepeat] = useState(false);
  const [isShuffle, setIsShuffle] = useState(false);

  // Audio visualization
  const [audioLevels, setAudioLevels] = useState<number[]>(Array(32).fill(0));

  useEffect(() => {
    if (!isPlaying) {
      setAudioLevels(Array(32).fill(0));
      return;
    }

    const interval = setInterval(() => {
      setAudioLevels(prev => 
        prev.map(() => Math.random() * 100)
      );
    }, 100);

    return () => clearInterval(interval);
  }, [isPlaying]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  if (!currentSong) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-[95%] max-w-5xl"
      >
        <Card className="bg-[#0c0c0e]/95 backdrop-blur-2xl border-white/10 shadow-[0_0_60px_rgba(168,85,247,0.3)] relative overflow-hidden">
          {/* Animated background glow */}
          <div className="absolute inset-0 bg-gradient-to-r from-purple-500/10 via-cyan-500/10 to-pink-500/10 animate-pulse opacity-50" />
          
          {/* Top accent line */}
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-500 via-cyan-500 to-pink-500" 
               style={{ width: `${progress}%`, transition: 'width 0.1s linear' }} 
          />

          <div className="relative z-10 p-4">
            <div className="flex items-center gap-6">
              {/* Album art & song info */}
              <div className="flex items-center gap-4 flex-1 min-w-0">
                <div className="relative w-16 h-16 rounded-xl bg-gradient-to-br from-purple-500/20 to-cyan-500/20 flex items-center justify-center flex-shrink-0 overflow-hidden group">
                  <Music className="w-8 h-8 text-cyan-400 relative z-10" />
                  {isPlaying && (
                    <div className="absolute inset-0 bg-gradient-to-tr from-purple-500/40 to-cyan-500/40 animate-pulse" />
                  )}
                  {/* Visualization bars */}
                  {isPlaying && (
                    <div className="absolute bottom-0 left-0 right-0 flex items-end justify-center gap-0.5 h-6 px-2">
                      {audioLevels.slice(0, 8).map((level, i) => (
                        <motion.div
                          key={i}
                          className="w-1 bg-gradient-to-t from-cyan-400 to-purple-500 rounded-full"
                          animate={{ height: `${level * 0.8}%` }}
                          transition={{ duration: 0.1 }}
                        />
                      ))}
                    </div>
                  )}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-white truncate mb-1">{currentSong.title}</div>
                  <div className="text-xs text-gray-500 font-mono">{currentSong.date}</div>
                </div>
              </div>

              {/* Main controls */}
              <div className="flex flex-col items-center gap-3 flex-1">
                <div className="flex items-center gap-3">
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => setIsShuffle(!isShuffle)}
                    className={`w-9 h-9 rounded-full ${isShuffle ? 'text-purple-400 bg-purple-500/20' : 'text-gray-500 hover:text-white'}`}
                  >
                    <Shuffle className="w-4 h-4" />
                  </Button>

                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={onPrevious}
                    className="w-10 h-10 rounded-full hover:bg-white/10 text-gray-300 hover:text-white transition-all"
                  >
                    <SkipBack className="w-5 h-5" />
                  </Button>

                  <Button
                    size="icon"
                    onClick={onPlayPause}
                    className="w-14 h-14 rounded-full bg-gradient-to-br from-purple-600 to-cyan-600 hover:from-purple-500 hover:to-cyan-500 shadow-[0_0_30px_rgba(168,85,247,0.5)] hover:shadow-[0_0_40px_rgba(168,85,247,0.7)] hover:scale-105 transition-all"
                  >
                    {isPlaying ? (
                      <Pause className="w-6 h-6 text-white fill-white" />
                    ) : (
                      <Play className="w-6 h-6 text-white fill-white ml-0.5" />
                    )}
                  </Button>

                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={onNext}
                    className="w-10 h-10 rounded-full hover:bg-white/10 text-gray-300 hover:text-white transition-all"
                  >
                    <SkipForward className="w-5 h-5" />
                  </Button>

                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => setIsRepeat(!isRepeat)}
                    className={`w-9 h-9 rounded-full ${isRepeat ? 'text-purple-400 bg-purple-500/20' : 'text-gray-500 hover:text-white'}`}
                  >
                    <Repeat className="w-4 h-4" />
                  </Button>
                </div>

                {/* Progress bar */}
                <div className="w-full flex items-center gap-3">
                  <span className="text-xs text-gray-500 font-mono w-12 text-right">
                    {formatTime(currentTime)}
                  </span>
                  <div className="flex-1 group cursor-pointer">
                    <Slider
                      value={[progress]}
                      max={100}
                      step={0.1}
                      onValueChange={(value) => onSeek((value[0] / 100) * duration)}
                      className="w-full"
                    />
                  </div>
                  <span className="text-xs text-gray-500 font-mono w-12">
                    {formatTime(duration)}
                  </span>
                </div>
              </div>

              {/* Volume & Close */}
              <div className="flex items-center gap-4 flex-1 justify-end">
                <div className="flex items-center gap-2">
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => setIsMuted(!isMuted)}
                    className="w-9 h-9 rounded-full hover:bg-white/10 text-gray-400 hover:text-white"
                  >
                    {isMuted || volume === 0 ? (
                      <VolumeX className="w-4 h-4" />
                    ) : (
                      <Volume2 className="w-4 h-4" />
                    )}
                  </Button>
                  <Slider
                    value={[isMuted ? 0 : volume]}
                    max={100}
                    step={1}
                    onValueChange={(value) => {
                      setVolume(value[0]);
                      setIsMuted(false);
                    }}
                    className="w-24"
                  />
                </div>

                <Button
                  size="icon"
                  variant="ghost"
                  onClick={onClose}
                  className="w-9 h-9 rounded-full hover:bg-red-500/20 text-gray-500 hover:text-red-400 transition-all"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Waveform visualization background */}
          {isPlaying && (
            <div className="absolute bottom-0 left-0 right-0 flex items-end justify-center gap-1 h-2 px-8 opacity-20">
              {audioLevels.map((level, i) => (
                <motion.div
                  key={i}
                  className="w-1 bg-gradient-to-t from-purple-500 via-cyan-500 to-pink-500 rounded-full"
                  animate={{ height: `${level}%` }}
                  transition={{ duration: 0.1 }}
                />
              ))}
            </div>
          )}
        </Card>
      </motion.div>
    </AnimatePresence>
  );
}