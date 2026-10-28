import { expect, test } from "vitest";
import { clipRanges, diffText, locate, shotChanges } from "./director-text";

test("locate matches the server rule: exact first, then ignoring whitespace, first occurrence wins", () => {
  const content = "老贺凑过去看。那盆绿萝叶子油绿，\n中间一片叶面上。老贺凑过去看。";
  expect(locate(content, "老贺凑过去看。")).toEqual([0, 7]);
  const r = locate(content, "叶子油绿， 中间一片")!;
  expect(content.slice(r[0], r[1])).toBe("叶子油绿，\n中间一片");
  expect(locate(content, "陈德茂")).toBeNull();
  expect(locate(content, "")).toBeNull();
});

test("diffText marks only the changed characters", () => {
  const parts = diffText("老贺凑过去看。", "老贺凑近看。");
  expect(parts.map(p => p.kind)).toContain("del");
  expect(parts.filter(p => p.kind === "same").map(p => p.text).join("")).toBe("老贺凑看。");
  expect(parts.filter(p => p.kind === "add").map(p => p.text).join("")).toBe("近");
});

test("shotChanges pairs shots by id and reports added, removed and changed fields", () => {
  const before = [
    { id: "a", durationSec: 3, size: "中景", camera: "", action: "走近", still: "站在桌前", dialogue: [] },
    { id: "b", durationSec: 3, size: "近景", camera: "", action: "", still: "手", dialogue: [] },
  ];
  const after = [
    { id: "a", durationSec: 3, size: "特写", camera: "", action: "走近", still: "手部特写", dialogue: [] },
    { id: null, durationSec: 2, size: "近景", camera: "", action: "", still: "反应", dialogue: [] },
  ];
  const c = shotChanges(before, after);
  expect(c[0]).toMatchObject({ kind: "changed", fields: ["景别", "分镜画面"] });
  expect(c[1]).toMatchObject({ kind: "added", no: 2 });
  expect(c[2]).toMatchObject({ kind: "removed", beforeNo: 2 });
});

test("clipRanges uses recorded opening lines, falls back to exact dialogue, and never guesses", () => {
  const content = "## 第1场\n林夏推开木门。\n林夏：这么晚了，怎么还有人留东西？\n## 第2场\n门外有敲门声。\n林夏：谁在外面？";
  const shot = (text: string) => ({ id: "s", durationSec: 3, startSec: 0, endSec: 3, size: "", camera: "", action: "", still: "", dialogue: text ? [{ speakerId: null, text }] : [] });
  const ranges = clipRanges(content, [
    { id: "c1", order: 1, sourceQuote: "林夏推开木门", shots: [shot("")] },
    { id: "c2", order: 2, sourceQuote: "门外有敲门声", shots: [shot("")] },
    { id: "c3", order: 3, sourceQuote: null, shots: [shot("谁在外面？")] },
    { id: "c4", order: 4, sourceQuote: "正文里没有这句", shots: [shot("编出来的台词")] },
  ]);
  expect(ranges.get("c1")).toMatchObject({ how: "quote", start: content.indexOf("林夏推开木门"), end: content.indexOf("门外有敲门声") });
  expect(ranges.get("c3")).toMatchObject({ how: "dialogue" });
  expect(content.slice(ranges.get("c3")!.start, ranges.get("c3")!.end)).toBe("林夏：谁在外面？");
  expect(ranges.has("c4")).toBe(false);
});
