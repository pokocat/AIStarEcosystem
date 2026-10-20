// What a video prompt asks for that the model may not get: spoken lines and pictures named in the text.
//
// 2026-10-20, production: an H3 job was accepted with a Chinese line of dialogue, and the vendor's automatic
// rewrite (done after acceptance, before encoding) kept only its first word — the expression note quoted that
// word again, and the rewrite took it for the whole line. The same prompt also said 「图1」 and 「图2定为尾帧」
// while the request carried no image at all: writing 图1 in the text does not bind a picture.
//
// These are reading aids, never gates: the composer shows the lines it recognised and asks once when the text
// names pictures the request does not carry; a finished take compares the original lines with the description
// the vendor actually used. None of it decides anything for the user.

import type { IpRun, IpVideoPromptRewrite } from "@ai-star-eco/types";
import type { StudioVideoSettings } from "@ai-star-eco/types/ip-studio-workflow";
import type { VideoStudioModeSpec } from "@ai-star-eco/types/video-studio";

/** A line someone should say, as written in the prompt. speaker is empty for 「台词：」 / 「旁白：」 style labels. */
export type StudioPromptLine = { speaker: string; text: string };
/** A recognised line whose parts are missing from the vendor's description. */
export type StudioLostLine = StudioPromptLine & { missing: string[]; kept: string[] };

// Labels that introduce directions rather than a speaker. Digits (图1, 第2镜, 0-3秒) also mark a direction.
const DIRECTION = /时间|地点|场景|画面|镜头|景别|机位|运镜|构图|光线|灯光|色调|风格|氛围|背景|环境|表情|动作|神态|情绪|声音|音效|音乐|配乐|bgm|切镜|转场|节奏|时长|首帧|尾帧|参考|服装|造型|道具|字幕|备注|要求|注意|说明|提示|描述|内容|主题|画幅|比例|清晰度|定位|开场|结尾|结局|细节|特写|近景|远景|中景|全景|口型|音色|语气|语速|人物|角色|主体/i;
const SPEECH_LABEL = /^(台词|对白|旁白|独白|画外音)$/;
// A label sits at the start or after a sentence/clause break; a parenthetical (语气、动作) may follow the name.
const LABEL = /(^|[\s。！？!?；;，,…」』”）)\]】])([^\s：:，,。！？!?；;、“”"「」『』（）()【】[\]<>]{1,12})(?:[（(][^）)\n]{0,16}[）)])?\s*[：:](?!\d)/gu;
const OPEN_QUOTE: Record<string, string> = { "“": "”", "「": "」", "『": "』", "\"": "\"" };

/** Spoken lines written as 「名字：台词」, 「名字说：“台词”」 or 「台词：……」. Quoted text is taken whole; unquoted text runs to the first 。. */
export function studioPromptLines(prompt: string): StudioPromptLine[] {
  const labels = [...prompt.matchAll(LABEL)].map(match => ({
    name: match[2], start: match.index! + match[1].length, contentStart: match.index! + match[0].length,
  }));
  const lines: StudioPromptLine[] = [];
  labels.forEach((label, index) => {
    const raw = label.name.trim();
    const speechLabel = SPEECH_LABEL.test(raw);
    if (!speechLabel && (raw.length > 8 || /\d/.test(raw) || DIRECTION.test(raw))) return;
    const speaker = speechLabel ? "" : raw.length > 1 ? raw.replace(/(说道|说|道|问|喊|答|讲|叫|喃喃)$/, "") || raw : raw;
    const end = labels[index + 1]?.start ?? prompt.length;
    let body = prompt.slice(label.contentStart, end).trimStart();
    const close = OPEN_QUOTE[body[0]];
    if (close) {
      const stop = body.indexOf(close, 1);
      body = body.slice(1, stop < 0 ? undefined : stop);
    } else {
      body = body.split(/[。\n]/)[0];
    }
    const text = body.trim();
    if (Array.from(squash(text)).length >= 2) lines.push({ speaker, text });
  });
  return lines;
}

/**
 * Lines of the original prompt whose clauses do not appear in what the vendor actually used. Spoken text in the
 * vendor's description is marked <d>…</d> (with a leading language tag); without marks the whole text is searched.
 */
export function studioLostLines(prompt: string, rewritten: string): StudioLostLine[] {
  const spoken = [...rewritten.matchAll(/<d>([\s\S]*?)<\/d>/gi)].map(match => match[1].replace(/^\s*\[[^\]]*\]/, "")).join(" ");
  const haystack = squash(spoken || rewritten);
  return studioPromptLines(prompt).flatMap(line => {
    const clauses = line.text.split(/[，,。.！!？?；;、…—~～\s]+/).filter(clause => squash(clause).length > 0);
    const missing = clauses.filter(clause => !haystack.includes(squash(clause)));
    return missing.length ? [{ ...line, missing, kept: clauses.filter(clause => !missing.includes(clause)) }] : [];
  });
}

/** One take of a video run as the vendor prepared it: its rewrite and the submitted lines it dropped. */
export type StudioTakeRewrite = { index: number; rewrite: IpVideoPromptRewrite; lost: StudioLostLine[] };

/** Takes of a video run that report a rewrite (models that do not rewrite, and older jobs, report none). */
export function studioRunRewrites(run: IpRun): StudioTakeRewrite[] {
  const prompt = (run.inputs as { prompt?: string }).prompt || "";
  return (run.output.videoCandidates || []).flatMap(candidate => {
    const rewrite = candidate.promptRewrite;
    if (!rewrite) return [];
    return [{ index: candidate.index, rewrite, lost: rewrite.state === "done" && rewrite.prompt ? studioLostLines(prompt, rewrite.prompt) : [] }];
  });
}

/** Pictures the text names (图1…, 首帧, 尾帧) against those the request carries. */
export type StudioFrameIntent = { mentions: string[]; needed: number; bound: number; lastFrameIgnored: boolean };

// 图N inside common words (地图1、截图2、构图3…) is not a picture reference.
const PICTURE = /(?<![地截试构意企草插蓝拼示附配果脑])图\s*([1-9])(?!\d)/gu;

export function studioFrameIntent(prompt: string, video: StudioVideoSettings, spec?: VideoStudioModeSpec): StudioFrameIntent | undefined {
  const mentions: string[] = [];
  let needed = 0;
  for (const match of prompt.matchAll(PICTURE)) {
    const label = `图${match[1]}`;
    if (!mentions.includes(label)) mentions.push(label);
    needed = Math.max(needed, Number(match[1]));
  }
  const first = /首帧|第一帧/.test(prompt), last = /尾帧|末帧|最后一帧/.test(prompt);
  if (first) mentions.push("首帧");
  if (last) mentions.push("尾帧");
  needed = Math.max(needed, Number(first) + Number(last));
  const bound = Number(!!video.firstFrameKey) + Number(!!video.lastFrameKey) + (video.references || []).filter(ref => ref.mediaType === "image").length;
  // A model can only treat a picture as the last frame in a mode that takes one; references are not frames.
  const lastFrameIgnored = last && !!video.firstFrameKey && !(spec ? spec.needsLastFrame : video.mode === "first_last_frame_video") && !video.references?.length;
  if (!mentions.length || bound >= needed && !lastFrameIgnored) return undefined;
  return { mentions, needed, bound, lastFrameIgnored };
}

function squash(value: string): string {
  return value.normalize("NFKC").toLowerCase().replace(/[\s\p{P}\p{S}]/gu, "");
}
