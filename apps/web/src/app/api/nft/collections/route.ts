import { jsonError, jsonOk } from "@/server/response";
import { listNftCollections } from "@/server/services/nft-service";

export async function GET() {
  try {
    const data = await listNftCollections();
    return jsonOk(data);
  } catch (error) {
    return jsonError(error);
  }
}
