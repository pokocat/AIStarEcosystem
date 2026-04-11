"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Edit2, Mic2, Play, Sparkles, Volume2, Wand2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useProducerWorkspace } from "@/features/producer/hooks/use-producer-workspace";
import { useDictionary } from "@/features/shared/hooks/use-dictionary";
import { ErrorPanel, LoadingPanel } from "@/features/shared/components/page-feedback";
import type { TrackSummary } from "@/types/contracts/tracks";

const MusicGenerationDialog = dynamic(() => import("@/components/MusicGenerationDialog"), { ssr: false });
const GlobalAudioPlayer = dynamic(() => import("@/components/GlobalAudioPlayer"), { ssr: false });

export default function ProducerStudioRoute() {
  const router = useRouter();
  const { copy } = useDictionary();
  const workspace = useProducerWorkspace();
  const [showGenerator, setShowGenerator] = useState(false);
  const [currentTrackId, setCurrentTrackId] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);

  const tracks = workspace.trackWorkspace?.tracks ?? [];
  const currentTrack = tracks.find((track) => track.id === currentTrackId) ?? null;

  useEffect(() => {
    if (!isPlaying || !currentTrack) {
      return;
    }

    const timer = window.setInterval(() => {
      setCurrentTime((value) => {
        if (value + 1 >= currentTrack.durationSec) {
          setIsPlaying(false);
          return currentTrack.durationSec;
        }
        return value + 1;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [currentTrack, isPlaying]);

  const currentIndex = useMemo(
    () => tracks.findIndex((track) => track.id === currentTrackId),
    [currentTrackId, tracks]
  );

  if (workspace.errors.length) {
    return <ErrorPanel title="Failed to load studio" detail={workspace.errors[0]} />;
  }

  if (workspace.isBootstrapping || !workspace.trackWorkspace || !workspace.activeSinger) {
    return <LoadingPanel label="Loading studio..." />;
  }

  const selectTrack = (track: TrackSummary) => {
    setCurrentTrackId(track.id);
    setCurrentTime(0);
    setIsPlaying(true);
  };

  const moveTrack = (direction: -1 | 1) => {
    if (currentIndex === -1) return;
    const nextTrack = tracks[currentIndex + direction];
    if (!nextTrack) return;
    setCurrentTrackId(nextTrack.id);
    setCurrentTime(0);
    setIsPlaying(true);
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col items-start justify-between gap-4 border-b border-white/10 pb-6 md:flex-row md:items-end">
        <div>
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-purple-500/20 bg-purple-500/10 px-3 py-1 text-xs font-bold uppercase tracking-widest text-purple-400">
            <Wand2 className="h-3 w-3" /> Studio Core
          </div>
          <h2 className="text-3xl font-black tracking-tight">{copy.producer.studio.title}</h2>
          <p className="mt-2 text-sm text-gray-400">{copy.producer.studio.subtitle}</p>
        </div>
        <Button
          onClick={() => setShowGenerator(true)}
          className="h-12 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 px-6 font-bold text-white hover:from-purple-500 hover:to-pink-500"
        >
          <Sparkles className="mr-2 h-4 w-4" />
          {copy.producer.studio.generate}
        </Button>
      </div>

      <div className="grid gap-8 lg:grid-cols-12">
        <Card className="border-white/10 bg-[#0c0c0e]/80 backdrop-blur-xl lg:col-span-5">
          <CardHeader>
            <CardTitle>Persona Snapshot</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
              <div className="mb-2 text-lg font-black text-white">{workspace.activeSinger.name}</div>
              <div className="text-sm text-gray-400">{workspace.activeSinger.style}</div>
            </div>
            {Object.entries(workspace.activeSinger.parameters).map(([key, value]) => (
              <div key={key} className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="capitalize">{key}</span>
                  <span className="font-mono text-cyan-400">{value}</span>
                </div>
                <Progress value={value} className="h-2 bg-black/50" />
              </div>
            ))}
            <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
              <div className="mb-3 text-sm font-bold text-gray-300">Generation Modes</div>
              <div className="flex flex-wrap gap-2">
                {workspace.trackWorkspace.generationStages.map((stage) => (
                  <Badge key={stage} variant="outline" className="border-white/10 text-gray-300">
                    {stage}
                  </Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-[#0c0c0e]/80 backdrop-blur-xl lg:col-span-7">
          <CardHeader>
            <CardTitle>{copy.producer.studio.library}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {tracks.map((track) => (
              <div
                key={track.id}
                onClick={() => selectTrack(track)}
                className="group flex cursor-pointer items-center justify-between rounded-xl border border-white/5 bg-black/40 p-4 transition-all hover:border-purple-500/30 hover:bg-white/5"
              >
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500/20 to-cyan-500/20">
                    <Mic2 className="h-5 w-5 text-cyan-400" />
                  </div>
                  <div>
                    <div className="font-bold text-white">{track.title}</div>
                    <div className="mt-1 text-xs text-gray-500">
                      {track.date} · {track.status} · {track.durationLabel}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className="border-white/10 text-gray-300">
                    {track.plays.toLocaleString()}
                  </Badge>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-9 w-9 rounded-full hover:bg-purple-500/20 hover:text-purple-300"
                    onClick={(e) => { e.stopPropagation(); selectTrack(track); }}
                  >
                    <Play className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-9 w-9 rounded-full hover:bg-cyan-500/20 hover:text-cyan-300"
                    onClick={(e) => { e.stopPropagation(); router.push(`/producer/editor?trackId=${track.id}&title=${encodeURIComponent(track.title)}`); }}
                  >
                    <Edit2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {currentTrack ? (
        <div className="rounded-2xl border border-white/10 bg-[#0c0c0e]/60 p-6 backdrop-blur-xl">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <div className="text-lg font-bold text-white">{currentTrack.title}</div>
              <div className="text-sm text-gray-400">{currentTrack.style}</div>
            </div>
            <Badge className="border border-cyan-500/20 bg-cyan-500/10 text-cyan-400">
              Preview Active
            </Badge>
          </div>
          <div className="flex items-center gap-3 text-xs text-gray-500">
            <Volume2 className="h-4 w-4 text-cyan-400" />
            {Math.round((currentTime / Math.max(currentTrack.durationSec, 1)) * 100)}% complete
          </div>
        </div>
      ) : null}

      <MusicGenerationDialog
        isOpen={showGenerator}
        onClose={() => setShowGenerator(false)}
        onGenerate={workspace.generateTrack}
        onSuccess={(track) => {
          setCurrentTrackId(track.id);
          setCurrentTime(0);
          setIsPlaying(true);
          setShowGenerator(false);
        }}
        lang="en"
      />

      <GlobalAudioPlayer
        currentSong={currentTrack}
        isPlaying={isPlaying}
        onPlayPause={() => setIsPlaying((current) => !current)}
        onNext={() => moveTrack(1)}
        onPrevious={() => moveTrack(-1)}
        onClose={() => {
          setCurrentTrackId(null);
          setCurrentTime(0);
          setIsPlaying(false);
        }}
        onSeek={(time) => setCurrentTime(time)}
        currentTime={currentTime}
        duration={currentTrack?.durationSec ?? 0}
      />
    </div>
  );
}
