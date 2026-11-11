// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { DirectorAssets } from "./director-assets";
import { StyleField } from "./director-styles";
import { clearDrafts, hasDrafts } from "./director-shared";

const api = vi.hoisted(() => ({ runTask: vi.fn(), edit: vi.fn() }));
vi.mock("../api", () => ({ DirectorApi: api, IpStudioApi: {} }));
vi.mock("../studio-errors", async importOriginal => ({ ...(await importOriginal<typeof import("../studio-errors")>()), useStudioApp: () => ({ modal: { confirm: vi.fn() } }) }));
vi.mock("../library-reference-picker", () => ({ LibraryReferencePicker: () => null }));
vi.mock("./director-shared", async importOriginal => ({ ...(await importOriginal<typeof import("./director-shared")>()), chooseDirectorBilling: async () => undefined }));
afterEach(() => { cleanup(); clearDrafts("w:"); vi.clearAllMocks(); });

const empty = { candidates: [], adoptedId: null, adoptedBy: null, error: null };
const withImage = (key: string) => ({ candidates: [{ id: `m-${key}`, key, url: `/${key}.png`, source: "upload", runId: null, createdAt: "2026-11-04T00:00:00Z" }], adoptedId: `m-${key}`, adoptedBy: "user", error: null });
const base = { aliases: [], episodeIds: ["ep1"], prompt: "", promptCustom: false, voice: null, rev: 1 };
const work: any = { id: "w", episodes: [{ id: "ep1", no: 1, title: "一" }], tasks: [], pricing: { image: 16, textMax: 21, mock: false },
  clips: [{ id: "k1", episodeId: "ep1", order: 1, title: "对峙", assetIds: ["c1", "s1"], assetForms: { c1: "fm1" }, shots: [{ id: "x", sceneView: "reverse", dialogue: [] }], board: empty, video: empty }],
  assets: [
    { ...base, id: "c1", kind: "character", name: "白素贞", description: "白衣女子", image: withImage("bai"), forms: [{ id: "fm1", name: "半妖态", description: "蛇尾", image: empty }] },
    { ...base, id: "s1", kind: "scene", name: "金山寺", description: "江边寺庙", image: withImage("si"), views: {} },
    { ...base, id: "p1", kind: "prop", name: "金钵", description: "铜钵", image: empty },
  ] };
const props = { work, episodeId: "ep1", apply: vi.fn(), setError: vi.fn(), focusClip: vi.fn() } as any;

test("generating saves the edited character before submitting, without another save click", async () => {
  let finish!: (value: typeof work) => void;
  api.edit.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  api.runTask.mockResolvedValue(work);
  render(<DirectorAssets {...props}/>);
  fireEvent.click(screen.getByRole("button", { name: "查看白素贞" }));
  fireEvent.click(screen.getByRole("button", { name: "编辑" }));
  fireEvent.change(screen.getByLabelText(/外观与设定/), { target: { value: "40–50岁，深色休闲装" } });
  fireEvent.click(screen.getByRole("button", { name: "重新生成" }));
  await waitFor(() => expect(api.edit).toHaveBeenCalledWith("w", "asset.update", "c1", 1, { description: "40–50岁，深色休闲装" }));
  expect(api.runTask).not.toHaveBeenCalled();
  finish({ ...work, revision: 2 });
  await waitFor(() => expect(api.runTask).toHaveBeenCalledWith("w", expect.objectContaining({ type: "asset-image", targetId: "c1" })));
  expect(hasDrafts("w:asset:c1:")).toBe(false);
});

test("a failed save preserves the character edits and never submits a paid generation", async () => {
  api.edit.mockRejectedValue(new Error("保存失败"));
  render(<DirectorAssets {...props}/>);
  fireEvent.click(screen.getByRole("button", { name: "查看白素贞" }));
  fireEvent.click(screen.getByRole("button", { name: "编辑" }));
  fireEvent.change(screen.getByRole("textbox", { name: "出图提示词", exact: true }), { target: { value: "40岁男性，黑色夹克" } });
  fireEvent.click(screen.getByRole("button", { name: "重新生成" }));
  await waitFor(() => expect(props.setError).toHaveBeenCalled());
  expect(api.runTask).not.toHaveBeenCalled();
  expect(hasDrafts("w:asset:c1:prompt")).toBe(true);
  expect((screen.getByRole("textbox", { name: "出图提示词", exact: true }) as HTMLTextAreaElement).value).toBe("40岁男性，黑色夹克");
});

test("generating a form also saves its currently edited appearance", async () => {
  api.edit.mockResolvedValue(work);
  api.runTask.mockResolvedValue(work);
  render(<DirectorAssets {...props}/>);
  fireEvent.click(screen.getByRole("button", { name: "查看白素贞" }));
  fireEvent.click(screen.getByRole("tab", { name: /半妖态/ }));
  fireEvent.change(screen.getByLabelText("和平时不一样的地方"), { target: { value: "黑色长裙，蛇尾" } });
  fireEvent.click(screen.getByRole("button", { name: "生成形态图" }));
  await waitFor(() => expect(api.edit).toHaveBeenCalledWith("w", "form.update", "fm1", null, { description: "黑色长裙，蛇尾" }));
  await waitFor(() => expect(api.runTask).toHaveBeenCalledWith("w", expect.objectContaining({ type: "form-image", targetId: "fm1" })));
  expect(api.edit.mock.invocationCallOrder[0]).toBeLessThan(api.runTask.mock.invocationCallOrder[0]);
});

test("clicking an asset opens one big dialog with a strip to switch between assets", () => {
  render(<DirectorAssets {...props}/>);
  fireEvent.click(screen.getByRole("button", { name: "查看白素贞" }));
  const dialog = screen.getByRole("dialog", { name: "资产详情" });
  const strip = within(dialog).getByRole("navigation", { name: "切换资产" });
  expect(within(strip).getAllByRole("button").map(b => b.title)).toEqual(["白素贞", "金山寺", "金钵"]);
  fireEvent.click(within(strip).getByRole("button", { name: "金山寺" }));
  expect(within(dialog).getByRole("tab", { name: "主视" })).toBeTruthy();
  expect(within(dialog).queryByRole("button", { name: /添加形态/ })).toBeNull();
});

test("a form tab generates from the form, and the main tab keeps its own actions", async () => {
  api.runTask.mockResolvedValue(work);
  render(<DirectorAssets {...props}/>);
  fireEvent.click(screen.getByRole("button", { name: "查看白素贞" }));
  expect(screen.getByRole("button", { name: /直接上传作为资产图/ })).toBeTruthy();
  fireEvent.click(screen.getByRole("tab", { name: /半妖态/ }));
  expect(screen.queryByRole("button", { name: /直接上传作为资产图/ })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "生成形态图" }));
  await waitFor(() => expect(api.runTask).toHaveBeenCalledWith("w", expect.objectContaining({ type: "form-image", targetId: "fm1", maxCost: 16 })));
});

test("adding a form creates it under the character and opens its tab", async () => {
  const next = { ...work, assets: work.assets.map((a: any) => a.id === "c1" ? { ...a, forms: [...a.forms, { id: "fm2", name: "婚礼礼服", description: "", image: empty }] } : a) };
  api.edit.mockResolvedValue(next);
  render(<DirectorAssets {...props}/>);
  fireEvent.click(screen.getByRole("button", { name: "查看白素贞" }));
  fireEvent.click(screen.getByRole("button", { name: /添加形态/ }));
  const editor = screen.getByRole("region", { name: "添加形态" });
  fireEvent.change(within(editor).getByLabelText("名称"), { target: { value: "婚礼礼服" } });
  fireEvent.click(within(editor).getByRole("button", { name: "添加" }));
  await waitFor(() => expect(api.edit).toHaveBeenCalledWith("w", "form.create", "c1", null, { name: "婚礼礼服", description: "" }));
  await waitFor(() => expect(props.apply).toHaveBeenCalledWith(next));
});

test("a scene view generates all three views at once for one image's price, and says how many shots use it", async () => {
  api.runTask.mockResolvedValue(work);
  render(<DirectorAssets {...props}/>);
  fireEvent.click(screen.getByRole("button", { name: "查看金山寺" }));
  const reverse = screen.getByRole("tab", { name: /反打/ });
  expect(reverse.title).toBe("1 个镜头使用此视角");
  fireEvent.click(reverse);
  expect(screen.getByText(/三张共/)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "生成三个视角" }));
  await waitFor(() => expect(api.runTask).toHaveBeenCalledWith("w", expect.objectContaining({ type: "scene-views", targetId: "s1", maxCost: 16 })));
});

test("a scene opens on all views: the main view above, the other three below, and clicking one opens that view with its own records", async () => {
  api.runTask.mockResolvedValue(work);
  const views = { reverse: withImage("rev"), left: empty, right: empty };
  const full = { ...work, assets: work.assets.map((a: any) => a.id === "s1" ? { ...a, views } : a) };
  render(<DirectorAssets {...props} work={full}/>);
  fireEvent.click(screen.getByRole("button", { name: "查看金山寺" }));
  expect((screen.getByRole("tab", { name: /全部视角/ }) as HTMLButtonElement).getAttribute("aria-selected")).toBe("true");
  expect(screen.getByRole("tab", { name: /全部视角/ }).textContent).toContain("2/4");
  const stage = screen.getByRole("region", { name: "全部视角" });
  const tiles = within(stage).getAllByRole("button", { name: /^查看/ });
  expect(tiles.map(b => b.getAttribute("aria-label"))).toEqual(["查看主视", "查看反打", "查看左立面", "查看右立面"]);
  // 总览里没有生成记录：记录属于单个视角。
  expect(within(stage).queryByRole("group", { name: "生成记录" })).toBeNull();
  fireEvent.click(within(stage).getByRole("button", { name: "重新生成三个视角" }));
  await waitFor(() => expect(api.runTask).toHaveBeenCalledWith("w", expect.objectContaining({ type: "scene-views", targetId: "s1" })));
  fireEvent.click(within(stage).getByRole("button", { name: "查看反打" }));
  expect((screen.getByRole("tab", { name: /反打/ }) as HTMLButtonElement).getAttribute("aria-selected")).toBe("true");
  expect(within(screen.getByRole("region", { name: "金山寺·反打的图" })).getByRole("group", { name: "生成记录" })).toBeTruthy();
});

// 2026-11-11 用户反馈：在右立面点「重新生成」，三个视角一起换了。单个视角里只换这一个，三个一起换留在「全部视角」。
test("inside one view, regenerate only replaces that view", async () => {
  api.runTask.mockResolvedValue(work);
  const views = { reverse: withImage("rev"), left: withImage("lft"), right: withImage("rgt") };
  const full = { ...work, assets: work.assets.map((a: any) => a.id === "s1" ? { ...a, views } : a) };
  render(<DirectorAssets {...props} work={full}/>);
  fireEvent.click(screen.getByRole("button", { name: "查看金山寺" }));
  fireEvent.click(screen.getByRole("tab", { name: /右立面/ }));
  expect(screen.queryByRole("button", { name: "重新生成三个视角" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "重新生成" }));
  await waitFor(() => expect(api.runTask).toHaveBeenCalledWith("w", expect.objectContaining({ type: "scene-views", targetId: "s1", options: { view: "right" } })));
});

test("all views offers the main view first when the scene has none yet", async () => {
  api.runTask.mockResolvedValue(work);
  const bare = { ...work, assets: work.assets.map((a: any) => a.id === "s1" ? { ...a, image: empty } : a) };
  render(<DirectorAssets {...props} work={bare}/>);
  fireEvent.click(screen.getByRole("button", { name: "查看金山寺" }));
  expect(screen.getByRole("button", { name: /直接上传作为资产图/ })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "生成主视图" }));
  await waitFor(() => expect(api.runTask).toHaveBeenCalledWith("w", expect.objectContaining({ type: "asset-image", targetId: "s1" })));
});

test("a view can't be generated before the scene has a main image", () => {
  const bare = { ...work, assets: work.assets.map((a: any) => a.id === "s1" ? { ...a, image: empty } : a) };
  render(<DirectorAssets {...props} work={bare}/>);
  fireEvent.click(screen.getByRole("button", { name: "查看金山寺" }));
  fireEvent.click(screen.getByRole("tab", { name: /反打/ }));
  expect((screen.getByRole("button", { name: "生成三个视角" }) as HTMLButtonElement).disabled).toBe(true);
  expect(screen.getByText("请先生成主视图，其他视角将以其为参考")).toBeTruthy();
});

test("the style field is one line that opens small text chips: hovering enlarges, clicking previews, and only confirming changes the style", () => {
  const onChange = vi.fn();
  render(<StyleField value="真人写实" onChange={onChange}/>);
  expect(screen.queryByRole("button", { name: "黏土定格" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: /真人写实/ }));
  const chip = screen.getByRole("button", { name: "黏土定格" });
  fireEvent.mouseEnter(chip);
  expect(document.querySelector(".director-style-hover img")?.getAttribute("src")).toBe("/studio/director-styles/clay-large.webp");
  fireEvent.mouseLeave(chip);
  expect(document.querySelector(".director-style-hover")).toBeNull();
  fireEvent.click(chip);
  const preview = screen.getByRole("dialog", { name: "黏土定格" });
  expect(onChange).not.toHaveBeenCalled();
  fireEvent.click(within(preview).getByRole("button", { name: "使用此风格" }));
  expect(onChange).toHaveBeenCalledWith("黏土定格动画");
  expect(screen.queryByRole("dialog")).toBeNull();
});

test("escape closes one layer at a time and never reaches the dialog behind, and a custom style can be typed", () => {
  const onChange = vi.fn(), behind = vi.fn();
  window.addEventListener("keydown", behind);
  render(<StyleField value="真人写实" onChange={onChange}/>);
  fireEvent.click(screen.getByRole("button", { name: /真人写实/ }));
  fireEvent.click(screen.getByRole("button", { name: "水墨国风" }));
  fireEvent.keyDown(screen.getByRole("dialog", { name: "水墨国风" }), { key: "Escape" });
  expect(screen.queryByRole("dialog", { name: "水墨国风" })).toBeNull();
  const menu = screen.getByRole("dialog", { name: "选择画面风格" });
  fireEvent.change(within(menu).getByLabelText("自定义风格"), { target: { value: "九十年代文艺片写实" } });
  expect(onChange).toHaveBeenLastCalledWith("九十年代文艺片写实");
  fireEvent.keyDown(menu, { key: "Escape" });
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(behind).not.toHaveBeenCalled();
  window.removeEventListener("keydown", behind);
});
