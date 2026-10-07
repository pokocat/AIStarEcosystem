// 本仓：云端保存，服务端返回成功后才能提示「加入我的资产」。不再把 IndexedDB 当真值。
import { create } from "zustand";
import { listSavedAssets, saveAsset, deleteSavedAsset, type SavedAssetInput } from "@/canvas-bridge/saved-assets";
import { uploadImage } from "@/canvas-bridge/image-storage";
import type { IpSavedAsset } from "@ai-star-eco/types";
export type { IpSavedAssetKind as AssetKind, IpTextAsset as TextAsset, IpImageAsset as ImageAsset, IpVideoAsset as VideoAsset } from "@ai-star-eco/types";
export type Asset = IpSavedAsset;
type AssetStore = {
  hydrated: boolean; loading: boolean; error: string | null; assets: Asset[];
  loadAssets: () => Promise<void>; reset: () => void;
  addAsset: (asset: SavedAssetInput) => Promise<string>;
  removeAsset: (id: string) => Promise<void>;
  cleanupImages: (extra?: unknown) => void;
};
let epoch = 0;
let loadId = 0;
let mutations = 0;
export const useAssetStore = create<AssetStore>((set) => ({
  hydrated: false, loading: false, error: null, assets: [],
  reset: () => { epoch++; loadId++; mutations++; set({ assets: [], hydrated: false, error: null, loading: false }); },
  loadAssets: async () => {
    const current = epoch;
    const request = ++loadId;
    const started = mutations;
    set({ loading: true, error: null });
    try { const assets = await listSavedAssets(); if (epoch === current && loadId === request) { if (mutations !== started) { void useAssetStore.getState().loadAssets(); return; } set({ assets, hydrated: true, loading: false }); } }
    catch (e) { if (epoch === current && loadId === request) set({ loading: false, hydrated: true, error: e instanceof Error ? e.message : "素材加载失败，请重试" }); }
  },
  addAsset: async (input) => {
    const current = epoch;
    let asset = input;
    if (asset.kind === "image" && !asset.data.storageKey) {
      const image = await uploadImage(asset.data.dataUrl);
      asset = { ...asset, data: { ...asset.data, storageKey: image.storageKey } };
    }
    const saved = await saveAsset(asset);
    if (epoch === current) { mutations++; set((s) => ({ assets: [saved, ...s.assets.filter((a) => a.id !== saved.id)] })); }
    return saved.id;
  },
  removeAsset: async (id) => {
    const current = epoch;
    await deleteSavedAsset(id);
    if (epoch === current) { mutations++; set((s) => ({ assets: s.assets.filter((a) => a.id !== id) })); }
  },
  // 文档和运行历史共用这些文件；只移除素材条目，不删原图。
  cleanupImages: () => {},
}));
