import type { NftCollectionsPayload, NftMintRequest } from "@/types/contracts/nft";
import { fetcher } from "@/lib/http/fetcher";
import { resolveNftCollections } from "@/mocks/nft/resolver";

const isMock = process.env.NEXT_PUBLIC_MOCK === "true";
const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";

export async function getNftCollections(): Promise<NftCollectionsPayload> {
  if (isMock) return resolveNftCollections();
  return fetcher<NftCollectionsPayload>(`${apiBase}/api/nft/collections`);
}

export async function mintNft(request: NftMintRequest): Promise<{ success: boolean; contractAddress: string; tokenId: string }> {
  if (isMock) return { success: true, contractAddress: "0x7a...b3f2", tokenId: `token-${Date.now()}` };
  return fetcher<{ success: boolean; contractAddress: string; tokenId: string }>(`${apiBase}/api/nft/mint`, {
    method: "POST",
    body: JSON.stringify(request)
  });
}
