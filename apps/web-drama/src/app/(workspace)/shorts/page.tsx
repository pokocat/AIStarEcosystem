"use client";

// 我的短视频 — 设计真源 v4 screens-shorts-v4.jsx `ShortsStudio` + `ShortCard`:
// 两张对照式入口卡（从一句话开始 / 粘贴写好的脚本）+ 我的短视频草稿（3/4 封面卡 · 接着做）。
// v0.76:短视频成片有真后端草稿（/me/drama/shorts），列表即真实草稿，点开接着做。
// v0.197：页头只留回收站；「从短剧切片」从来打不开（ShortClipModal 已删），不再占主操作位。
// v0.197：支持 ?open=<draftId> —— 制作页合成成功后跳回来带上它，列表读到后直接打开那条成片的预览。
import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Boxes, ClipboardPaste, Play, Trash2, Wand2, Zap } from "lucide-react";
import { formatDateTime } from "@ai-star-eco/api-client";
import { Thumb, dramaConfirm } from "@/components/drama-ui";
import { PublishCreativeCenterModal } from "@/components/drama-workshop/publish-creative-center-modal";
import { WorkPreviewModal } from "@/components/drama-workshop/work-preview-modal";
import { ViewHeader } from "@/components/common";
import { RecipesApi, ShortsApi } from "@/api";
import type { ShortDraftSummary } from "@/api/shorts";
import { useAsync, invalidate } from "@/lib/drama-query";
import { aiErrorMessage } from "@/lib/ai-error";
import { useDramaConfig } from "@/lib/use-drama-config";

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
              继续制作
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
        {/* 制作中且已有分镜 → 封面底部进度条（已确认的镜 / 全部镜），一眼看进度。 */}
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
            className="se-card-del"
            aria-label="移到回收站"
            title="移到回收站"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
          >
            <Trash2 size={13} />
          </button>
        )}
      </div>
      <div className="col gap-1" style={{ padding: "9px 10px 10px" }}>
        <span style={{ fontWeight: 700, fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={d.title}>{d.title}</span>
        <span className="row gap-2" style={{ fontSize: 11, minWidth: 0, alignItems: "center" }}>
          <span
            className="tag tag-gray"
            style={{ minWidth: 0, maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: "0 1 auto" }}
            title={d.fmtName}
          >
            {d.fmtName}
          </span>
          {d.shotCount > 0 ? (
            <span
              className="faint num"
              style={{ whiteSpace: "nowrap", flex: "none" }}
              title={done ? `共 ${d.shotCount} 镜` : `已确认 ${d.doneCount} 镜，共 ${d.shotCount} 镜`}
            >
              {done ? `${d.shotCount} 镜` : `${d.doneCount}/${d.shotCount} 镜`}
            </span>
          ) : (
            <span className="faint" style={{ whiteSpace: "nowrap", flex: "none" }}>还没写脚本</span>
          )}
          {done && (
            <>
              <span className="grow" />
              {submitted ? (
                <span
                  className="se-card-pub"
                  title="已提交审核"
                  aria-label="已提交审核"
                  style={{ color: "#15803d", background: "#dcfce7" }}
                >
                  <Boxes size={11} />
                </span>
              ) : (
                <button
                  type="button"
                  className="btn btn-icon btn-sm se-card-pub"
                  aria-label="发布成模板"
                  title="发布成模板：审核通过后出现在模板广场，别人可以做同款"
                  disabled={publishing}
                  aria-busy={publishing}
                  style={{ opacity: publishing ? 0.55 : 1 }}
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

/** 入口卡（虚线框）：图标 + 标题 + 什么情况选它 + 开始制作花多少。和草稿卡同网格、随网格拉伸等高。 */
function EntryCard({
  icon,
  tone,
  tint,
  title,
  desc,
  cost,
  onClick,
}: {
  icon: React.ReactNode;
  /** 图标与悬停描边的主色 */
  tone: string;
  /** 图标底色 */
  tint: string;
  title: string;
  desc: string;
  cost: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="col center se-entry-card"
      style={{ ["--se-tone" as string]: tone } as React.CSSProperties}
    >
      <div
        style={{
          width: 42,
          height: 42,
          borderRadius: 13,
          background: tint,
          display: "grid",
          placeItems: "center",
          color: tone,
          flex: "none",
        }}
      >
        {icon}
      </div>
      <span style={{ fontWeight: 700, fontSize: 13.5, color: "var(--ink)" }}>{title}</span>
      <span className="faint" style={{ fontSize: 11.5, lineHeight: 1.55 }}>{desc}</span>
      <span className="se-entry-cost num">开始制作扣 {cost} 积分</span>
    </button>
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

/**
 * ?open=<draftId>：列表读到后自动打开那一条的成片预览。
 * 只打开已完成的；没完成的、找不到的（已删 / 不是本人的）直接忽略，不弹错。
 * 处理完用 router.replace 去掉参数，刷新页面不会再弹一次。
 *
 * 单独一个组件、包在 Suspense 里：useSearchParams 在静态预渲染时要求 Suspense 边界，
 * 放在整页上会让整页等它；放在这里只有这个不渲染任何东西的小组件等。
 */
function OpenDraftFromQuery({
  drafts,
  onOpen,
}: {
  /** 列表还没读到（加载中 / 加载失败）时传 undefined —— 等读到再处理，失败后「重新加载」成功也照样打开。 */
  drafts: ShortDraftSummary[] | undefined;
  onOpen: (d: ShortDraftSummary) => void;
}) {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const openId = sp.get("open");
  const handled = React.useRef<string | null>(null);

  React.useEffect(() => {
    if (!openId || !drafts || handled.current === openId) return;
    handled.current = openId;

    const rest = new URLSearchParams(sp.toString());
    rest.delete("open");
    const qs = rest.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });

    const hit = drafts.find((d) => d.id === openId);
    if (hit?.status === "done") {
      onOpen(hit);
      return;
    }
    // 列表里没有、或者列表说还没完成：列表可能是进页前的旧缓存，按这一条再核对一次。
    // 真没完成 / 查不到就算了 —— 这里只是「顺手打开」，不是用户点的，不该报错。
    void ShortsApi.getDraft(openId)
      .then((detail) => {
        if (detail.meta.status !== "done") return;
        invalidate("/me/drama/shorts"); // 列表也跟着刷新，卡片别还显示「草稿」
        onOpen(detail.meta);
      })
      .catch(() => {});
  }, [openId, drafts, onOpen, router, pathname, sp]);

  return null;
}

export default function ShortsStudioPage() {
  const router = useRouter();
  const cfg = useDramaConfig();
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

  const editDraft = (id: string) => router.push(`/shorts/make?draft=${encodeURIComponent(id)}`);
  // 软删（移到回收站）：二次确认 → 软删 → 刷新列表（30 天内可在回收站恢复）。
  const softDeleteDraft = async (d: ShortDraftSummary) => {
    const ok = await dramaConfirm({
      title: "移到回收站",
      body: `《${d.title}》会移到回收站，30 天内可以恢复，之后彻底删除。`,
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
      invalidate("/me/drama/recipes"); // 刷新「我发布的模板」列表
      toast.success(`已提交《${d.title}》，平台审核通过后会出现在模板广场，别人可以做同款`);
    } catch (e) {
      toast.error(aiErrorMessage(e, "没能发布成模板，请稍后重试"));
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
          eyebrow="单条短视频"
          title={
            <>
              我的
              {/* 斜体末字会伸出行框，右侧留一点内边距，否则渐变裁切会把「频」切掉一角 */}
              <span className="text-gradient-gold" style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontWeight: 400, paddingRight: "0.12em" }}>
                短视频
              </span>
            </>
          }
          meta="短视频、宣传片、个人自传这类单条作品都在这里。做完的点开能播，没做完的点开接着做。"
          action={
            <button
              type="button"
              className="btn btn-ghost"
              style={{ height: 44, padding: "0 14px", flex: "none" }}
              onClick={() => router.push("/trash?tab=shorts")}
            >
              <Trash2 size={16} /> 回收站
            </button>
          }
        />
      </div>

      {/* 加载失败：错误块 + 重试 */}
      {!!draftsError && !draftsLoading && (
        <div className="card col center" style={{ padding: 28, gap: 12, textAlign: "center", marginBottom: 20 }}>
          <div className="muted" style={{ fontSize: 13.5 }}>
            短视频列表没加载出来：{aiErrorMessage(draftsError, "请稍后重试")}
          </div>
          <button type="button" className="btn btn-line btn-sm" onClick={refetchDrafts}>重新加载</button>
        </div>
      )}

      <div className="se-shorts-grid">
        {/* 两张入口卡是对照式的：区别只在脚本谁来写，开始制作花的积分一样（底部同一行小字）。 */}
        <EntryCard
          icon={<Zap size={21} />}
          tone="var(--accent)"
          tint="var(--accent-soft)"
          title="从一句话开始"
          desc="只有想法？写一句话，AI 写口播脚本和分镜"
          cost={cfg.prices.shortEntry}
          onClick={() => router.push("/shorts/new")}
        />
        <EntryCard
          icon={<ClipboardPaste size={21} />}
          tone="var(--accent-2)"
          tint="color-mix(in oklch, var(--accent-2) 12%, transparent)"
          title="粘贴写好的脚本"
          desc="脚本、分镜稿、AI 视频提示词都行。AI 按原文拆成分镜，拆解免费"
          cost={cfg.prices.shortEntry}
          onClick={() => router.push("/shorts/prompt")}
        />
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

      {/* onOpen 直接给 setPreview：它是稳定引用，处理器的 effect 依赖它，别每次渲染换一个新函数。 */}
      <React.Suspense fallback={null}>
        <OpenDraftFromQuery drafts={draftsQ.data} onOpen={setPreview} />
      </React.Suspense>

      {preview && (
        <WorkPreviewModal
          item={{
            title: preview.title,
            cover: { from: preview.from, to: preview.to },
            coverUrl: preview.coverUrl,
            videoUrl: preview.videoUrl,
            ratio: "9:16",
            metaLine: `${preview.fmtName} · ${preview.shotCount} 镜 · 更新于 ${formatDateTime(preview.updatedAt)}`,
            durLabel: preview.durationSec > 0 ? fmtDur(preview.durationSec) : undefined,
          }}
          onClose={() => setPreview(null)}
          scriptLabel={submittedShortIds.has(preview.id) ? "已提交审核" : "发布成模板"}
          deriveLabel="发布成模板"
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
