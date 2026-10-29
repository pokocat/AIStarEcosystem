// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type { DirectorTrashedWork } from "@ai-star-eco/types";
import { ApiError } from "@ai-star-eco/api-client";
import { DirectorTrash } from "./director-trash";
import { DirectorApi } from "../api";

const failure = vi.hoisted(() => ({ show: vi.fn() }));
vi.mock("../studio-errors", async importOriginal => ({ ...await importOriginal<typeof import("../studio-errors")>(), useStudioFailure: () => failure.show }));
vi.mock("@/components/hub/auth", () => ({ useRequireAuth: () => "ok", PlatformGateScreen: () => null }));
vi.mock("next/link", () => ({ default: ({ children, ...props }: React.ComponentProps<"a">) => <a {...props}>{children}</a> }));
vi.mock("../studio-page", () => ({ StudioPage: ({ children, actions, title }: { children: React.ReactNode; actions?: React.ReactNode; title: string }) => <div><h1>{title}</h1>{actions}{children}</div> }));
vi.mock("../api", () => ({ DirectorApi: { listTrash: vi.fn(), restoreWork: vi.fn() } }));

function item(id: string, title: string, deletedAt = "2026-10-28T12:30:00Z"): DirectorTrashedWork {
  return { id, title, episodeCount: 2, assetCount: 3, clipCount: 4, boardCount: 1, videoCount: 0, hasScript: true,
    running: false, updatedAt: "2026-10-28T12:00:00Z", coverUrl: null, deletedAt };
}

beforeEach(() => { vi.resetAllMocks(); });
afterEach(cleanup);

test("lists my deleted works with their names and deletion times", async () => {
  vi.mocked(DirectorApi.listTrash).mockResolvedValue([item("a", "夜班分拣员"), item("b", "敦煌飞仙", "2026-10-20T01:00:00Z")]);
  render(<DirectorTrash/>);
  const card = await screen.findByRole("article", { name: "已删除的作品 夜班分拣员" });
  expect(within(card).getByText(/^删除于 2026-10-28 \d{2}:30:00$/)).toBeTruthy();
  expect(screen.getByText("2 部已删除的作品")).toBeTruthy();
  expect(screen.getByRole("link", { name: "返回作品列表" }).getAttribute("href")).toBe("/director");
  expect(within(card).queryByRole("link"), "已删除的作品不能直接打开").toBeNull();
});

test("an empty trash says so and links back", async () => {
  vi.mocked(DirectorApi.listTrash).mockResolvedValue([]);
  render(<DirectorTrash/>);
  expect(await screen.findByText("回收站是空的")).toBeTruthy();
});

test("a failed load can be retried", async () => {
  vi.mocked(DirectorApi.listTrash).mockRejectedValueOnce(new ApiError({ code: "HTTP_ERROR", message: "网络连接失败" }, 0)).mockResolvedValue([item("a", "夜班分拣员")]);
  render(<DirectorTrash/>);
  fireEvent.click(await screen.findByRole("button", { name: "重新加载" }));
  expect(await screen.findByRole("article", { name: "已删除的作品 夜班分拣员" })).toBeTruthy();
  expect(DirectorApi.listTrash).toHaveBeenCalledTimes(2);
});

test("restore sends one request while busy, removes the item and offers to open the restored work", async () => {
  vi.mocked(DirectorApi.listTrash).mockResolvedValue([item("a", "夜班分拣员"), item("b", "敦煌飞仙")]);
  let resolve!: () => void;
  vi.mocked(DirectorApi.restoreWork).mockImplementation(() => new Promise(r => { resolve = () => r({ id: "a", restored: true }); }));
  render(<DirectorTrash/>);
  const button = await screen.findByRole("button", { name: "恢复作品 夜班分拣员" });
  fireEvent.click(button); fireEvent.click(button);
  fireEvent.click(screen.getByRole("button", { name: "恢复作品 敦煌飞仙" }));
  expect(DirectorApi.restoreWork).toHaveBeenCalledTimes(1);
  expect(within(button).getByText("恢复中")).toBeTruthy();
  expect(screen.getByRole("button", { name: "恢复作品 敦煌飞仙" })).toHaveProperty("disabled", true);
  await act(async () => { resolve(); });
  await waitFor(() => expect(screen.queryByRole("article", { name: "已删除的作品 夜班分拣员" })).toBeNull());
  const notice = screen.getByRole("status");
  expect(notice.textContent).toContain("「夜班分拣员」已恢复到作品列表");
  expect(notice.textContent).toContain("制作保持停止");
  expect(within(notice).getByRole("link", { name: "打开作品" }).getAttribute("href")).toBe("/director/a");
  expect(screen.getByText("1 部已删除的作品")).toBeTruthy();
});

test("a failed restore goes to the Studio error dialog and keeps the item", async () => {
  vi.mocked(DirectorApi.listTrash).mockResolvedValue([item("a", "夜班分拣员")]);
  const error = new ApiError({ code: "HTTP_ERROR", message: "网络连接失败" }, 0);
  vi.mocked(DirectorApi.restoreWork).mockRejectedValue(error);
  render(<DirectorTrash/>);
  fireEvent.click(await screen.findByRole("button", { name: "恢复作品 夜班分拣员" }));
  await waitFor(() => expect(failure.show).toHaveBeenCalledWith({ action: "恢复「夜班分拣员」", error }));
  expect(screen.getByRole("article", { name: "已删除的作品 夜班分拣员" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "恢复作品 夜班分拣员" })).toHaveProperty("disabled", false);
});

test("restoring a work that is no longer there refreshes the trash", async () => {
  vi.mocked(DirectorApi.listTrash).mockResolvedValueOnce([item("a", "夜班分拣员")]).mockResolvedValue([]);
  vi.mocked(DirectorApi.restoreWork).mockRejectedValue(new ApiError({ code: "DIRECTOR_WORK_NOT_FOUND", message: "作品不存在" }, 404));
  render(<DirectorTrash/>);
  fireEvent.click(await screen.findByRole("button", { name: "恢复作品 夜班分拣员" }));
  expect(await screen.findByText("回收站是空的")).toBeTruthy();
  expect(failure.show).toHaveBeenCalled();
});
