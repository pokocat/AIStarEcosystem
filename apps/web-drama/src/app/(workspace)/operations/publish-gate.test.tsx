import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render } from "@testing-library/react";

// §8.0.1 ⑩：钉行为不钉文案。运营页读目录必须走 strict（读失败抛、不回落默认），
// 读不到线上内容时两个「发布」都发不出去（v0.197 第二轮，docs/drama-ux-copy-pass.md）。
// 元素一律按 data-ops-* 定位，不按按钮上的字。

const getCatalog = vi.fn();
const saveCatalog = vi.fn((..._args: unknown[]) => Promise.resolve());
vi.mock("@/api/catalog", () => ({
  getCatalog: (...args: unknown[]) => getCatalog(...args),
  saveCatalog: (...args: unknown[]) => saveCatalog(...args),
  invalidateCatalog: () => {},
  resetCatalog: () => Promise.resolve(),
  generateHotspots: () => Promise.resolve([]),
}));
vi.mock("@ai-star-eco/api-client", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useAuth: () => ({ user: { id: "u-op", operatorRole: "operator" } }),
}));
// 模板审核自己拉数据，与这里无关
vi.mock("@/components/drama-workshop/recipe-review-section", () => ({ RecipeReviewSection: () => null }));

import OperationsPage from "./page";

const CATALOG = {
  contentTypes: [],
  templates: {},
  formats: [],
  hotTopics: [{ label: "线上热点", idea: "线上热点的完整点子" }],
  ideas: [{ cat: "悬疑", title: "线上点子", hook: "钩子", from: "#000000", to: "#ffffff" }],
};

async function flush() {
  await act(async () => {
    for (let i = 0; i < 10; i++) await Promise.resolve();
  });
}

function publishButtons(container: HTMLElement) {
  return Array.from(container.querySelectorAll<HTMLButtonElement>("[data-ops-publish]"));
}

beforeEach(() => {
  getCatalog.mockReset();
  saveCatalog.mockClear();
});
afterEach(() => cleanup());

describe("运营页 · 读目录与发布闸", () => {
  it("读目录带 strict（读失败要抛出来，不许悄悄换成默认值）", async () => {
    getCatalog.mockResolvedValue(CATALOG);
    render(<OperationsPage />);
    await flush();
    expect(getCatalog).toHaveBeenCalled();
    for (const call of getCatalog.mock.calls) expect(call[0]).toEqual({ strict: true });
  });

  it("读成功：两个发布都能点，点了就发", async () => {
    getCatalog.mockResolvedValue(CATALOG);
    const { container } = render(<OperationsPage />);
    await flush();
    const btns = publishButtons(container);
    expect(btns.map((b) => b.dataset.opsPublish).sort()).toEqual(["hotTopics", "ideas"]);
    for (const b of btns) expect(b.disabled).toBe(false);
    fireEvent.click(btns.find((b) => b.dataset.opsPublish === "hotTopics")!);
    await flush();
    expect(saveCatalog).toHaveBeenCalledWith("hotTopics", CATALOG.hotTopics);
  });

  it("一次都没读到：出错误态，编辑区和发布按钮都不出", async () => {
    getCatalog.mockRejectedValue(new Error("Failed to fetch"));
    const { container } = render(<OperationsPage />);
    await flush();
    expect(container.querySelector('[data-ops-read-failed="never-loaded"]')).not.toBeNull();
    expect(publishButtons(container)).toHaveLength(0);
    expect(saveCatalog).not.toHaveBeenCalled();
  });

  it("读到过、重新加载失败：保留上次内容，但两个发布都禁用、点了也不发", async () => {
    getCatalog.mockResolvedValueOnce(CATALOG).mockRejectedValueOnce(new Error("HTTP 502"));
    const { container } = render(<OperationsPage />);
    await flush();
    fireEvent.click(container.querySelector<HTMLButtonElement>("[data-ops-reload]")!);
    await flush();
    expect(container.querySelector('[data-ops-read-failed="stale"]')).not.toBeNull();
    const btns = publishButtons(container);
    expect(btns).toHaveLength(2);
    for (const b of btns) {
      expect(b.disabled).toBe(true);
      expect(b.title).not.toBe("");
      fireEvent.click(b);
    }
    await flush();
    expect(saveCatalog).not.toHaveBeenCalled();
  });

  it("失败后重试读到了：发布恢复可用", async () => {
    getCatalog.mockRejectedValueOnce(new Error("Failed to fetch")).mockResolvedValueOnce(CATALOG);
    const { container } = render(<OperationsPage />);
    await flush();
    const retry = container.querySelector<HTMLButtonElement>('[data-ops-read-failed="never-loaded"] button')!;
    fireEvent.click(retry);
    await flush();
    expect(container.querySelector("[data-ops-read-failed]")).toBeNull();
    const btns = publishButtons(container);
    expect(btns).toHaveLength(2);
    for (const b of btns) expect(b.disabled).toBe(false);
  });
});
