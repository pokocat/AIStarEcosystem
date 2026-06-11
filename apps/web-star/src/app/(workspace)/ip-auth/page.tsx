"use client";

// IP 授权中心 — 4 类资产 × 6 状态机（明星录入 → 技术公司 → 火山引擎 → 激活）。

import * as React from "react";
import { motion } from "motion/react";
import {
  AlertCircle, ChevronRight, CloudUpload, FileText, Globe, Server, Star, Zap,
} from "lucide-react";
import type { StarIpAsset, StarIpAssetType } from "@ai-star-eco/types";
import { StarWorkbenchApi } from "@/api";
import { useStarShell } from "@/lib/star-shell-context";
import {
  IP_ASSET_TYPES, IP_AUTH_META, IP_NEXT_ACTION, IP_STATUS_CFG, IP_STATUS_ORDER, IP_STEP_COLORS,
} from "@/constants/star-ui";
import { PageHeader, LoadingList, InlineError } from "@/components/star/page-kit";

const RELAY_STEPS = [
  { icon: Star, label: "明星录入", color: "#f59e0b", desc: "上传授权文件/素材" },
  { icon: Server, label: "技术公司接收", color: "#6366f1", desc: "核验并处理数据包" },
  { icon: CloudUpload, label: "火山引擎部署", color: "#a855f7", desc: "部署AI模型至云端" },
  { icon: Zap, label: "系统激活", color: "#22c55e", desc: "创作者可开始带货创作" },
];

export default function IpAuthPage() {
  const { refreshOverview } = useStarShell();
  const [assets, setAssets] = React.useState<StarIpAsset[] | null>(null);
  const [expanded, setExpanded] = React.useState<StarIpAssetType | null>(null);
  const [busyType, setBusyType] = React.useState<StarIpAssetType | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    StarWorkbenchApi.listIpAssets().then(setAssets).catch((e) => setError(e instanceof Error ? e.message : "加载失败"));
  }, []);

  const advance = async (type: StarIpAssetType) => {
    setBusyType(type);
    setError(null);
    try {
      const updated = await StarWorkbenchApi.advanceIpAsset(type);
      setAssets((prev) => (prev ?? []).map((a) => (a.type === type ? updated : a)));
      void refreshOverview();
    } catch (e) {
      setError(e instanceof Error ? e.message : "操作失败");
    } finally {
      setBusyType(null);
    }
  };

  const expandedAsset = expanded ? assets?.find((a) => a.type === expanded) : null;
  const expandedMeta = expanded ? IP_AUTH_META[expanded] : null;

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-5xl">
      <PageHeader title="IP授权中心" sub="管理人像、切片、数字人等授权，传递至技术公司和火山引擎" />
      <InlineError message={error} onDismiss={() => setError(null)} />

      {/* 授权传递链路 */}
      <div className="star-card p-4" style={{ borderColor: "#6366f12b", background: "#6366f105" }}>
        <div className="flex items-center gap-1.5 mb-4">
          <Globe className="w-4 h-4" style={{ color: "#6366f1" }} />
          <span className="text-sm font-bold" style={{ color: "var(--ink-0)" }}>授权传递链路</span>
        </div>
        {/* <sm 2×2 网格（不横滑，序号标记顺序）；≥sm 横向链 + 虚线连接 */}
        <div className="grid grid-cols-2 gap-2 sm:flex sm:items-start sm:gap-2 sm:overflow-x-auto sm:scrollbar-thin sm:pb-1">
          {RELAY_STEPS.map((step, i) => {
            const StepIcon = step.icon;
            return (
              <React.Fragment key={step.label}>
                <div className="relative flex flex-col items-center text-center gap-1.5 sm:shrink-0 sm:min-w-[96px] rounded-xl p-2 sm:p-0" style={{ background: `${step.color}07` }}>
                  <span
                    className="sm:hidden absolute top-1.5 left-1.5 w-4 h-4 rounded-full text-[9px] font-bold flex items-center justify-center tabular"
                    style={{ background: `${step.color}14`, color: step.color }}
                  >
                    {i + 1}
                  </span>
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${step.color}12`, border: `1px solid ${step.color}33` }}>
                    <StepIcon className="w-5 h-5" style={{ color: step.color }} />
                  </div>
                  <span className="text-[11px] font-bold" style={{ color: "var(--ink-0)" }}>{step.label}</span>
                  <span className="text-[9px]" style={{ color: "var(--ink-2)" }}>{step.desc}</span>
                </div>
                {i < RELAY_STEPS.length - 1 && (
                  <div className="hidden sm:block flex-1 min-w-[20px] border-t border-dashed mt-5" style={{ borderColor: "var(--line-strong)" }} />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {!assets ? (
        <LoadingList rows={2} />
      ) : (
        <>
          {/* 4 资产卡 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {IP_ASSET_TYPES.map((type) => {
              const asset = assets.find((a) => a.type === type);
              if (!asset) return null;
              const meta = IP_AUTH_META[type];
              const Icon = meta.icon;
              const sc = IP_STATUS_CFG[asset.status];
              const StatusIcon = sc.icon;
              const isExpanded = expanded === type;
              const isActive = asset.status === "active";
              const curIdx = IP_STATUS_ORDER.indexOf(asset.status);
              return (
                <div
                  key={type}
                  className="star-card overflow-hidden"
                  style={{
                    borderColor: isExpanded ? `${meta.color}66` : isActive ? `${meta.color}40` : "var(--line)",
                    background: isExpanded ? `${meta.color}08` : "var(--bg-1)",
                  }}
                >
                  <button
                    onClick={() => setExpanded(isExpanded ? null : type)}
                    className="w-full flex flex-col items-center gap-2 p-4 pb-3 transition hover:bg-[var(--bg-2)]/50 text-center relative"
                  >
                    <ChevronRight
                      className="absolute top-2.5 right-2.5 w-3.5 h-3.5 transition-transform"
                      style={{ color: "var(--ink-2)", transform: isExpanded ? "rotate(90deg)" : "none" }}
                    />
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center mt-1" style={{ background: `${meta.color}12`, border: `1px solid ${meta.color}${isExpanded ? "55" : "30"}` }}>
                      <Icon className="w-5 h-5" style={{ color: meta.color }} />
                    </div>
                    <div className="text-xs font-bold leading-tight" style={{ color: "var(--ink-0)" }}>{meta.label}</div>
                    <span className="inline-flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full" style={{ background: `${sc.color}14`, color: sc.color, border: `1px solid ${sc.color}33` }}>
                      <StatusIcon className="w-2.5 h-2.5" />{sc.label}
                    </span>
                    {/* 6 段迷你进度 */}
                    <div className="w-full flex items-center gap-0.5 px-1">
                      {IP_STATUS_ORDER.map((s, si) => (
                        <div key={s} className="flex-1 h-1 rounded-full" style={{ background: si <= curIdx ? IP_STEP_COLORS[si] : "var(--bg-2)" }} />
                      ))}
                    </div>
                    <div className="text-[10px] tabular" style={{ color: "var(--ink-2)" }}>{asset.filesCount}/{asset.requiredFiles} 份文件</div>
                    {!isActive ? (
                      <span
                        role="button"
                        tabIndex={0}
                        onClick={(e) => { e.stopPropagation(); if (busyType !== type) void advance(type); }}
                        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); if (busyType !== type) void advance(type); } }}
                        className="w-full mt-0.5 py-1.5 max-sm:min-h-[40px] flex items-center justify-center rounded-lg text-[10px] max-sm:text-[11px] font-bold text-white transition hover:brightness-105 cursor-pointer"
                        style={{ background: meta.color, opacity: busyType === type ? 0.6 : 1 }}
                      >
                        {busyType === type ? "处理中…" : IP_NEXT_ACTION[asset.status]}
                      </span>
                    ) : (
                      <div className="w-full mt-0.5 py-1.5 max-sm:min-h-[40px] flex items-center justify-center rounded-lg text-[10px] max-sm:text-[11px] font-bold" style={{ background: `${meta.color}12`, color: meta.color }}>
                        ✓ 已激活
                      </div>
                    )}
                  </button>
                </div>
              );
            })}
          </div>

          {/* 展开详情面板 */}
          {expanded && expandedAsset && expandedMeta && (
              <motion.div
                key={expanded}
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                className="star-card overflow-hidden"
                style={{ borderColor: `${expandedMeta.color}40`, background: `${expandedMeta.color}05` }}
              >
                <div className="px-4 py-4 space-y-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    {(() => { const EIcon = expandedMeta.icon; return <EIcon className="w-4 h-4" style={{ color: expandedMeta.color }} />; })()}
                    <span className="text-sm font-bold" style={{ color: "var(--ink-0)" }}>{expandedMeta.label}</span>
                    <span className="text-[11px] ml-1" style={{ color: "var(--ink-2)" }}>{expandedMeta.desc}</span>
                    {expandedAsset.volcanoProjectId && (
                      <span className="text-[10px] font-mono ml-auto" style={{ color: "var(--ink-2)" }}>{expandedAsset.volcanoProjectId}</span>
                    )}
                  </div>
                  {expandedAsset.note && (
                    <div className="flex items-start gap-2 text-[11px] rounded-lg p-2.5" style={{ background: "#d977060d", border: "1px solid #d9770633", color: "#b45309" }}>
                      <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-px" />{expandedAsset.note}
                    </div>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* 所需文件 */}
                    <div className="rounded-xl p-3" style={{ background: "var(--bg-1)", border: "1px solid var(--line)" }}>
                      <div className="text-[11px] font-bold mb-2 flex items-center gap-1" style={{ color: "var(--ink-1)" }}>
                        <FileText className="w-3 h-3" />所需文件
                      </div>
                      <div className="space-y-1.5">
                        {expandedMeta.files.map((f, fi) => (
                          <div key={f} className="flex items-center gap-1.5 text-[11px]">
                            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: fi < expandedAsset.filesCount ? "var(--ok)" : "var(--line-strong)" }} />
                            <span style={{ color: fi < expandedAsset.filesCount ? "var(--ink-0)" : "var(--ink-2)" }}>{f}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    {/* 技术公司 / 火山引擎 */}
                    <div className="rounded-xl p-3 space-y-3" style={{ background: "var(--bg-1)", border: "1px solid var(--line)" }}>
                      <div>
                        <div className="text-[10px] mb-1 flex items-center gap-1" style={{ color: "var(--ink-2)" }}>
                          <Server className="w-2.5 h-2.5" />技术公司
                        </div>
                        <div className="text-[12px] font-semibold" style={{ color: "var(--ink-0)" }}>{expandedAsset.techCompany}</div>
                        <div className="text-[10px] mt-0.5" style={{ color: ["techReceived", "volcanoSync", "active"].includes(expandedAsset.status) ? "var(--ok)" : "var(--ink-2)" }}>
                          {["techReceived", "volcanoSync", "active"].includes(expandedAsset.status) ? "✓ 已接收" : "○ 未接收"}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] mb-1 flex items-center gap-1" style={{ color: "var(--ink-2)" }}>
                          <CloudUpload className="w-2.5 h-2.5" />火山引擎
                        </div>
                        {expandedAsset.volcanoProjectId ? (
                          <div className="text-[11px] font-mono" style={{ color: "#7e22ce" }}>{expandedAsset.volcanoProjectId}</div>
                        ) : (
                          <div className="text-[11px]" style={{ color: "var(--ink-2)" }}>待部署</div>
                        )}
                        <div className="text-[10px] mt-0.5" style={{ color: expandedAsset.status === "active" ? "var(--ok)" : expandedAsset.status === "volcanoSync" ? "var(--warn)" : "var(--ink-2)" }}>
                          {expandedAsset.status === "active" ? "— 已激活" : expandedAsset.status === "volcanoSync" ? "— 同步中" : "— 待推送"}
                        </div>
                      </div>
                      {expandedAsset.uploadedAt && (
                        <div className="text-[10px]" style={{ color: "var(--ink-2)" }}>
                          上传：{expandedAsset.uploadedAt}
                          {expandedAsset.activatedAt && ` · 激活：${expandedAsset.activatedAt}`}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
          )}
        </>
      )}
    </div>
  );
}
