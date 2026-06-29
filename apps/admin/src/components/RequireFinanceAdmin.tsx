"use client";

import * as React from "react";
import { useAdminIdentity } from "@/lib/useAdminRole";

/**
 * v2 §6 资金财务页面门控 —— 仅 FINANCE_ADMIN / SUPER_ADMIN 可访问真实资金账务页
 * （充值订单 / 退款 / 对账 / 结算 / 风控 / 套餐）。OPERATOR 直访 URL 也拦下（菜单已隐藏 + 后端写动作已 @PreAuthorize）。
 */
export function RequireFinanceAdmin({ children }: { children: React.ReactNode }) {
  const { role } = useAdminIdentity();
  if (role === null) {
    return <div className="admin-page text-sm text-muted-foreground">加载中…</div>;
  }
  if (role !== "FINANCE_ADMIN" && role !== "SUPER_ADMIN") {
    return (
      <div className="admin-page">
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800">
          <div className="mb-1 font-medium">资金财务区 · 仅财务管理员可访问</div>
          当前角色无权查看真实资金账务页面（充值订单 / 退款 / 对账 / 结算 / 风控）。
          如需访问请用 FINANCE_ADMIN 账号登录；积分相关操作请走「积分运营 · 调差 / 赠送」。
        </div>
      </div>
    );
  }
  return <>{children}</>;
}
