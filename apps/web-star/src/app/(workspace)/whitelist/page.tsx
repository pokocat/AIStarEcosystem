"use client";

// 报白账号授权 — 审核 MCN 提交的切片账号报白申请（5 步推进 + 报白参数一键复制）。

import * as React from "react";
import {
  CheckCheck, CheckCircle2, ChevronRight, Copy, Fingerprint, Hash, Phone,
  RefreshCw, Send, Users, BadgeCheck,
} from "lucide-react";
import type { StarWhitelistRequest } from "@ai-star-eco/types";
import { StarWorkbenchApi } from "@/api";
import { useStarShell } from "@/lib/star-shell-context";
import {
  PLATFORM_FILTERS, WL_STATUS, WL_STATUS_FILTERS, WL_STEPS, getPlatformAbbr, getPlatformColor,
} from "@/constants/star-ui";
import { formatDateTime, formatMonthsZh, formatWan } from "@/lib/format";
import {
  ActionButton, CardActions, DangerGhostButton, EmptyState, FilterChip, InlineError,
  LoadingList, PageHeader, Pill,
} from "@/components/star/page-kit";

export default function WhitelistPage() {
  const { refreshOverview } = useStarShell();
  const [items, setItems] = React.useState<StarWhitelistRequest[] | null>(null);
  const [platformFilter, setPlatformFilter] = React.useState<string>("all");
  const [statusFilter, setStatusFilter] = React.useState<string>("all");
  const [copiedId, setCopiedId] = React.useState<string | null>(null);
  const [autoCopied, setAutoCopied] = React.useState<string | null>(null);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    StarWorkbenchApi.listWhitelistRequests()
      .then(setItems)
      .catch((e) => setError(e instanceof Error ? e.message : "加载失败"));
  }, []);

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopiedId(key);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const copyAllParams = (req: StarWhitelistRequest) => {
    navigator.clipboard
      .writeText(`【${req.platform} 报白参数】\n账号ID：${req.accountId}\n手机号：${req.phone}\nUID：${req.uid}`)
      .catch(() => {});
    setAutoCopied(req.id);
    setTimeout(() => setAutoCopied(null), 3000);
  };

  const mutate = async (id: string, fn: () => Promise<StarWhitelistRequest>) => {
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

  const all = items ?? [];
  const filtered = all
    .filter((r) => platformFilter === "all" || r.platform === platformFilter)
    .filter((r) => statusFilter === "all" || r.status === statusFilter);

  return (
    <div className="p-4 sm:p-6 space-y-4 max-w-5xl">
      <PageHeader title="报白账号授权" sub="审核 MCN 提交的切片账号报白申请，按 5 步流程推进至平台授权" />
      <InlineError message={error} onDismiss={() => setError(null)} />

      {/* 双筛选条 */}
      <div className="star-card p-3 space-y-2.5">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold shrink-0 w-10" style={{ color: "var(--ink-2)" }}>平台</span>
          <div className="flex items-center gap-1.5 flex-wrap">
            {PLATFORM_FILTERS.map((p) => (
              <FilterChip
                key={p.id}
                active={platformFilter === p.id}
                color={p.color}
                label={p.label}
                count={p.id === "all" ? all.length : all.filter((r) => r.platform === p.id).length}
                onClick={() => setPlatformFilter(p.id)}
              />
            ))}
          </div>
        </div>
        <div className="h-px" style={{ background: "var(--line)" }} />
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold shrink-0 w-10" style={{ color: "var(--ink-2)" }}>状态</span>
          <div className="flex items-center gap-1.5 flex-wrap">
            {WL_STATUS_FILTERS.map((s) => (
              <FilterChip
                key={s.id}
                active={statusFilter === s.id}
                color={s.color}
                label={s.label}
                icon={s.icon}
                count={s.id === "all" ? all.length : all.filter((r) => r.status === s.id).length}
                onClick={() => setStatusFilter(s.id)}
              />
            ))}
          </div>
        </div>
      </div>

      {/* 流程图例 */}
      <div className="flex items-center gap-2 px-1 overflow-x-auto scrollbar-thin pb-1">
        {WL_STEPS.map((step, i) => (
          <React.Fragment key={step.id}>
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="w-2 h-2 rounded-full" style={{ background: step.color }} />
              <span className="text-[11px]" style={{ color: step.color }}>{step.label}</span>
            </div>
            {i < WL_STEPS.length - 1 && <ChevronRight className="w-3 h-3 shrink-0" style={{ color: "var(--ink-2)" }} />}
          </React.Fragment>
        ))}
      </div>

      {!items ? (
        <LoadingList />
      ) : filtered.length === 0 ? (
        <EmptyState icon={BadgeCheck} title="没有符合筛选的报白申请" sub="调整上方平台 / 状态筛选，或等待 MCN 提交新的账号报白。" />
      ) : (
        filtered.map((req, i) => {
          const cfg = WL_STATUS[req.status];
          const CfgIcon = cfg.icon;
          const stepIdx = WL_STEPS.findIndex((s) => s.id === req.whitelistStep);
          const stepCfg = WL_STEPS[stepIdx];
          const isPending = req.status === "pending";
          const isAuthorized = req.whitelistStep === "authorized";
          const pAbbr = getPlatformAbbr(req.platform);
          const pColor = getPlatformColor(req.platform);
          return (
            <div
              key={req.id}
              className="star-card overflow-hidden"
              style={isPending
                ? { borderColor: "#d9770633", background: "#d9770605" }
                : isAuthorized
                  ? { borderColor: "#16a34a33", background: "#16a34a05" }
                  : undefined}
            >
              <div className="flex items-start gap-3 p-4">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${pColor}10`, border: `1px solid ${pColor}26` }}>
                  <span className="text-[11px] font-black" style={{ color: pColor }}>{pAbbr}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold" style={{ color: "var(--ink-0)" }}>{req.accountHandle}</span>
                    <Pill color={pColor}>{req.platform}</Pill>
                    {/* <sm：状态 pill 内联展示（右列已隐藏） */}
                    <span className="sm:hidden inline-flex items-center gap-1">
                      {isAuthorized
                        ? <Pill color="#16a34a" icon={CheckCircle2} strong>授权成功</Pill>
                        : <Pill color={cfg.color} icon={CfgIcon} strong>{cfg.label}</Pill>}
                    </span>
                    <span className="text-[11px]" style={{ color: "var(--ink-2)" }}>{req.mcnName}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: "var(--bg-2)", color: "var(--ink-1)" }}>{req.mcnLevel} · 信用 {req.creditScore}</span>
                  </div>

                  {/* 报白参数（待审且第一步时高亮 + 一键复制） */}
                  <div
                    className={`mt-2 rounded-lg ${isPending && stepIdx === 0 ? "p-2.5 -mx-1" : ""}`}
                    style={isPending && stepIdx === 0 ? { background: "#0891b20a", border: "1px solid #0891b22e" } : {}}
                  >
                    {isPending && stepIdx === 0 && (
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[10px] flex items-center gap-1" style={{ color: "#0891b2" }}>
                          <Send className="w-2.5 h-2.5" />点击「联系平台」时自动复制以下参数
                        </span>
                        <button
                          onClick={(e) => { e.stopPropagation(); copyAllParams(req); }}
                          className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold transition hover:brightness-95"
                          style={{ background: "#0891b212", color: "#0891b2", border: "1px solid #0891b233" }}
                        >
                          <Copy className="w-2.5 h-2.5" />一键全复制
                        </button>
                      </div>
                    )}
                    {autoCopied === req.id && (
                      <div
                        className="flex items-center gap-1.5 mb-1.5 text-[10px] font-bold animate-in fade-in slide-in-from-top-1 duration-200"
                        style={{ color: "var(--ok)" }}
                      >
                        <CheckCheck className="w-3 h-3" />已复制报白参数
                      </div>
                    )}
                    <div className="flex items-center gap-3 flex-wrap">
                      {[
                        { icon: Hash, label: "账号ID", value: req.accountId, ck: `id-${req.id}` },
                        { icon: Phone, label: "手机号", value: req.phone, ck: `ph-${req.id}` },
                        { icon: Fingerprint, label: "UID", value: req.uid, ck: `uid-${req.id}` },
                      ].map(({ icon: Icon, label, value, ck }) => (
                        <button key={ck} onClick={() => copyToClipboard(value, ck)} className="flex items-center gap-1 py-1.5 -my-1 group transition hover:opacity-75">
                          <Icon className="w-2.5 h-2.5" style={{ color: "var(--ink-2)" }} />
                          <span className="text-[10px]" style={{ color: "var(--ink-2)" }}>{label}:</span>
                          <span className="text-[11px] font-mono" style={{ color: isPending && stepIdx === 0 ? "#0e7490" : "var(--ink-1)" }}>{value}</span>
                          {/* 触屏无 hover：<sm 常显复制图标提示可点 */}
                          {copiedId === ck
                            ? <CheckCheck className="w-2.5 h-2.5" style={{ color: "var(--ok)" }} />
                            : <Copy className="w-2.5 h-2.5 opacity-50 sm:opacity-0 sm:group-hover:opacity-100 transition" style={{ color: "var(--ink-2)" }} />}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 mt-1.5 text-[11px] flex-wrap" style={{ color: "var(--ink-1)" }}>
                    <span className="flex items-center gap-0.5"><Users className="w-2.5 h-2.5" />{formatWan(req.fans)}粉</span>
                    <span>账号龄：{formatMonthsZh(req.accountAgeMonths)}</span>
                    <span>均播：{formatWan(req.avgViews)}</span>
                    <span>近30天 {req.recentVideos} 条</span>
                    <span>{formatDateTime(req.requestedAt)}</span>
                  </div>

                  {/* 5 步进度 */}
                  {(isPending || isAuthorized) && (
                    <div className="mt-3 flex gap-1 items-center">
                      {WL_STEPS.map((step, si) => {
                        const done = si < stepIdx || isAuthorized;
                        const current = si === stepIdx && !isAuthorized;
                        return (
                          <React.Fragment key={step.id}>
                            <div className="flex flex-col items-center gap-0.5 flex-1">
                              <div
                                className="w-full h-1 rounded-full"
                                style={{ background: done ? step.color : current ? `${step.color}80` : "var(--bg-2)" }}
                              />
                              <span
                                className="text-[9px] text-center truncate w-full"
                                style={{ color: done ? step.color : current ? "var(--ink-0)" : "var(--ink-2)", fontWeight: current ? 700 : 400 }}
                              >
                                {step.label}
                              </span>
                            </div>
                            {si < WL_STEPS.length - 1 && <div className="w-1.5 h-px shrink-0 mb-2" style={{ background: "var(--line)" }} />}
                          </React.Fragment>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="hidden sm:flex flex-col items-end gap-2 shrink-0">
                  {isAuthorized ? (
                    <Pill color="#16a34a" icon={CheckCircle2} strong>授权成功</Pill>
                  ) : (
                    <Pill color={cfg.color} icon={CfgIcon} strong>{cfg.label}</Pill>
                  )}
                  {isPending && <Pill color={stepCfg.color}>{stepCfg.label}</Pill>}
                </div>
              </div>

              {isPending && (
                <CardActions
                  hintColor="var(--ink-2)"
                  hint={
                    <>
                      {stepIdx === 0 && "点击「开始联系平台」报白，参数将自动复制"}
                      {stepIdx === 1 && "已联系平台，等待平台下发短信验证码"}
                      {stepIdx === 2 && "验证码已下发，等待达人确认"}
                      {stepIdx === 3 && "平台报白审核中，通过后确认授权"}
                    </>
                  }
                >
                  <DangerGhostButton onClick={() => mutate(req.id, () => StarWorkbenchApi.rejectWhitelistRequest(req.id))} busy={busyId === req.id}>
                    驳回
                  </DangerGhostButton>
                  <ActionButton
                    color={stepCfg.color}
                    icon={stepIdx === 0 ? Send : stepIdx === 1 ? RefreshCw : stepIdx === 2 ? Phone : CheckCheck}
                    busy={busyId === req.id}
                    onClick={() => {
                      if (stepIdx === 0) copyAllParams(req);
                      void mutate(req.id, () => StarWorkbenchApi.advanceWhitelistRequest(req.id));
                    }}
                  >
                    {stepCfg.action}
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
