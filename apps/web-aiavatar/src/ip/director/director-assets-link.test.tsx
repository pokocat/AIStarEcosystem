// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { DirectorAssets } from "./director-assets";

const api = vi.hoisted(() => ({ runTask: vi.fn(), edit: vi.fn() }));
vi.mock("../api", () => ({ DirectorApi: api, IpStudioApi: {} }));
vi.mock("../studio-errors", async importOriginal => ({ ...(await importOriginal<typeof import("../studio-errors")>()), useStudioApp: () => ({ modal: { confirm: vi.fn() } }) }));
// 资产库选择器换成一个按钮：点一下就像用户在资产库里挑了「祖宅」的第 2 版。
vi.mock("../library-reference-picker", () => ({
  LibraryReferencePicker: ({ open, title, onAssets }: { open: boolean; title: string; onAssets: (a: unknown[]) => Promise<void> }) => open
    ? <button type="button" onClick={() => void onAssets([{ metadata: { libraryReference: { objectId: "lib-1", versionId: "v2" } } }])}>{title}·选好了</button> : null,
}));
afterEach(() => { cleanup(); vi.clearAllMocks(); });

const slot = { candidates: [], adoptedId: null, adoptedBy: null, error: null };
const episodes = [{ id: "ep1", no: 1, title: "下山" }, { id: "ep2", no: 2, title: "进城" }, { id: "ep3", no: 3, title: "回乡" }];
const work: any = { id: "w", episodes, tasks: [], pricing: { image: 16, textMax: 21, mock: false },
  assets: [{ id: "c1", kind: "character", name: "林晚", description: "主角", aliases: [], episodeIds: ["ep1"], image: slot, prompt: "", rev: 3 }] };
const props = { work, episodeId: "ep2", apply: vi.fn(), setError: vi.fn() } as any;

test("assets come from extraction: no bulk library import, and adding one asks which episodes it appears in", async () => {
  api.edit.mockResolvedValue(work);
  render(<DirectorAssets {...props}/>);
  expect(screen.queryByRole("button", { name: /从资产库导入/ })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: /添加资产/ }));
  fireEvent.change(screen.getByLabelText("名称"), { target: { value: "玉佩" } });
  const picker = screen.getByRole("group", { name: "出现在" });
  // 默认全剧，不是分镜页当前选中的那一集。
  for (const b of within(picker).getAllByRole("button")) expect(b.getAttribute("aria-pressed")).toBe("true");
  fireEvent.click(within(picker).getByRole("button", { name: "第 2 集" }));
  fireEvent.click(screen.getByRole("button", { name: "添加" }));
  await waitFor(() => expect(api.edit).toHaveBeenCalledWith("w", "asset.create", null, null,
    { kind: "character", name: "玉佩", description: "", episodeIds: ["ep1", "ep3"] }));
});

test("adding is blocked until at least one episode is chosen", () => {
  render(<DirectorAssets {...props}/>);
  fireEvent.click(screen.getByRole("button", { name: /添加资产/ }));
  fireEvent.change(screen.getByLabelText("名称"), { target: { value: "玉佩" } });
  for (const b of within(screen.getByRole("group", { name: "出现在" })).getAllByRole("button")) fireEvent.click(b);
  expect((screen.getByRole("button", { name: "添加" }) as HTMLButtonElement).disabled).toBe(true);
  expect(screen.getByText("至少选一集")).toBeTruthy();
});

test("a character can be linked to an existing library asset or get an uploaded image, like scenes and props", async () => {
  api.edit.mockResolvedValue(work);
  render(<DirectorAssets {...props}/>);
  fireEvent.click(screen.getByRole("button", { name: "查看林晚" }));
  expect(screen.getByRole("button", { name: /上传图片/ })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: /关联已有资产/ }));
  fireEvent.click(screen.getByRole("button", { name: "「林晚」关联已有资产·选好了" }));
  await waitFor(() => expect(api.edit).toHaveBeenCalledWith("w", "asset.link", "c1", null, { objectId: "lib-1", versionId: "v2" }));
});

test("editing an asset can change the episodes it appears in", async () => {
  api.edit.mockResolvedValue(work);
  render(<DirectorAssets {...props}/>);
  fireEvent.click(screen.getByRole("button", { name: "查看林晚" }));
  fireEvent.click(screen.getByRole("button", { name: "编辑" }));
  fireEvent.click(within(screen.getByRole("group", { name: "出现在" })).getByRole("button", { name: "第 3 集" }));
  fireEvent.click(screen.getByRole("button", { name: "保存" }));
  await waitFor(() => expect(api.edit).toHaveBeenCalledWith("w", "asset.update", "c1", 3, expect.objectContaining({ episodeIds: ["ep1", "ep3"] })));
});
