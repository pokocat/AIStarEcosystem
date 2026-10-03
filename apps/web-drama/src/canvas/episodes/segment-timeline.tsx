"use client";

// 单集编辑器底部「片段轴」（plan §2.6）：总时长「已有视频 / 全部」；一排缩略格「01 · 10s」（空 / 有首帧 / 有视频 /
// 生成中 / 失败 / 用到的造型换过图了），点格子切换片段；格子之间 + 插一个空片段；删当前片段（有东西时确认）；
// 「多选」→「生成选中的 N 个视频 ✦M」（有首帧 / 没首帧在确认框里分开写；时长不在所选视频模型范围里的
// 跳过，就地和确认框里都写清跳过几个、为什么）。≤720 横滑。
import * as React from "react";
import { Check, CheckCircle2, Circle, Image as ImageIcon, Loader2, PlayCircle, Plus, RefreshCw, Trash2, TriangleAlert } from "lucide-react";
import type { CanvasSegment } from "@ai-star-eco/types/drama-canvas";
import { CanvasImage } from "@/canvas/shell";
import { pickedVideo, useCanvasPricing, useCanvasRuns } from "@/canvas/core";
import { confirmSpend, summarizeSequence, toastSequence } from "./actions";
import { Credits } from "./bits";
import { batchVideoPlan, batchVideoSkipText, cellThumb, formatClock, segmentNo, timelineTotals, type SegmentCellState } from "./derive";

const STATE_ICON: Record<SegmentCellState, React.ReactNode> = {
  empty: <Circle size={12} />,
  frame: <ImageIcon size={12} />,
  video: <CheckCircle2 size={12} />,
  running: <Loader2 size={12} className="cv-spin" />,
  failed: <TriangleAlert size={12} />,
  "ref-changed": <RefreshCw size={12} />,
};

export interface SegmentTimelineProps {
  no: number;
  segments: CanvasSegment[];
  currentId?: string;
  readOnly: boolean;
  cellStatus: (seg: CanvasSegment) => { state: SegmentCellState; label: string };
  isRunning: (segmentId: string) => boolean;
  onSelect: (segmentId: string) => void;
  onInsert: (index: number) => void;
  onDelete: (segmentId: string) => void;
}

export function SegmentTimeline({ no, segments, currentId, readOnly, cellStatus, isRunning, onSelect, onInsert, onDelete }: SegmentTimelineProps) {
  const runs = useCanvasRuns();
  const pricing = useCanvasPricing();
  const [multi, setMulti] = React.useState(false);
  const [selected, setSelected] = React.useState<Set<string>>(() => new Set());
  const [batchBusy, setBatchBusy] = React.useState(false);

  // 片段没了（删掉 / 分镜脚本整集换了）就从选择里拿掉
  React.useEffect(() => {
    setSelected((s) => {
      const ids = new Set(segments.map((x) => x.id));
      const next = new Set([...s].filter((id) => ids.has(id)));
      return next.size === s.size ? s : next;
    });
  }, [segments]);

  const totals = timelineTotals(segments);
  const current = segments.find((s) => s.id === currentId);
  const currentIndex = current ? segments.indexOf(current) : -1;
  const currentRunning = current ? isRunning(current.id) : false;

  const maxSec = pricing.maxSegmentSec();
  const minSec = pricing.minSegmentSec();
  const plan = batchVideoPlan(segments, selected, {
    maxSec,
    minSec,
    price: (d) => pricing.videoPrice(d, pricing.videoModelId),
    isRunning,
  });
  const skipText = batchVideoSkipText(plan, { minSec, maxSec });
  const model = pricing.videoModels.find((m) => m.endpointId === pricing.videoModelId);

  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const runBatch = async () => {
    if (!plan.eligible.length) return;
    const lines: string[] = [];
    if (plan.withFrame) lines.push(`${plan.withFrame} 个有首帧，按首帧生成。`);
    if (plan.withoutFrame) lines.push(`${plan.withoutFrame} 个没有首帧，只按文字生成，角色长相可能对不上。`);
    if (model && !model.acceptsFirstFrame) lines.push("当前视频模型不看首帧，角色可能对不上。");
    if (skipText) lines.push(skipText);
    lines.push("已经有视频的会多出新的一版，原来的还留着。");
    const ok = await confirmSpend({
      title: `生成选中的 ${plan.eligible.length} 个视频？`,
      body: (
        <>
          {lines.map((l) => (
            <span key={l} style={{ display: "block", marginTop: 4 }}>
              {l}
            </span>
          ))}
        </>
      ),
      cost: plan.cost,
      threshold: pricing.confirmThreshold,
      always: true,
      priceKnown: pricing.ready,
    });
    if (!ok) return;
    setBatchBusy(true);
    try {
      // 整批交给 core 按顺序提交：一进来整批都算「提交中」（后面的片段不能被单独再点一次），每项发前再核对，
      // 已经在生成的跳过。不在这里自己循环（Codex 复审 N3：循环只锁当前那一项 = 可能扣两份）。
      const batch = plan.eligible;
      const results = await runs.submitSequence(
        batch.map((s) => ({
          kind: "video" as const,
          body: { episodeNo: no, segmentId: s.id, ...(pricing.videoModelId ? { endpointId: pricing.videoModelId } : {}) },
        })),
        { stopOnError: true },
      );
      const summary = summarizeSequence(results, (i) => `片段 ${segmentNo(segments.findIndex((x) => x.id === batch[i].id))}`);
      toastSequence(summary, "个", "视频");
      if (summary.sent) {
        setSelected(new Set());
        setMulti(false);
      }
    } finally {
      setBatchBusy(false);
    }
  };

  const selectMissing = () => setSelected(new Set(segments.filter((s) => !s.video.versions.length && !isRunning(s.id)).map((s) => s.id)));

  const insertBtn = (index: number) =>
    readOnly || multi ? null : (
      <button
        type="button"
        className="cve-tl-insert"
        onClick={() => onInsert(index)}
        aria-label={index === 0 ? "在最前面加一个空片段" : `在片段 ${segmentNo(index - 1)} 后面加一个空片段`}
        title={index === 0 ? "在最前面加一个空片段" : `在片段 ${segmentNo(index - 1)} 后面加一个空片段`}
        data-action="insert-segment"
        data-index={index}
      >
        <Plus size={13} />
      </button>
    );

  const batchReason = !multi
    ? undefined
    : selected.size === 0
      ? "先点选要生成的片段"
      : !plan.eligible.length
        ? `选中的片段这次都生成不了。${skipText ?? ""}`
        : skipText ?? undefined;

  return (
    <section className="card cve-timeline" aria-label="片段轴" data-testid="cve-timeline">
      <div className="cve-tl-head">
        <span className="cve-tl-title">片段轴</span>
        <span className="cve-tl-time num" title="已有视频的时长 / 全部片段的时长">
          {formatClock(totals.done)} / {formatClock(totals.total)}
        </span>
        <div className="cve-tl-tools">
          {!multi && current && (
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              disabled={readOnly || currentRunning}
              onClick={() => onDelete(current.id)}
              data-action="delete-segment"
            >
              <Trash2 size={13} /> 删除片段 {segmentNo(currentIndex)}
            </button>
          )}
          {multi && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={selectMissing} data-action="select-missing">
              选中还没有视频的
            </button>
          )}
          {multi && (
            <button
              type="button"
              className="btn btn-grad btn-sm"
              disabled={readOnly || !plan.eligible.length}
              aria-busy={batchBusy || undefined}
              onClick={() => !batchBusy && void runBatch()}
              data-action="batch-video"
              data-count={plan.eligible.length}
            >
              生成选中的 {plan.eligible.length} 个视频
              {plan.eligible.length > 0 && <Credits n={pricing.ready ? plan.cost : null} />}
            </button>
          )}
          <button
            type="button"
            className={multi ? "btn btn-primary btn-sm" : "btn btn-line btn-sm"}
            aria-pressed={multi}
            disabled={readOnly}
            onClick={() => {
              setMulti((m) => !m);
              setSelected(new Set());
            }}
            data-action="multi-segments"
          >
            {multi ? "取消多选" : "多选"}
          </button>
        </div>
      </div>
      {!multi && currentRunning && (
        <div className="cve-reason" data-reason="delete-segment">
          这个片段正在生成，先停止或等它结束再删
        </div>
      )}
      {batchReason && (
        <div className="cve-reason" data-reason="batch-video" data-skipped={plan.skipped || undefined}>
          {batchReason}
        </div>
      )}
      <div className="cve-tl-track" role="list">
        {insertBtn(0)}
        {segments.map((s, i) => {
          const st = cellStatus(s);
          const isCur = s.id === currentId;
          const checked = selected.has(s.id);
          const thumb = cellThumb(s);
          return (
            <React.Fragment key={s.id}>
              <div role="listitem" className="cve-tl-item">
                <button
                  type="button"
                  className={`cve-cell is-${st.state}${isCur ? " is-current" : ""}${multi && checked ? " is-checked" : ""}`}
                  aria-current={isCur || undefined}
                  aria-pressed={multi ? checked : undefined}
                  aria-label={`片段 ${segmentNo(i)}，${s.durationSec} 秒，${st.label}`}
                  title={`片段 ${segmentNo(i)} · ${s.durationSec} 秒 · ${st.label}`}
                  onClick={() => (multi ? toggle(s.id) : onSelect(s.id))}
                  data-segment={s.id}
                  data-state={st.state}
                >
                  <span className="cve-cell-thumb">
                    <CanvasImage
                      asset={thumb}
                      alt=""
                      className="cve-cell-img"
                      placeholder={
                        pickedVideo(s.video) ? (
                          <span className="cve-cell-ph cve-cell-ph-video" aria-hidden data-thumb="video-icon">
                            <PlayCircle size={18} />
                          </span>
                        ) : (
                          <span className="cve-cell-ph" aria-hidden />
                        )
                      }
                    />
                    {multi && <span className="cve-cell-check">{checked && <Check size={12} />}</span>}
                  </span>
                  <span className="cve-cell-foot">
                    <span className="num cve-cell-label">
                      {segmentNo(i)} · {s.durationSec}s
                    </span>
                    <span className={`cve-cell-state is-${st.state}`} aria-hidden>
                      {STATE_ICON[st.state]}
                    </span>
                  </span>
                </button>
              </div>
              {insertBtn(i + 1)}
            </React.Fragment>
          );
        })}
      </div>
    </section>
  );
}
