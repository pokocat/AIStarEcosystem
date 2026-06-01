// 设计真源 data.js 的 TS 化数据契约。
// 严格按按项目隔离：每项目自带 projectInfo / topicCards / episodes / characters / script / storyboard / promptPack。
import type { EngineKey } from "@/components/drama-ui/engine-tag";

export type CreationMode = "guided" | "template";

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
  hook: string;
  synopsis: string;
  beat: string;
  locked?: boolean;
}

export interface CharacterDef {
  id: string;
  name: string;
  role: "key" | "extra";
  cast: string;
  desc: string;
  /** 数字人 theme key（AVATAR_THEMES 索引） */
  avatar: string;
  bound: boolean;
  refCount?: number;
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
}

export interface BoardShot {
  id: string;
  no: number;
  /** 景别 */
  size: string;
  /** 运镜 */
  move: string;
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
  /** 已完成勾选 */
  done?: boolean;
  /** 特效镜参考素材超限 */
  overLimit?: boolean;
  /** 特效镜参考图片数（含 cast） */
  refImg?: number;
}

export interface BoardScene {
  id: string;
  shots: BoardShot[];
  duration?: number;
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

export interface ProjectData {
  projectInfo: ProjectInfo;
  topicCards: TopicCard[];
  episodes: EpisodeOutline[];
  characters: CharacterDef[];
  script: { ep: number; scenes: ScriptScene[] };
  storyboard: { ep: number; scenes: BoardScene[] };
  promptPack: PromptPack;
}
