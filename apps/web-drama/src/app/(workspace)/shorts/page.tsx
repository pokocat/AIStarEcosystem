"use client";

// 短视频工坊 — 设计真源 v4 screens-shorts-v4.jsx `ShortsStudio` + `ShortCard`:
// 我的短视频草稿(3/4 封面卡 · 接着做)+ 单集作品(宣传片/自传)+ 从短剧切片入口。
// v0.76:短视频成片有真后端草稿（/me/drama/shorts），列表即真实草稿，点开接着做。
import * as React from "react";
import { useRouter } from "next/navigation";
import { Clapperboard, Play, Zap } from "lucide-react";
import { Thumb } from "@/components/drama-ui";
import { ProjectCard, STAGE_NAMES } from "@/components/drama-workshop";
import { ShortClipModal } from "@/components/drama-workshop/short-clip-modal";
import { type DramaProjectSummary } from "@/mocks/drama-workshop";
import { ProjectsApi, ShortsApi } from "@/api";
import type { ShortDraftSummary } from "@/api/shorts";
import { useAsync } from "@/lib/drama-query";

interface MakeCtx {
  format: string;
  idea?: string | null;
  reopen?: string | null;
  fromClip?: boolean;
}

/** 秒 → m:ss。 */
function fmtDur(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function DraftCard({ d, onOpen, delay }: { d: ShortDraftSummary; onOpen: () => void; delay?: number }) {
  const st =
    d.status === "done"
      ? { t: "已完成", c: "#15803d", bg: "#dcfce7" }
      : { t: "草稿", c: "var(--accent)", bg: "var(--accent-soft)" };
  return (
    <button
      type="button"
      className="card col fade-up"
      onClick={onOpen}
      style={{ padding: 0, overflow: "hidden", gap: 0, animationDelay: (delay ?? 0) + "ms", textAlign: "left" }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "translateY(-2px)";
        e.currentTarget.style.boxShadow = "var(--shadow-lg)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "none";
        e.currentTarget.style.boxShadow = "var(--shadow-sm)";
      }}
    >
      <div style={{ position: "relative" }}>
        <Thumb from={d.from} to={d.to} ratio="3/4" radius={0} stripes={d.shotCount === 0} style={{ width: "100%" }} />
        <span style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center" }}>
          <span
            style={{
              width: 40,
              height: 40,
              borderRadius: "50%",
              background: "rgba(255,255,255,.85)",
              display: "grid",
              placeItems: "center",
              boxShadow: "var(--shadow-sm)",
            }}
          >
            <Play size={18} style={{ color: "var(--ink)", marginLeft: 2 }} />
          </span>
        </span>
        {d.durationSec > 0 && (
          <span
            className="num"
            style={{
              position: "absolute",
              bottom: 7,
              right: 7,
              background: "rgba(0,0,0,.55)",
              color: "#fff",
              fontSize: 10.5,
              padding: "1px 6px",
              borderRadius: 5,
              fontWeight: 700,
            }}
          >
            {fmtDur(d.durationSec)}
          </span>
        )}
        <span
          style={{
            position: "absolute",
            top: 7,
            left: 7,
            background: st.bg,
            color: st.c,
            fontSize: 10,
            padding: "2px 7px",
            borderRadius: 6,
            fontWeight: 700,
          }}
        >
          {st.t}
        </span>
      </div>
      <div className="col gap-1" style={{ padding: "9px 10px 10px" }}>
        <span style={{ fontWeight: 700, fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{d.title}</span>
        <span className="row gap-2" style={{ fontSize: 11 }}>
          <span className="tag tag-gray">{d.fmtName}</span>
          {d.shotCount > 0 ? (
            <span className="faint num">{d.doneCount}/{d.shotCount} 镜</span>
          ) : (
            <span className="faint">未起草</span>
          )}
        </span>
      </div>
    </button>
  );
}

export default function ShortsStudioPage() {
  const router = useRouter();
  const [clipOpen, setClipOpen] = React.useState(false);
  // v0.76:短视频草稿真后端 —— 列表即真实草稿；单集作品另取真实项目（episodes===1）。
  const draftsQ = useAsync("/me/drama/shorts", () => ShortsApi.listDrafts());
  const projectsQ = useAsync("/me/drama/projects", () => ProjectsApi.listProjects());
  const drafts = draftsQ.data ?? [];
  const singles = (projectsQ.data ?? []).filter((p) => p.episodes === 1); // 宣传片 / 自传等单集作品

  const onMake = (ctx: MakeCtx) => {
    // 点子经 sessionStorage 一次性带入（不入 URL）；fmt / reopen 走 URL；进 make 页即建草稿。
    if (ctx.idea?.trim() && typeof window !== "undefined") {
      sessionStorage.setItem("drama.shorts.idea", ctx.idea.trim());
    }
    const params = new URLSearchParams();
    if (ctx.format) params.set("fmt", ctx.format);
    if (ctx.reopen) params.set("reopen", ctx.reopen);
    const qs = params.toString();
    router.push(`/shorts/make${qs ? "?" + qs : ""}`);
  };
  const openDraft = (d: ShortDraftSummary) => router.push(`/shorts/make?draft=${encodeURIComponent(d.id)}`);
  const openProject = (p: DramaProjectSummary) => router.push("/projects/" + p.id);

  return (
    <div style={{ maxWidth: 1180, margin: "0 auto" }}>
      <div className="row" style={{ marginBottom: 22 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, letterSpacing: "-.02em" }}>短视频工坊</h1>
          <div className="muted" style={{ marginTop: 4 }}>你的短视频、宣传片、个人自传等单集作品都在这里 —— 点开接着做</div>
        </div>
        <div className="grow" />
        <button type="button" className="btn btn-line" style={{ height: 44, padding: "0 18px" }} onClick={() => setClipOpen(true)}>
          <Clapperboard size={16} /> 从短剧切片
        </button>
        <button
          type="button"
          className="btn btn-grad"
          style={{ height: 44, padding: "0 18px" }}
          onClick={() => router.push("/shorts/new")}
        >
          <Zap size={16} /> 新建短视频
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(158px, 1fr))", gap: 16, alignItems: "start" }}>
        <button
          type="button"
          onClick={() => router.push("/shorts/new")}
          className="col center"
          style={{
            aspectRatio: "3/4",
            borderRadius: "var(--radius)",
            border: "2px dashed var(--line)",
            color: "var(--ink-3)",
            gap: 9,
            background: "var(--surface)",
            transition: "all .18s",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = "var(--accent)";
            e.currentTarget.style.color = "var(--accent)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = "var(--line)";
            e.currentTarget.style.color = "var(--ink-3)";
          }}
        >
          <div
            style={{
              width: 42,
              height: 42,
              borderRadius: 13,
              background: "var(--accent-soft)",
              display: "grid",
              placeItems: "center",
              color: "var(--accent)",
            }}
          >
            <Zap size={21} />
          </div>
          <span style={{ fontWeight: 700, fontSize: 13 }}>新建一条</span>
          <span className="faint" style={{ fontSize: 11 }}>说句话·出片</span>
        </button>
        {drafts.map((d, i) => (
          <DraftCard key={d.id} d={d} delay={i * 35} onOpen={() => openDraft(d)} />
        ))}
        {singles.map((p, i) => (
          <ProjectCard key={p.id} p={p} stageNames={STAGE_NAMES} onOpen={openProject} delay={(drafts.length + i) * 35} />
        ))}
      </div>

      {clipOpen && <ShortClipModal onClose={() => setClipOpen(false)} onMake={onMake} />}
    </div>
  );
}
