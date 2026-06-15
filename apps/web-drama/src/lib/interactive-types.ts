// ─────────────────────────────────────────────────────────────────────────────
// lib/interactive-types.ts — 互动剧（剧情互动短剧）数据契约（v0.79，纯类型，无 React / 无 API）。
//
// 互动剧不是独立实体：它是「短剧工坊」DramaProject 的一种形态（mode=interactive）。
//   · 剧集（图节点）= 项目大纲的分集（ProjectData.episodes，按 no 标识，episodeId = "ep"+no）
//   · 每一集的视频 = 该集走完六阶段「剧集脚本→视频工厂→成片合成」后的成片（episodeDocs[no].assembled）
//   · 分支编排（互动点 / 接线 / 全局标记）= 叠加在项目上的 InteractiveOverlay（ProjectData.interactive）
//
// 「Story Config v2」= 把 项目大纲 + 成片 + Overlay 合成的标准视图（InteractiveStoryData），
// 也是导出给社媒平台播放器消费的下发契约（见 lib/interactive-graph.ts buildStoryConfig）。
// 本文件是该契约的 TS 真源（与后端 interactive draft 输出字段 1:1）。
// ─────────────────────────────────────────────────────────────────────────────

export type InteractionType = "choice" | "input" | "countdown";
export type FlagValue = number | boolean | string;

/** 一个选项：观众点它 → 写回 setFlags（可选）→ 跳到 nextVideoId 指向的集。 */
export interface InteractionOption {
  id: string;
  text: string;
  /** 目标集 episodeId；null = 尚未接线（校验会报「断点」）。 */
  nextVideoId: string | null;
  /** 写回全局标记（道具 / 好感度等），形成状态化分支。 */
  setFlags?: Record<string, FlagValue>;
}

export interface InteractionUiConfig {
  question: string;
  /** 超时秒数（倒计时 / 超时自动选第一项）。 */
  countdownSec?: number;
  /** interactionType=input 时写回的标记名。 */
  inputKey?: string;
  /** input 输入框占位。 */
  placeholder?: string;
  /** interactionType=choice / countdown 时的选项。 */
  options?: InteractionOption[];
}

/** 视频时间轴上的一个互动点。triggerTime 是「区间触发」的秒级触发点（播放器侧带容差）。 */
export interface InteractionPoint {
  id: string;
  triggerTime: number;
  interactionType: InteractionType;
  /** 条件触发（命中时间点后先判此条件再决定是否弹出），如 "globalFlags.hasKey == true"。 */
  condition?: string;
  uiConfig: InteractionUiConfig;
}

/**
 * 互动剧分支叠加层（落在 ProjectData.interactive；按 episodeId 键 = "ep"+集号）。
 * 只存「分支编排」相关：互动点 / 线性续播 / 结局 / 起始集 / 全局标记初值。
 * 剧情、出片产物等仍在 ProjectData 本体（大纲 + episodeDocs），由 story 视图合并。
 */
export interface InteractiveNode {
  interactions: InteractionPoint[];
  /** 播完且无互动分流时的线性续播目标 episodeId；null = 无（结局或断点）。 */
  nextVideoId: string | null;
  isEnding: boolean;
  endingLabel?: string;
}

export interface InteractiveOverlay {
  enabled: boolean;
  /** 起始集 episodeId（"ep"+集号）。 */
  startEpisodeId: string;
  /** 影响走向的全局标记 + 初值。 */
  globalFlags: Record<string, FlagValue>;
  /** 按 episodeId 键的分支配置。 */
  nodes: Record<string, InteractiveNode>;
}

/** 一集 = 一条视频 + 该视频时间轴上的若干互动点（合并视图，供编辑器 / 校验 / 导出消费）。 */
export interface InteractiveEpisode {
  episodeId: string;
  /** 项目大纲集号（用于「去制作这一集」跳进六阶段制作）。 */
  no: number;
  title: string;
  /** 本集剧情（= 大纲 synopsis；出片画面依据）。 */
  synopsis?: string;
  /** 成片地址（= episodeDocs[no].assembled.url），未成片为 null。 */
  videoUrl?: string | null;
  /** 成片时长秒（= episodeDocs[no].assembled.durationSec），未成片为 0。 */
  durationSec: number;
  /** 出片态（ready=已成片 / idle=未制作）—— 由成片产物推断，不在 overlay 里另存。 */
  videoStatus?: "idle" | "ready";
  interactions: InteractionPoint[];
  nextVideoId?: string | null;
  isEnding: boolean;
  endingLabel?: string;
}

/** 整张图的合并视图（项目大纲 + 成片 + overlay 合成）。导出 Story Config 时加 dramaId 即下发契约。 */
export interface InteractiveStoryData {
  schema: "story-config/v2";
  startEpisodeId: string;
  globalFlags: Record<string, FlagValue>;
  episodes: InteractiveEpisode[];
  /** 工作态剧名（= projectInfo.title；导出 Story Config 时不含此字段）。 */
  title?: string;
}
