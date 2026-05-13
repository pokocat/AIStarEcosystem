// ─────────────────────────────────────────────────────────────────────────────
// constants/generation-ui.ts — LLM Playground UI 配置。
// ─────────────────────────────────────────────────────────────────────────────

import {
  Brain, Music2, PenSquare, SlidersHorizontal, Volume2,
  CheckCircle2, CircleAlert,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { GenerationStage } from "@ai-star-eco/types/generation";

export interface StageConfig {
  label: string;
  desc: string;
  icon: LucideIcon;
  color: string;   // tailwind text-*
  bg: string;      // tailwind bg-*
  border: string;  // tailwind border-*
}

export const STAGE_CONFIG: Record<GenerationStage, StageConfig> = {
  idle: {
    label: "待命", desc: "输入创作意图开始生成",
    icon: Brain, color: "text-gray-400", bg: "bg-gray-500/10", border: "border-gray-500/20",
  },
  analyzing: {
    label: "解析主题", desc: "拆解意图、确定风格锚点",
    icon: Brain, color: "text-cyan-400", bg: "bg-cyan-500/10", border: "border-cyan-500/30",
  },
  composing: {
    label: "构建旋律", desc: "曲式 / 调性 / BPM",
    icon: Music2, color: "text-purple-400", bg: "bg-purple-500/10", border: "border-purple-500/30",
  },
  lyrics: {
    label: "撰写歌词", desc: "段落、押韵、记忆点",
    icon: PenSquare, color: "text-pink-400", bg: "bg-pink-500/10", border: "border-pink-500/30",
  },
  arranging: {
    label: "编曲配器", desc: "声库 + 乐器轨",
    icon: SlidersHorizontal, color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/30",
  },
  mastering: {
    label: "母带整合", desc: "动态与响度",
    icon: Volume2, color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/30",
  },
  done: {
    label: "完成", desc: "查看 draft 并采纳",
    icon: CheckCircle2, color: "text-green-400", bg: "bg-green-500/10", border: "border-green-500/30",
  },
  error: {
    label: "失败", desc: "稍后重试",
    icon: CircleAlert, color: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/30",
  },
};

/** 每 N 个字符吐一次。 */
export const STREAM_CHUNK_SIZE = 3;
/** chunk 之间的间隔（毫秒）。 */
export const STREAM_INTERVAL_MS = 14;
/** 阶段切换之间的停顿。 */
export const STAGE_HOLD_MS = 280;
/** 进入 analyzing 前的"思考中"动画时长。 */
export const PRE_ANALYZE_MS = 600;
