"use client";

// 侵权巡查 — 全网监测仿冒账号 / 盗用素材 / 非授权数字人，一键处置留痕。

import * as React from "react";
import {
  AlertCircle, CheckCircle2, Clock, ExternalLink, Eye, Shield, XCircle,
} from "lucide-react";
import type { StarInfringementAction, StarInfringementCase } from "@ai-star-eco/types";
import { StarWorkbenchApi } from "@/api";
import { INFRINGEMENT_SEVERITY_CFG, INFRINGEMENT_STATUS_CFG } from "@/constants/star-ui";
import { formatDateTime } from "@/lib/format";
import {
  ActionButton, DangerGhostButton, EmptyState, FilterChip, GhostButton,
  InlineError, LoadingList, Modal, PageHeader, Pill,
} from "@/components/star/page-kit";

const STATUS_FILTERS = ["all", "pending", "investigating", "confirmed", "resolved"] as const;

export default function InfringementPage() {
  const [cases, setCases] = React.useState<StarInfringementCase[] | null>(null);
  const [statusFilter, setStatusFilter] = React.useState<(typeof STATUS_FILTERS)[number]>("all");
  const [viewing, setViewing] = React.useState<StarInfringementCase | null>(null);
  const [actionNote, setActionNote] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    StarWorkbenchApi.listInfringements()
      .then(setCases)
      .catch((e) => setError(e instanceof Error ? e.message : "加载失败"));
  }, []);

  const handleAction = async (action: StarInfringementAction) => {
    if (!viewing) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await StarWorkbenchApi.transitionInfringement(viewing.id, action, actionNote.trim() || undefined);
      setCases((prev) => (prev ?? []).map((c) => (c.id === updated.id ? updated : c)));
      setViewing(null);
      setActionNote("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "操作失败");
    } finally {
      setBusy(false);
    }
  };

  const all = cases ?? [];
  const filtered = statusFilter === "all" ? all : all.filter((c) => c.status === statusFilter);
  const stats = [
    { label: "总案例数", value: all.length, color: "var(--ink-0)" },
    { label: "待处理", value: all.filter((c) => c.status === "pending").length, color: "#d97706" },
    { label: "调查中", value: all.filter((c) => c.status === "investigating").length, color: "#0891b2" },
    { label: "已解决", value: all.filter((c) => c.status === "resolved").length, color: "#16a34a" },
  ];

  return (
    <div className="p-6 space-y-4 max-w-5xl">
      <PageHeader title="侵权巡查" sub="全网监测未经授权的 IP 使用，快速响应仿冒与盗用行为" />
      <InlineError message={error} onDismiss={() => setError(null)} />

      {/* 统计卡 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {stats.map((s) => (
          <div key={s.label} className="star-card px-4 py-3.5">
            <div className="text-[11px]" style={{ color: "var(--ink-1)" }}>{s.label}</div>
            <div className="text-2xl font-black mt-1 tabular" style={{ color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* 状态筛选 */}
      <div className="flex gap-2 flex-wrap">
        {STATUS_FILTERS.map((s) => (
          <FilterChip
            key={s}
            active={statusFilter === s}
            color={s === "all" ? "#78716c" : INFRINGEMENT_STATUS_CFG[s].color}
            label={s === "all" ? "全部" : INFRINGEMENT_STATUS_CFG[s].label}
            count={s === "all" ? all.length : all.filter((c) => c.status === s).length}
            onClick={() => setStatusFilter(s)}
          />
        ))}
      </div>

      {!cases ? (
        <LoadingList />
      ) : filtered.length === 0 ? (
        <EmptyState icon={Shield} title="没有符合筛选的案例" sub="自动监测与举报渠道发现的疑似侵权将进入巡查列表。" />
      ) : (
        <div className="space-y-3">
          {filtered.map((c, i) => {
            const sev = INFRINGEMENT_SEVERITY_CFG[c.severity];
            const st = INFRINGEMENT_STATUS_CFG[c.status];
            return (
              <div
                key={c.id}
                className="star-card star-card-hover p-4"
                style={c.severity === "high" && c.status !== "resolved" ? { borderColor: "#dc262640", boxShadow: "0 0 0 3px #dc26260d, var(--shadow-card)" } : undefined}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <span className="text-xs font-mono" style={{ color: "var(--ink-2)" }}>{c.id}</span>
                      <Pill color={sev.color} strong>{sev.label}</Pill>
                      <Pill color={st.color}>{st.label}</Pill>
                    </div>
                    <div className="text-[13px] mb-1">
                      <span className="font-semibold" style={{ color: "var(--ink-0)" }}>涉及 IP：</span>
                      <span style={{ color: "#9333ea" }}>{c.ipName}</span>
                      <span className="mx-2" style={{ color: "var(--ink-2)" }}>|</span>
                      <span className="font-semibold" style={{ color: "var(--ink-0)" }}>平台：</span>
                      <span style={{ color: "#0891b2" }}>{c.platform}</span>
                    </div>
                    <p className="text-xs mb-1.5 leading-relaxed" style={{ color: "var(--ink-1)" }}>{c.description}</p>
                    {c.actionNote && (
                      <p className="text-[11px] mb-1.5" style={{ color: "var(--ink-2)" }}>处置备注：{c.actionNote}</p>
                    )}
                    <div className="flex items-center gap-4 text-[11px]" style={{ color: "var(--ink-2)" }}>
                      <span>举报来源：{c.reportedBy}</span>
                      <span>{formatDateTime(c.reportedAt)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <a
                      href={c.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 rounded-lg transition hover:bg-[var(--bg-2)]"
                      title="打开侵权链接"
                    >
                      <ExternalLink className="w-4 h-4" style={{ color: "var(--ink-2)" }} />
                    </a>
                    {c.status !== "resolved" && (
                      <button
                        onClick={() => { setViewing(c); setActionNote(""); }}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold transition hover:bg-[var(--bg-2)]"
                        style={{ color: "#9333ea", border: "1px solid #9333ea33" }}
                      >
                        <Eye className="w-3.5 h-3.5" />处理
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 处理弹层 */}
      <Modal
        open={viewing !== null}
        title="侵权案例处置"
        onClose={() => !busy && setViewing(null)}
        width={560}
        footer={
          viewing ? (
            <>
              <GhostButton onClick={() => setViewing(null)} disabled={busy}>关闭</GhostButton>
              <DangerGhostButton onClick={() => handleAction("dismiss")} busy={busy}>
                驳回（误报）
              </DangerGhostButton>
              {viewing.status === "pending" && (
                <ActionButton color="#0891b2" icon={Clock} onClick={() => handleAction("investigate")} busy={busy}>
                  开始调查
                </ActionButton>
              )}
              {viewing.status === "investigating" && (
                <ActionButton color="#dc2626" icon={AlertCircle} onClick={() => handleAction("confirm")} busy={busy}>
                  确认侵权
                </ActionButton>
              )}
              {(viewing.status === "confirmed" || viewing.status === "investigating") && (
                <ActionButton color="#16a34a" icon={CheckCircle2} onClick={() => handleAction("resolve")} busy={busy}>
                  标记已解决
                </ActionButton>
              )}
            </>
          ) : null
        }
      >
        {viewing && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-[11px] mb-1" style={{ color: "var(--ink-2)" }}>案例编号</div>
                <div className="font-mono text-sm" style={{ color: "var(--ink-0)" }}>{viewing.id}</div>
              </div>
              <div>
                <div className="text-[11px] mb-1" style={{ color: "var(--ink-2)" }}>涉及 IP</div>
                <div className="text-sm" style={{ color: "#9333ea" }}>{viewing.ipName}</div>
              </div>
              <div>
                <div className="text-[11px] mb-1" style={{ color: "var(--ink-2)" }}>平台</div>
                <div className="text-sm" style={{ color: "#0891b2" }}>{viewing.platform}</div>
              </div>
              <div>
                <div className="text-[11px] mb-1" style={{ color: "var(--ink-2)" }}>严重程度</div>
                <Pill color={INFRINGEMENT_SEVERITY_CFG[viewing.severity].color} strong>
                  {INFRINGEMENT_SEVERITY_CFG[viewing.severity].label}
                </Pill>
              </div>
            </div>
            <div>
              <div className="text-[11px] mb-1" style={{ color: "var(--ink-2)" }}>侵权链接</div>
              <a href={viewing.url} target="_blank" rel="noopener noreferrer" className="text-xs hover:underline flex items-center gap-1 break-all" style={{ color: "#0891b2" }}>
                {viewing.url} <ExternalLink className="w-3 h-3 shrink-0" />
              </a>
            </div>
            <div>
              <div className="text-[11px] mb-1" style={{ color: "var(--ink-2)" }}>描述</div>
              <p className="text-sm leading-relaxed" style={{ color: "var(--ink-0)" }}>{viewing.description}</p>
            </div>
            <div>
              <div className="text-[11px] mb-2" style={{ color: "var(--ink-2)" }}>处理意见</div>
              <textarea
                value={actionNote}
                onChange={(e) => setActionNote(e.target.value)}
                placeholder="请输入处理意见或备注…"
                rows={3}
                className="w-full px-3 py-2.5 rounded-xl text-sm outline-none resize-none"
                style={{ background: "var(--bg-0)", border: "1px solid var(--line-strong)", color: "var(--ink-0)" }}
              />
            </div>
          </div>
        )}
      </Modal>

      {/* 维权资源 */}
      <div className="star-card p-5" style={{ background: "linear-gradient(135deg, #9333ea08, #0891b208)" }}>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h3 className="text-sm font-bold" style={{ color: "var(--ink-0)" }}>维权资源</h3>
            <p className="text-xs mt-0.5" style={{ color: "var(--ink-1)" }}>查看维权记录、黑名单管理、法律咨询</p>
          </div>
          <div className="flex gap-2">
            <GhostButton><Shield className="w-3.5 h-3.5" />维权记录</GhostButton>
            <GhostButton><XCircle className="w-3.5 h-3.5" />黑名单</GhostButton>
          </div>
        </div>
      </div>
    </div>
  );
}
