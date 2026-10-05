"use client";

// 单集编辑器（v0.198，plan §2.6）：
//   顶栏：「逐集制作 / 第 N 集 · 标题」、视频模型 ▾、合成成片（有成片后：下载成片 + 重新合成）
//   三栏（≥1024）：本集素材 | 片段编辑（片段文本 @ 标签）| 预览（首帧 / 视频、出首帧、用上一片段最后一帧、生成视频）
//   底部：片段轴
//   ≤720：上下三段（片段文本 → 预览 → 片段轴横滑），本集素材收进「@ 引用」浮层，页首「电脑上更好用」。
// 只通过 useCanvasDoc().update() 改文档，生成只走 useCanvasRuns().submit，价格只从 useCanvasPricing 拿。
import * as React from "react";
import Link from "next/link";
import { AtSign, Check, Clapperboard, Download, Film, Loader2, Pencil, Plus, RefreshCw, Sparkles } from "lucide-react";
import { formatDateTime } from "@ai-star-eco/api-client";
import type { CanvasSegment, DramaCanvasRun } from "@ai-star-eco/types/drama-canvas";
import { CanvasTopbarSlot, DesktopHint, resignCanvasAsset } from "@/canvas/shell";
import {
  RunTarget,
  findEpisode,
  insertSegment,
  parseRefs,
  removeSegment,
  totalDuration,
  updateSegment,
  useCanvasDoc,
  useCanvasPricing,
  useCanvasRuns,
  type CanvasModelOption,
  type SegmentRef,
} from "@/canvas/core";
import { dramaConfirm } from "@/components/drama-ui/confirm-dialog";
import { submitOrToast, useStoryboardAction } from "./actions";
import { AssetPanel } from "./asset-panel";
import { AssembledDialog, Credits, PriceLine, assembledFilename, downloadAssembled } from "./bits";
import {
  MISSING_REF_TEXT,
  assembleInfo,
  episodeAssets,
  episodeHeading,
  episodeRefs,
  formatClock,
  isActiveStatus,
  refView,
  segmentCellStatus,
  segmentDeleteNote,
  segmentNo,
  segmentPriceParts,
  segmentRefChanged,
  segmentUses,
  videoRateOf,
} from "./derive";
import { PreviewPanel, liveRun } from "./preview-panel";
import { SegmentTextEditor, type SegmentTextEditorHandle } from "./segment-text-editor";
import type { ChipView } from "./segment-text";
import { SegmentTimeline } from "./segment-timeline";

// ── 顶栏里的两样（桌面放顶栏，手机放页首）────────────────────────────────────

/** 「每秒 6 积分，一条 5–15 秒」/「每秒 6 积分，单条最长 10 秒」 */
export function modelDetail(m: CanvasModelOption): string {
  const price = m.billingUnit === "per_second" ? `每秒 ${m.creditCost} 积分` : `每条 ${m.creditCost} 积分`;
  const min = m.minDurationSec && m.minDurationSec > 1 ? m.minDurationSec : null;
  if (min && m.maxDurationSec) return `${price}，一条 ${min}–${m.maxDurationSec} 秒`;
  if (min) return `${price}，一条至少 ${min} 秒`;
  return m.maxDurationSec ? `${price}，单条最长 ${m.maxDurationSec} 秒` : price;
}

function VideoModelSelect() {
  const pricing = useCanvasPricing();
  if (!pricing.ready) return <span className="cve-model cv-hint">视频模型读取中…</span>;
  if (!pricing.videoModels.length) {
    return (
      <span className="cve-model cve-reason is-danger" data-reason="no-video-model">
        还没有可用的视频模型
      </span>
    );
  }
  const current = pricing.videoModels.find((m) => m.endpointId === pricing.videoModelId);
  return (
    <label className="cve-model" title={current ? `${current.name}：${modelDetail(current)}。换了模型，之后生成的视频按新模型出、按新模型计价` : undefined}>
      <span className="cve-model-label">视频模型</span>
      {/* 选中后只显示模型名（顶栏放不下价格）；价格和单条上限在每个选项的 title 里，片段标题旁也写着 */}
      <select
        className="cv-select cve-model-select"
        value={pricing.videoModelId ?? ""}
        onChange={(e) => pricing.setVideoModelId(e.target.value)}
        aria-label={current ? `视频模型，现在是${current.name}，${modelDetail(current)}` : "视频模型"}
        data-action="video-model"
      >
        {pricing.videoModels.map((m) => (
          <option key={m.endpointId} value={m.endpointId} title={modelDetail(m)}>
            {m.name}
          </option>
        ))}
      </select>
    </label>
  );
}

function AssembleControls({ no, onPreview }: { no: number; onPreview: () => void }) {
  const { canvasId, doc, meta, readOnly } = useCanvasDoc();
  const runs = useCanvasRuns();
  const ep = findEpisode(doc, no);
  const target = RunTarget.assemble(no);
  // 提交中也算「合成中」
  const live = runs.isSubmitting(target) ? "queued" : liveRun(runs.runFor, target, ep?.assembleRun).status;
  const info = assembleInfo(doc, no, live);
  const reason = info.running ? undefined : info.segments === 0 ? "还没有片段" : info.missing ? `还有 ${info.missing} 个片段没有视频` : undefined;
  const assemble = () => void submitOrToast(runs.submit, { kind: "assemble", body: { episodeNo: no } }, "成片没开始合成");

  const reasonEl = reason && (
    <span className="cve-reason cve-assemble-reason cv-ellipsis" data-reason="assemble" data-missing={info.missing} title={reason}>
      {reason}
    </span>
  );

  if (!ep?.assembled) {
    return (
      <div className="cve-assemble">
        {reasonEl}
        <button
          type="button"
          className="btn btn-grad btn-sm"
          disabled={readOnly || !info.canAssemble}
          aria-busy={info.running || undefined}
          onClick={assemble}
          title="按片段顺序拼成一整集，不花积分"
          data-action="assemble"
        >
          {info.running ? <Loader2 size={14} className="cv-spin" /> : <Clapperboard size={14} />}
          {info.running ? "合成中" : "合成成片"}
        </button>
      </div>
    );
  }
  return (
    <div className="cve-assemble">
      {info.stale && !reason && (
        <span className="cve-reason is-warn cv-ellipsis" data-reason="film-stale">
          成片是旧的，重新合成
        </span>
      )}
      {reasonEl}
      <button type="button" className="btn btn-line btn-sm cve-hide-sm" onClick={onPreview} data-action="preview-film">
        <Film size={14} /> 看成片
      </button>
      <button
        type="button"
        className="btn btn-line btn-sm"
        disabled={readOnly || !info.canAssemble}
        aria-busy={info.running || undefined}
        onClick={assemble}
        title="按现在挑中的各片段视频重新拼一遍，不花积分"
        data-action="reassemble"
      >
        {info.running ? <Loader2 size={14} className="cv-spin" /> : <RefreshCw size={14} />}
        {info.running ? "合成中" : "重新合成"}
      </button>
      <button
        type="button"
        className="btn btn-primary btn-sm"
        onClick={() => void downloadAssembled(canvasId, ep.assembled!, assembledFilename(meta.title, no))}
        data-action="download-film"
      >
        <Download size={14} /> 下载成片
      </button>
    </div>
  );
}

// ── 页面 ─────────────────────────────────────────────────────────────────────

export function EpisodeEditor({ no }: { no: number }) {
  const { canvasId, doc, meta, update, readOnly } = useCanvasDoc();
  const runs = useCanvasRuns();
  const pricing = useCanvasPricing();
  const storyboard = useStoryboardAction();
  const id = encodeURIComponent(canvasId);
  const valid = Number.isInteger(no) && no > 0;
  const scriptEp = valid ? doc.script.episodes.find((e) => e.no === no) : undefined;
  const ep = valid ? findEpisode(doc, no) : null;
  const segments = React.useMemo(() => ep?.segments ?? [], [ep]);

  const [currentId, setCurrentId] = React.useState<string | undefined>(undefined);
  const current = segments.find((s) => s.id === currentId) ?? segments[0];
  const index = current ? segments.indexOf(current) : -1;
  const [editingId, setEditingId] = React.useState<string | null>(() => {
    const first = segments[0];
    return first && !first.text.trim() ? first.id : null;
  });
  const editing = !readOnly && !!current && editingId === current.id;
  const [filmOpen, setFilmOpen] = React.useState(false);
  const editorRef = React.useRef<SegmentTextEditorHandle | null>(null);
  const [sbBusy, setSbBusy] = React.useState(false);

  const select = React.useCallback(
    (segId: string) => {
      setCurrentId(segId);
      const s = segments.find((x) => x.id === segId);
      setEditingId(s && !s.text.trim() ? segId : null);
    },
    [segments],
  );

  // ── 引用标签怎么显示 ─────────────────────────────────────────────────────
  const view = React.useCallback(
    (ref: SegmentRef): ChipView => {
      const v = refView(doc, ref);
      return {
        label: v.label,
        missing: v.missing,
        image: v.image,
        title: v.missing ? `${MISSING_REF_TEXT[ref.kind]}（原来叫「${ref.label}」），删掉这个标签或换一个` : v.label,
      };
    },
    [doc],
  );
  const text = current?.text ?? "";
  const viewKey = React.useMemo(
    () =>
      parseRefs(text)
        .map((r) => {
          const v = refView(doc, r);
          return `${r.kind}:${r.id}:${v.label}:${v.missing ? 1 : 0}:${v.image?.key ?? ""}:${v.image?.url ?? ""}`;
        })
        .join("|"),
    [doc, text],
  );
  const items = React.useMemo(() => (valid ? episodeAssets(doc, no) : []), [doc, no, valid]);
  const resign = React.useCallback((key: string) => resignCanvasAsset(canvasId, key), [canvasId]);

  // ── 片段格子状态 ─────────────────────────────────────────────────────────
  const finishedAt = React.useMemo(() => {
    const m = new Map<string, string>();
    const add = (r?: DramaCanvasRun) => {
      if (r?.status === "succeeded" && r.finishedAt) m.set(r.id, r.finishedAt);
    };
    for (const r of episodeRefs(ep)) add(runs.runFor(r.kind === "look" ? RunTarget.look(r.id) : r.kind === "scene" ? RunTarget.scene(r.id) : RunTarget.material(r.id)));
    for (const s of segments) add(runs.runFor(RunTarget.frame(no, s.id)));
    return (runId: string) => m.get(runId);
  }, [runs, ep, segments, no]);

  const segStatuses = React.useCallback(
    (s: CanvasSegment) => {
      // 提交中（运行记录还没回来）按排队算：格子显示生成中、批量跳过、不能删
      const f = RunTarget.frame(no, s.id);
      const v = RunTarget.video(no, s.id);
      return {
        frame: runs.isSubmitting(f) ? ("queued" as const) : liveRun(runs.runFor, f, s.frameRun).status,
        video: runs.isSubmitting(v) ? ("queued" as const) : liveRun(runs.runFor, v, s.videoRun).status,
      };
    },
    [runs, no],
  );
  const cellStatus = React.useCallback(
    (s: CanvasSegment) => {
      const st = segStatuses(s);
      return segmentCellStatus(s, { frameStatus: st.frame, videoStatus: st.video, refChanged: segmentRefChanged(doc, s, finishedAt) });
    },
    [doc, finishedAt, segStatuses],
  );
  const isRunning = React.useCallback(
    (segId: string) => {
      const s = segments.find((x) => x.id === segId);
      if (!s) return false;
      const st = segStatuses(s);
      return isActiveStatus(st.frame) || isActiveStatus(st.video);
    },
    [segments, segStatuses],
  );
  // 删片段的确认框是异步的：点完「删除」时要按那一刻的最新状态再判一次（不用弹框前闭包里的旧值）
  const isRunningRef = React.useRef(isRunning);
  isRunningRef.current = isRunning;
  const readOnlyRef = React.useRef(readOnly);
  readOnlyRef.current = readOnly;

  // ── 片段增删改 ───────────────────────────────────────────────────────────
  const onText = React.useCallback(
    (next: string) => {
      if (!current) return;
      const segId = current.id;
      update((d) => updateSegment(d, no, segId, { text: next }));
    },
    [current, no, update],
  );

  const insertAt = (i: number) => {
    let newId = "";
    update((d) => {
      const r = insertSegment(d, no, i);
      newId = r.segmentId;
      return r.doc;
    });
    if (newId) {
      setCurrentId(newId);
      setEditingId(newId);
    }
  };

  // 删片段只有这一个入口（片段轴的按钮调它；以后加快捷键也调它，§8.0.1 ④）：只读 / 正在生成的不删；
  // 片段里有任何东西（文字、首帧、视频、生成记录）先确认 —— 删了没有撤销；完全空的直接删。
  const deleteSeg = async (segId: string) => {
    if (readOnly || isRunning(segId)) return;
    const i = segments.findIndex((s) => s.id === segId);
    if (i < 0) return;
    const seg = segments[i];
    const note = segmentDeleteNote(`片段 ${segmentNo(i)} `, seg);
    if (note) {
      const ok = await dramaConfirm({ title: `删除片段 ${segmentNo(i)}？`, body: note, tone: "danger", confirmLabel: "删除", cancelLabel: "再想想" });
      if (!ok) return;
      // 确认框开着的这会儿，片段可能开始生成了、画布可能变成只读了：按最新状态再看一次
      if (readOnlyRef.current || isRunningRef.current(segId)) return;
    }
    const neighbor = segments[i + 1] ?? segments[i - 1];
    update((d) => removeSegment(d, no, segId));
    setCurrentId(neighbor?.id);
    setEditingId(null);
  };

  const pickAsset = (item: { kind: SegmentRef["kind"]; id: string; label: string }) => {
    if (!current || readOnly) return;
    setEditingId(current.id);
    editorRef.current?.insertRef(item);
  };

  const openAtPicker = (anchor: HTMLElement | null) => {
    if (!current || readOnly) return;
    setEditingId(current.id);
    editorRef.current?.openPicker(anchor);
  };

  const runStoryboard = async () => {
    setSbBusy(true);
    try {
      await storyboard.generate(no);
    } finally {
      setSbBusy(false);
    }
  };

  // ── 找不到这一集 ─────────────────────────────────────────────────────────
  if (!valid || !scriptEp) {
    return (
      <div className="cv-page">
        <div className="card cve-empty">
          <Film size={26} />
          <div className="cve-empty-title">剧本里没有这一集</div>
          <div className="cve-empty-sub">可能在剧本页删掉了，或者链接不对。</div>
          <Link href={`/canvas/${id}/episodes`} className="btn btn-primary btn-sm">
            回到逐集制作
          </Link>
        </div>
      </div>
    );
  }

  const heading = episodeHeading(no, scriptEp.title, " · ");
  const sbStatus = liveRun(runs.runFor, RunTarget.storyboard(no), ep?.storyboardRun);
  const storyboarding = isActiveStatus(sbStatus.status) || sbBusy || runs.isSubmitting(RunTarget.storyboard(no));
  const assembleRun = liveRun(runs.runFor, RunTarget.assemble(no), ep?.assembleRun);
  const info = assembleInfo(doc, no, runs.isSubmitting(RunTarget.assemble(no)) ? "queued" : assembleRun.status);

  const crumb = (
    <span className="cv-crumb cve-crumb">
      <Link href={`/canvas/${id}/episodes`}>逐集制作</Link>
      <span aria-hidden>/</span>
      <span className="cv-ellipsis" title={heading}>
        {heading}
      </span>
    </span>
  );

  // 片段编辑区的价格与时长提示
  const videoModel = pricing.videoModels.find((m) => m.endpointId === pricing.videoModelId);
  const rate = videoRateOf(videoModel, pricing.videoPrice(1));
  const maxSec = pricing.maxSegmentSec();
  const minSec = pricing.minSegmentSec();
  const over = !!current && current.durationSec > maxSec;
  const under = !!current && current.durationSec > 0 && current.durationSec < minSec;
  const noDuration = !!current && !!current.text.trim() && totalDuration(current.text) === 0;
  const uses = current ? segmentUses(doc, current.text) : [];

  return (
    <div
      className="cve-editor"
      data-testid="cve-editor"
      data-episode={no}
      data-film={ep?.assembled || assembleRun.status === "failed" ? "" : undefined}
    >
      <CanvasTopbarSlot slot="left">{crumb}</CanvasTopbarSlot>
      <CanvasTopbarSlot slot="right">
        <div className="cve-top-actions">
          <VideoModelSelect />
          <AssembleControls no={no} onPreview={() => setFilmOpen(true)} />
        </div>
      </CanvasTopbarSlot>

      <DesktopHint storageKey="episode-editor" />
      <div className="cve-mobile-actions">
        <VideoModelSelect />
        <AssembleControls no={no} onPreview={() => setFilmOpen(true)} />
      </div>

      {(ep?.assembled || assembleRun.status === "failed") && (
        <div className={`cve-film-bar${info.stale ? " is-stale" : ""}`} data-testid="cve-film-bar">
          <Film size={15} />
          {ep?.assembled ? (
            <span className="cve-film-bar-text">
              成片 <span className="num">{formatClock(ep.assembled.durationSec)}</span> · 合成于 {formatDateTime(ep.assembled.at)}
              {info.stale && <b className="cve-film-bar-stale">成片是旧的，重新合成</b>}
            </span>
          ) : (
            <span className="cve-film-bar-text is-danger">成片没合成出来{assembleRun.run?.errorMessage ? `：${assembleRun.run.errorMessage}` : "，可以再试一次"}</span>
          )}
          {ep?.assembled && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setFilmOpen(true)} data-action="open-film">
              看成片
            </button>
          )}
        </div>
      )}

      {!current ? (
        <div className="card cve-empty" data-testid="cve-editor-empty">
          {storyboarding ? (
            <>
              <Loader2 size={24} className="cv-spin" />
              <div className="cve-empty-title">分镜脚本生成中</div>
              <div className="cve-empty-sub">好了会自动出现在这里，关掉页面也不影响。</div>
            </>
          ) : (
            <>
              <Clapperboard size={26} />
              <div className="cve-empty-title">这一集还没有片段</div>
              <div className="cve-empty-sub">生成分镜脚本：AI 把这一集剧本切成几个片段，每个片段一次生成一条视频。也可以自己写。</div>
              <div className="cve-empty-actions">
                <button
                  type="button"
                  className="btn btn-grad btn-sm"
                  disabled={readOnly || !scriptEp.text.trim()}
                  onClick={() => void runStoryboard()}
                  data-action="storyboard"
                >
                  <Sparkles size={14} /> 生成分镜脚本 <Credits n={storyboard.price} />
                </button>
                <button type="button" className="btn btn-line btn-sm" disabled={readOnly} onClick={() => insertAt(0)} data-action="blank-segment">
                  <Plus size={14} /> 自己写，加一个空片段
                </button>
              </div>
              {!scriptEp.text.trim() && (
                <div className="cve-reason" data-reason="no-script">
                  这一集的剧本还是空的，先去剧本页写好
                </div>
              )}
              {sbStatus.status === "failed" && (
                <div className="cve-reason is-danger" data-reason="storyboard-failed">
                  上次分镜脚本没生成出来{sbStatus.run?.errorMessage ? `：${sbStatus.run.errorMessage}` : ""}
                </div>
              )}
            </>
          )}
        </div>
      ) : (
        <>
          <div className="cve-cols">
            <AssetPanel items={items} disabled={readOnly} onPick={pickAsset} />

            <section className="card cve-seg" aria-label={`片段 ${segmentNo(index)}`} data-testid="cve-segment" data-segment={current.id}>
              <header className="cve-seg-head">
                <h2 className="cve-seg-title">片段 {segmentNo(index)}</h2>
                {pricing.ready ? (
                  <PriceLine
                    className={`cve-seg-price${over || under ? " is-over" : ""}`}
                    parts={segmentPriceParts(rate, current.durationSec, pricing.videoPrice(current.durationSec, pricing.videoModelId))}
                  />
                ) : (
                  <span className={`cve-seg-price${over || under ? " is-over" : ""}`} data-pending="price">
                    本片段 {current.durationSec} 秒 · 价格读取中…
                  </span>
                )}
              </header>
              <SegmentTextEditor
                key={current.id}
                ref={editorRef}
                value={current.text}
                editing={editing}
                readOnly={readOnly}
                placeholder="写这个片段的分镜：每一镜一行，开头写时长，比如「（4 秒）夜，车厢里。近景……」，输入 @ 引用角色、场景或素材图"
                ariaLabel={`片段 ${segmentNo(index)} 的分镜脚本`}
                view={view}
                viewKey={viewKey}
                items={items}
                onChange={onText}
                onRequestEdit={() => setEditingId(current.id)}
                resign={resign}
              />
              {over && (
                <div className="cve-warn is-danger" data-reason="too-long">
                  这个片段 {current.durationSec} 秒，超过当前视频模型的上限 {maxSec} 秒，拆成两个片段或换模型
                </div>
              )}
              {under && (
                <div className="cve-warn is-danger" data-reason="too-short">
                  这个片段只有 {current.durationSec} 秒，当前视频模型一条至少 {minSec} 秒，把镜头写长一点，或者把它和相邻片段合并
                </div>
              )}
              {noDuration && (
                <div className="cve-warn" data-reason="no-duration">
                  每一行开头写上这一镜的时长，比如「（4 秒）」，片段时长按它加总
                </div>
              )}
              <div className="cve-uses" data-testid="cve-uses">
                {uses.length ? (
                  <>
                    <span className="cve-uses-label">用到：</span>
                    {uses.map((u, i) => (
                      <span key={`${u.kind}:${u.id}`} className={u.missing ? "cve-use is-missing" : "cve-use"}>
                        {i > 0 && " · "}
                        {u.label}
                        {u.missing ? `（${MISSING_REF_TEXT[u.kind]}）` : !u.image ? "（还没出图）" : ""}
                      </span>
                    ))}
                    {uses.some((u) => u.image && !u.missing) && <span className="cve-uses-tail">（首帧会参考这几张图）</span>}
                  </>
                ) : (
                  "还没有 @ 引用角色或场景：首帧只按文字画，角色长相可能对不上"
                )}
              </div>
              <div className="cve-seg-foot">
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  disabled={readOnly}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={(e) => openAtPicker(e.currentTarget)}
                  data-action="at-ref"
                >
                  <AtSign size={14} /> 引用
                </button>
                <button
                  type="button"
                  className={editing ? "btn btn-primary btn-sm" : "btn btn-line btn-sm"}
                  disabled={readOnly}
                  onClick={() => setEditingId(editing ? null : current.id)}
                  data-action="toggle-edit"
                >
                  {editing ? <Check size={14} /> : <Pencil size={14} />}
                  {editing ? "完成" : "编辑"}
                </button>
              </div>
            </section>

            <PreviewPanel key={current.id} no={no} seg={current} index={index} ratio={meta.ratio} />
          </div>

          <SegmentTimeline
            no={no}
            segments={segments}
            currentId={current.id}
            readOnly={readOnly}
            cellStatus={cellStatus}
            isRunning={isRunning}
            onSelect={select}
            onInsert={insertAt}
            onDelete={(segId) => void deleteSeg(segId)}
          />
        </>
      )}

      <AssembledDialog
        open={filmOpen && !!ep?.assembled}
        onClose={() => setFilmOpen(false)}
        canvasId={canvasId}
        title={episodeHeading(no, scriptEp.title)}
        ratio={meta.ratio}
        assembled={ep?.assembled}
        stale={info.stale}
        filename={assembledFilename(meta.title, no)}
        onReassemble={() => {
          setFilmOpen(false);
          void submitOrToast(runs.submit, { kind: "assemble", body: { episodeNo: no } }, "成片没开始合成");
        }}
        reassembleDisabled={readOnly || !info.canAssemble}
      />
    </div>
  );
}
