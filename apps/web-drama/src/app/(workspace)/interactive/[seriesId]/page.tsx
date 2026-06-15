"use client";

export const dynamic = "force-dynamic";

// 互动短剧编辑器 —— 剧集分支地图 + 配置互动 + 批量生成 + 导出互动配置(manifest)。
// 编辑全部 live 写入本地 draft，页面级「保存」统一持久化。

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, ArrowLeft, CheckCircle2, Coins, Download, GitBranch, List, Network, Play, Plus, Sparkles } from "lucide-react";
import { Button, Card, Chip } from "@/components/premium";
import { ConfirmDialog, ErrorBlock, LoadingBlock, SectionHeader } from "@/components/common";
import { MediaLightbox } from "@/components/drama-workshop/media-lightbox";
import { SaveStatus } from "@/components/drama-workshop/save-status";
import { useAsync, mutate, invalidate } from "@/lib/drama-query";
import { useSaveStatus } from "@/lib/use-save-status";
import { getDramaConfig } from "@/api/drama-config";
import { ApiError } from "@ai-star-eco/api-client";
import * as InteractiveDramaApi from "@/api/interactive-drama";
import type { EpisodeNode, InteractiveSeries } from "@/api/interactive-drama";
import { addEpisode as addEpisodeFn, applyNodePatch, blankChoice, blankEpisode, cloneEpisode, removeEpisode as removeEpisodeFn, summarize, validateSeries } from "@/lib/interactive-graph";
import { BranchCanvas } from "../_components/BranchCanvas";
import { EpisodeCard } from "../_components/EpisodeCard";
import { EpisodeEditorDialog } from "../_components/EpisodeEditorDialog";
import { ManifestPreviewDialog } from "../_components/ManifestPreviewDialog";
import { PlaythroughDialog } from "../_components/PlaythroughDialog";

const LIST_KEY = "/me/interactive/series";

function BackLink() {
  return (
    <Link href="/projects?filter=interactive" style={{ textDecoration: "none", width: "fit-content" }}>
      <span className="row gap-1" style={{ fontSize: 12.5, color: "var(--ink-2)", fontWeight: 600 }}>
        <ArrowLeft size={14} /> 返回短剧工坊
      </span>
    </Link>
  );
}

function segStyle(active: boolean): React.CSSProperties {
  return {
    padding: "5px 11px",
    borderRadius: "calc(var(--radius-sm) - 2px)",
    border: "none",
    cursor: "pointer",
    fontSize: 12,
    fontWeight: active ? 700 : 600,
    background: active ? "var(--surface)" : "transparent",
    color: active ? "var(--accent)" : "var(--ink-3)",
    boxShadow: active ? "var(--shadow-sm)" : "none",
  };
}

/** 自动保存快照比对时忽略 status/时间戳（saveSeries 会派生它们）。 */
function snap(s: InteractiveSeries | null): string {
  if (!s) return "";
  const { updated_at, created_at, status, ...rest } = s;
  void updated_at;
  void created_at;
  void status;
  return JSON.stringify(rest);
}

export default function InteractiveEditorPage({ params }: { params: Promise<{ seriesId: string }> }) {
  const { seriesId } = React.use(params);
  const router = useRouter();
  const key = `/me/interactive/series/${seriesId}`;
  const q = useAsync<InteractiveSeries>(key, () => InteractiveDramaApi.getSeries(seriesId));

  const [draft, setDraft] = React.useState<InteractiveSeries | null>(null);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [showManifest, setShowManifest] = React.useState(false);
  const [deleteEpId, setDeleteEpId] = React.useState<string | null>(null);
  const [genBusy, setGenBusy] = React.useState(false);
  const [previewSrc, setPreviewSrc] = React.useState<string | null>(null);
  const [showPlaythrough, setShowPlaythrough] = React.useState(false);
  const [clipPrice, setClipPrice] = React.useState<number | null>(null);
  const [view, setView] = React.useState<"canvas" | "list">("canvas");

  // 自动保存（复用 v0.76 草稿状态机）：编辑即标脏 + 防抖落库 + 离开提醒兜底。
  const { status: saveStatus, notifyEditing, track } = useSaveStatus();
  const lastSavedRef = React.useRef<string>("");

  React.useEffect(() => {
    if (q.data && draft === null) {
      const copy = JSON.parse(JSON.stringify(q.data)) as InteractiveSeries;
      setDraft(copy);
      lastSavedRef.current = snap(copy);
    }
  }, [q.data, draft]);

  // 单集生成的视频单价（真后端按集计费；mock 仅展示预估）。
  React.useEffect(() => {
    getDramaConfig().then((c) => setClipPrice(c.prices.clip)).catch(() => {});
  }, []);

  // 防抖自动保存：draft 变化且与已落库快照不同 → 标脏 + 900ms 落库。
  // 生成期间（genBusy）由 runGenerate 自行持久化，这里跳过以免重复保存。
  React.useEffect(() => {
    if (!draft || genBusy) return;
    if (snap(draft) === lastSavedRef.current) return;
    notifyEditing();
    const d = draft;
    const t = setTimeout(() => {
      track(() => InteractiveDramaApi.saveSeries(d))
        .then((saved) => {
          lastSavedRef.current = snap(saved);
          mutate(key, saved);
          invalidate(LIST_KEY);
        })
        .catch(() => {
          /* SaveStatus 会显示「保存失败」 */
        });
    }, 900);
    return () => clearTimeout(t);
  }, [draft, genBusy, notifyEditing, track, key]);

  const validation = React.useMemo(() => (draft ? validateSeries(draft) : null), [draft]);
  const summary = draft ? summarize(draft) : null;

  // ── 节点增删改 ─────────────────────────────────────────────────────────────
  function patchEpisode(id: string, patch: Parameters<typeof applyNodePatch>[2]) {
    setDraft((d) => (d ? applyNodePatch(d, id, patch) : d));
  }
  function handleAddEpisode(): string {
    const ep = blankEpisode(`第 ${(draft?.episodes.length ?? 0) + 1} 集`, "");
    setDraft((d) => (d ? addEpisodeFn(d, ep) : d));
    return ep.id;
  }
  function handleRemoveEpisode(id: string) {
    setDraft((d) => (d ? removeEpisodeFn(d, id) : d));
  }
  function handleCloneEpisode(id: string) {
    const src = draft?.episodes.find((e) => e.id === id);
    if (!src) return;
    const copy = cloneEpisode(src);
    setDraft((d) => (d ? addEpisodeFn(d, copy) : d));
    toast.success(`已复制为「${copy.title}」`);
  }

  // 画布连线：从 fromId 接一条分支到 toId。已是互动 → 加一个选项；已有线性下一集（再连一条）
  // → 升级为互动二选；否则设为线性下一集。结局集不能往外连。
  function handleConnect(fromId: string, toId: string) {
    if (!draft || fromId === toId) return;
    const from = draft.episodes.find((e) => e.id === fromId);
    if (!from) return;
    if (from.is_ending) {
      toast.error("结局集没有后续，不能从它拉分支");
      return;
    }
    let patch: Partial<EpisodeNode>;
    let msg: string;
    if (from.interaction) {
      const ch = blankChoice(toId);
      ch.label = `选项 ${from.interaction.choices.length + 1}`;
      patch = { interaction: { ...from.interaction, choices: [...from.interaction.choices, ch] } };
      msg = "已加一个分支选项";
    } else if (from.next_episode_id && from.next_episode_id !== toId) {
      const c1 = blankChoice(from.next_episode_id);
      c1.label = "选项 1";
      const c2 = blankChoice(toId);
      c2.label = "选项 2";
      patch = { next_episode_id: null, interaction: { prompt: "", choices: [c1, c2], countdown_sec: null, default_choice_id: null } };
      msg = "已升级为互动分支（2 选）—— 去补一下问题文案";
    } else {
      patch = { next_episode_id: toId, is_ending: false };
      msg = "已接为下一集";
    }
    setDraft((d) => (d ? applyNodePatch(d, fromId, patch) : d));
    toast.success(msg);
  }
  function handleSetStart(id: string) {
    setDraft((d) => (d ? { ...d, start_episode_id: id } : d));
  }

  // ── 生成（先存当前图，再逐集生成，最后持久化；保存均经 track 反映状态） ──────
  async function runGenerate(ids: string[]) {
    if (!draft || genBusy) return;
    const targets = ids.length ? ids : draft.episodes.filter((e) => e.gen_status !== "ready").map((e) => e.id);
    if (!targets.length) {
      toast("所有剧集都已生成");
      return;
    }
    setGenBusy(true);
    try {
      let cur = await track(() => InteractiveDramaApi.saveSeries(draft));
      lastSavedRef.current = snap(cur);
      setDraft(cur);
      mutate(key, cur);
      for (const id of targets) {
        cur = applyNodePatch(cur, id, { gen_status: "generating" });
        setDraft(cur);
        const res = await InteractiveDramaApi.generateEpisode(cur.id, id);
        cur = applyNodePatch(cur, id, {
          gen_status: res.gen_status,
          video_url: res.video_url ?? null,
          video_job_id: res.video_job_id ?? null,
          duration_sec: res.duration_sec ?? cur.episodes.find((e) => e.id === id)?.duration_sec,
        });
        setDraft(cur);
      }
      cur = await track(() => InteractiveDramaApi.saveSeries(cur));
      lastSavedRef.current = snap(cur);
      setDraft(cur);
      mutate(key, cur);
      invalidate(LIST_KEY);
      toast.success(targets.length > 1 ? "剧集生成完成" : "该集已生成");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "生成失败");
    } finally {
      setGenBusy(false);
    }
  }

  // ── 渲染 ───────────────────────────────────────────────────────────────────
  if (q.error && !draft) {
    return (
      <div style={{ padding: 8 }}>
        <BackLink />
        <ErrorBlock onRetry={q.refetch} />
      </div>
    );
  }
  if (!draft || !validation || !summary) {
    return (
      <div style={{ padding: 8 }}>
        <BackLink />
        <LoadingBlock rows={4} height={110} />
      </div>
    );
  }

  const pendingCount = draft.episodes.filter((e) => e.gen_status !== "ready").length;
  const editingNode = draft.episodes.find((e) => e.id === editingId) ?? null;
  const delEp = draft.episodes.find((e) => e.id === deleteEpId) ?? null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <BackLink />

      {/* 头部 */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 20, flexWrap: "wrap" }}>
        <div>
          <div className="eyebrow">剧情互动 · 配置剧集分支</div>
          <h1 style={{ fontSize: 30, fontWeight: 700, margin: "8px 0 6px", letterSpacing: "var(--tracking-tight)" }}>{draft.title}</h1>
          <div className="row gap-2" style={{ flexWrap: "wrap", fontSize: 13, color: "var(--ink-2)" }}>
            <Chip tone="neutral">{draft.genre}</Chip>
            <span>{summary.episode_count} 集</span>
            <span>· {summary.branch_count} 互动点</span>
            <span>· {summary.ending_count} 结局</span>
            <span>· {summary.ready_count}/{summary.episode_count} 已生成</span>
          </div>
        </div>
        <div className="row gap-2">
          <Button variant="secondary" size="md" onClick={() => setShowPlaythrough(true)} disabled={draft.episodes.length === 0}>
            <Play size={14} /> 试玩走查
          </Button>
          <Button variant="primary" size="md" onClick={() => setShowManifest(true)}>
            <Download size={14} /> 预览并导出
          </Button>
        </div>
      </div>

      {/* 说明条 */}
      <div className="card row gap-3" style={{ padding: "11px 15px", background: "var(--surface-2)", border: "1px solid var(--line-soft)", alignItems: "flex-start" }}>
        <GitBranch size={15} style={{ color: "var(--accent)", flex: "none", marginTop: 2 }} />
        <div style={{ fontSize: 12.5, color: "var(--ink-2)", lineHeight: 1.6 }}>
          下面每张卡是一<b style={{ color: "var(--ink)" }}>集</b>。给某集设「互动分支」，填好问题和选项、每个选项指向下一集；
          生成每集视频后，<b style={{ color: "var(--ink)" }}>导出互动配置</b>交给抖音 / TikTok 播放。互动只发生在剧集之间。
        </div>
      </div>

      {/* 主体两栏 */}
      <div style={{ display: "flex", gap: 18, alignItems: "flex-start", flexWrap: "wrap" }}>
        {/* 左：剧集分支地图 */}
        <div style={{ flex: "3 1 460px", minWidth: 0, display: "flex", flexDirection: "column", gap: 12 }}>
          <SectionHeader
            eyebrow={view === "canvas" ? "点节点编辑 · 用「拉线」手柄接分支" : "逐集配置"}
            title="剧集分支地图"
            right={
              <div className="row gap-2">
                <div className="row" style={{ background: "var(--surface-2)", borderRadius: "var(--radius-sm)", padding: 2, gap: 2 }}>
                  <button type="button" onClick={() => setView("canvas")} className="row gap-1" style={segStyle(view === "canvas")}>
                    <Network size={13} /> 图
                  </button>
                  <button type="button" onClick={() => setView("list")} className="row gap-1" style={segStyle(view === "list")}>
                    <List size={13} /> 列表
                  </button>
                </div>
                <Button variant="secondary" size="sm" onClick={() => setEditingId(handleAddEpisode())}>
                  <Plus size={13} /> 新增剧集
                </Button>
              </div>
            }
          />
          {view === "canvas" ? (
            <BranchCanvas
              series={draft}
              reachable={validation.reachable}
              onEditNode={(id) => setEditingId(id)}
              onConnect={handleConnect}
            />
          ) : (
            draft.episodes.map((node) => (
              <EpisodeCard
                key={node.id}
                series={draft}
                node={node}
                isStart={node.id === draft.start_episode_id}
                unreachable={!validation.reachable.has(node.id)}
                genBusy={genBusy}
                onEdit={() => setEditingId(node.id)}
                onGenerate={() => runGenerate([node.id])}
                onPreview={() => node.video_url && setPreviewSrc(node.video_url)}
                onClone={() => handleCloneEpisode(node.id)}
                onSetStart={() => handleSetStart(node.id)}
                onDelete={() => setDeleteEpId(node.id)}
              />
            ))
          )}
        </div>

        {/* 右：生成 / 校验 / 导出 */}
        <div style={{ flex: "1 1 300px", minWidth: 280, display: "flex", flexDirection: "column", gap: 14, position: "sticky", top: 8 }}>
          {/* 生成 */}
          <Card style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)" }}>生成剧集视频</div>
            <div>
              <div className="row" style={{ justifyContent: "space-between", fontSize: 12, color: "var(--ink-2)", marginBottom: 6 }}>
                <span>已生成</span>
                <span className="mono">
                  {summary.ready_count} / {summary.episode_count}
                </span>
              </div>
              <div style={{ height: 6, background: "var(--surface-2)", borderRadius: 999, overflow: "hidden" }}>
                <div
                  style={{
                    width: `${summary.episode_count ? (summary.ready_count / summary.episode_count) * 100 : 0}%`,
                    height: "100%",
                    background: "var(--gradient-gold)",
                    transition: "width 240ms ease",
                  }}
                />
              </div>
            </div>
            <Button variant="primary" size="md" loading={genBusy} disabled={pendingCount === 0} onClick={() => runGenerate([])}>
              <Sparkles size={14} /> {pendingCount > 0 ? `生成全部待生成（${pendingCount}）` : "全部已生成"}
            </Button>
            {clipPrice != null && pendingCount > 0 && (
              <div className="row gap-1" style={{ fontSize: 11.5, color: "var(--ink-3)" }}>
                <Coins size={12} /> 预计消耗 ~{(pendingCount * clipPrice).toLocaleString("zh-CN")} 积分（{pendingCount} 集 × {clipPrice}/集）
              </div>
            )}
            {summary.episode_count >= 12 && (
              <div className="row gap-1" style={{ fontSize: 11, color: "var(--warning)", alignItems: "flex-start" }}>
                <AlertTriangle size={12} style={{ flex: "none", marginTop: 1 }} />
                分支较多（{summary.episode_count} 集）。让不同选项「收束」到同一集，可控制集数与生成成本。
              </div>
            )}
            <div style={{ fontSize: 11, color: "var(--ink-3)", lineHeight: 1.5 }}>
              生成的是当前自动保存的剧集图；每集一条 9:16 竖屏成片。mock 即时占位，真后端走视频引擎按集计费。
            </div>
          </Card>

          {/* 校验 */}
          <Card style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)" }}>结构校验</div>
            {validation.errors.length === 0 && validation.warnings.length === 0 ? (
              <div className="row gap-2" style={{ fontSize: 12.5, color: "var(--success)" }}>
                <CheckCircle2 size={14} /> 结构完整，可以导出。
              </div>
            ) : (
              <>
                {validation.errors.map((m, i) => (
                  <div key={`e${i}`} className="row gap-2" style={{ fontSize: 12, color: "var(--danger)", alignItems: "flex-start" }}>
                    <AlertTriangle size={13} style={{ flex: "none", marginTop: 1 }} />
                    <span>{m}</span>
                  </div>
                ))}
                {validation.warnings.map((m, i) => (
                  <div key={`w${i}`} className="row gap-2" style={{ fontSize: 12, color: "var(--warning)", alignItems: "flex-start" }}>
                    <AlertTriangle size={13} style={{ flex: "none", marginTop: 1 }} />
                    <span>{m}</span>
                  </div>
                ))}
              </>
            )}
          </Card>

          {/* 导出 */}
          <Card style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)" }}>导出互动配置</div>
            <div style={{ fontSize: 12, color: "var(--ink-2)", lineHeight: 1.55 }}>
              一份 JSON manifest，描述起始集、每集的互动与分支跳转 —— 交给社媒平台播放的规范产物。
            </div>
            <Button variant="secondary" size="md" onClick={() => setShowManifest(true)}>
              <Download size={14} /> 预览并导出 JSON
            </Button>
          </Card>
        </div>
      </div>

      {/* 单集编辑器 */}
      <EpisodeEditorDialog
        open={!!editingNode}
        onClose={() => setEditingId(null)}
        node={editingNode}
        series={draft}
        isStart={editingNode?.id === draft.start_episode_id}
        onPatch={(patch) => editingId && patchEpisode(editingId, patch)}
        onAddTarget={handleAddEpisode}
        onSetStart={() => editingId && handleSetStart(editingId)}
        onDelete={() => {
          if (editingId) {
            setDeleteEpId(editingId);
            setEditingId(null);
          }
        }}
      />

      {/* 导出预览 */}
      <ManifestPreviewDialog open={showManifest} onOpenChange={setShowManifest} series={draft} />

      {/* 试玩走查 */}
      <PlaythroughDialog open={showPlaythrough} onOpenChange={setShowPlaythrough} series={draft} />

      {/* 成片抽查 */}
      <MediaLightbox media={previewSrc ? { src: previewSrc, kind: "video" } : null} onClose={() => setPreviewSrc(null)} />

      {/* 自动保存状态指示（底部悬浮药丸） */}
      <SaveStatus status={saveStatus} />

      {/* 删除集确认 */}
      <ConfirmDialog
        open={!!deleteEpId}
        onOpenChange={(o) => !o && setDeleteEpId(null)}
        title={`删除「${delEp?.title ?? ""}」`}
        description="删除后，其它集对它的跳转（互动选项 / 下一集）会一并清理。"
        destructive
        confirmLabel="删除"
        onConfirm={() => {
          if (deleteEpId) handleRemoveEpisode(deleteEpId);
        }}
      />
    </div>
  );
}
