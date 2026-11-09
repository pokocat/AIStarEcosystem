"use client";

// /studio#/<账号页> 的新版页面（2026-11-09）。旧 proto 里的同名页面只在本 SPA 内部还被引用时才会出现。

import type { ReactNode } from "react";
import { AccountShell } from "@/shell/account-workspace";
import { AccountMembership } from "./account-membership";
import { AccountTasks } from "./account-tasks";
import { AccountStorage } from "./account-storage";
import { AccountRealMaterials } from "./account-real-materials";
import { AccountTrash } from "./account-trash";
import { AccountSettings } from "./account-settings";

const PAGES: Record<string, { title: string; render: () => ReactNode }> = {
  membership: { title: "会员与积分", render: () => <AccountMembership /> },
  tasks: { title: "任务历史", render: () => <AccountTasks /> },
  storage: { title: "存储用量", render: () => <AccountStorage /> },
  realmaterials: { title: "真人授权素材", render: () => <AccountRealMaterials /> },
  trash: { title: "回收站", render: () => <AccountTrash /> },
  settings: { title: "设置与安全", render: () => <AccountSettings /> },
};

export function hasAccountPage(key: string | undefined): key is string {
  return !!key && key in PAGES;
}

export function AccountPage({ pageKey }: { pageKey: string }) {
  const page = PAGES[pageKey];
  return <AccountShell active={pageKey} title={page.title}>{page.render()}</AccountShell>;
}
