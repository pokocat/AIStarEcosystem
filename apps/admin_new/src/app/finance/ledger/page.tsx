"use client";

import * as React from "react";
import { Wallet as WalletIcon, TrendingUp, ArrowUpRight } from "lucide-react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { Toolbar, FilterChip } from "@/components/shared/Toolbar";
import { Section } from "@/components/shared/Section";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { StatCard } from "@/components/shared/StatCard";
import { mapTone } from "@/components/shared/tone";
import { useAsyncList } from "@/components/shared/useAsyncList";
import { listTransactions, getMonthlyRevenue } from "@/api/finance";
import { listWallets, listLedgerEntries } from "@/api/wallet";
import { TRANSACTION_STATUS, LEDGER_ENTRY_TYPE } from "@/constants/status";
import { formatCompactNumber, formatCredits, formatSignedCredits } from "@/lib/format";
import type { Transaction } from "@/types/finance";
import type { LedgerEntry, Wallet } from "@/types/wallet";

const STATUS_OPTIONS = [
  { value: "all",        label: "全部" },
  { value: "completed",  label: "已到账" },
  { value: "processing", label: "处理中" },
  { value: "pending",    label: "待复核" },
];

const TAB_OPTIONS = ["流水", "钱包快照", "点数账目"] as const;

export default function LedgerPage() {
  const [tab, setTab] = React.useState<typeof TAB_OPTIONS[number]>("流水");
  const tx = useAsyncList(() => listTransactions(0, 50));
  const monthly = useAsyncList(() => getMonthlyRevenue());
  const wallets = useAsyncList(() => listWallets(0, 100));
  const ledger = useAsyncList(() => listLedgerEntries(undefined, undefined, 0, 100));

  const totalIncome = tx.data.filter((t) => t.amount > 0 && t.status === "completed").reduce((s, t) => s + t.amount, 0);
  const totalOut = tx.data.filter((t) => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);
  const pending = tx.data.filter((t) => t.status !== "completed").length;

  return (
    <>
      <PageHeader
        title="结算中心"
        description="钱包快照 / 账目流水 / 业务交易 · 所有金额单位：credits 原始整数"
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <StatCard icon={WalletIcon} label="钱包总额" value={formatCredits(wallets.data.reduce((s, w) => s + w.totalBalance, 0))} tone="primary" />
        <StatCard icon={TrendingUp} label="本月入账" value={formatCredits(monthly.data.at(-1)?.revenue ?? 0)} tone="emerald" />
        <StatCard icon={ArrowUpRight} label="累计入账" value={formatCredits(totalIncome)} tone="violet" />
        <StatCard label="待复核流水" value={pending} tone={pending > 0 ? "amber" : "emerald"} />
      </div>

      <Section className="mb-4" title="月度净收入曲线" description="近 6 个月">
        <div className="h-[220px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={monthly.data} margin={{ top: 10, right: 8, left: -8, bottom: 0 }}>
              <defs>
                <linearGradient id="revGrad2" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-chart-2)" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="var(--color-chart-2)" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="var(--color-muted-foreground)" />
              <YAxis tickFormatter={(v) => formatCompactNumber(v as number)} tick={{ fontSize: 12 }} stroke="var(--color-muted-foreground)" />
              <Tooltip formatter={(v) => formatCredits(v as number)} contentStyle={{ borderRadius: 8, borderColor: "var(--color-border)", fontSize: 12 }} />
              <Area type="monotone" dataKey="revenue" stroke="var(--color-chart-2)" strokeWidth={2} fill="url(#revGrad2)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Section>

      <div className="flex items-center gap-1 border-b border-border mb-3">
        {TAB_OPTIONS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-2 -mb-px border-b-2 text-sm transition-colors ${
              tab === t
                ? "border-primary text-primary font-medium"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "流水" && <TransactionTable rows={tx.data} />}
      {tab === "钱包快照" && <WalletSnapshot rows={wallets.data} totalOut={totalOut} />}
      {tab === "点数账目" && <LedgerTable rows={ledger.data} />}
    </>
  );
}

function TransactionTable({ rows }: { rows: Transaction[] }) {
  const [q, setQ] = React.useState("");
  const [status, setStatus] = React.useState("all");

  const filtered = rows.filter((t) => {
    if (status !== "all" && t.status !== status) return false;
    if (q && !t.source.includes(q)) return false;
    return true;
  });

  const columns: Column<Transaction>[] = [
    { key: "source", header: "交易", render: (t) => (
      <div className="min-w-0">
        <div className="font-medium truncate">{t.source}</div>
        <div className="text-xs text-muted-foreground">用户 {t.userId ?? "—"}</div>
      </div>
    )},
    { key: "amount", header: "金额", align: "right",
      render: (t) => (
        <span className={`tabular-nums font-medium ${t.amount >= 0 ? "text-success" : "text-destructive"}`}>
          {formatSignedCredits(t.amount)}
        </span>
      ),
    },
    { key: "date",    header: "日期", render: (t) => <span className="text-muted-foreground">{t.date}</span> },
    { key: "status", header: "状态",
      render: (t) => {
        const s = TRANSACTION_STATUS[t.status];
        return s ? <StatusBadge tone={mapTone(s.tone)} label={s.label} /> : null;
      },
    },
  ];

  return (
    <>
      <Toolbar search={q} onSearchChange={setQ} searchPlaceholder="按来源搜索" className="mb-3">
        <FilterChip label="状态" value={status} options={STATUS_OPTIONS} onChange={setStatus} />
      </Toolbar>
      <DataTable<Transaction> columns={columns} rows={filtered} rowKey={(r) => r.id} />
    </>
  );
}

function WalletSnapshot({ rows, totalOut }: { rows: Wallet[]; totalOut: number }) {
  const columns: Column<Wallet>[] = [
    { key: "user", header: "用户 ID", render: (w) => <span className="font-mono text-xs">{w.userId}</span> },
    { key: "total",    header: "总余额", align: "right", render: (w) => <span className="tabular-nums font-semibold">{formatCredits(w.totalBalance)}</span> },
    { key: "license",  header: "秘钥",   align: "right", render: (w) => <span className="tabular-nums">{formatCredits(w.licenseBalance)}</span> },
    { key: "recharge", header: "充值",   align: "right", render: (w) => <span className="tabular-nums">{formatCredits(w.rechargeBalance)}</span> },
    { key: "gift",     header: "赠送",   align: "right", render: (w) => <span className="tabular-nums">{formatCredits(w.giftBalance)}</span> },
    { key: "pending",  header: "待入账", align: "right", render: (w) => <span className="tabular-nums text-amber-700">{formatCredits(w.pendingBalance)}</span> },
    { key: "updated",  header: "最后更新", render: (w) => <span className="text-muted-foreground text-xs">{w.updatedAt.slice(0, 10)}</span> },
  ];

  return (
    <>
      <div className="grid grid-cols-3 gap-3 mb-3">
        <StatCard label="累计出账" value={formatCredits(totalOut)} tone="rose" />
        <StatCard label="钱包数量" value={rows.length} tone="primary" />
        <StatCard label="待入账合计" value={formatCredits(rows.reduce((s, w) => s + w.pendingBalance, 0))} tone="amber" />
      </div>
      <DataTable<Wallet> columns={columns} rows={rows} rowKey={(w) => w.id} />
    </>
  );
}

function LedgerTable({ rows }: { rows: LedgerEntry[] }) {
  const columns: Column<LedgerEntry>[] = [
    { key: "type", header: "类型",
      render: (r) => {
        const m = LEDGER_ENTRY_TYPE[r.type];
        return m ? <StatusBadge tone={mapTone(m.tone)} label={m.label} dot={false} /> : null;
      },
    },
    { key: "desc", header: "描述", render: (r) => <span>{r.description}</span> },
    { key: "amt", header: "金额", align: "right",
      render: (r) => (
        <span className={`tabular-nums font-medium ${r.amount >= 0 ? "text-success" : "text-destructive"}`}>
          {formatSignedCredits(r.amount)}
        </span>
      ),
    },
    { key: "bal", header: "余额", align: "right", render: (r) => <span className="tabular-nums text-muted-foreground">{formatCredits(r.balanceAfter)}</span> },
    { key: "ref", header: "关联", render: (r) => <span className="font-mono text-xs text-muted-foreground">{r.referenceType ?? "—"} / {r.referenceId ?? "—"}</span> },
    { key: "time", header: "时间", render: (r) => <span className="text-muted-foreground text-xs">{r.createdAt.slice(0, 16).replace("T", " ")}</span> },
  ];

  return <DataTable<LedgerEntry> columns={columns} rows={rows} rowKey={(r) => r.id} />;
}
