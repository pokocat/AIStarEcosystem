"use client";

// /producer — 经纪大盘（公司视角，不依赖 activeArtist）
import { AgencyOverview } from "@/components/producer/dashboard/AgencyOverview";
import { OverviewSkeleton } from "@/components/producer/SkeletonLoader";
import { useProducerShell } from "@/lib/producer-shell-context";

export default function ProducerOverviewPage() {
  const {
    artists, songs, monthlyRevenue,
    activeArtist, setActiveArtist,
    artistsLoading, dataLoading, navigate,
  } = useProducerShell();

  if (dataLoading || artistsLoading) return <OverviewSkeleton />;

  return (
    <AgencyOverview
      artists={artists}
      songs={songs}
      monthlyRevenue={monthlyRevenue}
      activeArtistId={activeArtist?.id}
      onNavigate={navigate}
      onOpenTrack={() => navigate("studio")}
      onSelectArtist={(a) => {
        setActiveArtist(a);
        navigate("artist");
      }}
    />
  );
}
