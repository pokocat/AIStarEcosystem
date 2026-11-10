// @vitest-environment jsdom
// 2026-11-04 用户反馈：「自由生成」的示例页没有案例图。它和其他场景一样有封面，不再退回首字色块。
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { SceneExample } from "./scene-layout";

vi.mock("@/canvas-bridge/signed-image", () => ({ SignedImage: () => null }));
afterEach(cleanup);

test("the free scene shows its bundled example image", () => {
  const { container } = render(<SceneExample id="free" title="自由生成" note="放参考图" ratio="3:4"/>);
  expect(container.querySelector("img")?.getAttribute("src")).toBe("/studio/scene-covers/free.webp");
  expect(screen.queryByText("自")).toBeNull();
});

// 2026-11-05 用户反馈：示例只放结果图看不出功能是干什么的。图片场景放前后对比。
test("image scenes show a before and after picture with both sides labelled", () => {
  const { container } = render(<SceneExample id="outfit-on-model" title="服装上身" note="说明" ratio="3:4" demo="/studio/scene-demos/outfit-on-model.webp"/>);
  expect(container.querySelector("img")?.getAttribute("src")).toBe("/studio/scene-demos/outfit-on-model.webp");
  // 标签在图上方，不压在画面上；说明这是示意图。
  const labels = container.querySelector("figcaption")!;
  expect(labels.textContent).toBe("素材示例效果");
  expect(labels.compareDocumentPosition(container.querySelector("img")!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(screen.getByText("示意图，实际效果因素材和模型而异。")).toBeTruthy();
});

test("a picture the operator configured wins over the bundled comparison", () => {
  const { container } = render(<SceneExample id="x" title="X" note="说明" demo="/studio/scene-demos/x.webp" examples={[{ url: "https://cdn.test/a.jpg", mediaType: "image" }]}/>);
  expect(container.querySelector("img")?.getAttribute("src")).toBe("https://cdn.test/a.jpg");
  expect(screen.queryByText("示例效果")).toBeNull();
});

test("a scene without a bundled comparison falls back to its cover", () => {
  const { container } = render(<SceneExample id="free" title="自由生成" note="说明" demo="/studio/scene-demos/new.webp"/>);
  fireEvent.error(container.querySelector("img")!);
  expect(container.querySelector("img")?.getAttribute("src")).toBe("/studio/scene-covers/free.webp");
  expect(screen.queryByText("示例效果")).toBeNull();
});

test("the example request can be put into the prompt box", () => {
  const use = vi.fn();
  render(<SceneExample id="retouch" title="图片精修" note="说明" demo="/studio/scene-demos/retouch.webp" example="提亮画面" onUseExample={use}/>);
  expect(screen.getByText("提亮画面")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "使用" }));
  expect(use).toHaveBeenCalledWith("提亮画面");
});
