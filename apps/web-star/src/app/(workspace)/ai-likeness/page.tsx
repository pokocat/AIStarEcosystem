"use client";

// AI 形象授权管理 — 声音 / 人脸 / 全身模型授权，风险三级分级处理。

import * as React from "react";
import { AlertCircle, CheckCheck, Sparkles } from "lucide-react";
import type { StarAiLikenessRequest } from "@ai-star-eco/types";
import { StarWorkbenchApi } from "@/api";
import { useStarShell } from "@/lib/star-shell-context";
import { AI_MODEL_CFG, RISK_LEVEL_CFG } from "@/constants/star-ui";
import { formatDateTime } from "@/lib/format";
import {
  ActionButton, DangerGhostButton, EmptyState, InlineError, LoadingList,
  NoteBox, PageHeader, Pill,
} from "@/components/star/page-kit";

const ACCENT = "#ec4899";

export default function AiLikenessPage() {
  const { refreshOverview } = useStarShell();
  const [items, setItems] = React.useState<StarAiLikenessRequest[] | null>(null);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    StarWorkbenchApi.listAiLikenessRequests()
      .then(setItems)
      .catch((e) => setError(e instanceof Error ? e.message : "加载失败"));
  }, []);

  const mutate = async (id: string, fn: () => Promise<StarAiLikenessRequest>) => {
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
    <div className="p-6 space-y-4 max-w-5xl">
      <PageHeader title="AI形象授权管理" sub="审核 AI 声音 / 人脸 / 全身形象申请，按低中高三级风险分级处理" />
      <InlineError message={error} onDismiss={() => setError(null)} />

      <NoteBox color={ACCENT} icon={AlertCircle}>
        AI 形象授权为高敏感业务：低风险自动留痕，中风险经纪团队人工审，高风险建议咨询法律顾问并补签专项协议后再决策。
      </NoteBox>

      {!items ? (
        <LoadingList />
      ) : items.length === 0 ? (
        <EmptyState icon={Sparkles} title="暂无 AI 形象授权申请" sub="MCN 提交 AI 声音 / 人脸 / 全身形象使用申请后将出现在这里。" />
      ) : (
        items.map((req, i) => {
          const model = AI_MODEL_CFG[req.modelType];
          const risk = RISK_LEVEL_CFG[req.riskLevel];
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
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${model.color}12`, border: `1px solid ${model.color}30` }}>
                    <span className="text-[10px] font-black" style={{ color: model.color }}>{model.abbr}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold" style={{ color: "var(--ink-0)" }}>{req.mcnName}</span>
                      <Pill color={model.color}>{model.label}</Pill>
                      <Pill color={risk.color} strong>{risk.label}</Pill>
                      {req.status === "approved" && <Pill color="#16a34a" strong>已批准</Pill>}
                      {req.status === "rejected" && <Pill color="#dc2626" strong>已驳回</Pill>}
                    </div>
                    <p className="text-xs mt-1.5" style={{ color: "var(--ink-1)" }}>{req.purpose}</p>
                    <div className="flex items-center gap-4 mt-1.5 text-[11px] flex-wrap" style={{ color: "var(--ink-2)" }}>
                      <span>AI 厂商：{req.aiVendor}</span>
                      <span>{req.platforms.join("、")}</span>
                      <span>{formatDateTime(req.requestedAt)}</span>
                    </div>
                  </div>
                </div>
                {req.riskLevel === "high" && isPending && (
                  <div className="mt-3">
                    <NoteBox color="#dc2626" icon={AlertCircle}>
                      高风险申请：建议驳回，或要求对方签署专项授权协议并由明星本人确认后再批准。
                    </NoteBox>
                  </div>
                )}
              </div>
              {isPending && (
                <div className="flex justify-end gap-2 px-4 pb-3 pt-2.5" style={{ borderTop: "1px solid var(--line)" }}>
                  <DangerGhostButton onClick={() => mutate(req.id, () => StarWorkbenchApi.rejectAiLikeness(req.id))} busy={busyId === req.id}>
                    驳回
                  </DangerGhostButton>
                  <ActionButton
                    color={req.riskLevel === "high" ? "#dc2626" : ACCENT}
                    icon={CheckCheck}
                    onClick={() => mutate(req.id, () => StarWorkbenchApi.approveAiLikeness(req.id))}
                    busy={busyId === req.id}
                  >
                    {req.riskLevel === "high" ? "强制批准（慎）" : "批准授权"}
                  </ActionButton>
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
