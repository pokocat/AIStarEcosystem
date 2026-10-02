import { describe, expect, it } from "vitest";
import type { CanvasSegment, DramaCanvasDoc } from "@ai-star-eco/types/drama-canvas";
import { emptyDoc, findSegment, setPicked, type CanvasModelOption } from "@/canvas/core";
import {
  applyPrevLastFrame,
  assembleInfo,
  batchVideoPlan,
  batchVideoSkipText,
  cellThumb,
  episodeAssets,
  episodeCardStatus,
  episodeCast,
  episodeCover,
  episodeDuration,
  episodeHeading,
  estimateEpisodeCost,
  estimateEpisodeSec,
  filterAssets,
  formatClock,
  listPriceParts,
  prevLastFrame,
  priceText,
  refView,
  segmentCellStatus,
  segmentDeleteNote,
  segmentPriceParts,
  segmentRefChanged,
  segmentUses,
  storyboardReplaceNote,
  timelineTotals,
  videoRateOf,
} from "./derive";

// 逐集两屏的纯推导。断状态 / 结构 / 数字；价格文案这种「文案本身就是被测行为」的才断字（§8.0.1 ⑩ 的例外）。

const seg = (id: string, over: Partial<CanvasSegment> = {}): CanvasSegment => ({
  id,
  text: "（4 秒）一镜",
  durationSec: 4,
  frame: { versions: [] },
  video: { versions: [] },
  ...over,
});
const vid = (key: string, extra: Record<string, unknown> = {}) => ({ key, runId: `r_${key}`, createdAt: "2026-09-30T02:00:00.000Z", durationSec: 4, ...extra });

function doc(over: Partial<DramaCanvasDoc> = {}): DramaCanvasDoc {
  return {
    ...emptyDoc(),
    script: {
      episodes: [
        { no: 1, title: "落下的东西", text: "正文" },
        { no: 2, title: "第 2 集", text: "" },
      ],
      history: [],
      episodeDurationSec: 60,
    },
    characters: [
      {
        id: "ch_1",
        name: "周岳",
        role: "lead",
        looks: [
          { id: "lk_1", name: "基础造型", prompt: "", episodes: [1, 2], images: { versions: [{ key: "img/zy.png", runId: "run_zy" }] } },
          { id: "lk_2", name: "便装", prompt: "", episodes: [2], images: { versions: [] } },
        ],
      },
      { id: "ch_2", name: "沈念", role: "lead", looks: [{ id: "lk_3", name: "基础造型", prompt: "", episodes: [], images: { versions: [] } }] },
    ],
    scenes: [
      { id: "sc_1", name: "车厢", prompt: "", episodes: [1], images: { versions: [{ key: "img/bus.png" }] } },
      { id: "sc_2", name: "站台", prompt: "", episodes: [2], images: { versions: [] } },
    ],
    materials: [
      { id: "mt_1", name: "旧车票", kind: "image", images: { versions: [{ key: "img/ticket.png" }] } },
      { id: "mt_2", name: "色调", kind: "text", text: "冷蓝" },
    ],
    ...over,
  };
}

describe("formatClock / episodeHeading", () => {
  it("两位分秒，一小时以上带小时；负数和非数字按 0", () => {
    expect(formatClock(42)).toBe("00:42");
    expect(formatClock(85)).toBe("01:25");
    expect(formatClock(0)).toBe("00:00");
    expect(formatClock(3725)).toBe("1:02:05");
    expect(formatClock(-3)).toBe("00:00");
    expect(formatClock(Number.NaN)).toBe("00:00");
    expect(formatClock(9.6)).toBe("00:10");
  });

  it("集名：没标题或标题就是「第 N 集」时不重复", () => {
    expect(episodeHeading(1, "落下的东西")).toBe("第 1 集：落下的东西");
    expect(episodeHeading(2, "第 2 集")).toBe("第 2 集");
    expect(episodeHeading(3, "  ")).toBe("第 3 集");
    expect(episodeHeading(1, "落下的东西", " · ")).toBe("第 1 集 · 落下的东西");
  });
});

describe("episodeCardStatus", () => {
  it("还没有分镜脚本 / 生成中", () => {
    expect(episodeCardStatus(doc(), 2).state).toBe("no-storyboard");
    const d = doc({ episodes: [{ no: 2, segments: [], storyboardRun: { runId: "r", status: "running" } }] });
    expect(episodeCardStatus(d, 2).state).toBe("storyboarding");
    // 运行记录里更新的状态优先
    expect(episodeCardStatus(d, 2, { storyboard: "succeeded" }).state).toBe("no-storyboard");
  });

  it("片段 a/b → 待合成 → 已完成 → 成片是旧的", () => {
    const a = vid("v/a.mp4");
    const b = vid("v/b.mp4");
    const partial = doc({ episodes: [{ no: 1, segments: [seg("s1", { video: { versions: [a] } }), seg("s2")] }] });
    expect(episodeCardStatus(partial, 1)).toMatchObject({ state: "in-progress", segments: 2, withVideo: 1 });

    const ready = doc({ episodes: [{ no: 1, segments: [seg("s1", { video: { versions: [a] } })] }] });
    expect(episodeCardStatus(ready, 1).state).toBe("to-assemble");

    const assembled = { key: "film.mp4", durationSec: 4, at: "2026-09-30T03:00:00.000Z", videoKeys: ["v/a.mp4"], runId: "ra" };
    const done = doc({ episodes: [{ no: 1, segments: [seg("s1", { video: { versions: [a, b], pickedKey: a.key } })], assembled }] });
    expect(episodeCardStatus(done, 1).state).toBe("done");

    const stale = setPicked(done, "video:1:s1", b.key);
    expect(episodeCardStatus(stale, 1)).toMatchObject({ state: "stale", assembledStale: true });
    expect(assembleInfo(stale, 1)).toMatchObject({ stale: true, canAssemble: true, missing: 0 });
    expect(episodeCardStatus(done, 1, { assemble: "queued" }).state).toBe("assembling");
  });

  it("出场角色 / 场景数：造型或场景标了这一集，或片段里 @ 到了", () => {
    expect(episodeCast(doc(), 1)).toEqual({ characters: 1, scenes: 1 });
    expect(episodeCast(doc(), 2)).toEqual({ characters: 1, scenes: 1 });
    const d = doc({ episodes: [{ no: 1, segments: [seg("s1", { text: "（4 秒）@[沈念](look:lk_3) 和 @[站台](scene:sc_2)" })] }] });
    expect(episodeCast(d, 1)).toEqual({ characters: 2, scenes: 2 });
  });

  it("封面：第一个有视频的片段的首帧；没有视频用第一张首帧；什么都没有就没有", () => {
    expect(episodeCover(doc(), 1)).toBeUndefined();
    const d = doc({
      episodes: [
        {
          no: 1,
          segments: [
            seg("s1", { frame: { versions: [{ key: "f1" }] } }),
            seg("s2", { frame: { versions: [{ key: "f2" }] }, video: { versions: [vid("v2")] } }),
          ],
        },
      ],
    });
    expect(episodeCover(d, 1)?.key).toBe("f2");
    const noVideo = doc({ episodes: [{ no: 1, segments: [seg("s1"), seg("s2", { frame: { versions: [{ key: "f2" }] } })] }] });
    expect(episodeCover(noVideo, 1)?.key).toBe("f2");
    const lastOnly = doc({ episodes: [{ no: 1, segments: [seg("s1", { video: { versions: [vid("v1", { lastFrameKey: "last1" })] } })] }] });
    expect(episodeCover(lastOnly, 1)?.key).toBe("last1");
  });

  it("卡片时长：有不过期的成片按成片，否则按片段加总", () => {
    const d = doc({ episodes: [{ no: 1, segments: [seg("s1", { durationSec: 10 }), seg("s2", { durationSec: 8 })] }] });
    expect(episodeDuration(d, 1)).toBe(18);
  });
});

describe("会丢什么", () => {
  it("重新生成分镜脚本：有首帧 / 视频写清张数；只有文字写片段数；没片段不用确认", () => {
    const withMedia = [seg("s1", { frame: { versions: [{ key: "f" }, { key: "g" }] }, video: { versions: [vid("v")] } }), seg("s2")];
    expect(storyboardReplaceNote(1, withMedia)).toContain("2 张首帧、1 段视频");
    expect(storyboardReplaceNote(1, [seg("s1", { video: { versions: [vid("v")] } })])).not.toContain("首帧");
    expect(storyboardReplaceNote(1, [seg("s1"), seg("s2")])).toContain("2 个片段");
    expect(storyboardReplaceNote(1, [])).toBeUndefined();
  });

  it("删片段：空片段不用确认", () => {
    expect(segmentDeleteNote("片段 01 ", seg("s1"))).toBeUndefined();
    expect(segmentDeleteNote("片段 01 ", seg("s1", { video: { versions: [vid("a"), vid("b")] } }))).toContain("2 段视频");
  });
});

describe("segmentCellStatus", () => {
  it("生成中 → 失败 → 造型换过图 → 有视频 → 有首帧 → 空", () => {
    expect(segmentCellStatus(seg("s")).state).toBe("empty");
    expect(segmentCellStatus(seg("s", { frame: { versions: [{ key: "f" }] } })).state).toBe("frame");
    const withVideo = seg("s", { frame: { versions: [{ key: "f" }] }, video: { versions: [vid("v")] } });
    expect(segmentCellStatus(withVideo).state).toBe("video");
    expect(segmentCellStatus(withVideo, { refChanged: true }).state).toBe("ref-changed");
    expect(segmentCellStatus(withVideo, { videoStatus: "failed" }).state).toBe("failed");
    expect(segmentCellStatus(withVideo, { videoStatus: "queued" }).state).toBe("running");
    expect(segmentCellStatus(seg("s", { videoRun: { runId: "r", status: "running" } })).state).toBe("running");
    expect(segmentCellStatus(seg("s"), { frameStatus: "canceled" }).state).toBe("empty");
    // 空片段就算标了「换过图」也没什么可重新生成的
    expect(segmentCellStatus(seg("s"), { refChanged: true }).state).toBe("empty");
  });

  it("用到的造型换过图了：挑中的图是在这个片段的视频之后才出的", () => {
    const s = seg("s1", { text: "（4 秒）@[周岳](look:lk_1) 开车", video: { versions: [vid("v")] } });
    const d = doc({ episodes: [{ no: 1, segments: [s] }] });
    expect(segmentRefChanged(d, s, (id) => (id === "run_zy" ? "2026-09-30T01:00:00.000Z" : undefined))).toBe(false);
    expect(segmentRefChanged(d, s, (id) => (id === "run_zy" ? "2026-09-30T05:00:00.000Z" : undefined))).toBe(true);
    // 不知道那张图什么时候出的：不标
    expect(segmentRefChanged(d, s, () => undefined)).toBe(false);
    // 片段还没生成过：不标
    expect(segmentRefChanged(d, seg("s2", { text: s.text }), () => "2026-09-30T05:00:00.000Z")).toBe(false);
  });
});

describe("引用的显示", () => {
  it("找得到用文档里现在的名字（基础造型只显示角色名），找不到用标记里的名字并标记被删", () => {
    const d = doc();
    expect(refView(d, { kind: "look", id: "lk_1", label: "旧名字" })).toMatchObject({ label: "周岳", missing: false, image: { key: "img/zy.png" } });
    expect(refView(d, { kind: "look", id: "lk_2", label: "x" }).label).toBe("周岳·便装");
    expect(refView(d, { kind: "look", id: "gone", label: "老吴" })).toEqual({ label: "老吴", missing: true });
    expect(refView(d, { kind: "material", id: "mt_2", label: "x" })).toMatchObject({ label: "色调", missing: false, image: undefined });
    const uses = segmentUses(d, "@[周岳](look:lk_1) @[车厢](scene:sc_1) @[周岳](look:lk_1) @[老吴](look:gone)");
    expect(uses.map((u) => [u.id, u.missing])).toEqual([
      ["lk_1", false],
      ["sc_1", false],
      ["gone", true],
    ]);
  });

  it("本集素材：造型 / 场景 / 素材图（文字素材不列），按集过滤、按名字搜", () => {
    const d = doc({ episodes: [{ no: 1, segments: [seg("s1", { text: "@[旧车票](material:mt_1)" })] }] });
    const items = episodeAssets(d, 1);
    expect(items.map((i) => `${i.kind}:${i.id}:${i.inEpisode ? 1 : 0}`)).toEqual([
      "look:lk_1:1",
      "look:lk_2:0",
      "look:lk_3:0",
      "scene:sc_1:1",
      "scene:sc_2:0",
      "material:mt_1:1",
    ]);
    expect(filterAssets(items, { scope: "episode" }).map((i) => i.id)).toEqual(["lk_1", "sc_1", "mt_1"]);
    expect(filterAssets(items, { scope: "all", query: "便装" }).map((i) => i.id)).toEqual(["lk_2"]);
  });
});

describe("用上一片段最后一帧", () => {
  const last = vid("v1", { lastFrameKey: "last/1.png", lastFrameUrl: "https://x/last1" });
  const d = doc({
    episodes: [
      {
        no: 1,
        segments: [seg("s1", { video: { versions: [last] } }), seg("s2", { frame: { versions: [{ key: "old" }] } }), seg("s3")],
      },
    ],
  });

  it("第一个片段 / 上一片段没有末帧 / 可以用 / 已经在用", () => {
    expect(prevLastFrame(d, 1, "s1").kind).toBe("first");
    expect(prevLastFrame(d, 1, "s3").kind).toBe("none");
    expect(prevLastFrame(d, 1, "s2")).toEqual({ kind: "ready", asset: { key: "last/1.png", url: "https://x/last1" } });
    const next = applyPrevLastFrame(d, 1, "s2");
    expect(findSegment(next, 1, "s2")?.frame).toEqual({ versions: [{ key: "last/1.png", url: "https://x/last1" }, { key: "old" }], pickedKey: "last/1.png" });
    expect(prevLastFrame(next, 1, "s2").kind).toBe("applied");
    // 再点一次不重复加
    expect(applyPrevLastFrame(next, 1, "s2")).toBe(next);
    expect(applyPrevLastFrame(d, 1, "s3")).toBe(d);
  });
});

describe("价格文案", () => {
  const perSec: CanvasModelOption = { endpointId: "v", name: "首帧生视频", isDefault: true, creditCost: 6, billingUnit: "per_second", maxDurationSec: 10, acceptsFirstFrame: true };
  const perCall: CanvasModelOption = { ...perSec, endpointId: "c", creditCost: 30, billingUnit: "per_call" };

  it("片段标题旁：按秒的写每秒和本片段合计，按次的写每条", () => {
    expect(priceText(segmentPriceParts(videoRateOf(perSec, 30), 7, 42))).toBe("每秒 ✦6 · 本片段 7 秒 ✦42");
    expect(priceText(segmentPriceParts(videoRateOf(perCall, 30), 7, 30))).toBe("每条 ✦30 · 本片段 7 秒");
    // 模型还没读到：按次、用兜底单价
    expect(videoRateOf(undefined, 30)).toEqual({ unit: "per_call", rate: 30 });
  });

  it("一集大概多少：分镜脚本 + 每个片段一张首帧 + 每个片段一条视频", () => {
    // 60 秒、单条上限 10 秒 → 6 个片段：4 + 6×2 + 6×(10×6)
    expect(estimateEpisodeCost({ durationSec: 60, maxSegmentSec: 10, storyboard: 4, frame: 2, videoPrice: (s) => s * 6 })).toBe(376);
    // 按次：6 条 × 30
    expect(estimateEpisodeCost({ durationSec: 60, maxSegmentSec: 10, storyboard: 4, frame: 2, videoPrice: () => 30 })).toBe(196);
    // 分不整：25 秒 / 10 → 3 段（9 + 8 + 8）
    const seen: number[] = [];
    estimateEpisodeCost({ durationSec: 25, maxSegmentSec: 10, storyboard: 0, frame: 0, videoPrice: (s) => (seen.push(s), 0) });
    expect(seen).toEqual([9, 8, 8]);
  });

  it("估价按多长一集：新建时定的；没定按已有片段的平均；都没有 60 秒", () => {
    expect(estimateEpisodeSec(doc())).toBe(60);
    const pasted = doc({
      script: { episodes: [], history: [] },
      episodes: [
        { no: 1, segments: [seg("a", { durationSec: 30 }), seg("b", { durationSec: 20 })] },
        { no: 2, segments: [seg("c", { durationSec: 70 })] },
      ],
    });
    expect(estimateEpisodeSec(pasted)).toBe(60);
    expect(estimateEpisodeSec(doc({ script: { episodes: [], history: [] } }))).toBe(60);
  });

  it("逐集制作页那一行", () => {
    const parts = listPriceParts({ episodes: 3, storyboard: 4, frame: 2, rate: videoRateOf(perSec, 30), estimateSec: 60, estimate: 376 });
    expect(priceText(parts)).toBe("共 3 集 · 分镜脚本每集 ✦4，首帧每张 ✦2，视频按秒计（当前模型每秒 ✦6），60 秒一集约 ✦376");
    const call = listPriceParts({ episodes: 1, storyboard: 4, frame: 2, rate: videoRateOf(perCall, 30), estimateSec: 60, estimate: 196 });
    expect(priceText(call)).toContain("视频按条计（当前模型每条 ✦30）");
  });
});

describe("片段轴 / 批量出视频", () => {
  it("格子缩略图：首帧 → 没首帧但有视频用末帧 → 都没有就没有（界面画播放图标）", () => {
    expect(cellThumb(seg("a", { frame: { versions: [{ key: "f" }] }, video: { versions: [vid("v", { lastFrameKey: "last" })] } }))?.key).toBe("f");
    expect(cellThumb(seg("b", { video: { versions: [vid("v", { lastFrameKey: "last", lastFrameUrl: "u" })] } }))).toEqual({ key: "last", url: "u" });
    expect(cellThumb(seg("c", { video: { versions: [vid("v")] } }))).toBeUndefined();
    expect(cellThumb(seg("d"))).toBeUndefined();
  });

  it("已有视频的时长 / 全部（有视频的按视频实际时长）", () => {
    const segs = [seg("a", { durationSec: 10, video: { versions: [vid("v", { durationSec: 9 })] } }), seg("b", { durationSec: 8 })];
    expect(timelineTotals(segs)).toEqual({ done: 9, total: 17 });
  });

  it("有首帧 / 没首帧分开数，没写时长、超上限、在跑的跳过", () => {
    const segs = [
      seg("a", { frame: { versions: [{ key: "f" }] } }),
      seg("b"),
      seg("c", { durationSec: 0 }),
      seg("d", { durationSec: 12 }),
      seg("e"),
      seg("f", { text: "  " }),
    ];
    const plan = batchVideoPlan(segs, new Set(["a", "b", "c", "d", "e", "f"]), { maxSec: 10, price: (s) => s * 6, isRunning: (id) => id === "e" });
    expect(plan.eligible.map((s) => s.id)).toEqual(["a", "b"]);
    expect(plan).toMatchObject({ withFrame: 1, withoutFrame: 1, skipped: 4, cost: 48 });
    expect(plan.skippedBy).toEqual({ empty: 1, "no-duration": 1, "too-short": 0, "too-long": 1, running: 1 });
  });

  it("比所选视频模型下限短的跳过，按原因数清楚（给确认框和就地提示用）", () => {
    const segs = [seg("a", { durationSec: 4 }), seg("b", { durationSec: 6 }), seg("c", { durationSec: 16 }), seg("d", { durationSec: 3 })];
    const plan = batchVideoPlan(segs, new Set(["a", "b", "c", "d"]), { minSec: 5, maxSec: 15, price: (s) => s, isRunning: () => false });
    expect(plan.eligible.map((s) => s.id)).toEqual(["b"]);
    expect(plan.skippedBy).toMatchObject({ "too-short": 2, "too-long": 1 });
    const text = batchVideoSkipText(plan, { minSec: 5, maxSec: 15 })!;
    expect(text).toContain("3 个");
    expect(text).toContain("2 个不到 5 秒");
    expect(text).toContain("1 个超过 15 秒");
    expect(batchVideoSkipText(batchVideoPlan(segs, new Set(["b"]), { minSec: 5, maxSec: 15, price: (s) => s, isRunning: () => false }), { minSec: 5, maxSec: 15 })).toBeNull();
  });
});
