// 积分明细的两条纯逻辑（v0.197 评审后修复），LedgerList 与「收入与提现」共用，单测见 ledger.test.tsx。
//
// ① isHoldSettlement：这条「扣除」是不是冻结的结算（余额不再变）。
// ② scanLedger：翻页找某几类记录，直到凑够一屏或翻完。
import type { LedgerEntry } from "@ai-star-eco/types/wallet";

/**
 * 这条流水是不是「冻结 → 扣除」的结算：余额在冻结时已经减掉了，这一条只把冻结转为扣除，余额不变。
 *
 * 判据只看这一条自己的字段，**不依赖同一页里能不能找到对应的「冻结」**
 * —— 之前按当前窗口里的冻结记录去配对，冻结一旦翻出最近 50 条，结算就被画成红色负数「再扣一次」。
 *
 * 服务端写 SPEND 的只有两处（apps/server …/service）：
 *   - CreditService.commitHold：结算冻结。hold 要求 referenceType / referenceId 非空，所以结算一定带引用；
 *   - StoreService.redeem → CreditService.debit(…, SPEND, "store_<type>", …)：商店买断，直接扣余额。
 * 其余直接扣费（DramaRenderService 的首帧等）走 debit 的默认类型 ADJUST，不是 SPEND。
 * 所以「SPEND + 有引用 + 引用不是 store_*」就是结算。服务端再加直接扣费的 SPEND 调用时要同步这里。
 */
export function isHoldSettlement(e: Pick<LedgerEntry, "type" | "referenceType" | "referenceId">): boolean {
  if (e.type !== "spend") return false;
  const refType = e.referenceType?.trim();
  if (!refType || !e.referenceId?.trim()) return false;
  return !refType.toLowerCase().startsWith("store_");
}

export interface LedgerScanResult {
  /** 本次翻到的、符合条件的记录（按服务端顺序：新的在前）。 */
  matched: LedgerEntry[];
  /** 下一次从哪一页接着翻。 */
  nextPage: number;
  /** 服务端已经没有更早的记录了。只有它为 true 时才能说「没有记录」。 */
  done: boolean;
  /** 本次一共看过多少条流水（不论类型）。 */
  scanned: number;
}

/**
 * 从 startPage 开始一页页取流水，只留 keep 为真的，凑够 want 条或者翻完就停；
 * 单次最多翻 maxPages 页（流水很多时别一口气把几千条都拉下来，剩下的让用户点「加载更多」）。
 *
 * 「翻完」的判据是某一页回来的条数少于 pageSize —— /me/ledger 经 apiFetch 只回数组、不带分页信息。
 * 总条数恰好是 pageSize 整数倍时会多取一页空页，然后判定翻完。
 */
export async function scanLedger(
  fetchPage: (page: number, size: number) => Promise<LedgerEntry[]>,
  opts: {
    keep: (e: LedgerEntry) => boolean;
    startPage?: number;
    pageSize?: number;
    want?: number;
    maxPages?: number;
  },
): Promise<LedgerScanResult> {
  const pageSize = Math.max(1, opts.pageSize ?? 100);
  const want = Math.max(1, opts.want ?? 20);
  const maxPages = Math.max(1, opts.maxPages ?? 5);
  let page = Math.max(0, opts.startPage ?? 0);
  const matched: LedgerEntry[] = [];
  let scanned = 0;
  let done = false;
  for (let i = 0; i < maxPages; i++) {
    const rows = await fetchPage(page, pageSize);
    page += 1;
    scanned += rows.length;
    for (const e of rows) if (opts.keep(e)) matched.push(e);
    if (rows.length < pageSize) {
      done = true;
      break;
    }
    if (matched.length >= want) break;
  }
  return { matched, nextPage: page, done, scanned };
}

/** 把新翻到的一批接在已有记录后面，按 id 去重（两次翻页之间有新流水写入时，页边界会错开一条、重复出现）。 */
export function appendUnique(prev: LedgerEntry[], next: LedgerEntry[]): LedgerEntry[] {
  const seen = new Set(prev.map((e) => e.id));
  const out = prev.slice();
  for (const e of next) {
    if (seen.has(e.id)) continue;
    seen.add(e.id);
    out.push(e);
  }
  return out;
}
