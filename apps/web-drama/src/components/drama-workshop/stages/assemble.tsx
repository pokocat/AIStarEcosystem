"use client";

// 逐集制作 ② 合成成片（StageKey 仍是 prompt；v0.66 取代「成片配方」）— 镜头视频已在分镜表里逐镜生成，
// 最后一步把本集有视频的镜头按序拼成完整一集（server ffmpeg concat → CDN），不扣积分。
// 口径（v0.197，与短视频同一口径）：有视频的镜头都会拼进去；「就用这版」只是标记，不影响拼不拼。
import * as React from "react";
import { toast } from "sonner";
import { formatDateTime } from "@ai-star-eco/api-client";
import { Check, Clapperboard, Download, Film, Package, RefreshCw, Send } from "lucide-react";
import { aiErrorMessage } from "@/lib/ai-error";
import { getEpisodeDoc, seriesProgress, withEpisodeDoc, type ProjectData } from "@/mocks/drama-workshop";
import type { WorkshopAction, WorkshopState } from "../workbench";
import { ProjectsApi } from "@/api";
import type { StageContext } from "./stage-context";

interface AssembleStageProps {
  state: WorkshopState;
  dispatch: React.Dispatch<WorkshopAction>;
  data: ProjectData;
  ctx?: StageContext;
}

export function AssembleStage({ state, dispatch, data, ctx }: AssembleStageProps) {
  const doc = getEpisodeDoc(data, state.ep);
  // 本集有视频的镜头（有 videoUrl 的，按场序 + 镜号）—— 与服务端 DramaAssembleService 同一口径。
  const clips = doc.storyboard.scenes.flatMap((sc, si) =>
    [...sc.shots]
      .sort((a, b) => a.no - b.no)
      .filter((sh) => !!sh.videoUrl)
      .map((sh) => ({ ...sh, sceneNo: si + 1 })),
  );
  const totalShots = doc.storyboard.scenes.reduce((a, sc) => a + sc.shots.length, 0);
  const missing = totalShots - clips.length;
  const totalDur = clips.reduce((a, s) => a + (s.dur || 0), 0);
  const assembled = doc.assembled;
  // 合成之后镜头有增减：提醒再合成一次（旧成片里还是之前那几镜）。
  const stale = !!assembled && assembled.shotCount != null && assembled.shotCount !== clips.length;

  const [busy, setBusy] = React.useState(false);

  const run = async () => {
    if (busy || !clips.length) return;
    setBusy(true);
    try {
      if (!ctx) {
        toast("演示模式下不会真的合成");
        return;
      }
      const result = await ProjectsApi.assembleEpisode(ctx.projectId, state.ep);
      // v0.197：进度按「几集合成好了」算（seriesProgress），不再合成任意一集就写 100 ——
      // 那会让一部 80 集的剧合成完第 1 集就在列表里显示成「已完成」、点开直接进成片预览。
      // 用 patchData 在最新文档上合并，别把这期间别处保存的内容盖掉。
      // patchData 先同步算出新文档、再带着 opts 保存，所以在回调里填 opts.progress 来得及。
      const opts: { progress?: number } = {};
      await ctx.patchData((prev) => {
        const next = withEpisodeDoc(prev, state.ep, { ...getEpisodeDoc(prev, state.ep), assembled: result });
        opts.progress = seriesProgress(next);
        return next;
      }, opts);
      toast.success(`第 ${state.ep} 集合成好了，共 ${result.shotCount ?? clips.length} 镜`);
    } catch (e) {
      toast.error(aiErrorMessage(e, "合成失败，请稍后重试"));
    } finally {
      setBusy(false);
    }
  };

  const spinner = (
    <span aria-hidden style={{ width: 14, height: 14, border: "2px solid rgba(255,255,255,.4)", borderTopColor: "#fff", borderRadius: "50%", display: "inline-block", animation: "drama-spin .7s linear infinite", flex: "none" }} />
  );

  return (
    <div className="scroll" style={{ height: "100%" }}>
      <div className="ep-asm">
        <div className="ep-asm-head">
          <h1>第 {state.ep} 集 · 合成成片</h1>
          <div className="muted" style={{ fontSize: 13.5, marginTop: 4, lineHeight: 1.6 }}>
            把这一集有视频的镜头按顺序拼成一整集。只是拼接，不会重新生成画面，也不扣积分。
          </div>
        </div>

        {/* 成片预览（已合成时置顶） */}
        {assembled && (
          <div className="card ep-asm-hero fade-up">
            <video src={assembled.url} controls playsInline preload="metadata" />
            <div className="col gap-2 grow" style={{ minWidth: 0 }}>
              <div className="row gap-2" style={{ flexWrap: "wrap", rowGap: 6 }}>
                <span className="tag tag-green" style={{ flex: "none" }}><Check size={11} /> 已合成</span>
                <span style={{ fontWeight: 800, fontSize: 16, minWidth: 0 }}>第 {state.ep} 集成片</span>
              </div>
              <div className="faint num" style={{ fontSize: 12.5, lineHeight: 1.6 }}>
                {assembled.shotCount ?? clips.length} 镜 · 约 {assembled.durationSec ?? totalDur} 秒
                {assembled.at ? ` · ${formatDateTime(assembled.at)}` : ""}
              </div>
              {stale && (
                <div style={{ fontSize: 12, lineHeight: 1.6, color: "var(--warn, #d97706)" }}>
                  合成之后镜头有改动（现在有视频的是 {clips.length} 镜），再合成一次才会用上。
                </div>
              )}
              <div className="row gap-2" style={{ marginTop: 6, flexWrap: "wrap" }}>
                <a className="btn btn-primary btn-sm" href={assembled.url} target="_blank" rel="noreferrer" download>
                  <Download size={14} /> 下载成片
                </a>
                <button type="button" className="btn btn-line btn-sm" disabled={busy || !clips.length} onClick={run}>
                  <RefreshCw size={14} /> {busy ? "合成中…" : "重新合成"}
                </button>
                {/* 发布到平台还是模拟的（连接不绑真账号、发布记录会自己变「已发布」），先如实禁用。 */}
                <button type="button" className="btn btn-line btn-sm" disabled title="发布到抖音、快手等平台的功能还没接通">
                  <Send size={14} /> 发布到平台 · 即将上线
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 镜头清单 */}
        <div className="row gap-2" style={{ marginBottom: 12, flexWrap: "wrap", alignItems: "center", rowGap: 4 }}>
          <Film size={15} style={{ color: "var(--accent)", flex: "none" }} />
          <span style={{ fontWeight: 700, fontSize: 14, flex: "none" }}>要拼的镜头（{clips.length}）</span>
          <span className="faint num" style={{ fontSize: 12, minWidth: 0 }}>按场次和镜号排好，共约 {totalDur} 秒</span>
        </div>
        {clips.length > 0 && missing > 0 && (
          <div className="faint" style={{ fontSize: 12, lineHeight: 1.6, marginTop: -6, marginBottom: 12 }}>
            还有 {missing} 镜没有视频，不会拼进去。想拼进去就先回「分镜」给它们生成视频。
          </div>
        )}

        {clips.length === 0 ? (
          <div className="card col center" style={{ padding: "46px 16px", textAlign: "center", gap: 12 }}>
            <div style={{ width: 52, height: 52, borderRadius: 16, background: "var(--accent-soft)", display: "grid", placeItems: "center", color: "var(--accent)" }}>
              <Clapperboard size={26} />
            </div>
            <div className="muted" style={{ maxWidth: 360, fontSize: 13.5, lineHeight: 1.6 }}>
              第 {state.ep} 集还没有生成好视频的镜头。先回<b style={{ color: "var(--accent)" }}>分镜</b>给镜头生成视频，再回来合成。
            </div>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => dispatch({ type: "jump", stage: "epscript" })}>
              回分镜
            </button>
          </div>
        ) : (
          <>
            <div className="ep-asm-grid">
              {clips.map((s, i) => (
                <div key={s.id} className="card col" style={{ padding: 0, overflow: "hidden", minWidth: 0 }}>
                  <div style={{ position: "relative" }}>
                    <video
                      src={s.videoUrl}
                      muted
                      playsInline
                      preload="metadata"
                      style={{ width: "100%", aspectRatio: "9/14", objectFit: "cover", display: "block", background: "#000" }}
                    />
                    <span className="num" style={{ position: "absolute", top: 5, left: 5, background: "rgba(0,0,0,.55)", color: "#fff", fontSize: 10, padding: "1px 6px", borderRadius: 5, fontWeight: 700 }}>
                      {i + 1}
                    </span>
                    <span className="num" style={{ position: "absolute", bottom: 5, right: 5, background: "rgba(0,0,0,.55)", color: "#fff", fontSize: 10, padding: "1px 6px", borderRadius: 5 }}>
                      {s.dur} 秒
                    </span>
                  </div>
                  {/* 内边距放外层：-webkit-line-clamp 的元素自己带 padding 会把第 3 行露半截 */}
                  <div style={{ padding: "6px 8px" }}>
                    <span
                      className="faint"
                      title={s.desc || undefined}
                      style={{
                        fontSize: 10.5,
                        display: "-webkit-box",
                        WebkitBoxOrient: "vertical",
                        WebkitLineClamp: 2,
                        overflow: "hidden",
                        lineHeight: 1.4,
                      }}
                    >
                      场{s.sceneNo} · 第{s.no}镜 · {s.desc || "（没写画面内容）"}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* 没合成过才出现；合成过以后用上面卡片里的「重新合成」，不再放两个作用一样的按钮 */}
            {!assembled && (
              <div className="card ep-asm-foot" style={{ background: "var(--accent-soft)" }}>
                <Package size={20} style={{ color: "var(--accent)", flex: "none" }} />
                <div className="ep-asm-foot-text">
                  <div style={{ fontWeight: 700 }}>拼成完整一集</div>
                  <div className="faint" style={{ fontSize: 12.5, lineHeight: 1.6 }}>
                    有视频的 {clips.length} 个镜头按顺序拼起来，点没点「就用这版」都一样。拼好后可以下载成片。
                  </div>
                </div>
                <button type="button" className="btn btn-grad" disabled={busy} onClick={run}>
                  {busy ? (<>{spinner} 合成中…</>) : (<><Film size={15} /> 开始合成</>)}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
