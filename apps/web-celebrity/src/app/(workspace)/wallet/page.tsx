"use client";

// ────────────────────────────────────────────────────────────────────────────
// 积分钱包页（v0.56）
//
// 四块布局：
//   1) 顶部四桶汇总（可用 / 充值 / License / 赠送 / 冻结）
//   2) 充值套餐列表（点击 → 生成「充值申请」账单，平台运营线下收款后核准方到账）
//   3) 我的充值订单（待确认 / 已到账 / 已驳回 / 已取消，可取消待确认单）
//   4) 流水（最近 50 条）
//
// v0.56 起取消「点套餐直接入账」的旧 MVP：未付款不再发积分。下单 → 运营 admin 核准 → 入账。
// ────────────────────────────────────────────────────────────────────────────

import * as React from "react";
import { AccountApi } from "@ai-star-eco/api-client";
import {
  formatCredits,
  formatCurrency,
  formatSignedCredits,
} from "@ai-star-eco/api-client/format";
import type {
  LedgerEntry,
  LedgerEntryType,
  RechargeOrder,
  RechargeOrderStatus,
  RechargePackage,
} from "@ai-star-eco/types/wallet";
import { Card, Button, Chip } from "@/components/creator";
import { useCelebrityShell } from "@/lib/celebrity-shell-context";

type ChipTone = "accent" | "success" | "warning" | "danger" | "info" | "neutral";
const ENTRY_META: Record<LedgerEntryType, { label: string; tone: ChipTone }> = {
  license_grant: { label: "License 入账", tone: "accent" },
  recharge:      { label: "充值入账",     tone: "success" },
  refund:        { label: "退款入账",     tone: "success" },
  income:        { label: "业务收益",     tone: "success" },
  gift:          { label: "平台赠送",     tone: "accent" },
  spend:         { label: "消费扣减",     tone: "danger" },
  withdraw:      { label: "提现扣减",     tone: "danger" },
  freeze:        { label: "冻结",         tone: "neutral" },
  unfreeze:      { label: "解冻",         tone: "neutral" },
  adjust:        { label: "管理员调整",   tone: "neutral" },
};

const ORDER_STATUS_META: Record<RechargeOrderStatus, { label: string; tone: ChipTone }> = {
  pending:   { label: "待平台确认", tone: "warning" },
  paid:      { label: "已到账",     tone: "success" },
  rejected:  { label: "已驳回",     tone: "danger" },
  cancelled: { label: "已取消",     tone: "neutral" },
};

const REFERENCE_LABELS: Record<string, string> = {
  mixcut_job: "混剪生成",
  celebrity_generation: "AI 明星生成",
  publish_job_upload: "分发上传",
  recharge_order: "充值订单",
  recharge_order_bonus: "充值赠送",
  LLM_CALL: "AI 模型调用",
  INCUBATION: "数字 IP 孵化",
};

function ledgerReferenceLabel(e: LedgerEntry): string {
  if (!e.referenceType) return "";
  return REFERENCE_LABELS[e.referenceType] ?? e.referenceType;
}

export default function WalletPage() {
  const { wallet, walletLoading } = useCelebrityShell();
  const [packages, setPackages] = React.useState<RechargePackage[]>([]);
  const [packagesLoading, setPackagesLoading] = React.useState(true);
  const [orders, setOrders] = React.useState<RechargeOrder[]>([]);
  const [ordersLoading, setOrdersLoading] = React.useState(true);
  const [ledger, setLedger] = React.useState<LedgerEntry[]>([]);
  const [ledgerLoading, setLedgerLoading] = React.useState(true);
  const [selectedPkg, setSelectedPkg] = React.useState<RechargePackage | null>(null);
  const [note, setNote] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [cancelingId, setCancelingId] = React.useState<string | null>(null);
  const [toast, setToast] = React.useState<{ text: string; tone: "ok" | "err" } | null>(null);

  const flashToast = React.useCallback((text: string, tone: "ok" | "err") => {
    setToast({ text, tone });
    setTimeout(() => setToast(null), 4000);
  }, []);

  const loadLedger = React.useCallback(async () => {
    setLedgerLoading(true);
    try {
      setLedger(await AccountApi.getMyLedger(0, 50));
    } catch {
      setLedger([]);
    } finally {
      setLedgerLoading(false);
    }
  }, []);

  const loadOrders = React.useCallback(async () => {
    setOrdersLoading(true);
    try {
      setOrders(await AccountApi.listMyRechargeOrders());
    } catch {
      setOrders([]);
    } finally {
      setOrdersLoading(false);
    }
  }, []);

  React.useEffect(() => {
    (async () => {
      setPackagesLoading(true);
      try {
        setPackages(await AccountApi.listRechargePackages());
      } catch {
        setPackages([]);
      } finally {
        setPackagesLoading(false);
      }
    })();
    loadOrders();
    loadLedger();
  }, [loadOrders, loadLedger]);

  const submitOrder = async () => {
    if (!selectedPkg || submitting) return;
    setSubmitting(true);
    try {
      await AccountApi.createRechargeOrder({ packageId: selectedPkg.id, note: note.trim() || undefined });
      flashToast("充值申请已提交，平台确认收款后将自动到账", "ok");
      setSelectedPkg(null);
      setNote("");
      await loadOrders();
    } catch (e: unknown) {
      flashToast(e instanceof Error ? e.message : "提交失败，请稍后再试", "err");
    } finally {
      setSubmitting(false);
    }
  };

  const cancelOrder = async (order: RechargeOrder) => {
    if (cancelingId) return;
    setCancelingId(order.id);
    try {
      await AccountApi.cancelRechargeOrder(order.id);
      flashToast("已取消该充值订单", "ok");
      await loadOrders();
    } catch (e: unknown) {
      flashToast(e instanceof Error ? e.message : "取消失败，请稍后再试", "err");
    } finally {
      setCancelingId(null);
    }
  };

  const total = wallet?.totalBalance ?? 0;
  const pending = wallet?.pendingBalance ?? 0;
  const pendingOrders = orders.filter((o) => o.status === "pending");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, padding: "8px 0 32px" }}>
      {/* 顶部 hero · 四桶汇总 ------------------------------------------------- */}
      <Card>
        <div style={{ padding: "24px 28px" }}>
          <div style={{ fontSize: 12, color: "var(--fg-2)", letterSpacing: "0.06em", textTransform: "uppercase" }}>
            可用积分余额
          </div>
          <div
            style={{
              fontSize: 40,
              fontWeight: 700,
              fontFamily: "var(--font-mono)",
              color: "var(--fg-0)",
              marginTop: 4,
            }}
          >
            {walletLoading && !wallet ? "—" : formatCredits(total)}
          </div>
          {pending > 0 && (
            <div style={{ fontSize: 12, color: "var(--fg-2)", marginTop: 6 }}>
              另有 <strong style={{ color: "var(--accent-strong)" }}>{formatCredits(pending)}</strong> 已冻结（任务进行中，完成后真扣 / 失败自动退回）
            </div>
          )}

          <div className="stack-mobile-2" style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 12, marginTop: 20 }}>
            <BucketTile label="充值积分" hint="充值入账，永不过期" value={wallet?.rechargeBalance ?? 0} />
            <BucketTile label="License 积分" hint="激活码核销" value={wallet?.licenseBalance ?? 0} />
            <BucketTile label="赠送积分" hint="平台活动 / 运营调账" value={wallet?.giftBalance ?? 0} />
            <BucketTile label="冻结中" hint="任务进行中，结算后回桶" value={pending} muted />
          </div>

          <div style={{ marginTop: 16, fontSize: 11, color: "var(--fg-3)", lineHeight: 1.6 }}>
            扣费顺序：赠送 → License → 充值（同价值积分先消耗有限期最严的桶）。所有变动均经
            <a style={{ color: "var(--accent)", marginInline: 4 }} href="#ledger">流水</a>
            记录，不可篡改。
          </div>
        </div>
      </Card>

      {/* 充值套餐 ------------------------------------------------------------- */}
      <Card>
        <div style={{ padding: "20px 28px 24px" }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 16, gap: 12, flexWrap: "wrap" }}>
            <h2 style={{ fontSize: 16, fontWeight: 600, color: "var(--fg-0)" }}>充值套餐</h2>
            <span style={{ fontSize: 11, color: "var(--fg-3)" }}>下单后生成充值申请，平台确认收款后到账（积分不会在付款前发放）。</span>
          </div>
          {packagesLoading ? (
            <div style={{ fontSize: 13, color: "var(--fg-2)" }}>套餐加载中</div>
          ) : packages.length === 0 ? (
            <div style={{ fontSize: 13, color: "var(--fg-2)" }}>当前没有可购买的套餐，请联系平台运营。</div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 14 }}>
              {packages.map((pkg) => (
                <PackageTile
                  key={pkg.id}
                  pkg={pkg}
                  selected={selectedPkg?.id === pkg.id}
                  onClick={() => { setSelectedPkg(pkg); setNote(""); }}
                />
              ))}
            </div>
          )}

          {/* 下单确认面板 */}
          {selectedPkg && (
            <div
              style={{
                marginTop: 16,
                padding: "16px 18px",
                borderRadius: 12,
                border: "1px solid var(--accent)",
                background: "color-mix(in srgb, var(--accent) 6%, var(--bg-1))",
                display: "flex",
                flexDirection: "column",
                gap: 12,
              }}
            >
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--fg-0)" }}>
                  确认充值申请 · {selectedPkg.tag}
                </div>
                <div style={{ fontSize: 13, color: "var(--fg-1)", fontFamily: "var(--font-mono)" }}>
                  {formatCredits(selectedPkg.credits)}
                  {selectedPkg.bonusCredits ? ` + 赠 ${formatCredits(selectedPkg.bonusCredits)}` : ""} 积分 · {formatCurrency(selectedPkg.priceCents)}
                </div>
              </div>
              <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <span style={{ fontSize: 12, color: "var(--fg-2)" }}>备注（可选）：付款方式 / 转账后四位，便于平台核对收款</span>
                <input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="如：对公转账 尾号 1234"
                  maxLength={200}
                  style={{
                    width: "100%",
                    background: "var(--bg-2)",
                    border: "1px solid var(--line-2)",
                    borderRadius: 8,
                    padding: "9px 12px",
                    fontSize: 13,
                    color: "var(--fg-0)",
                    outline: "none",
                  }}
                />
              </label>
              <div style={{ fontSize: 11.5, color: "var(--fg-3)", lineHeight: 1.6 }}>
                提交后请按平台提供的收款方式完成付款；平台确认到账后积分自动入账。如需付款方式，请联系平台客户经理。
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <Button variant="accent" size="sm" onClick={submitOrder} disabled={submitting}>
                  {submitting ? "提交中…" : "提交充值申请"}
                </Button>
                <Button variant="secondary" size="sm" onClick={() => setSelectedPkg(null)} disabled={submitting}>
                  取消
                </Button>
              </div>
            </div>
          )}

          {toast && (
            <div
              role="status"
              style={{
                marginTop: 14,
                padding: "8px 12px",
                borderRadius: 8,
                fontSize: 13,
                background:
                  toast.tone === "ok"
                    ? "color-mix(in srgb, #22c55e 14%, transparent)"
                    : "color-mix(in srgb, #ef4444 14%, transparent)",
                color: toast.tone === "ok" ? "#15803d" : "#b91c1c",
                border: `1px solid ${toast.tone === "ok" ? "#86efac" : "#fca5a5"}`,
              }}
            >
              {toast.text}
            </div>
          )}
        </div>
      </Card>

      {/* 我的充值订单 -------------------------------------------------------- */}
      <Card>
        <div style={{ padding: "20px 28px 24px" }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 14, gap: 12 }}>
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 600, color: "var(--fg-0)" }}>我的充值订单</h2>
              {pendingOrders.length > 0 && (
                <div style={{ fontSize: 11.5, color: "var(--fg-2)", marginTop: 4 }}>
                  {pendingOrders.length} 笔待平台确认收款
                </div>
              )}
            </div>
            <Button variant="secondary" size="sm" onClick={loadOrders} disabled={ordersLoading}>
              {ordersLoading ? "刷新中" : "刷新"}
            </Button>
          </div>
          {ordersLoading && orders.length === 0 ? (
            <div style={{ fontSize: 13, color: "var(--fg-2)" }}>订单加载中</div>
          ) : orders.length === 0 ? (
            <div style={{ fontSize: 13, color: "var(--fg-2)" }}>还没有充值订单。在上方选择套餐即可提交充值申请。</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {orders.map((o) => (
                <OrderRow key={o.id} order={o} onCancel={() => cancelOrder(o)} canceling={cancelingId === o.id} />
              ))}
            </div>
          )}
        </div>
      </Card>

      {/* 流水 --------------------------------------------------------------- */}
      <Card>
        <div id="ledger" style={{ padding: "20px 28px 24px" }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 14 }}>
            <h2 style={{ fontSize: 16, fontWeight: 600, color: "var(--fg-0)" }}>积分流水</h2>
            <Button variant="secondary" size="sm" onClick={loadLedger} disabled={ledgerLoading}>
              {ledgerLoading ? "刷新中" : "刷新"}
            </Button>
          </div>
          {ledgerLoading && ledger.length === 0 ? (
            <div style={{ fontSize: 13, color: "var(--fg-2)" }}>流水加载中</div>
          ) : ledger.length === 0 ? (
            <div style={{ fontSize: 13, color: "var(--fg-2)" }}>还没有积分流水。生成视频、分发任务或充值到账后会在这里出现。</div>
          ) : (
            <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 0, minWidth: 560 }}>
                <LedgerHeader />
                {ledger.map((e) => (
                  <LedgerRow key={e.id} entry={e} />
                ))}
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

// ── tiles ──────────────────────────────────────────────────────────────────

function BucketTile({
  label,
  hint,
  value,
  muted,
}: {
  label: string;
  hint: string;
  value: number;
  muted?: boolean;
}) {
  return (
    <div
      style={{
        padding: "12px 14px",
        background: muted ? "color-mix(in srgb, var(--accent) 10%, transparent)" : "var(--bg-2)",
        borderRadius: 10,
        border: "1px solid var(--line)",
      }}
    >
      <div style={{ fontSize: 11, color: "var(--fg-2)", letterSpacing: "0.04em" }}>{label}</div>
      <div
        style={{
          fontSize: 22,
          fontWeight: 600,
          fontFamily: "var(--font-mono)",
          color: muted ? "var(--accent-strong)" : "var(--fg-0)",
          marginTop: 4,
        }}
      >
        {formatCredits(value)}
      </div>
      <div style={{ fontSize: 11, color: "var(--fg-3)", marginTop: 2 }}>{hint}</div>
    </div>
  );
}

function PackageTile({
  pkg,
  selected,
  onClick,
}: {
  pkg: RechargePackage;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <div
      style={{
        padding: 16,
        borderRadius: 12,
        background: "var(--bg-1)",
        border: `1px solid ${selected ? "var(--accent)" : pkg.recommended ? "var(--accent)" : "var(--line)"}`,
        boxShadow: selected || pkg.recommended ? "0 0 0 3px color-mix(in srgb, var(--accent) 14%, transparent)" : undefined,
        display: "flex",
        flexDirection: "column",
        gap: 8,
        position: "relative",
      }}
    >
      {pkg.recommended && (
        <span
          style={{
            position: "absolute",
            top: -8,
            right: 12,
            padding: "2px 8px",
            borderRadius: 99,
            fontSize: 10,
            fontWeight: 600,
            background: "var(--accent)",
            color: "white",
            letterSpacing: "0.04em",
          }}
        >
          推荐
        </span>
      )}
      <Chip tone="neutral">{pkg.tag}</Chip>
      <div style={{ fontSize: 24, fontWeight: 700, fontFamily: "var(--font-mono)", color: "var(--fg-0)" }}>
        {formatCredits(pkg.credits)}
        <span style={{ fontSize: 12, fontWeight: 400, color: "var(--fg-2)", marginLeft: 4 }}>积分</span>
      </div>
      {!!pkg.bonusCredits && pkg.bonusCredits > 0 && (
        <div style={{ fontSize: 12, color: "var(--accent-strong)" }}>赠送 {formatCredits(pkg.bonusCredits)} 积分</div>
      )}
      <div style={{ fontSize: 13, color: "var(--fg-1)" }}>{formatCurrency(pkg.priceCents)}</div>
      <Button variant={selected ? "accent" : pkg.recommended ? "accent" : "secondary"} size="sm" onClick={onClick}>
        {selected ? "已选择" : "申请充值"}
      </Button>
    </div>
  );
}

// ── orders ──────────────────────────────────────────────────────────────────

function OrderRow({
  order,
  onCancel,
  canceling,
}: {
  order: RechargeOrder;
  onCancel: () => void;
  canceling: boolean;
}) {
  const meta = ORDER_STATUS_META[order.status];
  const dt = new Date(order.createdAt);
  const ts = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")} ${String(dt.getHours()).padStart(2, "0")}:${String(dt.getMinutes()).padStart(2, "0")}`;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: "12px 14px",
        background: "var(--bg-1)",
        border: "1px solid var(--line)",
        borderRadius: 10,
        flexWrap: "wrap",
      }}
    >
      <div style={{ flex: 1, minWidth: 180 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--fg-0)" }}>{order.packageTag ?? "充值套餐"}</span>
          <Chip tone={meta.tone} size="sm">{meta.label}</Chip>
        </div>
        <div className="mono" style={{ fontSize: 11, color: "var(--fg-2)", letterSpacing: 0.3 }}>
          {ts} · 订单 {order.id}
          {order.userNote ? ` · 备注：${order.userNote}` : ""}
        </div>
        {order.status === "rejected" && order.reviewNote && (
          <div style={{ fontSize: 11.5, color: "var(--danger)", marginTop: 3 }}>驳回原因：{order.reviewNote}</div>
        )}
      </div>
      <div style={{ textAlign: "right" }}>
        <div style={{ fontSize: 14, fontWeight: 700, fontFamily: "var(--font-mono)", color: "var(--fg-0)" }}>
          {formatCredits(order.credits)}{order.bonusCredits ? ` +${formatCredits(order.bonusCredits)}` : ""}
        </div>
        <div style={{ fontSize: 11, color: "var(--fg-2)" }}>{formatCurrency(order.priceCents)}</div>
      </div>
      {order.status === "pending" && (
        <Button variant="secondary" size="sm" onClick={onCancel} disabled={canceling}>
          {canceling ? "取消中…" : "取消"}
        </Button>
      )}
    </div>
  );
}

// ── ledger ──────────────────────────────────────────────────────────────────

function LedgerHeader() {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "150px 120px 1fr 120px 110px",
        padding: "8px 12px",
        fontSize: 11,
        color: "var(--fg-2)",
        letterSpacing: "0.04em",
        textTransform: "uppercase",
        borderBottom: "1px solid var(--line)",
      }}
    >
      <div>时间</div>
      <div>类型</div>
      <div>说明</div>
      <div style={{ textAlign: "right" }}>积分变动</div>
      <div style={{ textAlign: "right" }}>变动后余额</div>
    </div>
  );
}

function LedgerRow({ entry }: { entry: LedgerEntry }) {
  const meta = ENTRY_META[entry.type];
  const ref = ledgerReferenceLabel(entry);
  const dt = new Date(entry.createdAt);
  const ts = `${dt.getMonth() + 1}-${String(dt.getDate()).padStart(2, "0")} ${String(dt.getHours()).padStart(2, "0")}:${String(dt.getMinutes()).padStart(2, "0")}`;
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "150px 120px 1fr 120px 110px",
        padding: "10px 12px",
        fontSize: 13,
        borderBottom: "1px solid color-mix(in srgb, var(--line) 50%, transparent)",
        alignItems: "center",
      }}
    >
      <div style={{ color: "var(--fg-2)", fontFamily: "var(--font-mono)", fontSize: 12 }}>{ts}</div>
      <div>
        <Chip tone={meta.tone}>{meta.label}</Chip>
      </div>
      <div style={{ color: "var(--fg-1)", lineHeight: 1.4 }}>
        <div>{entry.description || "—"}</div>
        {ref && <div style={{ fontSize: 11, color: "var(--fg-3)", marginTop: 2 }}>{ref}</div>}
      </div>
      <div
        style={{
          textAlign: "right",
          fontFamily: "var(--font-mono)",
          fontWeight: 600,
          color: entry.amount >= 0 ? "#15803d" : "#b91c1c",
        }}
      >
        {formatSignedCredits(entry.amount)}
      </div>
      <div style={{ textAlign: "right", fontFamily: "var(--font-mono)", color: "var(--fg-2)" }}>
        {formatCredits(entry.balanceAfter)}
      </div>
    </div>
  );
}
