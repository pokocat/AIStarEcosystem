// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type { DirectorWorkSummary } from "@ai-star-eco/types";
import { ApiError } from "@ai-star-eco/api-client";
import { DirectorWorks } from "./director-works";
import { DirectorApi } from "../api";

vi.mock("@/components/hub/auth", () => ({ useRequireAuth: () => "ok", PlatformGateScreen: () => null }));
vi.mock("next/link", () => ({ default: ({ children, ...props }: React.ComponentProps<"a">) => <a {...props}>{children}</a> }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("../studio-page", () => ({ StudioPage: ({ children, actions }: { children: React.ReactNode; actions?: React.ReactNode }) => <div>{actions}{children}</div> }));
vi.mock("../api", () => ({ DirectorApi: { listWorks: vi.fn(), deleteWork: vi.fn() } }));

function summary(id: string, title: string): DirectorWorkSummary {
  return { id, title, episodeCount: 0, assetCount: 0, clipCount: 0, boardCount: 0, videoCount: 0, hasScript: false,
    running: false, updatedAt: "2026-10-26T00:00:00Z", coverUrl: null };
}

beforeEach(() => { vi.resetAllMocks(); });
afterEach(cleanup);

async function openDelete(title: string) {
  const menu = await screen.findByLabelText(`作品 ${title} 的更多操作`);
  fireEvent.click(menu);
  fireEvent.click(within(menu.closest("details")!).getByRole("menuitem", { name: "删除作品" }));
  return screen.getByRole("alertdialog", { name: "删除作品" });
}

test("the card menu is a sibling of the work link, so opening it never enters the work", async () => {
  vi.mocked(DirectorApi.listWorks).mockResolvedValue([summary("a", "夜班分拣员")]);
  render(<DirectorWorks/>);
  const menu = await screen.findByLabelText("作品 夜班分拣员 的更多操作");
  expect(menu.closest("a")).toBeNull();
  expect(screen.getByRole("link", { name: "打开作品 夜班分拣员" }).querySelector("details")).toBeNull();
});

test("cancel closes without calling the server; the dialog names the work and says what is kept", async () => {
  vi.mocked(DirectorApi.listWorks).mockResolvedValue([summary("a", "夜班分拣员")]);
  render(<DirectorWorks/>);
  const dialog = await openDelete("夜班分拣员");
  expect(dialog.textContent).toContain("把「夜班分拣员」移入回收站？");
  expect(dialog.textContent).toContain("可以在回收站恢复");
  expect(dialog.textContent).toContain("已存入个人资产库的素材会保留");
  expect(dialog.textContent).toContain("已消耗的积分不退回");
  expect(dialog.textContent).not.toMatch(/永久|无法恢复|30 天/);
  expect(dialog.contains(document.activeElement)).toBe(true);
  fireEvent.click(within(dialog).getByRole("button", { name: "取消" }));
  expect(screen.queryByRole("alertdialog")).toBeNull();
  expect(DirectorApi.deleteWork).not.toHaveBeenCalled();
  expect(screen.getByText("1 部作品")).toBeTruthy();
});

test("success removes the card and updates the count; deleting the last one shows the empty state", async () => {
  vi.mocked(DirectorApi.listWorks).mockResolvedValue([summary("a", "第一部"), summary("b", "第二部")]);
  vi.mocked(DirectorApi.deleteWork).mockResolvedValue();
  render(<DirectorWorks/>);
  fireEvent.click(within(await openDelete("第一部")).getByRole("button", { name: "移入回收站" }));
  await waitFor(() => expect(screen.queryByText("第一部")).toBeNull());
  expect(DirectorApi.deleteWork).toHaveBeenCalledWith("a");
  expect(screen.getByText("1 部作品")).toBeTruthy();
  fireEvent.click(within(await openDelete("第二部")).getByRole("button", { name: "移入回收站" }));
  expect(await screen.findByText("还没有作品")).toBeTruthy();
});

test("while deleting the button says so and repeated clicks send one request; a failure keeps the card and can be retried", async () => {
  vi.mocked(DirectorApi.listWorks).mockResolvedValue([summary("a", "夜班分拣员")]);
  let reject!: (e: unknown) => void;
  vi.mocked(DirectorApi.deleteWork).mockImplementationOnce(() => new Promise((_, r) => { reject = r; })).mockResolvedValueOnce();
  render(<DirectorWorks/>);
  const dialog = await openDelete("夜班分拣员");
  const confirm = within(dialog).getByRole("button", { name: "移入回收站" });
  fireEvent.click(confirm); fireEvent.click(confirm); fireEvent.click(confirm);
  expect(DirectorApi.deleteWork).toHaveBeenCalledTimes(1);
  expect(within(dialog).getByRole("button", { name: "移入中" })).toHaveProperty("disabled", true);
  fireEvent.keyDown(window, { key: "Escape" });
  expect(screen.getByRole("alertdialog")).toBeTruthy(); // 提交中不能关
  await act(async () => reject(new ApiError({ code: "DIRECTOR_WORK_BUSY", message: "片段视频正在生成，任务结束后再删除" }, 409)));
  expect((await within(dialog).findByRole("alert")).textContent).toContain("片段视频正在生成");
  expect(screen.getByRole("heading", { name: "夜班分拣员" })).toBeTruthy();
  fireEvent.click(within(dialog).getByRole("button", { name: "移入回收站" }));
  await waitFor(() => expect(screen.queryByRole("heading", { name: "夜班分拣员" })).toBeNull());
  expect(DirectorApi.deleteWork).toHaveBeenCalledTimes(2);
});

test("keyboard: Escape closes the menu and returns focus to its button, then Escape closes the dialog", async () => {
  vi.mocked(DirectorApi.listWorks).mockResolvedValue([summary("a", "夜班分拣员")]);
  render(<DirectorWorks/>);
  const summaryButton = await screen.findByLabelText("作品 夜班分拣员 的更多操作");
  const details = summaryButton.closest("details")!;
  fireEvent.click(summaryButton);
  expect(details.open).toBe(true);
  const item = within(details).getByRole("menuitem", { name: "删除作品" });
  item.focus();
  fireEvent.keyDown(item, { key: "Escape" });
  expect(details.open).toBe(false);
  expect(document.activeElement).toBe(summaryButton);
  fireEvent.click(summaryButton);
  fireEvent.click(within(details).getByRole("menuitem", { name: "删除作品" }));
  expect(details.open).toBe(false);
  expect(screen.getByRole("alertdialog")).toBeTruthy();
  fireEvent.keyDown(window, { key: "Escape" });
  expect(screen.queryByRole("alertdialog")).toBeNull();
  expect(document.activeElement).toBe(summaryButton); // 关掉弹窗焦点回到「更多」，不掉到页面开头
  expect(DirectorApi.deleteWork).not.toHaveBeenCalled();
});

test("the list links to the trash, also when it is empty", async () => {
  vi.mocked(DirectorApi.listWorks).mockResolvedValue([]);
  render(<DirectorWorks/>);
  expect(await screen.findByText("还没有作品")).toBeTruthy();
  expect(screen.getByRole("link", { name: "回收站" }).getAttribute("href")).toBe("/director/trash");
});
