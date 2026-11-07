import { expect, test } from "vitest";
import type { StudioWorkDraft } from "@ai-star-eco/types/ip-studio-workflow";
import { studioCaptionMode, studioCaptionNote, studioPackagingOf } from "./studio-packaging";

const draft: StudioWorkDraft = { aspectRatio: "9:16", packagingEnabled: false, brand: "", title: "", cta: "", captionText: "" };

test("captions default to automatic; an older canvas that already has captions keeps them", () => {
  expect(studioCaptionMode(draft)).toBe("auto");
  expect(studioCaptionMode({ ...draft, captionText: "0-1: 你好" })).toBe("manual");
  expect(studioCaptionMode({ ...draft, captionText: "0-1: 你好", captionMode: "off" })).toBe("off");
});

test("the assemble request carries only what was chosen", () => {
  expect(studioPackagingOf(draft)).toEqual({ autoCaptions: true });
  expect(studioPackagingOf({ ...draft, captionMode: "off" })).toBeUndefined();
  expect(studioPackagingOf({ ...draft, captionMode: "manual", captionText: "0-1: 你好" })).toEqual({ captions: [{ start: 0, end: 1, text: "你好" }] });
  expect(studioPackagingOf({ ...draft, packagingEnabled: true, brand: " 声量 ", musicStorageKey: "m.mp3", quality: "1080p", voiceoverStorageKey: "v.wav" }))
    .toEqual({ brand: "声量", title: "", cta: "", autoCaptions: true, musicStorageKey: "m.mp3", quality: "1080p", voiceoverStorageKey: "v.wav" });
});

test("every caption outcome has a plain sentence, and only a failure is a warning", () => {
  expect(studioCaptionNote({ status: "recognized", count: 12 })).toEqual({ text: "已自动添加 12 条字幕。", warn: false });
  expect(studioCaptionNote({ status: "estimated", count: 3 })?.text).toContain("时间按镜头估算");
  expect(studioCaptionNote({ status: "no_lines" })?.warn).toBe(false);
  expect(studioCaptionNote({ status: "no_speech" })?.warn).toBe(false);
  expect(studioCaptionNote({ status: "unavailable" })?.warn).toBe(true);
  expect(studioCaptionNote(undefined)).toBeUndefined();
});
