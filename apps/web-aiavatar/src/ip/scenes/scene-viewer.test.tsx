// @vitest-environment jsdom
// 看大图（2026-10-30 复测：Esc 关不掉，Tab 会跑到后面的页面上）。
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { SceneViewer } from "./scene-layout";

afterEach(cleanup);

test("the large picture takes focus, keeps Tab inside, closes on Escape and hands focus back", () => {
  const opener = document.createElement("button"); opener.textContent = "查看第 1 张"; document.body.appendChild(opener); opener.focus();
  const onClose = vi.fn();
  const view = render(<SceneViewer url="https://cdn/a.jpg" name="a" onDownload={vi.fn()} onClose={onClose}/>);
  const dialog = screen.getByRole("dialog", { name: "查看大图" });
  expect(dialog.contains(document.activeElement)).toBe(true);
  const close = screen.getByRole("button", { name: "关闭" });
  close.focus();
  fireEvent.keyDown(dialog, { key: "Tab" });
  expect(dialog.contains(document.activeElement)).toBe(true);
  fireEvent.keyDown(document, { key: "Escape" });
  expect(onClose).toHaveBeenCalledTimes(1);
  view.unmount();
  expect(document.activeElement).toBe(opener);
  opener.remove();
});
