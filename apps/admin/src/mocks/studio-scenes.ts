// 演示模式（USE_MOCK=1）的场景目录：照服务端 GET /admin/studio/scenes 的形状挑几条；保存只改内存，刷新页面就回到这份。
import type { StudioSceneAdminView, StudioSceneCatalog, StudioSceneUploaded } from "@/types/studio-scenes";
import { ApiError } from "@/api/_client";

const PREFIX = "ipstudio_scene/catalog/";
const builtIn = (): StudioSceneCatalog => ({
  version: 1,
  imageGroups: [{ id: "person", title: "人物" }, { id: "product", title: "商品" }],
  videoGroups: [{ id: "commerce", title: "电商带货" }, { id: "local", title: "同城到店" }],
  image: [
    { id: "face-turnaround", group: "person", title: "脸部三视图", description: "正脸、半侧脸、侧脸，做角色参考", refs: [{ label: "人物照片", required: true, hint: "正脸清晰" }],
      prompt: "以图1人物为准，生成纯白背景的头部三视图。", hint: "可以补充气质、表情", ratio: "16:9" },
    { id: "white-background", group: "product", title: "商品白底图", description: "干净的白底主图", refs: [{ label: "商品图", required: true, hint: null }],
      prompt: "把图1中的商品单独放到纯白背景正中。", hint: "可以补充角度和摆放", ratio: "1:1" },
  ],
  video: [
    { id: "ecom-talking", group: "commerce", title: "口播带货", description: "有人出镜推荐，建立购买信任", images: { label: "商品图", required: true, max: 4 }, video: null,
      character: true, voice: true, placeholder: "说说卖什么、想突出哪一点", textRequired: false, durations: [15, 25, 30, 45], duration: 25, ratio: "9:16",
      structure: "真人对着镜头讲：开头一句话说清商品能解决什么，中间展示商品，结尾引导下单。", ideas: ["开头用一个反常识的说法抓人"], skill: "video-generation" },
  ],
});

let state: { catalog: StudioSceneCatalog; version: number } = { catalog: builtIn(), version: 0 };
const view = (): StudioSceneAdminView => ({ catalog: structuredClone(state.catalog), source: state.version ? "custom" : "default", version: state.version,
  skills: ["reference-video-recreation", "video-generation"] });

export const resetMockStudioScenes = () => { state = { catalog: builtIn(), version: 0 }; };
export const mockGetStudioScenes = () => view();
export function mockSaveStudioScenes(catalog: StudioSceneCatalog, baseVersion: number): StudioSceneAdminView {
  if (baseVersion !== state.version) throw new ApiError({ code: "STUDIO_SCENE_CATALOG_STALE", message: "场景目录刚被别人改过，请刷新后再改" }, 409);
  const ids = [...catalog.image, ...catalog.video].map(s => s.id);
  if (new Set(ids).size !== ids.length) throw new ApiError({ code: "STUDIO_SCENE_CATALOG_INVALID", message: "场景编号重复" }, 400);
  state = { catalog: structuredClone(catalog), version: state.version + 1 };
  return view();
}
export function mockResetStudioScenes(baseVersion: number): StudioSceneAdminView {
  if (baseVersion !== state.version) throw new ApiError({ code: "STUDIO_SCENE_CATALOG_STALE", message: "场景目录刚被别人改过，请刷新后再改" }, 409);
  state = { catalog: builtIn(), version: 0 };
  return view();
}
let uploads = 0;
export function mockUploadStudioSceneMedia(file: File): StudioSceneUploaded {
  const video = /\.mp4$/i.test(file.name);
  const key = `${PREFIX}mock-${++uploads}.${video ? "mp4" : "png"}`;
  return { key, url: typeof URL.createObjectURL === "function" ? URL.createObjectURL(file) : `/mock/${key}`, mediaType: video ? "video" : "image" };
}
