"use client";

// 积分明细列表（v0.197）：积分钱包的「积分明细」与「收入与提现」共用。
// 数据来自 AccountApi.getMyLedger（服务端不可变账本 LedgerEntry，§4.2），时间一律 formatDateTime（§4.8）。
//
// 要等结果的扣费是三段式（CreditService.hold / commitHold / releaseHold）：先「冻结」一笔（余额减少、
// 进冻结中）→ 结算记一条「扣除」（余额不再变）→ 没用上的记一条「退回」（余额加回）。
// 同一笔会出现「冻结」和「扣除」两条同样的数，直接列出来用户会以为扣了两次，
// 所以结算那条「扣除」显示为「冻结转为扣除 · 余额不变」。
// 判定一条是不是结算见 ledger.ts 的 isHoldSettlement（只看这一条自己的字段，不去窗口里找冻结配对）。
//
// 类型列**只说这一笔积分怎么动了，不说事情成没成**（v0.197 评审后修复）：
//   - 走冻结的不只是生成：发布上线（PublishJobService，「发布上线 · …」）也是 hold → commitHold；
//   - 退回不只是失败：音乐按实际时长结算后退差额（MusicGenWorker，「音乐创作时长差额退回」）、
//     超时回收（CreditHoldSweeper）、用户取消都写 UNFREEZE。
// 账本按用户跨产品共享，别的产品写进来的流水也会出现在这里；成败由说明列（服务端写的 description）交代。
import type { LedgerEntry, LedgerEntryType } from "@ai-star-eco/types/wallet";
import { formatCredits, formatDateTime, formatSignedCredits } from "@ai-star-eco/api-client/format";
import { isHoldSettlement } from "./ledger";

/** 积分钱包 / 收入与提现共用的明细缓存键；收银台到账后 invalidate 它。 */
export const LEDGER_CACHE_KEY = "/me/ledger?size=50";
export const LEDGER_PAGE_SIZE = 50;

export const LEDGER_TYPE_LABEL: Record<LedgerEntryType, string> = {
  license_grant: "激活码到账",
  recharge: "充值",
  refund: "退款",
  income: "收入",
  gift: "赠送",
  spend: "扣除",
  withdraw: "提现",
  freeze: "冻结",
  unfreeze: "冻结退回",
  adjust: "平台调整",
  refund_cash: "退款回收",
};

/** 冻结结算那条「扣除」在类型列的叫法（见文件头：不绑定成败）。 */
export const HOLD_SETTLEMENT_LABEL = "冻结转为扣除";

export function LedgerList({ entries, showBalance = true }: { entries: LedgerEntry[]; showBalance?: boolean }) {
  return (
    <div className={showBalance ? "acct-ledger" : "acct-ledger no-after"} role="table" aria-label="积分明细">
      <div className="acct-ledger-head" role="row">
        <span className="acct-ledger-time" role="columnheader">时间</span>
        <span className="acct-ledger-desc" role="columnheader">说明</span>
        <span className="acct-ledger-type" role="columnheader">类型</span>
        <span className="acct-ledger-amount" role="columnheader">积分</span>
        <span className="acct-ledger-after" role="columnheader">之后余额</span>
      </div>
      {entries.map((e) => {
        // 冻结的结算：积分在冻结时已经从余额里扣掉了，这一条余额不变，不能画成再扣一次。
        const settlement = isHoldSettlement(e);
        const kind = settlement ? "settlement" : e.amount > 0 ? "credit" : e.amount < 0 ? "debit" : "neutral";
        return (
          <div key={e.id} className="acct-ledger-row" role="row" data-kind={kind}>
            <span className="acct-ledger-time num" role="cell">{formatDateTime(e.createdAt)}</span>
            <span className="acct-ledger-desc" role="cell" title={e.description}>
              {e.description || LEDGER_TYPE_LABEL[e.type] || "—"}
            </span>
            <span className="acct-ledger-type" role="cell">
              {settlement ? HOLD_SETTLEMENT_LABEL : LEDGER_TYPE_LABEL[e.type] ?? "其他"}
            </span>
            <span
              className="acct-ledger-amount num"
              role="cell"
              title={
                settlement
                  ? `这 ${formatCredits(Math.abs(e.amount))} 积分冻结时已经从余额里扣掉了，这一条只是把冻结转为扣除，不会再扣一次`
                  : `${formatSignedCredits(e.amount)} 积分`
              }
              style={{ color: kind === "credit" ? "var(--success)" : kind === "debit" ? "var(--danger)" : "var(--ink-3)" }}
            >
              {settlement ? (
                "余额不变"
              ) : (
                <>
                  {formatSignedCredits(e.amount)}
                  <span className="acct-ledger-unit"> 积分</span>
                </>
              )}
            </span>
            <span className="acct-ledger-after num" role="cell">
              <span className="acct-ledger-after-label">余额 </span>
              {formatCredits(e.balanceAfter)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
