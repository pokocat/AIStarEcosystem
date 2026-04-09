"use client";

import { useEffect, useState } from "react";
import type { ArtistSigningRequest, MarketplaceListing } from "@/types/contracts/marketplace";
import { getMarketplaceListings, signArtist } from "@/api/marketplace";

export function useMarketplaceListings() {
  const [data, setData] = useState<MarketplaceListing[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    getMarketplaceListings()
      .then((payload) => {
        if (!alive) return;
        setData(payload);
      })
      .catch((err) => {
        if (!alive) return;
        setError(err instanceof Error ? err.message : "Failed to load marketplace listings");
      })
      .finally(() => {
        if (!alive) return;
        setIsLoading(false);
      });

    return () => {
      alive = false;
    };
  }, []);

  const handleSignArtist = async (request: ArtistSigningRequest) => {
    return signArtist(request);
  };

  return { data, isLoading, error, signArtist: handleSignArtist };
}
