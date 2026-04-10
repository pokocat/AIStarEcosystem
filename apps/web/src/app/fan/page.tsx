"use client";

import { useRouter } from "next/navigation";
import { FanAppPage } from "@/views/FanAppPage";
import { LoadingPanel, ErrorPanel } from "@/features/shared/components/page-feedback";
import { useDictionary } from "@/features/shared/hooks/use-dictionary";
import { useNftCollections } from "@/features/nft/hooks/use-nft-collections";
import { useTracks } from "@/features/tracks/hooks/use-tracks";

export default function FanRoute() {
  const router = useRouter();
  const { lang, copy, toggleLang } = useDictionary();
  const tracks = useTracks(lang);
  const collections = useNftCollections();

  if (tracks.error || collections.error) {
    return <ErrorPanel title="Failed to load fan experience" detail={tracks.error ?? collections.error ?? undefined} />;
  }

  if (tracks.isLoading || collections.isLoading || !tracks.data || !collections.data) {
    return <LoadingPanel label="Loading fan experience..." />;
  }

  return (
    <FanAppPage
      lang={lang}
      copy={copy.fan}
      chartData={tracks.data.chartEntries}
      lyrics={tracks.data.lyrics}
      marketCollections={collections.data.collections}
      discoverySpotlight={tracks.data.discoverySpotlight}
      recommendations={tracks.data.recommendations}
      onBack={() => router.push("/portal")}
      onToggleLang={toggleLang}
    />
  );
}
