"use client";

// ────────────────────────────────────────────────────────────────────────────
// 积分钱包页（v0.33）
//
// 三块布局：
//   1) 顶部四桶汇总（可用 / 充值 / License / 赠送 / 冻结）
//   2) 充值套餐列表（点击落账，MVP 走 POST /me/wallet/recharge 直接入账）
//   3) 流水（最近 50 条，按类型上色：FREEZE 冻 / UNFREEZE 解冻 / SPEND 真扣 / REFUND 退还 / RECHARGE 充值 …）
//
// 余额数据走 useCelebrityShell()：shell context 已统一缓存，refreshWallet 触发刷新。
// 充值成功后立刻 refreshWallet + 重新拉 ledger。
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

const REFERENCE_LABELS: Record<string, string> = {
  mixcut_job: "混剪生成",
  celebrity_generation: "AI 明星生成",
  publish_job_upload: "分发上传",
  LLM_CALL: "AI 模型调用",
  INCUBATION: "数字 IP 孵化",
};

function ledgerReferenceLabel(e: LedgerEntry): string {
  if (!e.referenceType) return "";
  return REFERENCE_LABELS[e.referenceType] ?? e.referenceType;
}

export default function WalletPage() {
  const { wallet, walletLoading, refreshWallet } = useCelebrityShell();
  const [packages, setPackages] = React.useState<RechargePackage[]>([]);
  const [packagesLoading, setPackagesLoading] = React.useState(true);
  const [ledger, setLedger] = React.useState<LedgerEntry[]>([]);
  const [ledgerLoading, setLedgerLoading] = React.useState(true);
  const [rechargingId, setRechargingId] = React.useState<string | null>(null);
  const [toast, setToast] = React.useState<{ text: string; tone: "ok" | "err" } | null>(null);

  const loadLedger = React.useCallback(async () => {
    setLedgerLoading(true);
    try {
      const rows = await AccountApi.getMyLedger(0, 50);
      setLedger(rows);
    } catch {
      setLedger([]);
    } finally {
      setLedgerLoading(false);
    }
  }, []);

  React.useEffect(() => {
    (async () => {
      setPackagesLoading(true);
      try {
        const p = await AccountApi.listRechargePackages();
        setPackages(p);
      } catch {
        setPackages([]);
      } finally {
        setPackagesLoading(false);
      }
    })();
    loadLedger();
  }, [loadLedger]);

  const handleRecharge = async (pkg: RechargePackage) => {
    if (rechargingId) return;
    setRechargingId(pkg.id);
    try {
      const resp = await AccountApi.rechargeWallet({ packageId: pkg.id });
      setToast({
        text: `已到账 ${formatCredits(pkg.credits)}${pkg.bonusCredits ? ` + 赠 ${formatCredits(pkg.bonusCredits)}` : ""} 积分`,
        tone: "ok",
      });
      await refreshWallet();
      await loadLedger();
      // 让 wallet 余额 chip 看到最新值（refreshWallet 已触发，这里只是确保）
      void resp;
    } catch (e: unknown) {
      setToast({
        text: e instanceof Error ? e.message : "充值失败，请稍后再试",
        tone: "err",
      });
    } finally {
      setRechargingId(null);
      setTimeout(() => setToast(null), 3500);
    }
  };

  const total = wallet?.totalBalance ?? 0;
  const pending = wallet?.pendingBalance ?? 0;

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

          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 12, marginTop: 20 }}>
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
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 16 }}>
            <h2 style={{ fontSize: 16, fontWeight: 600, color: "var(--fg-0)" }}>充值套餐</h2>
            <span style={{ fontSize: 11, color: "var(--fg-3)" }}>当前为体验版：选择套餐后直接到账。正式上线后将接入微信支付与对公转账。</span>
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
                  busy={rechargingId === pkg.id}
                  onClick={() => handleRecharge(pkg)}
                />
              ))}
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
            <div style={{ fontSize: 13, color: "var(--fg-2)" }}>还没有积分流水。生成视频、分发任务或充值后会在这里出现。</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
              <LedgerHeader />
              {ledger.map((e) => (
                <LedgerRow key={e.id} entry={e} />
              ))}
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
  busy,
  onClick,
}: {
  pkg: RechargePackage;
  busy: boolean;
  onClick: () => void;
}) {
  return (
    <div
      style={{
        padding: 16,
        borderRadius: 12,
        background: "var(--bg-1)",
        border: `1px solid ${pkg.recommended ? "var(--accent)" : "var(--line)"}`,
        boxShadow: pkg.recommended ? "0 0 0 3px color-mix(in srgb, var(--accent) 14%, transparent)" : undefined,
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
      <Button variant={pkg.recommended ? "accent" : "secondary"} size="sm" onClick={onClick} disabled={busy}>
        {busy ? "处理中…" : "立即充值"}
      </Button>
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
