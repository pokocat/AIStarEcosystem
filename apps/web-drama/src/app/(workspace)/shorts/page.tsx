"use client";

// 短视频工坊 — 设计真源 v4 screens-shorts-v4.jsx `ShortsStudio` + `ShortCard`:
// 我的短视频资产(3/4 封面卡)+ 单集项目(宣传片/自传)+ 从短剧切片入口。
import * as React from "react";
import { useRouter } from "next/navigation";
import { Clapperboard, Play, Zap } from "lucide-react";
import { Thumb } from "@/components/drama-ui";
import { ProjectCard, STAGE_NAMES } from "@/components/drama-workshop";
import { ShortClipModal } from "@/components/drama-workshop/short-clip-modal";
import { WorkPreviewModal } from "@/components/drama-workshop/work-preview-modal";
import { type DramaProjectSummary, type ShortVideoItem } from "@/mocks/drama-workshop";
import { ProjectsApi } from "@/api";
import { useAsync } from "@/lib/drama-query";

interface MakeCtx {
  format: string;
  idea?: string | null;
  reopen?: string | null;
  fromClip?: boolean;
}

function ShortCard({ s, onOpen, delay }: { s: ShortVideoItem; onOpen: () => void; delay?: number }) {
  const ST: Record<ShortVideoItem["status"], { t: string; c: string; bg: string }> = {
    done: { t: "已发布", c: "#15803d", bg: "#dcfce7" },
    rendering: { t: "生成中", c: "var(--accent)", bg: "var(--accent-soft)" },
    draft: { t: "草稿", c: "var(--ink-3)", bg: "var(--surface-2)" },
  };
  const st = ST[s.status];
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
        <Thumb from={s.from} to={s.to} ratio="3/4" radius={0} stripes={false} style={{ width: "100%" }} />
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
          {s.dur}
        </span>
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
        <span style={{ fontWeight: 700, fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.title}</span>
        <span className="row gap-2" style={{ fontSize: 11 }}>
          <span className="tag tag-gray">{s.fmt}</span>
          {s.plays !== "—" && (
            <span className="faint num">
              <Play size={10} /> {s.plays}
            </span>
          )}
        </span>
      </div>
    </button>
  );
}

export default function ShortsStudioPage() {
  const router = useRouter();
  const [clipOpen, setClipOpen] = React.useState(false);
  const [preview, setPreview] = React.useState<ShortVideoItem | null>(null);
  // v0.66:短视频成片暂不持久化（无后端）→ 不再伪造「我的短视频」;单集作品取真实项目。
  const projectsQ = useAsync("/me/drama/projects", () => ProjectsApi.listProjects());
  const shorts: ShortVideoItem[] = [];
  const singles = (projectsQ.data ?? []).filter((p) => p.episodes === 1); // 宣传片 / 自传等单集作品

  const onMake = (ctx: MakeCtx) => {
    // v0.73 修：点子经 sessionStorage 一次性带入（不入 URL）；fmt / reopen 仍走 URL。
    if (ctx.idea?.trim() && typeof window !== "undefined") {
      sessionStorage.setItem("drama.shorts.idea", ctx.idea.trim());
    }
    const params = new URLSearchParams();
    if (ctx.format) params.set("fmt", ctx.format);
    if (ctx.reopen) params.set("reopen", ctx.reopen);
    const qs = params.toString();
    router.push(`/shorts/make${qs ? "?" + qs : ""}`);
  };
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
        {shorts.map((s, i) => (
          <ShortCard
            key={s.id}
            s={s}
            delay={i * 35}
            onOpen={() => {
              // 已发布的成片:先看成片预览,再决定看脚本还是衍生
              if (s.status === "done") setPreview(s);
              else onMake({ format: "sell", idea: null, reopen: s.title });
            }}
          />
        ))}
        {singles.map((p, i) => (
          <ProjectCard key={p.id} p={p} stageNames={STAGE_NAMES} onOpen={openProject} delay={(shorts.length + i) * 35} />
        ))}
      </div>

      {clipOpen && <ShortClipModal onClose={() => setClipOpen(false)} onMake={onMake} />}
      {preview && (
        <WorkPreviewModal
          item={{
            title: preview.title,
            cover: { from: preview.from, to: preview.to },
            ratio: "9:16",
            metaLine: `${preview.fmt} · 播放 ${preview.plays} · 竖屏 9:16`,
            durLabel: preview.dur,
          }}
          onClose={() => setPreview(null)}
          scriptLabel="切到脚本视图"
          deriveLabel="衍生新片"
          onScript={() => {
            const t = preview.title;
            setPreview(null);
            onMake({ format: "sell", idea: null, reopen: t });
          }}
          onDerive={() => {
            const t = preview.title;
            setPreview(null);
            onMake({ format: "sell", idea: `衍生自「${t}」,换个钩子再来一条` });
          }}
        />
      )}
    </div>
  );
}
