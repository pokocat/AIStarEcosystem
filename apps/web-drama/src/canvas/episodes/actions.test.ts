import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/toast", () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }));
vi.mock("@/components/drama-ui/confirm-dialog", () => ({ dramaConfirm: vi.fn(async () => true) }));

import { toast } from "@/lib/toast";
import { needsSpendConfirm, storyboardBody, summarizeSequence, toastSequence, type SequenceResult } from "./actions";

// 批量提交结果的归纳与提示：断结构和调用，不断整句文案（§8.0.1 ⑩）。

const ok = (): SequenceResult => ({ ok: true, runs: [] });
const skipped = (message = "已经在生成了"): SequenceResult => ({ ok: false, reason: "skipped", message });
const rejected = (message = "余额不足"): SequenceResult => ({ ok: false, reason: "rejected", message });

describe("summarizeSequence / toastSequence", () => {
  it("发出去 / 失败（停下的那一项）/ 跳过 分开数，标签按原顺序", () => {
    const s = summarizeSequence([ok(), skipped(), rejected(), skipped("前面没提交上，这一项没发")], (i) => `片段 0${i + 1}`);
    expect(s.sent).toBe(1);
    expect(s.failed).toEqual({ label: "片段 03", message: "余额不足" });
    expect(s.skipped.map((x) => x.label)).toEqual(["片段 02", "片段 04"]);
  });

  it("全成功不提示；有跳过的用 info 说清几个没提交、各自为什么；失败的用 error", () => {
    toastSequence(summarizeSequence([ok(), ok()], (i) => `第 ${i + 1} 集`), "集", "分镜脚本");
    expect(toast.info).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
    toastSequence(summarizeSequence([ok(), skipped("已经在生成了")], (i) => `片段 0${i + 1}`), "个", "视频");
    expect(toast.info).toHaveBeenCalledTimes(1);
    const [title, opts] = vi.mocked(toast.info).mock.calls[0];
    expect(title).toContain("1 个");
    expect(opts?.description).toContain("片段 02");
    toastSequence(summarizeSequence([rejected()], () => "第 2 集"), "集", "分镜脚本");
    expect(vi.mocked(toast.error).mock.calls[0][1]?.description).toBe("余额不足");
  });

  it("要不要先确认：批量 / 覆盖一律确认，否则按门槛", () => {
    expect(needsSpendConfirm(2, 10)).toBe(false);
    expect(needsSpendConfirm(10, 10)).toBe(true);
    expect(needsSpendConfirm(2, 10, true)).toBe(true);
  });
});

describe("storyboardBody", () => {
  const model = (id: string, minDurationSec: number | null) => ({
    endpointId: id,
    name: id,
    isDefault: false,
    creditCost: 1,
    billingUnit: "per_second" as const,
    maxDurationSec: 15,
    minDurationSec,
    acceptsFirstFrame: true,
  });
  it("所选视频模型写明了下限才带 minSegmentSec；不知道时不带（服务端用它的缺省，不是 1 秒）", () => {
    const base = { maxSegmentSec: () => 15, minSegmentSec: () => 5, videoModels: [model("h3", 5), model("x", null)] };
    expect(storyboardBody(2, { ...base, videoModelId: "h3" })).toEqual({ episodeNo: 2, maxSegmentSec: 15, minSegmentSec: 5 });
    expect(storyboardBody(2, { ...base, minSegmentSec: () => 1, videoModelId: "x" })).toEqual({ episodeNo: 2, maxSegmentSec: 15 });
  });
});
