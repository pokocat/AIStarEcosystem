import { jsonError, jsonOk } from "@/server/response";
import { deleteSinger, updateSinger } from "@/server/services/singers-service";
import type { SingerDetail } from "@/types/contracts/singers";

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  try {
    const body = (await request.json()) as SingerDetail;
    const data = await updateSinger(params.id, body);
    return jsonOk(data);
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  try {
    const data = await deleteSinger(params.id);
    return jsonOk(data);
  } catch (error) {
    return jsonError(error);
  }
}
