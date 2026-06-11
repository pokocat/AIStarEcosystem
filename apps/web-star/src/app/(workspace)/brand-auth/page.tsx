"use client";

// 品牌授权管理 — 品牌方申请明星形象授权：平台 + 明星双层审核，双向寄样验收。

import * as React from "react";
import {
  AlertCircle, Building2, CheckCheck, CheckCircle2, ChevronRight, Package,
  Star, Truck, Zap,
} from "lucide-react";
import type { StarBrandAuthRequest } from "@ai-star-eco/types";
import { StarWorkbenchApi } from "@/api";
import { useStarShell } from "@/lib/star-shell-context";
import { BRAND_STATUS_CFG, SAMPLE_STATUS_CFG } from "@/constants/star-ui";
import { formatDateTime, formatMonthsZh, formatWanYuan } from "@/lib/format";
import {
  ActionButton, CardActions, DangerGhostButton, EmptyState, InlineError, LoadingList,
  PageHeader, Pill,
} from "@/components/star/page-kit";

const ACCENT = "#3b82f6";

const CHAIN = [
  { icon: Building2, label: "品牌申请", color: "#3b82f6" },
  { icon: CheckCircle2, label: "平台预审", color: "#0891b2" },
  { icon: Star, label: "明星审核", color: "#d97706" },
  { icon: Truck, label: "寄样（双线）", color: "#9333ea" },
  { icon: Zap, label: "授权激活", color: "#16a34a" },
];

export default function BrandAuthPage() {
  const { refreshOverview } = useStarShell();
  const [items, setItems] = React.useState<StarBrandAuthRequest[] | null>(null);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    StarWorkbenchApi.listBrandAuths()
      .then(setItems)
      .catch((e) => setError(e instanceof Error ? e.message : "加载失败"));
  }, []);

  const mutate = async (id: string, fn: () => Promise<StarBrandAuthRequest>) => {
    setBusyId(id);
    setError(null);
    try {
      const updated = await fn();
      setItems((prev) => (prev ?? []).map((b) => (b.id === id ? updated : b)));
      void refreshOverview();
    } catch (e) {
      setError(e instanceof Error ? e.message : "操作失败");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="p-4 sm:p-6 space-y-4 max-w-5xl">
      <PageHeader title="品牌授权管理" sub="品牌方向明星申请形象授权，平台 + 明星双层审核，双向寄样验收后激活" />
      <InlineError message={error} onDismiss={() => setError(null)} />

      {/* 审核链 */}
      <div className="star-card p-3" style={{ borderColor: `${ACCENT}26`, background: `${ACCENT}05` }}>
        {/* <sm 五列等分（不横滑）；≥sm 横向链 + 箭头 */}
        <div className="grid grid-cols-5 gap-1 sm:flex sm:items-center sm:gap-2 sm:overflow-x-auto sm:scrollbar-thin">
          {CHAIN.map((s, si) => {
            const SIcon = s.icon;
            return (
              <React.Fragment key={s.label}>
                <div className="flex flex-col items-center text-center gap-1 min-w-0 sm:shrink-0 sm:min-w-[72px]">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${s.color}12`, border: `1px solid ${s.color}30` }}>
                    <SIcon className="w-4 h-4" style={{ color: s.color }} />
                  </div>
                  <span className="text-[9px] leading-tight" style={{ color: "var(--ink-1)" }}>{s.label}</span>
                </div>
                {si < CHAIN.length - 1 && <ChevronRight className="hidden sm:block w-3 h-3 shrink-0 -mt-2" style={{ color: "var(--ink-2)" }} />}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {!items ? (
        <LoadingList />
      ) : items.length === 0 ? (
        <EmptyState icon={Building2} title="暂无品牌授权申请" sub="品牌方提交合作申请并通过平台预审后将出现在这里。" />
      ) : (
        items.map((req, i) => {
          const isCelebReview = req.status === "celebReview";
          const needsReceive = req.status === "sampleStage" && req.celebSample === "shipping";
          const needsConfirm = req.status === "sampleStage" && req.celebSample === "delivered";
          const isApproved = req.status === "approved";
          const isRejected = req.status === "rejected";
          const sCfg = BRAND_STATUS_CFG[req.status];
          const actionable = isCelebReview || needsReceive || needsConfirm;
          return (
            <div
              key={req.id}
              className="star-card overflow-hidden"
              style={actionable
                ? { borderColor: "#d9770633", background: "#d9770605" }
                : isApproved
                  ? { borderColor: "#16a34a33", background: "#16a34a05" }
                  : isRejected
                    ? { opacity: 0.75 }
                    : undefined}
            >
              <div className="p-4">
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${ACCENT}10`, border: `1px solid ${ACCENT}26` }}>
                    <Building2 className="w-5 h-5" style={{ color: ACCENT }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold" style={{ color: "var(--ink-0)" }}>{req.brandName}</span>
                      {req.authTypes.map((t) => (
                        <Pill key={t} color={ACCENT}>{t}</Pill>
                      ))}
                      <Pill color={sCfg.color} strong>{sCfg.label}</Pill>
                    </div>
                    <p className="text-xs mt-1.5" style={{ color: "var(--ink-1)" }}>{req.purpose}</p>
                    <div className="flex items-center gap-4 mt-1.5 text-[11px] flex-wrap" style={{ color: "var(--ink-2)" }}>
                      <span className="font-black tabular" style={{ color: "var(--star-gold-deep)" }}>{formatWanYuan(req.amountCents)}</span>
                      <span>授权期：{formatMonthsZh(req.durationMonths)}</span>
                      <span>{req.platforms.join("、")}</span>
                      <span>{formatDateTime(req.submittedAt)}</span>
                    </div>
                    {req.platformNote && (
                      <div className="mt-2 text-[11px] flex items-start gap-1" style={{ color: "#0369a1" }}>
                        <CheckCircle2 className="w-2.5 h-2.5 shrink-0 mt-0.5" />平台建议：{req.platformNote}
                      </div>
                    )}
                    {/* 双路收样 */}
                    {req.status !== "pending" && req.status !== "platformReview" && (
                      <div className="mt-2.5 grid grid-cols-2 gap-2 max-w-md">
                        {[
                          { who: "平台收样", status: req.platformSample },
                          { who: "明星收样", status: req.celebSample },
                        ].map((track) => {
                          const ss = SAMPLE_STATUS_CFG[track.status];
                          const Icon = ss.icon;
                          return (
                            <div key={track.who} className="rounded-lg p-2" style={{ background: "var(--bg-0)", border: `1px solid ${ss.color}26` }}>
                              <div className="text-[9px] mb-1" style={{ color: "var(--ink-2)" }}>{track.who}</div>
                              <div className="flex items-center gap-1">
                                <Icon className="w-3 h-3" style={{ color: ss.color }} />
                                <span className="text-[10px] font-bold" style={{ color: ss.color }}>{ss.label}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              {actionable && (
                <CardActions
                  hintIcon={AlertCircle}
                  hint={
                    <>
                      {isCelebReview && "平台已预审通过，等待你的决定"}
                      {needsReceive && "品牌样品运输中，送达后请确认签收"}
                      {needsConfirm && "样品已签收，确认质量后即可激活授权"}
                    </>
                  }
                >
                  <DangerGhostButton onClick={() => mutate(req.id, () => StarWorkbenchApi.rejectBrandAuth(req.id))} busy={busyId === req.id}>
                    驳回
                  </DangerGhostButton>
                  {isCelebReview && (
                    <ActionButton color={ACCENT} icon={CheckCheck} onClick={() => mutate(req.id, () => StarWorkbenchApi.approveBrandAuth(req.id))} busy={busyId === req.id}>
                      批准，进入寄样
                    </ActionButton>
                  )}
                  {needsReceive && (
                    <ActionButton color="#0891b2" icon={Truck} onClick={() => mutate(req.id, () => StarWorkbenchApi.receiveBrandSample(req.id))} busy={busyId === req.id}>
                      确认签收样品
                    </ActionButton>
                  )}
                  {needsConfirm && (
                    <ActionButton color="#16a34a" icon={Package} onClick={() => mutate(req.id, () => StarWorkbenchApi.confirmBrandSample(req.id))} busy={busyId === req.id}>
                      样品确认，激活授权
                    </ActionButton>
                  )}
                </CardActions>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
