// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type { DirectorClip, DirectorMedia, DirectorWork } from "@ai-star-eco/types";
import { DirectorStoryboard } from "./director-storyboard";
import { DirectorApi } from "../api";

vi.mock("../api", () => ({ DirectorApi: { edit: vi.fn(), quote: vi.fn() } }));
vi.mock("./director-script-reference", () => ({ StoryboardSide: () => null }));
vi.mock("./director-output", () => ({ ClipVideo: () => null, EpisodeOutput: () => null }));

const media = (id: string): DirectorMedia => ({ id, key: `k-${id}`, url: `https://cdn.test/${id}.mp4`, runId: null, source: "generated", createdAt: "2026-10-29T00:00:00Z" });

function clip(adoptedId: string, adoptedBy: "user" | "auto" = "user"): DirectorClip {
  return {
    id: "c1", episodeId: "e1", order: 1, title: "雨夜", summary: "", durationSec: 12, assetIds: [], shots: [],
    boardPrompt: "", boardPromptCustom: false, videoPrompt: "", videoPromptCustom: false,
    board: { candidates: [media("b1")], adoptedId: "b1", adoptedBy: "user", error: null },
    video: { candidates: [media("v1"), media("v2"), media("v3")], adoptedId, adoptedBy, error: null },
    issues: [], unvoiced: [], rev: 1,
  };
}

function work(c: DirectorClip): DirectorWork {
  return {
    id: "w", title: "作品", revision: 1, createdAt: "2026-10-29T00:00:00Z", updatedAt: "2026-10-29T00:00:00Z",
    idea: "", logline: "", draft: "", draftRev: 0,
    settings: { style: "真人写实", aspectRatio: "9:16", language: "中文", videoModel: null, textModel: null },
    episodes: [{ id: "e1", no: 1, title: "第一集", summary: "", content: "", extracted: true, planStale: false, planError: null, pendingPlan: null, rev: 1 }],
    assets: [], clips: [c], pipeline: null, notice: null, textError: null, tasks: [],
    pricing: { textMax: 2, image: 16, mock: false }, videoModels: [], videoLimits: null, textModelMode: "fixed", textModels: [],
  } as DirectorWork;
}

function Page({ initial }: { initial: DirectorWork }) {
  const [w, setW] = useState(initial);
  return <DirectorStoryboard work={w} episodeId="e1" apply={setW} setError={() => {}} goTab={() => {}}
    reviewExtract={() => {}} openSettings={() => {}} pickEpisode={() => {}}/>;
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(DirectorApi.quote).mockResolvedValue({ items: [] } as never);
  vi.mocked(DirectorApi.edit).mockImplementation(async (_w, _op, _target, _rev, data) =>
    work(clip((data as { candidateId: string }).candidateId)));
});
afterEach(cleanup);

test("clicking another video version on the card adopts it at once and opens it, with no separate adopt button", async () => {
  render(<Page initial={work(clip("v2"))}/>);
  const versions = screen.getByRole("group", { name: "视频版本" });
  fireEvent.click(within(versions).getByRole("button", { name: "3" }));
  expect(DirectorApi.edit).toHaveBeenCalledWith("w", "clip.adoptVideo", "c1", null, { candidateId: "v3" });
  expect(await screen.findByRole("button", { name: "视频 3 · 采用中" })).toBeTruthy();
  expect(screen.getByText("点哪一版，这个片段就用哪一版。")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "采用这一版" })).toBeNull();
});

test("picking another storyboard image in the board dialog adopts it at once, with no separate adopt button", async () => {
  const c = clip("v2");
  c.board = { candidates: [media("b1"), media("b2")], adoptedId: "b2", adoptedBy: "auto", error: null };
  vi.mocked(DirectorApi.edit).mockImplementation(async (_w, _op, _target, _rev, data) =>
    work({ ...c, board: { ...c.board, adoptedId: (data as { candidateId: string }).candidateId, adoptedBy: "user" } }));
  render(<Page initial={work(c)}/>);
  fireEvent.click(screen.getByRole("button", { name: /^分镜图/ }));
  const dialog = await screen.findByRole("dialog", { name: "分镜图 · 片段 1" });
  expect(within(dialog).getByText("点哪一张，这个片段就用哪一张。")).toBeTruthy();
  expect(within(dialog).queryByRole("button", { name: "采用这一版" })).toBeNull();
  fireEvent.click(within(dialog).getByRole("button", { name: "第 1 版" }));
  expect(DirectorApi.edit).toHaveBeenCalledWith("w", "clip.adoptBoard", "c1", null, { candidateId: "b1" });
  await waitFor(() => expect(within(dialog).getByRole("button", { name: "第 1 版 · 采用中" }).getAttribute("aria-pressed")).toBe("true"));
});

test("switching versions inside the video drawer adopts the picked one; re-picking the adopted one sends nothing", async () => {
  render(<Page initial={work(clip("v2"))}/>);
  fireEvent.click(screen.getByRole("button", { name: "播放片段 1 的视频" }));
  fireEvent.click(await screen.findByRole("button", { name: "视频 2 · 采用中" }));
  expect(DirectorApi.edit).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "视频 1" }));
  expect(DirectorApi.edit).toHaveBeenCalledWith("w", "clip.adoptVideo", "c1", null, { candidateId: "v1" });
  await waitFor(() => expect(screen.getByRole("button", { name: "视频 1 · 采用中" }).getAttribute("aria-pressed")).toBe("true"));
  expect(screen.queryByRole("button", { name: "采用这一版" })).toBeNull();
});
