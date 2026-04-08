import type { NftMintRequest } from "@/types/contracts/nft";
import * as mockAdapter from "@/server/adapters/mock/nft";
import * as springAdapter from "@/server/adapters/spring/nft";
import { shouldUseMockData } from "@/server/services/shared";

export async function listNftCollections() {
  return shouldUseMockData() ? mockAdapter.getNftCollections() : springAdapter.getNftCollections();
}

export async function mintNftCollection(request: NftMintRequest) {
  return shouldUseMockData() ? mockAdapter.mintNft(request) : springAdapter.mintNft(request);
}
