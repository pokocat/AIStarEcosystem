"use client";

// 逐集制作（v0.198，plan §2.5）：每集一张横卡（按剧本的集），标题下一行写清楚要花多少。
// 还没分镜脚本 →「生成分镜脚本 ✦N」+「编辑」；有 →「编辑」+（有成片）「预览」「下载」。「多选」→ 批量生成分镜脚本。
// 集数以剧本页为准，这里不加集。
import * as React from "react";
import Link from "next/link";
import { Check, Download, Film, Loader2, Pencil, Play, Sparkles } from "lucide-react";
import { CanvasImage, CanvasNextBar } from "@/canvas/shell";
import { RunTarget, findEpisode, useCanvasDoc, useCanvasPricing, useCanvasRuns } from "@/canvas/core";
import { useStoryboardAction } from "./actions";
import { AssembledDialog, Credits, PriceLine, assembledFilename, downloadAssembled } from "./bits";
import {
  episodeCardStatus,
  episodeCast,
  episodeCover,
  episodeDuration,
  episodeHeading,
  estimateEpisodeCost,
  estimateEpisodeSec,
  formatClock,
  listPriceParts,
  videoRateOf,
} from "./derive";

export function EpisodeListView() {
  const { canvasId, doc, meta, readOnly } = useCanvasDoc();
  const runs = useCanvasRuns();
  const pricing = useCanvasPricing();
  const storyboard = useStoryboardAction();
  const [multi, setMulti] = React.useState(false);
  const [selected, setSelected] = React.useState<Set<number>>(() => new Set());
  const [busy, setBusy] = React.useState<Set<number>>(() => new Set());
  const [preview, setPreview] = React.useState<number | null>(null);
  const id = encodeURIComponent(canvasId);
  const episodes = doc.script.episodes;

  // ── 价格说明 ──────────────────────────────────────────────────────────────
  const videoModel = pricing.videoModels.find((m) => m.endpointId === pricing.videoModelId);
  const rate = videoRateOf(videoModel, pricing.videoPrice(1));
  const estimateSec = estimateEpisodeSec(doc);
  const estimate = estimateEpisodeCost({
    durationSec: estimateSec,
    maxSegmentSec: pricing.maxSegmentSec(),
    storyboard: pricing.storyboardPrice(),
    frame: pricing.imagePrice(1),
    videoPrice: (sec) => pricing.videoPrice(sec),
  });
  const priceParts = listPriceParts({
    episodes: episodes.length,
    storyboard: pricing.storyboardPrice(),
    frame: pricing.imagePrice(1),
    rate,
    estimateSec,
    estimate,
  });

  const liveStatus = (no: number) => ({
    storyboard: runs.runFor(RunTarget.storyboard(no))?.status,
    assemble: runs.runFor(RunTarget.assemble(no))?.status,
  });

  const runOne = async (no: number) => {
    setBusy((s) => new Set(s).add(no));
    try {
      await storyboard.generate(no);
    } finally {
      setBusy((s) => {
        const n = new Set(s);
        n.delete(no);
        return n;
      });
    }
  };

  const [batchBusy, setBatchBusy] = React.useState(false);
  const runBatch = async () => {
    const nos = [...selected].sort((a, b) => a - b);
    setBatchBusy(true);
    try {
      const done = await storyboard.generateMany(nos);
      if (done) {
        setSelected(new Set());
        setMulti(false);
      }
    } finally {
      setBatchBusy(false);
    }
  };

  const toggle = (no: number) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(no)) n.delete(no);
      else n.add(no);
      return n;
    });

  const previewEp = preview != null ? findEpisode(doc, preview) : null;
  const previewScript = preview != null ? episodes.find((e) => e.no === preview) : undefined;

  return (
    <div className="cv-page cve-list" data-testid="cve-episode-list">
      <div className="cve-list-head">
        <div className="cve-list-titles">
          <h1 className="cv-page-title">逐集制作</h1>
          {episodes.length > 0 &&
            (pricing.ready ? (
              <PriceLine parts={priceParts} className="cve-price-line" />
            ) : (
              <span className="cve-price-line" data-pending="price">
                共 {episodes.length} 集 · 价格读取中…
              </span>
            ))}
          <p className="cv-hint">价格按当前视频模型估算，实际以生成时为准。视频模型在单集编辑器里换。</p>
        </div>
        {episodes.length > 0 && (
          <button
            type="button"
            className={multi ? "btn btn-primary btn-sm" : "btn btn-line btn-sm"}
            aria-pressed={multi}
            disabled={readOnly}
            onClick={() => {
              setMulti((m) => !m);
              setSelected(new Set());
            }}
            data-action="multi"
          >
            {multi ? "取消多选" : "多选"}
          </button>
        )}
      </div>

      {episodes.length === 0 ? (
        <div className="card cve-empty">
          <Film size={26} />
          <div className="cve-empty-title">剧本里还没有分集</div>
          <div className="cve-empty-sub">先在剧本页写好或粘贴分集剧本，这里会按集列出来。</div>
          <Link href={`/canvas/${id}/script`} className="btn btn-primary btn-sm">
            去剧本页
          </Link>
        </div>
      ) : (
        <div className="cve-cards">
          {episodes.map((se) => {
            const no = se.no;
            const ep = findEpisode(doc, no);
            const status = episodeCardStatus(doc, no, liveStatus(no));
            const cast = episodeCast(doc, no);
            const cover = episodeCover(doc, no);
            const dur = episodeDuration(doc, no);
            const heading = episodeHeading(no, se.title);
            const sbRun = runs.runFor(RunTarget.storyboard(no));
            const sbFailed = (sbRun?.status ?? ep?.storyboardRun?.status) === "failed" && status.state === "no-storyboard";
            const noScript = !se.text.trim();
            // 「提交中」和 queued / running 一起算生成中（core 也按目标去重，这里是让按钮先灰掉）
            const generating = status.state === "storyboarding" || busy.has(no) || runs.isSubmitting(RunTarget.storyboard(no));
            const checked = selected.has(no);
            const selectable = !generating && !noScript;
            const editHref = `/canvas/${id}/episodes/${no}`;
            return (
              <article
                key={no}
                className={`card cve-ep${multi && checked ? " is-checked" : ""}`}
                data-episode={no}
                data-state={status.state}
              >
                {multi && (
                  <label className="cve-ep-check" title={selectable ? "选中这一集" : noScript ? "这一集的剧本是空的" : "正在生成"}>
                    <input type="checkbox" checked={checked} disabled={!selectable} onChange={() => toggle(no)} aria-label={`选中${heading}`} />
                  </label>
                )}
                <Link href={editHref} className="cve-ep-cover" aria-label={`编辑${heading}`} tabIndex={-1}>
                  <CanvasImage
                    asset={cover}
                    alt={heading}
                    className="cve-ep-cover-img"
                    placeholder={
                      <span className="cve-ep-cover-ph" aria-hidden>
                        <Film size={22} />
                      </span>
                    }
                  />
                  {dur > 0 && <span className="cve-ep-dur num">{formatClock(dur)}</span>}
                </Link>
                <div className="cve-ep-body">
                  <span className={`tag tag-${status.tone} cve-ep-state`}>
                    {status.state === "storyboarding" && <Loader2 size={12} className="cv-spin" />}
                    {status.state === "done" && <Check size={12} />}
                    {status.label}
                  </span>
                  <h2 className="cve-ep-title cv-ellipsis" title={heading}>
                    {heading}
                  </h2>
                  <div className="cve-ep-stats">
                    角色 {cast.characters} · 场景 {cast.scenes}
                    {status.segments > 0 && ` · 片段 ${status.withVideo}/${status.segments}`}
                  </div>
                  {sbFailed && (
                    <div className="cve-ep-note is-danger" data-reason="storyboard-failed">
                      分镜脚本没生成出来{sbRun?.errorMessage ? `：${sbRun.errorMessage}` : "，可以再试一次"}
                    </div>
                  )}
                  {status.assembledStale && status.state !== "stale" && <div className="cve-ep-note">成片是旧的，全部片段有视频后重新合成</div>}
                  <div className="cve-ep-actions">
                    {status.segments === 0 ? (
                      <>
                        <button
                          type="button"
                          className="btn btn-grad btn-sm"
                          disabled={readOnly || generating || noScript}
                          aria-busy={generating || undefined}
                          onClick={() => void runOne(no)}
                          data-action="storyboard"
                        >
                          {generating ? <Loader2 size={14} className="cv-spin" /> : <Sparkles size={14} />}
                          {generating ? "分镜脚本生成中" : "生成分镜脚本"}
                          {!generating && <Credits n={storyboard.price} />}
                        </button>
                        <Link href={editHref} className="btn btn-line btn-sm" data-action="edit">
                          <Pencil size={14} /> 编辑
                        </Link>
                      </>
                    ) : (
                      <>
                        <Link href={editHref} className="btn btn-primary btn-sm" data-action="edit">
                          <Pencil size={14} /> 编辑
                        </Link>
                        {ep?.assembled && (
                          <>
                            <button type="button" className="btn btn-line btn-sm" onClick={() => setPreview(no)} data-action="preview">
                              <Play size={14} /> 预览
                            </button>
                            <button
                              type="button"
                              className="btn btn-line btn-sm"
                              onClick={() => void downloadAssembled(canvasId, ep.assembled!, assembledFilename(meta.title, no))}
                              data-action="download"
                            >
                              <Download size={14} /> 下载
                            </button>
                          </>
                        )}
                      </>
                    )}
                  </div>
                  {status.segments === 0 && noScript && (
                    <div className="cve-ep-note" data-reason="no-script">
                      这一集的剧本还是空的，先去剧本页写好
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {multi ? (
        <CanvasNextBar
          hint="勾选要生成分镜脚本的集，已有片段的会整集替换"
          next={{
            label: `为选中的 ${selected.size} 集生成分镜脚本`,
            cost: selected.size && storyboard.price != null ? storyboard.price * selected.size : undefined,
            disabled: readOnly || selected.size === 0,
            disabledReason: selected.size === 0 ? "先勾选要生成的集" : undefined,
            busy: batchBusy,
            onClick: () => void runBatch(),
          }}
        />
      ) : (
        <CanvasNextBar hint="每集先生成分镜脚本，再按片段出首帧和视频" prev={{ label: "角色和场景", href: `/canvas/${id}/assets` }} />
      )}

      <AssembledDialog
        open={preview != null && !!previewEp?.assembled}
        onClose={() => setPreview(null)}
        canvasId={canvasId}
        title={preview != null ? episodeHeading(preview, previewScript?.title) : ""}
        ratio={meta.ratio}
        assembled={previewEp?.assembled}
        stale={preview != null && episodeCardStatus(doc, preview).assembledStale}
        filename={assembledFilename(meta.title, preview ?? 0)}
      />
    </div>
  );
}
