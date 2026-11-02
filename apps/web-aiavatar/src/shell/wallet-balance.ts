"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, EnterpriseApi } from "@ai-star-eco/api-client";
import { auth, USE_MOCK, WalletApi } from "@/proto/api";

export type EnterpriseCredits = { name: string; balance: number };

const credits = (value: number) => {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error("Invalid wallet balance");
  return value;
};

async function loadWallet(): Promise<number> {
  return credits((await WalletApi.balance()).totalBalance);
}

/** The member's own enterprise credits; null when they have none to spend (not a member, or membership inactive). */
async function loadEnterprise(): Promise<EnterpriseCredits | null> {
  const contexts = await EnterpriseApi.mine().catch(error => {
    if (error instanceof ApiError && error.status === 404) return [];
    throw error;
  });
  const mine = contexts[0];
  if (!mine || mine.enterprise.status !== "active" || mine.member.status !== "active") return null;
  const assigned = await EnterpriseApi.myBalance(mine.enterprise.id);
  return { name: mine.enterprise.name, balance: credits(assigned.totalBalance) };
}

/** Only visible desktop windows poll; the server owns the balance and any reservations. */
function usePolledBalance<T>(account: string | null, enabled: boolean, location: string, load: () => Promise<T>) {
  const [state, setState] = useState<{ account: string | null; value?: T; error: boolean }>({ account: null, error: false });
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
        const value = await load();
        if (active && token === auth.token()) setState({ account, value, error: false });
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
  }, [account, enabled, load, refresh]);

  useEffect(refresh, [location, refresh]);
  const current = enabled && account && state.account === account ? state : undefined;
  return { value: current?.value, error: current?.error ?? false, refresh };
}

export function useWalletBalance(account: string | null, enabled: boolean, location: string) {
  const { value, error, refresh } = usePolledBalance(account, enabled, location, loadWallet);
  return { balance: value, error, refresh };
}

/** Enterprise credits the member can pay with in Studio; there is no enterprise backend in mock mode. */
export function useEnterpriseCredits(account: string | null, enabled: boolean, location: string) {
  const { value, error } = usePolledBalance(account, enabled && process.env.NEXT_PUBLIC_ENTERPRISE_ENABLED === "1" && !USE_MOCK, location, loadEnterprise);
  return error ? undefined : value ?? undefined;
}
