"use client";

export const dynamic = "force-dynamic";

import * as React from "react";
import { toast } from "sonner";
import { ArrowDownToLine, ArrowUpFromLine, RefreshCw, Wallet as WalletIcon } from "lucide-react";
import type { Transaction } from "@ai-star-eco/types/finance";
import type { Wallet } from "@ai-star-eco/types/wallet";
import { Button, Card, KpiCard } from "@/components/premium";
import {
  Dialog,
  EmptyState,
  ErrorBlock,
  Field,
  LoadingBlock,
  SectionHeader,
  Select,
  StatusBadge,
  TextInput,
  ViewHeader,
} from "@/components/common";
import { FinanceApi } from "@/api";
import { useAsync, invalidate } from "@/lib/drama-query";
import { ApiError } from "@ai-star-eco/api-client";

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
  const [txFilter, setTxFilter] = React.useState<TxFilter>("all");
  const [showRecharge, setShowRecharge] = React.useState(false);
  const [showWithdraw, setShowWithdraw] = React.useState(false);

  const walletQ = useAsync<Wallet>("/me/wallet", () => FinanceApi.getMyWallet());
  const txQ = useAsync<Transaction[]>(
    `/finance/transactions?type=${txFilter}`,
    () => FinanceApi.listTransactions({ limit: 50, type: txFilter === "all" ? undefined : txFilter }),
  );

  const wallet = walletQ.data;
  const txs = txQ.data ?? [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      <ViewHeader
        eyebrow="finance"
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
            <Button variant="secondary" size="md" onClick={() => setShowRecharge(true)}>
              <ArrowDownToLine size={13} />
              充值
            </Button>
            <Button variant="primary" size="md" onClick={() => setShowWithdraw(true)}>
              <ArrowUpFromLine size={13} />
              提现
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
            delta="提现 / 在途"
          />
        </div>
      )}

      <Card style={{ padding: "22px 24px" }}>
        <SectionHeader
          eyebrow="transactions"
          title="交易流水"
          right={
            <Button variant="ghost" size="sm" onClick={() => txQ.refetch()}>
              <RefreshCw size={11} />
              刷新
            </Button>
          }
        />
        <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
          {(["all", "income", "withdrawal", "recharge", "spend"] as TxFilter[]).map((f) => {
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
            description="发布作品 / 充值 / 提现都会在这里留账。"
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

      <RechargeDialog
        open={showRecharge}
        onOpenChange={setShowRecharge}
        onDone={() => {
          invalidate("/me/wallet");
          invalidate("/finance/transactions?type=all");
          invalidate("/finance/transactions?type=recharge");
          toast.success("充值成功");
        }}
      />
      <WithdrawDialog
        open={showWithdraw}
        onOpenChange={setShowWithdraw}
        max={wallet?.totalBalance ?? 0}
        onDone={() => {
          invalidate("/me/wallet");
          invalidate("/finance/transactions?type=all");
          invalidate("/finance/transactions?type=withdrawal");
          toast.success("提现已发起，1-3 工作日到账");
        }}
      />
    </div>
  );
}

function RechargeDialog({
  open,
  onOpenChange,
  onDone,
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  onDone: () => void;
}) {
  const [amount, setAmount] = React.useState(1000);
  const [method, setMethod] = React.useState<"alipay" | "wechat" | "bank">("alipay");
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (!open) {
      setAmount(1000);
      setMethod("alipay");
    }
  }, [open]);

  async function submit() {
    if (amount <= 0) {
      toast.error("请输入正整数");
      return;
    }
    setBusy(true);
    try {
      await FinanceApi.createRecharge({ amount, method });
      onOpenChange(false);
      onDone();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "充值失败");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => !busy && onOpenChange(o)}
      title="充值"
      description="充值后立即到账，可用于授权、生成、上线等业务。"
      footer={
        <>
          <Button variant="ghost" size="md" onClick={() => onOpenChange(false)} disabled={busy}>
            取消
          </Button>
          <Button variant="primary" size="md" loading={busy} onClick={submit}>
            充 ¥{amount.toLocaleString("zh-CN")}
          </Button>
        </>
      }
    >
      <Field label="金额（积分）" required>
        <TextInput
          type="number"
          min={1}
          value={amount}
          onChange={(e) => setAmount(Number(e.target.value))}
        />
      </Field>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
        {[500, 1_000, 5_000, 10_000].map((v) => (
          <button
            key={v}
            onClick={() => setAmount(v)}
            style={{
              padding: "6px 14px",
              borderRadius: "var(--radius-pill)",
              border: "1px solid var(--line-2)",
              background: amount === v ? "color-mix(in srgb, var(--accent) 14%, transparent)" : "transparent",
              color: amount === v ? "var(--accent)" : "var(--fg-1)",
              fontSize: 12,
              cursor: "pointer",
            }}
          >
            ¥{v.toLocaleString("zh-CN")}
          </button>
        ))}
      </div>
      <Field label="支付方式">
        <Select value={method} onChange={(e) => setMethod(e.target.value as "alipay" | "wechat" | "bank")}>
          <option value="alipay">支付宝</option>
          <option value="wechat">微信支付</option>
          <option value="bank">银行卡</option>
        </Select>
      </Field>
    </Dialog>
  );
}

function WithdrawDialog({
  open,
  onOpenChange,
  onDone,
  max,
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  onDone: () => void;
  max: number;
}) {
  const [amount, setAmount] = React.useState(0);
  const [bankCard, setBankCard] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) {
      setAmount(0);
      setBankCard("");
      setErr(null);
    }
  }, [open]);

  async function submit() {
    setErr(null);
    if (amount <= 0) {
      setErr("请输入提现金额");
      return;
    }
    if (amount > max) {
      setErr(`可用余额不足，最多可提现 ${max.toLocaleString("zh-CN")}`);
      return;
    }
    if (bankCard.replace(/\s+/g, "").length < 12) {
      setErr("请输入完整的银行卡号");
      return;
    }
    setBusy(true);
    try {
      await FinanceApi.createWithdrawal({ amount, bankCard: bankCard.replace(/\s+/g, "") });
      onOpenChange(false);
      onDone();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "提现失败");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => !busy && onOpenChange(o)}
      title="提现"
      description="提现到指定银行卡，1-3 工作日到账。"
      footer={
        <>
          <Button variant="ghost" size="md" onClick={() => onOpenChange(false)} disabled={busy}>
            取消
          </Button>
          <Button variant="primary" size="md" loading={busy} onClick={submit}>
            提现 ¥{amount.toLocaleString("zh-CN")}
          </Button>
        </>
      }
    >
      <Field label="金额（积分）" hint={`可用余额 ${max.toLocaleString("zh-CN")}`} required>
        <TextInput
          type="number"
          min={1}
          max={max}
          value={amount || ""}
          onChange={(e) => setAmount(Number(e.target.value))}
        />
      </Field>
      <Field label="银行卡号" required>
        <TextInput
          value={bankCard}
          onChange={(e) => setBankCard(e.target.value)}
          placeholder="6228 4800 0000 0000 000"
          maxLength={23}
        />
      </Field>
      {err && <div style={{ fontSize: 11, color: "var(--danger)", marginTop: -4 }}>{err}</div>}
    </Dialog>
  );
}
