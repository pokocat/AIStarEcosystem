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
  /**
   * v0.99 例行 QA：overview 取数失败时的错误信息 —— 侧栏 badge 沿用「缺省为空」的静默降级，
   * 但 dashboard/page.tsx 用同一个 overview 门控整页内容渲染，此前没有错误信号会导致
   * 请求失败时页面卡在永久加载骨架（无报错、无重试提示）。加这个字段仅供页面自行决定是否
   * 展示错误态，不改变 refreshOverview 本身「失败不阻塞」的既有语义。
   */
  overviewError: string | null;
  refreshOverview: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const StarShellContext = React.createContext<StarShellValue | null>(null);

export function StarShellProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = React.useState<StarProfile | null>(null);
  const [profileLoading, setProfileLoading] = React.useState(true);
  const [overview, setOverview] = React.useState<StarOverview | null>(null);
  const [overviewError, setOverviewError] = React.useState<string | null>(null);

  const refreshOverview = React.useCallback(async () => {
    try {
      setOverview(await StarWorkbenchApi.getOverview());
      setOverviewError(null);
    } catch (e) {
      // 总览失败不阻塞工作台（badge 缺省为空），但记录错误供页面按需展示
      setOverviewError(e instanceof Error ? e.message : "加载失败");
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
    () => ({ profile, profileLoading, overview, overviewError, refreshOverview, refreshProfile }),
    [profile, profileLoading, overview, overviewError, refreshOverview, refreshProfile],
  );

  return <StarShellContext.Provider value={value}>{children}</StarShellContext.Provider>;
}

export function useStarShell(): StarShellValue {
  const ctx = React.useContext(StarShellContext);
  if (!ctx) throw new Error("useStarShell 必须在 StarShellProvider 内使用");
  return ctx;
}
