/**
 * Studio 场景目录（AI 图片 / AI 视频）。真源是服务端 `ipstudio/scenes.json`，经 `GET /v1/ip-studio/scenes` 下发；
 * 出图描述和交给助手的话由 `POST /v1/ip-studio/scenes/compose` 在服务端拼。字段名与 Java `StudioSceneCatalog` 一一对应。
 */
export interface StudioSceneGroup { id: string; title: string }
/** 参考图位：按顺序是图1、图2…；描述里的「图N」对应这里。 */
export interface StudioSceneRef { label: string; required: boolean; hint?: string | null }
export interface StudioImageScene {
  id: string; group: string; title: string; description: string;
  refs: StudioSceneRef[];
  /** 场景写好的描述；界面只显示场景标签，用户写的是补充要求。 */
  prompt: string;
  /** 补充要求输入框的提示。 */
  hint: string;
  ratio: string;
}
export interface StudioSceneSlot { label: string; required: boolean; max?: number | null }
export interface StudioVideoScene {
  id: string; group: string; title: string; description: string;
  images: StudioSceneSlot; video?: StudioSceneSlot | null; character: boolean; voice: boolean;
  /** 输入框里的示例。 */
  placeholder: string;
  /** 没有素材可看的场景（剧情、口播、复刻），这句话必须写。 */
  textRequired: boolean;
  durations: number[]; duration: number; ratio: "9:16" | "16:9";
  /** 这类视频通常怎么拍（拼进交给助手的话里）。 */
  structure: string;
  ideas: string[];
  /** 交给助手时用的方法（技能 key）。 */
  skill: string;
}
export interface StudioSceneCatalog {
  version: number;
  imageGroups: StudioSceneGroup[]; videoGroups: StudioSceneGroup[];
  image: StudioImageScene[]; video: StudioVideoScene[];
}
export interface StudioSceneComposeRequest {
  kind: "image" | "video"; sceneId: string;
  /** 图片：补充要求；视频：用户写的那句。 */
  text?: string;
  /** 图片：用户改过的完整描述。 */
  custom?: string;
  /** 图片：放了图的参考图位（从 0 起）。 */
  filled?: number[];
  imageTitles?: string[]; characterTitle?: string; voiceTitle?: string; videoTitle?: string;
  duration?: number; ratio?: string;
}
/** 图片：`text` 是出图描述；视频：`text` 是交给助手的话，`skillKey` 是该场景的方法。 */
export interface StudioSceneComposed { text: string; skillKey?: string | null }
