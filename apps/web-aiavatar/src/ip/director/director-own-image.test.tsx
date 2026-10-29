// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { DirectorAssets } from "./director-assets";

// 2026-10-28 用户需求：资产能完全用自己上传的图。「直接作为资产图」与「作为参考图」两种用法分开、说清，
// 上传和直接采用都不发起生成；上传失败不冒充成功。
const api = vi.hoisted(() => ({ runTask: vi.fn(), edit: vi.fn(), uploadImage: vi.fn() }));
const confirm = vi.hoisted(() => vi.fn());
vi.mock("../api", () => ({ DirectorApi: { runTask: api.runTask, edit: api.edit }, IpStudioApi: { uploadImage: api.uploadImage } }));
vi.mock("../studio-errors", async importOriginal => ({ ...(await importOriginal<typeof import("../studio-errors")>()), useStudioApp: () => ({ modal: { confirm } }) }));
vi.mock("../library-reference-picker", () => ({ LibraryReferencePicker: () => null }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });

const empty = { candidates: [], adoptedId: null, adoptedBy: null, error: null };
const uploaded = { candidates: [{ id: "m1", key: "u/old.png", url: "/cdn/old.png", source: "upload", createdAt: "2026-10-28T00:00:00Z" }], adoptedId: "m1", adoptedBy: "user", error: null };
const asset = (over: object) => ({ id: "s1", kind: "scene", name: "老宅", description: "雨夜的老宅门口", prompt: "老宅", promptCustom: false, rev: 1, aliases: [], episodeIds: ["ep1"], image: empty, voice: null, ...over });
const work = (assets: object[]): any => ({ id: "own-work", episodes: [{ id: "ep1", no: 1, title: "雨夜" }], clips: [], tasks: [], pricing: { image: 16, textMax: 21, mock: false }, assets });
const pick = (label: string | RegExp, name = "我的老宅.png", type = "image/png") =>
  fireEvent.change(screen.getByLabelText(label), { target: { files: [new File(["png"], name, { type })] } });

test("a new asset can be built from the user's own image, used directly or only as a reference, without generating", async () => {
  api.uploadImage.mockResolvedValue({ key: "u/house.png", url: "/cdn/house.png", fileName: "我的老宅.png" });
  api.edit.mockResolvedValue(work([]));
  render(<DirectorAssets work={work([])} episodeId="ep1" apply={vi.fn()} setError={vi.fn()} {...({} as any)}/>);
  fireEvent.click(screen.getByRole("button", { name: /添加资产/ }));
  const panel = screen.getByRole("region", { name: "添加资产" });
  fireEvent.click(within(panel).getByRole("button", { name: "场景" }));
  pick("选择资产图片");
  await within(panel).findByAltText("已上传的图片");
  expect((within(panel).getByRole("textbox", { name: "名称" }) as HTMLInputElement).value).toBe("我的老宅");
  const uses = within(panel).getByRole("radiogroup", { name: "这张图怎么用" });
  expect((within(uses).getByRole("radio", { name: /直接作为资产图/ }) as HTMLInputElement).checked).toBe(true);
  expect(within(uses).getByText(/不用 AI 生成、不扣积分/)).toBeTruthy();
  fireEvent.click(within(uses).getByRole("radio", { name: /作为参考图/ }));
  fireEvent.click(within(panel).getByRole("button", { name: "添加" }));
  await waitFor(() => expect(api.edit).toHaveBeenCalledTimes(1));
  expect(api.edit.mock.calls[0]).toEqual(["own-work", "asset.create", null, null,
    { kind: "scene", name: "我的老宅", description: "", episodeIds: ["ep1"], image: { key: "u/house.png", use: "ref" } }]);
  expect(api.runTask).not.toHaveBeenCalled();
});

test("default use adopts the image directly; a failed upload shows why and adds no image", async () => {
  api.uploadImage.mockRejectedValueOnce(new Error("图片超过 10MB 上限，请压缩后重试"));
  api.edit.mockResolvedValue(work([]));
  render(<DirectorAssets work={work([])} episodeId="ep1" apply={vi.fn()} setError={vi.fn()} {...({} as any)}/>);
  fireEvent.click(screen.getByRole("button", { name: /添加资产/ }));
  const panel = screen.getByRole("region", { name: "添加资产" });
  pick("选择资产图片", "大图.png");
  await waitFor(() => expect(within(panel).getByRole("alert").textContent).toContain("图片没有上传成功：图片超过 10MB 上限"));
  expect(within(panel).queryByAltText("已上传的图片")).toBeNull();
  expect(within(panel).queryByRole("radiogroup")).toBeNull();
  pick("选择资产图片", "说明.gif", "image/gif");
  expect(within(panel).getByRole("alert").textContent).toContain("只支持 PNG 或 JPG");
  expect(api.uploadImage).toHaveBeenCalledTimes(1);

  api.uploadImage.mockResolvedValueOnce({ key: "u/linxia.jpg", url: "/cdn/linxia.jpg", fileName: "林夏.jpg" });
  pick("选择资产图片", "林夏.jpg", "image/jpeg");
  await within(panel).findByAltText("已上传的图片");
  fireEvent.click(within(panel).getByRole("button", { name: "添加" }));
  await waitFor(() => expect(api.edit).toHaveBeenCalledTimes(1));
  expect(api.edit.mock.calls[0][4]).toMatchObject({ kind: "character", name: "林夏", image: { key: "u/linxia.jpg", use: "asset" } });
});

test("asset detail keeps the two uses apart: a reference never replaces the asset image, a direct upload asks before replacing", async () => {
  api.uploadImage.mockResolvedValue({ key: "u/new.png", url: "/cdn/new.png", fileName: "new.png" });
  api.edit.mockResolvedValue(work([asset({ image: uploaded })]));
  render(<DirectorAssets work={work([asset({ image: uploaded })])} episodeId="ep1" apply={vi.fn()} setError={vi.fn()} {...({} as any)}/>);
  fireEvent.click(screen.getByRole("button", { name: "查看老宅" }));
  const imageSection = screen.getByRole("region", { name: "资产图" });
  const refSection = screen.getByRole("region", { name: "参考图" });
  expect(screen.getAllByText("自己上传").length).toBeGreaterThan(0);
  expect(within(refSection).getByText(/不会替换当前资产图/)).toBeTruthy();

  pick("上传「老宅」的参考图", "参考.jpg", "image/jpeg");
  await waitFor(() => expect(api.edit).toHaveBeenCalledWith("own-work", "asset.setRef", "s1", null, { key: "u/new.png" }));
  expect(api.edit.mock.calls.some(c => c[1] === "asset.upload")).toBe(false);
  expect(confirm).not.toHaveBeenCalled();

  expect(within(imageSection).getByRole("button", { name: "直接上传作为资产图" })).toBeTruthy();
  pick("直接上传「老宅」的资产图", "定稿.png");
  expect(confirm).toHaveBeenCalledTimes(1);
  expect(confirm.mock.calls[0][0].title).toBe("用这张图替换「老宅」的资产图？");
  expect(api.uploadImage).toHaveBeenCalledTimes(1);
  await act(async () => { confirm.mock.calls[0][0].onOk(); });
  await waitFor(() => expect(api.edit).toHaveBeenCalledWith("own-work", "asset.upload", "s1", null, { key: "u/new.png" }));
  expect(api.runTask).not.toHaveBeenCalled();
});

test("an asset without an image uploads directly without a replace prompt", async () => {
  api.uploadImage.mockResolvedValue({ key: "u/prop.png", url: "/cdn/prop.png", fileName: "prop.png" });
  api.edit.mockResolvedValue(work([]));
  render(<DirectorAssets work={work([asset({ id: "p1", kind: "prop", name: "灯笼" })])} episodeId="ep1" apply={vi.fn()} setError={vi.fn()} {...({} as any)}/>);
  fireEvent.click(screen.getByRole("button", { name: "查看灯笼" }));
  expect(within(screen.getByRole("region", { name: "参考图" })).getByRole("button", { name: "上传作为参考图" })).toBeTruthy();
  pick("直接上传「灯笼」的资产图", "灯笼.png");
  await waitFor(() => expect(api.edit).toHaveBeenCalledWith("own-work", "asset.upload", "p1", null, { key: "u/prop.png" }));
  expect(confirm).not.toHaveBeenCalled();
});
