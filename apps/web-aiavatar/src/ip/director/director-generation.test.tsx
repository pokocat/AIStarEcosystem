// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import type { DirectorWork } from "@ai-star-eco/types";
import { runDirectorTask, saveDirectorDrafts, withSavedDirectorDrafts } from "./director-generation";
import { clearDrafts, hasDrafts, useDraft } from "./director-shared";

const api = vi.hoisted(() => ({ runTask: vi.fn(), edit: vi.fn(), patchWork: vi.fn() }));
vi.mock("../api", () => ({ DirectorApi: api }));
const work = { id: "autosave", revision: 1, draftRev: 1, referenceRev: 1,
  episodes: [{ id: "e1", rev: 1 }], assets: [{ id: "a1", rev: 1 }], clips: [{ id: "c1", rev: 1 }],
} as DirectorWork;
function Draft({ field }: { field: string }) {
  const [value, set] = useDraft(field, "");
  return <input aria-label={field} value={value} onChange={e => set(e.target.value)}/>;
}
function type(field: string, value: string) {
  render(<Draft field={field}/>);
  fireEvent.change(screen.getByLabelText(field), { target: { value } });
}
afterEach(() => { cleanup(); clearDrafts("autosave:"); vi.resetAllMocks(); });

test("saves scripts, reference notes, episodes and both media prompts before generation", async () => {
  type("autosave:draft", "新版剧本");
  type("autosave:reference", "新版设定资料");
  type("autosave:ep:e1:content", "新版本集正文");
  type("autosave:asset:a1:description", "40岁，深色衣服");
  type("autosave:clip:c1:prompt:board", "新的分镜画面");
  type("autosave:clip:c1:prompt:video", "新的视频提示词");
  api.patchWork.mockResolvedValue(work);
  api.edit.mockResolvedValue(work);
  api.runTask.mockResolvedValue(work);
  await runDirectorTask(work, vi.fn(), { type: "video", targetId: "c1", clientRequestId: "req" });
  expect(api.patchWork).toHaveBeenCalledWith("autosave", { draft: "新版剧本", draftRev: 1 });
  expect(api.edit.mock.calls.map(c => c[1])).toEqual(["reference.update", "episode.update", "asset.update", "clip.update"]);
  expect(api.edit).toHaveBeenLastCalledWith("autosave", "clip.update", "c1", 1, { boardPrompt: "新的分镜画面", videoPrompt: "新的视频提示词" });
  expect(api.edit.mock.invocationCallOrder.at(-1)).toBeLessThan(api.runTask.mock.invocationCallOrder[0]);
  expect(hasDrafts("autosave:")).toBe(false);
});

test("edits typed during a save are saved using the returned revision before dispatch", async () => {
  type("autosave:asset:a1:description", "40岁");
  let finish!: (value: DirectorWork) => void;
  api.edit.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }))
    .mockResolvedValueOnce({ ...work, assets: [{ id: "a1", rev: 3 }] });
  api.runTask.mockResolvedValue(work);
  const generating = runDirectorTask(work, vi.fn(), { type: "asset-image", targetId: "a1", clientRequestId: "req" });
  await vi.waitFor(() => expect(api.edit).toHaveBeenCalledTimes(1));
  fireEvent.change(screen.getByLabelText("autosave:asset:a1:description"), { target: { value: "45岁，深色夹克" } });
  expect(api.runTask).not.toHaveBeenCalled();
  await act(async () => { finish({ ...work, assets: [{ id: "a1", rev: 2 }] } as DirectorWork); await generating; });
  expect(api.edit).toHaveBeenLastCalledWith("autosave", "asset.update", "a1", 2, { description: "45岁，深色夹克" });
  expect(api.runTask).toHaveBeenCalledTimes(1);
  expect(hasDrafts("autosave:")).toBe(false);
});

test("saving a custom prompt does not replace it with the appearance description", async () => {
  type("autosave:asset:a1:description", "40岁男性");
  type("autosave:asset:a1:prompt", "45岁男性，黑色夹克，半身像");
  api.edit.mockResolvedValue(work);
  api.runTask.mockResolvedValue(work);
  await runDirectorTask(work, vi.fn(), { type: "asset-image", targetId: "a1", clientRequestId: "req" });
  expect(api.edit).toHaveBeenCalledWith("autosave", "asset.update", "a1", 1, { description: "40岁男性", prompt: "45岁男性，黑色夹克，半身像" });
});

test("pipeline actions receive saved content and saving failure prevents any generation", async () => {
  type("autosave:asset:a1:description", "新的角色设定");
  api.edit.mockRejectedValue(new Error("保存失败"));
  const start = vi.fn();
  await expect(withSavedDirectorDrafts(work, vi.fn(), start)).rejects.toThrow("保存失败");
  expect(start).not.toHaveBeenCalled();
  expect(hasDrafts("autosave:asset:a1:")).toBe(true);
  const saved = { ...work, revision: 2 };
  api.edit.mockResolvedValue(saved);
  start.mockResolvedValue(saved);
  await withSavedDirectorDrafts(work, vi.fn(), start);
  expect(start).toHaveBeenCalledWith(saved);
});

test("simultaneous generate buttons share a single successful draft save", async () => {
  type("autosave:asset:a1:description", "新的角色设定");
  api.edit.mockResolvedValue(work);
  api.runTask.mockResolvedValue(work);
  await Promise.all([
    runDirectorTask(work, vi.fn(), { type: "asset-image", targetId: "a1", clientRequestId: "req1" }),
    runDirectorTask(work, vi.fn(), { type: "board", targetId: "c1", clientRequestId: "req2" }),
  ]);
  expect(api.edit).toHaveBeenCalledTimes(1);
  expect(api.runTask).toHaveBeenCalledTimes(2);
});

test("batch preparation and single generation also share the save queue", async () => {
  type("autosave:asset:a1:description", "新的角色设定");
  api.edit.mockResolvedValue(work);
  api.runTask.mockResolvedValue(work);
  await Promise.all([
    saveDirectorDrafts(work, vi.fn()),
    runDirectorTask(work, vi.fn(), { type: "asset-image", targetId: "a1", clientRequestId: "req" }),
  ]);
  expect(api.edit).toHaveBeenCalledTimes(1);
  expect(api.runTask).toHaveBeenCalledTimes(1);
});
