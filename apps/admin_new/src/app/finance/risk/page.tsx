"use client";

import * as React from "react";
import { AlertTriangle, ShieldAlert } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { Section } from "@/components/shared/Section";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { StatCard } from "@/components/shared/StatCard";
import { mapTone } from "@/components/shared/tone";
import { useAsyncList } from "@/components/shared/useAsyncList";
import { listTransactions } from "@/api/finance";
import { listLedgerEntries } from "@/api/wallet";
import { TRANSACTION_STATUS } from "@/constants/status";
import { formatSignedCredits } from "@/lib/format";
import type { Transaction } from "@/types/finance";
import type { LedgerEntry } from "@/types/wallet";

const LARGE_THRESHOLD = 30_000;

export default function RiskPage() {
  const tx = useAsyncList(() => listTransactions(0, 100));
  const ledger = useAsyncList(() => listLedgerEntries(undefined, undefined, 0, 100));

  const unusual = tx.data.filter((t) => t.status !== "completed" || Math.abs(t.amount) >= LARGE_THRESHOLD);
  const largeWithdraws = ledger.data.filter((e) => e.type === "withdraw" && Math.abs(e.amount) >= LARGE_THRESHOLD);
  const adjusts = ledger.data.filter((e) => e.type === "adjust" || e.type === "freeze");

  return (
    <>
      <PageHeader
        title="异常风控"
        description="大额流水 / 频繁调账 / 处理中未到账 · 用于人工介入排查"
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <StatCard icon={AlertTriangle} label="异常交易" value={unusual.length} tone="rose" />
        <StatCard label="大额提现" value={largeWithdraws.length} tone="amber" hint={`阈值 ${LARGE_THRESHOLD.toLocaleString()} credits`} />
        <StatCard label="人工调账 / 冻结" value={adjusts.length} tone="violet" />
        <StatCard icon={ShieldAlert} label="风险分" value="42 / 100" tone="primary" />
      </div>

      <Section className="mb-4" title="待复核业务交易">
        <UnusualTable rows={unusual} />
      </Section>

      <Section title="大额出账账目">
        <LargeLedger rows={largeWithdraws.concat(adjusts)} />
      </Section>
    </>
  );
}

function UnusualTable({ rows }: { rows: Transaction[] }) {
  const columns: Column<Transaction>[] = [
    { key: "source", header: "交易", render: (t) => <span className="font-medium">{t.source}</span> },
    { key: "user", header: "用户", render: (t) => <span className="font-mono text-xs">{t.userId ?? "—"}</span> },
    { key: "amount", header: "金额", align: "right",
      render: (t) => (
        <span className={`tabular-nums font-medium ${t.amount >= 0 ? "text-success" : "text-destructive"}`}>
          {formatSignedCredits(t.amount)}
        </span>
      ),
    },
    { key: "date", header: "日期", render: (t) => <span className="text-muted-foreground">{t.date}</span> },
    { key: "status", header: "状态",
      render: (t) => {
        const s = TRANSACTION_STATUS[t.status];
        return s ? <StatusBadge tone={mapTone(s.tone)} label={s.label} /> : null;
      },
    },
    { key: "reason", header: "触发原因", render: (t) => (
      <span className="text-xs text-muted-foreground">
        {t.status !== "completed" ? "非最终状态" : ""}
        {Math.abs(t.amount) >= LARGE_THRESHOLD ? (t.status !== "completed" ? " · " : "") + "大额（≥ 30k）" : ""}
      </span>
    )},
  ];

  return <DataTable<Transaction> columns={columns} rows={rows} rowKey={(t) => t.id} />;
}

function LargeLedger({ rows }: { rows: LedgerEntry[] }) {
  const columns: Column<LedgerEntry>[] = [
    { key: "type", header: "类型", render: (r) => <span className="font-medium">{r.type}</span> },
    { key: "desc", header: "描述", render: (r) => r.description },
    { key: "user", header: "用户", render: (r) => <span className="font-mono text-xs">{r.userId}</span> },
    { key: "amt",  header: "金额", align: "right",
      render: (r) => (
        <span className={`tabular-nums font-medium ${r.amount >= 0 ? "text-success" : "text-destructive"}`}>
          {formatSignedCredits(r.amount)}
        </span>
      ),
    },
    { key: "time", header: "时间", render: (r) => <span className="text-muted-foreground text-xs">{r.createdAt.slice(0, 16).replace("T", " ")}</span> },
  ];

  return <DataTable<LedgerEntry> columns={columns} rows={rows} rowKey={(r) => r.id} />;
}
