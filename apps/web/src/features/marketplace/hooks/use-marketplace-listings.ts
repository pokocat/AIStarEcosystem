"use client";

import { useEffect, useState } from "react";
import { fetcher } from "@/lib/http/fetcher";
import type { ArtistSigningRequest, MarketplaceListing } from "@/types/contracts/marketplace";

export function useMarketplaceListings() {
  const [data, setData] = useState<MarketplaceListing[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    fetcher<MarketplaceListing[]>("/api/marketplace/listings")
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

  const signArtist = async (request: ArtistSigningRequest) => {
    return fetcher<{ success: boolean; signedArtistId: string }>("/api/marketplace/sign", {
      method: "POST",
      body: JSON.stringify(request)
    });
  };

  return { data, isLoading, error, signArtist };
}
