// ─────────────────────────────────────────────────────────────────────────────
// appearance-forge-ui.ts — AI 形象锻造炉的 UI 静态配置
// （模式图标 / 模式配色 / 模式文案）。
// ─────────────────────────────────────────────────────────────────────────────

import { Layers, Shuffle, Type, Wand2, type LucideIcon } from "lucide-react";
import type { ForgeMode } from "@/types/appearance-forge";

export interface ForgeModeConfig {
  label: string;
  desc: string;
  icon: LucideIcon;
  /** Tailwind 渐变 class（形如 `from-xxx-500 to-yyy-500`），用于模式高亮与按钮。 */
  gradient: string;
}

export const MODE_CONFIG: Record<ForgeMode, ForgeModeConfig> = {
  template_photo: {
    label:    "模版融合",
    desc:     "选择模版+上传照片，AI 融合生成",
    icon:     Layers,
    gradient: "from-cyan-500 to-blue-500",
  },
  prompt_only: {
    label:    "指令驱动",
    desc:     "纯文本描述，AI 自由生成",
    icon:     Type,
    gradient: "from-purple-500 to-pink-500",
  },
  template_prompt: {
    label:    "混合锻造",
    desc:     "模版基底+指令微调",
    icon:     Wand2,
    gradient: "from-amber-500 to-red-500",
  },
  random: {
    label:    "随机锻造",
    desc:     "基于艺人类型随机生成",
    icon:     Shuffle,
    gradient: "from-green-500 to-emerald-500",
  },
};

/** 生成按钮主渐变色（所有模式共用）。 */
export const FORGE_BUTTON_GRADIENT =
  "from-red-600 to-amber-600 hover:from-red-500 hover:to-amber-500";

/** 预览画布中模拟生成的伪耗时（毫秒）。 */
export const MOCK_FORGE_DURATION_MS = 2500;

/** 历史记录最大保留条数。 */
export const FORGE_HISTORY_MAX = 12;
