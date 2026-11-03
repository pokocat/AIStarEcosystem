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
  notes: ["第 2 集结尾补入 1 段（从「掌柜：里边请。」开始）"], warnings: ["设定拆分为 3 集，实际拆分为 2 集。结果不合适可放弃后重新拆分"],
};

test("marked episodes split for free without asking who pays", async () => {
  api.runTask.mockResolvedValue(base);
  render(<DirectorScript work={{ ...base, draftEpisodeHeadings: 2 }} apply={vi.fn()} setError={vi.fn()} {...({} as any)}/>);
  fireEvent.click(screen.getByRole("button", { name: /按标题拆分/ }));
  await waitFor(() => expect(api.runTask).toHaveBeenCalledWith("split-test", expect.objectContaining({ type: "split", maxCost: 0, billing: undefined })));
});

test("unrecognised headings ask first, and a typed heading start splits for free", async () => {
  const apply = vi.fn(); api.runTask.mockResolvedValue(base);
  render(<DirectorScript work={base} apply={apply} setError={vi.fn()} {...({} as any)}/>);
  fireEvent.click(screen.getByRole("button", { name: /拆分剧本/ }));
  const dialog = await screen.findByRole("dialog", { name: "选择拆分方式" });
  expect(api.runTask).not.toHaveBeenCalled();
  const submit = screen.getByRole("button", { name: /按标题拆分/ });
  expect((submit as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(screen.getByRole("radio", { name: /^按分集标题拆分/ }));
  fireEvent.change(screen.getByLabelText(/第 1 集标题行/), { target: { value: " Chapter " } });
  fireEvent.click(screen.getByRole("button", { name: /按标题拆分/ }));
  await waitFor(() => expect(api.runTask).toHaveBeenCalledWith("split-test", expect.objectContaining({ type: "split", options: { marker: "Chapter" }, maxCost: 0 })));
  expect(api.runTask.mock.calls[0][1].billing).toBeUndefined();
  await waitFor(() => expect(dialog.isConnected).toBe(false));
  expect(apply).toHaveBeenCalledTimes(1);
});

test("a heading start that is not found keeps the dialog open with the reason", async () => {
  api.runTask.mockRejectedValue(new Error("未找到与「Chapter」格式相同的分集标题"));
  render(<DirectorScript work={base} apply={vi.fn()} setError={vi.fn()} {...({} as any)}/>);
  fireEvent.click(screen.getByRole("button", { name: /拆分剧本/ }));
  fireEvent.click(await screen.findByRole("radio", { name: /^按分集标题拆分/ }));
  fireEvent.change(screen.getByLabelText(/第 1 集标题行/), { target: { value: "Chapter" } });
  fireEvent.click(screen.getByRole("button", { name: /按标题拆分/ }));
  expect(await screen.findByText(/未找到与「Chapter」格式相同/)).toBeTruthy();
  expect(screen.getByRole("dialog", { name: "选择拆分方式" })).toBeTruthy();
});

test("choosing AI splitting sends the episode count and the price cap", async () => {
  api.runTask.mockResolvedValue(base);
  render(<DirectorScript work={base} apply={vi.fn()} setError={vi.fn()} {...({} as any)}/>);
  fireEvent.change(screen.getByPlaceholderText("自动"), { target: { value: "12" } });
  fireEvent.click(screen.getByRole("button", { name: /拆分剧本/ }));
  fireEvent.click(await screen.findByRole("radio", { name: /^AI 按剧情拆分/ }));
  fireEvent.click(screen.getByRole("button", { name: /AI 拆分/ }));
  await waitFor(() => expect(api.runTask).toHaveBeenCalledWith("split-test", expect.objectContaining({ type: "split", options: { episodeCount: 12 }, maxCost: 21 })));
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
