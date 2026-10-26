// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type { DirectorWork } from "@ai-star-eco/types";
import { DirectorWorkbench } from "./director-workbench";
import { DirectorApi } from "../api";

vi.mock("@/components/hub/auth", () => ({ useRequireAuth: () => "ok", PlatformGateScreen: () => null }));
vi.mock("next/link", () => ({ default: ({ children, ...props }: React.ComponentProps<"a">) => <a {...props}>{children}</a> }));
vi.mock("../api", () => ({ DirectorApi: { getWork: vi.fn(), patchWork: vi.fn() } }));
vi.mock("./director-script", () => ({ DirectorScript: () => null }));
vi.mock("./director-assets", () => ({ DirectorAssets: () => null }));
vi.mock("./director-storyboard", () => ({ DirectorStoryboard: () => null }));
vi.mock("./director-extract", () => ({ ExtractReview: () => null }));

function work(mode: "fixed" | "selectable" = "selectable"): DirectorWork {
  return {
    id: "w", title: "原作品名", revision: 1, createdAt: "2026-10-26T00:00:00Z", updatedAt: "2026-10-26T00:00:00Z",
    idea: "故事创意", logline: "", draft: "", draftRev: 0,
    settings: { style: "真人写实", aspectRatio: "9:16", language: "中文", videoModel: null, textModel: null },
    episodes: [], assets: [], clips: [], pipeline: null, notice: null, textError: null, tasks: [],
    pricing: { textMax: 2, image: 16, mock: false }, videoModels: [], videoLimits: null, textModelMode: mode,
    textModels: [
      { endpointId: "ds", name: "DeepSeek", isDefault: true, tokenPricing: { inputCreditsPerK: 0.01, outputCreditsPerK: 0.1, maxInputTokens: 65536, maxOutputTokens: 8192, maxCost: 2 } },
      { endpointId: "claude", name: "Claude", isDefault: false, tokenPricing: { inputCreditsPerK: 1, outputCreditsPerK: 10, maxInputTokens: 65536, maxOutputTokens: 8192, maxCost: 148 } },
    ],
  };
}

beforeEach(() => { vi.resetAllMocks(); });
afterEach(cleanup);

test("settings opens from the workbench, previews each model's price and saves the chosen endpoint", async () => {
  const current = work();
  vi.mocked(DirectorApi.getWork).mockResolvedValue(current);
  vi.mocked(DirectorApi.patchWork).mockResolvedValue({ ...current, title: "AI 新剧名", revision: 2, settings: { ...current.settings, textModel: "claude" }, pricing: { ...current.pricing, textMax: 148 } });
  render(<DirectorWorkbench id="w"/>);
  fireEvent.click(await screen.findByRole("button", { name: "真人写实 · 9:16" }));
  const dialog = screen.getByRole("dialog", { name: "作品设置" });
  expect(within(dialog).getByText(/输入 0.01 积分，输出 0.1 积分/)).toBeTruthy();
  // SelectField 的原生适配层把真实 change 事件交回设置面板。
  const select = dialog.querySelector("select")!;
  fireEvent.change(select, { target: { value: "claude" } });
  expect(within(dialog).getByText(/输入 1 积分，输出 10 积分。每次最多冻结 148 积分/)).toBeTruthy();
  fireEvent.click(within(dialog).getByRole("button", { name: "保存" }));
  await waitFor(() => expect(DirectorApi.patchWork).toHaveBeenCalledWith("w", { settings: { style: "真人写实", aspectRatio: "9:16", textModel: "claude", videoModel: null } }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect((screen.getByRole("textbox", { name: "作品名" }) as HTMLInputElement).value).toBe("AI 新剧名");
});

test("fixed model policy disables the settings selector", async () => {
  vi.mocked(DirectorApi.getWork).mockResolvedValue(work("fixed"));
  render(<DirectorWorkbench id="w"/>);
  fireEvent.click(await screen.findByRole("button", { name: "真人写实 · 9:16" }));
  const dialog = screen.getByRole("dialog", { name: "作品设置" });
  expect(dialog.querySelector("select")!.disabled).toBe(true);
});
