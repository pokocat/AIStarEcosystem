import { beforeEach, expect, it, vi } from "vitest";
const list = vi.fn(), save = vi.fn(), remove = vi.fn();
vi.mock("./saved-assets", () => ({ listSavedAssets: (...a: unknown[]) => list(...a), saveAsset: (...a: unknown[]) => save(...a), deleteSavedAsset: (...a: unknown[]) => remove(...a) }));
vi.mock("./image-storage", () => ({ uploadImage: vi.fn() }));
import { useAssetStore } from "@/canvas/stores/use-asset-store";
const input = { kind: "image" as const, title: "图", coverUrl: "", tags: [], data: { storageKey: "owned/key.jpg", dataUrl: "", width: 1, height: 1, bytes: 1, mimeType: "image/jpeg" } };
const row = { ...input, id: "IPA-1", createdAt: "now", updatedAt: "now" };
beforeEach(() => { useAssetStore.getState().reset(); list.mockReset(); save.mockReset(); remove.mockReset(); });
it("only adds a cloud-confirmed asset and loads it on a later visit", async () => {
  save.mockResolvedValue(row); await useAssetStore.getState().addAsset(input);
  expect(useAssetStore.getState().assets).toHaveLength(1);
  useAssetStore.getState().reset(); list.mockResolvedValue([row]); await useAssetStore.getState().loadAssets();
  expect(useAssetStore.getState().assets[0]?.id).toBe(row.id);
});
it("save failures reject without a false local asset", async () => {
  save.mockRejectedValue(new Error("网络失败"));
  await expect(useAssetStore.getState().addAsset(input)).rejects.toThrow("网络失败");
  expect(useAssetStore.getState().assets).toEqual([]);
});
it("late responses after an account switch never repopulate the previous user's assets", async () => {
  let resolve!: (v: unknown) => void; list.mockImplementation(() => new Promise(r => { resolve = r; }));
  const pending = useAssetStore.getState().loadAssets(); useAssetStore.getState().reset(); resolve([row]); await pending;
  expect(useAssetStore.getState().assets).toEqual([]);
});
it("failed removal keeps the asset so deletion can be retried", async () => {
  save.mockResolvedValue(row); await useAssetStore.getState().addAsset(input); remove.mockRejectedValue(new Error("断网"));
  await expect(useAssetStore.getState().removeAsset(row.id)).rejects.toThrow();
  expect(useAssetStore.getState().assets).toHaveLength(1);
});

it("a successful save is not hidden by an older list response", async () => {
  let resolve!: (v: unknown) => void;
  list.mockImplementationOnce(() => new Promise(r => { resolve = r; })).mockResolvedValue([row]);
  const pending = useAssetStore.getState().loadAssets(); save.mockResolvedValue(row);
  await useAssetStore.getState().addAsset(input); resolve([]); await pending;
  await Promise.resolve(); await Promise.resolve();
  expect(useAssetStore.getState().assets).toEqual([row]);
});
