/**
 * Studio 场景目录（AI 图片 / AI 视频）。真源在服务端：运营在后台「Studio 场景模板」改过就用改过的（平台配置
 * `studio.scene-catalog`），否则用随包的 `ipstudio/scenes.json`；经 `GET /v1/ip-studio/scenes` 下发（只含上架的场景）。
 * 出图描述、编导写脚本的要求和交给助手的话由 `POST /v1/ip-studio/scenes/compose` 在服务端拼。字段名与 Java `StudioSceneCatalog` 一一对应。
 */
export interface StudioSceneGroup { id: string; title: string }
/** 参考图位：按顺序是图1、图2…；描述里的「图N」对应这里。 */
export interface StudioSceneRef { label: string; required: boolean; hint?: string | null }
/** 由 key 签出来的地址（会过期，不存）。 */
export interface StudioSceneMedia { url: string; mediaType: "image" | "video" }
/** 运营配的封面和参考示例：目录里存 key，下发时签成地址。用户端只拿到地址。 */
export interface StudioSceneMediaFields {
  /** 后台：false = 下架（用户端不出现，旧草稿照常打开）。用户端不下发。 */
  enabled?: boolean | null;
  /** 后台：封面 / 示例的存储 key。用户端不下发。 */
  coverKey?: string | null;
  exampleKeys?: string[] | null;
  /** 封面地址；没有时用随包的封面图（按场景编号），再没有就显示首字。 */
  coverUrl?: string | null;
  /** 参考示例（图片或视频）。 */
  examples?: StudioSceneMedia[] | null;
}
export interface StudioImageScene extends StudioSceneMediaFields {
  id: string; group: string; title: string; description: string;
  refs: StudioSceneRef[];
  /** 场景写好的描述；界面只显示场景标签，用户写的是补充要求。 */
  prompt: string;
  /** 补充要求输入框的提示。 */
  hint: string;
  ratio: string;
}
export interface StudioSceneSlot { label: string; required: boolean; max?: number | null }
export interface StudioVideoScene extends StudioSceneMediaFields {
  id: string; group: string; title: string; description: string;
  images: StudioSceneSlot; video?: StudioSceneSlot | null; character: boolean; voice: boolean;
  /** 输入框里的示例。 */
  placeholder: string;
  /** 没有素材可看的场景（剧情、口播、复刻），这句话必须写。 */
  textRequired: boolean;
  /** 交给创作助手分段做时的可选时长；编导一次出片的时长由所选视频模型决定，默认取 duration（超出就取模型上限）。 */
  durations: number[]; duration: number; ratio: "9:16" | "16:9";
  /** 这类视频通常怎么拍（拼进编导和助手的要求里）。 */
  structure: string;
  ideas: string[];
  /** 交给助手时用的方法（技能 key）；`reference-video-recreation`（爆款复刻）要先拉片，只走助手。 */
  skill: string;
}
export interface StudioSceneCatalog {
  version: number;
  imageGroups: StudioSceneGroup[]; videoGroups: StudioSceneGroup[];
  image: StudioImageScene[]; video: StudioVideoScene[];
}
export interface StudioSceneComposeRequest {
  /** image = 出图描述；video = 交给画布创作助手的话；video-script = 交给编导写脚本的要求。 */
  kind: "image" | "video" | "video-script"; sceneId: string;
  /** 图片：补充要求；视频：用户写的那句。 */
  text?: string;
  /** 图片：用户改过的完整描述。 */
  custom?: string;
  /** 图片：放了图的参考图位（从 0 起）。 */
  filled?: number[];
  /** 视频：按交给模型的顺序（编导写脚本时就是图1、图2…）。 */
  imageTitles?: string[]; characterTitle?: string; voiceTitle?: string; videoTitle?: string;
  duration?: number; ratio?: string;
  /** 编导：台词语言，默认中文。 */
  language?: string;
  /** 编导：对上一版脚本的修改意见。 */
  revision?: string;
}
/** 图片：`text` 是出图描述；视频：`text` 是交给助手的话，`skillKey` 是该场景的方法；编导：`text` 是写脚本的要求。 */
export interface StudioSceneComposed { text: string; skillKey?: string | null }

/**
 * Studio 运营后台「场景模板」页（`apps/web-aiavatar/studio-admin` 的 `/scenes`）读的整份目录：
 * `GET /admin/studio/scenes`。含下架的场景，封面 / 示例带签名预览；source=default 表示还在用随包那份（version=0）。
 */
export interface StudioSceneAdminView {
  catalog: StudioSceneCatalog;
  source: "default" | "custom";
  version: number;
  /** 视频场景能选的方法（技能 key）。 */
  skills: string[];
}
/** `POST /admin/studio/scenes/media`：key 写进目录，url 只用来预览。 */
export interface StudioSceneUploaded { key: string; url: string; mediaType: "image" | "video" }
