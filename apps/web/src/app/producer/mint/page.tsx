"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { Coins, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useDictionary } from "@/features/shared/hooks/use-dictionary";
import { useProducerWorkspace } from "@/features/producer/hooks/use-producer-workspace";
import { ErrorPanel, LoadingPanel } from "@/features/shared/components/page-feedback";
import type { TrackSummary } from "@/types/contracts/tracks";

const NFTMintingDialog = dynamic(() => import("@/components/NFTMintingDialog"), { ssr: false });

export default function ProducerMintRoute() {
  const { copy } = useDictionary();
  const workspace = useProducerWorkspace();
  const [selectedTrack, setSelectedTrack] = useState<TrackSummary | null>(null);

  const trackForDialog = useMemo(
    () => (selectedTrack ? { ...selectedTrack, duration: selectedTrack.durationLabel } : undefined),
    [selectedTrack]
  );

  if (workspace.isBootstrapping || !workspace.trackWorkspace) {
    return <LoadingPanel label="Loading mint center..." />;
  }

  if (workspace.errors.length) {
    return <ErrorPanel title="Failed to load mint center" detail={workspace.errors[0]} />;
  }

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <Card className="border-white/10 bg-[#0c0c0e]/80 backdrop-blur-xl">
        <CardHeader>
          <CardTitle>{copy.producer.mint.title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-gray-400">{copy.producer.mint.subtitle}</p>
          <div className="grid gap-4 sm:grid-cols-2">
            {workspace.trackWorkspace.tracks.map((track) => (
              <div key={track.id} className="space-y-3 rounded-xl border border-white/10 bg-black/40 p-4">
                <div className="font-bold text-white">{track.title}</div>
                <div className="text-xs text-gray-500">
                  {track.status} · {track.date} · {track.durationLabel}
                </div>
                <Button
                  className="w-full bg-gradient-to-r from-yellow-600 to-orange-600 hover:from-yellow-500 hover:to-orange-500"
                  onClick={() => setSelectedTrack(track)}
                >
                  <Coins className="mr-2 h-4 w-4" />
                  {copy.producer.mint.open}
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="border-white/10 bg-[#0c0c0e]/80 backdrop-blur-xl">
        <CardHeader>
          <CardTitle>Copyright Filing</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-3 rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-4 text-sm text-gray-300">
            <ShieldCheck className="mt-0.5 h-5 w-5 text-cyan-400" />
            <span>Register AI co-creation statements, masters, cover art, and license materials for compliant global release.</span>
          </div>
          <div className="grid gap-4 rounded-xl border border-white/10 bg-black/30 p-4">
            <div className="text-sm text-gray-400">Collections in market</div>
            {workspace.nftCollections.slice(0, 3).map((collection) => (
              <div key={collection.id} className="flex items-center justify-between rounded-lg border border-white/5 bg-black/40 px-4 py-3">
                <div>
                  <div className="font-bold text-white">{collection.name}</div>
                  <div className="text-xs text-gray-500">{collection.priceLabel}</div>
                </div>
                <div className="text-xs text-cyan-400">Remaining {collection.remaining}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <NFTMintingDialog
        isOpen={!!selectedTrack}
        onClose={() => setSelectedTrack(null)}
        onSuccess={async () => {
          if (!selectedTrack) return;
          await workspace.mintCollection({
            trackId: selectedTrack.id,
            collectionName: selectedTrack.title,
            supply: 100,
            priceEth: 0.05,
            royaltyPct: 10,
            rarity: "rare",
            enableAirdrop: false
          });
          setSelectedTrack(null);
        }}
        lang="en"
        track={trackForDialog}
      />
    </div>
  );
}
