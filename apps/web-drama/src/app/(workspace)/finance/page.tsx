"use client";

export const dynamic = "force-dynamic";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowDownToLine, RefreshCw, Wallet as WalletIcon } from "lucide-react";
import type { Transaction } from "@ai-star-eco/types/finance";
import type { Wallet } from "@ai-star-eco/types/wallet";
import { Button, Card, KpiCard } from "@/components/premium";
import {
  EmptyState,
  ErrorBlock,
  LoadingBlock,
  SectionHeader,
  StatusBadge,
  ViewHeader,
} from "@/components/common";
import { FinanceApi, StorageApi } from "@/api";
import type { StorageUsage } from "@/api/storage";
import { useAsync } from "@/lib/drama-query";

type TxFilter = "all" | Transaction["type"];

const TX_TYPE_LABEL: Record<Transaction["type"], string> = {
  income: "收入",
  withdrawal: "提现",
  recharge: "充值",
  spend: "消耗",
  license_grant: "授权",
};

const TX_STATUS_TONE: Record<Transaction["status"], "success" | "info" | "accent"> = {
  completed: "success",
  pending: "accent",
  processing: "info",
};

const TX_STATUS_LABEL: Record<Transaction["status"], string> = {
  completed: "已完成",
  pending: "待处理",
  processing: "处理中",
};

export default function FinancePage() {
  const router = useRouter();
  const [txFilter, setTxFilter] = React.useState<TxFilter>("all");

  const walletQ = useAsync<Wallet>("/me/wallet", () => FinanceApi.getMyWallet());
  const storageQ = useAsync<StorageUsage>("/me/storage?app=drama", () => StorageApi.getStorageUsage("drama"), {
    revalidateOnMount: true,
  });
  const txQ = useAsync<Transaction[]>(
    `/finance/transactions?type=${txFilter}`,
    () => FinanceApi.listTransactions({ limit: 50, type: txFilter === "all" ? undefined : txFilter }),
  );

  const wallet = walletQ.data;
  const txs = txQ.data ?? [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      <ViewHeader
        eyebrow="财务中心"
        title={
          <>
            财务{" "}
            <span
              className="text-gradient-gold"
              style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontWeight: 400 }}
            >
              中心
            </span>
          </>
        }
        meta={wallet ? `更新于 ${new Date(wallet.updatedAt).toLocaleString("zh-CN")}` : "钱包加载中…"}
        action={
          <>
            <Button variant="primary" size="md" onClick={() => router.push("/wallet")}>
              <ArrowDownToLine size={13} />
              充值
            </Button>
          </>
        }
      />

      {walletQ.isLoading && <LoadingBlock rows={1} height={140} />}
      {!!walletQ.error && <ErrorBlock onRetry={walletQ.refetch} />}
      {wallet && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
          <KpiCard
            label="总余额"
            value={wallet.totalBalance.toLocaleString("zh-CN")}
            tone="accent"
            delta="可用 · 不含 pending"
          />
          <KpiCard label="授权额度" value={wallet.licenseBalance.toLocaleString("zh-CN")} tone="success" />
          <KpiCard label="充值额度" value={wallet.rechargeBalance.toLocaleString("zh-CN")} tone="info" />
          <KpiCard
            label="待结算"
            value={wallet.pendingBalance.toLocaleString("zh-CN")}
            tone="violet"
            delta="结算在途"
          />
        </div>
      )}

      {storageQ.data && <StorageCard usage={storageQ.data} onUpgrade={() => router.push("/wallet?tab=storage")} />}

      <Card style={{ padding: "22px 24px" }}>
        <SectionHeader
          eyebrow="流水"
          title="交易流水"
          right={
            <Button variant="ghost" size="sm" onClick={() => txQ.refetch()}>
              <RefreshCw size={11} />
              刷新
            </Button>
          }
        />
        <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
          {(["all", "income", "recharge", "spend"] as TxFilter[]).map((f) => {
            const active = txFilter === f;
            return (
              <button
                key={f}
                onClick={() => setTxFilter(f)}
                style={{
                  padding: "6px 12px",
                  borderRadius: "var(--radius-pill)",
                  border: active
                    ? "1px solid color-mix(in srgb, var(--accent) 50%, transparent)"
                    : "1px solid var(--line-2)",
                  background: active ? "color-mix(in srgb, var(--accent) 12%, transparent)" : "transparent",
                  color: active ? "var(--accent)" : "var(--fg-1)",
                  fontSize: 12,
                  cursor: "pointer",
                }}
              >
                {f === "all" ? "全部" : TX_TYPE_LABEL[f]}
              </button>
            );
          })}
        </div>

        {txQ.isLoading && <LoadingBlock rows={4} height={44} />}
        {!txQ.isLoading && txs.length === 0 && (
          <EmptyState
            icon={<WalletIcon size={24} />}
            title="还没有这类流水"
            description="发布作品 / 充值 / 消耗都会在这里留账。"
          />
        )}
        {txs.length > 0 && (
          <div
            style={{
              overflow: "hidden",
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--line)",
            }}
          >
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "rgba(255,255,255,0.02)" }}>
                  {["日期", "来源", "类型", "金额", "状态"].map((h) => (
                    <th
                      key={h}
                      className="eyebrow"
                      style={{
                        textAlign: "left",
                        padding: "12px 16px",
                        borderBottom: "1px solid var(--line)",
                        color: "var(--fg-2)",
                        fontWeight: 500,
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {txs.map((t, i) => (
                  <tr key={t.id} style={{ borderBottom: i < txs.length - 1 ? "1px solid var(--line)" : "none" }}>
                    <td className="mono" style={{ padding: "12px 16px", color: "var(--fg-2)" }}>
                      {t.date}
                    </td>
                    <td style={{ padding: "12px 16px" }}>{t.source}</td>
                    <td style={{ padding: "12px 16px", color: "var(--fg-1)" }}>{TX_TYPE_LABEL[t.type]}</td>
                    <td
                      className="mono"
                      style={{
                        padding: "12px 16px",
                        color: t.amount < 0 ? "var(--danger)" : "var(--success)",
                        fontWeight: 600,
                      }}
                    >
                      {t.amount > 0 ? "+" : ""}
                      {t.amount.toLocaleString("zh-CN")}
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <StatusBadge tone={TX_STATUS_TONE[t.status]}>{TX_STATUS_LABEL[t.status]}</StatusBadge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

const STORAGE_COLORS = ["var(--accent)", "#1AA06E", "#D9920E", "#8A6BFF", "#64748b"];

function fmtMb(mb: number): string {
  if (mb >= 1024) return (mb / 1024).toFixed(mb % 1024 === 0 ? 0 : 1) + " GB";
  return mb + " MB";
}

/** 存储空间用量卡：生成 / 上传资产（含回收站）占用 + 余量 + 升级入口。 */
function StorageCard({ usage, onUpgrade }: { usage: StorageUsage; onUpgrade: () => void }) {
  const pct = usage.quotaMb > 0 ? Math.min(100, Math.round((usage.usedMb / usage.quotaMb) * 100)) : 0;
  const near = pct >= 85;
  return (
    <Card style={{ padding: "20px 24px" }}>
      <SectionHeader
        eyebrow="资源"
        title="存储空间"
        right={
          <Button variant="secondary" size="sm" onClick={onUpgrade}>
            升级存储
          </Button>
        }
      />
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 8 }}>
        <span style={{ color: "var(--fg-1)" }}>
          已用 <b className="mono">{fmtMb(usage.usedMb)}</b> / {fmtMb(usage.quotaMb)}
        </span>
        <span style={{ color: near ? "var(--danger)" : "var(--fg-2)" }}>剩余 {fmtMb(usage.remainingMb)}（{pct}%）</span>
      </div>
      <div style={{ height: 10, borderRadius: 99, background: "var(--surface-2)", overflow: "hidden", display: "flex" }}>
        {usage.breakdown.length > 0 ? (
          usage.breakdown.map((s, i) => (
            <div
              key={s.category}
              title={`${s.category} ${fmtMb(s.mb)}`}
              style={{ width: (usage.quotaMb > 0 ? (s.mb / usage.quotaMb) * 100 : 0) + "%", background: STORAGE_COLORS[i % STORAGE_COLORS.length] }}
            />
          ))
        ) : (
          <div style={{ width: pct + "%", background: "var(--accent)" }} />
        )}
      </div>
      {usage.breakdown.length > 0 && (
        <div style={{ display: "flex", gap: 16, marginTop: 12, flexWrap: "wrap" }}>
          {usage.breakdown.map((s, i) => (
            <span key={s.category} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--fg-2)" }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: STORAGE_COLORS[i % STORAGE_COLORS.length] }} />
              {s.category} · {fmtMb(s.mb)}
            </span>
          ))}
        </div>
      )}
      <div style={{ fontSize: 11.5, color: "var(--fg-3)", marginTop: 12, lineHeight: 1.6 }}>
        生成 / 上传的资产（含回收站）都计入占用。空间不足可「升级存储」购买存储套餐扩容。
      </div>
    </Card>
  );
}
