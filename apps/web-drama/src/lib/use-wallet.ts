"use client";

// 全站积分余额的唯一读法（v0.197）。
//
// 之前有两个余额：通用顶栏挂载时读一次钱包、之后再不刷新；短剧工作台顶栏在 reducer 里写死
// 1280、扣费时本地减。两个数对不上，用户还要照着工作台那个假数决定花不花积分。
// 现在两处都读这里：挂载时读一次，之后在三种时机重读 ——
//   1. 有人调了 notifyWalletChanged()（花了积分、充值到账、生成任务结束）；
//   2. 窗口重新获得焦点 / 标签页切回来（在别的页充了值再回来）；
//   3. 调用方手动 refresh()。
// 读失败时 wallet 保持 null，界面显示「—」，不要拿任何默认数字顶替。
import * as React from "react";
import { AccountApi } from "@ai-star-eco/api-client";
import type { Wallet } from "@ai-star-eco/types/wallet";

export const WALLET_CHANGED_EVENT = "drama:wallet-changed";

/** 余额可能变了（扣费 / 退款 / 充值到账）。所有 useWallet() 实例会重读一次。 */
export function notifyWalletChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(WALLET_CHANGED_EVENT));
}

export function useWallet(): { wallet: Wallet | null; refresh: () => void } {
  const [wallet, setWallet] = React.useState<Wallet | null>(null);
  const seq = React.useRef(0);

  const refresh = React.useCallback(() => {
    const mine = ++seq.current;
    AccountApi.getMyWallet()
      .then((w) => {
        if (mine === seq.current) setWallet(w);
      })
      .catch(() => {
        /* 读不到就保持上一次的值（首次为 null → 显示「—」） */
      });
  }, []);

  React.useEffect(() => {
    refresh();
    const onChanged = () => refresh();
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    window.addEventListener(WALLET_CHANGED_EVENT, onChanged);
    window.addEventListener("focus", onChanged);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener(WALLET_CHANGED_EVENT, onChanged);
      window.removeEventListener("focus", onChanged);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh]);

  return { wallet, refresh };
}
