"use client";

// 单集编辑器右栏「预览」（plan §2.6 / §5.3 / §5.4）：挑中的视频或首帧；「出首帧」「用上一片段最后一帧」「生成视频」；
// 多个版本左右切换 +「用这版」；在跑的显示进度，排队中的可以停；失败写原因；跑完把 refs.notes 如实写出来。
// 父组件按片段 id 给它 key：换片段 = 换一个实例（看哪一版、看视频还是首帧都从头来）。
import * as React from "react";
import { ChevronLeft, ChevronRight, Clapperboard, Image as ImageIcon, Info, Loader2, SkipForward, Square } from "lucide-react";
import { formatDateTime } from "@ai-star-eco/api-client";
import type { CanvasRunRef, CanvasSegment, DramaCanvasRatio, DramaCanvasRun, DramaCanvasRunStatus, DramaCanvasRunTarget } from "@ai-star-eco/types/drama-canvas";
import { CanvasImage, CanvasVideo } from "@/canvas/shell";
import { RunTarget, pickedImage, pickedVideo, setPicked, useCanvasDoc, useCanvasPricing, useCanvasRuns } from "@/canvas/core";
import { confirmSpend, submitOrToast } from "./actions";
import { Credits } from "./bits";
import { applyPrevLastFrame, isActiveStatus, prevLastFrame, segmentNo } from "./derive";

/** 运行记录里的这一次（和文档里的引用是同一次才用它；文档里记着更新的一次时只知道状态）。 */
export function liveRun(
  runFor: (t: DramaCanvasRunTarget) => DramaCanvasRun | undefined,
  target: DramaCanvasRunTarget,
  ref: CanvasRunRef | undefined,
): { status?: DramaCanvasRunStatus; run?: DramaCanvasRun } {
  const run = runFor(target);
  if (run && (!ref || run.id === ref.runId)) return { status: run.status, run };
  return { status: ref?.status };
}

export function RunLine({
  what,
  status,
  run,
  submitting,
  readOnly,
  onCancel,
  cancelAction,
}: {
  what: "首帧" | "视频";
  status?: DramaCanvasRunStatus;
  run?: DramaCanvasRun;
  /** 请求已发出、服务端还没回运行记录（还没有能停的东西）。 */
  submitting?: boolean;
  /** 画布只读（在别的页面改过、还没载入最新）：停止也会改服务端的任务，一起禁用。 */
  readOnly?: boolean;
  onCancel: () => void;
  cancelAction: string;
}) {
  if (submitting) {
    return (
      <div className="cve-run is-active" data-run={what} data-status="submitting">
        <Loader2 size={13} className="cv-spin" />
        <span className="cve-run-text">{what}正在提交</span>
      </div>
    );
  }
  if (!status) return null;
  if (status === "queued") {
    return (
      <div className="cve-run is-active cve-run-queued" data-run={what} data-status="queued">
        <div className="cve-run-row">
          <Loader2 size={13} className="cv-spin" />
          <span className="cve-run-text">{what}排队中</span>
          <button type="button" className="btn btn-ghost btn-sm cve-run-stop" disabled={readOnly} onClick={onCancel} data-action={cancelAction}>
            <Square size={12} /> 停止
          </button>
        </div>
        {readOnly && (
          <span className="cve-reason" data-reason={cancelAction}>
            先载入最新的画布
          </span>
        )}
      </div>
    );
  }
  if (status === "running") {
    return (
      <div className="cve-run is-active" data-run={what} data-status="running">
        <Loader2 size={13} className="cv-spin" />
        <span className="cve-run-text">{what}生成中，已经开始了，停不下来</span>
      </div>
    );
  }
  if (status === "failed") {
    return (
      <div className="cve-run is-danger" data-run={what} data-status="failed">
        <span className="cve-run-text">
          {what}没生成出来：{run?.errorMessage || "请再试一次。没生成出来的不扣积分。"}
        </span>
      </div>
    );
  }
  if (status === "canceled") {
    return (
      <div className="cve-run" data-run={what} data-status="canceled">
        <span className="cve-run-text">{what}已停止，这次不扣积分</span>
      </div>
    );
  }
  const notes = run?.refs?.notes ?? [];
  if (!notes.length) return null;
  return (
    <div className="cve-run is-note" data-run={what} data-status="succeeded" data-notes={notes.length} title={`上一次生成${what}时的说明`}>
      <Info size={13} />
      <span className="cve-run-text">{notes.join("；")}</span>
    </div>
  );
}

export interface PreviewPanelProps {
  no: number;
  seg: CanvasSegment;
  index: number;
  ratio: DramaCanvasRatio;
}

export function PreviewPanel({ no, seg, index, ratio }: PreviewPanelProps) {
  const { doc, update, readOnly } = useCanvasDoc();
  const runs = useCanvasRuns();
  const pricing = useCanvasPricing();
  const label = `片段 ${segmentNo(index)}`;

  const frameTarget = RunTarget.frame(no, seg.id);
  const videoTarget = RunTarget.video(no, seg.id);
  const frame = liveRun(runs.runFor, frameTarget, seg.frameRun);
  const video = liveRun(runs.runFor, videoTarget, seg.videoRun);
  // 「提交中」（请求发出、运行记录还没回来）和 queued / running 一起算生成中：连点不会发第二个请求、扣第二份
  const frameSubmitting = runs.isSubmitting(frameTarget);
  const videoSubmitting = runs.isSubmitting(videoTarget);
  const frameActive = frameSubmitting || isActiveStatus(frame.status);
  const videoActive = videoSubmitting || isActiveStatus(video.status);

  const pickedV = pickedVideo(seg.video);
  const pickedF = pickedImage(seg.frame);
  const [view, setView] = React.useState<"video" | "frame">(pickedV ? "video" : "frame");
  // 第一版视频到了：自动切过去看
  const hadVideo = React.useRef(!!pickedV);
  React.useEffect(() => {
    if (pickedV && !hadVideo.current) setView("video");
    hadVideo.current = !!pickedV;
  }, [pickedV]);
  const showing = view === "video" && pickedV ? "video" : "frame";

  // 正在看哪一版（缺省 = 挑中的那版；挑中的变了就跟着走）
  const [browseKey, setBrowseKey] = React.useState<string | null>(null);
  const pickedKey = showing === "video" ? pickedV?.key : pickedF?.key;
  React.useEffect(() => setBrowseKey(null), [pickedKey, showing]);
  const versions: { key: string }[] = showing === "video" ? seg.video.versions : seg.frame.versions;
  const curIdx = Math.max(0, versions.findIndex((v) => v.key === (browseKey ?? pickedKey)));
  const cur = versions[curIdx];
  const isPicked = !!cur && cur.key === pickedKey;

  const hasText = !!seg.text.trim();
  const model = pricing.videoModels.find((m) => m.endpointId === pricing.videoModelId);
  const maxSec = pricing.maxSegmentSec();
  const over = seg.durationSec > maxSec;
  const noDuration = hasText && seg.durationSec <= 0;
  const noModels = pricing.ready && pricing.videoModels.length === 0;
  const framePrice = pricing.imagePrice(1);
  const videoCost = pricing.videoPrice(seg.durationSec, pricing.videoModelId);
  const plf = prevLastFrame(doc, no, seg.id);

  const videoBlock = !hasText
    ? undefined
    : noDuration
      ? "每一行开头写上这一镜的时长，比如「（4 秒）」"
      : over
        ? `超过当前视频模型的上限 ${maxSec} 秒`
        : noModels
          ? "还没有可用的视频模型"
          : undefined;
  const videoWarn = frameActive
    ? "首帧还在出，等它出来再生成视频"
    : model && !model.acceptsFirstFrame
      ? "这个模型不看首帧，角色可能对不上"
      : !pickedF
        ? "没有首帧，角色长相可能对不上"
        : undefined;
  /** 首帧还在出时点了生成视频：服务端按现在已保存的首帧出（没有就不带首帧），不会等正在出的那张。 */
  const frameRaceNote = frameActive
    ? pickedF
      ? "现在生成会用现在这张首帧，不是正在出的那张。"
      : "现在生成就不带首帧，角色长相可能对不上。"
    : undefined;

  const genFrame = async () => {
    const ok = await confirmSpend({
      title: `给${label}出一张首帧？`,
      body: "首帧会参考片段里 @ 到的角色、场景和素材图。先看画面对不对，再生成视频。",
      cost: framePrice,
      threshold: pricing.confirmThreshold,
      priceKnown: pricing.ready,
    });
    if (!ok) return;
    await submitOrToast(runs.submit, { kind: "image", body: { target: { kind: "segment", episodeNo: no, segmentId: seg.id }, count: 1 } }, "首帧没开始生成");
  };

  const genVideo = async () => {
    const ok = await confirmSpend({
      title: `生成${label}的视频？`,
      body: (
        <>
          {`${seg.durationSec} 秒，用「${model?.name ?? "默认视频模型"}」生成。`}
          {frameRaceNote ? (
            <span style={{ display: "block", marginTop: 6 }}>首帧还在出。{frameRaceNote}</span>
          ) : (
            videoWarn && <span style={{ display: "block", marginTop: 6 }}>{videoWarn}。</span>
          )}
          {pickedV && <span style={{ display: "block", marginTop: 6 }}>生成出来的是新的一版，现在这几版还留着。</span>}
        </>
      ),
      cost: videoCost,
      threshold: pricing.confirmThreshold,
      always: frameActive,
      priceKnown: pricing.ready,
      confirmLabel: frameActive ? "仍然生成" : undefined,
    });
    if (!ok) return;
    await submitOrToast(
      runs.submit,
      { kind: "video", body: { episodeNo: no, segmentId: seg.id, ...(pricing.videoModelId ? { endpointId: pricing.videoModelId } : {}) } },
      "视频没开始生成",
    );
  };

  const applyLastFrame = () => {
    update((d) => applyPrevLastFrame(d, no, seg.id));
    setView("frame");
  };

  const pickThis = () => {
    if (!cur) return;
    update((d) => setPicked(d, showing === "video" ? videoTarget : frameTarget, cur.key));
  };

  const lastFrameReason =
    plf.kind === "first" ? "这是第一个片段，没有上一片段" : plf.kind === "none" ? "上一片段没有末帧" : plf.kind === "applied" ? "已经在用上一片段最后一帧" : undefined;

  const curVideo = showing === "video" ? seg.video.versions[curIdx] : undefined;
  const curFrame = showing === "frame" ? seg.frame.versions[curIdx] : undefined;

  return (
    <aside className="card cve-preview" aria-label="预览" data-testid="cve-preview" data-segment={seg.id}>
      <div className="cve-panel-head">
        <span className="cve-panel-title">预览</span>
        {pickedV && pickedF && (
          <div className="cv-seg cve-preview-tabs" role="group" aria-label="看视频还是首帧">
            <button type="button" className={showing === "video" ? "on" : ""} aria-pressed={showing === "video"} onClick={() => setView("video")}>
              视频
            </button>
            <button type="button" className={showing === "frame" ? "on" : ""} aria-pressed={showing === "frame"} onClick={() => setView("frame")}>
              首帧
            </button>
          </div>
        )}
      </div>

      <div className={`cve-stage cve-stage-${ratio === "16:9" ? "wide" : "tall"}`}>
        {curVideo ? (
          <CanvasVideo version={curVideo} poster={pickedF ?? (curVideo.lastFrameKey ? { key: curVideo.lastFrameKey, url: curVideo.lastFrameUrl } : null)} className="cve-stage-media" />
        ) : curFrame ? (
          <CanvasImage asset={curFrame} alt={`${label}的首帧`} fit="contain" className="cve-stage-media" />
        ) : (
          <div className="cve-stage-empty">
            <ImageIcon size={22} />
            <span>还没有首帧。先出一张首帧看看画面对不对，再生成视频。</span>
          </div>
        )}
      </div>

      {versions.length > 1 && (
        <div className="cve-versions" data-versions={versions.length} data-kind={showing}>
          <button
            type="button"
            className="btn btn-icon btn-ghost btn-sm"
            aria-label="上一版"
            title="上一版"
            disabled={curIdx <= 0}
            onClick={() => setBrowseKey(versions[curIdx - 1].key)}
          >
            <ChevronLeft size={15} />
          </button>
          <span className="cve-versions-text num">
            版本 {curIdx + 1} / {versions.length}
          </span>
          <button
            type="button"
            className="btn btn-icon btn-ghost btn-sm"
            aria-label="下一版"
            title="下一版"
            disabled={curIdx >= versions.length - 1}
            onClick={() => setBrowseKey(versions[curIdx + 1].key)}
          >
            <ChevronRight size={15} />
          </button>
          <button type="button" className="btn btn-line btn-sm cve-versions-pick" disabled={readOnly || isPicked} onClick={pickThis} data-action="pick-version">
            {isPicked ? "正在用这版" : "用这版"}
          </button>
        </div>
      )}
      {curVideo && (
        <div className="cv-hint cve-version-meta">
          {curVideo.durationSec ? `${curVideo.durationSec} 秒 · ` : ""}生成于 {formatDateTime(curVideo.createdAt)}
        </div>
      )}

      <div className="cve-preview-actions">
        <button
          type="button"
          className="btn btn-line btn-sm cve-act"
          disabled={readOnly || !hasText || frameActive}
          aria-busy={frameActive || undefined}
          onClick={() => void genFrame()}
          data-action="frame"
        >
          {frameActive ? <Loader2 size={14} className="cv-spin" /> : <ImageIcon size={14} />}
          <span className="cv-ellipsis">{frameActive ? "首帧生成中" : "出首帧"}</span>
          {!frameActive && <Credits n={pricing.ready ? framePrice : null} />}
        </button>

        <button
          type="button"
          className="btn btn-line btn-sm cve-act"
          disabled={readOnly || plf.kind !== "ready"}
          onClick={applyLastFrame}
          data-action="last-frame"
          title="把上一片段视频的最后一帧当作这个片段的首帧，不花积分"
        >
          <SkipForward size={14} />
          <span className="cv-ellipsis">用上一片段最后一帧</span>
        </button>
        {lastFrameReason && (
          <div className="cve-reason" data-reason="last-frame">
            {lastFrameReason}
          </div>
        )}

        <button
          type="button"
          className="btn btn-grad btn-sm cve-act"
          disabled={readOnly || !hasText || !!videoBlock || videoActive}
          aria-busy={videoActive || undefined}
          onClick={() => void genVideo()}
          data-action="video"
        >
          {videoActive ? <Loader2 size={14} className="cv-spin" /> : <Clapperboard size={14} />}
          <span className="cv-ellipsis">{videoActive ? "视频生成中" : pickedV ? "重新生成视频" : "生成视频"}</span>
          {!videoActive && <Credits n={pricing.ready ? videoCost : null} />}
        </button>
        {videoBlock && (
          <div className="cve-reason is-danger" data-reason="video">
            {videoBlock}
          </div>
        )}
        {!videoBlock && hasText && videoWarn && (
          <div className="cve-reason is-warn" data-reason={frameActive ? "video-frame-pending" : "video-warn"}>
            {videoWarn}
          </div>
        )}
        {!hasText && (
          <div className="cve-reason" data-reason="no-text">
            先写好这个片段的分镜脚本，首帧和视频都按它生成
          </div>
        )}
      </div>

      <div className="cve-runs">
        <RunLine
          what="首帧"
          status={frame.status}
          run={frame.run}
          submitting={frameSubmitting}
          readOnly={readOnly}
          onCancel={() => void runs.cancel(frame.run?.id ?? seg.frameRun?.runId ?? "")}
          cancelAction="cancel-frame"
        />
        <RunLine
          what="视频"
          status={video.status}
          run={video.run}
          submitting={videoSubmitting}
          readOnly={readOnly}
          onCancel={() => void runs.cancel(video.run?.id ?? seg.videoRun?.runId ?? "")}
          cancelAction="cancel-video"
        />
      </div>
    </aside>
  );
}
