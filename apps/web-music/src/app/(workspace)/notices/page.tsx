"use client";

// /notices — 商业邀约 / 通告墙
import { NoticeBoard } from "@/components/NoticeBoard";
import { useProducerShell } from "@/lib/producer-shell-context";
import { NoArtistState } from "../_shared/NoArtistState";

export default function ProducerNoticesPage() {
  const { activeArtist } = useProducerShell();
  if (!activeArtist) return <NoArtistState />;
  return <NoticeBoard artist={activeArtist} />;
}
