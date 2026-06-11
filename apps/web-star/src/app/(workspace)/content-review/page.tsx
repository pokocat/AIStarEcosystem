"use client";

// 内容审核 — 审看切片二创 / 数字人产出 / AI 形象生成视频；驳回与回改留痕。

import * as React from "react";
import { CheckCheck, Eye, Film, RotateCcw, Video } from "lucide-react";
import type { StarContentReview } from "@ai-star-eco/types";
import { StarWorkbenchApi } from "@/api";
import { useStarShell } from "@/lib/star-shell-context";
import { CONTENT_STATUS_CFG, CONTENT_TYPE_CFG, getPlatformColor } from "@/constants/star-ui";
import { formatDateTime, formatDurationZh, formatWan } from "@/lib/format";
import {
  ActionButton, CardActions, DangerGhostButton, EmptyState, FilterChip, GhostButton,
  InlineError, LoadingList, Modal, NoteBox, PageHeader, Pill,
} from "@/components/star/page-kit";

export default function ContentReviewPage() {
  const { refreshOverview } = useStarShell();
  const [items, setItems] = React.useState<StarContentReview[] | null>(null);
  const [typeFilter, setTypeFilter] = React.useState<string>("all");
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [revising, setRevising] = React.useState<StarContentReview | null>(null);
  const [revisionNote, setRevisionNote] = React.useState("");
  const [busyModal, setBusyModal] = React.useState(false);

  React.useEffect(() => {
    StarWorkbenchApi.listContentReviews()
      .then(setItems)
      .catch((e) => setError(e instanceof Error ? e.message : "加载失败"));
  }, []);

  const mutate = async (id: string, fn: () => Promise<StarContentReview>) => {
    setBusyId(id);
    setError(null);
    try {
      const updated = await fn();
      setItems((prev) => (prev ?? []).map((r) => (r.id === id ? updated : r)));
      void refreshOverview();
    } catch (e) {
      setError(e instanceof Error ? e.message : "操作失败");
    } finally {
      setBusyId(null);
    }
  };

  const doRevise = async () => {
    if (!revising) return;
    setBusyModal(true);
    try {
      const updated = await StarWorkbenchApi.reviseContent(revising.id, revisionNote.trim() || undefined);
      setItems((prev) => (prev ?? []).map((r) => (r.id === updated.id ? updated : r)));
      setRevising(null);
      setRevisionNote("");
      void refreshOverview();
    } catch (e) {
      setError(e instanceof Error ? e.message : "操作失败");
    } finally {
      setBusyModal(false);
    }
  };

  const all = items ?? [];
  const filtered = all.filter((c) => typeFilter === "all" || c.type === typeFilter);

  const TYPE_FILTERS = [
    { id: "all", label: "全部", color: "#78716c", icon: Video },
    { id: "clip", label: "切片", color: CONTENT_TYPE_CFG.clip.color, icon: CONTENT_TYPE_CFG.clip.icon },
    { id: "digitalHuman", label: "数字人", color: CONTENT_TYPE_CFG.digitalHuman.color, icon: CONTENT_TYPE_CFG.digitalHuman.icon },
    { id: "aiLikeness", label: "AI形象", color: CONTENT_TYPE_CFG.aiLikeness.color, icon: CONTENT_TYPE_CFG.aiLikeness.icon },
  ];

  return (
    <div className="p-4 sm:p-6 space-y-4 max-w-5xl">
      <PageHeader title="内容审核" sub="审核 MCN 制作的切片、数字人、AI 形象视频 —— 通过 / 要求修改 / 驳回" />
      <InlineError message={error} onDismiss={() => setError(null)} />

      <div className="flex items-center gap-2 flex-wrap">
        {TYPE_FILTERS.map((f) => (
          <FilterChip
            key={f.id}
            active={typeFilter === f.id}
            color={f.color}
            label={f.label}
            icon={f.icon}
            count={f.id === "all" ? all.length : all.filter((c) => c.type === f.id).length}
            onClick={() => setTypeFilter(f.id)}
          />
        ))}
      </div>

      {!items ? (
        <LoadingList />
      ) : filtered.length === 0 ? (
        <EmptyState icon={Film} title="暂无待审内容" sub="MCN 产出的切片 / 数字人 / AI 形象内容提交后将进入审核池。" />
      ) : (
        filtered.map((item, i) => {
          const typeCfg = CONTENT_TYPE_CFG[item.type];
          const TypeIcon = typeCfg.icon;
          const sCfg = CONTENT_STATUS_CFG[item.status];
          const pColor = getPlatformColor(item.platform);
          return (
            <div
              key={item.id}
              className="star-card star-card-hover overflow-hidden"
            >
              <div className="flex items-start gap-3 p-4">
                {/* 视频缩略占位 */}
                <div className="w-20 h-14 rounded-xl flex items-center justify-center shrink-0 relative overflow-hidden" style={{ background: `${typeCfg.color}0d`, border: `1px solid ${typeCfg.color}26` }}>
                  <TypeIcon className="w-6 h-6 opacity-35" style={{ color: typeCfg.color }} />
                  <span className="absolute bottom-1 right-1 text-[9px] font-bold px-1.5 py-0.5 rounded text-white tabular" style={{ background: "rgba(28,25,23,0.72)" }}>
                    {formatDurationZh(item.durationSec)}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-sm font-bold truncate" style={{ color: "var(--ink-0)" }}>{item.title}</div>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <Pill color={typeCfg.color}>{typeCfg.label}</Pill>
                        <Pill color={pColor}>{item.platform}</Pill>
                        {typeof item.views === "number" && (
                          <span className="text-[10px] flex items-center gap-0.5" style={{ color: "var(--ink-2)" }}>
                            <Eye className="w-2.5 h-2.5" />{formatWan(item.views)}
                          </span>
                        )}
                      </div>
                    </div>
                    <Pill color={sCfg.color} strong>{sCfg.label}</Pill>
                  </div>
                  <div className="text-[11px] mt-1.5" style={{ color: "var(--ink-2)" }}>
                    {item.uploader} · {item.mcnName} · {formatDateTime(item.submittedAt)}
                  </div>
                  {item.status === "revision" && item.revisionNote && (
                    <div className="mt-2">
                      <NoteBox color="#ea580c" icon={RotateCcw}>修改意见：{item.revisionNote}</NoteBox>
                    </div>
                  )}
                </div>
              </div>
              {item.status === "pending" && (
                <CardActions>
                  <DangerGhostButton onClick={() => mutate(item.id, () => StarWorkbenchApi.rejectContent(item.id))} busy={busyId === item.id}>
                    驳回
                  </DangerGhostButton>
                  <button
                    onClick={() => { setRevising(item); setRevisionNote(""); }}
                    className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 max-sm:min-h-[44px] rounded-lg text-xs font-bold transition hover:bg-orange-50"
                    style={{ color: "#ea580c", border: "1px solid #ea580c33", background: "#ea580c0a" }}
                  >
                    <RotateCcw className="w-3.5 h-3.5" />要求修改
                  </button>
                  <ActionButton color="#16a34a" icon={CheckCheck} onClick={() => mutate(item.id, () => StarWorkbenchApi.approveContent(item.id))} busy={busyId === item.id}>
                    通过
                  </ActionButton>
                </CardActions>
              )}
            </div>
          );
        })
      )}

      {/* 修改意见弹层 */}
      <Modal
        open={revising !== null}
        title={`要求修改 — ${revising?.title ?? ""}`}
        onClose={() => !busyModal && setRevising(null)}
        footer={
          <>
            <GhostButton onClick={() => setRevising(null)} disabled={busyModal}>取消</GhostButton>
            <ActionButton color="#ea580c" icon={RotateCcw} onClick={doRevise} busy={busyModal}>
              发回修改
            </ActionButton>
          </>
        }
      >
        <div className="space-y-3">
          <div className="text-xs" style={{ color: "var(--ink-1)" }}>修改意见将回流到 MCN 端的「驳回返工」列表：</div>
          <textarea
            value={revisionNote}
            onChange={(e) => setRevisionNote(e.target.value)}
            rows={3}
            placeholder="例：片头 LOGO 使用未授权素材，请替换后重新提交。"
            className="w-full px-3 py-2.5 rounded-xl text-sm outline-none resize-none"
            style={{ background: "var(--bg-0)", border: "1px solid var(--line-strong)", color: "var(--ink-0)" }}
          />
        </div>
      </Modal>
    </div>
  );
}
