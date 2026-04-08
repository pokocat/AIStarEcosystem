import type { NftMintRequest } from "@/types/contracts/nft";
import { resolveNftCollections } from "@/mocks/nft/resolver";

export async function getNftCollections() {
  return resolveNftCollections();
}

export async function mintNft(request: NftMintRequest) {
  return {
    success: true,
    contractAddress: "0x7a...b3f2",
    tokenId: `token-${Date.now()}`,
    request
  };
}
