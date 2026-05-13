"use client";

// ─────────────────────────────────────────────────────────────────────────────
// producer-shell-context.tsx — 制作人控制台的共享状态。
// 原本 ProducerDashboard.tsx 单组件里持有的 activeArtist / artists / songs / wallet /
// notifications / lang 迁移到这里，供 app/producer/layout.tsx 与各子页 page.tsx 共用。
// navigate(page) 用 next/navigation 的 router.push('/console/' + page) 做真实路由跳转。
// ─────────────────────────────────────────────────────────────────────────────

import * as React from "react";
import { useRouter } from "next/navigation";
import { AccountApi, NotificationsApi } from "@/api";
import { INITIAL_NOTIFICATIONS } from "@/mocks/notifications";
import type { Notification } from "@ai-star-eco/types/notification";
import type { Wallet as WalletSnapshot } from "@ai-star-eco/types/wallet";
import type { Artist } from "@ai-star-eco/types/artist";
import type { Song } from "@ai-star-eco/types/music";
import type { MonthlyRevenuePoint } from "@ai-star-eco/types/finance";
import type { Lang } from "../translations";
import { useAuth } from "@ai-star-eco/api-client";
import { useProducerDashboard } from "@/components/producer/dashboard/hooks/use-producer-dashboard";

export interface ProducerShellValue {
  // 身份 / 公司
  user: ReturnType<typeof useAuth>["user"];
  onLogout: () => void;
  // 语言（中文单语仍保留 prop 透传给尚未单语化的子组件）
  lang: Lang;
  setLang: (l: Lang) => void;

  // 艺人与作品
  activeArtist: Artist | null;
  setActiveArtist: React.Dispatch<React.SetStateAction<Artist | null>>;
  artists: Artist[];
  songs: Song[];
  monthlyRevenue: MonthlyRevenuePoint[];
  artistsLoading: boolean;
  dataLoading: boolean;

  // 钱包
  wallet: WalletSnapshot | null;
  refetchWallet: () => void;

  // 通知
  notifications: Notification[];
  setNotifications: React.Dispatch<React.SetStateAction<Notification[]>>;
  unreadCount: number;

  // 路由跳转：传入 tab id（如 'artist'、'studio'）→ /producer/<id>
  navigate: (page: string) => void;

  // 当前"工坊"会随 activeArtist.type 换名 / 换图标，侧栏在 layout 里读这个做高亮
  currentPath: string | null;
}

const ProducerShellContext = React.createContext<ProducerShellValue | null>(null);

export interface ProducerShellProviderProps {
  children: React.ReactNode;
  lang: Lang;
  setLang: (l: Lang) => void;
  onLogout: () => void;
  currentPath: string | null;
}

export function ProducerShellProvider({
  children,
  lang,
  setLang,
  onLogout,
  currentPath,
}: ProducerShellProviderProps) {
  const router = useRouter();
  const { user } = useAuth();

  // 艺人 / 歌曲 / 收入
  const { artists, songs, monthlyRevenue, artistsLoading, dataLoading } = useProducerDashboard(user?.id);

  // activeArtist：列表变化时同步；不存在就取第一个，切账号后保留还在列表里的。
  const [activeArtist, setActiveArtist] = React.useState<Artist | null>(null);
  React.useEffect(() => {
    setActiveArtist((prev) => {
      if (prev && artists.some((a) => a.id === prev.id)) return prev;
      return artists[0] ?? null;
    });
  }, [artists]);

  // 钱包：挂载 + 路径变化后重新拉取（从 finance 页返回时顶栏金币气泡能刷新）
  const [wallet, setWallet] = React.useState<WalletSnapshot | null>(null);
  const refetchWallet = React.useCallback(() => {
    let cancelled = false;
    AccountApi.getMyWallet()
      .then((w) => {
        if (!cancelled) setWallet(w);
      })
      .catch(() => {
        /* 钱包未开通或接口失败，保持占位 */
      });
    return () => {
      cancelled = true;
    };
  }, []);
  React.useEffect(() => {
    refetchWallet();
  }, [refetchWallet, currentPath]);

  // 通知：拉后端为准；失败保留 mock 兜底
  const [notifications, setNotifications] = React.useState<Notification[]>(INITIAL_NOTIFICATIONS);
  React.useEffect(() => {
    let cancelled = false;
    NotificationsApi.listNotifications()
      .then((list) => {
        if (!cancelled && Array.isArray(list)) setNotifications(list);
      })
      .catch(() => {
        /* 静默失败 */
      });
    return () => {
      cancelled = true;
    };
  }, []);
  const unreadCount = React.useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications],
  );

  const navigate = React.useCallback(
    (page: string) => {
      // 为空或 '/' → 回到 overview（/producer）
      if (!page || page === "overview") {
        router.push("/console");
        return;
      }
      router.push(`/console/${page}`);
    },
    [router],
  );

  const value: ProducerShellValue = {
    user,
    onLogout,
    lang,
    setLang,
    activeArtist,
    setActiveArtist,
    artists,
    songs,
    monthlyRevenue,
    artistsLoading,
    dataLoading,
    wallet,
    refetchWallet,
    notifications,
    setNotifications,
    unreadCount,
    navigate,
    currentPath,
  };

  return <ProducerShellContext.Provider value={value}>{children}</ProducerShellContext.Provider>;
}

export function useProducerShell(): ProducerShellValue {
  const ctx = React.useContext(ProducerShellContext);
  if (!ctx) {
    throw new Error("useProducerShell must be used within <ProducerShellProvider> (app/producer/layout.tsx)");
  }
  return ctx;
}
