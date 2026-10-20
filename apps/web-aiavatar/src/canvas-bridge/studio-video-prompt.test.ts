import { describe, expect, test } from "vitest";
import { studioFrameIntent, studioLostLines, studioPromptLines } from "./studio-video-prompt";

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
      mentions: ["图1", "图2", "首帧", "尾帧"], needed: 2, bound: 0, lastFrameIgnored: false });
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
