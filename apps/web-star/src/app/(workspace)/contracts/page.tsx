"use client";

// 合同中心 — 授权合同 / 补充协议 / 结算单据管理，到期提醒。

import * as React from "react";
import { Calendar, Download, Eye, FileText, Search } from "lucide-react";
import type { StarContract } from "@ai-star-eco/types";
import { StarWorkbenchApi } from "@/api";
import { CONTRACT_STATUS_CFG, CONTRACT_TYPE_CFG } from "@/constants/star-ui";
import { formatDate, formatWanYuan } from "@/lib/format";
import { EmptyState, GhostButton, InlineError, LoadingList, PageHeader, Pill } from "@/components/star/page-kit";

type TypeFilter = "all" | "authorization" | "amendment" | "settlement";
type StatusFilter = "all" | "active" | "expired" | "pending" | "terminated";

export default function ContractsPage() {
  const [contracts, setContracts] = React.useState<StarContract[] | null>(null);
  const [typeFilter, setTypeFilter] = React.useState<TypeFilter>("all");
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>("all");
  const [query, setQuery] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    StarWorkbenchApi.listContracts()
      .then(setContracts)
      .catch((e) => setError(e instanceof Error ? e.message : "加载失败"));
  }, []);

  const all = contracts ?? [];
  const filtered = all.filter((c) => {
    const matchType = typeFilter === "all" || c.type === typeFilter;
    const matchStatus = statusFilter === "all" || c.status === statusFilter;
    const q = query.trim().toLowerCase();
    const matchQuery = !q || c.title.toLowerCase().includes(q) || c.mcnName.toLowerCase().includes(q) || c.ipName.toLowerCase().includes(q);
    return matchType && matchStatus && matchQuery;
  });

  const stats = [
    { label: "合同总数", value: all.length, color: "var(--ink-0)" },
    { label: "生效中", value: all.filter((c) => c.status === "active").length, color: "#16a34a" },
    { label: "待签署", value: all.filter((c) => c.status === "pending").length, color: "#d97706" },
    { label: "已过期", value: all.filter((c) => c.status === "expired").length, color: "#78716c" },
  ];

  const expiringSoon = all.filter((c) => {
    if (c.status !== "active") return false;
    const end = new Date(c.endDate).getTime();
    const days = (end - Date.now()) / 86_400_000;
    return days >= 0 && days <= 30;
  }).length;

  const selectStyle: React.CSSProperties = {
    background: "var(--bg-1)",
    border: "1px solid var(--line-strong)",
    color: "var(--ink-0)",
  };

  return (
    <div className="p-4 sm:p-6 space-y-4 max-w-5xl">
      <PageHeader title="合同中心" sub="管理 IP 授权合同、补充协议和结算单据" />
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

      {/* 搜索 + 筛选 */}
      <div className="flex flex-col md:flex-row gap-2.5">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "var(--ink-2)" }} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索合同标题、MCN 或 IP 名称…"
            className="w-full h-10 pl-9 pr-3 rounded-xl text-sm outline-none"
            style={selectStyle}
          />
        </div>
        <div className="flex gap-2">
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as TypeFilter)} className="h-10 px-3 rounded-xl text-sm outline-none flex-1 md:flex-none min-w-0" style={selectStyle}>
            <option value="all">全部类型</option>
            <option value="authorization">授权合同</option>
            <option value="amendment">补充协议</option>
            <option value="settlement">结算单</option>
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as StatusFilter)} className="h-10 px-3 rounded-xl text-sm outline-none flex-1 md:flex-none min-w-0" style={selectStyle}>
            <option value="all">全部状态</option>
            <option value="active">生效中</option>
            <option value="pending">待签署</option>
            <option value="expired">已过期</option>
            <option value="terminated">已终止</option>
          </select>
        </div>
      </div>

      {!contracts ? (
        <LoadingList />
      ) : filtered.length === 0 ? (
        <EmptyState icon={FileText} title="暂无符合条件的合同" sub="调整筛选条件或清空搜索关键词。" />
      ) : (
        <div className="space-y-3">
          {filtered.map((contract, i) => {
            const typeCfg = CONTRACT_TYPE_CFG[contract.type];
            const statusCfg = CONTRACT_STATUS_CFG[contract.status];
            const TypeIcon = typeCfg.icon;
            return (
              <div
                key={contract.id}
                className="star-card star-card-hover p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2.5">
                      <div className="p-2 rounded-lg shrink-0" style={{ background: `${typeCfg.color}12` }}>
                        <TypeIcon className="w-4 h-4" style={{ color: typeCfg.color }} />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                          <h3 className="text-sm font-semibold truncate" style={{ color: "var(--ink-0)" }}>{contract.title}</h3>
                          <Pill color={statusCfg.color}>{statusCfg.label}</Pill>
                        </div>
                        <div className="text-[11px]" style={{ color: "var(--ink-2)" }}>
                          <span className="font-mono">{contract.id}</span>
                          <span className="mx-2">|</span>
                          {typeCfg.label}
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                      <div>
                        <div className="text-[10px] mb-0.5" style={{ color: "var(--ink-2)" }}>MCN 机构</div>
                        <div className="text-xs" style={{ color: "#0891b2" }}>{contract.mcnName}</div>
                      </div>
                      <div>
                        <div className="text-[10px] mb-0.5" style={{ color: "var(--ink-2)" }}>涉及 IP</div>
                        <div className="text-xs" style={{ color: "#9333ea" }}>{contract.ipName}</div>
                      </div>
                      <div>
                        <div className="text-[10px] mb-0.5" style={{ color: "var(--ink-2)" }}>合同期限</div>
                        <div className="text-xs tabular" style={{ color: "var(--ink-0)" }}>
                          {formatDate(contract.startDate)} ~ {formatDate(contract.endDate)}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] mb-0.5" style={{ color: "var(--ink-2)" }}>合同金额</div>
                        <div className="text-xs font-bold tabular" style={{ color: "var(--ok)" }}>{formatWanYuan(contract.amountCents)}</div>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button className="p-2 rounded-lg transition hover:bg-[var(--bg-2)]" title="查看合同" aria-label="查看合同">
                      <Eye className="w-4 h-4" style={{ color: "var(--ink-2)" }} />
                    </button>
                    <button className="p-2 rounded-lg transition hover:bg-[var(--bg-2)]" title="下载合同" aria-label="下载合同">
                      <Download className="w-4 h-4" style={{ color: "var(--ink-2)" }} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 到期提醒 + 模板库 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="star-card p-5" style={{ background: "linear-gradient(135deg, #9333ea08, #0891b208)" }}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold" style={{ color: "var(--ink-0)" }}>到期提醒</h3>
              <p className="text-xs mt-0.5" style={{ color: "var(--ink-1)" }}>30 天内到期合同：{expiringSoon} 份</p>
            </div>
            <GhostButton><Calendar className="w-3.5 h-3.5" />查看</GhostButton>
          </div>
        </div>
        <div className="star-card p-5" style={{ background: "linear-gradient(135deg, #0891b208, #9333ea08)" }}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold" style={{ color: "var(--ink-0)" }}>合同模板库</h3>
              <p className="text-xs mt-0.5" style={{ color: "var(--ink-1)" }}>标准合同模板和条款库</p>
            </div>
            <GhostButton><FileText className="w-3.5 h-3.5" />访问</GhostButton>
          </div>
        </div>
      </div>
    </div>
  );
}
