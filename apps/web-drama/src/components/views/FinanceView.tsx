"use client";

// 财务面板 · cinematic 布局：
//   顶部 KPI 4 张（钱包 / 月营收 / 待入账 / 提现）
//   左 2 / 右 1：左 6 个月营收柱状图 + 收入构成饼图（recharts）
//                右 钱包余额卡 + 快捷动作
//   底部 流水明细表（流水 ID / 来源 / 金额 / 状态 / 类型 / 时间）

import * as React from "react";
import {
  ArrowDownToLine,
  ArrowUpRight,
  Banknote,
  CheckCircle2,
  Clock,
  CircleSlash,
  Download,
  Plus,
  RotateCw,
  Send,
  Wallet,
} from "lucide-react";
import {
  Bar,
  BarChart,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type {
  MonthlyRevenuePoint,
  RevenueSource,
  Transaction,
  TransactionStatus,
  TransactionType,
} from "@ai-star-eco/types/finance";
import type { Wallet as WalletEntity } from "@ai-star-eco/types/wallet";
import { Button, Card, Chip, KpiCard } from "@/components/premium";
import { formatCny } from "@/lib/cast-derive";

interface Props {
  wallet: WalletEntity;
  monthly: MonthlyRevenuePoint[];
  sources: RevenueSource[];
  transactions: Transaction[];
}

const STATUS_LABEL: Record<TransactionStatus, string> = {
  completed: "已到账",
  pending: "待入账",
  processing: "处理中",
};
const STATUS_TONE: Record<TransactionStatus, "success" | "warning" | "info"> = {
  completed: "success",
  pending: "warning",
  processing: "info",
};
const STATUS_ICON: Record<TransactionStatus, typeof CheckCircle2> = {
  completed: CheckCircle2,
  pending: CircleSlash,
  processing: Clock,
};

const TYPE_LABEL: Record<TransactionType, string> = {
  income: "收入",
  withdrawal: "提现",
  spend: "支出",
  recharge: "充值",
  license_grant: "许可入账",
};

export function FinanceView({ wallet, monthly, sources, transactions }: Props) {
  const totalRevenue = monthly.reduce((s, m) => s + m.revenue, 0);
  const lastMonth = monthly[monthly.length - 1]?.revenue ?? 0;
  const prevMonth = monthly[monthly.length - 2]?.revenue ?? 0;
  const pct = prevMonth > 0
    ? Math.round(((lastMonth - prevMonth) / prevMonth) * 100)
    : 0;
  const pendingTotal = transactions
    .filter((t) => t.status !== "completed" && t.amount > 0)
    .reduce((s, t) => s + t.amount, 0);
  const withdrawTotal = transactions
    .filter((t) => t.type === "withdrawal")
    .reduce((s, t) => s + Math.abs(t.amount), 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* hero */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          gap: 24,
        }}
      >
        <div>
          <div className="eyebrow">财务变现 · 钱包与流水</div>
          <h1
            style={{
              fontSize: 36,
              fontWeight: 700,
              letterSpacing: "var(--tracking-tight)",
              fontFamily: "var(--font-display)",
              margin: "10px 0 8px",
              lineHeight: 1.05,
            }}
          >
            财务{" "}
            <span
              className="text-gradient-gold"
              style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontWeight: 400 }}
            >
              中心
            </span>
          </h1>
          <div style={{ fontSize: 13.5, color: "var(--fg-2)" }}>
            6 个月累计营收 {formatCny(totalRevenue)} · 上月 {formatCny(lastMonth)} ·
            环比 {pct >= 0 ? "+" : ""}{pct}%
          </div>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <Button variant="secondary" size="md">
            <Download size={14} /> 导出对账单
          </Button>
          <Button variant="primary" size="md">
            <Send size={14} /> 申请提现
          </Button>
        </div>
      </div>

      {/* KPI */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
        <KpiCard
          label="钱包余额"
          value={formatCny(wallet.totalBalance)}
          delta={`可提 ${formatCny(wallet.rechargeBalance + wallet.giftBalance)}`}
          tone="accent"
        />
        <KpiCard
          label="本月营收"
          value={formatCny(lastMonth)}
          delta={`环比 ${pct >= 0 ? "+" : ""}${pct}%`}
          tone={pct >= 0 ? "success" : "danger"}
          spark={monthly.map((m) => m.revenue / 1000)}
        />
        <KpiCard
          label="待入账"
          value={formatCny(pendingTotal)}
          delta={`${transactions.filter((t) => t.status !== "completed").length} 条流水`}
          tone="warning"
        />
        <KpiCard
          label="累计提现"
          value={formatCny(withdrawTotal)}
          delta={`${transactions.filter((t) => t.type === "withdrawal").length} 笔`}
          tone="violet"
        />
      </div>

      {/* 主体：图表 + 钱包 */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 18 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {/* 营收柱状图 */}
          <Card style={{ padding: "22px 24px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 18 }}>
              <div>
                <div className="eyebrow">最近 6 个月</div>
                <div
                  style={{
                    fontSize: 17,
                    fontWeight: 600,
                    fontFamily: "var(--font-display)",
                    marginTop: 6,
                  }}
                >
                  营收趋势
                </div>
              </div>
              <div className="mono" style={{ fontSize: 11, color: "var(--fg-2)", letterSpacing: 0.4 }}>
                单位：积分（credits）
              </div>
            </div>
            <div style={{ width: "100%", height: 240 }}>
              <ResponsiveContainer>
                <BarChart data={monthly} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="barGold" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#ead7a8" stopOpacity={0.95} />
                      <stop offset="100%" stopColor="#d4af6a" stopOpacity={0.55} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="month"
                    tick={{ fontFamily: "var(--font-mono)", fontSize: 11, fill: "var(--fg-2)" }}
                    axisLine={{ stroke: "var(--line)" }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontFamily: "var(--font-mono)", fontSize: 10, fill: "var(--fg-3)" }}
                    axisLine={false}
                    tickLine={false}
                    width={50}
                    tickFormatter={(v) => `${(v as number) / 1000}k`}
                  />
                  <Tooltip
                    cursor={{ fill: "rgba(255,255,255,0.04)" }}
                    contentStyle={{
                      background: "var(--bg-2)",
                      border: "1px solid var(--line-2)",
                      borderRadius: 8,
                      fontSize: 12,
                      color: "var(--fg-0)",
                    }}
                    labelStyle={{ color: "var(--fg-2)", fontFamily: "var(--font-mono)" }}
                    formatter={(value) => [formatCny(Number(value)), "营收"]}
                  />
                  <Bar dataKey="revenue" fill="url(#barGold)" radius={[6, 6, 0, 0]} maxBarSize={48} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* 收入构成饼图 */}
          <Card style={{ padding: "22px 24px" }}>
            <div className="eyebrow" style={{ marginBottom: 6 }}>收入构成</div>
            <div
              style={{
                fontSize: 17,
                fontWeight: 600,
                fontFamily: "var(--font-display)",
                marginBottom: 18,
              }}
            >
              30 日来源分布
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 24, alignItems: "center" }}>
              <div style={{ width: "100%", height: 220 }}>
                <ResponsiveContainer>
                  <PieChart>
                    <Pie
                      data={sources}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={52}
                      outerRadius={88}
                      paddingAngle={2}
                      stroke="var(--bg-1)"
                      strokeWidth={2}
                    >
                      {sources.map((s, i) => (
                        <Cell key={i} fill={s.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        background: "var(--bg-2)",
                        border: "1px solid var(--line-2)",
                        borderRadius: 8,
                        fontSize: 12,
                        color: "var(--fg-0)",
                      }}
                      formatter={(value, name) => [`${value}%`, String(name)]}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {sources.map((s) => (
                  <div key={s.name} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: 2,
                        background: s.color,
                        boxShadow: `0 0 6px ${s.color}88`,
                      }}
                    />
                    <span style={{ fontSize: 12.5, color: "var(--fg-1)", flex: 1 }}>{s.name}</span>
                    <span
                      className="mono"
                      style={{
                        fontSize: 12,
                        color: "var(--fg-0)",
                        fontWeight: 600,
                      }}
                    >
                      {s.value}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </div>

        {/* 右侧：钱包卡 + 快捷动作 */}
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <Card style={{ padding: 0, overflow: "hidden" }}>
            <div
              style={{
                background: "var(--gradient-gold)",
                color: "#1a1410",
                padding: "22px 24px",
              }}
            >
              <div
                className="mono"
                style={{
                  fontSize: 10,
                  letterSpacing: 0.6,
                  textTransform: "uppercase",
                  opacity: 0.7,
                  marginBottom: 10,
                }}
              >
                钱包总余额
              </div>
              <div
                style={{
                  fontSize: 34,
                  fontWeight: 700,
                  fontFamily: "var(--font-display)",
                  letterSpacing: "var(--tracking-tight)",
                  lineHeight: 1,
                }}
              >
                {formatCny(wallet.totalBalance)}
              </div>
              <div
                className="mono"
                style={{
                  fontSize: 11,
                  marginTop: 8,
                  opacity: 0.7,
                  letterSpacing: 0.3,
                }}
              >
                同步于 {wallet.updatedAt.slice(0, 10)}
              </div>
            </div>
            <div style={{ padding: "18px 22px", display: "flex", flexDirection: "column", gap: 12 }}>
              <BalanceRow label="许可入账" value={wallet.licenseBalance} />
              <BalanceRow label="充值" value={wallet.rechargeBalance} />
              <BalanceRow label="赠送 / 活动" value={wallet.giftBalance} />
              <BalanceRow label="结算中" value={wallet.pendingBalance} muted />
            </div>
          </Card>

          <Card glass style={{ padding: "22px 22px" }}>
            <div className="eyebrow" style={{ marginBottom: 14 }}>快捷动作</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <Button variant="primary" size="md" style={{ width: "100%" }}>
                <Send size={14} /> 申请提现
              </Button>
              <Button variant="secondary" size="md" style={{ width: "100%" }}>
                <Plus size={14} /> 充值积分
              </Button>
              <Button variant="ghost" size="md" style={{ width: "100%" }}>
                <RotateCw size={14} /> 查看完整对账
              </Button>
            </div>
            <div
              style={{
                marginTop: 18,
                padding: "12px 14px",
                borderRadius: "var(--radius-md)",
                background: "rgba(255,255,255,0.02)",
                border: "1px solid var(--line)",
                fontSize: 11,
                color: "var(--fg-2)",
                lineHeight: 1.6,
              }}
            >
              结算中余额会在剧集分账完成后入账（通常 T+7）；提现到账约 1–3 个工作日。
            </div>
          </Card>
        </div>
      </div>

      {/* 流水明细 */}
      <Card style={{ padding: "22px 24px" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            marginBottom: 16,
          }}
        >
          <div>
            <div className="eyebrow">流水明细</div>
            <div
              style={{
                fontSize: 17,
                fontWeight: 600,
                fontFamily: "var(--font-display)",
                marginTop: 6,
              }}
            >
              {transactions.length} 条记录 · 按时间倒序
            </div>
          </div>
          <Button variant="ghost" size="sm">
            <Download size={13} /> 导出 CSV
          </Button>
        </div>

        <div style={{ overflow: "hidden", borderRadius: "var(--radius-md)", border: "1px solid var(--line)" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "rgba(255,255,255,0.02)" }}>
                {["流水", "来源", "金额", "类型", "状态", "时间"].map((h) => (
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
              {transactions.map((t, i) => {
                const StatusIcon = STATUS_ICON[t.status];
                const isIncome = t.amount > 0;
                return (
                  <tr
                    key={t.id}
                    style={{
                      borderBottom: i < transactions.length - 1 ? "1px solid var(--line)" : "none",
                    }}
                  >
                    <td
                      className="mono"
                      style={{
                        padding: "14px 16px",
                        color: "var(--fg-3)",
                        fontSize: 11,
                        letterSpacing: 0.4,
                      }}
                    >
                      #{t.id.toUpperCase()}
                    </td>
                    <td
                      style={{
                        padding: "14px 16px",
                        color: "var(--fg-0)",
                        fontWeight: 500,
                      }}
                    >
                      {t.source}
                    </td>
                    <td
                      className="mono"
                      style={{
                        padding: "14px 16px",
                        fontSize: 13,
                        fontWeight: 600,
                        color: isIncome ? "var(--success)" : "var(--danger)",
                      }}
                    >
                      {isIncome ? "+" : "−"}
                      {formatCny(Math.abs(t.amount))}
                    </td>
                    <td style={{ padding: "14px 16px" }}>
                      <span
                        className="mono"
                        style={{
                          fontSize: 11,
                          color: "var(--fg-2)",
                          letterSpacing: 0.3,
                        }}
                      >
                        {TYPE_LABEL[t.type]}
                      </span>
                    </td>
                    <td style={{ padding: "14px 16px" }}>
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                        }}
                      >
                        <StatusIcon size={12} color={`var(--${STATUS_TONE[t.status]})`} />
                        <Chip tone={STATUS_TONE[t.status]}>{STATUS_LABEL[t.status]}</Chip>
                      </span>
                    </td>
                    <td
                      className="mono"
                      style={{
                        padding: "14px 16px",
                        color: "var(--fg-2)",
                        fontSize: 11,
                        letterSpacing: 0.3,
                      }}
                    >
                      {t.date}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function BalanceRow({ label, value, muted }: { label: string; value: number; muted?: boolean }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        paddingBottom: 10,
        borderBottom: "1px solid var(--line)",
      }}
    >
      <div style={{ fontSize: 12.5, color: "var(--fg-2)" }}>{label}</div>
      <div
        className="mono"
        style={{
          fontSize: 13,
          fontWeight: 600,
          color: muted ? "var(--fg-3)" : "var(--fg-0)",
        }}
      >
        {formatCny(value)}
      </div>
    </div>
  );
}
