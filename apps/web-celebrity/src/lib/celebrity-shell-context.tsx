"use client";

// ─────────────────────────────────────────────────────────────────────────────
// celebrity-shell-context.tsx
// AI 明星带货独立 app 的工作台共享上下文。仅暴露 wallet（celebrity-zone 组件唯一所需）。
// 旧 apps/web 中 producer-shell-context 暴露 activeArtist/songs/notifications 等大量字段，
// 对 celebrity 工作台是冗余的；保留最小集，需要时再扩展。
// ─────────────────────────────────────────────────────────────────────────────

import * as React from "react";
import { AccountApi, useAuth } from "@ai-star-eco/api-client";
import type { Wallet } from "@ai-star-eco/types/wallet";

interface CelebrityShellValue {
  wallet: Wallet | null;
  walletLoading: boolean;
  refreshWallet: () => Promise<void>;
}

const CelebrityShellContext = React.createContext<CelebrityShellValue | null>(null);

export function CelebrityShellProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [wallet, setWallet] = React.useState<Wallet | null>(null);
  const [walletLoading, setWalletLoading] = React.useState(false);

  const refreshWallet = React.useCallback(async () => {
    if (!user) {
      setWallet(null);
      return;
    }
    setWalletLoading(true);
    try {
      const w = await AccountApi.getMyWallet();
      setWallet(w);
    } catch {
      setWallet(null);
    } finally {
      setWalletLoading(false);
    }
  }, [user]);

  React.useEffect(() => {
    refreshWallet();
  }, [refreshWallet]);

  const value: CelebrityShellValue = { wallet, walletLoading, refreshWallet };
  return <CelebrityShellContext.Provider value={value}>{children}</CelebrityShellContext.Provider>;
}

export function useCelebrityShell(): CelebrityShellValue {
  const ctx = React.useContext(CelebrityShellContext);
  if (!ctx) throw new Error("useCelebrityShell must be used within <CelebrityShellProvider>");
  return ctx;
}

// 兼容层：celebrity-zone 组件原先 import `useProducerShell` 仅消费 wallet。
// 保留同名导出，避免改组件内部源码（除 import 路径外）。
export const useProducerShell = useCelebrityShell;
