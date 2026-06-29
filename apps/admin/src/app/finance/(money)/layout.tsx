"use client";

// ─────────────────────────────────────────────────────────────────────────────
// 资金财务路由组守卫（v2 §6）—— 此组下所有页（充值订单 / 对账 / 结算 / 风控 / 套餐）
// 仅 FINANCE_ADMIN / SUPER_ADMIN 可访问；非财务角色直访 URL 也被拦下（菜单已隐藏 + 后端 403）。
// 调差/赠送（积分面）不在此组,故 OPERATOR 仍可提交。
// ─────────────────────────────────────────────────────────────────────────────

import * as React from "react";
import { RequireFinanceAdmin } from "@/components/RequireFinanceAdmin";

export default function MoneyZoneLayout({ children }: { children: React.ReactNode }) {
  return <RequireFinanceAdmin>{children}</RequireFinanceAdmin>;
}
