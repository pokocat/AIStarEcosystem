import { describe, expect, test } from "vitest";
import type { IpRun } from "@ai-star-eco/types";
import type { VideoStudioModeSpec } from "@ai-star-eco/types/video-studio";
import { studioFrameIntent, studioFrameIntentCopy, studioFrameTarget, studioLostLines, studioPromptLines, studioRunRewrites } from "./studio-video-prompt";

// Same structure as the 2026-10-20 production prompt (a direction label with 图1, one spoken line, an expression
// note that quotes the line's first word, 图2 as the last frame), with different words.
const SHOT = "图1定位首帧镜头与时长：老周胸口以上近景，从邻居肩后拍。 参考6秒。老周：等等？你说这片地要拆了，我怎么一点风声都没听到。"
  + "表情与动作：“等等”时猛抬头，眉毛上挑；后半句皱眉，指一下自己，再摊手。邻居在前景保持不动。切镜与声音：对白前留一口吸气。句尾切邻居近景。图2定为尾帧";
// What the vendor's rewrite kept of it: English directions, and only the first word as speech.
const REWRITTEN = "integrated_multimodal_description: [Shot 1] Lao Zhou suddenly lifts his head as he says (S1) <d>[Chinese]等等</d>. "
  + "He points at himself, then spreads his hands.\n\noverall_soundscape: A sharp intake of breath.";

describe("spoken lines in a video prompt", () => {
  test("the speaker's whole line is recognised; direction labels and the quoted word in a note are not lines", () => {
    expect(studioPromptLines(SHOT)).toEqual([{ speaker: "老周", text: "等等？你说这片地要拆了，我怎么一点风声都没听到" }]);
  });

  test("quoted lines are taken whole, 说/道 after a name is dropped, 台词/旁白 labels have no speaker", () => {
    expect(studioPromptLines("老周说：“走吧，天黑了。路上小心。”他转身离开。")).toEqual([{ speaker: "老周", text: "走吧，天黑了。路上小心。" }]);
    expect(studioPromptLines("小满（压低声音）：「别出声。」")).toEqual([{ speaker: "小满", text: "别出声。" }]);
    expect(studioPromptLines("旁白：那年夏天，雨下个不停。\n台词：今天的风好大")).toEqual([
      { speaker: "", text: "那年夏天，雨下个不停" }, { speaker: "", text: "今天的风好大" }]);
  });

  test("ordinary descriptions with colons are not dialogue", () => {
    expect(studioPromptLines("时间：傍晚六点。镜头：缓慢推近。画幅 9:16，天气：晴")).toEqual([]);
    expect(studioPromptLines("一只橘猫在窗台上打盹，阳光很好")).toEqual([]);
  });
});

describe("what the vendor's rewrite kept", () => {
  test("reports the parts of a line the vendor dropped, and what it kept", () => {
    expect(studioLostLines(SHOT, REWRITTEN)).toEqual([{ speaker: "老周", text: "等等？你说这片地要拆了，我怎么一点风声都没听到",
      missing: ["你说这片地要拆了", "我怎么一点风声都没听到"], kept: ["等等"] }]);
  });

  test("nothing is reported when every clause is spoken, whatever the punctuation or language tag", () => {
    const kept = "He says (S1) <d>[Chinese]等等？你说这片地要拆了，我怎么一点风声都没听到！</d>";
    expect(studioLostLines(SHOT, kept)).toEqual([]);
  });

  test("without speech marks the whole description is searched", () => {
    expect(studioLostLines("老周：走吧", "老周轻声说走吧，然后离开")).toEqual([]);
    expect(studioLostLines("老周：走吧", "Lao Zhou walks away")).toHaveLength(1);
  });
});

describe("pictures named in the text", () => {
  test("a text-only request that names 图1/图2 and both frames asks for two pictures it does not carry", () => {
    expect(studioFrameIntent(SHOT, { mode: "t2v", resolutionTier: "768p" })).toEqual({
      mentions: ["图1", "图2", "首帧", "尾帧"], pictures: 2, first: true, last: true, needed: 2, bound: 0, hasFirst: false, lastFrameIgnored: false });
  });

  test("first and last frames bound: nothing to ask", () => {
    expect(studioFrameIntent(SHOT, { mode: "first_last_frame_video", resolutionTier: "768p", firstFrameKey: "a", lastFrameKey: "b" })).toBeUndefined();
  });

  test("a first-frame request that also names a last frame is flagged even with one picture", () => {
    expect(studioFrameIntent("图1作为首帧，图2定为尾帧", { mode: "i2v", resolutionTier: "768p", firstFrameKey: "a" }))
      .toMatchObject({ needed: 2, bound: 1, lastFrameIgnored: true });
    expect(studioFrameIntent("尾帧停在他的手上", { mode: "i2v", resolutionTier: "768p", firstFrameKey: "a" }))
      .toMatchObject({ bound: 1, lastFrameIgnored: true });
  });

  test("reference pictures count, and ordinary words with 图 are not picture references", () => {
    expect(studioFrameIntent("@图1 的女孩走向 @图2 的房子", { mode: "universal_reference_video", resolutionTier: "768p",
      references: [{ mediaType: "image", key: "a" }, { mediaType: "image", key: "b" }] })).toBeUndefined();
    expect(studioFrameIntent("桌上摊着地图，截图2里的路线，图片很亮", { mode: "t2v", resolutionTier: "768p" })).toBeUndefined();
    expect(studioFrameIntent("一只猫在窗台上打盹", { mode: "t2v", resolutionTier: "768p" })).toBeUndefined();
  });
});

// H3's open modes; a reference mode holds up to 9 images.
const T2V = { mode: "t2v", label: "文生视频" } as VideoStudioModeSpec;
const I2V = { mode: "i2v", label: "首帧", needsFirstFrame: true } as VideoStudioModeSpec;
const FIRST_LAST = { mode: "first_last_frame_video", label: "首尾帧", needsFirstFrame: true, needsLastFrame: true } as VideoStudioModeSpec;
const REFERENCE = { mode: "universal_reference_video", label: "全能参考",
  references: { image: { maxCount: 9 }, video: { maxCount: 1 }, audio: { maxCount: 3 }, maxTotal: 12, maxImagesWithVideo: 8, minVisual: 1, maxAudioTotalSec: 15 } } as unknown as VideoStudioModeSpec;
const H3 = [T2V, I2V, FIRST_LAST, REFERENCE];
const textOnly = (prompt: string) => studioFrameIntent(prompt, { mode: "t2v", resolutionTier: "768p" })!;

// Codex review of 47c057ea (P2): the suggested mode must hold the pictures and keep a named last frame a last frame.
describe("which mode the frame question suggests", () => {
  test("named first and last frames: the first-and-last-frame mode", () => {
    expect(studioFrameTarget(H3, textOnly(SHOT))).toEqual({ mode: FIRST_LAST, kind: "frames" });
    expect(studioFrameTarget(H3, textOnly("图1作为首帧，镜头推近"))).toEqual({ mode: I2V, kind: "frames" });
  });

  test("three pictures without frame words: a reference mode that holds all three, not a two-slot frame mode", () => {
    const intent = textOnly("图1的人走到图2的房子前，拿起图3的商品");
    expect(intent).toMatchObject({ pictures: 3, needed: 3, first: false, last: false });
    expect(studioFrameTarget(H3, intent)).toEqual({ mode: REFERENCE, kind: "references" });
    expect(studioFrameTarget(H3, textOnly("图1里的女孩在跳舞"))).toEqual({ mode: REFERENCE, kind: "references" });
  });

  test("a picture meant as the last frame is never offered as a first frame", () => {
    const intent = textOnly("图1用作尾帧");
    expect(intent).toMatchObject({ needed: 1, first: false, last: true, lastFrameIgnored: false });
    expect(studioFrameTarget(H3, intent)).toEqual({ mode: FIRST_LAST, kind: "frames-need-first" });
    expect(studioFrameIntentCopy(intent, H3, 2).lines[0]).toContain("还需要再选一张首帧图");
    // A first frame already in the request stays; only the last frame is missing.
    const kept = studioFrameIntent("尾帧停在他的手上", { mode: "i2v", resolutionTier: "768p", firstFrameKey: "a" })!;
    expect(studioFrameTarget(H3, kept)).toEqual({ mode: FIRST_LAST, kind: "frames" });
    // A model without any last-frame mode: no frame mode is suggested for it.
    expect(studioFrameTarget([T2V, I2V], intent)).toBeUndefined();
    expect(studioFrameIntentCopy(intent, [T2V, I2V], 2).lines[0]).toContain("没有能用尾帧的模式");
  });

  test("frames plus more pictures than any frame mode holds: carried as references, and said so", () => {
    const intent = textOnly("图1作为首帧，图2和图3是人物参考");
    expect(studioFrameTarget(H3, intent)).toEqual({ mode: REFERENCE, kind: "references-not-frames" });
    expect(studioFrameIntentCopy(intent, H3, 3).lines[0]).toContain("只作参考，不会锁定首帧或尾帧");
  });

  test("models without a reference mode use pictures as frames only when they fit; otherwise nothing is suggested", () => {
    expect(studioFrameTarget([T2V, I2V, FIRST_LAST], textOnly("图1的人走向图2的房子"))).toEqual({ mode: FIRST_LAST, kind: "as-frames" });
    const tooMany = textOnly("图1的人走到图2的房子前，拿起图3的商品");
    expect(studioFrameTarget([T2V, I2V, FIRST_LAST], tooMany)).toBeUndefined();
    const copy = studioFrameIntentCopy(tooMany, [T2V, I2V, FIRST_LAST], 3);
    expect(copy.bindLabel).toBe("去选择视频模式");
    expect(copy.lines[0]).toContain("最多用 2 张图");
    expect(studioFrameIntentCopy(tooMany, [T2V], 3).lines[0]).toContain("只能按文字生成");
  });
});

describe("historical optimization reports", () => {
  const takeRun = (candidates: NonNullable<IpRun["output"]["videoCandidates"]>): IpRun => ({ id: "r1", projectId: "p", nodeId: "n", kind: "studio-video",
    status: "done", stage: "视频生成完成", pct: 100, cost: 320, createdAt: "2026-10-20T07:39:51Z",
    inputs: { prompt: "老周：等等？你说这片地要拆了，我怎么一点风声都没听到。表情：“等等”时愣住。" } as IpRun["inputs"], output: { videoCandidates: candidates } });
  const take = (index: number, prompt?: string) => ({ index, jobId: `j${index}`, status: "done" as const, pct: 100, durationSec: 8,
    promptRewrite: { state: "done" as const, ...(prompt ? { prompt } : {}) } });
  const REWRITTEN_ONE_WORD = "Lao Zhou freezes and says (S1) <d>[Chinese]等等</d>. He spreads his hands.";

  test("reports remain tied to their original candidate indices and exclude older candidates without a report", () => {
    const twoTakes = takeRun([take(0, "He says (S1) <d>[Chinese]等等？你说这片地要拆了，我怎么一点风声都没听到</d>"),
      { ...take(2), promptRewrite: undefined }, take(4, REWRITTEN_ONE_WORD)]);
    const reports = studioRunRewrites(twoTakes);
    expect(reports.map(report => report.index)).toEqual([0, 4]);
    expect(reports[0].lost).toEqual([]);
    expect(reports[1].rewrite.prompt).toBe(REWRITTEN_ONE_WORD);
    expect(reports[1].lost).toHaveLength(1);
  });
});
