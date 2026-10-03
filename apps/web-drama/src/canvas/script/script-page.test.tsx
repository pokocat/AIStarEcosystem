import * as React from "react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import type { DramaCanvasDoc, DramaCanvasRun, DramaCanvasRunTarget } from "@ai-star-eco/types/drama-canvas";
import type { CanvasDocValue, CanvasPricingValue, CanvasRunRequest, CanvasRunsValue, SubmitResult } from "@/canvas/core";

// 剧本页的结构测试（§8.0.1 ⑥：页面真的挂上了、按钮真的接到 submit 上）。
// 文档 / 生成 / 价格三个 hook 换成测试替身（文档用真 React state，update 走真的纯函数），
// 断结构、请求参数、价格数字，不断界面文案（§8.0.1 ⑩）。渲染的是 mock 里的示例画布（与服务端同形，§8.0.1 ⑦）。

const h = vi.hoisted(() => ({
  useDoc: (() => {
    throw new Error("harness not mounted");
  }) as () => unknown,
  runs: null as unknown,
  pricing: null as unknown,
  confirm: vi.fn(),
  push: vi.fn(),
  toastError: vi.fn(),
  toastInfo: vi.fn(),
}));

vi.mock("@/canvas/core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/canvas/core")>();
  return {
    ...actual,
    useCanvasDoc: () => h.useDoc(),
    useCanvasRuns: () => h.runs,
    useCanvasPricing: () => h.pricing,
  };
});
vi.mock("@/components/drama-ui/confirm-dialog", () => ({ dramaConfirm: (...args: unknown[]) => h.confirm(...args) }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: h.push, replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/canvas/dcv_t/script",
}));
vi.mock("next/link", async () => {
  const R = await import("react");
  return {
    default: ({ href, children, ...rest }: { href: string; children?: React.ReactNode }) => R.createElement("a", { href, ...rest }, children),
  };
});
vi.mock("@/lib/toast", () => ({ toast: { error: h.toastError, success: vi.fn(), info: h.toastInfo } }));

import { __resetMockCanvasForTest, mockCanvasServer } from "@/mocks/canvas";
import CanvasScriptPage from "../../app/(workspace)/canvas/[canvasId]/script/page";

// ── 替身 ─────────────────────────────────────────────────────────────────────

const DocCtx = React.createContext<CanvasDocValue | null>(null);
h.useDoc = () => {
  const v = React.useContext(DocCtx);
  if (!v) throw new Error("useCanvasDoc outside harness");
  return v;
};

const live: { doc: () => DramaCanvasDoc; update: (fn: (d: DramaCanvasDoc) => DramaCanvasDoc) => void } = {
  doc: () => {
    throw new Error("not mounted");
  },
  update: () => {},
};

function Harness({ initial, readOnly = false, children }: { initial: DramaCanvasDoc; readOnly?: boolean; children: React.ReactNode }) {
  const [doc, setDoc] = React.useState(initial);
  const ref = React.useRef(doc);
  const write = React.useCallback((fn: (d: DramaCanvasDoc) => DramaCanvasDoc) => {
    const next = fn(ref.current);
    if (next === ref.current) return;
    ref.current = next;
    setDoc(next);
  }, []);
  const update = React.useCallback((fn: (d: DramaCanvasDoc) => DramaCanvasDoc) => (readOnly ? undefined : write(fn)), [readOnly, write]);
  live.doc = () => ref.current;
  live.update = write;
  const value = React.useMemo<CanvasDocValue>(
    () => ({
      canvasId: "dcv_t",
      status: readOnly ? "stale" : "ready",
      meta: { title: "示例", ratio: "9:16", createdAt: "2026-09-28T01:00:00.000Z", updatedAt: "2026-09-28T01:00:00.000Z" },
      doc,
      getDoc: () => ref.current,
      docVersion: "v1",
      saveState: "saved",
      update,
      rename: () => {},
      flush: async () => ({ ok: true, docVersion: "v1" }),
      reload: async () => {},
      readOnly,
    }),
    [doc, readOnly, update],
  );
  return <DocCtx.Provider value={value}>{children}</DocCtx.Provider>;
}

const pricing: CanvasPricingValue = {
  ready: true,
  imageModels: [],
  videoModels: [],
  videoModelId: undefined,
  setVideoModelId: () => {},
  confirmThreshold: 50,
  // 故意和默认单价不一样：按钮上出现这些数字 = 价格确实来自 pricing
  scriptPrice: (stage) => ({ setting: 3, outline: 9, episode: 7 })[stage],
  extractPrice: () => 5,
  storyboardPrice: () => 4,
  imagePrice: () => 2,
  videoPrice: () => 6,
  maxSegmentSec: () => 10,
};

const runsByTarget = new Map<string, DramaCanvasRun>();
let nextSubmit: ((req: CanvasRunRequest) => SubmitResult) | null = null;
const submit = vi.fn(async (req: CanvasRunRequest): Promise<SubmitResult> => {
  if (nextSubmit) return nextSubmit(req);
  const body = req.body as { stage?: string; episodeNo?: number };
  const target = (
    req.kind === "extract"
      ? "extract"
      : body.stage === "episode"
        ? `script:episode:${body.episodeNo}`
        : `script:${body.stage}`
  ) as DramaCanvasRunTarget;
  return { ok: true, runs: [run({ id: `run-${submit.mock.calls.length}`, kind: req.kind === "extract" ? "extract" : "script", target })] };
});
const submittingTargets = new Set<string>();
type SeqResult = Awaited<ReturnType<CanvasRunsValue["submitSequence"]>>;
/** 批量提交的替身：照契约一进来就把整批目标登记为提交中；结果由测试决定（默认全成功），可以挂起不返回。 */
let seqImpl: ((reqs: CanvasRunRequest[]) => Promise<SeqResult>) | null = null;
const targetOf = (req: CanvasRunRequest) => {
  const b = req.body as { stage?: string; episodeNo?: number };
  return req.kind === "extract" ? "extract" : b.stage === "episode" ? `script:episode:${b.episodeNo}` : `script:${b.stage}`;
};
const submitSequence = vi.fn(async (reqs: CanvasRunRequest[], _opts?: { stopOnError?: boolean }): Promise<SeqResult> => {
  for (const r of reqs) submittingTargets.add(targetOf(r));
  try {
    if (seqImpl) return await seqImpl(reqs);
    return reqs.map((r, i) => ({ ok: true as const, runs: [run({ id: `seq-${i}`, target: targetOf(r) as DramaCanvasRunTarget })] }));
  } finally {
    for (const r of reqs) submittingTargets.delete(targetOf(r));
  }
});
const runsValue: CanvasRunsValue = {
  submit,
  submitSequence,
  runFor: (t) => runsByTarget.get(t),
  cancel: vi.fn(async () => {}),
  pending: [],
  isSubmitting: (t) => submittingTargets.has(t),
};
h.runs = runsValue;
h.pricing = pricing;

function run(over: Partial<DramaCanvasRun>): DramaCanvasRun {
  return { id: "r", canvasId: "dcv_t", kind: "script", target: "script:setting", status: "queued", cost: 0, createdAt: "2026-09-30T01:00:00.000Z", ...over };
}

// ── 数据：mock 里的两张预置画布 ──────────────────────────────────────────────

let example: DramaCanvasDoc;
let blank: DramaCanvasDoc;

beforeAll(async () => {
  __resetMockCanvasForTest();
  example = (await mockCanvasServer.get("dcv_example_night_bus")).doc;
  blank = (await mockCanvasServer.get("dcv_example_new")).doc;
});

beforeEach(() => {
  submit.mockClear();
  submitSequence.mockClear();
  seqImpl = null;
  nextSubmit = null;
  runsByTarget.clear();
  submittingTargets.clear();
  h.confirm.mockReset();
  h.confirm.mockResolvedValue(true);
  h.push.mockReset();
  h.toastError.mockReset();
  h.toastInfo.mockReset();
});
afterEach(() => cleanup());

function mount(doc: DramaCanvasDoc, opts: { readOnly?: boolean } = {}) {
  return render(
    <Harness initial={structuredClone(doc)} readOnly={opts.readOnly}>
      <CanvasScriptPage />
    </Harness>,
  );
}

async function settle() {
  for (let i = 0; i < 10; i++) await Promise.resolve();
}

async function click(el: Element | null) {
  expect(el).not.toBeNull();
  await act(async () => {
    fireEvent.click(el!);
    await settle();
  });
}

const q = (root: ParentNode, sel: string) => root.querySelector<HTMLElement>(sel);
const btn = (root: ParentNode, sel: string) => root.querySelector<HTMLButtonElement>(sel);

// ── 测试 ─────────────────────────────────────────────────────────────────────

describe("剧本页 · 示例画布（source=idea，大纲和分集剧情已通过，第 1 集锁着）", () => {
  it("几节都在：原始想法 / 故事大纲 / 分集剧情 / 分集剧本；每集一块；标题带集数", () => {
    const { container } = mount(example);
    expect([...container.querySelectorAll("[data-section]")].map((e) => e.getAttribute("data-section"))).toEqual([
      "idea",
      "setting",
      "outline",
      "episodes",
    ]);
    expect(container.querySelectorAll("[data-episode]")).toHaveLength(example.script.episodes.length);
    expect(container.querySelectorAll("[data-outline]")).toHaveLength(example.script.outline!.episodes.length);
    expect(q(container, "h1")?.textContent).toContain(String(example.script.episodes.length));
    // 大纲、分集剧情都通过了：没有「通过」按钮，分集剧情那一节不禁用
    expect(btn(container, '[data-action="approve-setting"]')).toBeNull();
    expect(btn(container, '[data-action="approve-outline"]')).toBeNull();
    expect(q(container, '[data-section="outline"]')?.getAttribute("aria-disabled")).toBeNull();
  });

  it("锁住的集：重写按钮禁用；没锁的集可以点；点锁能解开", async () => {
    const { container } = mount(example);
    const ep1 = q(container, '[data-episode="1"]')!;
    const ep2 = q(container, '[data-episode="2"]')!;
    expect(example.script.episodes[0].locked).toBe(true);
    expect(btn(ep1, '[data-action="rewrite-episode"]')?.disabled).toBe(true);
    expect(btn(ep2, '[data-action="rewrite-episode"]')?.disabled).toBe(false);

    await click(btn(ep1, '[data-action="toggle-lock"]'));
    expect(live.doc().script.episodes[0].locked).toBeUndefined();
    expect(btn(q(container, '[data-episode="1"]')!, '[data-action="rewrite-episode"]')?.disabled).toBe(false);
  });

  it("重写这一集：弹层里写的要求带进 submit（弹层就是确认，不再叠确认框）", async () => {
    const { container, getByRole } = mount(example);
    await click(btn(q(container, '[data-episode="2"]')!, '[data-action="rewrite-episode"]'));
    const dialog = getByRole("dialog");
    expect(dialog.textContent).toContain(String(pricing.scriptPrice("episode")));
    act(() => {
      fireEvent.change(dialog.querySelector("textarea")!, { target: { value: "  节奏再快一点  " } });
    });
    await click(btn(dialog, '[data-action="rewrite-submit"]'));
    expect(h.confirm).not.toHaveBeenCalled();
    expect(submit).toHaveBeenCalledTimes(1);
    expect(submit.mock.calls[0][0]).toEqual({ kind: "script", body: { stage: "episode", episodeNo: 2, instruction: "节奏再快一点" } });
  });

  it("写全部分集剧本：只写没正文、没锁的集；按钮上的价格 = pricing 单集价 × 集数；先确认总价，再一集一次 submit", async () => {
    // 第 2 集清空正文、分集剧情多一集（分集剧本里还没有）→ 要写第 2、3 集；第 1 集锁着且有正文，不写
    const doc = structuredClone(example);
    doc.script.episodes[1] = { ...doc.script.episodes[1], text: "" };
    delete doc.script.episodes[1].run;
    doc.script.outline!.episodes.push({ no: 3, title: "第三晚", hook: "钩子", summary: "梗概" });
    const { container } = mount(doc);
    const all = btn(container, '[data-action="write-all"]');
    expect(all).not.toBeNull();
    expect(all!.disabled).toBe(false);
    const total = pricing.scriptPrice("episode") * 2;
    expect(all!.textContent).toContain(String(total));

    await click(all);
    expect(h.confirm).toHaveBeenCalledTimes(1);
    expect(h.confirm.mock.calls[0][0]).toMatchObject({ cost: total });
    // 整批交给 core 的 submitSequence，页面自己不循环 submit（Codex 复审 N3）
    expect(submit).not.toHaveBeenCalled();
    expect(submitSequence).toHaveBeenCalledTimes(1);
    expect(submitSequence.mock.calls[0][0]).toEqual([
      { kind: "script", body: { stage: "episode", episodeNo: 2 } },
      { kind: "script", body: { stage: "episode", episodeNo: 3 } },
    ]);
    expect(submitSequence.mock.calls[0][1]).toEqual({ stopOnError: true });
  });

  it("写全部进行中：后面那集的「写这一集」是禁用的；跑完解禁", async () => {
    const doc = structuredClone(example);
    doc.script.episodes[1] = { ...doc.script.episodes[1], text: "" };
    delete doc.script.episodes[1].run;
    doc.script.episodes.push({ no: 3, title: "第三晚", text: "" });
    let finish: (r: SeqResult) => void = () => {};
    seqImpl = (reqs) =>
      new Promise<SeqResult>((resolve) => {
        finish = resolve;
        void reqs;
      });
    const { container } = mount(doc);
    const write3 = () => btn(q(container, '[data-episode="3"]')!, '[data-action="write-episode"]');
    expect(write3()?.disabled).toBe(false);
    await click(btn(container, '[data-action="write-all"]'));
    expect(submitSequence).toHaveBeenCalledTimes(1);
    expect(write3()?.disabled).toBe(true);
    expect(btn(q(container, '[data-episode="2"]')!, '[data-action="write-episode"]')?.disabled).toBe(true);
    expect(btn(container, '[data-action="write-all"]')?.disabled).toBe(true);
    // 点了也不发单集请求
    await click(write3());
    expect(submit).not.toHaveBeenCalled();

    await act(async () => {
      finish([
        { ok: true, runs: [run({ id: "s2", target: "script:episode:2" })] },
        { ok: true, runs: [run({ id: "s3", target: "script:episode:3" })] },
      ]);
      await settle();
    });
    expect(write3()?.disabled).toBe(false);
  });

  it("写全部：core 跳过的集（已经在写）在提示里说清；前面那集被拒时报它的原因，后面没发的也说清", async () => {
    const doc = structuredClone(example);
    doc.script.episodes[1] = { ...doc.script.episodes[1], text: "" };
    delete doc.script.episodes[1].run;
    doc.script.episodes.push({ no: 3, title: "第三晚", text: "" }, { no: 4, title: "第四晚", text: "" });
    seqImpl = async () => [
      { ok: false, reason: "skipped", message: "已经在写" },
      { ok: false, reason: "rejected", errorCode: "INSUFFICIENT_CREDITS", message: "积分不够" },
      { ok: false, reason: "skipped", message: "前面没发出去" },
    ];
    const { container } = mount(doc);
    await click(btn(container, '[data-action="write-all"]'));
    expect(h.toastInfo).toHaveBeenCalledTimes(1);
    expect(h.toastInfo.mock.calls[0][0]).toContain("2");
    expect(h.toastInfo.mock.calls[0][0]).not.toContain("4");
    expect(h.toastError).toHaveBeenCalledTimes(1);
    expect(h.toastError.mock.calls[0][0]).toBe("积分不够");
    expect(h.toastError.mock.calls[0][1]?.description).toContain("4");
  });

  it("写全部分集剧本：确认框点取消就不发", async () => {
    const doc = structuredClone(example);
    doc.script.episodes[1] = { ...doc.script.episodes[1], text: "" };
    delete doc.script.episodes[1].run;
    h.confirm.mockResolvedValue(false);
    const { container } = mount(doc);
    await click(btn(container, '[data-action="write-all"]'));
    expect(submit).not.toHaveBeenCalled();
    expect(submitSequence).not.toHaveBeenCalled();
  });

  it("拆出角色和场景：拆过的先确认（带价格），submit extract；跑完且 extractedAt 变了，跳到角色和场景", async () => {
    const { container } = mount(example);
    const next = btn(container, ".cv-next-next");
    expect(next?.textContent).toContain(String(pricing.extractPrice()));
    await click(next);
    expect(h.confirm).toHaveBeenCalledTimes(1);
    expect(h.confirm.mock.calls[0][0]).toMatchObject({ cost: pricing.extractPrice() });
    expect(submit.mock.calls[0][0]).toEqual({ kind: "extract", body: {} });
    expect(h.push).not.toHaveBeenCalled();

    // core 轮询到终态并合进文档（这里手动模拟那一步）
    const runId = "run-1";
    runsByTarget.set("extract", run({ id: runId, kind: "extract", target: "extract", status: "succeeded" }));
    await act(async () => {
      live.update((d) => ({
        ...d,
        script: { ...d.script, extractedAt: "2026-09-30T09:00:00.000Z", extractRun: { runId, status: "succeeded" } },
      }));
      await settle();
    });
    expect(h.push).toHaveBeenCalledWith("/canvas/dcv_t/assets?view=board");
  });

  it("修改记录：打开能看到每一版；恢复先确认，确认后文档换成那一版（恢复前先存一版）", async () => {
    const { container, getByRole } = mount(example);
    await click(q(container, '[aria-haspopup="menu"]'));
    await click(btn(container, '[data-action="open-history"]'));
    const dialog = getByRole("dialog");
    const items = dialog.querySelectorAll("[data-version]");
    expect(items).toHaveLength(example.script.history.length);
    const target = example.script.history[0];
    await click(btn(dialog.querySelector(`[data-version="${target.id}"]`)!, '[data-action="restore-version"]'));
    expect(h.confirm).toHaveBeenCalledTimes(1);
    const after = live.doc().script;
    expect(after.history).toHaveLength(Math.min(10, example.script.history.length + 1));
    expect(after.episodes.map((e) => e.text)).toEqual(target.episodes.map((e) => e.text));
  });

  it("只读（别的页面改过）：编辑和生成全部禁用", () => {
    const { container } = mount(example, { readOnly: true });
    for (const sel of ['[data-action="rewrite-episode"]', '[data-action="toggle-lock"]', '[data-action="rewrite-setting"]', '[data-action="rewrite-outline"]']) {
      for (const b of container.querySelectorAll<HTMLButtonElement>(sel)) expect(b.disabled, sel).toBe(true);
    }
    for (const t of container.querySelectorAll("textarea")) expect((t as HTMLTextAreaElement).readOnly).toBe(true);
    for (const i of container.querySelectorAll<HTMLInputElement>("input")) expect(i.readOnly).toBe(true);
    expect(btn(container, ".cv-next-next")?.disabled).toBe(true);
  });
});

describe("剧本页 · 提交中（core 的 isSubmitting）也算生成中", () => {
  it("写 / 重写 / 写全部 / 拆出角色和场景：对应目标正在提交时禁用，写全部不再算那一集", () => {
    const doc = structuredClone(example);
    doc.script.episodes[1] = { ...doc.script.episodes[1], text: "" };
    delete doc.script.episodes[1].run;
    doc.script.outline!.episodes.push({ no: 3, title: "第三晚", hook: "钩子", summary: "梗概" });
    submittingTargets.add("script:setting");
    submittingTargets.add("script:outline");
    submittingTargets.add("script:episode:2");
    submittingTargets.add("extract");
    const { container } = mount(doc);
    expect(btn(container, '[data-action="rewrite-setting"]')?.disabled).toBe(true);
    expect(btn(container, '[data-action="rewrite-outline"]')?.disabled).toBe(true);
    expect(btn(q(container, '[data-episode="2"]')!, '[data-action="write-episode"]')?.disabled).toBe(true);
    // 第 2 集在提交中：写全部只剩分集剧情里的第 3 集
    expect(btn(container, '[data-action="write-all"]')?.textContent).toContain(`${pricing.scriptPrice("episode") * 1}`);
    expect(btn(container, '[data-action="write-all"]')?.textContent).toContain("1 集");
    const next = btn(container, ".cv-next-next");
    expect(next?.getAttribute("aria-busy")).toBe("true");
  });

  it("空画布：写故事大纲在提交中时禁用", () => {
    submittingTargets.add("script:setting");
    const { container } = mount(blank);
    expect(btn(container, '[data-action="write-setting"]')?.disabled).toBe(true);
  });
});

describe("剧本页 · 刚新建的空画布", () => {
  it("只有「写故事大纲」可点（价格来自 pricing，低于确认线不弹确认），分集剧情那一节禁用", async () => {
    const { container } = mount(blank);
    expect(q(container, '[data-section="outline"]')?.getAttribute("aria-disabled")).toBe("true");
    expect(btn(container, '[data-action="write-outline"]')?.disabled).toBe(true);
    expect(container.querySelectorAll("[data-episode]")).toHaveLength(0);
    expect(btn(container, ".cv-next-next")?.disabled).toBe(true);

    const write = btn(container, '[data-action="write-setting"]');
    expect(write?.textContent).toContain(String(pricing.scriptPrice("setting")));
    await click(write);
    expect(h.confirm).not.toHaveBeenCalled();
    expect(submit.mock.calls[0][0]).toEqual({ kind: "script", body: { stage: "setting" } });
  });

  it("服务端拒了才 toast；没存上 / 版本冲突不重复弹（外壳自己会提示）", async () => {
    nextSubmit = () => ({ ok: false, reason: "rejected", errorCode: "INSUFFICIENT_CREDITS", message: "积分不够" });
    const { container } = mount(blank);
    await click(btn(container, '[data-action="write-setting"]'));
    expect(h.toastError).toHaveBeenCalledWith("积分不够");

    h.toastError.mockReset();
    nextSubmit = () => ({ ok: false, reason: "stale", message: "改过了" });
    await click(btn(container, '[data-action="write-setting"]'));
    expect(h.toastError).not.toHaveBeenCalled();
  });

  it("通过故事大纲：先存一版修改记录再写 approvedAt，分集剧情那一节解禁", async () => {
    const doc = structuredClone(blank);
    doc.script.setting = { text: "题材：都市悬疑" };
    const { container } = mount(doc);
    await click(btn(container, '[data-action="approve-setting"]'));
    const s = live.doc().script;
    expect(s.setting?.approvedAt).toBeTruthy();
    expect(s.history[0]).toMatchObject({ label: "通过故事大纲", setting: "题材：都市悬疑" });
    expect(q(container, '[data-section="outline"]')?.getAttribute("aria-disabled")).toBeNull();
    expect(btn(container, '[data-action="write-outline"]')?.disabled).toBe(false);
  });
});

describe("剧本页 · 通过分集剧情", () => {
  it("存一版 + approvedAt + 按集列出分集剧本；一下子多出很多集时只展开第一集；「写全部」按集数报价", async () => {
    const doc = structuredClone(blank);
    doc.script.setting = { text: "题材：都市悬疑", approvedAt: "2026-09-30T01:00:00.000Z" };
    doc.script.outline = {
      episodes: Array.from({ length: 5 }, (_, i) => ({ no: i + 1, title: `第${i + 1}单`, hook: "钩子", summary: "梗概" })),
    };
    const { container } = mount(doc);
    expect(btn(container, '[data-action="write-all"]')).toBeNull(); // 分集剧情还没通过
    await click(btn(container, '[data-action="approve-outline"]'));
    const s = live.doc().script;
    expect(s.outline?.approvedAt).toBeTruthy();
    expect(s.history[0]).toMatchObject({ label: "通过分集剧情" });
    expect(s.episodes.map((e) => [e.no, e.title, e.text])).toEqual(
      Array.from({ length: 5 }, (_, i) => [i + 1, `第${i + 1}单`, ""]),
    );
    expect(container.querySelectorAll("[data-episode]")).toHaveLength(5);
    expect(container.querySelectorAll(".cvs-ep.is-open")).toHaveLength(1);
    expect(btn(container, '[data-action="write-all"]')?.textContent).toContain(String(pricing.scriptPrice("episode") * 5));
  });
});

describe("剧本页 · 粘贴来的剧本（source=paste）· 删集", () => {
  it("没正文但逐集制作里已有片段的集，删之前也要确认；取消就不删", async () => {
    const doc: DramaCanvasDoc = {
      ...structuredClone(blank),
      source: "paste",
      script: { episodes: [{ no: 1, title: "第 1 集", text: "正文" }, { no: 2, title: "第 2 集", text: "" }], history: [] },
      episodes: [{ no: 2, segments: [{ id: "sg", text: "（4 秒）", durationSec: 4, frame: { versions: [] }, video: { versions: [] } }] }],
    };
    h.confirm.mockResolvedValue(false);
    const { container } = mount(doc);
    await click(btn(q(container, '[data-episode="2"]')!, '[data-action="delete-episode"]'));
    expect(h.confirm).toHaveBeenCalledTimes(1);
    expect(h.confirm.mock.calls[0][0]).toMatchObject({ tone: "danger" });
    expect(live.doc().script.episodes).toHaveLength(2);

    h.confirm.mockResolvedValue(true);
    await click(btn(q(container, '[data-episode="2"]')!, '[data-action="delete-episode"]'));
    expect(live.doc().script.episodes.map((e) => e.no)).toEqual([1]);
    await click(btn(container, '[data-action="add-episode"]'));
    expect(live.doc().script.episodes.map((e) => e.no)).toEqual([1, 3]); // 2 号在制作数据里用过，不复用
  });
});

describe("剧本页 · 粘贴来的剧本（source=paste）", () => {
  it("没有故事大纲 / 分集剧情两节；能加一集、删一集（有正文时先确认）", async () => {
    const doc: DramaCanvasDoc = {
      ...structuredClone(blank),
      source: "paste",
      script: {
        episodes: [
          { no: 1, title: "第 1 集", text: "### 场1-1\n日 内 教室" },
          { no: 2, title: "第 2 集", text: "" },
        ],
        history: [],
      },
    };
    const { container } = mount(doc);
    expect([...container.querySelectorAll("[data-section]")].map((e) => e.getAttribute("data-section"))).toEqual(["episodes"]);
    expect(btn(container, '[data-action="write-all"]')).toBeNull();

    await click(btn(container, '[data-action="add-episode"]'));
    expect(live.doc().script.episodes.map((e) => e.no)).toEqual([1, 2, 3]);

    // 空的那集直接删，不确认
    await click(btn(q(container, '[data-episode="2"]')!, '[data-action="delete-episode"]'));
    expect(h.confirm).not.toHaveBeenCalled();
    expect(live.doc().script.episodes.map((e) => e.no)).toEqual([1, 2]);

    // 有正文的那集先确认，删之前存一版
    await click(btn(q(container, '[data-episode="1"]')!, '[data-action="delete-episode"]'));
    expect(h.confirm).toHaveBeenCalledTimes(1);
    expect(live.doc().script.episodes).toHaveLength(1);
    expect(live.doc().script.history).toHaveLength(1);

    // 写这一集：stage=episode + 集号
    await click(btn(q(container, '[data-episode="1"]')!, '[data-action="write-episode"]'));
    expect(submit.mock.calls.at(-1)?.[0]).toEqual({ kind: "script", body: { stage: "episode", episodeNo: 1 } });
  });
});
