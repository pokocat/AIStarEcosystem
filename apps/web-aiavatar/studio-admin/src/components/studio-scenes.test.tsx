import * as React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type { StudioSceneAdminView, StudioSceneCatalog } from "@ai-star-eco/types/ip-studio-scenes";

// 「场景模板」页对着内存里的契约实现：改名保存、别人先存过时不覆盖、上传封面后带着 key 保存、下架、新增。
const store = vi.hoisted(() => ({ catalog: null as unknown as StudioSceneCatalog, version: 0, save: vi.fn() }));
const builtIn = (): StudioSceneCatalog => ({
  version: 1,
  imageGroups: [{ id: "product", title: "商品" }],
  videoGroups: [{ id: "commerce", title: "电商带货" }],
  image: [{ id: "white-background", group: "product", title: "商品白底图", description: "干净的白底主图", refs: [{ label: "商品图", required: true, hint: null }],
    prompt: "把图1中的商品单独放到纯白背景正中。", hint: "可以补充角度", ratio: "1:1" }],
  video: [{ id: "ecom-talking", group: "commerce", title: "口播带货", description: "有人出镜推荐", images: { label: "商品图", required: true, max: 4 }, video: null,
    character: true, voice: true, placeholder: "说说卖什么", textRequired: false, durations: [15, 25], duration: 25, ratio: "9:16",
    structure: "真人对着镜头讲。", ideas: ["开头抓人"], skill: "video-generation",
    options: [{ key: "presenter", label: "出镜方式", defaultValue: "person", choices: [{ value: "person", label: "真人讲解", prompt: "真人出镜对着镜头讲" }, { value: "product", label: "只拍商品", prompt: "只拍商品" }] }] }],
  homeGoals: [{ id: "commerce", title: "电商带货", description: "带货短视频", sceneId: "ecom-talking", covers: ["ecom-talking"] }],
});
vi.mock("@/lib/api", async () => {
  class ApiError extends Error { constructor(message: string, public readonly code: string, public readonly status?: number) { super(message); } }
  const view = (): StudioSceneAdminView => ({ catalog: structuredClone(store.catalog), source: store.version ? "custom" : "default", version: store.version,
    skills: ["reference-video-recreation", "video-generation"] });
  const later = <T,>(fn: () => T) => new Promise<T>((resolve, reject) => setTimeout(() => { try { resolve(fn()); } catch (e) { reject(e); } }, 0));
  return {
    ApiError,
    StudioScenesApi: {
      get: () => later(view),
      save: (catalog: StudioSceneCatalog, baseVersion: number) => { store.save(catalog, baseVersion); return later(() => {
        if (baseVersion !== store.version) throw new ApiError("场景目录刚被别人改过，请刷新后再改", "STUDIO_SCENE_CATALOG_STALE", 409);
        store.catalog = structuredClone(catalog); store.version += 1; return view();
      }); },
      reset: () => later(() => { store.catalog = builtIn(); store.version = 0; return view(); }),
      upload: (f: File) => later(() => ({ key: `ipstudio_scene/catalog/${f.name}`, url: "blob:preview", mediaType: "image" as const })),
    },
  };
});
import { StudioScenes } from "./studio-scenes";

beforeEach(() => { store.catalog = builtIn(); store.version = 0; store.save.mockClear(); });
afterEach(cleanup);

async function open() {
  render(<StudioScenes />);
  await screen.findByRole("textbox", { name: "名称" });
}
const saveButton = () => screen.getByRole("button", { name: /保存|没有改动/ }) as HTMLButtonElement;

test("改名、上传封面、下架后整份保存；保存带上读到的版本号，封面只存 key", async () => {
  await open();
  expect(saveButton().disabled).toBe(true);
  fireEvent.change(screen.getByRole("textbox", { name: "名称" }), { target: { value: "口播种草" } });
  await act(async () => { fireEvent.change(screen.getByLabelText("封面文件"), { target: { files: [new File(["x"], "c.png", { type: "image/png" })] } }); });
  await waitFor(() => expect(screen.getByRole("img", { name: "封面" })).toBeTruthy());
  fireEvent.click(screen.getByRole("switch", { name: "上架" }));
  await act(async () => { fireEvent.click(saveButton()); });
  await waitFor(() => expect(store.save).toHaveBeenCalledTimes(1));
  const [catalog, version] = store.save.mock.calls[0];
  expect(version).toBe(0);
  expect(catalog.video[0]).toMatchObject({ id: "ecom-talking", title: "口播种草", enabled: false, coverKey: "ipstudio_scene/catalog/c.png" });
  await screen.findByText("运营改过 · 第 1 版");
  expect(screen.getByRole("status").textContent).toContain("已保存");
});

test("别人先存过：不覆盖，说清楚并给「刷新」", async () => {
  await open();
  store.version = 1; // 页面读到的是第 0 版，这时别人先存了一版。
  fireEvent.change(screen.getByRole("textbox", { name: "名称" }), { target: { value: "改一下" } });
  await act(async () => { fireEvent.click(saveButton()); });
  expect((await screen.findByRole("alert")).textContent).toContain("刚被别人改过");
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: /刷新/ })); });
  await waitFor(() => expect((screen.getByRole("textbox", { name: "名称" }) as HTMLInputElement).value).toBe("口播带货"));
});

test("新增的场景先下架、编号可以改；存过的场景编号锁住；删除先确认", async () => {
  await open();
  expect((screen.getByRole("textbox", { name: "编号" }) as HTMLInputElement).disabled).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: /新增/ }));
  const id = screen.getByRole("textbox", { name: "编号" }) as HTMLInputElement;
  expect(id.disabled).toBe(false);
  expect(id.value).toBe("video-new-1");
  expect(screen.getAllByText("下架").length).toBeGreaterThan(0);
  fireEvent.click(screen.getByRole("button", { name: /删除/ }));
  await screen.findByRole("alertdialog");
  fireEvent.click(screen.getByRole("button", { name: "删除" }));
  await waitFor(() => expect(screen.queryByText("video-new-1")).toBeNull());
  expect(screen.getAllByRole("button", { name: /口播带货/ }).length).toBeGreaterThan(0);
});

test("选项组：改选项名、换默认、加一组，保存后整份带上", async () => {
  await open();
  fireEvent.change(screen.getByRole("textbox", { name: "出镜方式 选项 2 名称" }), { target: { value: "只拍产品" } });
  fireEvent.click(screen.getByRole("button", { name: "设为默认" }));
  fireEvent.click(screen.getByRole("button", { name: /加一组选项/ }));
  fireEvent.change(screen.getByRole("textbox", { name: "选项组 2 名称" }), { target: { value: "语气" } });
  for (const [i, label] of [[1, "亲切"], [2, "专业"]] as const) {
    fireEvent.change(screen.getByRole("textbox", { name: `语气 选项 ${i} 名称` }), { target: { value: label } });
    fireEvent.change(screen.getByRole("textbox", { name: `语气 选项 ${i} 拼进去的话` }), { target: { value: `语气${label}` } });
  }
  await act(async () => { fireEvent.click(saveButton()); });
  await waitFor(() => expect(store.save).toHaveBeenCalledTimes(1));
  const options = store.save.mock.calls[0][0].video[0].options;
  expect(options[0]).toMatchObject({ key: "presenter", defaultValue: "product" });
  expect(options[0].choices[1].label).toBe("只拍产品");
  expect(options[1]).toMatchObject({ key: "opt-1", label: "语气", defaultValue: "c1", choices: [{ value: "c1", label: "亲切", prompt: "语气亲切" }, { value: "c2", label: "专业", prompt: "语气专业" }] });
});

test("首页卡片：改标题、加一张，保存后整份带上", async () => {
  await open();
  fireEvent.mouseDown(screen.getByRole("tab", { name: /首页卡片/ }), { button: 0 });
  fireEvent.click(screen.getByRole("tab", { name: /首页卡片/ }));
  const title = await screen.findByRole("textbox", { name: "卡片 1 标题" });
  fireEvent.change(title, { target: { value: "带货视频" } });
  fireEvent.click(screen.getByRole("button", { name: /加一张卡片/ }));
  await act(async () => { fireEvent.click(saveButton()); });
  await waitFor(() => expect(store.save).toHaveBeenCalledTimes(1));
  const goals = store.save.mock.calls[0][0].homeGoals;
  expect(goals).toHaveLength(2);
  expect(goals[0]).toMatchObject({ id: "commerce", title: "带货视频", sceneId: "ecom-talking" });
  expect(goals[1]).toMatchObject({ id: "goal-1", sceneId: "ecom-talking" });
});
