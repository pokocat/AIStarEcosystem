"use client";

// 商品入库管理 — 平台严选 / 达人选品（celebrity 报备） / 品牌直供 三源，
// 6 步入库流程 + 平台与明星双路寄样验收。

import * as React from "react";
import { AlertCircle, CheckCheck, CheckCircle2, ChevronRight, Package, ShoppingBag, Truck } from "lucide-react";
import type { StarProductOnboard } from "@ai-star-eco/types";
import { StarWorkbenchApi } from "@/api";
import { useStarShell } from "@/lib/star-shell-context";
import { PRODUCT_SOURCE_CFG, PRODUCT_SOURCE_FILTERS, PRODUCT_STEPS, SAMPLE_STATUS_CFG } from "@/constants/star-ui";
import { formatDateTime, formatYuan } from "@/lib/format";
import {
  ActionButton, DangerGhostButton, EmptyState, FilterChip, InlineError,
  LoadingList, PageHeader, Pill,
} from "@/components/star/page-kit";

export default function ProductOnboardPage() {
  const { refreshOverview } = useStarShell();
  const [items, setItems] = React.useState<StarProductOnboard[] | null>(null);
  const [sourceFilter, setSourceFilter] = React.useState<string>("all");
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    StarWorkbenchApi.listProductOnboards()
      .then(setItems)
      .catch((e) => setError(e instanceof Error ? e.message : "加载失败"));
  }, []);

  const mutate = async (id: string, fn: () => Promise<StarProductOnboard>) => {
    setBusyId(id);
    setError(null);
    try {
      const updated = await fn();
      setItems((prev) => (prev ?? []).map((p) => (p.id === id ? updated : p)));
      void refreshOverview();
    } catch (e) {
      setError(e instanceof Error ? e.message : "操作失败");
    } finally {
      setBusyId(null);
    }
  };

  const all = items ?? [];
  const filtered = all.filter((p) => sourceFilter === "all" || p.source === sourceFilter);

  return (
    <div className="p-6 space-y-4 max-w-5xl">
      <PageHeader title="商品入库管理" sub="平台发起 · 达人选品 · 品牌申请 三条入库路径，平台 + 明星双路收样审核" />
      <InlineError message={error} onDismiss={() => setError(null)} />

      {/* 来源筛选 */}
      <div className="flex items-center gap-2 flex-wrap">
        {PRODUCT_SOURCE_FILTERS.map((f) => (
          <FilterChip
            key={f.id}
            active={sourceFilter === f.id}
            color={f.color}
            label={f.label}
            count={f.id === "all" ? all.length : all.filter((p) => p.source === f.id).length}
            onClick={() => setSourceFilter(f.id)}
          />
        ))}
      </div>

      {/* 步骤图例 */}
      <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-thin pb-1">
        {PRODUCT_STEPS.map((step, i) => (
          <React.Fragment key={step.label}>
            <div className="flex items-center gap-1 shrink-0">
              <span className="w-2 h-2 rounded-full" style={{ background: step.color }} />
              <span className="text-[10px]" style={{ color: step.color }}>{step.label}</span>
            </div>
            {i < PRODUCT_STEPS.length - 1 && <ChevronRight className="w-3 h-3 shrink-0" style={{ color: "var(--ink-2)" }} />}
          </React.Fragment>
        ))}
        <span className="text-[10px] ml-2 shrink-0" style={{ color: "var(--ink-2)" }}>= 商品入库流程</span>
      </div>

      {!items ? (
        <LoadingList />
      ) : filtered.length === 0 ? (
        <EmptyState icon={ShoppingBag} title="暂无入库申请" sub="创作者在 AI 明星带货端报备商品、或平台 / 品牌发起入库后将出现在这里。" />
      ) : (
        filtered.map((item, i) => {
          const source = PRODUCT_SOURCE_CFG[item.source];
          const needsReview = item.step === 2;
          const needsReceive = item.step === 3 && item.celebSample === "shipping";
          const needsConfirm = item.step === 4 && item.celebSample === "delivered";
          const isRejected = item.step === 6;
          const isInLibrary = item.step === 5;
          const actionable = needsReview || needsReceive || needsConfirm;
          return (
            <div
              key={item.id}
              className="star-card overflow-hidden"
              style={isInLibrary
                ? { borderColor: "#16a34a33", background: "#16a34a05" }
                : actionable
                  ? { borderColor: "#d9770633", background: "#d9770605" }
                  : isRejected
                    ? { opacity: 0.75 }
                    : undefined}
            >
              <div className="p-4">
                <div className="flex items-start gap-3">
                  {/* 商品图占位 */}
                  <div className="w-14 h-14 rounded-xl flex items-center justify-center shrink-0" style={{ background: "var(--bg-2)", border: "1px solid var(--line)" }}>
                    <ShoppingBag className="w-6 h-6" style={{ color: "var(--ink-2)" }} />
                  </div>

                  {/* 信息 */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-sm font-bold" style={{ color: "var(--ink-0)" }}>{item.productName}</span>
                      <Pill color={source.color}>{source.label}</Pill>
                      {item.productId && <Pill color="#f43f5e">已关联商品池</Pill>}
                      {isInLibrary && <Pill color="#16a34a" strong>✓ 已入库</Pill>}
                      {isRejected && <Pill color="#dc2626" strong>已驳回</Pill>}
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-[11px] flex-wrap">
                      <span className="font-black tabular" style={{ color: "var(--star-gold-deep)" }}>{formatYuan(item.priceCents)}</span>
                      <span className="font-medium" style={{ color: "var(--ink-1)" }}>{item.brand}</span>
                      <span className="px-1.5 py-0.5 rounded-md" style={{ background: "var(--bg-2)", color: "var(--ink-1)" }}>{item.category}</span>
                    </div>
                    <div className="mt-1 text-[10px]" style={{ color: "var(--ink-2)" }}>
                      提交方：{item.submittedBy}
                      {item.mcnName && <span> · {item.mcnName}</span>}
                      <span> · {formatDateTime(item.submittedAt)}</span>
                    </div>
                    {item.platformNote && (
                      <div className="mt-1.5 text-[11px] flex items-center gap-1" style={{ color: "#0369a1" }}>
                        <CheckCircle2 className="w-2.5 h-2.5 shrink-0" />{item.platformNote}
                      </div>
                    )}
                    {/* 双路寄样 */}
                    {item.step >= 3 && !isRejected && (
                      <div className="mt-2.5 grid grid-cols-2 gap-1.5 max-w-md">
                        {[
                          { who: "平台样品", status: item.platformSample, tracking: item.trackingPlatform },
                          { who: "明星样品", status: item.celebSample, tracking: item.trackingCeleb },
                        ].map((track) => {
                          const ss = SAMPLE_STATUS_CFG[track.status];
                          const Icon = ss.icon;
                          return (
                            <div key={track.who} className="rounded-lg p-2" style={{ background: "var(--bg-0)", border: `1px solid ${ss.color}26` }}>
                              <div className="text-[9px] mb-1" style={{ color: "var(--ink-2)" }}>{track.who}</div>
                              <div className="flex items-center gap-1">
                                <Icon className="w-3 h-3 shrink-0" style={{ color: ss.color }} />
                                <span className="text-[10px] font-bold" style={{ color: ss.color }}>{ss.label}</span>
                              </div>
                              {track.tracking && <div className="text-[9px] font-mono mt-0.5 truncate" style={{ color: "var(--ink-2)" }}>{track.tracking}</div>}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* 右侧垂直步骤条 */}
                  {!isRejected && (
                    <div className="hidden sm:flex flex-col items-stretch gap-0 shrink-0 w-[64px]">
                      {PRODUCT_STEPS.map((step, si) => {
                        const done = item.step > si || isInLibrary;
                        const current = item.step === si && !isInLibrary;
                        return (
                          <div key={si} className="flex items-start w-full gap-1.5">
                            <div className="flex flex-col items-center shrink-0">
                              <span
                                className="w-2 h-2 rounded-full border-2 shrink-0"
                                style={done
                                  ? { borderColor: step.color, background: step.color }
                                  : current
                                    ? { borderColor: step.color, background: "var(--bg-1)" }
                                    : { borderColor: "var(--line-strong)", background: "var(--bg-2)" }}
                              />
                              {si < PRODUCT_STEPS.length - 1 && (
                                <span className="w-px flex-1 min-h-[10px]" style={{ background: done ? step.color : "var(--line)" }} />
                              )}
                            </div>
                            <span
                              className="text-[9px] leading-tight truncate pt-px"
                              style={done
                                ? { color: step.color }
                                : current
                                  ? { color: "var(--ink-0)", fontWeight: 700 }
                                  : { color: "var(--ink-2)" }}
                            >
                              {step.label}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* 操作条 */}
              {actionable && (
                <div className="flex items-center gap-2 px-4 pb-3 pt-2.5 flex-wrap" style={{ borderTop: "1px solid var(--line)" }}>
                  <div className="flex-1 min-w-[180px] text-[11px] flex items-center gap-1" style={{ color: "var(--star-gold-deep)" }}>
                    <AlertCircle className="w-3 h-3 shrink-0" />
                    {needsReview && "需要你审核这款商品"}
                    {needsReceive && "样品运输中，送达后请确认签收"}
                    {needsConfirm && "样品已签收，请体验后确认质量"}
                  </div>
                  <DangerGhostButton onClick={() => mutate(item.id, () => StarWorkbenchApi.rejectProductOnboard(item.id))} busy={busyId === item.id}>
                    驳回
                  </DangerGhostButton>
                  {needsReview && (
                    <ActionButton color="#22c55e" icon={CheckCheck} onClick={() => mutate(item.id, () => StarWorkbenchApi.approveProductOnboard(item.id))} busy={busyId === item.id}>
                      审核通过，安排寄样
                    </ActionButton>
                  )}
                  {needsReceive && (
                    <ActionButton color="#0891b2" icon={Truck} onClick={() => mutate(item.id, () => StarWorkbenchApi.receiveProductSample(item.id))} busy={busyId === item.id}>
                      确认签收样品
                    </ActionButton>
                  )}
                  {needsConfirm && (
                    <ActionButton color="#22c55e" icon={Package} onClick={() => mutate(item.id, () => StarWorkbenchApi.confirmProductSample(item.id))} busy={busyId === item.id}>
                      样品通过，入库
                    </ActionButton>
                  )}
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
