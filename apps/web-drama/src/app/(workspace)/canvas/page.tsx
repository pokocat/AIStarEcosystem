"use client";

// 我的画布（v0.198，docs/drama-canvas-plan.md §2.1）：第一格「新建画布」，后面每张画布一张卡
// （封面、标题、「3 集 · 5 个角色 · 片段 12/30」、更新时间、··· 重命名 / 删除）。
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Film, MoreHorizontal, Pencil, Plus, Trash2, Workflow, X } from "lucide-react";
import { formatDateTime } from "@ai-star-eco/api-client";
import type { DramaCanvasStep, DramaCanvasSummary } from "@ai-star-eco/types/drama-canvas";
import { CanvasApi } from "@/api/canvas";
import { CanvasImage } from "@/canvas/shell/media";
import { ViewHeader } from "@/components/common";
import { dramaConfirm } from "@/components/drama-ui";
import { aiErrorMessage } from "@/lib/ai-error";
import { invalidate, useAsync } from "@/lib/drama-query";
import { useModalA11y } from "@/lib/use-modal-a11y";

const LIST_KEY = "/me/drama/canvases";

const STEP_LABEL: Record<DramaCanvasStep, string> = {
  script: "剧本",
  assets: "角色和场景",
  episodes: "逐集制作",
};

function statsLine(c: DramaCanvasSummary): string {
  const parts: string[] = [];
  parts.push(c.episodeCount > 0 ? `${c.episodeCount} 集` : "还没有剧本");
  if (c.characterCount > 0) parts.push(`${c.characterCount} 个角色`);
  if (c.segmentsTotal > 0) parts.push(`片段 ${c.segmentsDone}/${c.segmentsTotal}`);
  return parts.join(" · ");
}

export default function CanvasListPage() {
  const router = useRouter();
  const { data, isLoading, error, refetch } = useAsync(LIST_KEY, () => CanvasApi.list(), { revalidateOnMount: true });
  const [renaming, setRenaming] = React.useState<DramaCanvasSummary | null>(null);
  const list = data ?? [];

  const remove = async (c: DramaCanvasSummary) => {
    const ok = await dramaConfirm({
      title: "删除这张画布？",
      body: `《${c.title}》会被删掉，里面的剧本、角色和场景、已经生成的图和视频都看不到了。已经花掉的积分不退。`,
      tone: "danger",
      confirmLabel: "删除",
      cancelLabel: "再想想",
    });
    if (!ok) return;
    try {
      await CanvasApi.remove(c.id);
      invalidate(LIST_KEY);
      toast.success("已删除");
    } catch (e) {
      toast.error(aiErrorMessage(e, "没删掉，请重试"));
    }
  };

  return (
    <div className="cv-list">
      <ViewHeader
        title="我的画布"
        meta="一张画布做一部短剧：先写剧本，再拆出角色和场景出图，最后逐集出视频、合成成片。"
        action={
          <button type="button" className="btn btn-grad" style={{ height: 44, padding: "0 20px" }} onClick={() => router.push("/canvas/new")}>
            <Plus size={16} /> 新建画布
          </button>
        }
      />

      {!!error && !isLoading && (
        <div className="card col center" style={{ padding: 28, gap: 12, textAlign: "center", marginTop: 18 }}>
          <div className="muted" style={{ fontSize: 13.5 }}>
            画布列表没加载出来，点下面重新加载
          </div>
          <button type="button" className="btn btn-line btn-sm" onClick={refetch}>
            重新加载
          </button>
        </div>
      )}

      {isLoading && !data ? (
        <div className="cv-list-grid" aria-busy="true" aria-label="正在加载画布">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="skel" style={{ height: 230, borderRadius: 16 }} />
          ))}
        </div>
      ) : !error && list.length === 0 ? (
        <div className="card cv-empty">
          <span className="icon-badge" style={{ width: 44, height: 44, borderRadius: 13 }}>
            <Workflow size={20} />
          </span>
          <div className="cv-empty-title">还没有画布</div>
          <div className="cv-empty-sub">
            画布把一部短剧从剧本到成片放在一处。粘贴写好的剧本，或者写一句想法让 AI 写，新建不花积分。
          </div>
          <Link href="/canvas/new" className="btn btn-grad">
            <Plus size={16} /> 新建画布
          </Link>
        </div>
      ) : (
        <div className="cv-list-grid">
          <Link href="/canvas/new" className="card cv-card cv-card-new">
            <span className="icon-badge" style={{ width: 40, height: 40, borderRadius: 12 }}>
              <Plus size={19} />
            </span>
            <span className="cv-card-title">新建画布</span>
            <span className="cv-hint">粘贴剧本或让 AI 写，新建不花积分</span>
          </Link>
          {list.map((c) => (
            <CanvasCard key={c.id} canvas={c} onRename={() => setRenaming(c)} onDelete={() => void remove(c)} />
          ))}
        </div>
      )}

      <RenameDialog canvas={renaming} onClose={() => setRenaming(null)} />
    </div>
  );
}

function CanvasCard({ canvas: c, onRename, onDelete }: { canvas: DramaCanvasSummary; onRename: () => void; onDelete: () => void }) {
  const [menu, setMenu] = React.useState(false);
  const wrapRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    if (!menu) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent) {
        if (e.key === "Escape") setMenu(false);
        return;
      }
      if (!wrapRef.current?.contains(e.target as Node)) setMenu(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [menu]);

  const updated = formatDateTime(c.updatedAt, "");
  return (
    <div className="cv-card-wrap" ref={wrapRef}>
      <Link href={`/canvas/${encodeURIComponent(c.id)}`} className="card cv-card">
        <div className="cv-card-cover">
          {/* 列表不在画布里（没有 CanvasDocProvider），封面地址过期时不换新，失败就显示占位；刷新列表会拿到新签的地址 */}
          <CanvasImage
            asset={c.coverUrl ? { key: `cover:${c.id}`, url: c.coverUrl } : null}
            alt={`「${c.title}」的封面`}
            className="cv-card-cover-img"
            placeholder={<Film size={26} />}
          />
          <span className="tag tag-gray cv-card-step">做到「{STEP_LABEL[c.step] ?? "剧本"}」</span>
        </div>
        <div className="cv-card-body">
          <span className="cv-card-title" title={c.title}>
            {c.title || "未命名画布"}
          </span>
          <span className="cv-card-stats" title={statsLine(c)}>
            {statsLine(c)}
            {c.episodesAssembled > 0 ? ` · ${c.episodesAssembled} 集已合成` : ""}
          </span>
          {updated && <span className="cv-card-time">更新于 {updated}</span>}
        </div>
      </Link>
      <button
        type="button"
        className="cv-card-more tap-target"
        aria-label={`「${c.title}」的更多操作`}
        aria-haspopup="menu"
        aria-expanded={menu}
        onClick={() => setMenu((v) => !v)}
      >
        <MoreHorizontal size={16} />
      </button>
      {menu && (
        <div className="cv-menu" role="menu">
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setMenu(false);
              onRename();
            }}
          >
            <Pencil size={14} /> 重命名
          </button>
          <button
            type="button"
            role="menuitem"
            className="danger"
            onClick={() => {
              setMenu(false);
              onDelete();
            }}
          >
            <Trash2 size={14} /> 删除
          </button>
        </div>
      )}
    </div>
  );
}

/** 改名：服务端没有单改标题的接口，读出最新文档连同新标题一起存回去（撞上 409 再读一次重来）。 */
async function renameCanvas(id: string, title: string): Promise<void> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const d = await CanvasApi.get(id);
    try {
      await CanvasApi.save(id, { doc: d.doc, title, baseDocVersion: d.docVersion });
      return;
    } catch (e) {
      const code = e && typeof e === "object" ? (e as { code?: unknown }).code : undefined;
      if (code !== "DRAMA_CANVAS_STALE" || attempt === 1) throw e;
    }
  }
}

function RenameDialog({ canvas, onClose }: { canvas: DramaCanvasSummary | null; onClose: () => void }) {
  const open = !!canvas;
  const ref = React.useRef<HTMLFormElement | null>(null);
  useModalA11y(ref, onClose, open);
  const [title, setTitle] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (canvas) {
      setTitle(canvas.title);
      setError(null);
    }
  }, [canvas]);

  if (!canvas) return null;
  const trimmed = title.trim();
  const unchanged = trimmed === canvas.title;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!trimmed || unchanged || busy) return;
    setBusy(true);
    setError(null);
    try {
      await renameCanvas(canvas.id, trimmed);
      invalidate(LIST_KEY);
      toast.success("已改名");
      onClose();
    } catch (err) {
      setError(aiErrorMessage(err, "没改成，请重试"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="overlay" onClick={() => !busy && onClose()}>
      <form
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label="重命名画布"
        tabIndex={-1}
        className="card pop-in cv-rename-dialog"
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
      >
        <div className="cv-style-head">
          <div className="cv-style-title">重命名画布</div>
          <button type="button" className="btn btn-icon btn-ghost btn-sm" onClick={onClose} aria-label="关闭" disabled={busy}>
            <X size={15} />
          </button>
        </div>
        <input
          autoFocus
          className="cv-input"
          value={title}
          maxLength={64}
          aria-label="画布名"
          onChange={(e) => setTitle(e.target.value)}
        />
        {!trimmed && <div className="cv-hint">名字不能空着</div>}
        {error && <div className="cv-error">{error}</div>}
        <div className="cv-style-foot">
          <span className="grow" />
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose} disabled={busy}>
            取消
          </button>
          <button type="submit" className="btn btn-primary btn-sm" disabled={!trimmed || unchanged || busy}>
            {busy ? "保存中…" : "保存"}
          </button>
        </div>
      </form>
    </div>
  );
}
