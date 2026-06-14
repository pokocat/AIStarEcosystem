"use client";

// 成片合成（v0.66，取代「成片配方」）— 分镜已在视频工厂真实出片，
// 最后一步把本集已出片镜头按序拼成完整片（server ffmpeg concat → CDN）。
import * as React from "react";
import { toast } from "sonner";
import { Check, Clapperboard, Download, Film, Package, RefreshCw } from "lucide-react";
import { StageHeader } from "../workbench";
import { aiErrorMessage } from "@/lib/ai-error";
import { getEpisodeDoc, withEpisodeDoc, type ProjectData } from "@/mocks/drama-workshop";
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
  // 本集已出片镜头（有 videoUrl 的，按场序 + 镜号）
  const clips = doc.storyboard.scenes.flatMap((sc, si) =>
    [...sc.shots]
      .sort((a, b) => a.no - b.no)
      .filter((sh) => !!sh.videoUrl)
      .map((sh) => ({ ...sh, sceneNo: si + 1 })),
  );
  const totalDur = clips.reduce((a, s) => a + (s.dur || 0), 0);
  const assembled = doc.assembled;

  const [busy, setBusy] = React.useState(false);

  const run = async () => {
    if (busy || !clips.length) return;
    setBusy(true);
    try {
      if (!ctx) {
        toast.success("演示态：成片已合成");
        return;
      }
      const result = await ProjectsApi.assembleEpisode(ctx.projectId, state.ep);
      await ctx.saveData(
        withEpisodeDoc(data, state.ep, { ...doc, assembled: result }),
        { progress: 100 },
      );
      toast.success(`第 ${state.ep} 集完整片已合成（${result.shotCount ?? clips.length} 镜）`);
    } catch (e) {
      toast.error(aiErrorMessage(e, "成片拼接失败，请稍后重试"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="scroll" style={{ height: "100%" }}>
      <div style={{ maxWidth: 920, margin: "0 auto", padding: "28px 32px 64px" }}>
        <StageHeader
          no={6}
          scope="剧集"
          title={`第 ${state.ep} 集 · 成片合成`}
          desc="把视频工厂已出片的镜头按顺序拼成完整一集 —— 不重渲、不抽卡，秒级交付。"
        />

        {/* 成片预览（已合成时置顶） */}
        {assembled && (
          <div className="card row gap-4 fade-up" style={{ padding: 16, marginBottom: 16, alignItems: "flex-start" }}>
            <video
              src={assembled.url}
              controls
              playsInline
              preload="metadata"
              style={{ width: 220, aspectRatio: "9/16", objectFit: "cover", borderRadius: 12, background: "#000", flex: "none" }}
            />
            <div className="col gap-2 grow" style={{ minWidth: 0 }}>
              <div className="row gap-2">
                <span className="tag tag-green"><Check size={11} /> 已合成</span>
                <span style={{ fontWeight: 800, fontSize: 16 }}>第 {state.ep} 集完整片</span>
              </div>
              <div className="faint num" style={{ fontSize: 12.5 }}>
                {assembled.shotCount ?? clips.length} 镜 · 约 {assembled.durationSec ?? totalDur}s
                {assembled.at ? ` · ${assembled.at.slice(0, 16).replace("T", " ")}` : ""}
              </div>
              <div className="row gap-2" style={{ marginTop: 6 }}>
                <a className="btn btn-primary btn-sm" href={assembled.url} target="_blank" rel="noreferrer" download>
                  <Download size={14} /> 下载成片
                </a>
                <button type="button" className="btn btn-line btn-sm" disabled={busy} onClick={run}>
                  <RefreshCw size={14} /> {busy ? "重新拼接中…" : "重新拼接"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 镜头清单 */}
        <div className="row gap-2" style={{ marginBottom: 12 }}>
          <Film size={15} style={{ color: "var(--accent)" }} />
          <span style={{ fontWeight: 700, fontSize: 14 }}>待拼镜头 · {clips.length}</span>
          <span className="faint num" style={{ fontSize: 12 }}>按场序与镜号顺序拼接 · 共约 {totalDur}s</span>
        </div>

        {clips.length === 0 ? (
          <div className="card col center" style={{ padding: "46px 0", textAlign: "center", gap: 12 }}>
            <div style={{ width: 52, height: 52, borderRadius: 16, background: "var(--accent-soft)", display: "grid", placeItems: "center", color: "var(--accent)" }}>
              <Clapperboard size={26} />
            </div>
            <div className="muted" style={{ maxWidth: 360, fontSize: 13.5 }}>
              第 {state.ep} 集还没有已出片的镜头。先去<b style={{ color: "var(--accent)" }}>视频工厂</b>把分镜渲染出片，再回来一键拼接。
            </div>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => dispatch({ type: "jump", stage: "factory" })}>
              去视频工厂
            </button>
          </div>
        ) : (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(120px,1fr))", gap: 10, marginBottom: 18 }}>
              {clips.map((s, i) => (
                <div key={s.id} className="card col" style={{ padding: 0, overflow: "hidden" }}>
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
                      {s.dur}s
                    </span>
                  </div>
                  <span className="faint" style={{ fontSize: 10.5, padding: "6px 8px", height: 30, overflow: "hidden" }}>
                    场{s.sceneNo} · {s.desc || "（无描述）"}
                  </span>
                </div>
              ))}
            </div>

            <div className="card row gap-3" style={{ padding: 16, background: assembled ? "var(--surface)" : "var(--accent-soft)" }}>
              <Package size={20} style={{ color: "var(--accent)", flex: "none" }} />
              <div className="grow">
                <div style={{ fontWeight: 700 }}>{assembled ? "镜头有更新?重新拼一版" : "一键拼成完整片"}</div>
                <div className="faint" style={{ fontSize: 12.5 }}>服务器按顺序无损拼接（编码一致时秒级完成），产物落 CDN 可直接分发</div>
              </div>
              <button type="button" className="btn btn-grad" disabled={busy} onClick={run}>
                {busy ? (
                  <>
                    <span aria-hidden style={{ width: 14, height: 14, border: "2px solid rgba(255,255,255,.4)", borderTopColor: "#fff", borderRadius: "50%", display: "inline-block", animation: "drama-spin .7s linear infinite" }} />
                    拼接中…
                  </>
                ) : (
                  <>
                    <Film size={15} /> 拼接完整片
                  </>
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
