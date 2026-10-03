"use client";

// ─────────────────────────────────────────────────────────────────────────────
// 画布 · 剧本页（v0.198，docs/drama-canvas-plan.md §2.3）。
//
//   共 N 集                                                               [···] → 修改记录
//   ┌ 原始想法 ─ 故事大纲（通过 / 重写）─ 分集剧情（通过 / 重写）─ 分集剧本（按集折叠，锁，写 / 重写这一集）┐
//   底部提示条：拆出角色和场景 → 拆完跳到「角色和场景」
//
// 规矩（contract.ts）：只通过 update() 改文档；生成一律 useCanvasRuns().submit()；价格一律 useCanvasPricing()。
// AI 覆盖已有内容时 core 的 merge 自动存一版修改记录；「通过」由这里（script-ops）先存一版再写 approvedAt。
// 文档只读（别的页面改过，stale）时，所有编辑和生成都禁用。
// ─────────────────────────────────────────────────────────────────────────────

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, ChevronsDownUp, ChevronsUpDown, History, ListChecks, MoreHorizontal, PenLine, Plus, RotateCcw } from "lucide-react";
import { formatDateTime } from "@ai-star-eco/api-client";
import type { CanvasOutlineEpisode, CanvasScriptVersion } from "@ai-star-eco/types/drama-canvas";
import {
  RunTarget,
  pushScriptHistory,
  restoreScriptVersion,
  useCanvasDoc,
  useCanvasPricing,
  useCanvasRuns,
  type CanvasRunRequest,
} from "@/canvas/core";
import { CanvasNextBar, SplitNotesBanner, type NextBarAction } from "@/canvas/shell";
import { dramaConfirm } from "@/components/drama-ui/confirm-dialog";
import { toast } from "@/lib/toast";
import { AutoTextarea } from "./auto-textarea";
import { Cost, Reason, RunLine, RunResult, Section, type SectionId } from "./bits";
import { EpisodeBlock, type EpisodeHandlers } from "./episode-block";
import { HistoryDialog } from "./history-dialog";
import { RewriteDialog, type RewriteRequest } from "./rewrite-dialog";
import { runView } from "./run-view";
import {
  addScriptEpisode,
  approveOutline,
  approveSetting,
  canRenumberEpisodes,
  charCount,
  episodeProduction,
  episodesToWrite,
  formatEpisodeList,
  hasScriptText,
  isBlank,
  patchOutlineEpisode,
  patchScriptEpisode,
  removeScriptEpisode,
  scriptHeading,
  setEpisodeLocked,
  setSettingText,
  versionSummary,
  type OutlinePatch,
} from "./script-ops";

type ScriptStage = "setting" | "outline" | "episode";

/** 多于这么多集时，进页只展开第一集（几十集、每集几万字全展开会很长）。 */
const EXPAND_ALL_UP_TO = 3;
const NARROW_QUERY = "(max-width: 720px)";

function scriptBody(stage: ScriptStage, episodeNo?: number, instruction?: string): CanvasRunRequest {
  return {
    kind: "script",
    body: { stage, ...(episodeNo != null ? { episodeNo } : {}), ...(instruction ? { instruction } : {}) },
  };
}

function initialClosedEpisodes(nos: number[]): Set<number> {
  return nos.length > EXPAND_ALL_UP_TO ? new Set(nos.slice(1)) : new Set();
}

export function ScriptPage() {
  const router = useRouter();
  const { canvasId, doc, getDoc, update, readOnly } = useCanvasDoc();
  const { submit, submitSequence, runFor, cancel, isSubmitting } = useCanvasRuns();
  const pricing = useCanvasPricing();
  const pricingRef = React.useRef(pricing);
  pricingRef.current = pricing;
  const isSubmittingRef = React.useRef(isSubmitting);
  isSubmittingRef.current = isSubmitting;

  const s = doc.script;
  const isIdea = doc.source === "idea";
  const price = (stage: ScriptStage) => (pricing.ready ? pricing.scriptPrice(stage) : null);

  // ── 提交中（flush + 请求，还没拿到运行记录）的目标：按钮灰掉，连点不算 ──────────
  const [busy, setBusy] = React.useState<ReadonlySet<string>>(() => new Set());
  const busyRef = React.useRef(new Set<string>());
  const markBusy = React.useCallback((key: string, on: boolean) => {
    const next = new Set(busyRef.current);
    if (on) next.add(key);
    else next.delete(key);
    busyRef.current = next;
    setBusy(next);
  }, []);

  /** 发一次生成。没发出去时：服务端拒了才 toast（没存上 / 版本冲突，外壳自己会提示）。 */
  const go = React.useCallback(
    async (key: string, req: CanvasRunRequest): Promise<string | null> => {
      if (busyRef.current.has(key)) return null;
      markBusy(key, true);
      try {
        const res = await submit(req);
        if (!res.ok) {
          if (res.reason === "rejected") toast.error(res.message);
          return null;
        }
        return res.runs[0]?.id ?? null;
      } finally {
        markBusy(key, false);
      }
    },
    [submit, markBusy],
  );

  /** 花费到了确认线才问一句（覆盖已有内容的动作不走这里，走重写弹层或单独的确认）。 */
  const confirmSpend = React.useCallback(async (cost: number, title: string, body: string): Promise<boolean> => {
    if (cost < pricingRef.current.confirmThreshold) return true;
    return dramaConfirm({ cost, title, body });
  }, []);

  // ── 折叠 ─────────────────────────────────────────────────────────────────
  const [closedSections, setClosedSections] = React.useState<ReadonlySet<SectionId>>(() => new Set());
  const toggleSection = (id: SectionId) =>
    setClosedSections((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const [closedEps, setClosedEps] = React.useState<ReadonlySet<number>>(() =>
    initialClosedEpisodes(s.episodes.map((e) => e.no)),
  );
  // 一下子多出好几集（通过分集剧情时按集列出来）：集数多就只展开新出来的第一集。「加一集」只多一集，照常展开。
  const knownEpsRef = React.useRef(new Set(s.episodes.map((e) => e.no)));
  React.useEffect(() => {
    const nos = s.episodes.map((e) => e.no);
    const fresh = nos.filter((n) => !knownEpsRef.current.has(n));
    knownEpsRef.current = new Set(nos);
    if (fresh.length > 1 && nos.length > EXPAND_ALL_UP_TO) {
      setClosedEps((cur) => {
        const next = new Set(cur);
        for (const n of fresh.slice(1)) next.add(n);
        return next;
      });
    }
  }, [s.episodes]);

  // ── 弹层 ─────────────────────────────────────────────────────────────────
  const [rewrite, setRewrite] = React.useState<RewriteRequest | null>(null);
  const [historyOpen, setHistoryOpen] = React.useState(false);
  const [menuOpen, setMenuOpen] = React.useState(false);
  const menuRef = React.useRef<HTMLDivElement | null>(null);
  React.useEffect(() => {
    if (!menuOpen) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent) {
        if (e.key === "Escape") setMenuOpen(false);
        return;
      }
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [menuOpen]);

  // ── 故事大纲 ─────────────────────────────────────────────────────────────
  const settingText = s.setting?.text ?? "";
  const settingView = runView(runFor(RunTarget.scriptSetting), s.setting?.run);
  const settingApproved = !!s.setting?.approvedAt;
  const hasSetting = !isBlank(settingText);
  /** 用户点了「自己写」或者动过这段：编辑框就一直留着（删空了也不跳回开始按钮）。 */
  const [settingEditorOpen, setSettingEditorOpen] = React.useState(false);
  const showSettingEditor = hasSetting || settingEditorOpen || settingText.length > 0;
  /** 生成中 = 这一页在提交 / core 在提交（别的按钮实例发的）/ 已经在排队或在跑。 */
  const settingBusy = settingView.pending || busy.has("setting") || isSubmitting(RunTarget.scriptSetting);

  const writeSetting = async () => {
    const cost = pricingRef.current.scriptPrice("setting");
    if (!(await confirmSpend(cost, "写故事大纲？", "AI 按你的想法写题材、主线和人物小传，写完可以直接改。"))) return;
    await go("setting", scriptBody("setting"));
  };
  const openRewriteSetting = () =>
    setRewrite({
      title: "重写故事大纲",
      consequence: "现在的故事大纲会被换掉，换之前自动存一版，在修改记录里能找回。换完要重新点「通过」。",
      cost: price("setting"),
      onSubmit: (instruction) => void go("setting", scriptBody("setting", undefined, instruction)),
    });

  // ── 分集剧情 ─────────────────────────────────────────────────────────────
  const outlineEps = s.outline?.episodes ?? [];
  const outlineView = runView(runFor(RunTarget.scriptOutline), s.outline?.run);
  const outlineApproved = !!s.outline?.approvedAt;
  const outlineLocked = !settingApproved; // 故事大纲没通过：整节禁用
  const outlineBusy = outlineView.pending || busy.has("outline") || isSubmitting(RunTarget.scriptOutline);
  const outlineEditable = !readOnly && !outlineLocked && !outlineView.pending;

  const writeOutline = async () => {
    const cost = pricingRef.current.scriptPrice("outline");
    const n = s.targetEpisodes ?? 10;
    if (!(await confirmSpend(cost, "写分集剧情？", `按故事大纲写 ${n} 集，每集一个标题、钩子和梗概。`))) return;
    await go("outline", scriptBody("outline"));
  };
  const openRewriteOutline = () =>
    setRewrite({
      title: "重写分集剧情",
      consequence: "现在的分集剧情会被换掉，换之前自动存一版，在修改记录里能找回。换完要重新点「通过」。已经写好的分集剧本不受影响。",
      cost: price("outline"),
      onSubmit: (instruction) => void go("outline", scriptBody("outline", undefined, instruction)),
    });
  const patchOutline = React.useCallback(
    (no: number, patch: OutlinePatch) => update((d) => patchOutlineEpisode(d, no, patch)),
    [update],
  );

  // ── 分集剧本 ─────────────────────────────────────────────────────────────
  // 正在提交的集不算「要写的」（刚点的那一集 POST 还没回来，文档里还没有运行引用）
  const toWrite = episodesToWrite(doc).filter((no) => !busy.has(`ep:${no}`) && !isSubmitting(RunTarget.scriptEpisode(no)));
  const canWriteAll = isIdea && outlineApproved;
  const [batch, setBatch] = React.useState(false);
  const batchRef = React.useRef(false);

  /**
   * 写全部：整批交给 core 的 submitSequence（一进来整批都登记为提交中，后面那几集的「写这一集」随之禁用；
   * 每一集发出前 core 再核对一次，已经在写的跳过）。不在这里自己循环 submit —— 那样只锁当前那一集，
   * 后面的集还能被单独点一次，轮到它时再写一次 = 扣两份（Codex 复审 N3）。
   */
  const writeAll = async () => {
    if (batchRef.current) return;
    const nos = episodesToWrite(getDoc()).filter(
      (no) => !busyRef.current.has(`ep:${no}`) && !isSubmittingRef.current(RunTarget.scriptEpisode(no)),
    );
    if (!nos.length) return;
    const unit = pricingRef.current.scriptPrice("episode");
    const ok = await dramaConfirm({
      title: `写 ${nos.length} 集剧本？`,
      body: `会写${formatEpisodeList(nos)}（还没有剧本、也没锁上的集），已经有剧本的集不动。每集单独生成，哪一集没写出来，那一集不扣积分。`,
      cost: unit * nos.length,
      confirmLabel: "开始写",
    });
    if (!ok) return;
    batchRef.current = true;
    setBatch(true);
    try {
      const results = await submitSequence(
        nos.map((no) => scriptBody("episode", no)),
        { stopOnError: true },
      );
      // 第一个真失败（不是跳过）之前被跳过的 = 已经在写；之后被跳过的 = 因为前面那集没发出去而停下
      const failedAt = results.findIndex((r) => !r.ok && r.reason !== "skipped");
      const running: number[] = [];
      const stopped: number[] = [];
      results.forEach((r, i) => {
        if (r.ok || r.reason !== "skipped") return;
        (failedAt >= 0 && i > failedAt ? stopped : running).push(nos[i]);
      });
      if (running.length) toast.info(`${formatEpisodeList(running)}已经在写，跳过了`);
      const failed = failedAt >= 0 ? results[failedAt] : undefined;
      if (failed && !failed.ok && failed.reason === "rejected") {
        toast.error(failed.message, {
          ...(stopped.length ? { description: `${formatEpisodeList(stopped)}没有发出去，可以再点一次「写全部分集剧本」。` } : {}),
        });
      }
    } finally {
      batchRef.current = false;
      setBatch(false);
    }
  };

  const handlers = React.useMemo<EpisodeHandlers>(
    () => ({
      onToggleOpen: (no) =>
        setClosedEps((cur) => {
          const next = new Set(cur);
          if (next.has(no)) next.delete(no);
          else next.add(no);
          return next;
        }),
      onTitle: (no, title) => update((d) => patchScriptEpisode(d, no, { title })),
      onText: (no, text) => update((d) => patchScriptEpisode(d, no, { text })),
      onToggleLock: (no) =>
        update((d) => {
          const ep = d.script.episodes.find((e) => e.no === no);
          return ep ? setEpisodeLocked(d, no, !ep.locked) : d;
        }),
      onWrite: async (no) => {
        const cost = pricingRef.current.scriptPrice("episode");
        if (!(await confirmSpend(cost, `写第 ${no} 集剧本？`, "按故事大纲和这一集的分集剧情写这一集的剧本，写完可以直接改。"))) return;
        await go(`ep:${no}`, scriptBody("episode", no));
      },
      onRewrite: (no) => {
        const p = pricingRef.current;
        setRewrite({
          title: `重写第 ${no} 集`,
          consequence: `第 ${no} 集现在的剧本会被换掉，换之前自动存一版，在修改记录里能找回。`,
          cost: p.ready ? p.scriptPrice("episode") : null,
          onSubmit: (instruction) => void go(`ep:${no}`, scriptBody("episode", no, instruction)),
        });
      },
      onDelete: async (no) => {
        const d = getDoc();
        const ep = d.script.episodes.find((e) => e.no === no);
        if (!ep) return;
        const hasText = !isBlank(ep.text);
        const made = episodeProduction(d, no);
        if (hasText || made.segments > 0 || made.assembled) {
          const later = d.script.episodes.some((e) => e.no > no);
          const renumber = later && canRenumberEpisodes(d);
          const lost = [
            hasText
              ? `这一集的剧本（${charCount(ep.text).toLocaleString("zh-CN")} 字）会一起删掉，删之前自动存一版，在修改记录里能找回。`
              : "",
            made.segments > 0 || made.assembled
              ? `逐集制作里这一集已经做的${made.segments > 0 ? ` ${made.segments} 个片段` : ""}${
                  made.assembled ? `${made.segments > 0 ? "和" : ""}成片` : ""
                }之后看不到了，已经花的积分不退。`
              : "",
            renumber ? "后面的集号会往前挪一位。" : later ? "后面几集的集号不变。" : "",
          ].join("");
          const ok = await dramaConfirm({
            title: `删掉第 ${no} 集？`,
            body: lost,
            tone: "danger",
            confirmLabel: "删掉",
            cancelLabel: "再想想",
          });
          if (!ok) return;
        }
        update((cur) => removeScriptEpisode(hasText ? pushScriptHistory(cur, `删第 ${no} 集前`) : cur, no));
      },
      onCancel: (runId) => void cancel(runId),
    }),
    [update, getDoc, go, cancel, confirmSpend],
  );

  const addEpisode = () => {
    let added: number | null = null;
    update((d) => {
      const r = addScriptEpisode(d);
      added = r.no;
      return r.doc;
    });
    if (added != null) {
      const no = added;
      setClosedEps((cur) => {
        if (!cur.has(no)) return cur;
        const next = new Set(cur);
        next.delete(no);
        return next;
      });
    }
  };

  const anyEpisodeOpen = s.episodes.some((e) => !closedEps.has(e.no));
  const toggleAllEpisodes = () => setClosedEps(anyEpisodeOpen ? new Set(s.episodes.map((e) => e.no)) : new Set());

  // ── 修改记录 ─────────────────────────────────────────────────────────────
  const restore = async (v: CanvasScriptVersion) => {
    const ok = await dramaConfirm({
      title: "恢复到这一版？",
      body: `剧本会换回「${v.label}」（${formatDateTime(v.at)}）那时的样子：${versionSummary(v)}。现在的剧本会先存一版，在修改记录里能找回。`,
      confirmLabel: "恢复",
    });
    if (!ok) return;
    update((d) => restoreScriptVersion(d, v.id));
    setHistoryOpen(false);
    toast.success("已恢复到这一版");
  };

  // ── 拆出角色和场景 ───────────────────────────────────────────────────────
  const extractView = runView(runFor(RunTarget.extract), s.extractRun, "积分已退回，可以再试一次。");
  const extractCost = pricing.extractPrice();
  const extracting = extractView.pending || busy.has("extract") || isSubmitting(RunTarget.extract);
  const scriptReady = hasScriptText(doc);
  const extracted = !!s.extractedAt;
  /** 这一页上看着它跑起来的那次拆分：跑完、文档里的 extractedAt 变了，就去「角色和场景」。 */
  const watchRef = React.useRef<{ runId: string; before?: string } | null>(null);

  const doExtract = async () => {
    if (busyRef.current.has("extract") || isSubmittingRef.current(RunTarget.extract)) return;
    const d = getDoc();
    if (!hasScriptText(d)) return;
    const again = !!d.script.extractedAt;
    const cost = pricingRef.current.extractPrice();
    if (again || cost >= pricingRef.current.confirmThreshold) {
      const ok = await dramaConfirm(
        again
          ? {
              title: "再拆一次角色和场景？",
              body: "新出现的角色和场景会加进去，已有的保留、只补出现集数。",
              cost,
              confirmLabel: "再拆一次",
            }
          : { title: "拆出角色和场景？", body: "按现在的分集剧本拆出角色、造型和场景。", cost, confirmLabel: "开始拆" },
      );
      if (!ok) return;
    }
    const runId = await go("extract", { kind: "extract", body: {} });
    if (runId) watchRef.current = { runId, before: d.script.extractedAt };
  };

  React.useEffect(() => {
    // 刷新后接回的、在别处点的：只要在这一页上看见它在跑，也算
    if (extractView.pending && extractView.runId && watchRef.current?.runId !== extractView.runId) {
      watchRef.current = { runId: extractView.runId, before: s.extractedAt };
    }
    const w = watchRef.current;
    if (!w || w.runId !== extractView.runId) return;
    if (extractView.status === "succeeded" && s.extractedAt && s.extractedAt !== w.before) {
      watchRef.current = null;
      let narrow = false;
      try {
        narrow = window.matchMedia(NARROW_QUERY).matches;
      } catch {
        narrow = false;
      }
      router.push(`/canvas/${encodeURIComponent(canvasId)}/assets?view=${narrow ? "list" : "board"}`);
    } else if (extractView.failed || extractView.canceled) {
      watchRef.current = null;
    }
  }, [extractView.pending, extractView.runId, extractView.status, extractView.failed, extractView.canceled, s.extractedAt, router, canvasId]);

  const assetsHref = `/canvas/${encodeURIComponent(canvasId)}/assets`;
  const next: NextBarAction = {
    label: extracting ? "正在拆出角色和场景…" : "拆出角色和场景",
    ...(extracting ? {} : { cost: extractCost }),
    onClick: () => void doExtract(),
    busy: extracting,
    disabled: readOnly || !scriptReady,
    disabledReason: readOnly
      ? "这张画布在别的页面改过了，载入最新的再继续"
      : !scriptReady
        ? "还没有任何一集的剧本，写好或粘贴进来再拆"
        : undefined,
  };
  const hint = (
    <>
      {extractView.failed
        ? `上次没拆出来：${extractView.errorMessage}`
        : extracted
          ? "剧本改过可以再拆一次，已有的角色和场景会保留。"
          : "角色和场景会从剧本里拆出来，剧本改好再继续"}
      {extracted && (
        <Link href={assetsHref} className="cvs-next-link">
          直接去角色和场景
        </Link>
      )}
    </>
  );

  // ── 渲染 ─────────────────────────────────────────────────────────────────
  const heading = scriptHeading(doc);
  const writtenCount = s.episodes.filter((e) => !isBlank(e.text)).length;

  return (
    <div className="cv-page cvs-page">
      <div className="cvs-head">
        <h1 className="cv-page-title cvs-title">{heading}</h1>
        <div className="cvs-more" ref={menuRef}>
          <button
            type="button"
            className="btn btn-icon btn-ghost btn-sm tap-target"
            aria-label="更多"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
          >
            <MoreHorizontal size={16} />
          </button>
          {menuOpen && (
            <div className="cvs-menu" role="menu">
              <button
                type="button"
                role="menuitem"
                data-action="open-history"
                onClick={() => {
                  setMenuOpen(false);
                  setHistoryOpen(true);
                }}
              >
                <History size={14} /> 修改记录
                {s.history.length > 0 && <span className="cvs-menu-count num">{s.history.length}</span>}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 粘贴新建后按集切开的说明：只显示一次（新建页存进 sessionStorage，这里读完即删） */}
      <SplitNotesBanner canvasId={canvasId} episodeCount={s.episodes.length} />

      {!isIdea && s.episodes.length > 0 && (
        <p className="cvs-note">粘贴的剧本切成了 {s.episodes.length} 集。切错了可以直接改标题和正文，也能加一集、删一集。</p>
      )}

      <div className="card cvs-card">
        {isIdea && (
          <Section id="idea" title="原始想法" open={!closedSections.has("idea")} onToggle={() => toggleSection("idea")}>
            <p className="cvs-idea">{s.idea?.trim() || "没有记下原始想法。"}</p>
            {s.targetEpisodes != null && (
              <div className="cv-hint">
                计划 {s.targetEpisodes} 集{s.episodeDurationSec ? `，每集约 ${s.episodeDurationSec} 秒` : ""}
              </div>
            )}
          </Section>
        )}

        {isIdea && (
          <Section
            id="setting"
            title="故事大纲"
            open={!closedSections.has("setting")}
            onToggle={() => toggleSection("setting")}
            meta={<ApprovalTag approvedAt={s.setting?.approvedAt} show={hasSetting} />}
          >
            <RunLine
              view={settingView}
              label={hasSetting ? "正在重写故事大纲，写完会换掉现在这一版" : "正在写故事大纲"}
              onCancel={handlers.onCancel}
              disabled={readOnly}
            />
            {!showSettingEditor && !settingView.pending && (
              <div className="cvs-start">
                <div className="cvs-start-copy">AI 按你的想法写题材、主线和人物小传，写完可以直接改。</div>
                <div className="cvs-actions">
                  <button
                    type="button"
                    className="btn btn-grad"
                    disabled={readOnly || settingBusy}
                    aria-busy={busy.has("setting") || undefined}
                    data-action="write-setting"
                    onClick={() => void writeSetting()}
                  >
                    <PenLine size={15} /> 写故事大纲 <Cost value={price("setting")} />
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    disabled={readOnly || settingBusy}
                    onClick={() => setSettingEditorOpen(true)}
                  >
                    自己写
                  </button>
                </div>
              </div>
            )}
            {showSettingEditor && (
              <>
                <AutoTextarea
                  className="cv-textarea cvs-text"
                  value={settingText}
                  onValueChange={(v) => {
                    setSettingEditorOpen(true);
                    update((d) => setSettingText(d, v));
                  }}
                  readOnly={readOnly || settingView.pending}
                  placeholder="题材、主线、人物小传"
                  aria-label="故事大纲"
                />
                <div className="cvs-actions">
                  {!settingApproved && (
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      disabled={readOnly || settingView.pending || !hasSetting}
                      data-action="approve-setting"
                      onClick={() => update((d) => approveSetting(d))}
                    >
                      <Check size={14} /> 通过
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn btn-line btn-sm"
                    disabled={readOnly || settingBusy}
                    aria-haspopup="dialog"
                    data-action="rewrite-setting"
                    onClick={openRewriteSetting}
                  >
                    <RotateCcw size={14} /> 重写 <Cost value={price("setting")} />
                    <ChevronDown size={13} />
                  </button>
                </div>
                {!settingApproved && hasSetting && <Reason>看过没问题就点「通过」，接着写分集剧情。</Reason>}
              </>
            )}
            <RunResult view={settingView} />
          </Section>
        )}

        {isIdea && (
          <Section
            id="outline"
            title="分集剧情"
            open={!closedSections.has("outline")}
            onToggle={() => toggleSection("outline")}
            disabled={outlineLocked}
            meta={<ApprovalTag approvedAt={s.outline?.approvedAt} show={outlineEps.length > 0} />}
          >
            {outlineLocked && <Reason>故事大纲通过之后，才能写分集剧情。</Reason>}
            <RunLine
              view={outlineView}
              label={outlineEps.length ? "正在重写分集剧情，写完会换掉现在这一版" : "正在写分集剧情"}
              onCancel={handlers.onCancel}
              disabled={readOnly}
            />
            {!outlineEps.length && !outlineView.pending && (
              <div className="cvs-start">
                <div className="cvs-start-copy">
                  按故事大纲写 {s.targetEpisodes ?? 10} 集，每集一个标题、钩子和梗概，写完可以直接改。
                </div>
                <div className="cvs-actions">
                  <button
                    type="button"
                    className="btn btn-grad"
                    disabled={readOnly || outlineLocked || outlineBusy}
                    aria-busy={busy.has("outline") || undefined}
                    data-action="write-outline"
                    onClick={() => void writeOutline()}
                  >
                    <PenLine size={15} /> 写分集剧情 <Cost value={price("outline")} />
                  </button>
                </div>
              </div>
            )}
            {outlineEps.length > 0 && (
              <>
                <div className="cvs-ol">
                  {outlineEps.map((e) => (
                    <OutlineRow key={e.no} episode={e} editable={outlineEditable} onPatch={patchOutline} />
                  ))}
                </div>
                <div className="cvs-actions">
                  {!outlineApproved && (
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      disabled={readOnly || outlineLocked || outlineView.pending}
                      data-action="approve-outline"
                      onClick={() => update((d) => approveOutline(d))}
                    >
                      <Check size={14} /> 通过
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn btn-line btn-sm"
                    disabled={readOnly || outlineLocked || outlineBusy}
                    aria-haspopup="dialog"
                    data-action="rewrite-outline"
                    onClick={openRewriteOutline}
                  >
                    <RotateCcw size={14} /> 重写 <Cost value={price("outline")} />
                    <ChevronDown size={13} />
                  </button>
                </div>
                {!outlineApproved && !outlineLocked && <Reason>通过之后会按分集剧情列出每一集，接着写分集剧本。</Reason>}
              </>
            )}
            <RunResult view={outlineView} />
          </Section>
        )}

        <Section
          id="episodes"
          title="分集剧本"
          open={!closedSections.has("episodes")}
          onToggle={() => toggleSection("episodes")}
          meta={
            s.episodes.length > 0 ? (
              <span className="cvs-sec-count">
                已写 <span className="num">{writtenCount}</span>/<span className="num">{s.episodes.length}</span> 集
              </span>
            ) : undefined
          }
          actions={
            <>
              {s.episodes.length > 1 && (
                <button type="button" className="btn btn-ghost btn-sm" data-action="toggle-all" onClick={toggleAllEpisodes}>
                  {anyEpisodeOpen ? <ChevronsDownUp size={14} /> : <ChevronsUpDown size={14} />}
                  {anyEpisodeOpen ? "收起全部" : "展开全部"}
                </button>
              )}
              {canWriteAll && (
                <button
                  type="button"
                  className="btn btn-grad btn-sm"
                  disabled={readOnly || !toWrite.length || batch}
                  aria-busy={batch || undefined}
                  data-action="write-all"
                  onClick={() => void writeAll()}
                >
                  <ListChecks size={14} />
                  {batch ? (
                    "正在提交…"
                  ) : (
                    <>
                      写全部分集剧本（{toWrite.length} 集）
                      <Cost value={pricing.ready ? pricing.scriptPrice("episode") * toWrite.length : null} />
                    </>
                  )}
                </button>
              )}
            </>
          }
        >
          {canWriteAll && !toWrite.length && !batch && s.episodes.length > 0 && (
            <Reason>没有要写的集：每一集都有剧本了，或者锁上了。要重写哪一集，在那一集里点「重写这一集」。</Reason>
          )}
          {s.episodes.length === 0 && (
            <div className="cvs-empty">
              {isIdea ? "分集剧情通过之后，这里会按集列出来。" : "还没有分集剧本。"}
            </div>
          )}
          <div className="cvs-eps">
            {s.episodes.map((e) => {
              const key = `ep:${e.no}`;
              return (
                <EpisodeBlock
                  key={e.no}
                  episode={e}
                  open={!closedEps.has(e.no)}
                  view={runView(runFor(RunTarget.scriptEpisode(e.no)), e.run)}
                  submitting={busy.has(key) || isSubmitting(RunTarget.scriptEpisode(e.no))}
                  readOnly={readOnly}
                  price={price("episode")}
                  deletable={!isIdea}
                  handlers={handlers}
                />
              );
            })}
          </div>
          {!isIdea && (
            <div className="cvs-actions">
              <button type="button" className="btn btn-line btn-sm" disabled={readOnly} data-action="add-episode" onClick={addEpisode}>
                <Plus size={14} /> 加一集
              </button>
            </div>
          )}
        </Section>
      </div>

      <CanvasNextBar hint={hint} next={next} />

      <RewriteDialog request={rewrite} onClose={() => setRewrite(null)} />
      <HistoryDialog
        open={historyOpen}
        versions={s.history}
        readOnly={readOnly}
        onRestore={(v) => void restore(v)}
        onClose={() => setHistoryOpen(false)}
      />
    </div>
  );
}

function ApprovalTag({ approvedAt, show }: { approvedAt?: string; show: boolean }) {
  if (!show) return null;
  if (approvedAt) {
    return (
      <span className="tag tag-green" title={`通过于 ${formatDateTime(approvedAt)}`}>
        <Check size={12} /> 已通过
      </span>
    );
  }
  return <span className="tag tag-amber">还没通过</span>;
}

const OutlineRow = React.memo(function OutlineRow({
  episode: e,
  editable,
  onPatch,
}: {
  episode: CanvasOutlineEpisode;
  editable: boolean;
  onPatch: (no: number, patch: OutlinePatch) => void;
}) {
  return (
    <div className="cvs-ol-row" data-outline={e.no}>
      <span className="cvs-ol-no">第 {e.no} 集</span>
      <div className="cvs-ol-fields">
        <input
          className="cv-input cvs-ol-title"
          value={e.title}
          maxLength={60}
          placeholder="标题"
          aria-label={`第 ${e.no} 集的标题`}
          readOnly={!editable}
          onChange={(ev) => onPatch(e.no, { title: ev.target.value })}
        />
        <label className="cvs-ol-field">
          <span className="cvs-ol-label">钩子</span>
          <AutoTextarea
            className="cv-textarea cvs-ol-text"
            value={e.hook}
            onValueChange={(v) => onPatch(e.no, { hook: v })}
            readOnly={!editable}
            placeholder="开头抓人的那一下"
          />
        </label>
        <label className="cvs-ol-field">
          <span className="cvs-ol-label">梗概</span>
          <AutoTextarea
            className="cv-textarea cvs-ol-text"
            value={e.summary}
            onValueChange={(v) => onPatch(e.no, { summary: v })}
            readOnly={!editable}
            placeholder="这一集发生了什么"
          />
        </label>
      </div>
    </div>
  );
});
