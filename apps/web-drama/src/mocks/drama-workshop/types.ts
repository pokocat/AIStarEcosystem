// 设计真源 data.js 的 TS 化数据契约。
// 严格按按项目隔离：每项目自带 projectInfo / topicCards / episodes / characters / script / storyboard / promptPack。
import type { EngineKey } from "@/components/drama-ui/engine-tag";
import type { InteractiveOverlay } from "@/lib/interactive-types";

// v0.79：interactive = 互动剧形态（剧集图 + 互动点 + 全局标记，叠加在项目上，复用六阶段制作）。
export type CreationMode = "guided" | "template" | "interactive";

export interface DramaProjectSummary {
  id: string;
  title: string;
  type: string;
  typeKey: string;
  ratio: string;        // "9:16" / "16:9"
  episodes: number;     // 集数
  /** 0-100 */
  progress: number;
  /** 当前 stage 序号 1..6 */
  stage: number;
  cover: { from: string; to: string };
  mode: CreationMode;
  updated: string;
  /** 标记为"主样例" */
  main?: boolean;
  done?: boolean;
}

export interface ContentType {
  key: string;
  name: string;
  desc: string;
  ratio: string;
  pace: string;
  from: string;
  to: string;
  /** "通用/自定义" 这种无渐变背景的纯白卡 */
  plain?: boolean;
}

export interface Template {
  id: string;
  name: string;
  eps: number;
  pace: string;
  scene: string;
  hooks: string[];
}

export interface AvatarLibItem {
  id: string;
  name: string;
  tags: string[];
  from: string;
  to: string;
}

export interface ProjectInfo {
  title: string;
  type: string;
  episodes: number;
  duration: string;
  ratio: string;
  logline: string;
  mainline: string;
}

export interface TopicCard {
  id: string;
  title: string;
  main: string;
  hook: string;
  pace: string;
  audience: string;
  selected?: boolean;
}

export interface EpisodeOutline {
  no: number;
  /** v0.98 新模型：集标题 + 本集剧情（一段连贯，AI 按「开场钩子→主体→结尾悬念」写，直接驱动分场分镜）。 */
  title?: string;
  content?: string;
  /** @deprecated 旧三段模型（开场钩子/梗概/结尾悬念）；仅老数据回读兜底，新代码用 title/content。 */
  hook?: string;
  synopsis?: string;
  beat?: string;
  locked?: boolean;
}

/** 集标题（新 title 优先；老数据无 title → 从剧情首句派生一个短标题，兜底「第N集」）。 */
export function episodeTitle(ep: { no: number; title?: string; hook?: string; content?: string; synopsis?: string; beat?: string }): string {
  const t = (ep.title || "").trim();
  if (t) return t.length > 16 ? t.slice(0, 16) + "…" : t; // 防旧数据/异常长标题溢出
  const src = (ep.hook || ep.beat || ep.content || ep.synopsis || "").trim();
  if (src) {
    const clause = (src.split(/[，。！？、\n·]/)[0] || src).trim();
    return clause.length > 12 ? clause.slice(0, 12) + "…" : clause;
  }
  return `第 ${ep.no} 集`;
}

/** 本集剧情（新 content 优先；老数据回退旧三段拼接）。 */
export function episodeContent(ep: { content?: string; hook?: string; synopsis?: string; beat?: string }): string {
  const c = (ep.content || "").trim();
  if (c) return c;
  return [ep.hook, ep.synopsis, ep.beat].map((s) => (s || "").trim()).filter(Boolean).join("。");
}

export interface CharacterDef {
  id: string;
  name: string;
  role: "key" | "extra";
  cast: string;
  desc: string;
  /** 数字人 theme key（AVATAR_THEMES 索引）—— 未绑真数字人时的渐变占位色。 */
  avatar: string;
  bound: boolean;
  refCount?: number;
  /** 绑定的真实数字人（AiAvatar「我的数字人」）id —— bound 后非空。 */
  avatarId?: string;
  /** 绑定数字人的展示图 URL（卡片/选角处显示真形象）。 */
  avatarImage?: string;
  /** v0.89：真人参考图 URL（上传；稳定 / 已签名）。 */
  refUrl?: string;
  /** v0.89：参考图 OSS key（真值；URL 为派生展示值）。 */
  refCdnKey?: string;
}

export interface ScriptLine {
  who: string;
  text: string;
  emotion?: string;
}

export interface ScriptScene {
  id: string;
  place: string;
  mood: string;
  action: string;
  lines: ScriptLine[];
  /** v0.98：本场绑定的项目级场景资产 id（SceneAsset.id）；决定本场各镜首帧的场景参考图，保障场景一致性。 */
  sceneRefId?: string;
}

export interface BoardShot {
  id: string;
  no: number;
  /** 景别 */
  size: string;
  /** 运镜 */
  move: string;
  /** v0.97 P1：机位标识（同机位复用同值，跨镜保持取景一致；AI 起草填、可编辑落库）。 */
  camId?: string;
  /** 时长(秒) */
  dur: number;
  engine: EngineKey;
  desc: string;
  /** 引用的角色 id 列表 */
  cast: string[];
  line: ScriptLine | null;
  voice?: string;
  /** 氛围关键词集合（光影 / 色调 / 质感 / 情绪） */
  moods?: string[];
  /** v0.88 设计稿分镜表三件套：音效 / 背景音乐 / 特效氛围（可编辑、落库）。 */
  sfx?: string;
  bgm?: string;
  fx?: string;
  /** v0.97 P2 镜头分解（借鉴 ViMax）：首/末帧静态快照 + 运动描述 + 变化等级（AI 拆镜产出，落库）。 */
  ffDesc?: string;
  lfDesc?: string;
  motionDesc?: string;
  variationType?: "small" | "medium" | "large" | string;
  /** 由 lfDesc 生成的末帧关键帧图（出片时作 seedance 尾帧，双关键帧插值）。 */
  endFrameUrl?: string;
  /** 已完成勾选 */
  done?: boolean;
  /** 特效镜参考素材超限 */
  overLimit?: boolean;
  /** 特效镜参考图片数（含 cast） */
  refImg?: number;
  /** v0.65 渲染产物（真后端落库在 ProjectData.storyboard 内） */
  /** 首帧候选 URL（渲染一次出多版） */
  frameUrls?: string[];
  /** 已锁定的首帧 URL */
  frameUrl?: string;
  /** 成片视频 URL */
  videoUrl?: string;
  /** v0.97 P2：成片真实末帧 URL（seedance return_last_frame 回传）→ 下一镜首帧参考，链式承接闭环。 */
  lastFrameUrl?: string;
  /** 进行中的视频任务 id（轮询 /me/drama/episodes/jobs/{id}） */
  jobId?: string;
  /** 渲染流水状态（draft/frame/frameLocked/clip/done），缺省 draft */
  flow?: string;
  /** C-1（一致性引擎）：上次首帧/出片的参考生效回报（参考 N/M 生效），render 回填。 */
  appliedRefs?: import("@/api/render").AppliedRefs;
}

export interface BoardScene {
  id: string;
  shots: BoardShot[];
  duration?: number;
  /** v0.97 P0-b：显式绑定的项目级场景资产 id（ProjectData.scenes[].id）；其参考图用于本场出图一致性。
   *  缺省时按场景名称自动匹配 ProjectData.scenes。 */
  sceneRefId?: string;
}

export interface PromptTimelineSegment {
  t: string;
  items: string[];
}

export interface PromptRef {
  type: "img" | "video";
  who?: string;
  label: string;
}

export interface PromptShot {
  no: number;
  engine: EngineKey;
  dur: number;
  ratio: string;
  style: string;
  timeline: PromptTimelineSegment[];
  sound: string;
  refs: PromptRef[];
  overLimit?: boolean;
}

export interface PromptPack {
  ep: number;
  scene: string;
  shots: PromptShot[];
}

/** v0.66：单集成片（拼接产物）。 */
export interface AssembledEpisode {
  url: string;
  cdnKey?: string;
  durationSec?: number;
  shotCount?: number;
  at?: string;
}

/** v0.88：按集设置（本集叙事 / 作品风格 / 出场人物），落库以便回溯（草稿态，不再内存即丢）。 */
export interface EpisodeDocMeta {
  /** 本集叙事（整集剧情速览，可改；改后可让 AI 重生成分场分镜） */
  plot?: string;
  /** 作品风格关键词 */
  style?: string;
  /** 出场人物（含临时演员；说话人选项来源） */
  cast?: { id: string; name: string; theme?: string; bound?: boolean; from?: string; to?: string; removable?: boolean }[];
}

/** v0.66：按集存档（剧本 + 分镜 + 成片），切集互不覆盖。 */
export interface EpisodeDoc {
  script: { ep: number; scenes: ScriptScene[] };
  storyboard: { ep: number; scenes: BoardScene[] };
  assembled?: AssembledEpisode;
  /** v0.88：本集设置（叙事/风格/出场人物）落库。 */
  meta?: EpisodeDocMeta;
}

/** v0.88：项目级「场景设定」资产（跨集共享取景地；name/mood 可编辑，可生成/上传参考图）。 */
export interface SceneAsset {
  id: string;
  name: string;
  /** 氛围基调（暖光仪式 / 冷白压迫 …） */
  mood: string;
  /** 参考图 URL（生成或上传，出 wire 已签名） */
  refUrl?: string;
  /** 参考图 OSS key（真值；出 wire 派生 refUrl） */
  refCdnKey?: string;
}

/** v0.88：大纲分集 AI 生成参数（范围/每集时长），落库以便回溯（草稿态）。 */
export interface OutlinePrefs {
  scope?: "trial" | "full";
  dur?: string;
}

export interface ProjectData {
  projectInfo: ProjectInfo;
  topicCards: TopicCard[];
  episodes: EpisodeOutline[];
  characters: CharacterDef[];
  /** v0.88：项目级场景设定（短剧设定页「角色与场景」的场景卡，跨集共享）。 */
  scenes?: SceneAsset[];
  /** v0.88：大纲分集 AI 参数（范围/时长），持久化。 */
  outlinePrefs?: OutlinePrefs;
  /** legacy 单集文档（episodeDocs 启用前的旧项目 / mock 演示数据回读用） */
  script: { ep: number; scenes: ScriptScene[] };
  storyboard: { ep: number; scenes: BoardScene[] };
  promptPack: PromptPack;
  /** v0.66：按集存档；key = String(ep)。存在该字段时以它为准。 */
  episodeDocs?: Record<string, EpisodeDoc>;
  /**
   * v0.79：互动剧分支叠加层。存在且 enabled 时该项目为「互动剧」——
   * 工作台显示「互动编排」阶段；剧集（图节点）= 上面的 episodes，每集视频 = episodeDocs[no].assembled。
   */
  interactive?: InteractiveOverlay;
}
