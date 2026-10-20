// The image / video composer must send what the user asked for, or say plainly why it cannot. 2026-10-20 IPP-45bead91:
// the description said 「画幅 16:9 … 时长 4 秒」 and named the leads and the living room, the panel still held its defaults
// (9:16, 8 s, one connected picture), and that is what was quoted and sent (IPR-fde32da6c2cc4664974f). Three rules live
// here, all pure:
//   · a ratio or duration written in the description that differs from the settings is asked about before a paid submit;
//   · a duration the chosen model cannot do is a blocking message with a fix, never a silent clamp.
// Material is covered elsewhere: the assistant's references become edges into the node (studio.spec), native video sends
// every connected input and refuses a mode that cannot carry them, and the legacy path refuses more than one picture.
import type { StudioNodeSpec } from "@ai-star-eco/types/ip-studio-workflow";

const RATIOS = new Set(["9:16", "16:9", "1:1", "3:4", "4:3", "2:3", "3:2", "21:9"]);
const RATIO = /(?<![\d.])(21|16|9|4|3|2|1)\s*[:：]\s*(16|9|4|3|2|1)(?![\d.])/g;
const DURATION = [
  /(?:时长|总长|全长|片长|长度|总时长)\s*(?:[:：为是约]|大约|控制在)?\s*(\d{1,3})\s*(?:秒|s\b|sec)/gi,
  /(\d{1,3})\s*秒(?:钟)?(?:左右)?的?(?:视频|短片|片段|镜头|成片|短视频)/g,
];

/** The ratio / seconds the description states, when every mention agrees; undefined when absent or contradictory. */
export function studioPromptSpec(prompt: string): { aspectRatio?: string; durationSec?: number } {
  const ratios = new Set([...prompt.matchAll(RATIO)].map(m => `${m[1]}:${m[2]}`).filter(r => RATIOS.has(r)));
  const seconds = new Set(DURATION.flatMap(re => [...prompt.matchAll(re)].map(m => Number(m[1]))).filter(n => n > 0 && n <= 120));
  return {
    ...(ratios.size === 1 ? { aspectRatio: [...ratios][0] } : {}),
    ...(seconds.size === 1 ? { durationSec: [...seconds][0] } : {}),
  };
}

export type StudioSpecConflict = { aspectRatio?: { said: string; set: string }; durationSec?: { said: number; set: number } };

/** What the description says and the settings do not; undefined when they agree. Images have no duration. */
export function studioSpecConflict(prompt: string, settings: { aspectRatio: string; durationSec?: number }): StudioSpecConflict | undefined {
  const said = studioPromptSpec(prompt);
  const out: StudioSpecConflict = {};
  if (said.aspectRatio && settings.aspectRatio && said.aspectRatio !== settings.aspectRatio) out.aspectRatio = { said: said.aspectRatio, set: settings.aspectRatio };
  if (said.durationSec && settings.durationSec != null && said.durationSec !== settings.durationSec) out.durationSec = { said: said.durationSec, set: settings.durationSec };
  return out.aspectRatio || out.durationSec ? out : undefined;
}

export function studioSpecConflictText(conflict: StudioSpecConflict): { said: string; set: string } {
  const said = [conflict.aspectRatio?.said, conflict.durationSec ? `${conflict.durationSec.said} 秒` : undefined].filter(Boolean).join("、");
  const set = [conflict.aspectRatio?.set, conflict.durationSec ? `${conflict.durationSec.set} 秒` : undefined].filter(Boolean).join("、");
  return { said, set };
}

/**
 * A duration the model cannot do. Continuous contracts (min..max) and discrete lists are both checked; the fix is the
 * nearest allowed value and is applied only when the user presses it.
 */
export function studioDurationIssue(seconds: number, limits: { min?: number; max?: number; options?: number[] }): { message: string; fix: number } | undefined {
  const { min, max, options = [] } = limits;
  if (min != null && max != null) {
    if (seconds >= min && seconds <= max) return undefined;
    const fix = seconds < min ? min : max;
    return { message: min === max ? `所选模型只支持 ${min} 秒，现在设置的是 ${seconds} 秒。` : `所选模型支持 ${min}–${max} 秒，现在设置的是 ${seconds} 秒。`, fix };
  }
  if (!options.length || options.includes(seconds)) return undefined;
  const fix = options.reduce((best, n) => Math.abs(n - seconds) < Math.abs(best - seconds) ? n : best, options[0]);
  return { message: `所选模型可选 ${options.join(" / ")} 秒，没有 ${seconds} 秒。`, fix };
}

/**
 * The video draft an assistant spec asks for. Roles decide how material is used, not its order on the canvas: pictures
 * marked `frame` are the first / last frame; any person / scene / product / style material makes it a reference set.
 * Without references the draft is returned as is. A mode the chosen model lacks is then refused by the composer
 * (「这个模型不支持所选视频模式」), never swapped silently.
 */
export function studioSpecVideoDraft<T extends { mode: string; firstId?: string; lastId?: string }>(spec: StudioNodeSpec | undefined, draft: T): T {
  const refs = spec?.references;
  if (!refs) return draft;
  const frames = refs.filter(r => r.role === "frame").map(r => r.nodeId);
  const others = refs.filter(r => r.role !== "frame");
  const mode = !refs.length ? "t2v" : others.length ? "universal_reference_video" : frames.length > 1 ? "first_last_frame_video" : "i2v";
  return { ...draft, mode, firstId: frames[0], lastId: frames[1] };
}

/** Partial spec updates keep what they do not mention; `references`, when given, is the complete new list. */
export function mergeStudioSpec(prior: StudioNodeSpec | undefined, next: StudioNodeSpec): StudioNodeSpec {
  return { ...prior, ...next, ...(next.references ? {} : prior?.references ? { references: prior.references } : {}) };
}
