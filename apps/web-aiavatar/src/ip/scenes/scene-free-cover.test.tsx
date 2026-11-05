// @vitest-environment jsdom
// 2026-11-04 用户反馈：「自由出图」的示例页没有案例图。它和其他场景一样有封面，不再退回首字色块。
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { SceneExample } from "./scene-layout";

vi.mock("@/canvas-bridge/signed-image", () => ({ SignedImage: () => null }));
afterEach(cleanup);

test("the free scene shows its bundled example image", () => {
  const { container } = render(<SceneExample id="free" title="自由出图" note="放参考图" ratio="3:4"/>);
  expect(container.querySelector("img")?.getAttribute("src")).toBe("/studio/scene-covers/free.webp");
  expect(screen.queryByText("自")).toBeNull();
});
