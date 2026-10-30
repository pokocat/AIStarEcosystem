/**
 * Studio 场景目录（AI 图片 / AI 视频）。真源在服务端：运营在后台「Studio 场景模板」改过就用改过的（平台配置
 * `studio.scene-catalog`），否则用随包的 `ipstudio/scenes.json`；经 `GET /v1/ip-studio/scenes` 下发（只含上架的场景）。
 * 出图描述、编导写脚本的要求和交给助手的话由 `POST /v1/ip-studio/scenes/compose` 在服务端拼。字段名与 Java `StudioSceneCatalog` 一一对应。
 */
export interface StudioSceneGroup { id: string; title: string }
/** 参考图位：按顺序是图1、图2…；描述里的「图N」对应这里。 */
export interface StudioSceneRef { label: string; required: boolean; hint?: string | null }
/** 选项组里的一项：value 给接口用，label 给用户看，prompt 是选中后服务端拼进描述 / 要求里的那句话。 */
export interface StudioSceneOptionChoice { value: string; label: string; prompt: string }
/** 照参考站的「选项组」：一个场景几组可选项（拍法、语气……），各有默认值；用户点选，不用写字。 */
export interface StudioSceneOptionGroup { key: string; label: string; choices: StudioSceneOptionChoice[]; defaultValue: string }
/** 首页「你想做什么？」的一张卡（目录里）：点进去落到 sceneId，两张封面取 covers 里两个场景的封面。 */
export interface StudioSceneHomeGoal { id: string; title: string; description: string; sceneId: string; covers?: string[] | null }
/** 公开接口 `GET /v1/ip-studio/scenes/home` 的一张卡：没登录的访客也看得到，只有显示用的字段。 */
export interface StudioSceneHomeCard {
  id: string; title: string; description: string; sceneId: string; kind: "image" | "video";
  covers: { sceneId: string; coverUrl?: string | null }[];
}
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
  /** 选项组；没有就不显示。 */
  options?: StudioSceneOptionGroup[] | null;
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
  /** 首页「你想做什么？」的卡片（后台可改；用户端只下发落点场景还上架的）。 */
  homeGoals?: StudioSceneHomeGoal[] | null;
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
  /** 选项组：组 key → 选中项 value；没给的组用默认值。 */
  options?: Record<string, string>;
  /** 编导：放了、但所选视频模型用不上的场景图（只给编导看，脚本里用文字写，不编号）。imageTitles 只放会交给视频模型的。 */
  seenTitles?: string[];
  /** 编导：出镜人物这张视频模型也用不上（同上）。 */
  characterSeen?: boolean;
  /** 编导：写脚本的模型这次能不能看到图；false 时要求里不说「已附图片」「先看图」。 */
  visual?: boolean;
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
