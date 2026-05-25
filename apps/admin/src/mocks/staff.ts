// ─────────────────────────────────────────────────────────────────────────────
// mocks/staff.ts — 后台管理员账号样本（admin_users 表）。
// 与 DataInitializer 默认 seed 的两个账号对齐。
// ─────────────────────────────────────────────────────────────────────────────

import type { AdminUser } from "@/types/account";

export const ADMIN_STAFF_MOCKS: AdminUser[] = [
  {
    id: "admin-seed-1",
    username: "admin",
    email: "admin@aistareco.com",
    displayName: "超级管理员",
    role: "SUPER_ADMIN",
    status: "active",
    createdAt: "2025-12-01T00:00:00Z",
    updatedAt: "2026-05-20T08:00:00Z",
    lastLoginAt: "2026-05-25T01:12:00Z",
  },
  {
    id: "admin-seed-2",
    username: "operator",
    email: "operator@aistareco.com",
    displayName: "平台运营",
    role: "OPERATOR",
    status: "active",
    createdAt: "2025-12-01T00:00:00Z",
    updatedAt: "2026-05-20T08:00:00Z",
    lastLoginAt: "2026-05-24T11:42:00Z",
  },
];
