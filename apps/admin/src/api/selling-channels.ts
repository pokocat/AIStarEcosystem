import { apiFetch } from "./_client";
import type { SellingChannel } from "@/types/selling-channel";

/** GET /admin/selling-channels */
export async function listChannels(): Promise<SellingChannel[]> {
  return apiFetch<SellingChannel[]>("/admin/selling-channels");
}

/** GET /admin/selling-channels/{id} */
export async function getChannel(id: string): Promise<SellingChannel> {
  return apiFetch<SellingChannel>(`/admin/selling-channels/${encodeURIComponent(id)}`);
}

/** POST /admin/selling-channels */
export async function createChannel(body: Partial<SellingChannel>): Promise<SellingChannel> {
  return apiFetch<SellingChannel>("/admin/selling-channels", { method: "POST", body });
}

/** PUT /admin/selling-channels/{id} */
export async function updateChannel(id: string, body: Partial<SellingChannel>): Promise<SellingChannel> {
  return apiFetch<SellingChannel>(
    `/admin/selling-channels/${encodeURIComponent(id)}`,
    { method: "PUT", body },
  );
}

/** DELETE /admin/selling-channels/{id} — 软删（status → inactive） */
export async function deleteChannel(id: string): Promise<void> {
  await apiFetch<void>(`/admin/selling-channels/${encodeURIComponent(id)}`, { method: "DELETE" });
}
