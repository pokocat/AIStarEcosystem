import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { DramaCanvasDoc, SaveDramaCanvasBody } from "@ai-star-eco/types/drama-canvas";

// 结构测试（§8.0.1 ⑥）：用 mock 的「示例：末班车」把逐集列表和第 1 集编辑器真渲染出来，钉住接线与状态。
// 只断结构（data-* / 调了哪个接口 / 文档里的值），不断界面文案（§8.0.1 ⑩）。

const EX = "dcv_example_night_bus";

vi.mock("@/api/canvas", async () => {
  const { mockCanvasServer: s } = await import("@/mocks/canvas");
  return {
    CanvasApi: {
      list: vi.fn(() => s.list()),
      get: vi.fn((id: string) => s.get(id)),
      create: vi.fn(),
      save: vi.fn((id: string, b: SaveDramaCanvasBody) => s.save(id, b)),
      remove: vi.fn(),
      splitScript: vi.fn(),
      signAssets: vi.fn((id: string, keys: string[]) => s.signAssets(id, { keys })),
      runScript: vi.fn((id: string, b: never) => s.runScript(id, b)),
      runExtract: vi.fn((id: string, b: never) => s.runExtract(id, b)),
      runImage: vi.fn((id: string, b: never) => s.runImage(id, b)),
      runImageBatch: vi.fn((id: string, b: never) => s.runImageBatch(id, b)),
      runStoryboard: vi.fn((id: string, b: never) => s.runStoryboard(id, b)),
      runVideo: vi.fn((id: string, b: never) => s.runVideo(id, b)),
      runAssemble: vi.fn((id: string, b: never) => s.runAssemble(id, b)),
      getRuns: vi.fn((id: string, ids: string[]) => s.getRuns(id, ids)),
      cancelRun: vi.fn((id: string, runId: string) => s.cancelRun(id, runId)),
      uploadImage: vi.fn(),
    },
  };
});
vi.mock("@/api/render", async (orig) => {
  const { MOCK_CANVAS_RENDER_MODELS } = await import("@/mocks/canvas");
  return { ...(await orig<typeof import("@/api/render")>()), listRenderModels: vi.fn(async () => MOCK_CANVAS_RENDER_MODELS) };
});
vi.mock("@/api/drama-config", async (orig) => {
  const real = await orig<typeof import("@/api/drama-config")>();
  return { ...real, getDramaConfig: vi.fn(async () => real.DRAMA_CONFIG_DEFAULTS) };
});
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode } & Record<string, unknown>) => (
    <a href={href} {...(rest as React.AnchorHTMLAttributes<HTMLAnchorElement>)}>
      {children}
    </a>
  ),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  usePathname: () => `/canvas/${EX}/episodes`,
}));
vi.mock("@/lib/use-wallet", () => ({ useWallet: () => ({ wallet: null, refresh: vi.fn() }), notifyWalletChanged: vi.fn() }));
vi.mock("@/lib/toast", () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }));
const confirmMock = vi.hoisted(() => vi.fn(async () => true));
vi.mock("@/components/drama-ui/confirm-dialog", () => ({ dramaConfirm: confirmMock, DramaConfirmHost: () => null, DramaConfirmDialog: () => null }));

import { CanvasApi } from "@/api/canvas";
import { listRenderModels } from "@/api/render";
import { __resetCanvasPricingForTest } from "@/canvas/core/use-canvas-pricing";
import { __resetMockCanvasForTest } from "@/mocks/canvas";
import { CanvasDocProvider, CanvasRunsProvider, findSegment, updateSegment, useCanvasDoc } from "@/canvas/core";
import { CanvasGate } from "@/canvas/shell/canvas-gate";
import { CanvasTopbar, CanvasTopbarSlotProvider } from "@/canvas/shell/canvas-topbar";
import { EpisodeEditor, EpisodeListView } from "./index";
import { SegmentTextEditor, type SegmentTextEditorHandle } from "./segment-text-editor";
import { RefPicker } from "./ref-picker";
import { RunLine } from "./preview-panel";
import type { EpisodeAssetItem } from "./derive";

function Harness({ children }: { children: React.ReactNode }) {
  return (
    <CanvasDocProvider canvasId={EX}>
      <CanvasRunsProvider>
        <CanvasTopbarSlotProvider>
          <CanvasGate>
            <CanvasTopbar />
            {children}
          </CanvasGate>
        </CanvasTopbarSlotProvider>
      </CanvasRunsProvider>
    </CanvasDocProvider>
  );
}

/** 价格和视频模型读到了：顶栏的视频模型下拉只在读到之后才出现（读到之前是「视频模型读取中…」）。 */
async function pricingLoaded() {
  await waitFor(() => expect(document.querySelector('[data-action="video-model"]')).not.toBeNull());
}

const RUN_APIS = ["runImage", "runImageBatch", "runVideo", "runStoryboard", "runAssemble", "runScript", "runExtract"] as const;

beforeEach(() => {
  // 上一条用例存下的「这张画布选的视频 / 出图模型」在 localStorage 里；__resetCanvasPricingForTest 只清内存
  // （它模拟的是刷新页面，刷新后本来就该读回 localStorage），所以这里另清。不清的话，换过模型的用例之后
  // 的用例在 CI（Node 22，jsdom 真 Storage）上读到的是换过的模型（v0.198.1 后 main 上 frontend-tests 一直红）。
  window.localStorage.clear();
  __resetMockCanvasForTest();
  __resetCanvasPricingForTest(); // 视频 / 出图模型的选择是模块级的：每条用例从默认模型开始
  vi.mocked(CanvasApi.save).mockClear();
  for (const k of RUN_APIS) vi.mocked(CanvasApi[k]).mockClear();
  vi.mocked(CanvasApi.cancelRun).mockClear();
  confirmMock.mockClear();
});
afterEach(() => cleanup());

describe("逐集制作 · 示例画布", () => {
  it("两张卡：第 1 集片段 2/3（03 在排队），第 2 集还没有分镜脚本、有「生成分镜脚本」", async () => {
    render(
      <Harness>
        <EpisodeListView />
      </Harness>,
    );
    const list = await screen.findByTestId("cve-episode-list");
    const cards = [...list.querySelectorAll<HTMLElement>("[data-episode]")];
    expect(cards.map((c) => [c.dataset.episode, c.dataset.state])).toEqual([
      ["1", "in-progress"],
      ["2", "no-storyboard"],
    ]);
    expect(cards[0].querySelector('[data-action="storyboard"]')).toBeNull();
    expect(cards[0].querySelector('[data-action="edit"]')?.getAttribute("href")).toBe(`/canvas/${EX}/episodes/1`);
    expect(cards[0].querySelector('[data-action="preview"]')).toBeNull(); // 还没有成片
    const sb = cards[1].querySelector<HTMLButtonElement>('[data-action="storyboard"]')!;
    expect(sb).not.toBeNull();
    expect(sb.disabled).toBe(false);
    expect(sb.querySelector(".cve-credits")).not.toBeNull(); // 花钱的按钮带价格
    expect(cards[1].querySelector('[data-action="edit"]')).not.toBeNull();
  });

  it("生成分镜脚本：先存再发，带上当前视频模型的片段上下限；这一集没有片段、价格没到门槛就不弹确认", async () => {
    render(
      <Harness>
        <EpisodeListView />
      </Harness>,
    );
    const list = await screen.findByTestId("cve-episode-list");
    // 等价格和视频模型读到再点：没读到时一律弹确认、片段上下限也还是缺省值（机器一忙就点在它前面）
    await waitFor(() => expect(list.querySelector('[data-pending="price"]')).toBeNull());
    const sb = list.querySelector<HTMLButtonElement>('[data-episode="2"] [data-action="storyboard"]')!;
    await act(async () => {
      fireEvent.click(sb);
    });
    await waitFor(() => expect(CanvasApi.runStoryboard).toHaveBeenCalledTimes(1));
    const [id, body] = vi.mocked(CanvasApi.runStoryboard).mock.calls[0] as unknown as [
      string,
      { episodeNo: number; maxSegmentSec: number; minSegmentSec: number; docVersion: string },
    ];
    expect(id).toBe(EX);
    // 片段时长范围 = 所选视频模型（mock 的默认视频模型 5–10 秒）
    expect(body).toMatchObject({ episodeNo: 2, maxSegmentSec: 10, minSegmentSec: 5 });
    expect(body.docVersion).toBeTruthy();
    expect(confirmMock).not.toHaveBeenCalled();
  });
});

describe("单集编辑器 · 示例画布第 1 集", () => {
  async function mountEditor() {
    render(
      <Harness>
        <EpisodeEditor no={1} />
      </Harness>,
    );
    await screen.findByTestId("cve-editor");
    // 等运行记录接回（02 的 refs.notes、03 的排队状态都来自它）
    await waitFor(() => expect(CanvasApi.getRuns).toHaveBeenCalled());
    await pricingLoaded();
    return screen.getByTestId("cve-timeline");
  }

  it("3 个片段格：01 有视频、02 有视频、03 生成中（排队）；顶栏有面包屑", async () => {
    const tl = await mountEditor();
    const cells = [...tl.querySelectorAll<HTMLElement>(".cve-cell")];
    expect(cells.map((c) => [c.dataset.segment, c.dataset.state])).toEqual([
      ["sg_ex1_01", "video"],
      ["sg_ex1_02", "video"],
      ["sg_ex1_03", "running"],
    ]);
    expect(tl.querySelectorAll('[data-action="insert-segment"]')).toHaveLength(4);
    expect(document.querySelector(`.cv-topbar a[href="/canvas/${EX}/episodes"]`)).not.toBeNull();
    // 引用在只读排版里是标签
    expect(screen.getByTestId("cve-text-view").querySelectorAll(".cve-chip").length).toBeGreaterThan(0);
  });

  it("02 有两个版本（「用这版」在第二版上可点），跑完的 refs.notes 如实写出来", async () => {
    const tl = await mountEditor();
    fireEvent.click(tl.querySelector('[data-segment="sg_ex1_02"]')!);
    const preview = screen.getByTestId("cve-preview");
    expect(preview.dataset.segment).toBe("sg_ex1_02");
    const nav = preview.querySelector<HTMLElement>("[data-versions]")!;
    expect(nav.dataset.versions).toBe("2");
    expect(nav.querySelector<HTMLButtonElement>('[data-action="pick-version"]')!.disabled).toBe(true); // 正在看的就是挑中的那版
    fireEvent.click(nav.querySelector('[aria-label="下一版"]')!);
    expect(nav.querySelector<HTMLButtonElement>('[data-action="pick-version"]')!.disabled).toBe(false);
    await waitFor(() => expect(screen.getByTestId("cve-preview").querySelector('[data-run="视频"][data-status="succeeded"]')).not.toBeNull());
  });

  it("03 排队中可以停止（调 cancel，不是再发一次生成）", async () => {
    const tl = await mountEditor();
    fireEvent.click(tl.querySelector('[data-segment="sg_ex1_03"]')!);
    const stop = await waitFor(() => {
      const el = screen.getByTestId("cve-preview").querySelector<HTMLButtonElement>('[data-action="cancel-video"]');
      expect(el).not.toBeNull();
      return el!;
    });
    expect(screen.getByTestId("cve-preview").querySelector<HTMLButtonElement>('[data-action="video"]')!.disabled).toBe(true);
    await act(async () => {
      fireEvent.click(stop);
    });
    await waitFor(() => expect(CanvasApi.cancelRun).toHaveBeenCalledWith(EX, "dcr_ex_v3"));
    for (const k of RUN_APIS) expect(CanvasApi[k]).not.toHaveBeenCalled();
  });

  it("合成成片禁用，并就地写着还差几个片段", async () => {
    await mountEditor();
    const btn = document.querySelector<HTMLButtonElement>('.cv-topbar [data-action="assemble"]')!;
    expect(btn).not.toBeNull();
    expect(btn.disabled).toBe(true);
    expect(document.querySelector<HTMLElement>('.cv-topbar [data-reason="assemble"]')?.dataset.missing).toBe("1");
  });

  it("「用上一片段最后一帧」只改文档（首帧换成 02 挑中那版的末帧），不调任何生成接口", async () => {
    const tl = await mountEditor();
    fireEvent.click(tl.querySelector('[data-segment="sg_ex1_03"]')!);
    const btn = screen.getByTestId("cve-preview").querySelector<HTMLButtonElement>('[data-action="last-frame"]')!;
    expect(btn.disabled).toBe(false);
    fireEvent.click(btn);
    await waitFor(
      () => {
        const calls = vi.mocked(CanvasApi.save).mock.calls;
        expect(calls.length).toBeGreaterThan(0);
        const doc = (calls[calls.length - 1][1] as SaveDramaCanvasBody).doc as DramaCanvasDoc;
        expect(findSegment(doc, 1, "sg_ex1_03")?.frame.pickedKey).toBe("mock/canvas/ex/ep1-seg2-last-b.png");
      },
      { timeout: 4000 },
    );
    for (const k of RUN_APIS) expect(CanvasApi[k]).not.toHaveBeenCalled();
    expect(screen.getByTestId("cve-preview").querySelector<HTMLButtonElement>('[data-action="last-frame"]')!.disabled).toBe(true);
  });

  it("首帧还在出时点「生成视频」：就地提示，并且一定弹确认（写清不会等正在出的那张），确认了照样发", async () => {
    await mountEditor();
    const preview = () => screen.getByTestId("cve-preview");
    await act(async () => {
      fireEvent.click(preview().querySelector('[data-action="frame"]')!); // ✦2 < 门槛，不弹确认
    });
    await waitFor(() => expect(CanvasApi.runImage).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(preview().querySelector('[data-reason="video-frame-pending"]')).not.toBeNull());
    const videoBtn = preview().querySelector<HTMLButtonElement>('[data-action="video"]')!;
    expect(videoBtn.disabled).toBe(false);
    confirmMock.mockClear();
    await act(async () => {
      fireEvent.click(videoBtn);
    });
    await waitFor(() => expect(confirmMock).toHaveBeenCalledTimes(1));
    expect((confirmMock.mock.calls[0] as unknown as [{ confirmLabel?: string }])[0].confirmLabel).toBe("仍然生成");
    await waitFor(() => expect(CanvasApi.runVideo).toHaveBeenCalledTimes(1));
  });

  it("请求发出、运行记录还没回来时（提交中）按钮就灰掉，连点也只发一次", async () => {
    await mountEditor();
    let release: () => void = () => {};
    const { mockCanvasServer } = await import("@/mocks/canvas");
    vi.mocked(CanvasApi.runImage).mockImplementationOnce(
      (id: string, b: never) => new Promise((resolve) => (release = () => resolve(mockCanvasServer.runImage(id, b)))),
    );
    const preview = () => screen.getByTestId("cve-preview");
    const btn = preview().querySelector<HTMLButtonElement>('[data-action="frame"]')!;
    await act(async () => {
      fireEvent.click(btn);
    });
    await waitFor(() => expect(CanvasApi.runImage).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(preview().querySelector<HTMLButtonElement>('[data-action="frame"]')!.disabled).toBe(true));
    expect(preview().querySelector('[data-run="首帧"][data-status="submitting"]')).not.toBeNull();
    await act(async () => {
      fireEvent.click(preview().querySelector('[data-action="frame"]')!);
    });
    expect(CanvasApi.runImage).toHaveBeenCalledTimes(1);
    await act(async () => {
      release();
    });
  });

  it("批量生成视频走 submitSequence：进行中排在后面的片段「生成视频」是禁用的，整批每个只发一次", async () => {
    const tl = await mountEditor();
    const { mockCanvasServer } = await import("@/mocks/canvas");
    let release: () => void = () => {};
    vi.mocked(CanvasApi.runVideo).mockImplementationOnce(
      (id: string, b: never) => new Promise((resolve) => (release = () => resolve(mockCanvasServer.runVideo(id, b)))),
    );
    // 先看 02 的预览，再多选 01、02（03 在排队，批量自己会跳过）
    fireEvent.click(tl.querySelector('[data-segment="sg_ex1_02"]')!);
    expect(screen.getByTestId("cve-preview").querySelector<HTMLButtonElement>('[data-action="video"]')!.disabled).toBe(false);
    fireEvent.click(tl.querySelector('[data-action="multi-segments"]')!);
    fireEvent.click(tl.querySelector('[data-segment="sg_ex1_01"]')!);
    fireEvent.click(tl.querySelector('[data-segment="sg_ex1_02"]')!);
    expect(tl.querySelector<HTMLElement>('[data-action="batch-video"]')!.dataset.count).toBe("2");
    await act(async () => {
      fireEvent.click(tl.querySelector('[data-action="batch-video"]')!);
    });
    await waitFor(() => expect(CanvasApi.runVideo).toHaveBeenCalledTimes(1)); // 01 发出去了，还没回来
    // 02 还没轮到，但已经登记为提交中：预览里不能再单独点一次
    await waitFor(() => expect(screen.getByTestId("cve-preview").querySelector<HTMLButtonElement>('[data-action="video"]')!.disabled).toBe(true));
    expect(tl.querySelector<HTMLElement>('[data-segment="sg_ex1_02"]')!.dataset.state).toBe("running");
    await act(async () => {
      release();
    });
    await waitFor(() => expect(CanvasApi.runVideo).toHaveBeenCalledTimes(2));
    const ids = vi.mocked(CanvasApi.runVideo).mock.calls.map((c) => (c[1] as unknown as { segmentId: string }).segmentId);
    expect(ids).toEqual(["sg_ex1_01", "sg_ex1_02"]);
  });

  it("01 是第一个片段：「用上一片段最后一帧」禁用并就地说原因", async () => {
    await mountEditor();
    const preview = screen.getByTestId("cve-preview");
    expect(preview.dataset.segment).toBe("sg_ex1_01");
    expect(preview.querySelector<HTMLButtonElement>('[data-action="last-frame"]')!.disabled).toBe(true);
    expect(preview.querySelector('[data-reason="last-frame"]')).not.toBeNull();
  });
});

describe("单集编辑器 · 出图模型与片段时长（v0.198.1）", () => {
  let edit: ((fn: (d: DramaCanvasDoc) => DramaCanvasDoc) => void) | null = null;
  function DocProbe() {
    edit = useCanvasDoc().update;
    return null;
  }
  async function mountEditor() {
    render(
      <Harness>
        <EpisodeEditor no={1} />
        <DocProbe />
      </Harness>,
    );
    await screen.findByTestId("cve-editor");
    await waitFor(() => expect(CanvasApi.getRuns).toHaveBeenCalled());
    await pricingLoaded();
    return screen.getByTestId("cve-timeline");
  }
  const preview = () => screen.getByTestId("cve-preview");

  it("「出首帧」旁边写着用哪个出图模型、就地能换；价格跟着变，请求带上选的模型", async () => {
    await mountEditor();
    const sel = await waitFor(() => {
      const el = preview().querySelector<HTMLSelectElement>('[data-action="frame-model"]');
      expect(el).not.toBeNull();
      return el!;
    });
    expect(sel.value).toBe("mock-image-std");
    expect(preview().querySelector('[data-action="frame"] .cve-credits')?.getAttribute("aria-label")).toBe("2 积分");
    fireEvent.change(sel, { target: { value: "mock-image-hd" } });
    await waitFor(() => expect(preview().querySelector('[data-action="frame"] .cve-credits')?.getAttribute("aria-label")).toBe("4 积分"));
    await act(async () => {
      fireEvent.click(preview().querySelector('[data-action="frame"]')!);
    });
    await waitFor(() => expect(CanvasApi.runImage).toHaveBeenCalledTimes(1));
    expect(vi.mocked(CanvasApi.runImage).mock.calls[0][1]).toMatchObject({
      target: { kind: "segment", episodeNo: 1, segmentId: "sg_ex1_01" },
      count: 1,
      endpointId: "mock-image-hd",
    });
  });

  it("预览画面高度按视口收：时有时无的几行（版本切换 / 视频时间 / 末帧原因 / 成片条）都标在节点上，CSS 据此让出高度", async () => {
    const tl = await mountEditor();
    const p1 = preview();
    expect(p1.hasAttribute("data-fit-meta")).toBe(true); // 01 在看视频：下面有一行时长和生成时间
    expect(p1.hasAttribute("data-fit-lf")).toBe(true); // 第一个片段：「用上一片段最后一帧」下面有原因
    expect(p1.hasAttribute("data-fit-versions")).toBe(false);
    fireEvent.click(tl.querySelector('[data-segment="sg_ex1_02"]')!);
    expect(preview().hasAttribute("data-fit-versions")).toBe(true); // 02 有两版
    expect(screen.getByTestId("cve-editor").hasAttribute("data-film")).toBe(false); // 还没合成过
    // 「出首帧」和出图模型在同一行（不多占高度）
    expect(preview().querySelector('.cve-frame-row [data-action="frame"]')).not.toBeNull();
    await waitFor(() => expect(preview().querySelector('.cve-frame-row [data-action="frame-model"]')).not.toBeNull()); // 候选读到之后才出现
  });

  it("片段比所选视频模型下限短：「生成视频」禁用并就地说原因，点了也不弹确认、不发请求；换个没有下限的模型就能生成", async () => {
    await mountEditor();
    act(() => edit!((d) => updateSegment(d, 1, "sg_ex1_01", { text: "（3 秒）近景，她回头。" })));
    await waitFor(() => expect(preview().querySelector('[data-reason="video"]')).not.toBeNull());
    const btn = preview().querySelector<HTMLButtonElement>('[data-action="video"]')!;
    expect(btn.disabled).toBe(true);
    expect(screen.getByTestId("cve-segment").querySelector('[data-reason="too-short"]')).not.toBeNull();
    confirmMock.mockClear();
    await act(async () => {
      fireEvent.click(btn);
    });
    expect(confirmMock).not.toHaveBeenCalled();
    expect(CanvasApi.runVideo).not.toHaveBeenCalled();

    const model = document.querySelector<HTMLSelectElement>('.cv-topbar [data-action="video-model"]')!;
    fireEvent.change(model, { target: { value: "mock-video-t2v" } });
    await waitFor(() => expect(preview().querySelector<HTMLButtonElement>('[data-action="video"]')!.disabled).toBe(false));
    expect(preview().querySelector('[data-reason="video"]')).toBeNull();
  });

  it("片段超过上限同样就地禁用（不是弹 160 积分的确认框再被服务端拒）", async () => {
    await mountEditor();
    act(() => edit!((d) => updateSegment(d, 1, "sg_ex1_01", { text: "（8 秒）全景。\n（6 秒）近景。" })));
    await waitFor(() => expect(preview().querySelector<HTMLButtonElement>('[data-action="video"]')!.disabled).toBe(true));
    expect(preview().querySelector('[data-reason="video"]')).not.toBeNull();
  });

  it("多选生成视频：时长越界的片段跳过，就地写清跳过几个；确认框里也写，只发范围内的", async () => {
    const tl = await mountEditor();
    act(() => edit!((d) => updateSegment(d, 1, "sg_ex1_01", { text: "（4 秒）近景，她回头。" })));
    fireEvent.click(tl.querySelector('[data-action="multi-segments"]')!);
    fireEvent.click(tl.querySelector('[data-segment="sg_ex1_01"]')!);
    fireEvent.click(tl.querySelector('[data-segment="sg_ex1_02"]')!);
    const batch = tl.querySelector<HTMLElement>('[data-action="batch-video"]')!;
    expect(batch.dataset.count).toBe("1");
    expect(tl.querySelector<HTMLElement>('[data-reason="batch-video"]')?.dataset.skipped).toBe("1");
    confirmMock.mockClear();
    await act(async () => {
      fireEvent.click(batch);
    });
    await waitFor(() => expect(CanvasApi.runVideo).toHaveBeenCalledTimes(1));
    const body = (confirmMock.mock.calls[0] as unknown as [{ body: React.ReactElement }])[0].body;
    const host = document.createElement("div");
    const r = render(<>{body}</>, { container: host });
    expect(host.textContent).toContain("1 个这次跳过");
    r.unmount();
    expect((vi.mocked(CanvasApi.runVideo).mock.calls[0][1] as unknown as { segmentId: string }).segmentId).toBe("sg_ex1_02");
  });
});

describe("价格还没读到", () => {
  it("不先显示回退的数字：列表那一行、片段标题旁、按钮上都是「读取中」", async () => {
    __resetCanvasPricingForTest();
    vi.mocked(listRenderModels).mockImplementation(() => new Promise(() => {})); // 一直读不回来
    try {
      const a = render(
        <Harness>
          <EpisodeListView />
        </Harness>,
      );
      const list = await screen.findByTestId("cve-episode-list");
      expect(list.querySelector('[data-pending="price"]')).not.toBeNull();
      expect(list.querySelector('[data-episode="2"] [data-action="storyboard"] .cve-credits')?.getAttribute("aria-label")).toBe("价格读取中");
      a.unmount();
      render(
        <Harness>
          <EpisodeEditor no={1} />
        </Harness>,
      );
      await screen.findByTestId("cve-editor");
      expect(screen.getByTestId("cve-segment").querySelector('[data-pending="price"]')).not.toBeNull();
      for (const action of ["frame", "video"]) {
        expect(screen.getByTestId("cve-preview").querySelector(`[data-action="${action}"] .cve-credits`)?.getAttribute("aria-label")).toBe("价格读取中");
      }
    } finally {
      const { MOCK_CANVAS_RENDER_MODELS } = await import("@/mocks/canvas");
      vi.mocked(listRenderModels).mockImplementation(async () => MOCK_CANVAS_RENDER_MODELS);
      __resetCanvasPricingForTest();
    }
  });
});

describe("视频模型下拉", () => {
  it("选项只写模型名，价格和单条上限放在 title 里", async () => {
    render(
      <Harness>
        <EpisodeEditor no={1} />
      </Harness>,
    );
    await screen.findByTestId("cve-editor");
    const select = await waitFor(() => {
      const el = document.querySelector<HTMLSelectElement>('.cv-topbar [data-action="video-model"]');
      expect(el).not.toBeNull();
      return el!;
    });
    const opts = [...select.options];
    expect(opts.map((o) => o.value)).toEqual(["mock-video-i2v", "mock-video-t2v"]);
    for (const o of opts) {
      expect(o.textContent).not.toMatch(/积分|秒/);
      expect(o.title).toMatch(/积分/);
    }
  });
});

describe("停止按钮", () => {
  it("只读时（别的页面改过）禁用并就地说先载入最新的画布；提交中没有可停的东西", () => {
    const onCancel = vi.fn();
    const { rerender } = render(<RunLine what="视频" status="queued" readOnly onCancel={onCancel} cancelAction="cancel-video" />);
    const stop = document.querySelector<HTMLButtonElement>('[data-action="cancel-video"]')!;
    expect(stop.disabled).toBe(true);
    expect(document.querySelector('[data-reason="cancel-video"]')).not.toBeNull();
    fireEvent.click(stop);
    expect(onCancel).not.toHaveBeenCalled();
    rerender(<RunLine what="视频" status="queued" onCancel={onCancel} cancelAction="cancel-video" />);
    expect(document.querySelector<HTMLButtonElement>('[data-action="cancel-video"]')!.disabled).toBe(false);
    expect(document.querySelector('[data-reason="cancel-video"]')).toBeNull();
    rerender(<RunLine what="视频" status={undefined} submitting onCancel={onCancel} cancelAction="cancel-video" />);
    expect(document.querySelector('[data-status="submitting"]')).not.toBeNull();
    expect(document.querySelector('[data-action="cancel-video"]')).toBeNull();
  });
});

describe("片段文本编辑器", () => {
  const items: EpisodeAssetItem[] = [
    { kind: "look", id: "lk_1", label: "林微·成年", inEpisode: true },
    { kind: "scene", id: "sc_1", label: "旧教室", inEpisode: true },
  ];
  const view = (r: { label: string; id: string }) => ({ label: r.label, missing: r.id === "gone" });

  function mount(value: string, onChange = vi.fn()) {
    const ref = React.createRef<SegmentTextEditorHandle>();
    function Host() {
      const [text, setText] = React.useState(value);
      return (
        <SegmentTextEditor
          ref={ref}
          value={text}
          editing
          placeholder="写分镜"
          ariaLabel="片段文本"
          view={view}
          viewKey="k"
          items={items}
          onChange={(t) => {
            onChange(t);
            setText(t);
          }}
        />
      );
    }
    render(<Host />);
    return { ref, onChange, el: screen.getByTestId("cve-text-edit") };
  }

  it("编辑时引用是不可编辑的标签，找不到的标红", () => {
    const { el } = mount("（4 秒）@[林微·成年](look:lk_1) 和 @[老吴](look:gone)");
    const chips = el.querySelectorAll(".cve-chip");
    expect(chips).toHaveLength(2);
    expect(chips[0].getAttribute("contenteditable")).toBe("false");
    expect(chips[1].classList.contains("cve-chip-missing")).toBe(true);
  });

  it("点左栏素材 = 在光标处插入 @[名字](look:id)", () => {
    const { ref, onChange, el } = mount("（4 秒）近景，蹲下");
    act(() => ref.current!.insertRef({ kind: "look", id: "lk_1", label: "林微·成年" }));
    expect(onChange).toHaveBeenLastCalledWith("（4 秒）近景，蹲下@[林微·成年](look:lk_1)");
    expect(el.querySelectorAll(".cve-chip")).toHaveLength(1);
  });

  it("敲 @ 弹出素材浮层，回车选第一个，把「@」换成引用", () => {
    const { onChange, el } = mount("近景，");
    el.appendChild(document.createTextNode("@"));
    const r = document.createRange();
    r.setStart(el, el.childNodes.length);
    r.collapse(true);
    const sel = document.getSelection()!;
    sel.removeAllRanges();
    sel.addRange(r);
    act(() => {
      fireEvent.input(el, { data: "@", inputType: "insertText" });
    });
    expect(document.querySelector('[data-testid="cve-ref-picker"]')).not.toBeNull();
    act(() => {
      fireEvent.keyDown(el, { key: "Enter" });
    });
    expect(onChange).toHaveBeenLastCalledWith("近景，@[林微·成年](look:lk_1)");
    expect(document.querySelector('[data-testid="cve-ref-picker"]')).toBeNull();
  });

  it("输入法组字中，方向键 / 回车 / Esc 不归引用浮层（isComposing、keyCode 229、compositionstart 三种都认）", () => {
    const { onChange, el } = mount("近景，");
    el.appendChild(document.createTextNode("@"));
    const r = document.createRange();
    r.setStart(el, el.childNodes.length);
    r.collapse(true);
    document.getSelection()!.removeAllRanges();
    document.getSelection()!.addRange(r);
    act(() => {
      fireEvent.input(el, { data: "@", inputType: "insertText" });
    });
    const picker = () => document.querySelector('[data-testid="cve-ref-picker"]');
    const active = () => picker()?.querySelector('[aria-selected="true"]')?.getAttribute("data-index");
    expect(active()).toBe("0");
    onChange.mockClear();
    act(() => {
      fireEvent.keyDown(el, { key: "ArrowDown", isComposing: true });
    });
    expect(active()).toBe("0");
    act(() => {
      fireEvent.keyDown(el, { key: "Enter", keyCode: 229 });
    });
    act(() => {
      fireEvent.keyDown(el, { key: "Escape", isComposing: true });
    });
    act(() => {
      fireEvent.compositionStart(el);
      fireEvent.keyDown(el, { key: "Enter" });
    });
    expect(picker()).not.toBeNull();
    expect(onChange).not.toHaveBeenCalled();
    act(() => {
      fireEvent.compositionEnd(el, { data: "" });
    });
    act(() => {
      fireEvent.keyDown(el, { key: "ArrowDown" });
    });
    expect(active()).toBe("1");
    act(() => {
      fireEvent.keyDown(el, { key: "Enter" });
    });
    expect(onChange).toHaveBeenLastCalledWith("近景，@[旧教室](scene:sc_1)");
  });

  it("「@ 引用」浮层的搜索框：组字时按回车不选，组完字才选", () => {
    const onPick = vi.fn();
    render(
      <RefPicker mode="button" items={items} query="" onQuery={vi.fn()} active={0} onActive={vi.fn()} onPick={onPick} onClose={vi.fn()} anchor={{ left: 0, top: 0 }} />,
    );
    const input = screen.getByRole("textbox", { name: "搜名字" });
    fireEvent.keyDown(input, { key: "Enter", isComposing: true });
    fireEvent.keyDown(input, { key: "Enter", keyCode: 229 });
    fireEvent.compositionStart(input);
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onPick).not.toHaveBeenCalled();
    fireEvent.compositionEnd(input);
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onPick).toHaveBeenCalledWith(items[0]);
  });

  it("编辑完点「完成」：查看态里的文字只出现一遍（两态不复用同一个 DOM 节点，回归 v0.198.1）", () => {
    function Host() {
      const [text, setText] = React.useState("（4 秒）近景，蹲下");
      const [editing, setEditing] = React.useState(true);
      return (
        <>
          <SegmentTextEditor
            value={text}
            editing={editing}
            placeholder="写分镜"
            ariaLabel="片段文本"
            view={view}
            viewKey="k"
            items={items}
            onChange={setText}
            onRequestEdit={() => setEditing(true)}
          />
          <button type="button" data-action="done" onClick={() => setEditing(false)} />
        </>
      );
    }
    render(<Host />);
    const el = screen.getByTestId("cve-text-edit");
    // 用户在编辑框里打字（编辑框的内容是命令式画的，React 不管它的子节点）
    act(() => {
      el.textContent = "（4 秒）近景，蹲下，捡起照片";
      fireEvent.input(el);
    });
    act(() => {
      fireEvent.click(document.querySelector('[data-action="done"]')!);
    });
    expect(screen.queryByTestId("cve-text-edit")).toBeNull();
    expect(screen.getByTestId("cve-text-view").textContent).toBe("（4 秒）近景，蹲下，捡起照片");
    // 再进编辑、再出来，仍然只有一遍
    act(() => {
      fireEvent.click(screen.getByTestId("cve-text-view"));
    });
    act(() => {
      fireEvent.click(document.querySelector('[data-action="done"]')!);
    });
    expect(screen.getByTestId("cve-text-view").textContent).toBe("（4 秒）近景，蹲下，捡起照片");
  });

  it("退格紧挨着标签时整块删掉", () => {
    const { onChange, el } = mount("甲@[旧教室](scene:sc_1)");
    const r = document.createRange();
    r.setStart(el, el.childNodes.length);
    r.collapse(true);
    const sel = document.getSelection()!;
    sel.removeAllRanges();
    sel.addRange(r);
    act(() => {
      fireEvent.keyDown(el, { key: "Backspace" });
    });
    expect(onChange).toHaveBeenLastCalledWith("甲");
  });
});
