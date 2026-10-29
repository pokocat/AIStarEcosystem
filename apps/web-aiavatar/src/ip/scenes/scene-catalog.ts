/**
 * 场景页的前端部分。场景本身（描述、拍法、方法）的唯一真源是服务端 `ipstudio/scenes.json`，
 * 经 `GET /v1/ip-studio/scenes` 读；出图描述和交给助手的话由 `POST /v1/ip-studio/scenes/compose` 拼。
 * 这里只留界面用的东西：读目录、封面地址、首页的目标卡。真源 docs/studio-scene-creation.md §7。
 */
import { useEffect, useState } from "react";
import type { StudioSceneCatalog } from "@ai-star-eco/types";
import { IpStudioApi } from "../api";

export type { StudioImageScene as ImageScene, StudioVideoScene as VideoScene, StudioSceneCatalog as SceneCatalog } from "@ai-star-eco/types";

/** 不选场景时的「自由出图」。 */
export const FREE_SCENE_ID = "free";

export const sceneCover = (id: string) => `/studio/scene-covers/${id}.webp`;
export const findImageScene = (catalog: StudioSceneCatalog | undefined, id?: string | null) => catalog?.image.find(s => s.id === id);
export const findVideoScene = (catalog: StudioSceneCatalog | undefined, id?: string | null) => catalog?.video.find(s => s.id === id);
export const sceneKind = (catalog: StudioSceneCatalog | undefined, id?: string | null): "image" | "video" | undefined =>
  findImageScene(catalog, id) ? "image" : findVideoScene(catalog, id) ? "video" : undefined;

let cached: Promise<StudioSceneCatalog> | undefined;
/** 目录一页面只读一次；读失败下次再读，不缓存失败。 */
export function loadSceneCatalog(): Promise<StudioSceneCatalog> {
  cached ??= IpStudioApi.listScenes().catch(error => { cached = undefined; throw error; });
  return cached;
}

export function useSceneCatalog(ready: boolean) {
  const [catalog, setCatalog] = useState<StudioSceneCatalog>();
  const [error, setError] = useState<unknown>();
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    if (!ready) return;
    let active = true;
    setError(undefined);
    void loadSceneCatalog().then(c => { if (active) setCatalog(c); }).catch(e => { if (active) setError(e); });
    return () => { active = false; };
  }, [ready, revision]);
  return { catalog, error, retry: () => setRevision(n => n + 1) };
}

/** 首页「你想做什么？」：每张卡片落到一个场景（编号要在服务端目录里，测试守着）。 */
export const homeGoals: { id: string; title: string; description: string; href: string; covers: [string, string]; kind: "video" | "image" }[] = [
  { id: "recreation", title: "爆款复刻", description: "照着爆款的结构，做自己的版本", href: "/video?scene=recreation", covers: ["recreation", "ecom-talking"], kind: "video" },
  { id: "product-set", title: "商品套图", description: "白底图、卖点图、模特图一起出", href: "/image?scene=white-background", covers: ["white-background", "selling-point"], kind: "image" },
  { id: "commerce", title: "电商带货", description: "商品展示和带货短视频", href: "/video?scene=ecom-talking", covers: ["ecom-talking", "ecom-seeding"], kind: "video" },
  { id: "local", title: "同城到店", description: "探店、团购，拍给附近的人看", href: "/video?scene=local-discovery", covers: ["local-discovery", "local-signature"], kind: "video" },
  { id: "brand", title: "品牌广告", description: "讲理念、讲故事的品牌片", href: "/video?scene=brand-proposition", covers: ["brand-proposition", "brand-lifestyle"], kind: "video" },
  { id: "drama", title: "剧情短片", description: "有冲突、有反转的短剧情", href: "/video?scene=drama-twist", covers: ["drama-twist", "drama-emotional"], kind: "video" },
  { id: "ip", title: "IP 形象", description: "一张照片做出设定图和写真", href: "/image?scene=ip-sheet", covers: ["ip-sheet", "ip-portrait"], kind: "image" },
];
