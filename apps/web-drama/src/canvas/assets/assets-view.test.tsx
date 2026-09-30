import * as React from "react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { CanvasImageBatchBody, CanvasImageRunBody, DramaCanvasDoc, DramaCanvasRun } from "@ai-star-eco/types/drama-canvas";
import type { CanvasPricingValue } from "@/canvas/core/contract";

// 角色和场景页的结构测试（§8.0.1 ⑥：写完没人挂的东西编译器不会告诉你）。
// 文档 / 运行两个 Provider 用真的（数据来自 mocks/canvas.ts 的示例画布「示例：末班车」，和服务端同形）；
// 生成、上传、价格、确认框换成可断言的替身。断请求参数和文档结构，不断界面文案（§8.0.1 ⑩）——
// 例外：失败原因必须如实显示给用户，那是要验的行为本身。

const EXAMPLE = "dcv_example_night_bus";

const api = vi.hoisted(() => ({ runImage: vi.fn(), runImageBatch: vi.fn(), uploadImage: vi.fn(), signAssets: vi.fn(), cancelRun: vi.fn() }));
vi.mock("@/api/canvas", async () => {
  const { mockCanvasServer } = await import("@/mocks/canvas");
  return {
    CanvasApi: {
      get: (id: string) => mockCanvasServer.get(id),
      save: (id: string, body: Parameters<typeof mockCanvasServer.save>[1]) => mockCanvasServer.save(id, body),
      getRuns: (id: string, ids: string[]) => (ids.length ? mockCanvasServer.getRuns(id, ids) : Promise.resolve([])),
      runImage: api.runImage,
      runImageBatch: api.runImageBatch,
      uploadImage: api.uploadImage,
      signAssets: api.signAssets,
      cancelRun: api.cancelRun,
    },
  };
});

const PRICING: CanvasPricingValue = {
  ready: true,
  imageModels: [
    { endpointId: "img-a", name: "标准出图", isDefault: true, creditCost: 7, billingUnit: "per_call", maxDurationSec: null, acceptsFirstFrame: true },
    { endpointId: "img-b", name: "高清出图", isDefault: false, creditCost: 11, billingUnit: "per_call", maxDurationSec: null, acceptsFirstFrame: true },
  ],
  videoModels: [],
  videoModelId: undefined,
  setVideoModelId: () => {},
  confirmThreshold: 1000,
  scriptPrice: () => 0,
  extractPrice: () => 0,
  storyboardPrice: () => 0,
  imagePrice: (count, endpointId) => (endpointId === "img-b" ? 11 : 7) * Math.max(1, count),
  videoPrice: () => 0,
  maxSegmentSec: () => 10,
};
vi.mock("@/canvas/core/use-canvas-pricing", () => ({ useCanvasPricing: () => PRICING, DEFAULT_MAX_SEGMENT_SEC: 10 }));

// isSubmitting（契约见 core/contract.ts）：用真的；测试里可以强制某个目标「提交中」。
// 底座还没实现时补一个恒 false 的（只为了在它落地前这份测试也能跑，落地后走真的）。
const forcedSubmitting = vi.hoisted(() => new Set<string>());
vi.mock("@/canvas/core/use-canvas-runs", async (orig) => {
  const actual = await orig<typeof import("@/canvas/core/use-canvas-runs")>();
  return {
    ...actual,
    useCanvasRuns: () => {
      const v = actual.useCanvasRuns();
      const real = (v as { isSubmitting?: (t: string) => boolean }).isSubmitting;
      return { ...v, isSubmitting: (t: string) => forcedSubmitting.has(t) || (real ? real(t) : false) };
    },
  };
});

const confirm = vi.hoisted(() => vi.fn());
vi.mock("@/components/drama-ui/confirm-dialog", () => ({ dramaConfirm: confirm }));
vi.mock("@/lib/toast", () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }));
vi.mock("@/lib/use-wallet", () => ({ notifyWalletChanged: vi.fn(), useWallet: () => ({ wallet: null, refresh: vi.fn() }) }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode } & Record<string, unknown>) => (
    <a href={href} {...(rest as object)}>
      {children}
    </a>
  ),
}));

import { __resetMockCanvasForTest } from "@/mocks/canvas";
import { CanvasDocProvider, CanvasRunsProvider, useCanvasDoc } from "@/canvas/core";
import { CanvasGate } from "@/canvas/shell";
import * as Assets from "./index";
import { __resetAssetGenPanelForTest } from "./asset-gen-panel";
import { AssetGenPanel, AssetListView, LookDetailDialog, TraitsDialog, type AssetTab } from "./index";

let latest: DramaCanvasDoc | null = null;
let updateDoc: ((fn: (d: DramaCanvasDoc) => DramaCanvasDoc) => void) | null = null;
function Probe() {
  const v = useCanvasDoc();
  latest = v.doc;
  updateDoc = v.update;
  return null;
}

function Harness({ children }: { children: React.ReactNode }) {
  return (
    <CanvasDocProvider canvasId={EXAMPLE}>
      <CanvasRunsProvider>
        <CanvasGate>{children}</CanvasGate>
        <Probe />
      </CanvasRunsProvider>
    </CanvasDocProvider>
  );
}

function runOf(over: Partial<DramaCanvasRun>): DramaCanvasRun {
  return { id: "r_x", canvasId: EXAMPLE, kind: "image", target: "look:x", status: "queued", cost: 0, createdAt: "2026-09-30T01:00:00.000Z", ...over };
}

function setNarrow(on: boolean) {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: on
      ? (q: string) => ({ matches: true, media: q, addEventListener: () => {}, removeEventListener: () => {}, onchange: null })
      : undefined,
  });
}

async function renderList(tab: AssetTab = "characters", onLocate = vi.fn()) {
  const utils = render(
    <Harness>
      <AssetListView tab={tab} onTabChange={() => {}} onLocate={onLocate} />
    </Harness>,
  );
  await screen.findByRole("heading", { name: "角色和场景" });
  return { ...utils, onLocate };
}

beforeEach(() => {
  __resetMockCanvasForTest();
  __resetAssetGenPanelForTest();
  forcedSubmitting.clear();
  latest = null;
  updateDoc = null;
  for (const f of Object.values(api)) f.mockReset();
  confirm.mockReset();
  confirm.mockResolvedValue(true);
  api.signAssets.mockResolvedValue({ urls: {} });
  setNarrow(false);
});
afterEach(() => {
  cleanup();
  setNarrow(false);
});

describe("接线", () => {
  it("assets 页按 view 切换：画布用 dynamic(ssr:false) 懒加载 board-view，列表用 AssetListView；切换放在顶栏右侧插槽", () => {
    const src = readFileSync(resolve(__dirname, "../../app/(workspace)/canvas/[canvasId]/assets/page.tsx"), "utf8");
    expect(src).toMatch(/dynamic\(\(\) => import\("@\/canvas\/board\/board-view"\)/);
    expect(src).toMatch(/ssr: false/);
    expect(src).toMatch(/<BoardView focus=\{focus\} \/>/);
    expect(src).toMatch(/<AssetListView/);
    expect(src).toMatch(/<CanvasTopbarSlot slot="right">/);
    expect(src).toMatch(/!narrow && params\?\.get\("view"\) === "board"/);
  });

  it("@/canvas/assets 导出画布要复用的两个共享组件", () => {
    expect(typeof Assets.AssetGenPanel).toBe("function");
    expect(typeof Assets.LookDetailDialog).toBe("function");
  });
});

describe("列表", () => {
  it("示例画布：3 个角色卡、3 个场景卡、2 个素材卡；没图的场景显示占位", async () => {
    const { unmount } = await renderList("characters");
    expect(screen.getAllByRole("button", { name: /^打开「/ })).toHaveLength(3);
    unmount();
    await renderList("scenes");
    expect(screen.getAllByRole("button", { name: /^打开「/ })).toHaveLength(3);
    expect(within(screen.getByRole("button", { name: "打开「终点站站台」" })).getByText("待生成")).toBeTruthy();
    cleanup();
    await renderList("materials");
    expect(screen.getAllByRole("button", { name: /^打开(文字|素材图)「/ })).toHaveLength(2);
  });

  it("失败原因如实显示在角色卡上（「便装」上次出图失败，接回运行记录后显示服务端给的原因）", async () => {
    await renderList();
    const card = screen.getByRole("button", { name: "打开「周岳」" });
    await waitFor(() => expect(within(card).getByText(/出图服务这次没有回应/)).toBeTruthy());
  });

  it("按集过滤：只看第 1 集时没有「终点站站台」", async () => {
    await renderList("scenes");
    fireEvent.change(screen.getByLabelText("只看出现在某一集的"), { target: { value: "1" } });
    expect(screen.queryByRole("button", { name: "打开「终点站站台」" })).toBeNull();
    expect(screen.getAllByRole("button", { name: /^打开「/ })).toHaveLength(2);
  });

  it("桌面上点角色卡：交给页面切到画布并定位到这个角色", async () => {
    const { onLocate } = await renderList();
    fireEvent.click(screen.getByRole("button", { name: "打开「沈念」" }));
    expect(onLocate).toHaveBeenCalledWith("character:ch_ex_shennian");
  });

  it("手机上点角色卡：打开抽屉，里面是这个造型的出图面板（切到「便装」能看到失败原因）", async () => {
    setNarrow(true);
    const { onLocate } = await renderList();
    fireEvent.click(screen.getByRole("button", { name: "打开「周岳」" }));
    expect(onLocate).not.toHaveBeenCalled();
    const drawer = await screen.findByRole("dialog", { name: "角色" });
    expect(within(drawer).getByLabelText("外貌描述")).toBeTruthy();
    fireEvent.click(within(drawer).getByRole("tab", { name: "便装" }));
    await waitFor(() => expect(within(drawer).getByRole("alert").textContent).toMatch(/出图服务这次没有回应/));
  });

  it("带着 focus=look:<id> 停在列表上（手机打开了画布链接）：打开这个造型所在角色的抽屉并选中它", async () => {
    setNarrow(true);
    render(
      <Harness>
        <AssetListView tab="characters" onTabChange={() => {}} focus="look:lk_ex_zhouyue_casual" />
      </Harness>,
    );
    const drawer = await screen.findByRole("dialog", { name: "角色" });
    expect(within(drawer).getByRole("tab", { name: "便装" }).getAttribute("aria-selected")).toBe("true");
  });

  it("多选：按钮上的总价来自 pricing（单价 × 个数），先确认再按 image-batch 提交", async () => {
    api.runImageBatch.mockImplementation(async (_id: string, body: CanvasImageBatchBody) =>
      body.items.map((it, i) => runOf({ id: `r_b${i}`, target: `look:${(it.target as { id: string }).id}` })),
    );
    await renderList();
    fireEvent.click(screen.getByRole("button", { name: "多选" }));
    fireEvent.click(screen.getByRole("button", { name: "选中「周岳」的全部造型" }));
    fireEvent.click(screen.getByRole("button", { name: "选中「沈念」的全部造型" }));
    const go = screen.getByRole("button", { name: /为选中的 3 个出图/ });
    expect(go.textContent).toContain(String(7 * 3));
    await act(async () => {
      fireEvent.click(go);
    });
    await waitFor(() => expect(api.runImageBatch).toHaveBeenCalledTimes(1));
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(confirm.mock.calls[0][0]).toMatchObject({ cost: 21 });
    const [id, body] = api.runImageBatch.mock.calls[0] as [string, CanvasImageBatchBody];
    expect(id).toBe(EXAMPLE);
    expect(body.items).toEqual([
      { target: { kind: "look", id: "lk_ex_zhouyue" }, count: 1 },
      { target: { kind: "look", id: "lk_ex_zhouyue_casual" }, count: 1 },
      { target: { kind: "look", id: "lk_ex_shennian" }, count: 1 },
    ]);
    expect(body.docVersion).toBeTruthy();
    expect(body.clientRequestId).toBeTruthy();
  });

  it("多选超过 20 个（服务端上限）：批量按钮禁用并就地说原因，不截断、不提交", async () => {
    await renderList("scenes");
    act(() =>
      updateDoc!((d) => ({
        ...d,
        scenes: [
          ...d.scenes,
          ...Array.from({ length: 18 }, (_, i) => ({ id: `sc_t${i}`, name: `场景 ${i}`, prompt: "白天的街道", episodes: [1], images: { versions: [] } })),
        ],
      })),
    );
    fireEvent.click(screen.getByRole("button", { name: "多选" }));
    fireEvent.click(screen.getByRole("button", { name: "全选这一页" }));
    const go = screen.getByRole("button", { name: /为选中的 21 个出图/ }) as HTMLButtonElement;
    expect(go.disabled).toBe(true);
    expect(screen.getByText("一次最多 20 个，先取消几个。")).toBeTruthy();
    // 取消一个就能提交
    fireEvent.click(screen.getByRole("button", { name: "选中「场景 0」" }));
    expect((screen.getByRole("button", { name: /为选中的 20 个出图/ }) as HTMLButtonElement).disabled).toBe(false);
    expect(api.runImageBatch).not.toHaveBeenCalled();
  });

  it("提交中（请求还没回来）也算生成中：卡片显示生成中，批量出图跳过它", async () => {
    forcedSubmitting.add("look:lk_ex_shennian");
    await renderList();
    const card = screen.getByRole("button", { name: "打开「沈念」" });
    expect(within(card).getByRole("status").textContent).toMatch(/生成中/);
    fireEvent.click(screen.getByRole("button", { name: "多选" }));
    fireEvent.click(screen.getByRole("button", { name: "选中「沈念」的全部造型" }));
    expect((screen.getByRole("button", { name: /为选中的出图/ }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("多选后取消确认：不提交", async () => {
    confirm.mockResolvedValue(false);
    await renderList("scenes");
    fireEvent.click(screen.getByRole("button", { name: "多选" }));
    fireEvent.click(screen.getByRole("button", { name: "选中「23 路末班车车厢」" }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /为选中的 1 个出图/ }));
    });
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(api.runImageBatch).not.toHaveBeenCalled();
  });
});

describe("出图面板", () => {
  async function renderPanel(onReferenceAdded = vi.fn()) {
    const utils = render(
      <Harness>
        <AssetGenPanel target={{ kind: "look", id: "lk_ex_shennian" }} variant="inline" onReferenceAdded={onReferenceAdded} />
      </Harness>,
    );
    await screen.findByLabelText("外貌描述");
    return { ...utils, onReferenceAdded };
  }

  it("生成：按选的张数 / 画幅 / 模型提交 image，按钮上的价格来自 pricing", async () => {
    api.runImage.mockImplementation(async () => runOf({ id: "r_1", target: "look:lk_ex_shennian" }));
    const { container } = await renderPanel();
    fireEvent.click(within(screen.getByRole("group", { name: "出几张" })).getByRole("button", { name: "2" }));
    fireEvent.change(screen.getByLabelText("画幅"), { target: { value: "3:4" } });
    fireEvent.change(screen.getByLabelText("出图模型"), { target: { value: "img-b" } });
    const gen = container.querySelector<HTMLButtonElement>(".cva-gen")!;
    expect(gen.textContent).toContain("22");
    await act(async () => {
      fireEvent.click(gen);
    });
    await waitFor(() => expect(api.runImage).toHaveBeenCalledTimes(1));
    expect(confirm).not.toHaveBeenCalled(); // 22 < confirmThreshold
    const [id, body] = api.runImage.mock.calls[0] as [string, CanvasImageRunBody];
    expect(id).toBe(EXAMPLE);
    expect(body).toMatchObject({ target: { kind: "look", id: "lk_ex_shennian" }, count: 2, ratio: "3:4", endpointId: "img-b" });
    expect(body.docVersion).toBeTruthy();
  });

  it("这个目标正在提交：生成按钮禁用并就地说原因，不发请求", async () => {
    forcedSubmitting.add("look:lk_ex_shennian");
    const { container } = await renderPanel();
    const gen = container.querySelector<HTMLButtonElement>(".cva-gen")!;
    expect(gen.disabled).toBe(true);
    expect(screen.getByText("正在生成，等这次出完再生成。")).toBeTruthy();
    fireEvent.click(gen);
    expect(api.runImage).not.toHaveBeenCalled();
  });

  it("造型的画幅缺省 9:16，模型缺省是默认模型", async () => {
    api.runImage.mockImplementation(async () => runOf({ id: "r_2", target: "look:lk_ex_shennian" }));
    const { container } = await renderPanel();
    expect((screen.getByLabelText("画幅") as HTMLSelectElement).value).toBe("9:16");
    await act(async () => {
      fireEvent.click(container.querySelector<HTMLButtonElement>(".cva-gen")!);
    });
    await waitFor(() => expect(api.runImage).toHaveBeenCalledTimes(1));
    expect(api.runImage.mock.calls[0][1]).toMatchObject({ count: 1, ratio: "9:16", endpointId: "img-a" });
  });

  it("上传参考：多一张素材图和一条 素材图 → 造型 的连线，回调新素材 id", async () => {
    api.uploadImage.mockResolvedValue({ key: "mock/up/ref-1.png", url: "blob:ref-1" });
    const { onReferenceAdded } = await renderPanel();
    const before = latest!.board.edges.length;
    const file = new File(["x"], "旧照片.png", { type: "image/png" });
    await act(async () => {
      fireEvent.change(screen.getByLabelText("上传参考图"), { target: { files: [file] } });
    });
    await waitFor(() => expect(onReferenceAdded).toHaveBeenCalledTimes(1));
    const mid = onReferenceAdded.mock.calls[0][0] as string;
    expect(api.uploadImage.mock.calls[0][1]).toBe("人物");
    expect(latest!.board.edges).toHaveLength(before + 1);
    expect(latest!.board.edges.at(-1)).toMatchObject({ source: mid, target: "lk_ex_shennian" });
    expect(latest!.materials.find((m) => m.id === mid)).toMatchObject({ kind: "image", name: "旧照片", images: { versions: [{ key: "mock/up/ref-1.png" }] } });
  });

  it("断开参考：× 去掉那条线", async () => {
    render(
      <Harness>
        <AssetGenPanel target={{ kind: "scene", id: "sc_ex_bus" }} variant="docked" />
      </Harness>,
    );
    await screen.findByLabelText("场景描述");
    // docked 压扁版：上传参考、已连的参考、候选图在同一行横排里
    const strip = document.querySelector(".cva-panel-docked .cva-strip")!;
    expect(strip).not.toBeNull();
    expect(within(strip as HTMLElement).getByRole("button", { name: /上传参考/ })).toBeTruthy();
    expect(within(strip as HTMLElement).getByRole("list", { name: "候选图" })).toBeTruthy();
    expect(latest!.board.edges.some((e) => e.id === "ed_ex_1")).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "断开「全剧色调」" }));
    expect(latest!.board.edges.some((e) => e.id === "ed_ex_1")).toBe(false);
  });

  it("挑候选图：点另一张 = 用这张", async () => {
    render(
      <Harness>
        <AssetGenPanel target={{ kind: "look", id: "lk_ex_zhouyue" }} variant="inline" />
      </Harness>,
    );
    await screen.findByLabelText("外貌描述");
    const cands = within(screen.getByRole("list", { name: "候选图" })).getAllByRole("listitem");
    expect(cands).toHaveLength(2);
    fireEvent.click(cands[1]);
    const look = latest!.characters[0].looks[0];
    expect(look.images.pickedKey).toBe(look.images.versions[1].key);
  });
});

describe("角色设计 / 造型详情", () => {
  it("角色设计：读回旧勾选、改一个、写进描述（替换 / 追加那一行，别的段落不动）", async () => {
    render(
      <Harness>
        <TraitsDialog lookId="lk_ex_zhouyue" open onClose={() => {}} />
      </Harness>,
    );
    const dialog = await screen.findByRole("dialog", { name: "角色设计" });
    const before = latest!.characters[0].looks[0].prompt;
    expect(within(dialog).getByRole("button", { name: "男性" }).getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(within(dialog).getByRole("button", { name: "女性" }));
    fireEvent.click(within(dialog).getByRole("button", { name: "写进描述" }));
    const look = latest!.characters[0].looks[0];
    expect(look.traits).toMatchObject({ 性别表达: ["女性"], 年龄: ["36–45"] });
    expect(look.prompt.startsWith(`${before}\n角色设计：女性，36–45 岁`)).toBe(true);
  });

  it("造型详情：挂到别的角色，原角色没造型了先确认再删", async () => {
    render(
      <Harness>
        <LookDetailDialog lookId="lk_ex_laowu" open onClose={() => {}} />
      </Harness>,
    );
    const dialog = await screen.findByRole("dialog", { name: "造型详情" });
    await act(async () => {
      fireEvent.change(within(dialog).getByLabelText("属于哪个角色"), { target: { value: "ch_ex_zhouyue" } });
    });
    await waitFor(() => expect(latest!.characters.some((c) => c.id === "ch_ex_laowu")).toBe(false));
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(confirm.mock.calls[0][0]).toMatchObject({ tone: "danger" });
    expect(latest!.characters.find((c) => c.id === "ch_ex_zhouyue")?.looks.map((l) => l.id)).toContain("lk_ex_laowu");
  });
});
