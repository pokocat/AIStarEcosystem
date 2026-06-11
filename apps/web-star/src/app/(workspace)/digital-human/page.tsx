"use client";

// 数字人授权管理 — 审核 MCN 申请使用数字人形象（直播 / 短视频 / 广告）。

import * as React from "react";
import { AlertCircle, Bot, CheckCheck } from "lucide-react";
import type { StarDigitalHumanRequest } from "@ai-star-eco/types";
import { StarWorkbenchApi } from "@/api";
import { useStarShell } from "@/lib/star-shell-context";
import { DH_USAGE_CFG } from "@/constants/star-ui";
import { formatDateTime, formatMonthsZh } from "@/lib/format";
import {
  ActionButton, CardActions, DangerGhostButton, EmptyState, InlineError, LoadingList,
  NoteBox, PageHeader, Pill,
} from "@/components/star/page-kit";

const ACCENT = "#a855f7";

export default function DigitalHumanPage() {
  const { refreshOverview } = useStarShell();
  const [items, setItems] = React.useState<StarDigitalHumanRequest[] | null>(null);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    StarWorkbenchApi.listDigitalHumanRequests()
      .then(setItems)
      .catch((e) => setError(e instanceof Error ? e.message : "加载失败"));
  }, []);

  const mutate = async (id: string, fn: () => Promise<StarDigitalHumanRequest>) => {
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

  return (
    <div className="p-4 sm:p-6 space-y-4 max-w-5xl">
      <PageHeader title="数字人授权管理" sub="审核 MCN 申请使用你的数字人形象 —— 用途、平台与时长逐项把关" />
      <InlineError message={error} onDismiss={() => setError(null)} />

      {!items ? (
        <LoadingList />
      ) : items.length === 0 ? (
        <EmptyState icon={Bot} title="暂无数字人授权申请" sub="MCN 提交数字人使用申请后将出现在这里。" />
      ) : (
        items.map((req, i) => {
          const usage = DH_USAGE_CFG[req.usageType];
          const isPending = req.status === "pending";
          return (
            <div
              key={req.id}
              className="star-card overflow-hidden"
              style={isPending
                ? { borderColor: `${ACCENT}33`, background: `${ACCENT}05` }
                : req.status === "approved"
                  ? { borderColor: "#16a34a33", background: "#16a34a05" }
                  : undefined}
            >
              <div className="p-4">
                <div className="flex items-start gap-3">
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${ACCENT}12`, border: `1px solid ${ACCENT}26` }}>
                    <Bot className="w-5 h-5" style={{ color: ACCENT }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold" style={{ color: "var(--ink-0)" }}>{req.mcnName}</span>
                      <Pill color={usage.color}>{usage.label}</Pill>
                      {req.status === "approved" && <Pill color="#16a34a" strong>已批准</Pill>}
                      {req.status === "rejected" && <Pill color="#dc2626" strong>已驳回</Pill>}
                      {isPending && <Pill color="#d97706" strong>待审核</Pill>}
                    </div>
                    <p className="text-xs mt-1.5" style={{ color: "var(--ink-1)" }}>{req.purpose}</p>
                    <div className="flex items-center gap-4 mt-1.5 text-[11px] flex-wrap" style={{ color: "var(--ink-2)" }}>
                      <span>平台：{req.platforms.join("、")}</span>
                      <span>授权期：{formatMonthsZh(req.durationMonths)}</span>
                      <span>{formatDateTime(req.requestedAt)}</span>
                    </div>
                  </div>
                </div>
                {req.riskNote && (
                  <div className="mt-3">
                    <NoteBox color="#d97706" icon={AlertCircle}>{req.riskNote}</NoteBox>
                  </div>
                )}
              </div>
              {isPending && (
                <CardActions>
                  <DangerGhostButton onClick={() => mutate(req.id, () => StarWorkbenchApi.rejectDigitalHuman(req.id))} busy={busyId === req.id}>
                    驳回
                  </DangerGhostButton>
                  <ActionButton color={ACCENT} icon={CheckCheck} onClick={() => mutate(req.id, () => StarWorkbenchApi.approveDigitalHuman(req.id))} busy={busyId === req.id}>
                    批准授权
                  </ActionButton>
                </CardActions>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
