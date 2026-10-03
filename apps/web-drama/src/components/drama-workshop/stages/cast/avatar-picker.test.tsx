import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";

const listMyDapAvatars = vi.fn();
vi.mock("@/api", () => ({
  DapAvatarsApi: {
    AIAVATAR_URL: "https://aiavatar.test",
    listMyDapAvatars: () => listMyDapAvatars(),
  },
}));

import { AvatarPicker } from "./avatar-picker";

// §8.0.1 ⑩：断结构（外链地址 / 新标签页 / 刷新会重新拉列表），不断可视文案。
const CHAR = { id: "ch_1", name: "角色甲", role: "key" as const, cast: "", desc: "", avatar: "a1", bound: false };
const avatar = (id: string, imageUrl: string | null) => ({ id, name: id, status: "finalized", imageUrl });

function renderPicker() {
  return render(<AvatarPicker char={CHAR} onClose={() => {}} onConfirm={() => {}} />);
}

describe("AvatarPicker 空态", () => {
  beforeEach(() => listMyDapAvatars.mockReset());

  it("一个数字人都没有：给去 AiAvatar 的外链（新标签页）和刷新", async () => {
    listMyDapAvatars.mockResolvedValue([]);
    renderPicker();
    const empty = await screen.findByTestId("avatar-picker-empty");
    const link = within(empty).getByRole("link");
    expect(link.getAttribute("href")).toBe("https://aiavatar.test");
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel") ?? "").toContain("noopener");
    expect(within(empty).getAllByRole("button")).toHaveLength(1);
  });

  it("点刷新会重新拉列表，拉到能绑的就不再是空态", async () => {
    listMyDapAvatars.mockResolvedValueOnce([]).mockResolvedValueOnce([avatar("av_1", "https://cdn.test/a.jpg")]);
    renderPicker();
    const empty = await screen.findByTestId("avatar-picker-empty");
    fireEvent.click(within(empty).getByRole("button"));
    await waitFor(() => expect(listMyDapAvatars).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByTestId("avatar-picker-empty")).toBeNull());
    expect(screen.getByTitle("av_1")).toBeTruthy();
  });

  it("有数字人但都没有定妆照：同样按空态处理", async () => {
    listMyDapAvatars.mockResolvedValue([avatar("av_draft", null)]);
    renderPicker();
    expect(await screen.findByTestId("avatar-picker-empty")).toBeTruthy();
  });

  it("有能绑的数字人：不出空态", async () => {
    listMyDapAvatars.mockResolvedValue([avatar("av_1", "https://cdn.test/a.jpg"), avatar("av_draft", null)]);
    renderPicker();
    await screen.findByTitle("av_1");
    expect(screen.queryByTestId("avatar-picker-empty")).toBeNull();
  });
});
