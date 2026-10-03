import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DramaCanvasDetail, DramaCanvasRun } from "@ai-star-eco/types/drama-canvas";
import { normalizeTraits } from "@/canvas/assets/traits";
import { __resetMockCanvasForTest, mockCanvasServer as mock } from "./canvas";

// §8.0.1 ⑦：mock 与服务端同形 —— 演示模式验收过了、线上才不会坏。这里钉住服务端契约里 mock 也得守的几条：
// 保存 409 / 剥 url、读出只签本人 key、生成只认已保存的版本、幂等、运行推进、取消。断结构与错误码，不断文案。

async function settle<T>(p: Promise<T>): Promise<{ ok: true; v: T } | { ok: false; e: { code?: string; status?: number } }> {
  const r = p.then(
    (v) => ({ ok: true as const, v }),
    (e) => ({ ok: false as const, e }),
  );
  await vi.advanceTimersByTimeAsync(500);
  return r;
}

async function val<T>(p: Promise<T>): Promise<T> {
  const r = await settle(p);
  if (!r.ok) throw new Error(`expected success, got ${r.e.code}`);
  return r.v;
}

const EXAMPLE = "dcv_example_night_bus";

describe("mock 画布服务端", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    __resetMockCanvasForTest();
  });
  afterEach(() => vi.useRealTimers());

  it("预置两张画布：示例（已到逐集制作）与刚新建的空画布", async () => {
    const list = await val(mock.list());
    expect(list.map((c) => c.id)).toContain(EXAMPLE);
    const ex = list.find((c) => c.id === EXAMPLE)!;
    expect(ex).toMatchObject({ step: "episodes", episodeCount: 2, characterCount: 3, sceneCount: 3, segmentsTotal: 3, segmentsDone: 2 });
    expect(ex.coverUrl).toMatch(/^data:image\/svg\+xml/);
    const fresh = list.find((c) => c.id !== EXAMPLE)!;
    expect(fresh).toMatchObject({ step: "script", episodeCount: 0 });
  });

  it("读出：本人的 key 派生地址（图 → SVG，视频 → 演示视频，末帧 → lastFrameUrl）", async () => {
    const d = await val(mock.get(EXAMPLE));
    const look = d.doc.characters[0].looks[0];
    expect(look.images.versions[0].url).toMatch(/^data:image\/svg\+xml/);
    const seg = d.doc.episodes[0].segments[0];
    expect(seg.video.versions[0].url).toBe("/videos/showreel-01.mp4");
    expect(seg.video.versions[0].lastFrameUrl).toMatch(/^data:image\/svg\+xml/);
    expect(d.docVersion).toMatch(/^[0-9a-f]{16}$/);
  });

  it("保存：基线不对 409；对了就存，剥掉 url、不是本人的 key 读出时不签", async () => {
    const d = await val(mock.get(EXAMPLE));
    const stale = await settle(mock.save(EXAMPLE, { doc: d.doc, baseDocVersion: "nope" }));
    expect(stale.ok).toBe(false);
    if (!stale.ok) expect([stale.e.code, stale.e.status]).toEqual(["DRAMA_CANVAS_STALE", 409]);

    const doc = { ...d.doc, materials: [...d.doc.materials, { id: "mt_x", name: "外链", kind: "image" as const, images: { versions: [{ key: "someone-else/x.png", url: "https://evil/x.png" }] } }] };
    const saved = await val(mock.save(EXAMPLE, { doc, title: "新名字", baseDocVersion: d.docVersion }));
    expect(saved.docVersion).not.toBe(d.docVersion);
    const again = await val(mock.get(EXAMPLE));
    expect(again.title).toBe("新名字");
    const mt = again.doc.materials.find((m) => m.id === "mt_x")!;
    expect(mt.images!.versions[0]).toEqual({ key: "someone-else/x.png" });
    // 旧基线再存一次 → 409
    const second = await settle(mock.save(EXAMPLE, { doc, baseDocVersion: d.docVersion }));
    expect(second.ok).toBe(false);
  });

  it("签名换新：只签这张画布里出现过的 key，别的不出现在 urls 里", async () => {
    const r = await val(
      mock.signAssets(EXAMPLE, { keys: ["mock/canvas/ex/shennian-base.png", "mock/canvas/ex/ep1-seg1.mp4", "mock/canvas/ex/ep1-seg1-last.png", "mock/other/x.png", "someone/y.png"] }),
    );
    expect(Object.keys(r.urls).sort()).toEqual(["mock/canvas/ex/ep1-seg1-last.png", "mock/canvas/ex/ep1-seg1.mp4", "mock/canvas/ex/shennian-base.png"]);
    expect(r.urls["mock/canvas/ex/shennian-base.png"]).toMatch(/^data:image\/svg\+xml/);
    expect(r.urls["mock/canvas/ex/ep1-seg1.mp4"]).toBe("/videos/showreel-01.mp4");
    const other = (await val(mock.list())).find((c) => c.id !== EXAMPLE)!;
    expect((await val(mock.signAssets(other.id, { keys: ["mock/canvas/ex/shennian-base.png"] }))).urls).toEqual({});
  });

  it("造型的角色设计标签按组名存，assets 的 normalizeTraits 原样认", async () => {
    const d = await val(mock.get(EXAMPLE));
    const traits = d.doc.characters[0].looks[0].traits!;
    expect(Object.keys(traits).length).toBeGreaterThan(0);
    expect(normalizeTraits(traits)).toEqual(traits);
  });

  it("粘贴新建的响应带切集说明（同服务端 splitter）；GET 详情不带", async () => {
    const style = { id: "none", name: "无风格", prompt: "" };
    const plain = await val(mock.create({ source: "paste", ratio: "9:16", style, text: "甲：你好\n乙：再见" }));
    expect(plain.splitNotes).toHaveLength(1);
    expect(plain.doc.script.episodes).toHaveLength(1);
    const marked = await val(mock.create({ source: "paste", ratio: "9:16", style, text: "剧名：雨夜\n【第1集】开场\n甲\n第3集\n乙" }));
    expect(marked.doc.script.episodes.map((e) => e.no)).toEqual([1, 2]);
    expect(marked.splitNotes).toHaveLength(3); // 总述 + 前言并进第 1 集 + 集号重排
    expect((await val(mock.get(marked.id))).splitNotes).toBeUndefined();
    const idea = await val(mock.create({ source: "idea", ratio: "9:16", style, idea: "一句话" }));
    expect(idea.splitNotes).toBeUndefined();
  });

  it("版本同时覆盖标题：A 只改标题后，B 带旧版本保存 → 409", async () => {
    const a = await val(mock.get(EXAMPLE));
    const b = await val(mock.get(EXAMPLE));
    const renamed = await val(mock.save(EXAMPLE, { doc: a.doc, title: "A 改的名字", baseDocVersion: a.docVersion }));
    expect(renamed.docVersion).not.toBe(a.docVersion); // 文档没动，只改了标题，版本也要变
    const late = await settle(mock.save(EXAMPLE, { doc: b.doc, title: "B 的名字", baseDocVersion: b.docVersion }));
    expect(late.ok).toBe(false);
    if (!late.ok) expect([late.e.code, late.e.status]).toEqual(["DRAMA_CANVAS_STALE", 409]);
    expect((await val(mock.get(EXAMPLE))).title).toBe("A 改的名字");
  });

  it("新建：粘贴的剧本按「第 X 集」切开；想法缺失 400", async () => {
    const created = await val(
      mock.create({ source: "paste", ratio: "16:9", style: { id: "none", name: "无风格", prompt: "" }, text: "第1集 开场\n甲：你好\n第二集：转折\n乙：再见" }),
    );
    expect(created.doc.script.episodes.map((e) => [e.no, e.title])).toEqual([
      [1, "开场"],
      [2, "转折"],
    ]);
    expect(created.step).toBe("script");
    const bad = await settle(mock.create({ source: "idea", ratio: "9:16", style: { id: "none", name: "", prompt: "" }, idea: "  " }));
    expect(bad.ok).toBe(false);
  });

  it("生成只认已保存的版本；同一个幂等键回原记录；1–3 秒内 queued → running → succeeded", async () => {
    const d = await val(mock.get(EXAMPLE));
    const wrong = await settle(mock.runImage(EXAMPLE, { clientRequestId: "key-k1-0000", docVersion: "old", target: { kind: "look", id: "lk_ex_shennian" }, count: 2 }));
    expect(wrong.ok).toBe(false);
    if (!wrong.ok) expect(wrong.e.code).toBe("DRAMA_CANVAS_STALE");

    const r = await val(mock.runImage(EXAMPLE, { clientRequestId: "key-k2-0000", docVersion: d.docVersion, target: { kind: "look", id: "lk_ex_shennian" }, count: 2 }));
    expect(["queued", "running"]).toContain(r.status);
    expect(r.cost).toBe(4);
    const dup = await val(mock.runImage(EXAMPLE, { clientRequestId: "key-k2-0000", docVersion: "whatever", target: { kind: "look", id: "lk_ex_shennian" }, count: 1 }));
    expect(dup.id).toBe(r.id);

    await vi.advanceTimersByTimeAsync(3000);
    const [done] = await val(mock.getRuns(EXAMPLE, [r.id]));
    expect(done.status).toBe("succeeded");
    expect(done.result?.images).toHaveLength(2);
    expect(done.result?.images?.[0].url).toMatch(/^data:image\/svg\+xml/);
    expect(done.result?.images?.[0].runId).toBe(r.id);
  });

  it("批量出图的键同服务端：第 0 项占原始键，其余 键:i；重试按原批次返回；单条 / 批量互用、跨画布、别的目标 → 409 REUSED", async () => {
    const d = await val(mock.get(EXAMPLE));
    const items = [
      { target: { kind: "look" as const, id: "lk_ex_shennian" }, count: 1 },
      { target: { kind: "scene" as const, id: "sc_ex_bus" }, count: 1 },
    ];
    const first = await val(mock.runImageBatch(EXAMPLE, { clientRequestId: "key-B1-0000", docVersion: d.docVersion, items }));
    expect(first).toHaveLength(2);
    // 重试（哪怕这次 items 变短、版本不对）：按原批次原样返回
    const again = await val(mock.runImageBatch(EXAMPLE, { clientRequestId: "key-B1-0000", docVersion: "old", items: items.slice(0, 1) }));
    expect(again.map((r) => r.id)).toEqual(first.map((r) => r.id));

    const reuse = async (p: Promise<unknown>) => {
      const r = await settle(p);
      expect(r.ok).toBe(false);
      if (!r.ok) expect([r.e.code, r.e.status]).toEqual(["DRAMA_CANVAS_REQUEST_ID_REUSED", 409]);
    };
    // 批量的键拿去发单条
    await reuse(mock.runImage(EXAMPLE, { clientRequestId: "key-B1-0000", docVersion: d.docVersion, target: items[0].target, count: 1 }));
    // 单条的键拿去发批量
    await val(mock.runImage(EXAMPLE, { clientRequestId: "key-S1-0000", docVersion: d.docVersion, target: items[0].target, count: 1 }));
    await reuse(mock.runImageBatch(EXAMPLE, { clientRequestId: "key-S1-0000", docVersion: d.docVersion, items }));
    // 同一个键换一个目标 / 另一种请求
    await reuse(mock.runImage(EXAMPLE, { clientRequestId: "key-S1-0000", docVersion: d.docVersion, target: items[1].target, count: 1 }));
    await reuse(mock.runExtract(EXAMPLE, { clientRequestId: "key-S1-0000", docVersion: d.docVersion }));
    // 跨画布
    const other = (await val(mock.list())).find((c) => c.id !== EXAMPLE)!;
    await reuse(mock.runExtract(other.id, { clientRequestId: "key-S1-0000", docVersion: "x" }));
  });

  it("按幂等键只查不建：没受理 → 空；单条 → 那一条；批量原始键 → 整批；别的画布 → 空；不产生新记录", async () => {
    const d = await val(mock.get(EXAMPLE));
    expect(await val(mock.lookupRuns(EXAMPLE, "key-nope-0000"))).toEqual([]);
    const single = await val(mock.runImage(EXAMPLE, { clientRequestId: "key-L1-0000", docVersion: d.docVersion, target: { kind: "scene", id: "sc_ex_bus" }, count: 1 }));
    expect((await val(mock.lookupRuns(EXAMPLE, "key-L1-0000"))).map((r) => r.id)).toEqual([single.id]);
    const items = [
      { target: { kind: "look" as const, id: "lk_ex_shennian" }, count: 1 },
      { target: { kind: "scene" as const, id: "sc_ex_bus" }, count: 1 },
    ];
    const batch = await val(mock.runImageBatch(EXAMPLE, { clientRequestId: "key-L2-0000", docVersion: d.docVersion, items }));
    expect((await val(mock.lookupRuns(EXAMPLE, "key-L2-0000"))).map((r) => r.id)).toEqual(batch.map((r) => r.id));
    // 含「:」的子键同服务端：键不合法，400（根本到不了查询分支）
    const sub = await settle(mock.lookupRuns(EXAMPLE, "key-L2-0000:1"));
    expect(sub.ok).toBe(false);
    if (!sub.ok) expect([sub.e.code, sub.e.status]).toEqual(["DRAMA_CANVAS_REQUEST_ID_INVALID", 400]);
    const other = (await val(mock.list())).find((c) => c.id !== EXAMPLE)!;
    expect(await val(mock.lookupRuns(other.id, "key-L1-0000"))).toEqual([]);
    expect(await val(mock.lookupRuns(EXAMPLE, "key-nope-0000"))).toEqual([]); // 查过也不会建出记录
  });

  it("批量出图超过 20 项或 40 张 → 400 BATCH_TOO_LARGE", async () => {
    const d = await val(mock.get(EXAMPLE));
    const one = { target: { kind: "look" as const, id: "lk_ex_shennian" }, count: 1 };
    const tooMany = await settle(mock.runImageBatch(EXAMPLE, { clientRequestId: "key-T1-0000", docVersion: d.docVersion, items: Array.from({ length: 21 }, () => one) }));
    expect(tooMany.ok).toBe(false);
    if (!tooMany.ok) expect(tooMany.e.code).toBe("DRAMA_CANVAS_BATCH_TOO_LARGE");
    const tooBig = await settle(
      mock.runImageBatch(EXAMPLE, { clientRequestId: "key-T2-0000", docVersion: d.docVersion, items: Array.from({ length: 11 }, () => ({ ...one, count: 4 })) }),
    );
    expect(tooBig.ok).toBe(false);
    if (!tooBig.ok) expect(tooBig.e.code).toBe("DRAMA_CANVAS_BATCH_TOO_LARGE");
  });

  it("文字类结果形状正确：拆出 3–4 个角色 + 3 个场景；分镜脚本用真实 id 引用", async () => {
    const d = await val(mock.get(EXAMPLE));
    const ex = await val(mock.runExtract(EXAMPLE, { clientRequestId: "key-e1-0000", docVersion: d.docVersion }));
    const sb = await val(mock.runStoryboard(EXAMPLE, { clientRequestId: "key-s1-0000", docVersion: d.docVersion, episodeNo: 2 }));
    await vi.advanceTimersByTimeAsync(3000);
    const runs = await val(mock.getRuns(EXAMPLE, [ex.id, sb.id]));
    const byId = new Map<string, DramaCanvasRun>(runs.map((r) => [r.id, r]));
    const extract = byId.get(ex.id)!.result!.extract!;
    expect(extract.characters.length).toBeGreaterThanOrEqual(3);
    expect(extract.characters.length).toBeLessThanOrEqual(4);
    expect(extract.scenes).toHaveLength(3);
    for (const c of extract.characters) expect(c.looks.length).toBeGreaterThanOrEqual(1);

    const segs = byId.get(sb.id)!.result!.storyboard!.segments;
    expect(segs.length).toBeGreaterThanOrEqual(3);
    const ids = new Set(d.doc.characters.flatMap((c) => c.looks.map((l) => l.id)));
    const refIds = segs.flatMap((s) => [...s.text.matchAll(/\(look:([A-Za-z0-9_-]+)\)/g)].map((m) => m[1]));
    expect(refIds.length).toBeGreaterThan(0);
    for (const id of refIds) expect(ids.has(id)).toBe(true);
    for (const s of segs) expect(s.durationSec).toBeLessThanOrEqual(10);
  });

  it("视频带末帧、按秒计价；合成要求每个片段都有视频", async () => {
    const d: DramaCanvasDetail = await val(mock.get(EXAMPLE));
    const v = await val(mock.runVideo(EXAMPLE, { clientRequestId: "key-v1-0000", docVersion: d.docVersion, episodeNo: 1, segmentId: "sg_ex1_01" }));
    expect(v.cost).toBe(6 * 10);
    await vi.advanceTimersByTimeAsync(3500);
    const [done] = await val(mock.getRuns(EXAMPLE, [v.id]));
    expect(done.result?.video?.lastFrameKey).toBeTruthy();
    expect(done.result?.video?.url).toBe("/videos/showreel-01.mp4");

    const a = await settle(mock.runAssemble(EXAMPLE, { clientRequestId: "key-a1-0000", docVersion: d.docVersion, episodeNo: 1 }));
    expect(a.ok).toBe(false);
    if (!a.ok) expect(a.e.code).toBe("DRAMA_CANVAS_NOTHING_TO_ASSEMBLE");
  });

  it("取消：排队中的能取消；已经开始的 409", async () => {
    const d = await val(mock.get(EXAMPLE));
    // 预置的片段 03 视频在排队
    const canceled = await val(mock.cancelRun(EXAMPLE, "dcr_ex_v3"));
    expect(canceled.status).toBe("canceled");

    const r = await val(mock.runImage(EXAMPLE, { clientRequestId: "key-c1-0000", docVersion: d.docVersion, target: { kind: "scene", id: "sc_ex_bus" }, count: 1 }));
    await vi.advanceTimersByTimeAsync(400); // 过了排队阶段
    const late = await settle(mock.cancelRun(EXAMPLE, r.id));
    expect(late.ok).toBe(false);
    if (!late.ok) expect([late.e.code, late.e.status]).toEqual(["DRAMA_CANVAS_RUN_NOT_CANCELABLE", 409]);
  });

  it("提示词里写了「测试失败」：这次生成失败，带错误码", async () => {
    const d = await val(mock.get(EXAMPLE));
    const doc = { ...d.doc, scenes: d.doc.scenes.map((s) => (s.id === "sc_ex_terminal" ? { ...s, prompt: `${s.prompt} 测试失败` } : s)) };
    const saved = await val(mock.save(EXAMPLE, { doc, baseDocVersion: d.docVersion }));
    const r = await val(mock.runImage(EXAMPLE, { clientRequestId: "key-f1-0000", docVersion: saved.docVersion, target: { kind: "scene", id: "sc_ex_terminal" }, count: 1 }));
    await vi.advanceTimersByTimeAsync(3000);
    const [done] = await val(mock.getRuns(EXAMPLE, [r.id]));
    expect(done.status).toBe("failed");
    expect(done.errorCode).toBeTruthy();
    expect(done.result).toBeUndefined();
  });
});
