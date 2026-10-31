// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { ApiError } from "@ai-star-eco/api-client";
import type { DirectorWork } from "@ai-star-eco/types";
import { StartPipeline } from "./director-workbench";
import { DirectorApi } from "../api";

vi.mock("../api", () => ({ DirectorApi: { estimatePipeline: vi.fn(), pipeline: vi.fn() }, IpStudioApi: {} }));
vi.mock("@/components/hub/auth", () => ({ PlatformGateScreen: () => null, useRequireAuth: () => "ok" }));

// 一键制作 → 分镜脚本：分镜脚本都写好了时点「开始」什么都不会做（2026-10-27 用户反馈「点了没反应」）。
// 现在先说清楚、主按钮换成去重写的地方；服务端判定没有可做的也照样说原因，不当成功关掉弹窗。
const ep = (id: string, no: number) => ({ id, no, title: `第${no}集`, summary: "", content: "正文", extracted: true, planStale: false, planError: null, pendingPlan: null, rev: 1 });
const work = { id: "w", episodes: [ep("e1", 1), ep("e2", 2)], clips: [], pricing: { textMax: 21, image: 8, mock: false } } as unknown as DirectorWork;
const estimate = (textCount: number) => ({ target: "plan", rough: false, total: 0, recommended: 10, text: { count: textCount, credits: 0 }, images: { count: 0, credits: 0 },
  videos: { included: false, clips: 0, seconds: 0, credits: 0, error: null } });

beforeEach(() => { vi.mocked(DirectorApi.pipeline).mockReset(); vi.mocked(DirectorApi.estimatePipeline).mockReset(); });
afterEach(cleanup);

test("when every storyboard is written the dialog says so and points to the rewrite buttons", async () => {
  vi.mocked(DirectorApi.estimatePipeline).mockResolvedValue(estimate(0) as never);
  const goTab = vi.fn(), onClose = vi.fn();
  render(<StartPipeline work={work} episodeId="e1" apply={vi.fn()} setError={vi.fn()} goTab={goTab} onClose={onClose}/>);
  fireEvent.click(screen.getByRole("button", { name: "分镜脚本" }));
  expect(await screen.findByText(/全部 2 集的分镜脚本都已写好。一键制作只补还没做的步骤，不会重写已有的分镜脚本/)).toBeTruthy();
  expect(screen.queryByRole("button", { name: /开始/ })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "前往分镜" }));
  expect(goTab).toHaveBeenCalledWith("storyboard");
  expect(onClose).toHaveBeenCalled();
  expect(DirectorApi.pipeline).not.toHaveBeenCalled();
});

test("when the server finds nothing to do the dialog stays open with its reason", async () => {
  vi.mocked(DirectorApi.estimatePipeline).mockResolvedValue(estimate(1) as never);
  vi.mocked(DirectorApi.pipeline).mockRejectedValue(new ApiError({ code: "DIRECTOR_PIPELINE_NOTHING_TO_DO", message: "第 1 集有一份新写的分镜脚本等你决定要不要换，请到「分镜」处理" }, 409));
  const onClose = vi.fn();
  render(<StartPipeline work={work} episodeId="e1" apply={vi.fn()} setError={vi.fn()} goTab={vi.fn()} onClose={onClose}/>);
  fireEvent.click(screen.getByRole("button", { name: "分镜脚本" }));
  fireEvent.click(await screen.findByRole("button", { name: "按推荐预算开始" }));
  expect(await screen.findByText(/有一份新写的分镜脚本等你决定要不要换/)).toBeTruthy();
  expect(screen.getByRole("button", { name: "前往分镜" })).toBeTruthy();
  expect(onClose).not.toHaveBeenCalled();
});

test("a storyboard left to write starts once and closes the dialog", async () => {
  vi.mocked(DirectorApi.estimatePipeline).mockResolvedValue(estimate(1) as never);
  vi.mocked(DirectorApi.pipeline).mockResolvedValue({} as never);
  const onClose = vi.fn();
  render(<StartPipeline work={work} episodeId="e1" apply={vi.fn()} setError={vi.fn()} goTab={vi.fn()} onClose={onClose}/>);
  fireEvent.click(screen.getByRole("button", { name: "分镜脚本" }));
  const start = await screen.findByRole("button", { name: "按推荐预算开始" });
  fireEvent.click(start); fireEvent.click(start);
  await vi.waitFor(() => expect(onClose).toHaveBeenCalled());
  expect(DirectorApi.pipeline).toHaveBeenCalledTimes(1);
  expect(vi.mocked(DirectorApi.pipeline).mock.calls[0][1]).toMatchObject({ action: "start", target: "plan", scope: "work" });
});
