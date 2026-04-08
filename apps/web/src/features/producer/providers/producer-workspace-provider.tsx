"use client";

import { createContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { fetcher } from "@/lib/http/fetcher";
import { useDictionary } from "@/features/shared/hooks/use-dictionary";
import { useDashboardData } from "@/features/analytics/hooks/use-dashboard-data";
import { useMarketplaceListings } from "@/features/marketplace/hooks/use-marketplace-listings";
import { useNftCollections } from "@/features/nft/hooks/use-nft-collections";
import { useSingers } from "@/features/singers/hooks/use-singers";
import { useTracks } from "@/features/tracks/hooks/use-tracks";
import type { DistributionPublishRequest } from "@/types/contracts/distribution";
import type { NftMintRequest } from "@/types/contracts/nft";
import type { ArtistSigningRequest } from "@/types/contracts/marketplace";
import type { SingerDetail } from "@/types/contracts/singers";
import type { TrackGenerationRequest } from "@/types/contracts/tracks";

const ONBOARDING_KEY = "ai-star-eco-onboarding-complete";

export interface ProducerWorkspaceContextValue {
  lang: "zh" | "en";
  activeSinger: SingerDetail | null;
  activeSingerId: string | null;
  setActiveSingerId: (id: string) => void;
  singerWorkspace: ReturnType<typeof useSingers>["data"];
  trackWorkspace: ReturnType<typeof useTracks>["data"];
  dashboard: ReturnType<typeof useDashboardData>["data"];
  marketplaceListings: ReturnType<typeof useMarketplaceListings>["data"];
  nftCollections: NonNullable<ReturnType<typeof useNftCollections>["data"]>["collections"];
  isBootstrapping: boolean;
  errors: string[];
  showOnboarding: boolean;
  dismissOnboarding: () => void;
  completeOnboarding: () => void;
  createSinger: ReturnType<typeof useSingers>["createSinger"];
  updateSinger: ReturnType<typeof useSingers>["updateSinger"];
  deleteSinger: ReturnType<typeof useSingers>["deleteSinger"];
  generateTrack: (request: TrackGenerationRequest) => Promise<Awaited<ReturnType<ReturnType<typeof useTracks>["generateTrack"]>>>;
  mintCollection: (request: NftMintRequest) => Promise<Awaited<ReturnType<ReturnType<typeof useNftCollections>["mintCollection"]>>>;
  signArtist: (request: ArtistSigningRequest) => Promise<Awaited<ReturnType<ReturnType<typeof useMarketplaceListings>["signArtist"]>>>;
  publishDistribution: (request: DistributionPublishRequest) => Promise<{ success: boolean; publishJobId: string }>;
}

export const ProducerWorkspaceContext = createContext<ProducerWorkspaceContextValue | undefined>(undefined);

export function ProducerWorkspaceProvider({ children }: { children: ReactNode }) {
  const { lang } = useDictionary();
  const singers = useSingers(lang);
  const tracks = useTracks(lang);
  const analytics = useDashboardData();
  const nft = useNftCollections();
  const marketplace = useMarketplaceListings();
  const [activeSingerId, setActiveSingerId] = useState<string | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    const singerId = singers.data?.singers[0]?.id;
    if (!activeSingerId && singerId) {
      setActiveSingerId(singerId);
    }
  }, [activeSingerId, singers.data?.singers]);

  useEffect(() => {
    if (!singers.data?.singers.length || !activeSingerId) {
      return;
    }

    const exists = singers.data.singers.some((singer) => singer.id === activeSingerId);
    if (!exists) {
      setActiveSingerId(singers.data.singers[0]?.id ?? null);
    }
  }, [activeSingerId, singers.data?.singers]);

  useEffect(() => {
    const completed = window.localStorage.getItem(ONBOARDING_KEY);
    if (!completed) {
      const timer = window.setTimeout(() => setShowOnboarding(true), 500);
      return () => window.clearTimeout(timer);
    }

    return undefined;
  }, []);

  const activeSinger =
    singers.data?.singers.find((singer) => singer.id === activeSingerId) ??
    singers.data?.singers[0] ??
    null;

  const errors = [
    singers.error,
    tracks.error,
    analytics.error,
    nft.error,
    marketplace.error
  ].filter((value): value is string => Boolean(value));

  const isBootstrapping =
    singers.isLoading ||
    tracks.isLoading ||
    analytics.isLoading ||
    nft.isLoading ||
    marketplace.isLoading;

  const value = useMemo<ProducerWorkspaceContextValue>(
    () => ({
      lang,
      activeSinger,
      activeSingerId,
      setActiveSingerId,
      singerWorkspace: singers.data,
      trackWorkspace: tracks.data,
      dashboard: analytics.data,
      marketplaceListings: marketplace.data,
      nftCollections: nft.data?.collections ?? [],
      isBootstrapping,
      errors,
      showOnboarding,
      dismissOnboarding: () => setShowOnboarding(false),
      completeOnboarding: () => {
        window.localStorage.setItem(ONBOARDING_KEY, "true");
        setShowOnboarding(false);
      },
      createSinger: singers.createSinger,
      updateSinger: singers.updateSinger,
      deleteSinger: singers.deleteSinger,
      generateTrack: tracks.generateTrack,
      mintCollection: nft.mintCollection,
      signArtist: marketplace.signArtist,
      publishDistribution: async (request) => {
        return fetcher<{ success: boolean; publishJobId: string }>("/api/distribution/publish", {
          method: "POST",
          body: JSON.stringify(request)
        });
      }
    }),
    [
      activeSinger,
      activeSingerId,
      analytics.data,
      errors,
      isBootstrapping,
      lang,
      marketplace.data,
      nft.data?.collections,
      showOnboarding,
      singers.createSinger,
      singers.data,
      singers.deleteSinger,
      singers.updateSinger,
      tracks.data,
      tracks.generateTrack,
      nft.mintCollection,
      marketplace.signArtist
    ]
  );

  return <ProducerWorkspaceContext.Provider value={value}>{children}</ProducerWorkspaceContext.Provider>;
}
