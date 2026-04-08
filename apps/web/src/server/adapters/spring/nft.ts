import type { NftCollectionsPayload, NftMintRequest } from "@/types/contracts/nft";
import { proxySpring } from "@/server/adapters/spring/shared";

export async function getNftCollections() {
  return proxySpring<NftCollectionsPayload>("/api/nft/collections");
}

export async function mintNft(request: NftMintRequest) {
  return proxySpring<{ success: boolean; contractAddress: string; tokenId: string }>("/api/nft/mint", {
    method: "POST",
    body: JSON.stringify(request)
  });
}
