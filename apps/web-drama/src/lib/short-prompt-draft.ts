// ─────────────────────────────────────────────────────────────────────────────
// lib/short-prompt-draft.ts — 提示词直出（v0.143）的共享映射层。
//
// 「拆解结果 → 短视频草稿编辑态」只有这一处实现，供两个调用方共用：
//   ① /shorts/prompt 预览页（确认后作为 createDraft 的 seed 提交）；
//   ② /shorts/make 工作台「按提示词重新拆解」（就地替换 meta / 分镜 / 视觉设定）。
// 与后端 DramaShortPromptService.seedToDraftData 同规则，避免两条链路结构漂移。
// ─────────────────────────────────────────────────────────────────────────────

import type { ScriptMeta } from "@/api/short-drama";
import type { ParsedShortPrompt, ShortDraftShot, ShortVisualBible } from "@/api/shorts";

/** 单镜时长区间与整条镜数上限，与后端 DramaShortPromptService 的常量一致（超出后端会截断）。 */
export const PROMPT_SHOT_MIN_SEC = 2;
export const PROMPT_SHOT_MAX_SEC = 15;
export const PROMPT_MAX_SHOTS = 40;

export interface PromptDraftPatch {
  meta: ScriptMeta;
  logline: string;
  visualBible: ShortVisualBible;
  shots: ShortDraftShot[];
  /** 展示与出片风格名同源：拆解出的风格标签，缺省「自定义短片」。 */
  fmtName: string;
  notes: string[];
}

function clampSec(sec: number): number {
  if (!Number.isFinite(sec) || sec <= 0) return 4;
  return Math.min(PROMPT_SHOT_MAX_SEC, Math.max(PROMPT_SHOT_MIN_SEC, Math.round(sec)));
}

/** 拆解结果 → 草稿编辑态（分镜一律 draft 态，产物只能由服务端渲染写入）。 */
export function parsedToDraft(parsed: ParsedShortPrompt, idSeed = Date.now()): PromptDraftPatch {
  const characters = parsed.characters ?? [];
  const scenes = parsed.scenes ?? [];
  const style = (parsed.style ?? []).filter(Boolean);
  const meta: ScriptMeta = {
    title: parsed.title || "未命名短视频",
    style,
    // 主场景一句话：优先第一个场景的视觉描述，其次全片基调（分镜出图前缀读它）。
    scene: scenes[0]?.visual || parsed.universalPrompt || "",
    character: {
      name: characters[0]?.name ?? "",
      description: characters[0]?.visual || characters[0]?.performance || "",
    },
  };
  return {
    meta,
    logline: parsed.logline ?? "",
    visualBible: {
      universal: parsed.universalPrompt ?? "",
      characters: characters.map((c) => ({ name: c.name, visual: c.visual, performance: c.performance })),
      scenes: scenes.map((s) => ({ name: s.name, visual: s.visual })),
    },
    fmtName: style.length ? style.join(" · ").slice(0, 24) : "自定义短片",
    notes: parsed.notes ?? [],
    shots: (parsed.shots ?? []).map((s, i) => ({
      id: `sh_p${i + 1}_${idSeed.toString(36)}`,
      no: i + 1,
      dur: clampSec(s.durationSec),
      visual: s.visual ?? "",
      size: s.size || "中景",
      move: s.move || "固定",
      voWho: s.voWho || (s.voText ? "旁白" : ""),
      voText: s.voText ?? "",
      sfx: s.sfx ?? "",
      bgm: s.bgm ?? "",
      fx: s.fx ?? "",
      beat: s.beat || undefined,
      timecode: s.timecode || undefined,
      sceneName: s.sceneName || undefined,
      castNames: s.castNames,
      refs: [],
      sub: true,
      flow: "draft",
      engine: "avatar",
      frameIdx: 0,
    })),
  };
}

/** 分镜表头的时长汇总（秒）。 */
export function parsedTotalSec(parsed: ParsedShortPrompt): number {
  return (parsed.shots ?? []).reduce((sum, s) => sum + clampSec(s.durationSec), 0);
}
