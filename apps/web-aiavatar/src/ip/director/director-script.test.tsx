// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import type { DirectorTask, DirectorWork } from "@ai-star-eco/types";
import { DirectorScript } from "./director-script";

vi.mock("../api", () => ({ DirectorApi: {} }));

const rewriting: DirectorTask = { id: "r", target: "script", status: "running", stage: null, cost: 0, errorMessage: null, createdAt: "2026-10-26T00:00:00Z" };

function work(over: Partial<DirectorWork>): DirectorWork {
  return {
    id: "w", title: "作品", revision: 1, createdAt: "2026-10-26T00:00:00Z", updatedAt: "2026-10-26T00:00:00Z",
    idea: "故事创意", logline: "", draft: "旧剧本正文", draftRev: 1,
    settings: { style: "真人写实", aspectRatio: "9:16", language: "中文", videoModel: null, textModel: null },
    episodes: [], assets: [], clips: [], pipeline: null, notice: null, textError: null, tasks: [],
    pricing: { textMax: 2, image: 16, mock: false }, videoModels: [], videoLimits: null,
    draftEpisodeHeadings: 0, reference: "", referenceRev: 0, pendingSplit: null, canUndoSplit: false,
    ...over,
  };
}

const noop = () => {};
const props = { episodeId: null, apply: noop, setError: noop, goTab: noop, reviewExtract: noop, openSettings: noop, pickEpisode: noop, startPipeline: noop };

afterEach(cleanup);

test("rewriting an unsplit draft hides the old text and next step until the new script arrives", () => {
  const { rerender } = render(<DirectorScript {...props} work={work({ tasks: [rewriting] })}/>);
  expect(screen.getByText("AI 正在重新写剧本")).toBeTruthy();
  expect(screen.queryByRole("textbox", { name: "剧本正文" })).toBeNull();
  expect(screen.queryByRole("button", { name: /AI 拆分/ })).toBeNull();
  expect(screen.getByRole("button", { name: "已保存" })).toHaveProperty("disabled", true);
  // 失败后任务结束，旧稿原样回来。
  rerender(<DirectorScript {...props} work={work({ tasks: [{ ...rewriting, status: "failed" }] })}/>);
  expect((screen.getByRole("textbox", { name: "剧本正文" }) as HTMLTextAreaElement).value).toBe("旧剧本正文");
});

test("rewriting a split script hides the episode list until the new script arrives", () => {
  const ep = { id: "e1", no: 1, title: "第一集", summary: "", content: "第一集正文", extracted: false, planStale: false, planError: null, pendingPlan: null, rev: 0 };
  const { rerender } = render(<DirectorScript {...props} work={work({ draft: "", episodes: [ep], tasks: [rewriting] })}/>);
  expect(screen.getByText("AI 正在重新写剧本")).toBeTruthy();
  expect(screen.queryByText("第一集")).toBeNull();
  expect(screen.getByRole("button", { name: "收起全部" })).toHaveProperty("disabled", true);
  rerender(<DirectorScript {...props} work={work({ draft: "", episodes: [ep] })}/>);
  expect(screen.getByText("第一集")).toBeTruthy();
});
