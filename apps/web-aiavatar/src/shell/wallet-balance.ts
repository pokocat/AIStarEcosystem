"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { auth, USE_MOCK, WalletApi } from "@/proto/api";

/** Only visible desktop windows poll; the server owns the balance and any reservations. */
export function useWalletBalance(account: string | null, enabled: boolean, location: string) {
  const [state, setState] = useState<{ account: string | null; balance?: number; error: boolean }>({ account: null, error: false });
  const refreshRef = useRef<() => void>(() => {});
  const refresh = useCallback(() => refreshRef.current(), []);

  useEffect(() => {
    if (!account || !enabled) return;
    let active = true;
    let pending = false;
    const run = async () => {
      if (!active || pending || document.visibilityState === "hidden") return;
      const token = auth.token();
      if (!USE_MOCK && !token) return;
      pending = true;
      try {
        const wallet = await WalletApi.balance();
        if (!Number.isSafeInteger(wallet.totalBalance) || wallet.totalBalance < 0) throw new Error("Invalid wallet balance");
        if (active && token === auth.token()) setState({ account, balance: wallet.totalBalance, error: false });
      } catch {
        if (active && token === auth.token()) setState({ account, error: true });
      } finally {
        pending = false;
      }
    };
    refreshRef.current = () => { void run(); };
    refresh();
    const timer = window.setInterval(refresh, 15_000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      active = false;
      refreshRef.current = () => {};
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [account, enabled, refresh]);

  useEffect(refresh, [location, refresh]);
  const current = enabled && account && state.account === account ? state : undefined;
  return { balance: current?.balance, error: current?.error ?? false, refresh };
}
