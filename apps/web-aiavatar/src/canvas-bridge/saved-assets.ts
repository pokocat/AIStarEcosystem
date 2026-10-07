import { apiFetch, USE_MOCK, mockDelay } from "@/ip/api/_client";
import type { IpSavedAsset } from "@ai-star-eco/types";
type Input<T> = T extends IpSavedAsset ? Omit<T, "id" | "createdAt" | "updatedAt"> : never;
export type SavedAssetInput = Input<IpSavedAsset>;
const mockAssets = new Map<string, IpSavedAsset>();
export async function listSavedAssets(): Promise<IpSavedAsset[]> {
  if (USE_MOCK) return mockDelay([...mockAssets.values()]);
  await importLegacyAssets();
  return apiFetch("/v1/ip-studio/saved-assets");
}
export async function saveAsset(asset: SavedAssetInput): Promise<IpSavedAsset> {
  if (USE_MOCK) {
    const now = new Date().toISOString();
    const row = { ...asset, id: `mock-${mockAssets.size}`, createdAt: now, updatedAt: now } as IpSavedAsset;
    mockAssets.set(row.id, row); return mockDelay(row);
  }
  return apiFetch("/v1/ip-studio/saved-assets", { method: "POST", body: asset });
}
export async function deleteSavedAsset(id: string): Promise<void> {
  if (USE_MOCK) { mockAssets.delete(id); return mockDelay(undefined); }
  await apiFetch(`/v1/ip-studio/saved-assets/${id}`, { method: "DELETE" });
}

let migration: Promise<void> | null = null;
async function importLegacyAssets(): Promise<void> {
  if (typeof window === "undefined") return;
  if (migration) return migration;
  migration = (async () => {
    const { localForageStorage } = await import("@/canvas/lib/localforage-storage");
    const name = "infinite-canvas:asset_store";
    const raw = await localForageStorage.getItem(name);
    if (!raw) return;
    let old: { state?: { assets?: IpSavedAsset[] } };
    try { old = JSON.parse(raw); } catch { return; }
    if (!Array.isArray(old.state?.assets)) return;
    const owner = await apiFetch<{ id: string }>("/me");
    const ownerSegment = `/${owner.id.replace(/[^a-zA-Z0-9_-]/g, "_")}/`;
    const imported = new Set<string>();
    for (const asset of old.state.assets) {
      if ((asset.kind !== "image" && asset.kind !== "video") || !asset.data.storageKey?.includes(ownerSegment)) continue;
      // Server repeats the ownership check. A failed import leaves the original browser entry for retry.
      await saveAsset(asset); imported.add(asset.id);
    }
    if (imported.size) {
      old.state.assets = old.state.assets.filter((a) => !imported.has(a.id));
      await localForageStorage.setItem(name, JSON.stringify(old));
    }
  })().finally(() => { migration = null; });
  return migration;
}
