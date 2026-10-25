// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { DirectorScript } from "./director-script";
import { clearDrafts } from "./director-shared";

const api = vi.hoisted(() => ({ edit: vi.fn(), runTask: vi.fn(), patchWork: vi.fn() }));
vi.mock("../api", () => ({ DirectorApi: api }));

beforeEach(() => { vi.clearAllMocks(); clearDrafts("split-test"); });
afterEach(cleanup);

// 形状照服务端 DirectorService#view：拆分前的作品带 draftEpisodeHeadings / pendingSplit / reference / canUndoSplit。
const base: any = {
  id: "split-test", idea: "", genre: "", tone: "", logline: "", outline: null, draftRev: 3, tasks: [], episodes: [], clips: [], assets: [],
  settings: { style: "真人写实", aspectRatio: "9:16" }, pricing: { textMax: 21, image: 8, mock: false }, pipeline: null,
  reference: "", referenceRev: 0, pendingSplit: null, canUndoSplit: false, draftEpisodeHeadings: 0,
  draft: "设定：主角看不见。\n# 第1集 下山\n师父：去吧。\n# 第2集 进城\n掌柜：里边请。",
};

const pending = {
  id: "sp1", runId: "IPR-1", source: "model", at: "2026-10-25T08:00:00Z", paragraphCount: 5,
  preamble: { paragraphs: 1, chars: 8, head: "设定：主角看不见。", tail: "设定：主角看不见。" },
  episodes: [
    { title: "下山", summary: "", startParagraph: 1, endParagraph: 2, paragraphs: 2, chars: 12, head: "第1集 下山", tail: "师父：去吧。" },
    { title: "进城", summary: "", startParagraph: 3, endParagraph: 4, paragraphs: 2, chars: 12, head: "第2集 进城", tail: "掌柜：里边请。" },
  ],
  notes: ["第 2 集结尾补入 1 段（从「掌柜：里边请。」开始）"], warnings: ["你要求分成 3 集，这次分成了 2 集。不合适可以放弃后重新拆分"],
};

test("marked episodes split for free without asking who pays", async () => {
  api.runTask.mockResolvedValue(base);
  render(<DirectorScript work={{ ...base, draftEpisodeHeadings: 2 }} apply={vi.fn()} setError={vi.fn()} {...({} as any)}/>);
  fireEvent.click(screen.getByRole("button", { name: /按标题分集/ }));
  await waitFor(() => expect(api.runTask).toHaveBeenCalledWith("split-test", expect.objectContaining({ type: "split", maxCost: 0, billing: undefined })));
});

test("the preview shows what was fixed and saves the chosen place for the opening notes", async () => {
  const apply = vi.fn(); api.edit.mockResolvedValue(base);
  render(<DirectorScript work={{ ...base, pendingSplit: pending }} apply={apply} setError={vi.fn()} {...({} as any)}/>);
  expect(screen.getByText(/分成 2 集/)).toBeTruthy();
  expect(screen.getByText(pending.notes[0])).toBeTruthy();
  expect(screen.getByText(pending.warnings[0])).toBeTruthy();
  fireEvent.click(screen.getByRole("radio", { name: /并入第 1 集/ }));
  fireEvent.click(screen.getByRole("button", { name: "确认分集" }));
  await waitFor(() => expect(api.edit).toHaveBeenCalledWith("split-test", "split.save", "sp1", null, { preamble: "episode" }));
  expect(apply).toHaveBeenCalledTimes(1);
});

test("split episodes offer undo and keep the reference notes editable", async () => {
  const work = { ...base, draft: "", canUndoSplit: true, reference: "设定：主角看不见。", referenceRev: 2,
    episodes: [{ id: "ep1", no: 1, title: "下山", summary: "", content: "师父：去吧。", extracted: false, planStale: false, rev: 1, planError: null, pendingPlan: null }] };
  api.edit.mockResolvedValue({ ...work, episodes: [], canUndoSplit: false });
  render(<DirectorScript work={work} apply={vi.fn()} setError={vi.fn()} {...({} as any)}/>);
  fireEvent.click(screen.getByRole("button", { name: /设定资料/ }));
  fireEvent.click(screen.getByRole("button", { name: "并入第 1 集" }));
  await waitFor(() => expect(api.edit).toHaveBeenCalledWith("split-test", "reference.toEpisode", null, 2));
  fireEvent.click(screen.getAllByRole("button", { name: /撤销拆分/ })[0]);
  fireEvent.click(screen.getAllByRole("button", { name: "撤销拆分" }).at(-1)!);
  await waitFor(() => expect(api.edit).toHaveBeenCalledWith("split-test", "split.undo", null, null));
});
