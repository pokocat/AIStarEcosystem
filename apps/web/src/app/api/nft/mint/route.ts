import { jsonError, jsonOk } from "@/server/response";
import { mintNftCollection } from "@/server/services/nft-service";
import type { NftMintRequest } from "@/types/contracts/nft";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as NftMintRequest;
    const data = await mintNftCollection(body);
    return jsonOk(data);
  } catch (error) {
    return jsonError(error);
  }
}
