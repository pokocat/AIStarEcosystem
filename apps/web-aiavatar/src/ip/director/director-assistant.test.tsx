// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type { DirectorAssistantMessage, DirectorWork } from "@ai-star-eco/types";
import { ApiError } from "@ai-star-eco/api-client";
import { DirectorWorkbench } from "./director-workbench";
import { DirectorApi } from "../api";

vi.mock("@/components/hub/auth", () => ({ useRequireAuth: () => "ok", PlatformGateScreen: () => null }));
vi.mock("next/link", () => ({ default: ({ children, ...props }: React.ComponentProps<"a">) => <a {...props}>{children}</a> }));
vi.mock("../api", () => ({ DirectorApi: { getWork: vi.fn(), runTask: vi.fn(), edit: vi.fn(), patchWork: vi.fn() } }));
vi.mock("./director-assets", () => ({ DirectorAssets: () => null }));
vi.mock("./director-storyboard", () => ({ DirectorStoryboard: () => null }));
vi.mock("./director-extract", () => ({ ExtractReview: () => null }));

const ep = { id: "ep1", no: 1, title: "叶上的耳朵", summary: "", content: "老贺凑过去看。那盆绿萝叶子油绿。\n陈德茂头也不抬：别人丢的。", extracted: false, planStale: false, planError: null, pendingPlan: null, rev: 3 };

function work(messages: DirectorAssistantMessage[] = [], over: Partial<DirectorWork> = {}): DirectorWork {
  return {
    id: "w", title: "枯绿", revision: 1, createdAt: "2026-10-26T00:00:00Z", updatedAt: "2026-10-26T00:00:00Z",
    idea: "绿萝长耳朵", logline: "", draft: "", draftRev: 0,
    settings: { style: "真人写实", aspectRatio: "9:16", language: "中文", videoModel: null, textModel: null },
    episodes: [ep], assets: [], clips: [], pipeline: null, notice: null, textError: null, tasks: [],
    pricing: { textMax: 2, image: 16, mock: false }, videoModels: [], videoLimits: null,
    draftEpisodeHeadings: 0, reference: "", referenceRev: 0, pendingSplit: null, canUndoSplit: false,
    assistant: { current: "th1", threads: [{ id: "th1", title: "t", createdAt: "2026-10-26T00:00:00Z", updatedAt: "2026-10-26T00:00:00Z", messages }] },
    ...over,
  };
}

const replied = (clientId: string): DirectorAssistantMessage[] => [
  { id: "m1", clientId, role: "user", text: "就改我选中的这段", at: "2026-10-26T00:00:00Z", status: "done", scope: { kind: "selection", episodeId: "ep1", text: "老贺凑过去看。", label: "第 1 集 · 叶上的耳朵 · 已选正文" } },
  { id: "m2", role: "assistant", text: "保留原有设定，只调整这一段：", at: "2026-10-26T00:00:01Z", status: "done", scope: { kind: "selection", episodeId: "ep1", label: "第 1 集 · 叶上的耳朵 · 已选正文" },
    proposals: [{ id: "p1", type: "script.replace", status: "open", note: "更诡异", targetLabel: "第 1 集", target: "ep1", original: "老贺凑过去看。", replacement: "老贺凑近那盆绿萝，收音机忽然没了声。" }] },
];

beforeEach(() => {
  vi.resetAllMocks(); document.documentElement.dataset.layout = "desktop"; window.localStorage.setItem("director-assistant:open", "1");
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
});
afterEach(() => { cleanup(); window.localStorage.clear(); delete document.documentElement.dataset.layout; });

test("selecting text sends a selection-scoped message; an unknown result is recovered with the same request id", async () => {
  vi.mocked(DirectorApi.getWork).mockResolvedValueOnce(work());
  render(<DirectorWorkbench id="w"/>);
  const text = await screen.findByRole("textbox", { name: "第 1 集正文" }) as HTMLTextAreaElement;
  text.focus();
  text.setSelectionRange(0, 7);
  fireEvent.mouseUp(text);
  fireEvent.click(screen.getByRole("button", { name: /问 AI/ }));
  // 在正文右下角弹出浮层对话，只针对选中的这段。
  const panel = await screen.findByRole("dialog", { name: "AI 对话：第 1 集 · 已选正文" });
  // 浮层顶部「正在看」就是选中的那段。
  expect(within(within(panel).getByRole("region", { name: "正在看的内容" })).getByText("老贺凑过去看。")).toBeTruthy();
  fireEvent.change(within(panel).getByRole("textbox", { name: "和 AI 说" }), { target: { value: "就改我选中的这段，更诡异一点" } });
  // 第一次网关超时、回读时服务端也还没有这条：同一编号重发一次。
  vi.mocked(DirectorApi.runTask).mockRejectedValueOnce(new ApiError({ code: "HTTP_ERROR", message: "HTTP 504" }, 504));
  vi.mocked(DirectorApi.getWork).mockResolvedValueOnce(work());
  vi.mocked(DirectorApi.runTask).mockImplementationOnce(async (_id, body) => work(replied(body.clientRequestId)));
  fireEvent.keyDown(within(panel).getByRole("textbox", { name: "和 AI 说" }), { key: "Enter" });
  await waitFor(() => expect(DirectorApi.runTask).toHaveBeenCalledTimes(2), { timeout: 4000 });
  const [first, second] = vi.mocked(DirectorApi.runTask).mock.calls.map(c => c[1]);
  expect(second.clientRequestId).toBe(first.clientRequestId);
  expect(first.options).toMatchObject({ message: "就改我选中的这段，更诡异一点", scope: { kind: "selection", episodeId: "ep1", text: "老贺凑过去看。" } });
  expect(await within(panel).findByText("老贺凑近那盆绿萝，收音机忽然没了声。")).toBeTruthy();
});

test("preview shows original and suggestion in the script; adopting saves unsaved edits first, keeping original dismisses", async () => {
  vi.mocked(DirectorApi.getWork).mockResolvedValueOnce(work(replied("c1")));
  render(<DirectorWorkbench id="w"/>);
  const text = await screen.findByRole("textbox", { name: "第 1 集正文" });
  // 用户在别处手改了一句，还没保存。
  fireEvent.change(text, { target: { value: ep.content + "\n老贺：你这盆，真是别人丢的？" } });
  fireEvent.click(screen.getByRole("button", { name: "预览修改" }));
  const review = await screen.findByLabelText("第 1 集正文：预览修改");
  expect(within(review).getByText("老贺凑过去看。")).toBeTruthy();
  expect(within(review).getAllByText("老贺凑近那盆绿萝，收音机忽然没了声。").length).toBeGreaterThan(0);
  vi.mocked(DirectorApi.edit).mockResolvedValueOnce(work(replied("c1"), { episodes: [{ ...ep, content: ep.content + "\n老贺：你这盆，真是别人丢的？", rev: 4 }] }));
  vi.mocked(DirectorApi.edit).mockResolvedValueOnce(work(replied("c1")));
  fireEvent.click(within(review).getByRole("button", { name: "采用这处修改" }));
  await waitFor(() => expect(DirectorApi.edit).toHaveBeenCalledTimes(2));
  expect(vi.mocked(DirectorApi.edit).mock.calls[0]).toEqual(["w", "episode.update", "ep1", 3, { title: ep.title, summary: "", content: ep.content + "\n老贺：你这盆，真是别人丢的？" }]);
  expect(vi.mocked(DirectorApi.edit).mock.calls[1]).toEqual(["w", "assistant.apply", null, null, { messageId: "m2", proposalId: "p1" }]);
});

// review 2026-10-28：结果不确定时收起再打开助手，仍按原请求编号恢复；发送前先保存眼前未保存的正文。
test("an unknown send keeps its request id after closing and reopening the assistant", async () => {
  vi.mocked(DirectorApi.getWork).mockResolvedValue(work());
  vi.mocked(DirectorApi.runTask).mockRejectedValue(new Error("network unavailable"));
  render(<DirectorWorkbench id="w"/>);
  const area = await screen.findByRole("textbox", { name: "和助手说" });
  fireEvent.change(area, { target: { value: "保留结局，只改对白" } });
  fireEvent.click(screen.getByRole("button", { name: "发送" }));
  await screen.findByText(/发送状态还不确定/, {}, { timeout: 5000 });
  expect((screen.getByRole("textbox", { name: "第 1 集正文" }) as HTMLTextAreaElement).readOnly).toBe(true);
  // 正文冻结时右下角的入口照样能用：只是打开助手，不改正文。
  expect((screen.getByRole("button", { name: "和助手讨论第 1 集正文" }) as HTMLButtonElement).disabled).toBe(false);
  const original = vi.mocked(DirectorApi.runTask).mock.calls[0][1];
  fireEvent.click(screen.getByRole("button", { name: "收起助手" }));
  fireEvent.click(screen.getByRole("button", { name: "创作助手" }));
  vi.mocked(DirectorApi.runTask).mockResolvedValue(work(replied(original.clientRequestId)));
  fireEvent.click(await screen.findByRole("button", { name: "发送" }));
  await waitFor(() => expect(DirectorApi.runTask).toHaveBeenCalledTimes(3));
  const retry = vi.mocked(DirectorApi.runTask).mock.calls[2][1];
  expect(retry.clientRequestId).toBe(original.clientRequestId);
  expect(retry.options).toEqual(original.options);
  expect(window.localStorage.getItem("director-assistant:pending:w")).toBeNull();
});

test("sending saves the unsaved text on screen first, so the assistant reads what the user sees", async () => {
  vi.mocked(DirectorApi.getWork).mockResolvedValue(work());
  vi.mocked(DirectorApi.edit).mockResolvedValue(work([], { episodes: [{ ...ep, content: "这是刚写的新场景。", rev: 4 }] }));
  vi.mocked(DirectorApi.runTask).mockImplementation(async (_id, body) => work(replied(body.clientRequestId)));
  render(<DirectorWorkbench id="w"/>);
  fireEvent.change(await screen.findByRole("textbox", { name: "第 1 集正文" }), { target: { value: "这是刚写的新场景。" } });
  fireEvent.change(screen.getByRole("textbox", { name: "和助手说" }), { target: { value: "评价我当前这一段" } });
  fireEvent.click(screen.getByRole("button", { name: "发送" }));
  await waitFor(() => expect(DirectorApi.runTask).toHaveBeenCalledOnce());
  expect(vi.mocked(DirectorApi.edit).mock.calls[0]).toEqual(["w", "episode.update", "ep1", 3, { title: ep.title, summary: "", content: "这是刚写的新场景。" }]);
  expect(vi.mocked(DirectorApi.edit).mock.invocationCallOrder[0]).toBeLessThan(vi.mocked(DirectorApi.runTask).mock.invocationCallOrder[0]);
});

// 发送起冻结正文，保存期间也不能改；请求完成后解除只读。
test("script is read-only from send-time auto-save until the reply finishes", async () => {
  vi.mocked(DirectorApi.getWork).mockResolvedValue(work());
  let release!: (w: DirectorWork) => void;
  vi.mocked(DirectorApi.edit).mockImplementationOnce(() => new Promise<DirectorWork>(r => { release = r; }));
  vi.mocked(DirectorApi.runTask).mockImplementation(async (_id, body) => work(replied(body.clientRequestId), { episodes: [{ ...ep, content: "第一版正文。", rev: 4 }] }));
  render(<DirectorWorkbench id="w"/>);
  const body = await screen.findByRole("textbox", { name: "第 1 集正文" });
  fireEvent.change(body, { target: { value: "第一版正文。" } });
  fireEvent.change(screen.getByRole("textbox", { name: "和助手说" }), { target: { value: "评价这一段" } });
  fireEvent.click(screen.getByRole("button", { name: "发送" }));
  await waitFor(() => expect(DirectorApi.edit).toHaveBeenCalledOnce());
  expect((screen.getByRole("textbox", { name: "第 1 集正文" }) as HTMLTextAreaElement).readOnly).toBe(true);
  fireEvent.change(screen.getByRole("textbox", { name: "第 1 集正文" }), { target: { value: "第一版正文。\n老贺：我又补了一句。" } });
  release(work([], { episodes: [{ ...ep, content: "第一版正文。", rev: 4 }] }));
  await waitFor(() => expect(DirectorApi.runTask).toHaveBeenCalledOnce());
  await waitFor(() => expect((screen.getByRole("textbox", { name: "第 1 集正文" }) as HTMLTextAreaElement).value).toBe("第一版正文。"));
  expect((screen.getByRole("textbox", { name: "第 1 集正文" }) as HTMLTextAreaElement).readOnly).toBe(false);
});

// 请求期间不能撤回正文，避免把 AI 的输入和用户眼前内容分成两版。
test("the frozen script cannot be reverted while an assistant request is being sent", async () => {
  vi.mocked(DirectorApi.getWork).mockResolvedValue(work());
  let release!: (w: DirectorWork) => void;
  vi.mocked(DirectorApi.edit).mockImplementationOnce(() => new Promise<DirectorWork>(r => { release = r; }));
  vi.mocked(DirectorApi.runTask).mockImplementation(async (_id, body) => work(replied(body.clientRequestId), { episodes: [{ ...ep, content: "B 版正文。", rev: 4 }] }));
  render(<DirectorWorkbench id="w"/>);
  const body = await screen.findByRole("textbox", { name: "第 1 集正文" });
  fireEvent.change(body, { target: { value: "B 版正文。" } });
  fireEvent.change(screen.getByRole("textbox", { name: "和助手说" }), { target: { value: "评价这一段" } });
  fireEvent.click(screen.getByRole("button", { name: "发送" }));
  await waitFor(() => expect(DirectorApi.edit).toHaveBeenCalledOnce());
  expect((screen.getByRole("textbox", { name: "第 1 集正文" }) as HTMLTextAreaElement).readOnly).toBe(true);
  fireEvent.change(screen.getByRole("textbox", { name: "第 1 集正文" }), { target: { value: ep.content } });
  release(work([], { episodes: [{ ...ep, content: "B 版正文。", rev: 4 }] }));
  await waitFor(() => expect(DirectorApi.runTask).toHaveBeenCalledOnce());
  await waitFor(() => expect((screen.getByRole("textbox", { name: "第 1 集正文" }) as HTMLTextAreaElement).value).toBe("B 版正文。"));
  expect((screen.getByRole("textbox", { name: "第 1 集正文" }) as HTMLTextAreaElement).readOnly).toBe(false);
});


test("a pending reply stays read-only after reopening; failed replies unlock the script", async () => {
  const pending: DirectorAssistantMessage[] = [{ id: "m2", role: "assistant", text: "", at: "2026-10-26T00:00:00Z", status: "pending", scope: { kind: "selection", episodeId: "ep1", text: "别碰。" } }];
  vi.mocked(DirectorApi.getWork).mockResolvedValue(work(pending));
  const view = render(<DirectorWorkbench id="w"/>);
  expect((await screen.findByRole("textbox", { name: "第 1 集正文" }) as HTMLTextAreaElement).readOnly).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "收起助手" }));
  expect((screen.getByRole("textbox", { name: "第 1 集正文" }) as HTMLTextAreaElement).readOnly).toBe(true);
  view.unmount();
  vi.mocked(DirectorApi.getWork).mockResolvedValue(work([{ ...pending[0], status: "failed", error: "failed" }]));
  render(<DirectorWorkbench id="w"/>);
  expect((await screen.findByRole("textbox", { name: "第 1 集正文" }) as HTMLTextAreaElement).readOnly).toBe(false);
});

// 2026-10-29 用户反馈：内容区的 AI 入口统一为输入框右下角的紫色小圆钮，没有常驻文字；悬停和读屏名称说清讨论的是哪段内容。
// 同日追加：点了不展开侧边栏，在旁边弹出只针对这段内容的浮层对话，不带之前的对话记录。
test("the corner AI button is icon-only, named after its content, and opens a floating chat without old messages", async () => {
  window.localStorage.setItem("director-assistant:open", "0");
  const old: DirectorAssistantMessage[] = [{ id: "o1", role: "user", text: "上一次聊的别的事", at: "2026-10-25T00:00:00Z", status: "done", scope: { kind: "work" } },
    { id: "o2", role: "assistant", text: "上一次的回复", at: "2026-10-25T00:00:01Z", status: "done", scope: { kind: "work" } }];
  vi.mocked(DirectorApi.getWork).mockResolvedValue(work(old));
  render(<DirectorWorkbench id="w"/>);
  const text = await screen.findByRole("textbox", { name: "第 1 集正文" });
  const toggle = screen.getByRole("button", { name: "创作助手" });
  expect(screen.queryByRole("button", { name: /和助手讨论这一集/ })).toBeNull();
  const ask = screen.getByRole("button", { name: "和助手讨论第 1 集正文" });
  // 和输入框在同一个容器里（右下角），没有可见文字。
  expect(ask.closest(".director-ai-field")?.contains(text)).toBe(true);
  expect(ask.textContent).toBe("");
  fireEvent.click(ask);
  const pop = await screen.findByRole("dialog", { name: "AI 对话：第 1 集 · 叶上的耳朵" });
  // 侧边栏没打开，浮层里没有之前的对话。
  expect(screen.queryByRole("complementary", { name: "全能创作助手" })).toBeNull();
  expect(toggle.getAttribute("aria-pressed")).toBe("false");
  expect(within(pop).queryByText("上一次聊的别的事")).toBeNull();
  expect(ask.className).toContain("is-current");
  expect(ask.getAttribute("aria-expanded")).toBe("true");
  // 开头建议只填进输入框，不直接发（发送要扣积分）。
  fireEvent.click(within(pop).getByRole("button", { name: "续写下一场" }));
  expect((within(pop).getByRole("textbox", { name: "和 AI 说" }) as HTMLTextAreaElement).value).toBe("续写下一场");
  expect(DirectorApi.runTask).not.toHaveBeenCalled();
  // 发出去：浮层里只有这一条和它的回复。
  vi.mocked(DirectorApi.runTask).mockImplementation(async (_id, body) => work([...old,
    { id: "m1", clientId: body.clientRequestId, role: "user", text: "续写下一场", at: "2026-10-26T00:00:00Z", status: "done", scope: { kind: "script", episodeId: "ep1" } },
    { id: "m2", role: "assistant", text: "接着往下写一场：", at: "2026-10-26T00:00:01Z", status: "done", scope: { kind: "script", episodeId: "ep1" },
      proposals: [{ id: "p1", type: "script.append", status: "open", note: "", targetLabel: "第 1 集", target: "ep1", text: "夜里，绿萝的叶子轻轻翻了一面。" }] }]));
  fireEvent.click(within(pop).getByRole("button", { name: "发送" }));
  await waitFor(() => expect(DirectorApi.runTask).toHaveBeenCalledOnce());
  expect(vi.mocked(DirectorApi.runTask).mock.calls[0][1].options).toMatchObject({ message: "续写下一场", scope: { kind: "script", episodeId: "ep1" }, threadId: "th1" });
  expect(await within(pop).findByText("夜里，绿萝的叶子轻轻翻了一面。")).toBeTruthy();
  expect(within(pop).queryByText("上一次的回复")).toBeNull();
  // Esc 关掉；再打开是新的一次，之前这条不再显示（它在侧边栏的对话历史里）。
  fireEvent.keyDown(within(pop).getByRole("textbox", { name: "和 AI 说" }), { key: "Escape" });
  // （jsdom 里收起动画不结束，浮层节点会留着；看入口的展开状态。）
  await waitFor(() => expect(ask.getAttribute("aria-expanded")).toBe("false"));
  expect(document.activeElement).toBe(ask);
  fireEvent.click(ask);
  const again = await screen.findByRole("dialog", { name: "AI 对话：第 1 集 · 叶上的耳朵" });
  expect(within(again).queryByText("夜里，绿萝的叶子轻轻翻了一面。")).toBeNull();
  // 点到浮层外面也关掉。
  fireEvent.pointerDown(document.body);
  await waitFor(() => expect(ask.getAttribute("aria-expanded")).toBe("false"));
});

test("the floating chat can hand over to the sidebar assistant with the same scope and draft", async () => {
  window.localStorage.setItem("director-assistant:open", "0");
  vi.mocked(DirectorApi.getWork).mockResolvedValue(work());
  render(<DirectorWorkbench id="w"/>);
  fireEvent.click(await screen.findByRole("button", { name: "和助手讨论第 1 集正文" }));
  const pop = await screen.findByRole("dialog", { name: "AI 对话：第 1 集 · 叶上的耳朵" });
  fireEvent.change(within(pop).getByRole("textbox", { name: "和 AI 说" }), { target: { value: "这一集节奏怎么样" } });
  fireEvent.click(within(pop).getByRole("button", { name: "在助手里继续" }));
  const panel = screen.getByRole("complementary", { name: "全能创作助手" });
  expect(within(panel).getByText("正在讨论：第 1 集 · 叶上的耳朵")).toBeTruthy();
  await waitFor(() => expect((within(panel).getByRole("textbox", { name: "和助手说" }) as HTMLTextAreaElement).value).toBe("这一集节奏怎么样"));
  expect(screen.getByRole("button", { name: "和助手讨论第 1 集正文" }).getAttribute("aria-expanded")).toBe("false");
});

// 2026-10-29 追加：浮层盖住了下面的内容，桌面上按住标题栏拖动、拖边角缩放，松手记住大小。
test("on desktop the floating chat can be dragged by its header and resized from its corner; the size is remembered", async () => {
  window.localStorage.setItem("director-assistant:open", "0");
  vi.mocked(DirectorApi.getWork).mockResolvedValue(work());
  render(<DirectorWorkbench id="w"/>);
  const ask = await screen.findByRole("button", { name: "和助手讨论第 1 集正文" });
  fireEvent.click(ask);
  const pop = (await screen.findByRole("dialog", { name: "AI 对话：第 1 集 · 叶上的耳朵" })).closest(".director-inline-ask-pop") as HTMLElement;
  // jsdom 不排版：按当前样式报位置。
  pop.getBoundingClientRect = () => {
    const left = parseFloat(pop.style.left) || 0, top = parseFloat(pop.style.top) || 100, width = parseFloat(pop.style.width) || 580, height = parseFloat(pop.style.height) || 500;
    return { left, top, width, height, right: left + width, bottom: top + height, x: left, y: top, toJSON: () => ({}) } as DOMRect;
  };
  const header = pop.querySelector(".director-inline-ask > header")!;
  // 第一次打开有引导：告诉用户能拖、能缩放。
  expect(within(pop).getByRole("note").textContent).toContain("按住标题栏可以拖到别处");
  const before = parseFloat(pop.style.left), beforeTop = pop.getBoundingClientRect().top;
  fireEvent.pointerDown(header, { button: 0, clientX: 300, clientY: 120 });
  fireEvent.pointerMove(window, { clientX: 240, clientY: 160 });
  fireEvent.pointerUp(window, { clientX: 240, clientY: 160 });
  // 真的拖过一次，引导就收起，并且记住。
  expect(within(pop).queryByRole("note")).toBeNull();
  expect(window.localStorage.getItem("director-inline-ask:tip-seen")).toBe("1");
  expect(parseFloat(pop.style.left)).toBe(before - 60);
  expect(parseFloat(pop.style.top)).toBe(beforeTop + 40);
  // 标题栏上的按钮照常点，不当成拖动。
  fireEvent.pointerDown(within(pop).getByRole("button", { name: "关闭" }), { button: 0, clientX: 10, clientY: 10 });
  fireEvent.pointerMove(window, { clientX: 400, clientY: 400 });
  fireEvent.pointerUp(window);
  expect(parseFloat(pop.style.top)).toBe(beforeTop + 40);
  // 拖右下角放大，记住大小。
  const w0 = pop.getBoundingClientRect().width;
  fireEvent.pointerDown(pop.querySelector(".director-inline-ask-grip.is-se")!, { button: 0, clientX: 500, clientY: 600 });
  fireEvent.pointerMove(window, { clientX: 520, clientY: 640 });
  fireEvent.pointerUp(window);
  expect(parseFloat(pop.style.width)).toBe(w0 + 20);
  expect(parseFloat(pop.style.height)).toBe(540);
  expect(JSON.parse(window.localStorage.getItem("director-inline-ask:size")!)).toEqual({ width: w0 + 20, height: 540 });
});

// 2026-10-29 追加：浮层和侧边栏都能换模型；换的是这部作品的文本模型（和「作品设置」同一项）。
test("the floating chat and the sidebar both switch the work's text model", async () => {
  window.localStorage.setItem("director-assistant:open", "0");
  const textModels = [
    { endpointId: "ds", name: "DeepSeek", isDefault: true, tokenPricing: { inputCreditsPerK: 0.01, outputCreditsPerK: 0.1, maxInputTokens: 65536, maxOutputTokens: 8192, maxCost: 2 } },
    { endpointId: "claude", name: "Claude", isDefault: false, tokenPricing: { inputCreditsPerK: 1, outputCreditsPerK: 10, maxInputTokens: 65536, maxOutputTokens: 8192, maxCost: 148 } }];
  const base = work([], { textModelMode: "selectable", textModels } as Partial<DirectorWork>);
  vi.mocked(DirectorApi.getWork).mockResolvedValue(base);
  vi.mocked(DirectorApi.patchWork).mockResolvedValue({ ...base, settings: { ...base.settings, textModel: "claude" } });
  render(<DirectorWorkbench id="w"/>);
  fireEvent.click(await screen.findByRole("button", { name: "和助手讨论第 1 集正文" }));
  const pop = await screen.findByRole("dialog", { name: "AI 对话：第 1 集 · 叶上的耳朵" });
  const control = within(pop).getByRole("combobox", { name: "对话模型" });
  fireEvent.change(document.getElementById(control.getAttribute("data-select-native")!)!, { target: { value: "claude" } });
  await waitFor(() => expect(DirectorApi.patchWork).toHaveBeenCalledWith("w", { settings: { textModel: "claude" } }));
  await waitFor(() => expect(within(pop).getByRole("combobox", { name: "对话模型" }).textContent).toContain("Claude"));
  // 侧边栏同一个选择，显示的是刚换的模型。
  fireEvent.click(screen.getByRole("button", { name: "创作助手" }));
  const panel = screen.getByRole("complementary", { name: "全能创作助手" });
  expect(within(panel).getByRole("combobox", { name: "对话模型" }).textContent).toContain("Claude");
});

test("the drag hint can be dismissed with 知道了 and does not come back", async () => {
  window.localStorage.setItem("director-assistant:open", "0");
  vi.mocked(DirectorApi.getWork).mockResolvedValue(work());
  render(<DirectorWorkbench id="w"/>);
  const ask = await screen.findByRole("button", { name: "和助手讨论第 1 集正文" });
  fireEvent.click(ask);
  const pop = await screen.findByRole("dialog", { name: "AI 对话：第 1 集 · 叶上的耳朵" });
  fireEvent.click(within(within(pop).getByRole("note")).getByRole("button", { name: "知道了" }));
  expect(within(pop).queryByRole("note")).toBeNull();
  fireEvent.keyDown(within(pop).getByRole("textbox", { name: "和 AI 说" }), { key: "Escape" });
  await waitFor(() => expect(ask.getAttribute("aria-expanded")).toBe("false"));
  fireEvent.click(ask);
  const again = await screen.findByRole("dialog", { name: "AI 对话：第 1 集 · 叶上的耳朵" });
  expect(within(again).queryByRole("note")).toBeNull();
});
