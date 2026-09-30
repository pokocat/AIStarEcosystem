import * as React from "react";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, waitFor } from "@testing-library/react";
import type { SaveDramaCanvasBody } from "@ai-star-eco/types/drama-canvas";

// §8.0.1 ⑥：写完没人挂的东西编译器不会告诉你。这里真把 BoardView 渲染出来（mock 示例画布「末班车」），
// 钉住：卡片数量对、focus 真的选中了对应节点并停出出图面板、没位置的节点排完写回了文档。
// 断结构（节点 id / class / 保存的请求体），不断界面文案（§8.0.1 ⑩）。

const EXAMPLE = "dcv_example_night_bus";

const saves = vi.hoisted(() => [] as SaveDramaCanvasBody[]);
vi.mock("@/api/canvas", async () => {
  const { mockCanvasServer } = await import("@/mocks/canvas");
  return {
    CanvasApi: {
      get: (id: string) => mockCanvasServer.get(id),
      save: (id: string, body: SaveDramaCanvasBody) => {
        saves.push(body);
        return mockCanvasServer.save(id, body);
      },
      getRuns: (id: string, ids: string[]) => mockCanvasServer.getRuns(id, ids),
      cancelRun: (id: string, runId: string) => mockCanvasServer.cancelRun(id, runId),
      signAssets: (id: string, keys: string[]) => mockCanvasServer.signAssets(id, { keys }),
      uploadImage: vi.fn(),
    },
  };
});
// 出图面板 / 造型详情是 assets 块的，这里只看画布有没有在对的时候挂上它们（换成空壳，其余纯函数用真的）
vi.mock("@/canvas/assets", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/canvas/assets")>()),
  AssetGenPanel: (p: { target: { kind: string; id: string }; variant: string }) => (
    <div data-testid="gen-panel" data-target={`${p.target.kind}:${p.target.id}`} data-variant={p.variant} />
  ),
  LookDetailDialog: (p: { lookId: string; open: boolean }) => (p.open ? <div data-testid="look-detail" data-look={p.lookId} /> : null),
}));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock("@/lib/toast", () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }));
vi.mock("@/lib/use-wallet", () => ({ notifyWalletChanged: vi.fn() }));

import { __resetMockCanvasForTest } from "@/mocks/canvas";
import { CanvasDocProvider, CanvasRunsProvider } from "@/canvas/core";
import BoardView from "./board-view";
import { viewportStorageKey } from "./viewport-store";

// React Flow 在 jsdom 里要的几样东西（照 xyflow 官方的测试说明补）：ResizeObserver、DOMMatrixReadOnly、元素尺寸。
class ResizeObserverStub {
  cb: ResizeObserverCallback;
  constructor(cb: ResizeObserverCallback) {
    this.cb = cb;
  }
  observe(target: Element) {
    const el = target as HTMLElement;
    const contentRect = { width: el.offsetWidth, height: el.offsetHeight } as DOMRectReadOnly;
    this.cb([{ target, contentRect } as ResizeObserverEntry], this as unknown as ResizeObserver);
  }
  unobserve() {}
  disconnect() {}
}
class DOMMatrixReadOnlyStub {
  m22: number;
  constructor(transform?: string) {
    const scale = transform?.match(/scale\(([1-9.])\)/)?.[1];
    this.m22 = scale !== undefined ? +scale : 1;
  }
}
/** 内存版 localStorage（Node 25 自带的全局 localStorage 在没配存储文件时不能用，会盖掉 jsdom 的）。 */
function memoryStorage(): Storage {
  const m = new Map<string, string>();
  return {
    get length() {
      return m.size;
    },
    clear: () => m.clear(),
    getItem: (k) => (m.has(k) ? m.get(k)! : null),
    key: (i) => [...m.keys()][i] ?? null,
    removeItem: (k) => void m.delete(k),
    setItem: (k, v) => void m.set(k, String(v)),
  };
}
const saved: { ro?: unknown; dm?: unknown; ow?: PropertyDescriptor; oh?: PropertyDescriptor; ls?: PropertyDescriptor } = {};

beforeAll(() => {
  const g = globalThis as Record<string, unknown>;
  saved.ro = g.ResizeObserver;
  saved.dm = g.DOMMatrixReadOnly;
  saved.ow = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "offsetWidth");
  saved.oh = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "offsetHeight");
  saved.ls = Object.getOwnPropertyDescriptor(window, "localStorage");
  Object.defineProperty(window, "localStorage", { configurable: true, value: memoryStorage() });
  g.ResizeObserver = ResizeObserverStub;
  g.DOMMatrixReadOnly = DOMMatrixReadOnlyStub;
  Object.defineProperties(HTMLElement.prototype, {
    offsetWidth: { configurable: true, get() { return parseFloat((this as HTMLElement).style.width) || 1; } },
    offsetHeight: { configurable: true, get() { return parseFloat((this as HTMLElement).style.height) || 1; } },
  });
});

afterAll(() => {
  const g = globalThis as Record<string, unknown>;
  g.ResizeObserver = saved.ro;
  g.DOMMatrixReadOnly = saved.dm;
  if (saved.ow) Object.defineProperty(HTMLElement.prototype, "offsetWidth", saved.ow);
  if (saved.oh) Object.defineProperty(HTMLElement.prototype, "offsetHeight", saved.oh);
  if (saved.ls) Object.defineProperty(window, "localStorage", saved.ls);
});

beforeEach(() => {
  __resetMockCanvasForTest();
  saves.length = 0;
  window.localStorage.clear();
});

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function renderBoard(focus?: string) {
  return render(
    <div style={{ width: "1200px", height: "800px" }}>
      <CanvasDocProvider canvasId={EXAMPLE}>
        <CanvasRunsProvider>
          <BoardView focus={focus} />
        </CanvasRunsProvider>
      </CanvasDocProvider>
    </div>,
  );
}

const nodeEl = (c: HTMLElement, id: string) => c.querySelector<HTMLElement>(`.react-flow__node[data-id="${id}"]`);

describe("BoardView（mock 示例画布「末班车」）", () => {
  it("每个造型 / 场景 / 素材一张卡，每个角色一个分组、场景一个分组", async () => {
    const { container } = renderBoard();
    await waitFor(() => expect(container.querySelectorAll(".react-flow__node-look")).toHaveLength(4));
    expect(container.querySelectorAll(".react-flow__node-charGroup")).toHaveLength(3);
    expect(container.querySelectorAll(".react-flow__node-sceneGroup")).toHaveLength(1);
    expect(container.querySelectorAll(".react-flow__node-scene")).toHaveLength(3);
    expect(container.querySelectorAll(".react-flow__node-imageMaterial")).toHaveLength(1);
    expect(container.querySelectorAll(".react-flow__node-textMaterial")).toHaveLength(1);
    // 什么都没选：不停出图面板
    expect(container.querySelector('[data-testid="gen-panel"]')).toBeNull();
  });

  it("focus=look:… → 选中那个造型、停出它的出图面板", async () => {
    const { container } = renderBoard("look:lk_ex_zhouyue_casual");
    await waitFor(() => expect(nodeEl(container, "lk_ex_zhouyue_casual")?.classList.contains("selected")).toBe(true));
    expect(nodeEl(container, "lk_ex_zhouyue")?.classList.contains("selected")).toBe(false);
    const panel = container.querySelector('[data-testid="gen-panel"]');
    expect(panel?.getAttribute("data-target")).toBe("look:lk_ex_zhouyue_casual");
    expect(panel?.getAttribute("data-variant")).toBe("docked");
  });

  it("focus=character:… → 选中第一个造型，并高亮这个角色的全部造型", async () => {
    const { container } = renderBoard("character:ch_ex_zhouyue");
    await waitFor(() => expect(nodeEl(container, "lk_ex_zhouyue")?.classList.contains("selected")).toBe(true));
    expect(nodeEl(container, "lk_ex_zhouyue_casual")?.querySelector(".cvb-card.is-highlighted")).not.toBeNull();
    expect(nodeEl(container, "lk_ex_shennian")?.querySelector(".cvb-card.is-highlighted")).toBeNull();
    expect(container.querySelector('[data-testid="gen-panel"]')?.getAttribute("data-target")).toBe("look:lk_ex_zhouyue");
  });

  it("示例画布的位置是空的：打开后自动排版，排完一次写回 board.positions", async () => {
    renderBoard();
    await waitFor(() => expect(saves.length).toBeGreaterThan(0), { timeout: 3000 });
    const pos = saves[saves.length - 1].doc.board.positions;
    for (const id of [
      "group:char:ch_ex_zhouyue",
      "lk_ex_zhouyue",
      "lk_ex_zhouyue_casual",
      "group:scenes",
      "sc_ex_bus",
      "sc_ex_terminal",
      "mt_ex_ticket",
      "mt_ex_tone",
    ]) {
      expect(pos[id], id).toBeDefined();
    }
  });

  it("平移 / 缩放只记在本机，不改文档（不然两个标签页开着时，拖一下画布就让另一边撞 409）", async () => {
    const { container } = renderBoard();
    // 先等打开时的自动排版存完，再清掉打开时 fitView 顺手记下的视口
    await waitFor(() => expect(saves.length).toBeGreaterThan(0), { timeout: 3000 });
    await sleep(1200);
    const before = saves.length;
    window.localStorage.removeItem(viewportStorageKey(EXAMPLE));

    const pane = container.querySelector(".react-flow__pane")!;
    fireEvent.wheel(pane, { deltaY: -240 });
    await waitFor(() => expect(window.localStorage.getItem(viewportStorageKey(EXAMPLE))).not.toBeNull(), { timeout: 3000 });
    // update() 一被调就会在 900ms 后保存；多等一会儿确认没有
    await sleep(1300);
    expect(saves.length).toBe(before);
    const stored = JSON.parse(window.localStorage.getItem(viewportStorageKey(EXAMPLE))!);
    expect(stored).toEqual({ x: expect.any(Number), y: expect.any(Number), zoom: expect.any(Number) });
  }, 10000);

  it("进页先用本机记下的视口", async () => {
    window.localStorage.setItem(viewportStorageKey(EXAMPLE), JSON.stringify({ x: 123, y: 45, zoom: 0.8 }));
    const { container } = renderBoard();
    await waitFor(() => expect(container.querySelectorAll(".react-flow__node-look")).toHaveLength(4));
    await sleep(100);
    const vp = container.querySelector<HTMLElement>(".react-flow__viewport")!;
    expect(vp.style.transform.replace(/\s+/g, "")).toBe("translate(123px,45px)scale(0.8)");
  });
});
