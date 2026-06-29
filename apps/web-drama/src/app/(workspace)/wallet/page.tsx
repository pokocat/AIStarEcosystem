"use client";

export const dynamic = "force-dynamic";

// ─────────────────────────────────────────────────────────────────────────────
// 积分钱包（v2 §6 drama 接入）—— 余额桶 + 充值套餐（按 drama 过滤）+ 在线支付（真 checkout，
// sourceApp=drama；payData=page→支付宝跳转 / shadow→dev 收银台）+ 最近充值订单。
// 与「财务中心」（营收 / 流水视图）互补：此页是充值 / 积分入口。
// ─────────────────────────────────────────────────────────────────────────────

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Coins, RefreshCw, Sparkles } from "lucide-react";
import type { LedgerEntry, RechargeOrder, RechargePackage, Wallet } from "@ai-star-eco/types/wallet";
import { AccountApi } from "@ai-star-eco/api-client";
import { formatCredits, formatCurrency } from "@ai-star-eco/api-client/format";
import { Button, Card, KpiCard } from "@/components/premium";
import { EmptyState, ErrorBlock, LoadingBlock, SectionHeader, StatusBadge, ViewHeader } from "@/components/common";
import { useAsync, invalidate } from "@/lib/drama-query";

const ORDER_TONE: Record<RechargeOrder["status"], "success" | "accent" | "info" | "danger"> = {
  pending: "accent",
  paid: "success",
  rejected: "danger",
  cancelled: "info",
  closed: "info",
  refunded: "info",
};
const ORDER_LABEL: Record<RechargeOrder["status"], string> = {
  pending: "待支付",
  paid: "已到账",
  rejected: "已驳回",
  cancelled: "已取消",
  closed: "已超时关闭",
  refunded: "已退款",
};

export default function WalletPage() {
  const router = useRouter();
  const walletQ = useAsync<Wallet>("/me/wallet", () => AccountApi.getMyWallet());
  const pkgQ = useAsync<RechargePackage[]>("/me/wallet/packages?drama", () => AccountApi.listRechargePackages("drama"));
  const ordersQ = useAsync<RechargeOrder[]>("/me/wallet/recharge/orders", () => AccountApi.listMyRechargeOrders());

  const [selected, setSelected] = React.useState<RechargePackage | null>(null);
  const [paying, setPaying] = React.useState(false);
  const [shadow, setShadow] = React.useState<{ orderId: string; summary: string } | null>(null);

  const wallet = walletQ.data;
  const packages = pkgQ.data ?? [];
  // 积分套餐 vs 存储套餐（grantStorageMb>0）分区展示，复用同一收银流程。
  const creditPkgs = packages.filter((p) => !p.grantStorageMb);
  const storagePkgs = packages.filter((p) => !!p.grantStorageMb);
  const orders = ordersQ.data ?? [];

  const refreshAll = () => {
    invalidate("/me/wallet");
    invalidate("/me/wallet/recharge/orders");
    walletQ.refetch();
    ordersQ.refetch();
  };

  // v2 §6：跳转收银台中间页（选渠道 + 实时状态 + 重试都在 /wallet/checkout）。
  function startOnlinePay() {
    if (!selected || paying) return;
    setPaying(true);
    router.push(`/wallet/checkout?pkg=${encodeURIComponent(selected.id)}`);
  }

  async function confirmShadow(result: "success" | "fail" | "timeout") {
    if (!shadow) return;
    try {
      await AccountApi.confirmShadowPay(shadow.orderId, result);
      setShadow(null);
      if (result === "success") {
        toast.success("充值已到账");
        refreshAll();
      } else {
        toast.error(result === "fail" ? "支付失败" : "支付超时");
        ordersQ.refetch();
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "确认失败");
    }
  }

  async function cancelOrder(id: string) {
    try {
      await AccountApi.cancelRechargeOrder(id);
      toast.success("订单已取消");
      ordersQ.refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "取消失败");
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      <ViewHeader
        eyebrow="积分钱包"
        title={
          <>
            积分{" "}
            <span className="text-gradient-gold" style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontWeight: 400 }}>
              钱包
            </span>
          </>
        }
        meta={wallet ? `更新于 ${new Date(wallet.updatedAt).toLocaleString("zh-CN")}` : "钱包加载中…"}
        action={
          <Button variant="ghost" size="md" onClick={refreshAll}>
            <RefreshCw size={13} />
            刷新
          </Button>
        }
      />

      {walletQ.isLoading && <LoadingBlock rows={1} height={140} />}
      {!!walletQ.error && <ErrorBlock onRetry={walletQ.refetch} />}
      {wallet && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
          <KpiCard label="总余额" value={formatCredits(wallet.totalBalance)} tone="accent" delta="可用 · 不含冻结" />
          <KpiCard label="充值积分" value={formatCredits(wallet.rechargeBalance)} tone="info" />
          <KpiCard label="赠送积分" value={formatCredits(wallet.giftBalance)} tone="success" />
          <KpiCard label="冻结中" value={formatCredits(wallet.pendingBalance)} tone="violet" delta="结算 / 在途" />
        </div>
      )}

      <Card style={{ padding: "22px 24px" }}>
        <SectionHeader eyebrow="充值" title="选择套餐充值" />
        {pkgQ.isLoading && <LoadingBlock rows={2} height={96} />}
        {!!pkgQ.error && <ErrorBlock onRetry={pkgQ.refetch} />}
        {!pkgQ.isLoading && creditPkgs.length === 0 && !pkgQ.error && (
          <EmptyState icon={<Coins size={24} />} title="暂无可购买套餐" description="运营在后台「充值套餐」配置短剧专属或通用套餐后，这里展示。" />
        )}
        {creditPkgs.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12 }}>
            {creditPkgs.map((p) => (
              <PkgCard key={p.id} p={p} active={selected?.id === p.id} onClick={() => setSelected(selected?.id === p.id ? null : p)} />
            ))}
          </div>
        )}
      </Card>

      {storagePkgs.length > 0 && (
        <Card style={{ padding: "22px 24px" }}>
          <SectionHeader eyebrow="存储" title="升级存储 · 购买存储套餐" />
          <div style={{ fontSize: 12.5, color: "var(--fg-2)", marginBottom: 14 }}>
            一次性扩容你的存储空间（生成 / 上传资产及回收站都占用此空间）。购买后立即生效。
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12 }}>
            {storagePkgs.map((p) => (
              <PkgCard key={p.id} p={p} active={selected?.id === p.id} onClick={() => setSelected(selected?.id === p.id ? null : p)} />
            ))}
          </div>
        </Card>
      )}

      {selected && !shadow && (
        <Card style={{ padding: "16px 22px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <div style={{ fontSize: 13, color: "var(--fg-1)" }}>
              已选 <strong style={{ color: "var(--fg-0)" }}>{selected.tag}</strong> ·{" "}
              {selected.grantStorageMb
                ? `存储 +${fmtStorageMb(selected.grantStorageMb)}`
                : `${formatCredits(selected.credits)}${selected.bonusCredits ? ` + 赠 ${formatCredits(selected.bonusCredits)}` : ""} 积分`}{" "}
              · <span className="mono" style={{ color: "var(--accent)" }}>{formatCurrency(selected.priceCents)}</span>
            </div>
            <Button variant="primary" size="md" loading={paying} onClick={startOnlinePay}>
              立即支付（在线）
            </Button>
          </div>
        </Card>
      )}

      {shadow && (
        <Card style={{ padding: "16px 22px", border: "1px dashed var(--accent)", background: "color-mix(in srgb, var(--accent) 5%, transparent)" }}>
          <div style={{ fontSize: 13, color: "var(--fg-1)", marginBottom: 10 }}>
            影子收银台（dev）· {shadow.summary} · 订单 <span className="mono">{shadow.orderId}</span>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Button variant="primary" size="sm" onClick={() => confirmShadow("success")}>✅ 模拟支付成功</Button>
            <Button variant="secondary" size="sm" onClick={() => confirmShadow("fail")}>❌ 模拟失败</Button>
            <Button variant="ghost" size="sm" onClick={() => confirmShadow("timeout")}>⏳ 模拟超时</Button>
          </div>
        </Card>
      )}

      <Card style={{ padding: "22px 24px" }}>
        <SectionHeader
          eyebrow="订单"
          title="最近充值订单"
          right={
            <Button variant="ghost" size="sm" onClick={() => ordersQ.refetch()}>
              <RefreshCw size={11} />
              刷新
            </Button>
          }
        />
        {ordersQ.isLoading && <LoadingBlock rows={3} height={44} />}
        {!ordersQ.isLoading && orders.length === 0 && (
          <EmptyState icon={<Coins size={24} />} title="还没有充值订单" description="选择套餐充值后，订单会在这里留账。" />
        )}
        {orders.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {orders.map((o) => (
              <div
                key={o.id}
                style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "12px 16px", borderRadius: "var(--radius-md)", border: "1px solid var(--line)" }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, color: "var(--fg-0)" }}>
                    {o.packageTag} · {formatCredits(o.credits)}
                    {o.bonusCredits ? ` + 赠 ${formatCredits(o.bonusCredits)}` : ""} 积分
                  </div>
                  <div className="mono" style={{ fontSize: 11, color: "var(--fg-3)", marginTop: 2 }}>
                    {new Date(o.createdAt).toLocaleString("zh-CN")} · {formatCurrency(o.priceCents)}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <StatusBadge tone={ORDER_TONE[o.status]}>{ORDER_LABEL[o.status]}</StatusBadge>
                  {o.status === "pending" && (
                    <Button variant="ghost" size="sm" onClick={() => cancelOrder(o.id)}>
                      取消
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function fmtStorageMb(mb: number): string {
  if (mb >= 1024) return (mb / 1024).toFixed(mb % 1024 === 0 ? 0 : 1) + " GB";
  return mb + " MB";
}

/** 套餐卡（积分套餐 / 存储套餐通用）。 */
function PkgCard({ p, active, onClick }: { p: RechargePackage; active: boolean; onClick: () => void }) {
  const isStorage = !!p.grantStorageMb;
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex",
        flexDirection: "column",
        textAlign: "left",
        padding: "16px 18px",
        borderRadius: "var(--radius-md)",
        cursor: "pointer",
        border: active ? "1.5px solid var(--accent)" : "1px solid var(--line-2)",
        background: active ? "color-mix(in srgb, var(--accent) 8%, transparent)" : "var(--surface)",
        position: "relative",
      }}
    >
      {p.recommended && (
        <span style={{ position: "absolute", top: 10, right: 10, fontSize: 10, color: "var(--accent)" }}>
          <Sparkles size={12} style={{ verticalAlign: "-2px" }} /> 推荐
        </span>
      )}
      <div style={{ fontSize: 13, color: "var(--fg-2)" }}>{p.tag}</div>
      {isStorage ? (
        <div className="mono" style={{ fontSize: 24, fontWeight: 800, color: "var(--fg-0)", marginTop: 4 }}>
          +{fmtStorageMb(p.grantStorageMb!)}
        </div>
      ) : (
        <>
          <div className="mono" style={{ fontSize: 26, fontWeight: 800, color: "var(--fg-0)", marginTop: 4 }}>
            {formatCredits(p.credits)}
          </div>
          {!!p.bonusCredits && (
            <div style={{ fontSize: 12, color: "var(--success)", marginTop: 2 }}>另赠 {formatCredits(p.bonusCredits)}</div>
          )}
        </>
      )}
      <div className="mono" style={{ fontSize: 15, fontWeight: 700, color: "var(--accent)", marginTop: "auto", paddingTop: 8 }}>
        {formatCurrency(p.priceCents)}
      </div>
    </button>
  );
}
