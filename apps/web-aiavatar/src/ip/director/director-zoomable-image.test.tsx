// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { DirectorSheet, PREVIEW_MAX_SCALE, ZoomableImage } from "./director-shared";

afterEach(cleanup);

// 2026-10-26 用户反馈：导演台点图看大图时，不能缩放，也不能拖动。大图改用 antd 的图片预览，这里钉住
// 导演台自己加的那部分：中文工具栏、Esc 只关大图、触控板捏合不缩放整页、每次打开从适应窗口开始。
const open = (name = "设定图") => fireEvent.click(screen.getByRole("button", { name: `放大查看${name}` }));
const preview = () => document.querySelector<HTMLElement>(".director-image-preview");
const previewImg = () => preview()!.querySelector<HTMLImageElement>("img.ant-image-preview-img")!;
const scale = () => screen.getByLabelText("当前缩放").textContent;
const button = (name: string) => screen.getByRole("button", { name }) as HTMLButtonElement;
const frame = () => act(async () => { await new Promise(r => setTimeout(r, 40)); });
/** jsdom 不跑 CSS 动画：等关闭动画开始后手动结束它，大图层才会收起来。 */
async function closed() {
  await frame();
  const root = preview();
  if (root) act(() => { fireEvent.animationEnd(root); fireEvent.transitionEnd(root); });
  await waitFor(() => expect(preview()).toBeNull());
}
/** jsdom 的 TouchEvent 不收 touches，自己挂上去，React 读的是原生事件上的这个字段。每步之间隔一帧，和真手指一样。 */
async function touch(type: string, target: Element, points: { clientX: number; clientY: number }[]) {
  const e = new TouchEvent(type, { bubbles: true, cancelable: true });
  Object.defineProperty(e, "touches", { value: points });
  act(() => { target.dispatchEvent(e); });
  await frame();
}

test("opens fitted to the window with zoom-out and fit disabled and a labelled close button", () => {
  render(<ZoomableImage src="/cdn/a.png" alt="设定图"/>);
  expect(preview()).toBeNull();
  open();
  expect(previewImg().getAttribute("src")).toBe("/cdn/a.png");
  expect(scale()).toBe("100%");
  expect(button("缩小").disabled).toBe(true);
  expect(button("放大").disabled).toBe(false);
  expect(button("适应窗口").disabled).toBe(true);
  expect(button("关闭大图")).toBeTruthy();
});

test("toolbar zooms in and out within the limits and fit returns to the whole image", async () => {
  render(<ZoomableImage src="/cdn/a.png" alt="设定图"/>);
  open();
  fireEvent.click(button("放大"));
  await waitFor(() => expect(scale()).toBe("150%"));
  expect(button("缩小").disabled).toBe(false);
  expect(button("适应窗口").disabled).toBe(false);
  for (let i = 0; i < 8; i++) { fireEvent.click(button("放大")); await act(async () => { await new Promise(r => setTimeout(r, 20)); }); }
  await waitFor(() => expect(scale()).toBe(`${PREVIEW_MAX_SCALE * 100}%`));
  expect(button("放大").disabled).toBe(true);
  fireEvent.click(button("缩小"));
  await waitFor(() => expect(scale()).toBe("400%"));
  fireEvent.click(button("适应窗口"));
  await waitFor(() => expect(scale()).toBe("100%"));
  expect(previewImg().style.transform).toContain("translate3d(0px, 0px, 0)");
});

test("wheel and a two-finger pinch on the image zoom it, and the page underneath does not scroll", async () => {
  render(<ZoomableImage src="/cdn/a.png" alt="设定图"/>);
  open();
  fireEvent.wheel(previewImg(), { deltaY: -100, clientX: 200, clientY: 200 });
  await waitFor(() => expect(scale()).toBe("150%"));
  fireEvent.click(button("适应窗口"));
  await waitFor(() => expect(scale()).toBe("100%"));

  await touch("touchstart", previewImg(), [{ clientX: 100, clientY: 200 }, { clientX: 200, clientY: 200 }]);
  await touch("touchmove", previewImg(), [{ clientX: 50, clientY: 200 }, { clientX: 250, clientY: 200 }]);
  await touch("touchend", previewImg(), []);
  await waitFor(() => expect(scale()).toBe("200%"));

  const move = new TouchEvent("touchmove", { bubbles: true, cancelable: true });
  document.body.dispatchEvent(move);
  expect(move.defaultPrevented).toBe(true);
});

test("a trackpad pinch over the viewer zooms the image only, never the whole page", () => {
  render(<ZoomableImage src="/cdn/a.png" alt="设定图"/>);
  const pinch = (target: Element) => { const e = new WheelEvent("wheel", { deltaY: -4, ctrlKey: true, bubbles: true, cancelable: true }); target.dispatchEvent(e); return e; };
  expect(pinch(document.body).defaultPrevented).toBe(false);
  open();
  expect(pinch(previewImg()).defaultPrevented).toBe(true);
  expect(pinch(document.body).defaultPrevented).toBe(false);
});

test("Esc closes only the image, the sheet behind it stays open until the next Esc", async () => {
  const closeSheet = vi.fn();
  render(<DirectorSheet label="资产详情" onClose={closeSheet}><ZoomableImage src="/cdn/a.png" alt="设定图"/></DirectorSheet>);
  open();
  fireEvent.keyDown(window, { key: "Escape" });
  await closed();
  expect(closeSheet).not.toHaveBeenCalled();
  fireEvent.keyDown(window, { key: "Escape" });
  expect(closeSheet).toHaveBeenCalledTimes(1);
});

test("reopening starts fitted again, and a refreshed signed address does not reload the open image", async () => {
  const { rerender } = render(<ZoomableImage src="/cdn/a.png?sig=1" alt="设定图"/>);
  open();
  fireEvent.click(button("放大"));
  await waitFor(() => expect(scale()).toBe("150%"));
  rerender(<ZoomableImage src="/cdn/a.png?sig=2" alt="设定图"/>);
  expect(previewImg().getAttribute("src")).toBe("/cdn/a.png?sig=1");
  fireEvent.click(button("关闭大图"));
  await closed();
  open();
  await waitFor(() => expect(scale()).toBe("100%"));
  expect(previewImg().getAttribute("src")).toBe("/cdn/a.png?sig=2");
});

// @rc-component/image 1.10.0 只在横纵两个方向都变了、且界面已经更新到最新位置时才弹回：只横向拖，或者在一帧内松手，
// 图会停在拖出去的地方（2026-10-26 浏览器实测拖出屏幕外）。patches/@rc-component__image@1.10.0.patch 修了它。
// jsdom 里图的尺寸是 0，比窗口小，弹回就是回到正中（0, 0）。
test.each([
  ["a purely horizontal drag", false],
  ["a drag released within the same frame", true],
])("%s still springs the image back into view", async (_, sameFrame) => {
  render(<ZoomableImage src="/cdn/a.png" alt="设定图"/>);
  open();
  const at = (x: number, y: number) => ({ clientX: x, clientY: y, pageX: x, pageY: y, button: 0 });
  fireEvent.mouseDown(previewImg(), at(100, 100));
  fireEvent.mouseMove(window, at(700, sameFrame ? 160 : 100));
  if (!sameFrame) await frame();
  fireEvent.mouseUp(window, at(700, sameFrame ? 160 : 100));
  await frame();
  await waitFor(() => expect(previewImg().style.transform).toContain("translate3d(0px, 0px, 0)"));
});
