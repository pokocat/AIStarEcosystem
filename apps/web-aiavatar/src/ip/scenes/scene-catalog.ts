/**
 * 场景页的前端部分。场景本身（描述、拍法、方法）的唯一真源是服务端 `ipstudio/scenes.json`，
 * 经 `GET /v1/ip-studio/scenes` 读；出图描述和交给助手的话由 `POST /v1/ip-studio/scenes/compose` 拼。
 * 这里只留界面用的东西：读目录、封面地址、首页卡片。真源 docs/studio-scene-creation.md §7。
 */
import { useEffect, useState } from "react";
import type { StudioSceneCatalog, StudioSceneHomeCard } from "@ai-star-eco/types";
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

/** 首页卡片点进去的地方：图片场景去 AI 图片，视频场景去 AI 视频。 */
export const sceneHref = (card: Pick<StudioSceneHomeCard, "kind" | "sceneId">) => `/${card.kind}?scene=${encodeURIComponent(card.sceneId)}`;

/**
 * 首页「你想做什么？」的卡片：运营在 Studio 后台「场景模板」里配，公开接口读（没登录也看得到）。
 * 读不出来就不显示这一块，不拿前端写死的一份顶上（两份就会对不上）。
 */
export function useSceneHomeCards() {
  const [cards, setCards] = useState<StudioSceneHomeCard[]>([]);
  useEffect(() => {
    let active = true;
    void IpStudioApi.sceneHomeCards().then(list => { if (active) setCards(list); }).catch(() => undefined);
    return () => { active = false; };
  }, []);
  return cards;
}
