"use client";

import * as React from "react";
import { UserPlus } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { Toolbar, FilterChip } from "@/components/shared/Toolbar";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { StatCard } from "@/components/shared/StatCard";
import { mapTone } from "@/components/shared/tone";
import { useAsyncList } from "@/components/shared/useAsyncList";
import { listUsers } from "@/api/users";
import { ACCOUNT_STATUS, ACCOUNT_KIND } from "@/constants/status";
import type { AepUser } from "@/types/account";

const STATUS_OPTIONS = [
  { value: "all",       label: "全部" },
  { value: "active",    label: "启用" },
  { value: "suspended", label: "停用" },
  { value: "deleted",   label: "注销" },
];

const KIND_OPTIONS = [
  { value: "all",      label: "全部" },
  { value: "studio",   label: "工作室" },
  { value: "personal", label: "个人" },
];

export default function AccountsPage() {
  const { data } = useAsyncList(() => listUsers(0, 500));
  const [q, setQ] = React.useState("");
  const [status, setStatus] = React.useState("all");
  const [kind, setKind] = React.useState("all");

  const rows = data.filter((u) => {
    if (status !== "all" && u.status !== status) return false;
    if (kind !== "all" && u.kind !== kind) return false;
    if (q && !(u.username.toLowerCase().includes(q.toLowerCase()) || u.displayName.toLowerCase().includes(q.toLowerCase()))) return false;
    return true;
  });

  const columns: Column<AepUser>[] = [
    {
      key: "identity",
      header: "账户",
      render: (u) => (
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-full bg-primary-soft text-primary flex items-center justify-center font-semibold ring-1 ring-primary/15">
            {u.displayName.slice(0, 1)}
          </div>
          <div className="min-w-0">
            <div className="font-medium truncate">{u.displayName}</div>
            <div className="text-xs text-muted-foreground truncate">@{u.username}</div>
          </div>
        </div>
      ),
    },
    { key: "email", header: "邮箱 / 手机", render: (u) => (
      <div className="text-xs text-muted-foreground">
        <div>{u.email ?? "—"}</div>
        <div>{u.phone ?? "—"}</div>
      </div>
    )},
    {
      key: "kind",
      header: "类型",
      render: (u) => {
        const m = ACCOUNT_KIND[u.kind];
        return m ? <StatusBadge tone={mapTone(m.tone)} label={m.label} dot={false} /> : null;
      },
    },
    {
      key: "status",
      header: "状态",
      render: (u) => {
        const m = ACCOUNT_STATUS[u.status];
        return m ? <StatusBadge tone={mapTone(m.tone)} label={m.label} /> : null;
      },
    },
    { key: "verify", header: "验证",
      render: (u) => (
        <div className="flex gap-1.5">
          <StatusBadge tone={u.emailVerified ? "success" : "neutral"} label="邮箱" dot={false} className="text-[10px] px-1.5 py-0" />
          <StatusBadge tone={u.phoneVerified ? "success" : "neutral"} label="手机" dot={false} className="text-[10px] px-1.5 py-0" />
        </div>
      ),
    },
    { key: "lastLogin", header: "最后登录", render: (u) => <span className="text-muted-foreground">{u.lastLoginAt?.slice(0, 10) ?? "—"}</span> },
    { key: "createdAt", header: "注册时间", render: (u) => <span className="text-muted-foreground">{u.createdAt.slice(0, 10)}</span> },
  ];

  return (
    <>
      <PageHeader
        title="账号管理"
        description="AepUser 账号档案 · 包含验证状态、所属机构与登录历史"
        actions={
          <button className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            <UserPlus className="h-4 w-4" /> 新建账号
          </button>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <StatCard label="总账号" value={data.length} tone="primary" />
        <StatCard label="启用中" value={data.filter((u) => u.status === "active").length} tone="emerald" />
        <StatCard label="已停用" value={data.filter((u) => u.status === "suspended").length} tone="amber" />
        <StatCard label="工作室数" value={data.filter((u) => u.kind === "studio").length} tone="violet" />
      </div>

      <Toolbar search={q} onSearchChange={setQ} searchPlaceholder="按用户名或昵称搜索" className="mb-3">
        <FilterChip label="状态" value={status} options={STATUS_OPTIONS} onChange={setStatus} />
        <FilterChip label="类型" value={kind} options={KIND_OPTIONS} onChange={setKind} />
        <span className="text-xs text-muted-foreground ml-auto">{rows.length} 条</span>
      </Toolbar>

      <DataTable<AepUser> columns={columns} rows={rows} rowKey={(u) => u.id} />
    </>
  );
}
