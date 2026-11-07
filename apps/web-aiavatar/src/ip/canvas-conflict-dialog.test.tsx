// @vitest-environment jsdom
// 「这张画布在别处被改过了」弹窗：三条出路各自把哪个选择交给同步层，以及结果怎么反映在弹窗上。
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { CanvasConflictDialog } from "./canvas-conflict-dialog";

afterEach(cleanup);

function setup(outcome: "resolved" | "failed" | "conflict", copyId?: string) {
  const resolve = vi.fn().mockResolvedValue({ outcome, copyId });
  const onClose = vi.fn(), onCopySaved = vi.fn();
  render(<CanvasConflictDialog open onClose={onClose} resolve={resolve} onCopySaved={onCopySaved} />);
  return { resolve, onClose, onCopySaved };
}

it("三条出路都摆出来，推荐的是什么都不丢的那条", () => {
  setup("resolved");
  expect(screen.getByText("此画布已在其他窗口修改")).toBeTruthy();
  const buttons = screen.getAllByRole("button").filter((b) => b.textContent?.trim());
  expect(buttons.map((b) => b.querySelector("span")?.textContent)).toEqual(["另存为新画布并加载最新版本", "加载最新版本", "保留此页改动"]);
  // 每条都写清楚会丢什么
  expect(screen.getByText(/两份内容都会保留/)).toBeTruthy();
  expect(screen.getByText(/此页面未保存的改动将丢失/)).toBeTruthy();
  expect(screen.getByText(/其他窗口保存的版本将被覆盖/)).toBeTruthy();
});

it("选「加载最新版本」：交给同步层 take-theirs，成功后弹窗关掉", async () => {
  const { resolve, onClose } = setup("resolved");
  fireEvent.click(screen.getByText("加载最新版本"));
  await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  expect(resolve).toHaveBeenCalledWith("take-theirs");
});

it("选「另存为新画布」：成功后把新画布的 id 交给宿主，再关掉", async () => {
  const { resolve, onClose, onCopySaved } = setup("resolved", "IPP-copy");
  fireEvent.click(screen.getByText("另存为新画布并加载最新版本"));
  await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  expect(resolve).toHaveBeenCalledWith("save-copy");
  expect(onCopySaved).toHaveBeenCalledWith("IPP-copy");
});

it("选「保留此页改动」时其他窗口又保存了新版本：弹窗不关，说明一句让用户再选", async () => {
  const { resolve, onClose } = setup("conflict");
  fireEvent.click(screen.getByText("保留此页改动"));
  await waitFor(() => expect(screen.getByRole("status").textContent).toContain("其他窗口又保存了新版本"));
  expect(resolve).toHaveBeenCalledWith("keep-mine");
  expect(onClose).not.toHaveBeenCalled();
  // 按钮放开了，能再选
  expect((screen.getByText("保留此页改动").closest("button") as HTMLButtonElement).disabled).toBe(false);
});

it("没成功：弹窗不关、本地改动不动，按钮放开让用户再选", async () => {
  const { onClose } = setup("failed");
  fireEvent.click(screen.getByText("加载最新版本"));
  await waitFor(() => expect((screen.getByText("加载最新版本").closest("button") as HTMLButtonElement).disabled).toBe(false));
  expect(onClose).not.toHaveBeenCalled();
});

it("可以先关掉去画布上看一眼（蒙层点不掉，关闭按钮能点）", () => {
  const { onClose } = setup("resolved");
  fireEvent.click(screen.getByRole("button", { name: "Close" }));
  expect(onClose).toHaveBeenCalledTimes(1);
});
