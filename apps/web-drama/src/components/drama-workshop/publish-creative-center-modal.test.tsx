import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { PublishCreativeCenterModal } from "./publish-creative-center-modal";

// §8.0.1 ⑩：断结构与行为（有一个带作品名的对话框、有确认 / 取消 / 关闭三个动作、发布中全部锁住），
// 不断可视文案 —— 文案会改，调用方依赖的是这几个动作。
function renderModal(props: Partial<ComponentProps<typeof PublishCreativeCenterModal>> = {}) {
  const onClose = vi.fn();
  const onConfirm = vi.fn();
  render(<PublishCreativeCenterModal title="世界杯趣玩" onClose={onClose} onConfirm={onConfirm} {...props} />);
  const dialog = screen.getByRole("dialog");
  // 页脚两个按钮：左取消、右确认；另有一个 aria-label="关闭" 的图标按钮
  const buttons = Array.from(dialog.querySelectorAll("button"));
  const closeIcon = screen.getByRole("button", { name: "关闭" });
  const [cancel, confirm] = buttons.filter((b) => b !== closeIcon);
  return { dialog, onClose, onConfirm, closeIcon, cancel: cancel!, confirm: confirm! };
}

describe("PublishCreativeCenterModal", () => {
  it("是一个带作品名的对话框，并列出发布后的说明", () => {
    const { dialog } = renderModal();
    expect(dialog.getAttribute("aria-label")).toContain("世界杯趣玩");
    expect(dialog.textContent).toContain("世界杯趣玩");
    // 说明列表至少三条
    expect(dialog.querySelectorAll(".col.gap-2 > .row").length).toBeGreaterThanOrEqual(3);
  });

  it("确认、取消、关闭各自触发对应回调", () => {
    const { onClose, onConfirm, confirm, cancel, closeIcon } = renderModal();

    fireEvent.click(confirm);
    expect(onConfirm).toHaveBeenCalledTimes(1);

    fireEvent.click(cancel);
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.click(closeIcon);
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  // 短剧与短视频整理进模板的东西不同，说明必须跟着 kind 走；不传 kind 时按短视频（两个调用方逐步补传）。
  // 只断「两种说明不一样、不传等于 short」，不断具体文案。
  it("kind 区分短剧与短视频的说明，不传时按短视频", () => {
    const textOf = (props: Partial<ComponentProps<typeof PublishCreativeCenterModal>>) => {
      const { dialog } = renderModal(props);
      const text = dialog.textContent;
      cleanup();
      return text;
    };
    const series = textOf({ kind: "series" });
    const short = textOf({ kind: "short" });
    const fallback = textOf({});
    expect(series).not.toBe(short);
    expect(fallback).toBe(short);
  });

  it("发布中时锁定关闭和确认按钮", () => {
    const { confirm, cancel, closeIcon } = renderModal({ publishing: true });

    expect((confirm as HTMLButtonElement).disabled).toBe(true);
    expect(confirm.getAttribute("aria-busy")).toBe("true");
    expect((cancel as HTMLButtonElement).disabled).toBe(true);
    expect((closeIcon as HTMLButtonElement).disabled).toBe(true);
  });
});
