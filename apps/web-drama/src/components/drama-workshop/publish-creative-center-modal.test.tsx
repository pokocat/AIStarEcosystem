import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { PublishCreativeCenterModal } from "./publish-creative-center-modal";

describe("PublishCreativeCenterModal", () => {
  it("说明发布会做什么以及用户能得到什么", () => {
    render(<PublishCreativeCenterModal title="世界杯趣玩" onClose={() => {}} onConfirm={() => {}} />);

    expect(screen.getByText("发布到创意市场")).toBeTruthy();
    expect(screen.getByText("让《世界杯趣玩》的创意被更多创作者看见并套用")).toBeTruthy();
    expect(screen.getByText(/整理成一条可套用创意/)).toBeTruthy();
    expect(screen.getByText(/进入创意市场,多一个展示和被精选的机会/)).toBeTruthy();
    expect(screen.getByText(/原视频不会被改动/)).toBeTruthy();
  });

  it("确认和关闭动作可用", () => {
    const onClose = vi.fn();
    const onConfirm = vi.fn();
    render(<PublishCreativeCenterModal title="世界杯趣玩" onClose={onClose} onConfirm={onConfirm} />);

    fireEvent.click(screen.getByRole("button", { name: "确认发布" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "暂不发布" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("发布中时锁定关闭和确认按钮", () => {
    const onClose = vi.fn();
    const onConfirm = vi.fn();
    render(<PublishCreativeCenterModal title="世界杯趣玩" publishing onClose={onClose} onConfirm={onConfirm} />);

    expect((screen.getByRole("button", { name: "发布中..." }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "暂不发布" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "关闭" }) as HTMLButtonElement).disabled).toBe(true);
  });
});
