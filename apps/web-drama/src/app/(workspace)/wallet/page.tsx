"use client";

export const dynamic = "force-dynamic";

// ─────────────────────────────────────────────────────────────────────────────
// 积分钱包（v2 §6 drama 接入；v0.197 收口）—— 余额 + 充值套餐（按 drama 过滤）+ 在线支付
// （跳 /wallet/checkout）+ 充值订单 + 积分明细（AccountApi.getMyLedger）。
// 「收入与提现」（/finance）只列作品收入与提现（同样按积分记），不再重复展示积分余额。
//
// 余额读 useWallet()（全站唯一读法）：挂载 / 回到标签页 / 有人 notifyWalletChanged() 时都会重读，
// 从收银台付完回来看到的就是新余额。余额卡各分项加起来必须等于总余额（充值 + 赠送 + 激活码）。
// ─────────────────────────────────────────────────────────────────────────────

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Coins, HardDrive, ListOrdered, RefreshCw, Sparkles } from "lucide-react";
import type { LedgerEntry, RechargeOrder, RechargePackage } from "@ai-star-eco/types/wallet";
import { AccountApi } from "@ai-star-eco/api-client";
import { formatCredits, formatCurrency, formatDateTime } from "@ai-star-eco/api-client/format";
import { Button, Card } from "@/components/premium";
import { EmptyState, ErrorBlock, LoadingBlock, SectionHeader, StatusBadge, ViewHeader } from "@/components/common";
import { dramaConfirm } from "@/components/drama-ui";
import { useAsync, invalidate } from "@/lib/drama-query";
import { useWallet, WALLET_CHANGED_EVENT } from "@/lib/use-wallet";
import { HOLD_SETTLEMENT_LABEL, LEDGER_CACHE_KEY, LEDGER_PAGE_SIZE, LEDGER_TYPE_LABEL, LedgerList } from "../_shared/LedgerList";

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
  rejected: "没通过",
  cancelled: "已取消",
  closed: "已超时关闭",
  refunded: "已退款",
};

const ORDERS_KEY = "/me/wallet/recharge/orders";

export default function WalletPage() {
  const router = useRouter();
  const { wallet, refresh: refreshWallet } = useWallet();
  const [walletFailed, setWalletFailed] = React.useState(false);
  const pkgQ = useAsync<RechargePackage[]>("/me/wallet/packages?drama", () => AccountApi.listRechargePackages("drama"));
  const ordersQ = useAsync<RechargeOrder[]>(ORDERS_KEY, () => AccountApi.listMyRechargeOrders(), {
    revalidateOnMount: true,
  });
  const ledgerQ = useAsync<LedgerEntry[]>(LEDGER_CACHE_KEY, () => AccountApi.getMyLedger(0, LEDGER_PAGE_SIZE), {
    revalidateOnMount: true,
  });

  const [selected, setSelected] = React.useState<RechargePackage | null>(null);
  const [paying, setPaying] = React.useState(false);
  const [wantStorage, setWantStorage] = React.useState(false);
  const storageRef = React.useRef<HTMLDivElement | null>(null);

  // 首次读钱包超过 8 秒还没回来，给一个能重试的错误块（useWallet 读失败时只保持 null）。
  React.useEffect(() => {
    if (wallet) {
      setWalletFailed(false);
      return;
    }
    const t = setTimeout(() => setWalletFailed(true), 8000);
    return () => clearTimeout(t);
  }, [wallet]);

  // 别处花了积分 / 充值到账（notifyWalletChanged）→ 明细和订单也一起重读。
  React.useEffect(() => {
    const onChanged = () => {
      invalidate(LEDGER_CACHE_KEY);
      invalidate(ORDERS_KEY);
    };
    window.addEventListener(WALLET_CHANGED_EVENT, onChanged);
    return () => window.removeEventListener(WALLET_CHANGED_EVENT, onChanged);
  }, []);

  // 「收入与提现」的「买存储空间」跳 /wallet?tab=storage：滚到存储那一块。
  React.useEffect(() => {
    try {
      if (new URLSearchParams(window.location.search).get("tab") === "storage") setWantStorage(true);
    } catch {
      /* ignore */
    }
  }, []);

  const packages = pkgQ.data ?? [];
  // 积分套餐 vs 存储套餐（grantStorageMb>0）分区展示，复用同一收银流程。
  const creditPkgs = packages.filter((p) => !p.grantStorageMb);
  const storagePkgs = packages.filter((p) => !!p.grantStorageMb);
  const orders = ordersQ.data ?? [];
  const ledger = ledgerQ.data ?? [];

  React.useEffect(() => {
    if (!wantStorage || pkgQ.isLoading) return;
    storageRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [wantStorage, pkgQ.isLoading]);

  const refreshAll = () => {
    refreshWallet();
    invalidate(ORDERS_KEY);
    invalidate(LEDGER_CACHE_KEY);
  };

  // v2 §6：跳转收银台中间页（选渠道 + 实时状态 + 重试都在 /wallet/checkout）。
  function startOnlinePay() {
    if (!selected || paying) return;
    setPaying(true);
    router.push(`/wallet/checkout?pkg=${encodeURIComponent(selected.id)}`);
  }

  async function cancelOrder(o: RechargeOrder) {
    const ok = await dramaConfirm({
      title: "取消这笔订单？",
      body: `${o.packageTag ?? "充值套餐"} · ${formatCurrency(o.priceCents)}。如果已经付过款，先别取消，过一会儿点「刷新」看看有没有到账。`,
      confirmLabel: "取消订单",
      cancelLabel: "先不取消",
      tone: "danger",
    });
    if (!ok) return;
    try {
      await AccountApi.cancelRechargeOrder(o.id);
      toast.success("订单已取消");
      invalidate(ORDERS_KEY);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "取消失败，请刷新后重试");
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      <ViewHeader
        eyebrow="账户"
        title={
          <>
            积分{" "}
            <span className="text-gradient-gold" style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontWeight: 400 }}>
              钱包
            </span>
          </>
        }
        meta={wallet ? `余额更新于 ${formatDateTime(wallet.updatedAt)}` : "加载中…"}
        action={
          <Button variant="ghost" size="md" onClick={refreshAll}>
            <RefreshCw size={13} />
            刷新
          </Button>
        }
      />

      {!wallet && !walletFailed && <LoadingBlock rows={1} height={140} />}
      {!wallet && walletFailed && <ErrorBlock onRetry={refreshWallet} />}
      {wallet && (
        <Card style={{ padding: "22px 24px" }}>
          <div className="acct-balance">
            <div style={{ minWidth: 0 }}>
              <div className="eyebrow">现在能用的积分</div>
              <div className="acct-balance-total num" style={{ marginTop: 8 }}>{formatCredits(wallet.totalBalance)}</div>
              <div style={{ fontSize: 12.5, color: "var(--ink-3)", marginTop: 8, lineHeight: 1.6 }}>
                AI 写剧情、拆分镜、出首帧和生成视频会扣积分，按钮上标了扣多少；配音不扣积分。积分不够时会提示你来这里充值。
              </div>
            </div>
            <div className="acct-balance-parts" aria-label="余额由这三部分组成">
              <div className="acct-balance-part">
                <span className="eyebrow">充值积分</span>
                <span className="num">{formatCredits(wallet.rechargeBalance)}</span>
              </div>
              <div className="acct-balance-part">
                <span className="eyebrow">赠送积分</span>
                <span className="num">{formatCredits(wallet.giftBalance)}</span>
              </div>
              <div className="acct-balance-part">
                <span className="eyebrow">激活码积分</span>
                <span className="num">{formatCredits(wallet.licenseBalance)}</span>
              </div>
            </div>
            <div className="acct-balance-frozen">
              <span>
                冻结中 <b className="num" style={{ color: "var(--ink)" }}>{formatCredits(wallet.pendingBalance)}</b>
              </span>
              <span style={{ color: "var(--ink-3)" }}>生成、发布这类要等结果的操作会先冻结积分，没用上的会退回。不算在上面的余额里。</span>
            </div>
          </div>
        </Card>
      )}

      <Card style={{ padding: "22px 24px" }}>
        <SectionHeader eyebrow="充值" title="选一个套餐" />
        {pkgQ.isLoading && <LoadingBlock rows={2} height={96} />}
        {!!pkgQ.error && <ErrorBlock onRetry={pkgQ.refetch} />}
        {!pkgQ.isLoading && creditPkgs.length === 0 && !pkgQ.error && (
          <EmptyState icon={<Coins size={24} />} title="暂时没有可买的套餐" description="晚点再来看看，或者联系我们。" />
        )}
        {creditPkgs.length > 0 && (
          <div className="acct-pkg-grid">
            {creditPkgs.map((p) => (
              <PkgCard key={p.id} p={p} active={selected?.id === p.id} onClick={() => setSelected(selected?.id === p.id ? null : p)} />
            ))}
          </div>
        )}
      </Card>

      {selected && (
        <div className="acct-paybar" role="region" aria-label="已选套餐">
          <div className="acct-paybar-text">
            已选 <strong style={{ color: "var(--ink)" }}>{selected.tag}</strong> ·{" "}
            {selected.grantStorageMb
              ? `存储 +${fmtStorageMb(selected.grantStorageMb)}`
              : `${formatCredits(selected.credits)}${selected.bonusCredits ? ` + 赠 ${formatCredits(selected.bonusCredits)}` : ""} 积分`}
          </div>
          <Button variant="primary" size="md" loading={paying} onClick={startOnlinePay}>
            去支付 {formatCurrency(selected.priceCents)}
          </Button>
        </div>
      )}

      {(storagePkgs.length > 0 || (wantStorage && !pkgQ.isLoading)) && (
        <div ref={storageRef} style={{ scrollMarginTop: 16 }}>
          <Card style={{ padding: "22px 24px" }}>
            <SectionHeader eyebrow="存储" title="买存储空间" />
            <div style={{ fontSize: 12.5, color: "var(--ink-2)", marginBottom: 14, lineHeight: 1.6 }}>
              生成和上传的图片、视频都占空间，回收站里的也算。买完马上生效。
            </div>
            {storagePkgs.length > 0 ? (
              <div className="acct-pkg-grid">
                {storagePkgs.map((p) => (
                  <PkgCard key={p.id} p={p} active={selected?.id === p.id} onClick={() => setSelected(selected?.id === p.id ? null : p)} />
                ))}
              </div>
            ) : (
              <EmptyState
                icon={<HardDrive size={24} />}
                title="存储套餐还没开放"
                description="空间不够时，可以先清空回收站。"
                action={
                  <Link href="/trash" style={{ textDecoration: "none" }}>
                    <Button variant="secondary" size="md">去回收站</Button>
                  </Link>
                }
              />
            )}
          </Card>
        </div>
      )}

      <Card style={{ padding: "22px 24px" }}>
        <SectionHeader
          eyebrow="订单"
          title="充值订单"
          right={
            <Button variant="ghost" size="sm" onClick={() => ordersQ.refetch()}>
              <RefreshCw size={11} />
              刷新
            </Button>
          }
        />
        {ordersQ.isLoading && <LoadingBlock rows={3} height={44} />}
        {!!ordersQ.error && !ordersQ.isLoading && <ErrorBlock onRetry={ordersQ.refetch} />}
        {!ordersQ.isLoading && !ordersQ.error && orders.length === 0 && (
          <EmptyState icon={<Coins size={24} />} title="还没有充值订单" description="买过的套餐会列在这里。" />
        )}
        {orders.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {orders.map((o) => (
              <div
                key={o.id}
                style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8, padding: "12px 16px", borderRadius: "var(--radius-sm)", border: "1px solid var(--line)" }}
              >
                <div style={{ minWidth: 0, flex: "1 1 200px" }}>
                  <div style={{ fontSize: 13, color: "var(--ink)" }}>
                    {o.packageTag ?? "充值套餐"} · {formatCredits(o.credits)}
                    {o.bonusCredits ? ` + 赠 ${formatCredits(o.bonusCredits)}` : ""} 积分
                  </div>
                  <div className="num" style={{ fontSize: 11.5, color: "var(--ink-3)", marginTop: 2 }}>
                    {formatDateTime(o.createdAt)} · {formatCurrency(o.priceCents)}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flex: "none" }}>
                  <StatusBadge tone={ORDER_TONE[o.status]}>{ORDER_LABEL[o.status]}</StatusBadge>
                  {o.status === "pending" && (
                    <>
                      {/* 「稍后再说」离开收银台的订单从这里回去付（服务端同套餐的待支付单会复用，不会多下一单）。 */}
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => router.push(`/wallet/checkout?order=${encodeURIComponent(o.id)}`)}
                      >
                        继续支付
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => void cancelOrder(o)}>
                        取消
                      </Button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card style={{ padding: "22px 24px" }}>
        <SectionHeader
          eyebrow="每一笔积分进出"
          title="积分明细"
          right={
            <Button variant="ghost" size="sm" onClick={() => ledgerQ.refetch()}>
              <RefreshCw size={11} />
              刷新
            </Button>
          }
        />
        {ledgerQ.isLoading && <LoadingBlock rows={4} height={40} />}
        {!!ledgerQ.error && !ledgerQ.isLoading && <ErrorBlock onRetry={ledgerQ.refetch} />}
        {!ledgerQ.isLoading && !ledgerQ.error && ledger.length === 0 && (
          <EmptyState
            icon={<ListOrdered size={24} />}
            title="还没有积分记录"
            description="充值、激活码到账、冻结、扣除和退回，都会一条条记在这里。"
          />
        )}
        {ledger.length > 0 && (
          <>
            <div style={{ fontSize: 12, color: "var(--ink-3)", marginBottom: 10, lineHeight: 1.6 }}>
              生成、发布这类要等结果的操作先冻结积分，结算时记一条「{HOLD_SETTLEMENT_LABEL}」，余额不会再少；没用上的积分记一条「{LEDGER_TYPE_LABEL.unfreeze}」加回来。
            </div>
            <LedgerList entries={ledger} />
            {ledger.length >= LEDGER_PAGE_SIZE && (
              <div style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 10 }}>只显示最近 {LEDGER_PAGE_SIZE} 条。</div>
            )}
          </>
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
      type="button"
      onClick={onClick}
      aria-pressed={active}
      style={{
        display: "flex",
        flexDirection: "column",
        textAlign: "left",
        padding: "14px 16px",
        borderRadius: "var(--radius-sm)",
        cursor: "pointer",
        border: active ? "1.5px solid var(--accent)" : "1px solid var(--line)",
        background: active ? "color-mix(in srgb, var(--accent) 8%, transparent)" : "var(--surface)",
        position: "relative",
        minWidth: 0,
      }}
    >
      {p.recommended && (
        <span className="acct-pkg-badge">
          <Sparkles size={11} /> 推荐
        </span>
      )}
      <div style={{ fontSize: 13, color: "var(--ink-2)", paddingRight: p.recommended ? 40 : 0 }}>{p.tag}</div>
      {isStorage ? (
        <div className="num" style={{ fontSize: 22, fontWeight: 800, color: "var(--ink)", marginTop: 4 }}>
          +{fmtStorageMb(p.grantStorageMb!)}
        </div>
      ) : (
        <>
          <div className="num" style={{ fontSize: 24, fontWeight: 800, color: "var(--ink)", marginTop: 4 }}>
            {formatCredits(p.credits)}
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-3)", marginLeft: 4 }}>积分</span>
          </div>
          {!!p.bonusCredits && (
            <div style={{ fontSize: 12, color: "var(--success)", marginTop: 2 }}>另赠 {formatCredits(p.bonusCredits)}</div>
          )}
        </>
      )}
      <div className="num" style={{ fontSize: 15, fontWeight: 700, color: "var(--accent)", marginTop: "auto", paddingTop: 8 }}>
        {formatCurrency(p.priceCents)}
      </div>
    </button>
  );
}
