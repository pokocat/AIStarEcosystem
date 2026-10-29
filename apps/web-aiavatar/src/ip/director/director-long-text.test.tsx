// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type { DirectorWork } from "@ai-star-eco/types";
import { DirectorWorkbench } from "./director-workbench";
import { DirectorScriptFile, PREVIEW_CHARS } from "./director-script-file";
import { useAssistantController } from "./director-assistant";
import { clearDrafts, useDraft } from "./director-shared";
import { DirectorApi } from "../api";

// 2026-10-29 用户要求：正文不限字数，但粘贴很多字时页面别卡；AI 一次只读一段时要说清楚。
vi.mock("@/components/hub/auth", () => ({ useRequireAuth: () => "ok", PlatformGateScreen: () => null }));
vi.mock("next/link", () => ({ default: ({ children, ...props }: React.ComponentProps<"a">) => <a {...props}>{children}</a> }));
vi.mock("../api", () => ({ DirectorApi: { getWork: vi.fn(), runTask: vi.fn(), edit: vi.fn(), importScript: vi.fn(), patchWork: vi.fn() } }));
vi.mock("./director-assets", () => ({ DirectorAssets: () => null }));
vi.mock("./director-storyboard", () => ({ DirectorStoryboard: () => null }));
vi.mock("./director-extract", () => ({ ExtractReview: () => null }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("../studio-page", () => ({ StudioPage: ({ children, actions }: { children: React.ReactNode; actions: React.ReactNode }) => <main>{actions}{children}</main> }));
vi.mock("../studio-gallery", () => ({ useStudioList: () => ({ data: [], loading: false }), GalleryState: () => null }));

const long = "第一场：雨夜老街。\n" + "小鹿提灯穿过人群走向面摊。\n".repeat(6000);
const ep = { id: "ep1", no: 1, title: "雨夜", summary: "", content: long, extracted: false, planStale: false, planError: null, pendingPlan: null, rev: 3 };

function work(over: Partial<DirectorWork> = {}): DirectorWork {
  return {
    id: "w", title: "长篇", revision: 1, createdAt: "2026-10-29T00:00:00Z", updatedAt: "2026-10-29T00:00:00Z",
    idea: "", logline: "", draft: "", draftRev: 0,
    settings: { style: "真人写实", aspectRatio: "9:16", language: "中文", videoModel: null, textModel: null },
    episodes: [ep], assets: [], clips: [], pipeline: null, notice: null, textError: null, tasks: [],
    pricing: { textMax: 2, image: 16, mock: false, textChars: 24000 }, videoModels: [], videoLimits: null,
    draftEpisodeHeadings: 0, reference: "", referenceRev: 0, pendingSplit: null, canUndoSplit: false,
    assistant: { current: "th1", threads: [{ id: "th1", title: "t", createdAt: "2026-10-29T00:00:00Z", updatedAt: "2026-10-29T00:00:00Z", messages: [] }] },
    ...over,
  } as DirectorWork;
}

beforeEach(() => { vi.resetAllMocks(); document.documentElement.dataset.layout = "desktop"; window.localStorage.setItem("director-assistant:open", "0"); clearDrafts("w:"); });
afterEach(() => { cleanup(); window.localStorage.clear(); delete document.documentElement.dataset.layout; });

test("normal pastes go in; an oversized paste is stopped before it reaches the box and the text stays as it was", async () => {
  const short = "第一场：雨夜老街。\n小鹿：回家吧。";
  vi.mocked(DirectorApi.getWork).mockResolvedValue(work({ episodes: [{ ...ep, content: short }] }));
  render(<DirectorWorkbench id="w"/>);
  const text = await screen.findByRole("textbox", { name: "第 1 集正文" }) as HTMLTextAreaElement;
  expect(text.maxLength).toBe(-1);
  // 普通规模：浏览器照常粘贴（不拦、不提示）。
  expect(fireEvent.paste(text, { clipboardData: { getData: () => "阿婆：慢点走。".repeat(100) } })).toBe(true);
  expect(screen.queryByRole("alert")).toBeNull();
  // 超量：在进编辑框之前拦下，正文一个字没变，提示走上传。
  const huge = "小鹿提灯穿过人群走向面摊。\n".repeat(3000);
  text.setSelectionRange(5, 5);
  expect(fireEvent.paste(text, { clipboardData: { getData: () => huge } })).toBe(false);
  const notice = screen.getByRole("alert");
  expect(notice.textContent).toContain("粘贴的文字较多");
  expect(notice.textContent).toContain("请保存为 TXT 文件后，通过「上传剧本文件」导入");
  expect((screen.getByRole("textbox", { name: "第 1 集正文" }) as HTMLTextAreaElement).value).toBe(short);
  // 继续编辑原内容不受影响。
  fireEvent.change(screen.getByRole("textbox", { name: "第 1 集正文" }), { target: { value: short + "\n阿婆：等等。" } });
  expect((screen.getByRole("textbox", { name: "第 1 集正文" }) as HTMLTextAreaElement).value).toBe(short + "\n阿婆：等等。");
  // 按提示上传 TXT：读出来的文字插到刚才粘贴的位置，原有正文保留。
  vi.mocked(DirectorApi.importScript).mockResolvedValue({ text: "【上传的长段】", format: "txt" });
  fireEvent.change(within(notice).getByLabelText("上传剧本文件"), { target: { files: [new File(["x"], "长段.txt")] } });
  fireEvent.click(await within(notice).findByRole("button", { name: "插入到粘贴的位置" }));
  expect((screen.getByRole("textbox", { name: "第 1 集正文" }) as HTMLTextAreaElement).value).toBe("第一场：雨" + "【上传的长段】" + "夜老街。\n小鹿：回家吧。\n阿婆：等等。");
});

test("a long episode (from a file) is edited section by section; saving keeps every character and the cursor position reaches the assistant", async () => {
  vi.mocked(DirectorApi.getWork).mockResolvedValue(work());
  render(<DirectorWorkbench id="w"/>);
  const group = await screen.findByRole("group", { name: "第 1 集正文" });
  expect(screen.queryByRole("textbox", { name: "第 1 集正文" })).toBeNull();
  expect(group.textContent).toContain(`正文共 ${long.length.toLocaleString("zh-CN")} 字`);
  expect(screen.getByRole("note").textContent).toContain("约 24,000 字");
  const rows = within(group).getAllByRole("button", { expanded: false });
  expect(rows.length).toBeGreaterThan(3);
  fireEvent.click(rows[2]);
  const box = screen.getByRole("textbox", { name: "第 1 集正文（第 3 段）" }) as HTMLTextAreaElement;
  expect(box.value.length).toBeLessThanOrEqual(15000);
  // 这一段在整份正文里从哪儿开始：看段标题「第 x–y 字」（样例是重复的句子，不能按文字去找）。
  const start = Number(box.closest(".director-section")!.querySelector("small")!.textContent!.match(/第 ([\d,]+)/)![1].replace(/,/g, "")) - 1;
  expect(long.slice(start, start + box.value.length)).toBe(box.value);
  fireEvent.change(box, { target: { value: "【第三段开头补一句】" + box.value } });
  box.setSelectionRange(3, 3);
  fireEvent.click(screen.getByRole("button", { name: "和助手讨论第 1 集正文" }));
  const panel = screen.getByRole("complementary", { name: "全能创作助手" });
  const edited = long.slice(0, start) + "【第三段开头补一句】" + long.slice(start);
  vi.mocked(DirectorApi.edit).mockResolvedValue(work({ episodes: [{ ...ep, content: edited, rev: 4 }] }));
  vi.mocked(DirectorApi.runTask).mockResolvedValue(work({ episodes: [{ ...ep, content: edited, rev: 4 }] }));
  fireEvent.change(within(panel).getByRole("textbox", { name: "和助手说" }), { target: { value: "评价这一段" } });
  fireEvent.click(within(panel).getByRole("button", { name: "发送" }));
  await waitFor(() => expect(DirectorApi.runTask).toHaveBeenCalledOnce());
  expect(vi.mocked(DirectorApi.edit).mock.calls[0][4]).toMatchObject({ content: edited });
  expect(vi.mocked(DirectorApi.runTask).mock.calls[0][1].options).toMatchObject({ scope: { kind: "script", episodeId: "ep1", focusAt: start + 3 } });
});

test("new work: an oversized paste points to the upload button already on the page, and a long file shows as a summary, not a box", async () => {
  const { DirectorWorks } = await import("./director-works");
  render(<DirectorWorks/>);
  fireEvent.click(screen.getAllByRole("button", { name: "新建作品" })[0]);
  fireEvent.click(screen.getByRole("tab", { name: "导入剧本" }));
  const box = screen.getByRole("textbox", { name: "剧本正文" }) as HTMLTextAreaElement;
  fireEvent.change(box, { target: { value: "已有的开头" } });
  expect(fireEvent.paste(box, { clipboardData: { getData: () => "字".repeat(40000) } })).toBe(false);
  expect(box.value).toBe("已有的开头");
  const picker = screen.getByLabelText("上传剧本文件") as HTMLInputElement;
  const clicked = vi.spyOn(picker, "click");
  fireEvent.click(within(screen.getByRole("alert")).getByRole("button", { name: "上传剧本文件" }));
  expect(clicked).toHaveBeenCalled();
  vi.mocked(DirectorApi.importScript).mockResolvedValue({ text: long, format: "txt" });
  fireEvent.change(picker, { target: { files: [new File(["x"], "长篇.txt")] } });
  fireEvent.click(await screen.findByRole("button", { name: "替换当前正文" }));
  expect(screen.queryByRole("textbox", { name: "剧本正文" })).toBeNull();
  expect(screen.getByRole("group", { name: "长正文" }).textContent).toContain(`正文 ${long.length.toLocaleString("zh-CN")} 字`);
});

test("the assistant reply says which stretch of a long script it actually read", async () => {
  vi.mocked(DirectorApi.getWork).mockResolvedValue(work({ assistant: { current: "th1", threads: [{ id: "th1", title: "t", createdAt: "", updatedAt: "", messages: [
    { id: "m1", role: "user", text: "评价", at: "2026-10-29T00:00:00Z", status: "done", scope: { kind: "script", episodeId: "ep1", label: "第 1 集 · 雨夜" } },
    { id: "m2", role: "assistant", text: "这一段节奏偏慢。", at: "2026-10-29T00:00:01Z", status: "done", scope: { kind: "script", episodeId: "ep1", label: "第 1 集 · 雨夜" },
      range: "正文很长，这次只读了第 38,001–62,000 字（全文 120,000 字），改别处请先把光标放到那里或选中那一段", proposals: [] },
  ] }] } }));
  window.localStorage.setItem("director-assistant:open", "1");
  render(<DirectorWorkbench id="w"/>);
  expect(await screen.findByText(/这次只读了第 38,001–62,000 字/)).toBeTruthy();
});

test("importing a very long file previews only the opening but imports every character", async () => {
  const text = "第一场\n" + "字".repeat(300_000) + "\n全剧终";
  vi.mocked(DirectorApi.importScript).mockResolvedValue({ text, format: "txt" });
  const imported = vi.fn();
  render(<DirectorScriptFile hasText={false} onImport={imported} onReadingChange={() => {}}/>);
  fireEvent.change(screen.getByLabelText("上传剧本文件"), { target: { files: [new File(["x"], "长篇.txt")] } });
  const preview = await screen.findByLabelText("文件文字预览") as HTMLTextAreaElement;
  expect(preview.value.length).toBe(PREVIEW_CHARS);
  expect(screen.getByText(/导入时整份 300,0\d\d 字都会放进正文/)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "使用文件内容" }));
  expect(imported).toHaveBeenCalledWith(text);
});

// review 2026-10-29 P2：已有分镜图的片段，入口走 image(board) 范围；发送前也要先存本集正文没保存的修改，助手读到的是眼前这版剧本。
test("discussing a board image first saves the unsaved episode text, like the prompt entry", async () => {
  const clip = { id: "k1", episodeId: "ep1", order: 1, rev: 2 } as unknown as DirectorWork["clips"][number];
  const w = work({ episodes: [{ ...ep, content: "原来的剧本。" }], clips: [clip] });
  vi.mocked(DirectorApi.edit).mockResolvedValue(w);
  let prepare!: ReturnType<typeof useAssistantController>["prepareScope"];
  function Harness() {
    const ctl = useAssistantController({ work: w, apply: () => {}, tab: "storyboard", episodeId: "ep1", goTab: () => {}, pickEpisode: () => {} });
    const [, setContent] = useDraft("w:ep:ep1:content", "原来的剧本。");
    useEffect(() => { setContent("用户刚改、还没保存的剧本。"); }, []); // eslint-disable-line react-hooks/exhaustive-deps
    prepare = ctl.prepareScope;
    return null;
  }
  render(<Harness/>);
  await act(async () => { await prepare({ kind: "image", clipId: "k1", which: "board" }); });
  expect(vi.mocked(DirectorApi.edit).mock.calls[0]).toEqual(["w", "episode.update", "ep1", 3, { title: "雨夜", summary: "", content: "用户刚改、还没保存的剧本。" }]);
});
