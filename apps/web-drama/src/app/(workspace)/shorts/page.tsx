"use client";

// 短视频工坊 — 设计真源 v4 screens-shorts-v4.jsx `ShortsStudio` + `ShortCard`:
// 我的短视频草稿(3/4 封面卡 · 接着做)+ 单集作品(宣传片/自传)+ 从短剧切片入口。
// v0.76:短视频成片有真后端草稿（/me/drama/shorts），列表即真实草稿，点开接着做。
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Boxes, Clapperboard, ClipboardPaste, Play, Trash2, Wand2, Zap } from "lucide-react";
import { Thumb, dramaConfirm } from "@/components/drama-ui";
import { PublishCreativeCenterModal } from "@/components/drama-workshop/publish-creative-center-modal";
import { ShortClipModal } from "@/components/drama-workshop/short-clip-modal";
import { WorkPreviewModal } from "@/components/drama-workshop/work-preview-modal";
import { ViewHeader } from "@/components/common";
import { RecipesApi, ShortsApi } from "@/api";
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
  onDelete,
  publishing,
  submitted,
  delay,
}: {
  d: ShortDraftSummary;
  onOpen: () => void;
  onPublish: () => void;
  onDelete?: () => void;
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
        {/* 完成 → 可播放（播放按钮）；制作中 → 不是成片，给「继续制作」入口而非播放键。 */}
        <span style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center" }}>
          {done ? (
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
          ) : (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "7px 13px",
                borderRadius: 999,
                background: "rgba(255,255,255,.9)",
                color: "var(--ink)",
                fontSize: 12,
                fontWeight: 700,
                boxShadow: "var(--shadow-sm)",
                backdropFilter: "blur(4px)",
              }}
            >
              <Wand2 size={13} style={{ color: "var(--accent)" }} />
              {d.shotCount === 0 ? "开始制作" : "继续制作"}
            </span>
          )}
        </span>
        {/* 时长只在成片上显示——草稿不暗示「可播放长度」。 */}
        {done && d.durationSec > 0 && (
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
        {/* 制作中且已起草 → 封面底部出镜进度条，一眼看进度。 */}
        {!done && d.shotCount > 0 && (
          <span
            aria-hidden
            style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 4, background: "rgba(0,0,0,.18)" }}
          >
            <span
              style={{
                display: "block",
                height: "100%",
                width: Math.round((d.doneCount / d.shotCount) * 100) + "%",
                background: "var(--accent)",
                transition: "width .3s",
              }}
            />
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
        {onDelete && (
          <button
            type="button"
            aria-label="移到回收站"
            title="移到回收站"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            style={{
              position: "absolute",
              top: 7,
              right: 7,
              width: 26,
              height: 26,
              borderRadius: 8,
              border: "none",
              cursor: "pointer",
              display: "grid",
              placeItems: "center",
              background: "rgba(0,0,0,.45)",
              color: "#fff",
              backdropFilter: "blur(2px)",
            }}
          >
            <Trash2 size={13} />
          </button>
        )}
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
                  aria-label="发布到创意市场"
                  title="发布到创意市场"
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

/** 草稿卡骨架屏（加载态占位，与 DraftCard 同版式：3/4 封面 + 底部两行文字）。 */
function DraftCardSkeleton() {
  return (
    <div className="card col" style={{ padding: 0, overflow: "hidden", gap: 0 }}>
      <div className="skel" style={{ width: "100%", aspectRatio: "3/4", borderRadius: 0 }} />
      <div className="col gap-1" style={{ padding: "9px 10px 10px" }}>
        <div className="skel" style={{ height: 12, width: "70%" }} />
        <div className="skel" style={{ height: 9, width: "45%" }} />
      </div>
    </div>
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
  // v0.76:短视频草稿真后端 —— 列表即真实短视频草稿（DramaShort）。
  // v0.77 起单集作品统一为 DramaShort；DramaProject（短剧）一律不在短视频工坊出现。
  const draftsQ = useAsync("/me/drama/shorts", () => ShortsApi.listDrafts());
  const drafts = draftsQ.data ?? [];
  const { isLoading: draftsLoading, error: draftsError, refetch: refetchDrafts } = draftsQ;

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
  // 软删（移到回收站）：二次确认 → 软删 → 刷新列表（30 天内可在回收站恢复）。
  const softDeleteDraft = async (d: ShortDraftSummary) => {
    const ok = await dramaConfirm({
      title: "移到回收站",
      body: `《${d.title}》将移入回收站，30 天后彻底删除，期间可随时恢复。`,
      tone: "danger",
      confirmLabel: "移到回收站",
      cancelLabel: "取消",
    });
    if (!ok) return;
    try {
      await ShortsApi.deleteDraft(d.id);
      invalidate("/me/drama/shorts");
      invalidate("/me/drama/shorts/trash");
      toast.success("已移到回收站");
    } catch (e) {
      toast.error(aiErrorMessage(e, "删除失败，请稍后重试"));
    }
  };
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
      toast.success(`已把《${d.title}》发布到创意市场，运营审核通过后公开可套用`);
    } catch (e) {
      toast.error(aiErrorMessage(e, "发布到创意市场失败，请稍后重试"));
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

  return (
    <div style={{ maxWidth: 1180, margin: "0 auto" }}>
      <div style={{ marginBottom: 18 }}>
        <ViewHeader
          eyebrow="短视频工坊"
          title={
            <>
              短视频{" "}
              <span className="text-gradient-gold" style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontWeight: 400 }}>
                工坊
              </span>
            </>
          }
          meta="短视频、宣传片、个人自传这类单集作品都在这里。做完的可以点开播放，草稿随时接着做。"
          action={
            <>
              <button
                type="button"
                className="btn btn-ghost"
                style={{ height: 44, padding: "0 14px" }}
                onClick={() => router.push("/trash?tab=shorts")}
                title="回收站"
              >
                <Trash2 size={16} /> 回收站
              </button>
              {/* 从短剧切片：扫描/切片暂无后端（旧实现是假列表 + setTimeout 假扫描），上线前禁用为「建设中」，不展示假数据 */}
              <button
                type="button"
                className="btn btn-line"
                style={{ height: 44, padding: "0 18px", opacity: 0.6, cursor: "not-allowed" }}
                disabled
                title="从短剧切片功能建设中"
              >
                <Clapperboard size={16} /> 从短剧切片
                <span className="tag tag-gray" style={{ marginLeft: 6 }}>建设中</span>
              </button>
              {/* v0.143：已经写好提示词的用户不必再跟 AI 聊 —— 直接粘贴原文拆成分镜 */}
              <button
                type="button"
                className="btn btn-line"
                style={{ height: 44, padding: "0 18px" }}
                onClick={() => router.push("/shorts/prompt")}
                title="粘贴你写好的提示词，AI 拆成人物卡 / 场景 / 逐镜分镜"
              >
                <ClipboardPaste size={16} /> 提示词直出
              </button>
              <button
                type="button"
                className="btn btn-grad"
                style={{ height: 44, padding: "0 18px" }}
                onClick={() => router.push("/shorts/new")}
              >
                <Zap size={16} /> 新建短视频
              </button>
            </>
          }
        />
      </div>

      {/* 加载失败：错误块 + 重试 */}
      {!!draftsError && !draftsLoading && (
        <div className="card col center" style={{ padding: 28, gap: 12, textAlign: "center", marginBottom: 20 }}>
          <div className="muted" style={{ fontSize: 13.5 }}>
            短视频列表加载失败：{draftsError instanceof Error ? draftsError.message : "请稍后重试"}
          </div>
          <button type="button" className="btn btn-line btn-sm" onClick={refetchDrafts}>重新加载</button>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(158px, 1fr))", gap: 16, alignItems: "stretch" }}>
        <button
          type="button"
          onClick={() => router.push("/shorts/new")}
          className="col center"
          style={{
            // 卡片等高：草稿卡是「封面 3/4 + 底部文字」，本卡随网格拉伸到同高（minHeight 兜底无草稿时的孤卡）。
            height: "100%",
            minHeight: 240,
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
          <span style={{ fontWeight: 700, fontSize: 13 }}>新建短视频</span>
          <span className="faint" style={{ fontSize: 11 }}>一句话生成</span>
        </button>
        {/* 第二条入口：整段提示词直出（与「一句话生成」并列，不藏在二级页里） */}
        <button
          type="button"
          onClick={() => router.push("/shorts/prompt")}
          className="col center"
          style={{
            height: "100%",
            minHeight: 240,
            borderRadius: "var(--radius)",
            border: "2px dashed var(--line)",
            color: "var(--ink-3)",
            gap: 9,
            background: "var(--surface)",
            transition: "all .18s",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = "var(--accent-2)";
            e.currentTarget.style.color = "var(--accent-2)";
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
              background: "color-mix(in oklch, var(--accent-2) 12%, transparent)",
              display: "grid",
              placeItems: "center",
              color: "var(--accent-2)",
            }}
          >
            <ClipboardPaste size={21} />
          </div>
          <span style={{ fontWeight: 700, fontSize: 13 }}>提示词直出</span>
          <span className="faint" style={{ fontSize: 11, textAlign: "center", padding: "0 10px", lineHeight: 1.5 }}>
            粘贴写好的提示词
            <br />
            拆成分镜开拍
          </span>
        </button>
        {draftsLoading && drafts.length === 0
          ? Array.from({ length: 4 }).map((_, i) => <DraftCardSkeleton key={i} />)
          : drafts.map((d, i) => (
              <DraftCard
                key={d.id}
                d={d}
                delay={i * 35}
                onOpen={() => openDraft(d)}
                onPublish={() => requestPublish(d)}
                onDelete={() => void softDeleteDraft(d)}
                publishing={publishingId === d.id}
                submitted={submittedShortIds.has(d.id)}
              />
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
          scriptLabel={submittedShortIds.has(preview.id) ? "已提交审核" : "发布到创意市场"}
          deriveLabel="发布到创意市场"
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
