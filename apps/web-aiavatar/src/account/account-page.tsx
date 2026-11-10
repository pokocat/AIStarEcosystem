"use client";

// 账号区各页（2026-11-10 第三版）：/me/tasks、/me/credits、/me/storage(/trash)、/me/authorization(/ip、/stars)、
// /me/enterprise、/me/settings、/me/invitations。总览 /me 在 app/me/page.tsx。旧的 /studio#/… 由 /studio 页转过来。

import type { ReactNode } from "react";
import type { StudioTaskStatus } from "@ai-star-eco/types";
import { PlatformGateScreen, useRequireAuth } from "@/components/hub/auth";
import { AccountShell } from "@/shell/account-workspace";
import { AUTHORIZATION_TABS, STORAGE_TABS } from "@/shell/account-navigation";
import { useLayoutMode } from "@/shell/layout-mode";
import { EnterpriseWorkspace } from "@/ip/enterprise-workspace";
import { InvitationWorkspace } from "@/ip/invitation-workspace";
import { AccountMembership } from "./account-membership";
import { AccountTasks } from "./account-tasks";
import { AccountStorage } from "./account-storage";
import { AccountRealMaterials } from "./account-real-materials";
import { AccountStarGrants } from "./account-star-grants";
import { AccountTrash } from "./account-trash";
import { AccountSettings } from "./account-settings";
import { AccountOverview } from "./account-overview";
import "@/styles/enterprise.css";
import "@/styles/invitations.css";

type Page = { active: string; title: string; subTabs?: readonly { href: string; label: string }[]; render: (q: Query) => ReactNode };
type Query = { status?: StudioTaskStatus; rawAll?: boolean };

const PAGES = {
  tasks: { active: "tasks", title: "任务历史", render: q => <AccountTasks initialStatus={q.status} openAllRaw={q.rawAll} /> },
  credits: { active: "credits", title: "积分", render: () => <AccountMembership /> },
  storage: { active: "storage", title: "存储", subTabs: STORAGE_TABS, render: () => <AccountStorage /> },
  trash: { active: "storage", title: "存储", subTabs: STORAGE_TABS, render: () => <AccountTrash /> },
  authorization: { active: "authorization", title: "授权", subTabs: AUTHORIZATION_TABS, render: () => <AccountRealMaterials kind="real" /> },
  "authorization-ip": { active: "authorization", title: "授权", subTabs: AUTHORIZATION_TABS, render: () => <AccountRealMaterials kind="ip" /> },
  "authorization-stars": { active: "authorization", title: "授权", subTabs: AUTHORIZATION_TABS, render: () => <AccountStarGrants /> },
  enterprise: { active: "enterprise", title: "企业", render: () => <EnterpriseWorkspace /> },
  settings: { active: "settings", title: "设置", render: () => <AccountSettings /> },
} satisfies Record<string, Page>;

export type AccountPageKey = keyof typeof PAGES | "invitations";

function Body({ pageKey, query }: { pageKey: keyof typeof PAGES; query: Query }) {
  const page: Page = PAGES[pageKey];
  return <AccountShell active={page.active} title={page.title} subTabs={page.subTabs}>{page.render(query)}</AccountShell>;
}

/** 邀请朋友：电脑版是总览 + 邀请记录抽屉，手机版是单独一页。 */
function Invitations() {
  const layout = useLayoutMode();
  if (layout === "desktop") return <AccountOverview invitesOpen />;
  return <AccountShell title="邀请朋友"><InvitationWorkspace /></AccountShell>;
}

/** 账号区路由的入口：登录和产品开通检查后渲染对应页面。 */
export function AccountRoute({ page, status, rawAll }: { page: AccountPageKey; status?: StudioTaskStatus; rawAll?: boolean }) {
  // 邀请属于全局账号能力，不以本产品开通为条件（同原 /invitations）。
  const auth = useRequireAuth(true, page !== "invitations");
  if (auth === "no-platform") return <PlatformGateScreen />;
  if (auth !== "ok") return null;
  if (page === "invitations") return <Invitations />;
  return <Body pageKey={page} query={{ status, rawAll }} />;
}
