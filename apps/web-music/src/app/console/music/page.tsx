"use client";

// /producer/music — 音乐商业视图
import { MusicBusiness } from "@/components/MusicBusiness";
import { useProducerShell } from "@/lib/producer-shell-context";
import { NoArtistState } from "../_shared/NoArtistState";

export default function ProducerMusicPage() {
  const { lang, activeArtist, navigate } = useProducerShell();
  if (!activeArtist) return <NoArtistState />;
  return (
    <MusicBusiness
      lang={lang}
      artist={{ id: activeArtist.id, name: activeArtist.name, avatar: activeArtist.avatar }}
      onBack={() => navigate("overview")}
    />
  );
}
