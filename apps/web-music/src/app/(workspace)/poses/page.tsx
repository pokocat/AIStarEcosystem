"use client";

// /poses — 动作姿态库（姿态 / 表情 / 手势 / 自定义）
import { PoseLibrary } from "@/components/PoseLibrary";
import { useProducerShell } from "@/lib/producer-shell-context";
import { NoArtistState } from "../_shared/NoArtistState";

export default function ProducerPosesPage() {
  const { activeArtist } = useProducerShell();
  if (!activeArtist) return <NoArtistState />;
  return <PoseLibrary artist={activeArtist} />;
}
