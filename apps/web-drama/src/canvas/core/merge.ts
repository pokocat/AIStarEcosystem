// ─────────────────────────────────────────────────────────────────────────────
// canvas/core/merge.ts —— 把生成结果合回文档（v0.198，契约见 contract.ts「merge.ts」一节）。
//
// 服务端从不改文档（drama-canvas.ts 红线 3）：生成结果在运行记录里，前端拿到后用这里的函数合进文档再保存。
// 组件里不许再写一份「把结果塞进文档」的逻辑（§8.0.1 ④），全走这里。
//
// 全部是纯函数、幂等（同一次运行合两次，第二次原样返回入参）、不改入参。
//
// 运行引用（CanvasRunRef）的约定：
//   · applyRunRef 只写「在跑」的状态（queued / running）。运行已经是终态时也写成 running ——
//     **终态只由 applyRunResult 写**，写上终态 = 这次的结果已经合进来了（幂等靠它判断）。
//   · 引用指向的不是这次运行（用户又点了一次、新的一次顶掉了它）：
//       文字类（剧本 / 拆角色场景 / 分镜脚本 / 合成）不合内容 —— 旧结果盖掉新结果是错的；
//       图和视频照样合进候选（按 key 去重）—— 钱已经花了，图是真的，让用户自己挑。
// ─────────────────────────────────────────────────────────────────────────────

import type {
  CanvasAsset,
  CanvasCharacter,
  CanvasImageSet,
  CanvasLook,
  CanvasRunRef,
  CanvasScene,
  CanvasScript,
  CanvasScriptEpisode,
  CanvasScriptVersion,
  CanvasSegment,
  DramaCanvasDoc,
  DramaCanvasRun,
  DramaCanvasRunStatus,
  DramaCanvasRunTarget,
} from "@ai-star-eco/types/drama-canvas";
import { derivedId, newId } from "./ids";
import { totalDuration } from "./refs";
import {
  BASE_LOOK_NAME,
  ensureEpisode,
  findEpisode,
  findLook,
  findMaterial,
  findScene,
  findSegment,
  mapEpisode,
  mapLook,
  mapMaterial,
  mapScene,
  mapSegment,
  parseRunTarget,
  type ParsedRunTarget,
} from "./doc-ops";

/** 剧本修改记录最多留几版（超出丢最老的）。 */
export const SCRIPT_HISTORY_LIMIT = 10;

const TERMINAL: ReadonlySet<DramaCanvasRunStatus> = new Set(["succeeded", "failed", "canceled"]);

export function isTerminalStatus(status: DramaCanvasRunStatus | undefined): boolean {
  return !!status && TERMINAL.has(status);
}

// ── 读 / 写某个目标上的运行引用 ──────────────────────────────────────────────

/** 文档里某个目标当前挂着的运行引用。 */
export function runRefAt(doc: DramaCanvasDoc, target: DramaCanvasRunTarget | string): CanvasRunRef | undefined {
  const t = parseRunTarget(target);
  if (!t) return undefined;
  switch (t.kind) {
    case "script:setting":
      return doc.script.setting?.run;
    case "script:outline":
      return doc.script.outline?.run;
    case "script:episode":
      return doc.script.episodes.find((e) => e.no === t.no)?.run;
    case "extract":
      return doc.script.extractRun;
    case "look":
      return findLook(doc, t.id)?.look.run;
    case "scene":
      return findScene(doc, t.id)?.run;
    case "material":
      return findMaterial(doc, t.id)?.run;
    case "frame":
      return findSegment(doc, t.no, t.segmentId)?.frameRun;
    case "video":
      return findSegment(doc, t.no, t.segmentId)?.videoRun;
    case "storyboard":
      return findEpisode(doc, t.no)?.storyboardRun;
    case "assemble":
      return findEpisode(doc, t.no)?.assembleRun;
  }
}

const sameRef = (a: CanvasRunRef | undefined, b: CanvasRunRef) => !!a && a.runId === b.runId && a.status === b.status;

function withScript(doc: DramaCanvasDoc, fn: (s: CanvasScript) => CanvasScript): DramaCanvasDoc {
  const script = fn(doc.script);
  return script === doc.script ? doc : { ...doc, script };
}

/** 剧本分集：找不到这一集就按集号插一条（标题取分集剧情里的，没有就「第 N 集」）。 */
function upsertScriptEpisode(
  script: CanvasScript,
  no: number,
  fn: (e: CanvasScriptEpisode) => CanvasScriptEpisode,
): CanvasScript {
  const i = script.episodes.findIndex((e) => e.no === no);
  if (i >= 0) {
    const next = fn(script.episodes[i]);
    if (next === script.episodes[i]) return script;
    const episodes = script.episodes.slice();
    episodes[i] = next;
    return { ...script, episodes };
  }
  const title = script.outline?.episodes.find((e) => e.no === no)?.title?.trim() || `第 ${no} 集`;
  const created = fn({ no, title, text: "" });
  const episodes = [...script.episodes, created].sort((a, b) => a.no - b.no);
  return { ...script, episodes };
}

/** 把运行引用写到目标上（目标不存在时 —— 如造型已被删 —— 原样返回）。 */
function writeRef(doc: DramaCanvasDoc, t: ParsedRunTarget, ref: CanvasRunRef): DramaCanvasDoc {
  switch (t.kind) {
    case "script:setting":
      return withScript(doc, (s) =>
        sameRef(s.setting?.run, ref) ? s : { ...s, setting: { ...(s.setting ?? { text: "" }), run: ref } },
      );
    case "script:outline":
      return withScript(doc, (s) =>
        sameRef(s.outline?.run, ref) ? s : { ...s, outline: { ...(s.outline ?? { episodes: [] }), run: ref } },
      );
    case "script:episode":
      return withScript(doc, (s) => upsertScriptEpisode(s, t.no, (e) => (sameRef(e.run, ref) ? e : { ...e, run: ref })));
    case "extract":
      return withScript(doc, (s) => (sameRef(s.extractRun, ref) ? s : { ...s, extractRun: ref }));
    case "look":
      return mapLook(doc, t.id, (l) => (sameRef(l.run, ref) ? l : { ...l, run: ref }));
    case "scene":
      return mapScene(doc, t.id, (s) => (sameRef(s.run, ref) ? s : { ...s, run: ref }));
    case "material":
      return mapMaterial(doc, t.id, (m) => (sameRef(m.run, ref) ? m : { ...m, run: ref }));
    case "frame":
      return mapSegment(doc, t.no, t.segmentId, (s) => (sameRef(s.frameRun, ref) ? s : { ...s, frameRun: ref }));
    case "video":
      return mapSegment(doc, t.no, t.segmentId, (s) => (sameRef(s.videoRun, ref) ? s : { ...s, videoRun: ref }));
    case "storyboard":
      return mapEpisode(ensureEpisode(doc, t.no), t.no, (e) => (sameRef(e.storyboardRun, ref) ? e : { ...e, storyboardRun: ref }));
    case "assemble":
      return mapEpisode(ensureEpisode(doc, t.no), t.no, (e) => (sameRef(e.assembleRun, ref) ? e : { ...e, assembleRun: ref }));
  }
}

/**
 * 把 {runId, status} 写到 run.target 对应的位置（提交成功后、轮询到状态变化时调）。
 * 只写在跑的状态；运行已是终态时写 running，等 applyRunResult 合完结果再写终态。
 * 这个位置已经记着这次运行的终态（结果合过了）→ 原样返回。
 */
export function applyRunRef(doc: DramaCanvasDoc, run: DramaCanvasRun): DramaCanvasDoc {
  const t = parseRunTarget(run.target);
  if (!t) return doc;
  const cur = runRefAt(doc, run.target);
  if (cur?.runId === run.id && isTerminalStatus(cur.status)) return doc;
  const status: DramaCanvasRunStatus = isTerminalStatus(run.status) ? "running" : run.status;
  if (cur?.runId === run.id && cur.status === status) return doc;
  return writeRef(doc, t, { runId: run.id, status });
}

// ── 剧本修改记录 ─────────────────────────────────────────────────────────────

function snapshotScript(script: CanvasScript, label: string, at: string, id: string): CanvasScriptVersion {
  return {
    id,
    at,
    label,
    ...(script.setting ? { setting: script.setting.text } : {}),
    ...(script.outline ? { outline: script.outline.episodes.map((e) => ({ ...e })) } : {}),
    episodes: script.episodes.map((e) => ({ no: e.no, title: e.title, text: e.text })),
  };
}

function pushVersion(script: CanvasScript, version: CanvasScriptVersion): CanvasScript {
  if (script.history.some((h) => h.id === version.id)) return script;
  return { ...script, history: [version, ...script.history].slice(0, SCRIPT_HISTORY_LIMIT) };
}

/**
 * 剧本存一版（最新的在 history[0]，最多 10 版）。「通过」和 AI 覆盖正文前都要调；
 * AI 覆盖正文的那一次 applyRunResult 已经自己存了，不用再调。
 */
export function pushScriptHistory(
  doc: DramaCanvasDoc,
  label: string,
  at: string = new Date().toISOString(),
  id: string = newId("history"),
): DramaCanvasDoc {
  return withScript(doc, (s) => pushVersion(s, snapshotScript(s, label, at, id)));
}

/**
 * 恢复到某一版（恢复前先把现在的存一版）。锁着的集照样恢复 —— 锁只挡 AI 重写，不挡用户自己的决定；
 * 各集的锁和运行引用按集号保留。找不到这一版时原样返回。
 */
export function restoreScriptVersion(
  doc: DramaCanvasDoc,
  versionId: string,
  at: string = new Date().toISOString(),
): DramaCanvasDoc {
  const version = doc.script.history.find((h) => h.id === versionId);
  if (!version) return doc;
  const saved = pushScriptHistory(doc, `恢复到「${version.label}」之前`, at);
  return withScript(saved, (s) => {
    const byNo = new Map(s.episodes.map((e) => [e.no, e]));
    const next: CanvasScript = {
      ...s,
      episodes: version.episodes.map((v) => {
        const cur = byNo.get(v.no);
        return {
          no: v.no,
          title: v.title,
          text: v.text,
          ...(cur?.locked ? { locked: true } : {}),
          ...(cur?.run ? { run: cur.run } : {}),
        };
      }),
    };
    if (version.setting !== undefined) next.setting = { ...(s.setting ?? {}), text: version.setting };
    if (version.outline !== undefined) next.outline = { ...(s.outline ?? {}), episodes: version.outline.map((e) => ({ ...e })) };
    return next;
  });
}

// ── 合并各类结果 ─────────────────────────────────────────────────────────────

const finishedAt = (run: DramaCanvasRun) => run.finishedAt ?? run.createdAt;
const historyIdFor = (run: DramaCanvasRun) => derivedId("history", run.id);

/** 图：新的放最前面并挑中新的第一张；已有的 key 跳过（幂等）。没有新图 → 原样返回。 */
function mergeImages(set: CanvasImageSet | undefined, images: CanvasAsset[] | undefined, runId: string): CanvasImageSet | undefined {
  const base = set ?? { versions: [] };
  const known = new Set(base.versions.map((v) => v.key));
  const fresh: CanvasAsset[] = [];
  for (const img of images ?? []) {
    if (!img?.key || known.has(img.key)) continue;
    known.add(img.key);
    fresh.push({ key: img.key, ...(img.url ? { url: img.url } : {}), runId: img.runId ?? runId });
  }
  if (!fresh.length) return set;
  return { versions: [...fresh, ...base.versions], pickedKey: fresh[0].key };
}

const normName = (s: string) => s.trim().replace(/\s+/g, " ").toLowerCase();

function unionEpisodes(a: number[], b: number[]): number[] {
  const set = new Set(a);
  let added = false;
  for (const n of b) {
    if (Number.isInteger(n) && n > 0 && !set.has(n)) {
      set.add(n);
      added = true;
    }
  }
  return added ? [...set].sort((x, y) => x - y) : a;
}

const cleanEpisodes = (list: number[] | undefined) =>
  [...new Set((list ?? []).filter((n) => Number.isInteger(n) && n > 0))].sort((a, b) => a - b);

/**
 * 拆出角色和场景的合并：角色按名字、造型按（角色名 + 造型名）、场景按名字。
 * 已有的保留不动（只补出现集数），新的追加并分配 id（由运行 id 派生，合两次得到同一个 id）。
 */
function mergeExtract(doc: DramaCanvasDoc, run: DramaCanvasRun): DramaCanvasDoc {
  const ex = run.result?.extract;
  if (!ex) return doc;
  let characters = doc.characters;
  ex.characters.forEach((ec, ci) => {
    const name = ec.name?.trim();
    if (!name) return;
    const idx = characters.findIndex((c) => normName(c.name) === normName(name));
    if (idx >= 0) {
      const cur = characters[idx];
      let looks = cur.looks;
      ec.looks.forEach((el, li) => {
        const lookName = el.name?.trim() || BASE_LOOK_NAME;
        const li2 = looks.findIndex((l) => normName(l.name) === normName(lookName));
        if (li2 >= 0) {
          const episodes = unionEpisodes(looks[li2].episodes, el.episodes ?? []);
          if (episodes !== looks[li2].episodes) {
            looks = looks.slice();
            looks[li2] = { ...looks[li2], episodes };
          }
        } else {
          looks = [
            ...looks,
            {
              id: derivedId("look", run.id, ci, li),
              name: lookName,
              prompt: el.prompt ?? "",
              episodes: cleanEpisodes(el.episodes),
              images: { versions: [] },
            },
          ];
        }
      });
      if (looks !== cur.looks) {
        characters = characters.slice();
        characters[idx] = { ...cur, looks };
      }
      return;
    }
    const looks: CanvasLook[] = ec.looks.length
      ? ec.looks.map((el, li) => ({
          id: derivedId("look", run.id, ci, li),
          name: el.name?.trim() || BASE_LOOK_NAME,
          prompt: el.prompt ?? "",
          episodes: cleanEpisodes(el.episodes),
          images: { versions: [] },
        }))
      : [{ id: derivedId("look", run.id, ci, 0), name: BASE_LOOK_NAME, prompt: "", episodes: [], images: { versions: [] } }];
    const created: CanvasCharacter = {
      id: derivedId("character", run.id, ci),
      name,
      role: ec.role ?? "support",
      ...(ec.bio ? { bio: ec.bio } : {}),
      looks,
    };
    characters = [...characters, created];
  });

  let scenes = doc.scenes;
  ex.scenes.forEach((es, si) => {
    const name = es.name?.trim();
    if (!name) return;
    const idx = scenes.findIndex((s) => normName(s.name) === normName(name));
    if (idx >= 0) {
      const episodes = unionEpisodes(scenes[idx].episodes, es.episodes ?? []);
      if (episodes !== scenes[idx].episodes) {
        scenes = scenes.slice();
        scenes[idx] = { ...scenes[idx], episodes };
      }
      return;
    }
    const created: CanvasScene = {
      id: derivedId("scene", run.id, si),
      name,
      prompt: es.prompt ?? "",
      episodes: cleanEpisodes(es.episodes),
      images: { versions: [] },
    };
    scenes = [...scenes, created];
  });

  const at = finishedAt(run);
  const next: DramaCanvasDoc =
    characters === doc.characters && scenes === doc.scenes && doc.script.extractedAt === at
      ? doc
      : { ...doc, characters, scenes, script: { ...doc.script, extractedAt: at } };
  return next;
}

/** 分镜脚本：整集片段替换（已有首帧 / 视频时由界面在提交前先确认）。片段 id 由运行 id 派生。 */
function mergeStoryboard(doc: DramaCanvasDoc, run: DramaCanvasRun, no: number): DramaCanvasDoc {
  const sb = run.result?.storyboard;
  if (!sb) return doc;
  const segments: CanvasSegment[] = sb.segments.map((s, i) => ({
    id: derivedId("segment", run.id, i),
    text: s.text ?? "",
    durationSec: s.durationSec > 0 ? Math.round(s.durationSec) : totalDuration(s.text ?? ""),
    frame: { versions: [] },
    video: { versions: [] },
  }));
  return mapEpisode(ensureEpisode(doc, no), no, (e) => ({ ...e, segments }));
}

/** 文字类剧本结果（故事大纲 / 分集剧情 / 某一集剧本）。覆盖已有正文前先存一版修改记录。 */
function mergeScript(doc: DramaCanvasDoc, run: DramaCanvasRun, t: ParsedRunTarget): DramaCanvasDoc {
  const r = run.result;
  const at = finishedAt(run);
  if (t.kind === "script:setting" && r?.setting) {
    const old = doc.script.setting?.text ?? "";
    const base = old.trim() && old !== r.setting.text ? pushScriptHistory(doc, "重写故事大纲前", at, historyIdFor(run)) : doc;
    return withScript(base, (s) => ({ ...s, setting: { text: r.setting!.text, ...(s.setting?.run ? { run: s.setting.run } : {}) } }));
  }
  if (t.kind === "script:outline" && r?.outline) {
    const had = (doc.script.outline?.episodes.length ?? 0) > 0;
    const base = had ? pushScriptHistory(doc, "重写分集剧情前", at, historyIdFor(run)) : doc;
    return withScript(base, (s) => ({
      ...s,
      outline: { episodes: r.outline!.episodes.map((e) => ({ ...e })), ...(s.outline?.run ? { run: s.outline.run } : {}) },
    }));
  }
  if (t.kind === "script:episode" && r?.episode) {
    const no = t.no;
    const cur = doc.script.episodes.find((e) => e.no === no);
    if (cur?.locked) return doc; // 锁上的集不被 AI 覆盖（服务端本来也会拒，这里再守一道）
    const old = cur?.text ?? "";
    const base =
      old.trim() && old !== r.episode.text ? pushScriptHistory(doc, `重写第 ${no} 集前`, at, historyIdFor(run)) : doc;
    return withScript(base, (s) =>
      upsertScriptEpisode(s, no, (e) => ({ ...e, title: r.episode!.title?.trim() || e.title, text: r.episode!.text })),
    );
  }
  return doc;
}

/**
 * 运行到了终态时合并结果（succeeded）或只更新状态（failed / canceled）。还没到终态时只更新引用上的状态。
 * 幂等：同一次运行合两次，第二次原样返回入参。
 */
export function applyRunResult(doc: DramaCanvasDoc, run: DramaCanvasRun): DramaCanvasDoc {
  const t = parseRunTarget(run.target);
  if (!t) return doc;
  const cur = runRefAt(doc, run.target);
  const own = cur?.runId === run.id;

  if (!isTerminalStatus(run.status)) {
    if (!own || isTerminalStatus(cur?.status) || cur?.status === run.status) return doc;
    return writeRef(doc, t, { runId: run.id, status: run.status });
  }

  // 这个位置已经记着这次运行的终态：
  //   · 记的是 succeeded = 成功结果合过了。图也不再合：用户可能已经删掉过其中几张候选，刷新后接回时不能又加回来；
  //   · 记的是 failed / canceled、这次来的还是失败 = 失败记过了，不用再动；
  //   · 记的是 failed / canceled、这次来的是 succeeded = 服务端对账把同一次运行恢复成了成功（视频误判失败后
  //     管理端对账恢复）→ 照样合一次（成功结果仍按 key / runId 去重）。
  if (own && isTerminalStatus(cur?.status) && (cur?.status === "succeeded" || run.status !== "succeeded")) return doc;
  let next = doc;

  if (run.status === "succeeded") {
    switch (t.kind) {
      // 图 / 视频：引用被新的一次顶掉了也照样按 key 去重合进候选（钱花了、图是真的）
      case "look":
        next = mapLook(next, t.id, (l) => {
          const images = mergeImages(l.images, run.result?.images, run.id);
          return images && images !== l.images ? { ...l, images } : l;
        });
        break;
      case "scene":
        next = mapScene(next, t.id, (s) => {
          const images = mergeImages(s.images, run.result?.images, run.id);
          return images && images !== s.images ? { ...s, images } : s;
        });
        break;
      case "material":
        next = mapMaterial(next, t.id, (m) => {
          if (m.kind !== "image") return m;
          const images = mergeImages(m.images, run.result?.images, run.id);
          return images && images !== m.images ? { ...m, images } : m;
        });
        break;
      case "frame":
        next = mapSegment(next, t.no, t.segmentId, (s) => {
          const frame = mergeImages(s.frame, run.result?.images, run.id);
          return frame && frame !== s.frame ? { ...s, frame } : s;
        });
        break;
      case "video": {
        const v = run.result?.video;
        if (v?.key) {
          next = mapSegment(next, t.no, t.segmentId, (s) => {
            if (s.video.versions.some((x) => x.key === v.key)) return s;
            return { ...s, video: { versions: [{ ...v, runId: v.runId || run.id }, ...s.video.versions], pickedKey: v.key } };
          });
        }
        break;
      }
      // 文字类：只合「引用还指着这次、且还没合过」的
      case "script:setting":
      case "script:outline":
      case "script:episode":
        if (own) next = mergeScript(next, run, t);
        break;
      case "extract":
        if (own) next = mergeExtract(next, run);
        break;
      case "storyboard":
        if (own) next = mergeStoryboard(next, run, t.no);
        break;
      case "assemble": {
        const a = run.result?.assembled;
        if (own && a?.key) {
          next = mapEpisode(ensureEpisode(next, t.no), t.no, (e) =>
            e.assembled?.runId === (a.runId || run.id) && e.assembled.key === a.key ? e : { ...e, assembled: { ...a, runId: a.runId || run.id } },
          );
        }
        break;
      }
    }
  }

  if (own) next = writeRef(next, t, { runId: run.id, status: run.status });
  return next;
}

// ── 文档里所有运行引用 ───────────────────────────────────────────────────────

/** 文档里挂着的所有运行引用（进页时据此接回：GET runs?ids=）。 */
export function collectRunRefs(doc: DramaCanvasDoc): { target: DramaCanvasRunTarget; ref: CanvasRunRef }[] {
  const out: { target: DramaCanvasRunTarget; ref: CanvasRunRef }[] = [];
  const push = (target: DramaCanvasRunTarget, ref: CanvasRunRef | undefined) => {
    if (ref?.runId) out.push({ target, ref });
  };
  const s = doc.script;
  push("script:setting", s.setting?.run);
  push("script:outline", s.outline?.run);
  for (const e of s.episodes) push(`script:episode:${e.no}`, e.run);
  push("extract", s.extractRun);
  for (const c of doc.characters) for (const l of c.looks) push(`look:${l.id}`, l.run);
  for (const sc of doc.scenes) push(`scene:${sc.id}`, sc.run);
  for (const m of doc.materials) push(`material:${m.id}`, m.run);
  for (const ep of doc.episodes) {
    push(`storyboard:${ep.no}`, ep.storyboardRun);
    push(`assemble:${ep.no}`, ep.assembleRun);
    for (const seg of ep.segments) {
      push(`frame:${ep.no}:${seg.id}`, seg.frameRun);
      push(`video:${ep.no}:${seg.id}`, seg.videoRun);
    }
  }
  return out;
}
