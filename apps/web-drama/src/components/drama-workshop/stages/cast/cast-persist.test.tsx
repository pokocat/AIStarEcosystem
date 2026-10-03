import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";

// 复核：角色这几个要等几秒的扣费操作，结果回来时用户可能已经离开工作台。
// 以前只 dispatch 到 reducer、落库靠角色表的自动保存 —— 整个工作台卸载了，dispatch 落空，花了积分的结果丢了。
// 用真的 CreditButton（带 lockKey），确认框与配置换成立即返回。
// §8.0.1 ⑩：断落库后文档里有什么、请求发了几次，不断言可视文案。

vi.mock("@/components/drama-ui/confirm-dialog", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/components/drama-ui/confirm-dialog")>()),
  dramaConfirm: () => Promise.resolve(true),
}));
vi.mock("@/api/drama-config", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/api/drama-config")>();
  return { ...actual, getDramaConfig: () => Promise.resolve(actual.DRAMA_CONFIG_DEFAULTS) };
});
vi.mock("@/lib/use-drama-config", async () => {
  const { DRAMA_CONFIG_DEFAULTS } = await vi.importActual<typeof import("@/api/drama-config")>("@/api/drama-config");
  return { useDramaConfig: () => DRAMA_CONFIG_DEFAULTS };
});
vi.mock("@/lib/use-wallet", () => ({ notifyWalletChanged: () => {} }));
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), info: vi.fn(), error: vi.fn() }) }));

const castAiDraft = vi.fn();
const renderFrame = vi.fn();
vi.mock("@/api", () => ({
  ProjectsApi: {
    castAiDraft: (id: string) => castAiDraft(id),
    generateReferenceSheet: vi.fn(),
  },
  RenderApi: { renderFrame: (req: unknown) => renderFrame(req) },
  DramaAssetsApi: { uploadAssetRef: vi.fn() },
  DapAvatarsApi: { AIAVATAR_URL: "https://aiavatar.test", listMyDapAvatars: vi.fn() },
}));

import { CastStage } from "./index";
import { workshopReducer, type WorkshopState } from "../../workbench/workshop-shell";
import { useRegisterWorkbenchDispatch } from "../../workbench/live-dispatch";
import type { CharacterDef, ProjectData } from "@/mocks/drama-workshop";
import type { StageContext } from "../stage-context";

const ch = (over: Partial<CharacterDef> = {}): CharacterDef => ({
  id: "c1",
  name: "甲",
  role: "key",
  cast: "",
  desc: "",
  avatar: "a1",
  bound: false,
  ...over,
});

const DOC: ProjectData = {
  projectInfo: { title: "T", type: "都市", episodes: 3, duration: "每集 60 秒", ratio: "9:16", logline: "L", mainline: "" },
  topicCards: [],
  episodes: [{ no: 1, content: "E1" }],
  characters: [ch()],
  script: { ep: 1, scenes: [] },
  storyboard: { ep: 1, scenes: [] },
  promptPack: { ep: 1, scene: "", shots: [] },
};

function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

async function flush() {
  await act(async () => {
    for (let i = 0; i < 8; i++) await Promise.resolve();
  });
}

/** 页面级 ctx：和 page.tsx 一样挂在组件外面，工作台卸载后闭包仍在；按「最新文档」合并。 */
function makeCtx(projectId: string) {
  const store = { doc: DOC };
  const patchData = vi.fn(async (patch: (prev: ProjectData) => ProjectData) => {
    store.doc = patch(store.doc);
  });
  const ctx: StageContext = { projectId, saveData: vi.fn(async () => {}), patchData };
  return { store, ctx, patchData };
}

/** 工作台：reducer + 设定页里的角色区。整个卸载 = 回到短剧列表。 */
function Workbench({ ctx }: { ctx: StageContext }) {
  const [state, dispatch] = React.useReducer(workshopReducer, undefined, (): WorkshopState => ({
    stage: "cast",
    ep: 1,
    lockedStages: {},
    chars: DOC.characters.map((c) => ({ ...c })),
  }));
  useRegisterWorkbenchDispatch(ctx.projectId, dispatch); // 同 WorkshopShell
  return (
    <>
      <div data-testid="reducer-chars">{state.chars.map((c) => c.id).join(",")}</div>
      <CastStage state={state} dispatch={dispatch} data={DOC} ctx={ctx} />
    </>
  );
}

describe("角色区：扣费结果回来时已经离开工作台（复核）", () => {
  beforeEach(() => {
    castAiDraft.mockReset();
    renderFrame.mockReset();
  });
  afterEach(cleanup);

  it("按大纲重新生成角色：请求在途时回到列表，结果回来照样落库，且不盖掉期间写进来的内容", async () => {
    const d = deferred<CharacterDef[]>();
    castAiDraft.mockReturnValue(d.promise);
    const { store, ctx } = makeCtx("p-cast-1");
    const { unmount } = render(<Workbench ctx={ctx} />);

    fireEvent.click(screen.getByTestId("cast-redraft"));
    await flush();
    expect(castAiDraft).toHaveBeenCalledTimes(1);

    unmount(); // 回到短剧列表：reducer、角色自动保存都没了
    // 等待期间别处写进来的内容（比如某一集的成片）
    store.doc = { ...store.doc, episodeDocs: { "1": { assembled: { url: "https://v.test/1.mp4" } } } as ProjectData["episodeDocs"] };

    const fresh = [ch({ id: "n1", name: "新甲" }), ch({ id: "n2", name: "新乙", role: "extra" })];
    await act(async () => d.resolve(fresh));
    await flush();

    expect(store.doc.characters.map((c) => c.id)).toEqual(["n1", "n2"]);
    expect(Object.keys(store.doc.episodeDocs ?? {})).toEqual(["1"]);
  });

  it("按大纲重新生成角色：生成中切走再切回来，再点也只发一次请求", async () => {
    const d = deferred<CharacterDef[]>();
    castAiDraft.mockReturnValue(d.promise);
    const { ctx } = makeCtx("p-cast-2");
    const first = render(<Workbench ctx={ctx} />);
    fireEvent.click(screen.getByTestId("cast-redraft"));
    await flush();
    first.unmount();

    render(<Workbench ctx={ctx} />);
    await flush();
    fireEvent.click(screen.getByTestId("cast-redraft"));
    await flush();
    expect(castAiDraft).toHaveBeenCalledTimes(1);

    await act(async () => d.resolve([ch({ id: "n1" })]));
    await flush();
    // 锁放开之后可以再生成
    castAiDraft.mockResolvedValue([ch({ id: "n3" })]);
    fireEvent.click(screen.getByTestId("cast-redraft"));
    await flush();
    expect(castAiDraft).toHaveBeenCalledTimes(2);
  });

  it("AI 画定妆照：请求在途时回到列表，结果回来只改这一个角色并落库", async () => {
    const d = deferred<{ frames: Array<{ url: string; cdnKey?: string }> }>();
    renderFrame.mockReturnValue(d.promise);
    const { store, ctx } = makeCtx("p-cast-3");
    const { unmount } = render(<Workbench ctx={ctx} />);

    fireEvent.click(screen.getByTestId("char-gen-ref"));
    await flush();
    expect(renderFrame).toHaveBeenCalledTimes(1);

    unmount();
    // 等待期间文档里多了一个角色（别处加的）
    store.doc = { ...store.doc, characters: [...store.doc.characters, ch({ id: "c2", name: "乙" })] };
    await act(async () => d.resolve({ frames: [{ url: "https://img.test/ref.jpg", cdnKey: "k/ref.jpg" }] }));
    await flush();

    const byId = Object.fromEntries(store.doc.characters.map((c) => [c.id, c]));
    expect(byId.c1.refUrl).toBe("https://img.test/ref.jpg");
    expect(byId.c1.refCdnKey).toBe("k/ref.jpg");
    expect(byId.c2).toBeDefined();
    expect(byId.c2.refUrl).toBeUndefined();
  });

  it("按大纲重新生成角色：回到列表又点进来（新的工作台），结果回来时新界面上就是新角色", async () => {
    const d = deferred<CharacterDef[]>();
    castAiDraft.mockReturnValue(d.promise);
    const { store, ctx } = makeCtx("p-cast-4");
    const first = render(<Workbench ctx={ctx} />);
    fireEvent.click(screen.getByTestId("cast-redraft"));
    await flush();
    first.unmount();

    render(<Workbench ctx={ctx} />); // 新的 reducer，按旧角色初始化
    expect(screen.getByTestId("reducer-chars").textContent).toBe("c1");
    await act(async () => d.resolve([ch({ id: "n1" }), ch({ id: "n2" })]));
    await flush();
    expect(screen.getByTestId("reducer-chars").textContent).toBe("n1,n2");
    expect(store.doc.characters.map((c) => c.id)).toEqual(["n1", "n2"]);
  });
});
