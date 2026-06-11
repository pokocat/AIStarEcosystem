"use client";

// 内容授权规则 — 绿/黄/橙/红四区规则启停（所有审核动作的策略来源）。

import * as React from "react";
import { motion } from "motion/react";
import { Shield, TriangleAlert } from "lucide-react";
import type { StarContentRule } from "@ai-star-eco/types";
import { StarWorkbenchApi } from "@/api";
import { ZONE_COLORS, ZONE_LABELS } from "@/constants/star-ui";
import { EmptyState, InlineError, LoadingList, NoteBox, PageHeader, Pill } from "@/components/star/page-kit";

export default function RulesPage() {
  const [rules, setRules] = React.useState<StarContentRule[] | null>(null);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    StarWorkbenchApi.listContentRules()
      .then(setRules)
      .catch((e) => setError(e instanceof Error ? e.message : "加载失败"));
  }, []);

  const toggle = async (id: string) => {
    setBusyId(id);
    setError(null);
    try {
      const updated = await StarWorkbenchApi.toggleContentRule(id);
      setRules((prev) => (prev ?? []).map((r) => (r.id === id ? updated : r)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "操作失败");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="p-4 sm:p-6 space-y-4 max-w-5xl">
      <PageHeader title="内容授权规则" sub="绿 / 黄 / 橙 / 红四区策略，决定哪些内容自动放行、人工审或禁止" />
      <InlineError message={error} onDismiss={() => setError(null)} />

      <NoteBox color="#d97706" icon={TriangleAlert}>
        以下规则将应用于所有持有你授权协议的 MCN 账号。修改后立即生效（已审项不回溯），规则改动会写入审计日志。
      </NoteBox>

      {!rules ? (
        <LoadingList />
      ) : rules.length === 0 ? (
        <EmptyState icon={Shield} title="暂无规则" />
      ) : (
        <div className="space-y-3">
          {rules.map((rule) => {
            const zc = ZONE_COLORS[rule.zone];
            return (
              <div key={rule.id} className="star-card star-card-hover flex items-center gap-4 p-4">
                <span className="w-9 h-9 rounded-xl shrink-0 flex items-center justify-center" style={{ background: `${zc}14`, border: `1px solid ${zc}33` }}>
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: zc }} />
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold" style={{ color: "var(--ink-0)" }}>{rule.name}</span>
                    <Pill color={zc}>{ZONE_LABELS[rule.zone]}</Pill>
                  </div>
                  <div className="text-[11px] mt-0.5 leading-relaxed" style={{ color: "var(--ink-1)" }}>{rule.description}</div>
                </div>
                <button
                  onClick={() => toggle(rule.id)}
                  disabled={busyId === rule.id}
                  className="relative w-11 h-6 rounded-full transition-colors shrink-0 disabled:opacity-60 touch-hit"
                  style={{ background: rule.enabled ? "var(--ok)" : "var(--line-strong)" }}
                  aria-label={`${rule.enabled ? "停用" : "启用"}${rule.name}`}
                >
                  <motion.span
                    className="absolute top-0.5 w-5 h-5 bg-white rounded-full shadow"
                    animate={{ left: rule.enabled ? 22 : 2 }}
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                  />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
