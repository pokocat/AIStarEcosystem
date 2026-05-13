"use client";

// /producer/artist — 艺人视图（聚焦单位 activeArtist）
import { ArtistOverview } from "@/components/producer/dashboard/ArtistOverview";
import { useProducerShell } from "@/lib/producer-shell-context";
import { NoArtistState } from "../_shared/NoArtistState";

export default function ProducerArtistPage() {
  const { activeArtist, setActiveArtist, artists, songs, navigate } = useProducerShell();
  if (!activeArtist) return <NoArtistState />;
  return (
    <ArtistOverview
      artist={activeArtist}
      artists={artists}
      songs={songs}
      onSelectArtist={setActiveArtist}
      onNavigate={navigate}
    />
  );
}
