"use client";

export const dynamic = "force-dynamic";

// 收入与提现（原「财务中心」，v0.197 改名）：作品收入与提现记录，外加存储空间用量。
// 两类都**按积分记**：收入（INCOME）以积分到账、进赠送积分（CreditService.creditAccount），
// 提现也从积分里扣 —— 这一页不是现金账。
// 积分余额、充值、积分明细都在「积分钱包」（/wallet），这里不再重复一套余额卡 ——
// 之前两页各有一套余额、分项名还对不上（授权额度 / 充值额度 / 待结算 vs 充值积分 / 赠送积分 / 冻结中）。
//
// 记录来自积分账本（AccountApi.getMyLedger）里的 income / withdraw 两类：账本类型是精确的；
// 旧的 /finance/transactions 把赠送、失败退回、调账都投影成「收入」，放在这一页会误导。
// /me/ledger 不能按类型筛，所以一页页往前翻（ledger.ts 的 scanLedger），凑够一屏或翻完为止；
// 只看最近 100 条再在前端筛，生成流水一多，收入就被挤没了、还显示「没有记录」（评审 AC1）。
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, RefreshCw, Wallet as WalletIcon } from "lucide-react";
import type { LedgerEntry, RechargePackage } from "@ai-star-eco/types/wallet";
import { AccountApi } from "@ai-star-eco/api-client";
import { formatCredits } from "@ai-star-eco/api-client/format";
import { Button, Card } from "@/components/premium";
import {
  EmptyState,
  ErrorBlock,
  LoadingBlock,
  SectionHeader,
  ViewHeader,
} from "@/components/common";
import { StorageApi } from "@/api";
import type { StorageUsage } from "@/api/storage";
import { useAsync } from "@/lib/drama-query";
import { useWallet } from "@/lib/use-wallet";
import { LedgerList } from "../_shared/LedgerList";
import { appendUnique, scanLedger } from "../_shared/ledger";

type Filter = "all" | "income" | "withdraw";
const FILTER_LABEL: Record<Filter, string> = { all: "全部", income: "收入", withdraw: "提现" };
const INCOME_TYPES = new Set<LedgerEntry["type"]>(["income", "withdraw"]);
const isIncomeOrWithdraw = (e: LedgerEntry) => INCOME_TYPES.has(e.type);

/** 每页取多少条流水、凑够多少条收入 / 提现算「一屏」、一次最多翻几页（再多就让用户点「加载更多」）。 */
const SCAN_PAGE_SIZE = 100;
const SCAN_WANT = 20;
const SCAN_MAX_PAGES = 5;

interface ScanState {
  entries: LedgerEntry[];
  nextPage: number;
  done: boolean;
  scanned: number;
}

/**
 * 收入 / 提现记录：从最新一页往前翻，凑够一屏或翻完就停；「加载更多」接着往前翻。
 * 刷新会从头来过；并发的旧请求结果按 seq 丢掉，不会把新结果覆盖回去。
 */
function useIncomeLedger() {
  const [state, setState] = React.useState<ScanState | null>(null);
  const [loading, setLoading] = React.useState(true); // 挂载就开始翻，首帧给骨架而不是空白
  // 记下是哪一步失败的：刷新失败要重新刷新，「加载更多」失败要接着上次的页码再翻。
  const [error, setError] = React.useState<{ op: "reset" | "more"; cause: unknown } | null>(null);
  const seq = React.useRef(0);
  const stateRef = React.useRef<ScanState | null>(null);
  const loadingRef = React.useRef(false);
  stateRef.current = state;

  const run = React.useCallback(async (reset: boolean) => {
    const base = reset ? null : stateRef.current;
    // 「加载更多」只在空闲、且还没翻完时接着翻；刷新随时可以打断，旧结果按 seq 作废。
    if (!reset && (loadingRef.current || !base || base.done)) return;
    const my = ++seq.current;
    loadingRef.current = true;
    setLoading(true);
    setError(null);
    try {
      const r = await scanLedger((page, size) => AccountApi.getMyLedger(page, size), {
        keep: isIncomeOrWithdraw,
        startPage: base?.nextPage ?? 0,
        pageSize: SCAN_PAGE_SIZE,
        want: SCAN_WANT,
        maxPages: SCAN_MAX_PAGES,
      });
      if (my !== seq.current) return;
      setState({
        entries: appendUnique(base?.entries ?? [], r.matched),
        nextPage: r.nextPage,
        done: r.done,
        scanned: (base?.scanned ?? 0) + r.scanned,
      });
    } catch (e) {
      if (my === seq.current) setError({ op: reset ? "reset" : "more", cause: e });
    } finally {
      if (my === seq.current) {
        loadingRef.current = false;
        setLoading(false);
      }
    }
  }, []);

  React.useEffect(() => {
    void run(true);
  }, [run]);

  return {
    state,
    loading,
    error,
    refresh: () => void run(true),
    loadMore: () => void run(false),
  };
}

export default function FinancePage() {
  const router = useRouter();
  const [filter, setFilter] = React.useState<Filter>("all");
  const { wallet } = useWallet();

  const storageQ = useAsync<StorageUsage>("/me/storage?app=drama", () => StorageApi.getStorageUsage("drama"), {
    revalidateOnMount: true,
  });
  // 和积分钱包同一个 key：存储套餐有没有开放，决定「买存储空间」按钮给不给。
  const pkgQ = useAsync<RechargePackage[]>("/me/wallet/packages?drama", () => AccountApi.listRechargePackages("drama"));
  const hasStoragePkgs = (pkgQ.data ?? []).some((p) => !!p.grantStorageMb);
  const ledger = useIncomeLedger();
  const scan = ledger.state;
  const all = scan?.entries ?? [];
  const rows = filter === "all" ? all : all.filter((e) => e.type === filter);
  const what = filter === "all" ? "收入或提现" : FILTER_LABEL[filter];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      <ViewHeader
        eyebrow="账户"
        title={
          <>
            收入与{" "}
            <span
              className="text-gradient-gold"
              style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontWeight: 400 }}
            >
              提现
            </span>
          </>
        }
        meta="作品收入和提现记录（按积分记），以及存储空间用量"
      />

      <Link
        href="/wallet"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          padding: "14px 18px",
          borderRadius: "var(--radius)",
          border: "1px solid var(--line)",
          background: "var(--surface)",
          color: "var(--ink-2)",
          fontSize: 13.5,
          textDecoration: "none",
        }}
      >
        <span style={{ minWidth: 0 }}>
          积分余额、充值和积分明细在「积分钱包」
          {wallet && (
            <>
              {" · "}现在能用 <b className="num" style={{ color: "var(--ink)" }}>{formatCredits(wallet.totalBalance)}</b> 积分
            </>
          )}
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 2, color: "var(--accent)", fontWeight: 600, flex: "none" }}>
          去积分钱包 <ChevronRight size={15} />
        </span>
      </Link>

      {storageQ.data && (
        <StorageCard
          usage={storageQ.data}
          canBuy={hasStoragePkgs}
          onBuy={() => router.push("/wallet?tab=storage")}
          onTrash={() => router.push("/trash")}
        />
      )}

      <Card style={{ padding: "22px 24px" }}>
        <SectionHeader
          eyebrow="按积分记"
          title="收入与提现记录"
          right={
            <Button variant="ghost" size="sm" onClick={ledger.refresh} disabled={ledger.loading}>
              <RefreshCw size={11} />
              刷新
            </Button>
          }
        />
        <div className="acct-filter-row">
          {(Object.keys(FILTER_LABEL) as Filter[]).map((f) => {
            const active = filter === f;
            return (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                aria-pressed={active}
                style={{
                  padding: "6px 14px",
                  minHeight: 32,
                  borderRadius: "var(--radius-pill)",
                  border: active
                    ? "1px solid color-mix(in srgb, var(--accent) 50%, transparent)"
                    : "1px solid var(--line)",
                  background: active ? "color-mix(in srgb, var(--accent) 12%, transparent)" : "transparent",
                  color: active ? "var(--accent)" : "var(--ink-2)",
                  fontSize: 12.5,
                  cursor: "pointer",
                }}
              >
                {FILTER_LABEL[f]}
              </button>
            );
          })}
        </div>

        {!scan && ledger.loading && <LoadingBlock rows={4} height={44} />}
        {!scan && !ledger.loading && !!ledger.error && <ErrorBlock onRetry={ledger.refresh} />}
        {/* 「没有记录」只在真的翻完时说；没翻完就说看过多少条、给「加载更多」 */}
        {scan && rows.length === 0 && scan.done && (
          <div data-finance-empty>
            <EmptyState
              icon={<WalletIcon size={24} />}
              title={`还没有${what}记录`}
              description="作品收入会以积分到账，算在「赠送积分」里；提现也从积分里扣。充值和生成扣的积分在「积分钱包」的积分明细里。"
            />
          </div>
        )}
        {scan && rows.length === 0 && !scan.done && (
          <div className="acct-scan-note" data-finance-partial>
            最近 {scan.scanned.toLocaleString("zh-CN")} 条积分记录里没有{what}。点「加载更多」接着往前找。
          </div>
        )}
        {rows.length > 0 && <LedgerList entries={rows} showBalance={false} />}
        {scan && ledger.error && (
          <div className="acct-scan-more">
            <span className="acct-scan-error">没加载出来。</span>
            <Button
              variant="secondary"
              size="sm"
              loading={ledger.loading}
              onClick={ledger.error.op === "reset" ? ledger.refresh : ledger.loadMore}
            >
              重试
            </Button>
          </div>
        )}
        {scan && !ledger.error && !scan.done && (
          <div className="acct-scan-more">
            <Button variant="secondary" size="sm" loading={ledger.loading} onClick={ledger.loadMore} data-finance-more>
              加载更多
            </Button>
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

/** 存储空间用量卡：生成 / 上传的图片视频（含回收站）占用 + 余量 + 买空间入口。 */
function StorageCard({
  usage,
  canBuy,
  onBuy,
  onTrash,
}: {
  usage: StorageUsage;
  canBuy: boolean;
  onBuy: () => void;
  onTrash: () => void;
}) {
  const pct = usage.quotaMb > 0 ? Math.min(100, Math.round((usage.usedMb / usage.quotaMb) * 100)) : 0;
  const near = pct >= 85;
  return (
    <Card style={{ padding: "20px 24px" }}>
      <SectionHeader
        eyebrow="存储"
        title="存储空间"
        right={
          canBuy ? (
            <Button variant="secondary" size="sm" onClick={onBuy}>
              买存储空间
            </Button>
          ) : (
            <Button variant="ghost" size="sm" onClick={onTrash}>
              去回收站
            </Button>
          )
        }
      />
      <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "4px 12px", fontSize: 13, marginBottom: 8 }}>
        <span style={{ color: "var(--ink-2)" }}>
          已用 <b className="num">{fmtMb(usage.usedMb)}</b> / {fmtMb(usage.quotaMb)}（{pct}%）
        </span>
        <span style={{ color: near ? "var(--danger)" : "var(--ink-3)" }}>还剩 {fmtMb(usage.remainingMb)}</span>
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
        <div style={{ display: "flex", gap: "8px 16px", marginTop: 12, flexWrap: "wrap" }}>
          {usage.breakdown.map((s, i) => (
            <span key={s.category} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--ink-2)" }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: STORAGE_COLORS[i % STORAGE_COLORS.length], flex: "none" }} />
              {s.category} · {fmtMb(s.mb)}
            </span>
          ))}
        </div>
      )}
      <div style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 12, lineHeight: 1.6 }}>
        {canBuy
          ? "生成和上传的图片、视频都占空间，回收站里的也算。不够用可以点「买存储空间」。"
          : "生成和上传的图片、视频都占空间，回收站里的也算。存储套餐还没开放，空间不够时可以先清空回收站。"}
      </div>
    </Card>
  );
}
