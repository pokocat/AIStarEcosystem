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

/**
 * 分卷切割：命中 40 镜上限时，按「拆到哪」的时间码在**用户原文**里切一刀，返回剩下的段落。
 * 纯字符串定位，不猜内容、不改内容；拿不准就返回 null，由调用方提示手动复制。
 *
 * 定位规则（`04:19-06:08` 为例）：
 *   1. 先找**完整时间码**在原文里的位置 —— 只用结束点找会在「多章各自从 00:00 重新计时」的
 *      提示词里命中前面某一章，把输入框切回已经拆过的段落，甚至来回打转。
 *   2. 完整时间码出现多次 → 无法判断是哪一次，返回 null（宁可让用户手动复制，也不切错）。
 *   3. `midSegment=true`（上限正好切在某个长段中间，服务端会告知）→ 把该行整行留给下一条：
 *      那一行还有没拆完的动作，跳过去就是静默丢内容。
 *   4. 否则从该位置**往后**找下一个时间码行作为切点；找不到就退回把该行整行留下（宁重不漏）。
 */
export function cutPromptTail(
  prompt: string,
  truncatedAfterTimecode: string | undefined,
  midSegment = false,
): string | null {
  const anchor = (truncatedAfterTimecode ?? "").trim();
  if (!anchor || !prompt) return null;

  const first = prompt.indexOf(anchor);
  if (first < 0) return null;                                    // 定位不到：不猜
  if (prompt.indexOf(anchor, first + anchor.length) >= 0) return null; // 出现多次：无法判断是哪一次

  let cutAt = prompt.lastIndexOf("\n", first) + 1; // 默认：把锚点所在行整行留给下一条
  if (!midSegment) {
    // 从锚点之后找下一个时间码（形如 06:08-07:40 / 06:08 - 07:40），命中就切在那一行行首。
    const after = prompt.slice(first + anchor.length);
    const next = /\d{1,3}:\d{2}\s*[-–—~至]\s*\d{1,3}:\d{2}/.exec(after);
    if (next) {
      const absolute = first + anchor.length + next.index;
      cutAt = prompt.lastIndexOf("\n", absolute) + 1;
    }
  }

  const tail = prompt.slice(cutAt).trimStart();
  // 切出来和原文一样长 = 等于没切（锚点就在开头），当作定位失败，别让用户点了没反应还以为切过了。
  return tail && tail.length < prompt.trim().length ? tail : null;
}
