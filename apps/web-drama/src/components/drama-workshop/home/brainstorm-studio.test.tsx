import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";

// 聊天页去制作之后只读（评审 P2）：以前已经去制作过的对话照样能改，改完再点去制作拿回的是旧的那一条
// （内容过期，删了还会 404），改动悄悄丢了。这里钉行为：能不能改、点了去哪、发没发请求；
// 不断言可视文案（§8.0.1 ⑩），按钮用 data-bs-action 取。
const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, replace: vi.fn() }) }));
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), info: vi.fn() }) }));
vi.mock("@/lib/use-drama-config", () => ({ useDramaConfig: () => ({ confirmThreshold: 10, prices: { shortEntry: 30 } }) }));
vi.mock("@/lib/use-wallet", () => ({ notifyWalletChanged: vi.fn() }));
vi.mock("@/components/drama-workshop/short-start-confirm", () => ({
  SHORT_START_LEAD: { fromOutline: "" },
  confirmShortStart: async () => true,
}));

const api = vi.hoisted(() => ({
  getBrainstorm: vi.fn(),
  saveBrainstorm: vi.fn(),
  promote: vi.fn(),
  createBrainstorm: vi.fn(),
  chat: vi.fn(),
  generateOutline: vi.fn(),
  listProjects: vi.fn(),
  listDrafts: vi.fn(),
}));
vi.mock("@/api", () => ({
  BrainstormApi: {
    getBrainstorm: api.getBrainstorm,
    saveBrainstorm: api.saveBrainstorm,
    promote: api.promote,
    createBrainstorm: api.createBrainstorm,
    chat: api.chat,
    generateOutline: api.generateOutline,
  },
  ProjectsApi: { listProjects: api.listProjects },
  ShortsApi: { listDrafts: api.listDrafts },
}));

import { ApiError } from "@ai-star-eco/api-client";
import { BRAINSTORM_ALREADY_PROMOTED, type BrainstormDetail } from "@/api/brainstorm";
import { clearAll } from "@/lib/drama-query";
import { BrainstormStudio } from "./brainstorm-studio";

const OUTLINE = {
  title: "替嫁千金",
  type: "都市逆袭",
  tone: "强爽",
  logline: "真千金翻盘。",
  mainline: "替嫁 → 反转",
  beats: ["替嫁", "反转"],
  roles: [{ name: "林星遥", role: "女主" }],
  scenes: ["婚礼现场"],
};

function detail(over: Partial<BrainstormDetail["meta"]> = {}): BrainstormDetail {
  return {
    meta: {
      id: "brs_1",
      title: OUTLINE.title,
      status: "draft",
      promotedKind: null,
      promotedId: null,
      messageCount: 2,
      hasOutline: true,
      form: "series",
      updated: "",
      updatedAt: "2026-09-28T01:00:00Z",
      ...over,
    },
    data: {
      seed: null,
      direction: null,
      messages: [
        { role: "ai", text: "来" },
        { role: "user", text: "走复仇" },
      ],
      outline: OUTLINE,
      settings: { form: "series", ratio: "9:16" },
    },
  };
}
const promotedDetail = () => detail({ status: "promoted", promotedKind: "project", promotedId: "dp_1" });

const q = (c: HTMLElement, sel: string) => c.querySelector<HTMLElement>(sel);

beforeEach(() => {
  clearAll();
  push.mockReset();
  for (const f of Object.values(api)) f.mockReset();
  api.listProjects.mockResolvedValue([{ id: "dp_1", title: "替嫁千金" }]);
  api.listDrafts.mockResolvedValue([]);
});
afterEach(cleanup);

describe("已经去制作过的对话", () => {
  it("只能看：没有可编辑的字段、没有输入框、没有新建按钮；「打开」去建好的那部短剧；不发保存 / 去制作", async () => {
    api.getBrainstorm.mockResolvedValue(promotedDetail());
    const { container } = render(<BrainstormStudio id="brs_1" />);
    await waitFor(() => expect(q(container, '[data-bs-promoted="ok"]')).not.toBeNull());

    expect(container.querySelectorAll("[contenteditable]").length).toBe(0);
    expect(q(container, "input.chat-input")).toBeNull();
    expect(q(container, '[data-bs-action="produce"]')).toBeNull();

    fireEvent.click(q(container, '[data-bs-action="open"]')!);
    expect(push).toHaveBeenCalledWith("/projects/dp_1");
    expect(api.saveBrainstorm).not.toHaveBeenCalled();
    expect(api.promote).not.toHaveBeenCalled();
  });

  it("建好的那部已经删了：不给「打开」（点了是 404），复制一份新对话接着改，不动原来那段", async () => {
    api.getBrainstorm.mockResolvedValue(promotedDetail());
    api.listProjects.mockResolvedValue([]);
    api.createBrainstorm.mockResolvedValue(detail({ id: "brs_2", hasOutline: false }));
    api.saveBrainstorm.mockImplementation(async (id: string, data: BrainstormDetail["data"]) => ({ ...detail({ id }), data }));
    const { container } = render(<BrainstormStudio id="brs_1" />);
    await waitFor(() => expect(q(container, '[data-bs-promoted="gone"]')).not.toBeNull());
    expect(q(container, '[data-bs-action="open"]')).toBeNull();

    fireEvent.click(q(container, '[data-bs-action="copy"]')!);
    await waitFor(() => expect(push).toHaveBeenCalledWith("/dashboard?b=brs_2"));
    expect(api.saveBrainstorm).toHaveBeenCalledTimes(1);
    const [savedId, savedData] = api.saveBrainstorm.mock.calls[0];
    expect(savedId).toBe("brs_2");
    expect(savedData.outline).toEqual(OUTLINE);
    expect(savedData.messages).toEqual(promotedDetail().data.messages);
    expect(api.promote).not.toHaveBeenCalled();
  });
});

describe("去制作之后按返回键回来", () => {
  it("服务端还没回话，页面已经是只读（不会先露出一份能改的旧草稿）", async () => {
    api.getBrainstorm.mockResolvedValueOnce(detail());
    api.promote.mockResolvedValue({ kind: "project", projectId: "dp_1" });
    const first = render(<BrainstormStudio id="brs_1" />);
    await waitFor(() => expect(q(first.container, '[data-bs-action="produce"]')).not.toBeNull());
    fireEvent.click(q(first.container, '[data-bs-action="produce"]')!);
    await waitFor(() => expect(push).toHaveBeenCalledWith("/projects/dp_1"));
    first.unmount();

    // 回来时的后台刷新一直不回：只能靠去制作那一刻写回的缓存。
    api.getBrainstorm.mockReturnValue(new Promise(() => {}));
    const { container } = render(<BrainstormStudio id="brs_1" />);
    expect(q(container, "[data-bs-promoted]")).not.toBeNull();
    expect(container.querySelectorAll("[contenteditable]").length).toBe(0);
    expect(q(container, '[data-bs-action="produce"]')).toBeNull();
  });
});

describe("别的标签页已经去制作了", () => {
  it("这边保存被拒（409）→ 重读一遍，页面切成只读", async () => {
    api.getBrainstorm.mockResolvedValueOnce(detail());
    api.chat.mockResolvedValue({ message: { role: "ai", text: "好" } });
    api.saveBrainstorm.mockRejectedValue(
      new ApiError({ code: BRAINSTORM_ALREADY_PROMOTED, message: "已经拿去制作了" }, 409),
    );
    const { container } = render(<BrainstormStudio id="brs_1" />);
    await waitFor(() => expect(q(container, "input.chat-input")).not.toBeNull());

    api.getBrainstorm.mockResolvedValue(promotedDetail());
    const input = q(container, "input.chat-input") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "再狠一点" } });
    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() => expect(q(container, "[data-bs-promoted]")).not.toBeNull());
    expect(q(container, "input.chat-input")).toBeNull();
    expect(api.promote).not.toHaveBeenCalled();
  });
});
