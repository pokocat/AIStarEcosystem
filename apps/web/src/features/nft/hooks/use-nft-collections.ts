"use client";

import { useEffect, useState } from "react";
import { fetcher } from "@/lib/http/fetcher";
import type { NftCollectionsPayload, NftMintRequest } from "@/types/contracts/nft";

export function useNftCollections() {
  const [data, setData] = useState<NftCollectionsPayload | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    fetcher<NftCollectionsPayload>("/api/nft/collections")
      .then((payload) => {
        if (!alive) return;
        setData(payload);
      })
      .catch((err) => {
        if (!alive) return;
        setError(err instanceof Error ? err.message : "Failed to load NFT collections");
      })
      .finally(() => {
        if (!alive) return;
        setIsLoading(false);
      });

    return () => {
      alive = false;
    };
  }, []);

  const mintCollection = async (request: NftMintRequest) => {
    return fetcher<{ success: boolean; contractAddress: string; tokenId: string }>("/api/nft/mint", {
      method: "POST",
      body: JSON.stringify(request)
    });
  };

  return { data, isLoading, error, mintCollection };
}
