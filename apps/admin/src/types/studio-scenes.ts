// ─────────────────────────────────────────────────────────────────────────────
// types/studio-scenes.ts — Studio 场景模板（AI 图片 / AI 视频两页左侧的场景）。
// 与 packages/types/src/ip-studio-scenes.ts 同名同字段（admin 直接复制）；后台多一份 StudioSceneAdminView。
// 目录里存 key，coverUrl / examples 是服务端签出来的地址（会过期，保存时服务端丢掉）。
// ─────────────────────────────────────────────────────────────────────────────

export interface StudioSceneGroup { id: string; title: string }
export interface StudioSceneRef { label: string; required: boolean; hint?: string | null }
export interface StudioSceneMedia { url: string; mediaType: "image" | "video" }
export interface StudioSceneMediaFields {
  /** false = 下架：用户端不出现，旧草稿照常打开。 */
  enabled?: boolean | null;
  coverKey?: string | null;
  exampleKeys?: string[] | null;
  coverUrl?: string | null;
  examples?: StudioSceneMedia[] | null;
}
export interface StudioImageScene extends StudioSceneMediaFields {
  id: string; group: string; title: string; description: string;
  refs: StudioSceneRef[];
  prompt: string;
  hint: string;
  ratio: string;
}
export interface StudioSceneSlot { label: string; required: boolean; max?: number | null }
export interface StudioVideoScene extends StudioSceneMediaFields {
  id: string; group: string; title: string; description: string;
  images: StudioSceneSlot; video?: StudioSceneSlot | null; character: boolean; voice: boolean;
  placeholder: string;
  textRequired: boolean;
  durations: number[]; duration: number; ratio: "9:16" | "16:9";
  structure: string;
  ideas: string[];
  skill: string;
}
export interface StudioSceneCatalog {
  version: number;
  imageGroups: StudioSceneGroup[]; videoGroups: StudioSceneGroup[];
  image: StudioImageScene[]; video: StudioVideoScene[];
}

/** GET /admin/studio/scenes：当前生效的整份目录（含下架的）。source=default 表示还在用随包的那份，version=0。 */
export interface StudioSceneAdminView {
  catalog: StudioSceneCatalog;
  source: "default" | "custom";
  version: number;
  /** 视频场景能选的方法（技能 key）。 */
  skills: string[];
}
/** POST /admin/studio/scenes/media */
export interface StudioSceneUploaded { key: string; url: string; mediaType: "image" | "video" }
