"use client";

// 短视频工坊 — 设计真源 v4 screens-shorts-v4.jsx `ShortsStudio` + `ShortCard`:
// 我的短视频草稿(3/4 封面卡 · 接着做)+ 单集作品(宣传片/自传)+ 从短剧切片入口。
// v0.76:短视频成片有真后端草稿（/me/drama/shorts），列表即真实草稿，点开接着做。
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Boxes, Clapperboard, Play, Zap } from "lucide-react";
import { Thumb } from "@/components/drama-ui";
import { ProjectCard, STAGE_NAMES } from "@/components/drama-workshop";
import { PublishCreativeCenterModal } from "@/components/drama-workshop/publish-creative-center-modal";
import { ShortClipModal } from "@/components/drama-workshop/short-clip-modal";
import { WorkPreviewModal } from "@/components/drama-workshop/work-preview-modal";
import { type DramaProjectSummary } from "@/mocks/drama-workshop";
import { ProjectsApi, RecipesApi, ShortsApi } from "@/api";
import type { ShortDraftSummary } from "@/api/shorts";
import { useAsync, invalidate } from "@/lib/drama-query";
import { aiErrorMessage } from "@/lib/ai-error";

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

function DraftCard({
  d,
  onOpen,
  onPublish,
  publishing,
  submitted,
  delay,
}: {
  d: ShortDraftSummary;
  onOpen: () => void;
  onPublish: () => void;
  publishing?: boolean;
  /** 已成功提交过审——隐藏发布按钮，显示「已提交」标记 */
  submitted?: boolean;
  delay?: number;
}) {
  const done = d.status === "done";
  const st =
    done
      ? { t: "已完成", c: "#15803d", bg: "#dcfce7" }
      : { t: "草稿", c: "var(--accent)", bg: "var(--accent-soft)" };
  const coverUrl = d.coverUrl ?? undefined;
  const videoUrl = d.videoUrl ?? undefined;
  return (
    <article
      role="button"
      tabIndex={0}
      className="card col fade-up"
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
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
        {videoUrl ? (
          <video
            src={videoUrl}
            poster={coverUrl}
            muted
            playsInline
            preload="metadata"
            style={{
              width: "100%",
              aspectRatio: "3/4",
              objectFit: "cover",
              display: "block",
              background: `linear-gradient(150deg, ${d.from}, ${d.to})`,
            }}
          />
        ) : (
          <Thumb
            from={d.from}
            to={d.to}
            src={coverUrl}
            ratio="3/4"
            radius={0}
            stripes={d.shotCount === 0}
            style={{ width: "100%" }}
          />
        )}
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
          {done && (
            <>
              <span className="grow" />
              {submitted ? (
                <span
                  title="已提交审核"
                  aria-label="已提交审核"
                  style={{ width: 24, height: 24, borderRadius: 7, display: "grid", placeItems: "center", color: "#15803d", background: "#dcfce7", fontSize: 10 }}
                >
                  <Boxes size={11} />
                </span>
              ) : (
                <button
                  type="button"
                  className="btn btn-icon btn-sm"
                  aria-label="发布到创意中心"
                  title="发布到创意中心"
                  disabled={publishing}
                  aria-busy={publishing}
                  style={{ width: 24, height: 24, borderRadius: 7, opacity: publishing ? 0.55 : 1 }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onPublish();
                  }}
                >
                  <Boxes size={11} />
                </button>
              )}
            </>
          )}
        </span>
      </div>
    </article>
  );
}

export default function ShortsStudioPage() {
  const router = useRouter();
  const [clipOpen, setClipOpen] = React.useState(false);
  const [preview, setPreview] = React.useState<ShortDraftSummary | null>(null);
  const [publishTarget, setPublishTarget] = React.useState<ShortDraftSummary | null>(null);
  const [publishingId, setPublishingId] = React.useState<string | null>(null);
  // 已成功提交过审的草稿 ID 集合（本地标记，防止重复提交 + 给用户明确反馈）
  const [submittedShortIds, setSubmittedShortIds] = React.useState<Set<string>>(new Set());
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
  const editDraft = (id: string) => router.push(`/shorts/make?draft=${encodeURIComponent(id)}`);
  const requestPublish = (d: ShortDraftSummary) => {
    if (publishingId) return;
    if (submittedShortIds.has(d.id)) return;
    setPublishTarget(d);
  };
  const closePublishModal = () => {
    if (publishingId) return;
    setPublishTarget(null);
  };
  const publishShort = async () => {
    const d = publishTarget;
    if (!d) return;
    if (publishingId) return;
    setPublishingId(d.id);
    try {
      await RecipesApi.extractFromShort(d.id);
      setSubmittedShortIds((prev) => new Set([...prev, d.id]));
      setPublishTarget(null);
      setPreview(null);
      invalidate("/me/drama/recipes"); // 刷新「我发布的创意」列表
      toast.success(`已把《${d.title}》发布到创意中心，运营审核通过后公开可套用`);
    } catch (e) {
      toast.error(aiErrorMessage(e, "发布到创意中心失败，请稍后重试"));
    } finally {
      setPublishingId(null);
    }
  };
  const openDraft = (d: ShortDraftSummary) => {
    if (d.status === "done") {
      setPreview(d);
      return;
    }
    editDraft(d.id);
  };
  const openProject = (p: DramaProjectSummary) => router.push("/projects/" + p.id);

  return (
    <div style={{ maxWidth: 1180, margin: "0 auto" }}>
      <div className="row" style={{ marginBottom: 22 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, letterSpacing: "-.02em" }}>短视频工坊</h1>
          <div className="muted" style={{ marginTop: 4 }}>你的短视频、宣传片、个人自传等单集作品都在这里 —— 完成后点开播放，草稿接着做</div>
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
          <DraftCard
            key={d.id}
            d={d}
            delay={i * 35}
            onOpen={() => openDraft(d)}
            onPublish={() => requestPublish(d)}
            publishing={publishingId === d.id}
            submitted={submittedShortIds.has(d.id)}
          />
        ))}
        {singles.map((p, i) => (
          <ProjectCard key={p.id} p={p} stageNames={STAGE_NAMES} onOpen={openProject} delay={(drafts.length + i) * 35} />
        ))}
      </div>

      {clipOpen && <ShortClipModal onClose={() => setClipOpen(false)} onMake={onMake} />}
      {preview && (
        <WorkPreviewModal
          item={{
            title: preview.title,
            cover: { from: preview.from, to: preview.to },
            coverUrl: preview.coverUrl,
            videoUrl: preview.videoUrl,
            ratio: "9:16",
            metaLine: `${preview.fmtName} · ${preview.doneCount}/${preview.shotCount} 镜 · ${preview.updated}更新`,
            durLabel: preview.durationSec > 0 ? fmtDur(preview.durationSec) : undefined,
          }}
          onClose={() => setPreview(null)}
          scriptLabel={submittedShortIds.has(preview.id) ? "已提交审核" : "发布到创意中心"}
          deriveLabel="发布到创意中心"
          compactActions
          extracting={publishingId === preview.id || submittedShortIds.has(preview.id)}
          onScript={() => requestPublish(preview)}
          onDerive={() => requestPublish(preview)}
        />
      )}
      {publishTarget && (
        <PublishCreativeCenterModal
          title={publishTarget.title}
          publishing={publishingId === publishTarget.id}
          onClose={closePublishModal}
          onConfirm={() => void publishShort()}
        />
      )}
    </div>
  );
}
