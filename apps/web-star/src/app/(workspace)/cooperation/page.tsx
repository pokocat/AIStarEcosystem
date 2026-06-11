"use client";

// 带货授权 — AI 明星带货端（web-celebrity）创作者发起的授权申请在此审批。
// 批准：设定授权场景 / 时长 / 风格数 → 创作者端即时解锁 AI 复刻带货。

import * as React from "react";
import { CheckCheck, Clock, Handshake, MessageSquareText, UserRound } from "lucide-react";
import type { StarCooperationRequest } from "@ai-star-eco/types";
import { StarWorkbenchApi } from "@/api";
import { useStarShell } from "@/lib/star-shell-context";
import { COOPERATION_SCENES, COOPERATION_STATUS_CFG } from "@/constants/star-ui";
import { formatDateTime } from "@/lib/format";
import {
  ActionButton, DangerGhostButton, EmptyState, FilterChip, GhostButton,
  InlineError, LoadingList, Modal, NoteBox, PageHeader, Pill,
} from "@/components/star/page-kit";

const ACCENT = "#f43f5e";
const EXPIRE_OPTIONS = [3, 6, 12, 24];

export default function CooperationPage() {
  const { refreshOverview } = useStarShell();
  const [items, setItems] = React.useState<StarCooperationRequest[] | null>(null);
  const [filter, setFilter] = React.useState<"all" | "pending" | "authorized" | "unauthorized">("all");
  const [error, setError] = React.useState<string | null>(null);

  // 批准弹层
  const [approving, setApproving] = React.useState<StarCooperationRequest | null>(null);
  const [scenes, setScenes] = React.useState<string[]>([]);
  const [expireMonths, setExpireMonths] = React.useState(6);
  const [styles, setStyles] = React.useState(4);
  // 驳回弹层
  const [rejecting, setRejecting] = React.useState<StarCooperationRequest | null>(null);
  const [reason, setReason] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  const load = React.useCallback(() => {
    StarWorkbenchApi.listCooperations()
      .then(setItems)
      .catch((e) => setError(e instanceof Error ? e.message : "加载失败"));
  }, []);

  React.useEffect(() => { load(); }, [load]);

  const openApprove = (req: StarCooperationRequest) => {
    setApproving(req);
    setScenes(req.scenes.length ? [...req.scenes] : ["带货"]);
    setExpireMonths(6);
    setStyles(4);
  };

  const doApprove = async () => {
    if (!approving) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await StarWorkbenchApi.approveCooperation(approving.id, { scenes, expireMonths, availableStyles: styles });
      setItems((prev) => (prev ?? []).map((c) => (c.id === updated.id ? updated : c)));
      setApproving(null);
      void refreshOverview();
    } catch (e) {
      setError(e instanceof Error ? e.message : "批准失败");
    } finally {
      setBusy(false);
    }
  };

  const doReject = async () => {
    if (!rejecting) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await StarWorkbenchApi.rejectCooperation(rejecting.id, reason.trim() || undefined);
      setItems((prev) => (prev ?? []).map((c) => (c.id === updated.id ? updated : c)));
      setRejecting(null);
      setReason("");
      void refreshOverview();
    } catch (e) {
      setError(e instanceof Error ? e.message : "驳回失败");
    } finally {
      setBusy(false);
    }
  };

  const filtered = (items ?? []).filter((c) => filter === "all" || c.status === filter);
  const countOf = (s: string) => (items ?? []).filter((c) => (s === "all" ? true : c.status === s)).length;

  return (
    <div className="p-6 space-y-4 max-w-5xl">
      <PageHeader title="带货授权" sub="AI 明星带货端创作者发起的 AI 复刻授权申请 —— 批准后对方即可用你的 IP 生成带货视频" />
      <InlineError message={error} onDismiss={() => setError(null)} />

      <NoteBox color={ACCENT} icon={Handshake}>
        本模块与「AI 明星带货」子应用实时互通：创作者在明星市场提交申请 → 此处审批 → 对方工作台立即生效。
      </NoteBox>

      <div className="flex items-center gap-2 flex-wrap">
        {([
          { id: "all", label: "全部" },
          { id: "pending", label: "待审批" },
          { id: "authorized", label: "已授权" },
          { id: "unauthorized", label: "已驳回" },
        ] as const).map((f) => (
          <FilterChip
            key={f.id}
            active={filter === f.id}
            color={f.id === "all" ? "#78716c" : COOPERATION_STATUS_CFG[f.id]?.color ?? ACCENT}
            label={f.label}
            count={countOf(f.id)}
            onClick={() => setFilter(f.id)}
          />
        ))}
      </div>

      {!items ? (
        <LoadingList />
      ) : filtered.length === 0 ? (
        <EmptyState icon={Handshake} title="暂无授权申请" sub="创作者在 AI 明星带货端的明星市场对你发起授权申请后，将实时出现在这里。" />
      ) : (
        filtered.map((req, i) => {
          const cfg = COOPERATION_STATUS_CFG[req.status];
          const isPending = req.status === "pending";
          return (
            <div
              key={req.id}
              className="star-card overflow-hidden"
              style={isPending ? { borderColor: `${ACCENT}33`, background: `${ACCENT}05` } : undefined}
            >
              <div className="flex items-start gap-3 p-4">
                <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${ACCENT}12`, border: `1px solid ${ACCENT}26` }}>
                  <UserRound className="w-5 h-5" style={{ color: ACCENT }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold" style={{ color: "var(--ink-0)" }}>{req.applicantName}</span>
                    {req.scenes.map((s) => (
                      <Pill key={s} color="#0891b2">{s}</Pill>
                    ))}
                    <Pill color={cfg.color} strong>{cfg.label}</Pill>
                  </div>
                  {req.note && (
                    <p className="text-xs mt-1.5 flex items-start gap-1.5" style={{ color: "var(--ink-1)" }}>
                      <MessageSquareText className="w-3 h-3 shrink-0 mt-0.5" style={{ color: "var(--ink-2)" }} />
                      {req.note}
                    </p>
                  )}
                  <div className="flex items-center gap-3 mt-1.5 text-[11px] flex-wrap" style={{ color: "var(--ink-2)" }}>
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" />申请于 {formatDateTime(req.requestedAt)}</span>
                    {req.decidedAt && <span>处理于 {formatDateTime(req.decidedAt)}</span>}
                    {req.status === "authorized" && req.expireDate && <span>授权至 {req.expireDate}</span>}
                    {req.status === "authorized" && typeof req.availableStyles === "number" && <span>{req.availableStyles} 个风格</span>}
                  </div>
                </div>
              </div>
              {isPending && (
                <div className="flex items-center gap-2 px-4 pb-3 pt-2.5" style={{ borderTop: "1px solid var(--line)" }}>
                  <div className="flex-1 text-[11px] flex items-center gap-1" style={{ color: "var(--star-gold-deep)" }}>
                    <Clock className="w-3 h-3" />等待你的授权决定，批准后创作者端立即生效
                  </div>
                  <DangerGhostButton onClick={() => { setRejecting(req); setReason(""); }}>驳回</DangerGhostButton>
                  <ActionButton color={ACCENT} icon={CheckCheck} onClick={() => openApprove(req)}>批准授权</ActionButton>
                </div>
              )}
            </div>
          );
        })
      )}

      {/* 批准弹层 */}
      <Modal
        open={approving !== null}
        title={`批准授权 — ${approving?.applicantName ?? ""}`}
        onClose={() => !busy && setApproving(null)}
        footer={
          <>
            <GhostButton onClick={() => setApproving(null)} disabled={busy}>取消</GhostButton>
            <ActionButton color={ACCENT} icon={CheckCheck} onClick={doApprove} busy={busy} disabled={scenes.length === 0}>
              确认批准
            </ActionButton>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <div className="text-xs font-semibold mb-2" style={{ color: "var(--ink-0)" }}>授权场景</div>
            <div className="flex gap-1.5 flex-wrap">
              {COOPERATION_SCENES.map((s) => {
                const on = scenes.includes(s);
                return (
                  <button
                    key={s}
                    onClick={() => setScenes((prev) => (on ? prev.filter((x) => x !== s) : [...prev, s]))}
                    className="px-3 h-8 rounded-lg text-xs font-semibold transition"
                    style={on
                      ? { background: `${ACCENT}12`, border: `1px solid ${ACCENT}55`, color: ACCENT }
                      : { background: "var(--bg-2)", border: "1px solid transparent", color: "var(--ink-1)" }}
                  >
                    {on ? "✓ " : ""}{s}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <div className="text-xs font-semibold mb-2" style={{ color: "var(--ink-0)" }}>授权时长</div>
            <div className="flex gap-1.5 flex-wrap">
              {EXPIRE_OPTIONS.map((m) => (
                <button
                  key={m}
                  onClick={() => setExpireMonths(m)}
                  className="px-3 h-8 rounded-lg text-xs font-semibold transition tabular"
                  style={expireMonths === m
                    ? { background: `${ACCENT}12`, border: `1px solid ${ACCENT}55`, color: ACCENT }
                    : { background: "var(--bg-2)", border: "1px solid transparent", color: "var(--ink-1)" }}
                >
                  {m} 个月
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="text-xs font-semibold mb-2" style={{ color: "var(--ink-0)" }}>开放风格数</div>
            <div className="flex gap-1.5 flex-wrap">
              {[2, 4, 6, 8].map((n) => (
                <button
                  key={n}
                  onClick={() => setStyles(n)}
                  className="px-3 h-8 rounded-lg text-xs font-semibold transition tabular"
                  style={styles === n
                    ? { background: `${ACCENT}12`, border: `1px solid ${ACCENT}55`, color: ACCENT }
                    : { background: "var(--bg-2)", border: "1px solid transparent", color: "var(--ink-1)" }}
                >
                  {n} 个
                </button>
              ))}
            </div>
          </div>
          <NoteBox color="#0891b2">批准后创作者即可在「AI 明星带货」用你的 AI 复刻形象按所选场景生成内容，所有产出仍需经「内容审核」把关。</NoteBox>
        </div>
      </Modal>

      {/* 驳回弹层 */}
      <Modal
        open={rejecting !== null}
        title={`驳回申请 — ${rejecting?.applicantName ?? ""}`}
        onClose={() => !busy && setRejecting(null)}
        footer={
          <>
            <GhostButton onClick={() => setRejecting(null)} disabled={busy}>取消</GhostButton>
            <DangerGhostButton onClick={doReject} busy={busy}>确认驳回</DangerGhostButton>
          </>
        }
      >
        <div className="space-y-3">
          <div className="text-xs" style={{ color: "var(--ink-1)" }}>驳回理由将同步给申请方（选填）：</div>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            placeholder="例：当前档期内不开放新的带货授权，欢迎 Q4 再次申请。"
            className="w-full px-3 py-2.5 rounded-xl text-sm outline-none resize-none"
            style={{ background: "var(--bg-0)", border: "1px solid var(--line-strong)", color: "var(--ink-0)" }}
          />
        </div>
      </Modal>
    </div>
  );
}
