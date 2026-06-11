"use client";

// StarShellContext — 工作台共享状态：明星档案 + 总览（导航 badge 取数）。
// 页面在审批 / 状态机操作后调 refreshOverview() 同步左侧待办角标。

import * as React from "react";
import type { StarOverview, StarProfile } from "@ai-star-eco/types";
import { StarWorkbenchApi } from "@/api";

interface StarShellValue {
  profile: StarProfile | null;
  profileLoading: boolean;
  overview: StarOverview | null;
  refreshOverview: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const StarShellContext = React.createContext<StarShellValue | null>(null);

export function StarShellProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = React.useState<StarProfile | null>(null);
  const [profileLoading, setProfileLoading] = React.useState(true);
  const [overview, setOverview] = React.useState<StarOverview | null>(null);

  const refreshOverview = React.useCallback(async () => {
    try {
      setOverview(await StarWorkbenchApi.getOverview());
    } catch {
      // 总览失败不阻塞工作台（badge 缺省为空）
    }
  }, []);

  const refreshProfile = React.useCallback(async () => {
    setProfileLoading(true);
    try {
      setProfile(await StarWorkbenchApi.getProfile());
    } catch {
      setProfile(null);
    } finally {
      setProfileLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void refreshProfile();
    void refreshOverview();
  }, [refreshProfile, refreshOverview]);

  const value = React.useMemo(
    () => ({ profile, profileLoading, overview, refreshOverview, refreshProfile }),
    [profile, profileLoading, overview, refreshOverview, refreshProfile],
  );

  return <StarShellContext.Provider value={value}>{children}</StarShellContext.Provider>;
}

export function useStarShell(): StarShellValue {
  const ctx = React.useContext(StarShellContext);
  if (!ctx) throw new Error("useStarShell 必须在 StarShellProvider 内使用");
  return ctx;
}
