"use client";

// ─────────────────────────────────────────────────────────────────────────────
// canvas/assets/asset-list-view.tsx —— 角色和场景 · 列表（v0.198，真源 docs/drama-canvas-plan.md §2.4）。
//
//   角色和场景                                   3 个角色 · 3 个场景
//   [角色 3] [场景 3] [素材 2]      [搜索] [全部集 ▾] [多选] [加一个角色]
//   卡片网格（角色竖版定妆照 / 场景图 / 素材图或文字）
//   底部：提示条（剧本 ← → 逐集制作）；多选时换成「为选中的 N 个出图 ✦M」
//
// 点卡片：桌面上点角色 / 场景 → onLocate(`character:<id>` / `scene:<id>`)（page 切到画布并定位）；
// 手机上（≤720）→ 抽屉（造型列表 + 出图面板）；素材卡任何宽度都开抽屉。
// ─────────────────────────────────────────────────────────────────────────────

import * as React from "react";
import Link from "next/link";
import { CheckSquare, ImagePlus, Plus, Search, Type, X } from "lucide-react";
import type { DramaCanvasRunStatus } from "@ai-star-eco/types/drama-canvas";
import {
  RunTarget,
  addCharacter,
  addMaterial,
  addScene,
  findLook,
  findMaterial,
  findScene,
  useCanvasDoc,
  useCanvasPricing,
  useCanvasRuns,
} from "@/canvas/core";
import { CanvasNextBar, DesktopHint } from "@/canvas/shell";
import { dramaConfirm } from "@/components/drama-ui/confirm-dialog";
import { toast } from "@/lib/toast";
import { AssetDrawer, type DrawerTarget } from "./asset-drawers";
import { assetRunView, READ_ONLY_REASON, useNarrow, withSubmitting } from "./bits";
import { CharacterCard, MaterialCard, SceneCard, type RunOf } from "./cards";
import { NameDialog } from "./inputs";
import {
  batchLimitReason,
  episodeOptions,
  filterCharacters,
  filterMaterials,
  filterScenes,
  planBatch,
  skippedText,
  type BatchPick,
} from "./list-ops";

export type AssetTab = "characters" | "scenes" | "materials";
export const ASSET_TABS: AssetTab[] = ["characters", "scenes", "materials"];

export interface AssetListViewProps {
  tab: AssetTab;
  onTabChange: (tab: AssetTab) => void;
  /**
   * 桌面上点角色 / 场景卡：切到画布并定位（focus = `character:<id>` / `scene:<id>`）。
   * 不传、或者窄屏（≤720，手机上没有画布）时改开抽屉。
   */
  onLocate?: (focus: string) => void;
  /**
   * 进页时带着 `?focus=`（look:<id> / scene:<id> / character:<id> / material:<id>）却停在列表上
   * （手机上打开了画布的链接）：打开这一项的抽屉。
   */
  focus?: string;
}

/** focus 字符串 → 抽屉目标（认不得、或者东西已经不在了返回 null）。 */
function drawerOfFocus(doc: ReturnType<typeof useCanvasDoc>["doc"], focus: string | undefined): DrawerTarget | null {
  if (!focus) return null;
  const at = focus.indexOf(":");
  const kind = focus.slice(0, at);
  const id = focus.slice(at + 1);
  if (at < 0 || !id) return null;
  if (kind === "look") {
    const hit = findLook(doc, id);
    return hit ? { kind: "character", id: hit.character.id, lookId: id } : null;
  }
  if (kind === "character") return doc.characters.some((c) => c.id === id) ? { kind: "character", id } : null;
  if (kind === "scene") return findScene(doc, id) ? { kind: "scene", id } : null;
  if (kind === "material") return findMaterial(doc, id) ? { kind: "material", id } : null;
  return null;
}

/** 选中的东西：`look:<id>` / `scene:<id>`。 */
type SelKey = `look:${string}` | `scene:${string}`;

export function AssetListView({ tab, onTabChange, onLocate, focus }: AssetListViewProps) {
  const { canvasId, doc, meta, update, readOnly, getDoc } = useCanvasDoc();
  const { runFor, submit, isSubmitting } = useCanvasRuns();
  const pricing = useCanvasPricing();
  const narrow = useNarrow();

  const [query, setQuery] = React.useState("");
  const [episode, setEpisode] = React.useState<number | null>(null);
  const [selectMode, setSelectMode] = React.useState(false);
  const [selected, setSelected] = React.useState<ReadonlySet<SelKey>>(new Set());
  const [drawer, setDrawer] = React.useState<DrawerTarget | null>(null);
  const [adding, setAdding] = React.useState<"character" | "scene" | null>(null);
  const [batchBusy, setBatchBusy] = React.useState(false);
  const batchLock = React.useRef(false);

  // 带着 focus 进来：打开那一项（同一个 focus 只开一次，关掉之后不再弹）
  const handledFocus = React.useRef<string | undefined>(undefined);
  React.useEffect(() => {
    if (!focus || handledFocus.current === focus) return;
    handledFocus.current = focus;
    const t = drawerOfFocus(getDoc(), focus);
    if (t) setDrawer(t);
  }, [focus, getDoc]);

  const runOf: RunOf = React.useCallback(
    (kind, id) => {
      const d = getDoc();
      // 提交中（请求还没回来）和 queued / running 一起算生成中：卡片显示「生成中」，批量出图跳过它
      if (kind === "look") {
        const t = RunTarget.look(id);
        return withSubmitting(assetRunView(runFor(t), findLook(d, id)?.look.run), isSubmitting(t));
      }
      if (kind === "scene") {
        const t = RunTarget.scene(id);
        return withSubmitting(assetRunView(runFor(t), findScene(d, id)?.run), isSubmitting(t));
      }
      const t = RunTarget.material(id);
      return withSubmitting(assetRunView(runFor(t), findMaterial(d, id)?.run), isSubmitting(t));
    },
    // doc 变了也要重算（卡片上的状态读文档里的引用）
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [runFor, isSubmitting, getDoc, doc],
  );

  const eps = episodeOptions(doc);
  const filter = { episode, query };
  const characters = filterCharacters(doc.characters, filter);
  const scenes = filterScenes(doc.scenes, filter);
  const materials = filterMaterials(doc.materials, filter);
  const filtered = query.trim() !== "" || episode != null;
  const lookSelected = React.useMemo(
    () => new Set([...selected].filter((k) => k.startsWith("look:")).map((k) => k.slice(5))),
    [selected],
  );

  // 选中的东西被删掉了：从选择里拿掉
  React.useEffect(() => {
    setSelected((cur) => {
      const next = new Set([...cur].filter((k) => (k.startsWith("look:") ? !!findLook(doc, k.slice(5)) : !!findScene(doc, k.slice(6)))));
      return next.size === cur.size ? cur : next;
    });
  }, [doc]);

  const toggle = (key: SelKey) =>
    setSelected((cur) => {
      const next = new Set(cur);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  const setMany = (keys: SelKey[], on: boolean) =>
    setSelected((cur) => {
      const next = new Set(cur);
      for (const k of keys) if (on) next.add(k);
      else next.delete(k);
      return next;
    });
  const exitSelect = () => {
    setSelectMode(false);
    setSelected(new Set());
  };

  const open = (kind: "character" | "scene", id: string) => {
    if (!narrow && onLocate) onLocate(`${kind}:${id}`);
    else setDrawer({ kind, id });
  };

  // ── 批量出图 ───────────────────────────────────────────────────────────────
  const picks: BatchPick[] = [...selected].map((k) => (k.startsWith("look:") ? { kind: "look", id: k.slice(5) } : { kind: "scene", id: k.slice(6) }));
  const statusOf = (p: BatchPick): DramaCanvasRunStatus | undefined => runOf(p.kind, p.id).status;
  const plan = planBatch(doc, picks, statusOf);
  const n = plan.items.length;
  const total = pricing.imagePrice(Math.max(1, n));
  const skipped = skippedText(plan.skipped);
  /** 超过服务端上限（20 项 / 40 张）：按钮禁用、就地说原因，不截断、不自动分批。 */
  const overLimit = batchLimitReason(plan.items);

  const runBatch = async () => {
    if (!n || overLimit || batchLock.current || readOnly) return;
    batchLock.current = true;
    try {
      await runBatchOnce();
    } finally {
      batchLock.current = false;
    }
  };

  const runBatchOnce = async () => {
    const ok = await dramaConfirm({
      title: `为选中的 ${n} 个出图？`,
      body: `每个出 1 张，共 ${n} 张，用默认出图模型。${skipped ?? ""}生成失败的那几张会退回积分。`,
      cost: total,
      confirmLabel: "确认生成",
    });
    if (!ok) return;
    setBatchBusy(true);
    try {
      // 提交那一刻按最新文档再算一遍（确认框开着的时候可能有东西被删 / 开始生成）；
      // 只会比确认时少、不会多（确认框里报的价是上限）
      const confirmed = new Set(plan.items.map((i) => `${i.target.kind}:${(i.target as { id: string }).id}`));
      const items = planBatch(getDoc(), picks, statusOf).items.filter((i) => confirmed.has(`${i.target.kind}:${(i.target as { id: string }).id}`));
      if (!items.length || batchLimitReason(items)) return;
      const res = await submit({ kind: "image-batch", body: { items } });
      if (res.ok) {
        toast.success(`已开始生成 ${items.length} 张`, { description: "生成好的会直接出现在卡片上。" });
        exitSelect();
      } else {
        toast.error("没开始生成", { description: res.message });
      }
    } finally {
      setBatchBusy(false);
    }
  };

  // ── 加东西 ─────────────────────────────────────────────────────────────────
  const addMat = (kind: "image" | "text") => {
    let id = "";
    update((d) => {
      const r = addMaterial(d, kind);
      id = r.id;
      return r.doc;
    });
    if (id) setDrawer({ kind: "material", id });
  };

  const selectAllVisible = () => {
    if (tab === "characters") setMany(characters.flatMap((c) => c.looks.map((l) => `look:${l.id}` as SelKey)), true);
    else if (tab === "scenes") setMany(scenes.map((s) => `scene:${s.id}` as SelKey), true);
  };

  const id = encodeURIComponent(canvasId);
  const lookCount = doc.characters.reduce((k, c) => k + c.looks.length, 0);

  return (
    <div className="cv-page cva-page">
      <DesktopHint storageKey="assets">电脑上可以切到「画布」，把角色、场景和参考图连起来看。</DesktopHint>
      <div className="cva-head">
        <h1 className="cv-page-title cva-title">角色和场景</h1>
        <div className="cva-head-count">
          {doc.characters.length} 个角色 · {doc.scenes.length} 个场景
          {doc.materials.length > 0 ? ` · ${doc.materials.length} 个素材` : ""}
        </div>
      </div>

      <div className="cva-toolbar">
        <div className="cva-tabs" role="tablist" aria-label="看哪一类">
          {(
            [
              ["characters", "角色", doc.characters.length],
              ["scenes", "场景", doc.scenes.length],
              ["materials", "素材", doc.materials.length],
            ] as const
          ).map(([key, label, count]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={tab === key}
              className={`cva-tab${tab === key ? " on" : ""}`}
              onClick={() => onTabChange(key)}
            >
              {label} <span className="num">{count}</span>
            </button>
          ))}
        </div>
        <div className="cva-tools">
          <label className="cva-search">
            <Search size={14} />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="搜名字或描述" aria-label="搜索" />
            {query && (
              <button type="button" className="cva-search-x" aria-label="清空搜索" onClick={() => setQuery("")}>
                <X size={12} />
              </button>
            )}
          </label>
          {tab !== "materials" && (
            <select
              className="cv-select cva-ep-select"
              value={episode ?? ""}
              onChange={(e) => setEpisode(e.target.value ? Number(e.target.value) : null)}
              aria-label="只看出现在某一集的"
              disabled={!eps.length}
            >
              <option value="">全部集</option>
              {eps.map((no) => (
                <option key={no} value={no}>
                  第 {no} 集
                </option>
              ))}
            </select>
          )}
          {tab !== "materials" && (
            <button
              type="button"
              className={`btn btn-sm ${selectMode ? "btn-primary" : "btn-line"}`}
              aria-pressed={selectMode}
              disabled={readOnly && !selectMode}
              onClick={() => (selectMode ? exitSelect() : setSelectMode(true))}
            >
              <CheckSquare size={14} />
              {selectMode ? "退出多选" : "多选"}
            </button>
          )}
          {tab === "characters" && (
            <button type="button" className="btn btn-line btn-sm" disabled={readOnly} onClick={() => setAdding("character")}>
              <Plus size={14} /> 加一个角色
            </button>
          )}
          {tab === "scenes" && (
            <button type="button" className="btn btn-line btn-sm" disabled={readOnly} onClick={() => setAdding("scene")}>
              <Plus size={14} /> 加一个场景
            </button>
          )}
          {tab === "materials" && (
            <>
              <button type="button" className="btn btn-line btn-sm" disabled={readOnly} onClick={() => addMat("image")}>
                <ImagePlus size={14} /> 加一张素材图
              </button>
              <button type="button" className="btn btn-line btn-sm" disabled={readOnly} onClick={() => addMat("text")}>
                <Type size={14} /> 加一段文字
              </button>
            </>
          )}
        </div>
      </div>
      {readOnly && <div className="cva-reason">{READ_ONLY_REASON}</div>}
      {selectMode && tab !== "materials" && (
        <div className="cva-select-tip">
          <span>点卡片选中要出图的{tab === "characters" ? "造型（有几个造型的角色，在卡片下面挑）" : "场景"}。</span>
          <button type="button" className="btn btn-ghost btn-sm" onClick={selectAllVisible}>
            全选这一页
          </button>
          {selected.size > 0 && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSelected(new Set())}>
              清空
            </button>
          )}
        </div>
      )}

      {tab === "characters" && (
        <Grid kind="characters" empty={characters.length === 0}>
          {characters.length === 0 ? (
            <Empty
              filtered={filtered}
              onClear={() => {
                setQuery("");
                setEpisode(null);
              }}
              text={
                doc.script.extractedAt
                  ? "剧本里没拆出角色，可以自己加一个。"
                  : "还没从剧本里拆出角色和场景。回剧本页点「拆出角色和场景」，或者自己加一个。"
              }
              scriptHref={doc.script.extractedAt ? undefined : `/canvas/${id}/script`}
            />
          ) : (
            characters.map((c) => (
              <CharacterCard
                key={c.id}
                character={c}
                runOf={runOf}
                selectMode={selectMode}
                selected={lookSelected}
                onOpen={() => open("character", c.id)}
                onToggleLook={(lid) => toggle(`look:${lid}`)}
                onToggleAll={() => {
                  const keys = c.looks.map((l) => `look:${l.id}` as SelKey);
                  setMany(keys, !keys.every((k) => selected.has(k)));
                }}
              />
            ))
          )}
        </Grid>
      )}

      {tab === "scenes" && (
        <Grid kind={meta.ratio === "9:16" ? "scenes-portrait" : "scenes"} empty={scenes.length === 0}>
          {scenes.length === 0 ? (
            <Empty
              filtered={filtered}
              onClear={() => {
                setQuery("");
                setEpisode(null);
              }}
              text={doc.script.extractedAt ? "剧本里没拆出场景，可以自己加一个。" : "还没从剧本里拆出场景。回剧本页点「拆出角色和场景」，或者自己加一个。"}
              scriptHref={doc.script.extractedAt ? undefined : `/canvas/${id}/script`}
            />
          ) : (
            scenes.map((s) => (
              <SceneCard
                key={s.id}
                scene={s}
                view={runOf("scene", s.id)}
                portrait={meta.ratio === "9:16"}
                selectMode={selectMode}
                selected={selected.has(`scene:${s.id}`)}
                onClick={() => (selectMode ? toggle(`scene:${s.id}`) : open("scene", s.id))}
              />
            ))
          )}
        </Grid>
      )}

      {tab === "materials" && (
        <Grid kind="materials" empty={materials.length === 0}>
          {materials.length === 0 ? (
            <Empty
              filtered={filtered}
              onClear={() => setQuery("")}
              text="素材是给角色和场景当参考的图或文字：一张道具照片、一段全剧的色调说明……在出图面板里点「上传参考」也会加一张。"
            />
          ) : (
            materials.map((m) => <MaterialCard key={m.id} doc={doc} material={m} view={runOf("material", m.id)} onClick={() => setDrawer({ kind: "material", id: m.id })} />)
          )}
        </Grid>
      )}

      {selectMode ? (
        <CanvasNextBar
          hint={
            n
              ? skipped ?? `已选 ${n} 个，每个出 1 张`
              : selected.size
                ? skipped ?? "选中的这几个这次都出不了图"
                : `点卡片选中要出图的造型和场景（一共 ${lookCount} 个造型、${doc.scenes.length} 个场景）`
          }
          prev={{ label: "退出多选", onClick: exitSelect }}
          next={{
            label: n ? `为选中的 ${n} 个出图` : "为选中的出图",
            cost: n ? (pricing.ready ? total : undefined) : undefined,
            onClick: () => void runBatch(),
            busy: batchBusy,
            disabled: readOnly || n === 0 || !!overLimit,
            disabledReason: readOnly ? READ_ONLY_REASON : n === 0 ? "还没选能出图的造型或场景。" : overLimit ?? undefined,
          }}
        />
      ) : (
        <CanvasNextBar
          hint="角色和场景会用在所有集里，调整好再继续"
          prev={{ label: "剧本", href: `/canvas/${id}/script` }}
          next={{ label: "逐集制作", href: `/canvas/${id}/episodes` }}
        />
      )}

      <AssetDrawer target={drawer} onClose={() => setDrawer(null)} />
      <NameDialog
        open={adding === "character"}
        title="加一个角色"
        placeholder="角色名，如「林微」"
        confirmLabel="加上"
        onClose={() => setAdding(null)}
        onConfirm={(name) => {
          let cid = "";
          update((d) => {
            const r = addCharacter(d, name);
            cid = r.characterId;
            return r.doc;
          });
          setAdding(null);
          if (cid) setDrawer({ kind: "character", id: cid });
        }}
      />
      <NameDialog
        open={adding === "scene"}
        title="加一个场景"
        placeholder="场景名，如「旧教室」"
        confirmLabel="加上"
        onClose={() => setAdding(null)}
        onConfirm={(name) => {
          let sid = "";
          update((d) => {
            const r = addScene(d, name);
            sid = r.id;
            return r.doc;
          });
          setAdding(null);
          if (sid) setDrawer({ kind: "scene", id: sid });
        }}
      />
    </div>
  );
}

function Grid({ kind, empty, children }: { kind: "characters" | "scenes" | "scenes-portrait" | "materials"; empty: boolean; children: React.ReactNode }) {
  return <div className={empty ? "cva-grid-empty" : `cva-grid cva-grid-${kind}`}>{children}</div>;
}

function Empty({ filtered, onClear, text, scriptHref }: { filtered: boolean; onClear: () => void; text: string; scriptHref?: string }) {
  if (filtered) {
    return (
      <div className="card cva-empty">
        <div className="cva-empty-title">没有符合条件的</div>
        <button type="button" className="btn btn-line btn-sm" onClick={onClear}>
          清除筛选
        </button>
      </div>
    );
  }
  return (
    <div className="card cva-empty">
      <div className="cva-empty-sub">{text}</div>
      {scriptHref && (
        <Link href={scriptHref} className="btn btn-line btn-sm">
          去剧本页
        </Link>
      )}
    </div>
  );
}
