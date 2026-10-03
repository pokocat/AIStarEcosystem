import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render } from "@testing-library/react";

// §8.0.1 ⑥ / ⑩：钉住短视频入口的两处接线，只断结构和行为，不断界面文案。
//   1. 「开始制作」的扣费确认只走共享的 confirmShortStart（v0.197 第二轮）。
//   2. /shorts?open=<id>：列表读到后自动打开那条成片的预览，处理完把参数去掉。

const read = (p: string) => readFileSync(resolve(__dirname, p), "utf8");

describe("开始制作 · 扣费确认只走 confirmShortStart", () => {
  const consoleSrc = read("../../../components/drama-workshop/short-create-console.tsx");
  const promptSrc = read("./prompt/page.tsx");

  it("/shorts/new 与 /shorts/prompt 都调共享确认，不再各自拼 dramaConfirm({ cost })", () => {
    expect(consoleSrc).toMatch(/confirmShortStart\(cfg, SHORT_START_LEAD\.fromIdea\)/);
    expect(promptSrc).toMatch(/confirmShortStart\(\s*cfg,/);
    for (const src of [consoleSrc, promptSrc]) {
      expect(src).toMatch(/from "(@\/components\/drama-workshop|\.)\/short-start-confirm"/);
      expect(src).not.toMatch(/dramaConfirm\(\{\s*cost/);
    }
  });

  it("旧的 SHORT_ENTRY_CONFIRM 已删，没人再引用", () => {
    expect(consoleSrc).not.toMatch(/SHORT_ENTRY_CONFIRM/);
    expect(promptSrc).not.toMatch(/SHORT_ENTRY_CONFIRM/);
  });
});

// ── /shorts/new「随机来一个」：从推荐点子里取主题，不是模板的风格描述 ───────────

describe("「随机来一个」· pickSparkIdea", () => {
  const idea = (hook: string, personal?: boolean): IdeaRec => ({ cat: "c", title: "t", hook, from: "#000", to: "#fff", personal });

  it("按点击次数轮流取推荐点子的钩子，跳过个人向与空钩子，取完一圈再从头来", () => {
    const pool = [idea("A"), idea("我自己的经历", true), idea("  "), idea("B"), idea("C")];
    expect([0, 1, 2, 3, 4].map((n) => pickSparkIdea(pool, n))).toEqual(["A", "B", "C", "A", "B"]);
  });

  it("没有可用点子时返回 null（调用方只聚焦输入框，不填东西）", () => {
    expect(pickSparkIdea([], 0)).toBeNull();
    expect(pickSparkIdea([idea("x", true), idea("")], 3)).toBeNull();
  });

  it("内置默认目录里取得到，并且取的是 ideas 的钩子", () => {
    const hook = pickSparkIdea(CATALOG_DEFAULTS.ideas, 0);
    expect(hook).toBeTruthy();
    expect(CATALOG_DEFAULTS.ideas.map((r) => r.hook)).toContain(hook);
  });

  it("按钮接的是目录里的推荐点子，不再是模板的风格描述（recipePromptSeed）", () => {
    const src = read("../../../components/drama-workshop/short-create-console.tsx");
    expect(src).toMatch(/pickSparkIdea\(cat\.ideas, sparkN\)/);
    expect(src).not.toMatch(/recipePromptSeed\(/);
  });
});

// ── /shorts?open=<id> ────────────────────────────────────────────────────────

let search = new URLSearchParams();
const replace = vi.fn();
const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, push, back: () => {}, prefetch: () => {} }),
  useSearchParams: () => search,
  usePathname: () => "/shorts",
}));

const listDrafts = vi.fn();
const getDraft = vi.fn();
vi.mock("@/api", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    ShortsApi: {
      ...(actual.ShortsApi as Record<string, unknown>),
      listDrafts: (...a: unknown[]) => listDrafts(...a),
      getDraft: (...a: unknown[]) => getDraft(...a),
    },
  };
});

import ShortsStudioPage from "./page";
import { pickSparkIdea } from "@/components/drama-workshop/short-create-console";
import { CATALOG_DEFAULTS } from "@/api/catalog";
import type { IdeaRec } from "@/mocks/drama-workshop";
import { invalidate } from "@/lib/drama-query";

function summary(id: string, status: "done" | "draft") {
  return {
    id,
    title: `作品 ${id}`,
    fmtKey: null,
    fmtName: "短视频",
    from: "#000000",
    to: "#ffffff",
    durationSec: status === "done" ? 24 : 0,
    shotCount: 4,
    doneCount: status === "done" ? 4 : 1,
    status,
    progress: status === "done" ? 100 : 30,
    coverUrl: null,
    videoUrl: status === "done" ? `https://cdn.test/${id}.mp4` : null,
    updated: "",
    updatedAt: "2026-09-28T02:00:00Z",
  };
}

async function flush() {
  await act(async () => {
    for (let i = 0; i < 10; i++) await Promise.resolve();
  });
}

/** 预览弹窗用的是 compactActions 版式，按它的 test id 判断弹没弹（不按文案）。 */
const previewOpen = (c: HTMLElement) => !!c.querySelector('[data-testid="compact-preview-actions"]');

beforeEach(() => {
  invalidate("/me/drama/shorts"); // drama-query 是模块级缓存，每条用例从空缓存开始
  listDrafts.mockReset();
  getDraft.mockReset();
  replace.mockReset();
  push.mockReset();
});
afterEach(() => cleanup());

describe("/shorts?open=<id>", () => {
  it("已完成的：自动打开成片预览，并把 open 参数去掉（其他参数保留）", async () => {
    search = new URLSearchParams("open=s_done&from=make");
    listDrafts.mockResolvedValue([summary("s_draft", "draft"), summary("s_done", "done")]);
    const { container } = render(<ShortsStudioPage />);
    await flush();
    expect(previewOpen(container)).toBe(true);
    expect(container.querySelector('video[controls]')?.getAttribute("src")).toBe("https://cdn.test/s_done.mp4");
    expect(replace).toHaveBeenCalledTimes(1);
    expect(replace.mock.calls[0][0]).toBe("/shorts?from=make");
    expect(getDraft).not.toHaveBeenCalled();
  });

  it("没完成的：不打开，也不跳去制作页，只去掉参数", async () => {
    search = new URLSearchParams("open=s_draft");
    listDrafts.mockResolvedValue([summary("s_draft", "draft")]);
    getDraft.mockResolvedValue({ meta: summary("s_draft", "draft"), data: {} });
    const { container } = render(<ShortsStudioPage />);
    await flush();
    expect(previewOpen(container)).toBe(false);
    expect(push).not.toHaveBeenCalled();
    expect(replace).toHaveBeenCalledWith("/shorts", { scroll: false });
  });

  it("列表是旧缓存（还显示草稿）但单条核对已完成：照样打开", async () => {
    search = new URLSearchParams("open=s_x");
    listDrafts.mockResolvedValue([summary("s_x", "draft")]);
    getDraft.mockResolvedValue({ meta: summary("s_x", "done"), data: {} });
    const { container } = render(<ShortsStudioPage />);
    await flush();
    expect(getDraft).toHaveBeenCalledWith("s_x");
    expect(previewOpen(container)).toBe(true);
  });

  it("找不到的：静默忽略，不打开、不抛", async () => {
    search = new URLSearchParams("open=gone");
    listDrafts.mockResolvedValue([summary("s_done", "done")]);
    getDraft.mockRejectedValue(new Error("not found"));
    const { container } = render(<ShortsStudioPage />);
    await flush();
    expect(previewOpen(container)).toBe(false);
    expect(replace).toHaveBeenCalledWith("/shorts", { scroll: false });
  });

  it("没有 open 参数：不动地址栏", async () => {
    search = new URLSearchParams();
    listDrafts.mockResolvedValue([summary("s_done", "done")]);
    const { container } = render(<ShortsStudioPage />);
    await flush();
    expect(previewOpen(container)).toBe(false);
    expect(replace).not.toHaveBeenCalled();
  });

  it("列表还没读到时先不处理：读到后再打开", async () => {
    search = new URLSearchParams("open=s_done");
    let resolveList: (v: unknown) => void = () => {};
    listDrafts.mockReturnValue(new Promise((r) => (resolveList = r)));
    const { container } = render(<ShortsStudioPage />);
    await flush();
    expect(replace).not.toHaveBeenCalled();
    expect(previewOpen(container)).toBe(false);
    resolveList([summary("s_done", "done")]);
    await flush();
    expect(previewOpen(container)).toBe(true);
    expect(replace).toHaveBeenCalledTimes(1);
  });
});
