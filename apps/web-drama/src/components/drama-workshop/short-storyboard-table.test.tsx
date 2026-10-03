import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/react";
import type { FormShot } from "./shot-form";

// SM1：后台还在生成的镜（有 pendingJob），单镜入口不能再给任何生成按钮 —— 再点一次就是再提交、再扣费。
// 只断结构（哪一行有没有生成按钮、点「查看进度」回调了谁），不断界面文案（§8.0.1 ⑩）。
vi.mock("@/api", () => ({ RenderApi: {} }));
vi.mock("@/lib/use-wallet", () => ({ notifyWalletChanged: () => {} }));

import { ShortStoryboardTable } from "./short-storyboard-table";

const shot = (id: string, patch: Partial<FormShot> = {}): FormShot => ({
  id, no: 1, dur: 4, visual: "画面", size: "中景", move: "固定", voWho: "口播", voText: "",
  sfx: "", bgm: "", fx: "", refs: [], sub: true, flow: "frame", frameUrl: "/f.png", ...patch,
});

function renderTable(extra: Partial<React.ComponentProps<typeof ShortStoryboardTable>> = {}) {
  const props: React.ComponentProps<typeof ShortStoryboardTable> = {
    shots: [shot("a"), shot("b", { no: 2 })],
    beats: [],
    speakerOptions: ["口播"],
    busy: null,
    frameCost: 5,
    clipCostFor: (s) => 40 * s.dur,
    aiEditCost: 5,
    onPatch: () => {},
    onDelete: () => {},
    onRender: () => {},
    onApprove: () => {},
    onFrameEdited: () => {},
    ...extra,
  };
  return render(<ShortStoryboardTable {...props} />);
}

const rows = (c: HTMLElement) => Array.from(c.querySelectorAll<HTMLElement>(".smk-row"));
const genButtons = (row: HTMLElement) => row.querySelectorAll(".sfc-btn:not([data-action='check-pending'])").length;

afterEach(cleanup);

describe("ShortStoryboardTable · 在途镜头", () => {
  it("有 pendingJob 的那一镜没有生成按钮，别的镜照常有", () => {
    const { container } = renderTable({ pending: { b: { kind: "clip", watching: true } } });
    const [a, b] = rows(container);
    expect(genButtons(a)).toBeGreaterThan(0);
    expect(genButtons(b)).toBe(0);
    // 页面正在等它：不给「查看进度」
    expect(b.querySelector("[data-action='check-pending']")).toBeNull();
  });

  it("页面没在等它（轮询超时）：给「查看进度」，点了只回调查询，不走生成", () => {
    const onCheckPending = vi.fn();
    const onRender = vi.fn();
    const { container } = renderTable({ pending: { b: { kind: "clip", watching: false } }, onCheckPending, onRender });
    const b = rows(container)[1];
    const check = b.querySelector<HTMLButtonElement>("[data-action='check-pending']");
    expect(check).not.toBeNull();
    fireEvent.click(check!);
    expect(onCheckPending).toHaveBeenCalledWith("b");
    expect(onRender).not.toHaveBeenCalled();
  });

  it("视频报价按镜取（时长不同价不同），不是一个全局数", () => {
    const clipCostFor = vi.fn((s: FormShot) => 40 * s.dur);
    renderTable({ shots: [shot("a", { dur: 3 }), shot("b", { dur: 10 })], clipCostFor });
    expect(clipCostFor.mock.calls.map(([s]) => s.id)).toEqual(expect.arrayContaining(["a", "b"]));
  });
});
